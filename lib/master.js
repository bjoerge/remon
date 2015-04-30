var spawn = require('child_process').spawn
var http = require('http')
var rpc = require('./ipc-rpc')
var debug = require('debug')('relegate-master')
var xtend = require('xtend')
var httpProxy = require('http-proxy')
var debounce = require('./debounce-queue')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')

var ansiHTML = require('ansi-html')

debug('Running the actual app in a child process...')

function Delegate (options) {
  EventEmitter.call(this)
  this.options = options
  this.on('listening', function (port, delegatePort) {
    this.port = delegatePort
  }.bind(this))
}
inherits(Delegate, EventEmitter)

Delegate.prototype.spawn = function () {
  this.process = spawn(this.options.argv[0], process.argv.slice(1), {
    stdio: ['pipe', 1, 2, 'ipc'],
    env: xtend({}, process.env, {DELEGATE: true})
  })

  this.channel = rpc('master', this.process, {
    error: function (args, ack) {
      var stack = args[0]
      this.emit('error', stack)
      ack()
    }.bind(this),
    listening: function (args, ack) {
      var port = args[0]
      var delegatePort = args[1]
      this.emit('listening', port, delegatePort)
      ack()
    }.bind(this)
  })

  this.once('listening', this.createChecker.bind(this))
}

Delegate.prototype.respawn = function (port, callback) {
  console.log('Restarting...')
  this.lastFailed = false
  this.spawn()

  this.on('listening', checkPort)
  this.on('error', handleError)

  var _this = this

  function cleanup () {
    _this.removeListener('listening', checkPort)
    _this.removeListener('error', checkPort)
  }

  function checkPort (listeningOn, delegatePort) {
    if (listeningOn !== port) {
      return
    }
    callback(null, delegatePort)
    cleanup()
  }

  function handleError (error) {
    debug('unable to respawn: %s', error)
    _this.lastFailed = true
    callback(error)
    cleanup()
  }
}

Delegate.prototype.createChecker = function (port, delegatePort) {
  debug('Attaching shimmed proxy server to port %d', delegatePort)

  this.check = debounce(function (callback) {
    if (this.lastFailed) {
      return this.respawn(port, callback)
    }
    this.channel.call('check', function (err, changed) {
      if (err) {
        return callback(err)
      }
      if (!changed) {
        debug('No changes, just forward to %d', delegatePort)
        return callback()
      }
      debug('Change detected in %s, hang on!', changed)
      this.process.kill()
      debug('Delegate server killed')
      this.respawn(port, callback)
    }.bind(this))
  }.bind(this))
}

var _createServer = http.createServer

function Proxy (delegate) {
  this.delegate = delegate
  this.map = {}
  this.servers = {}
  this.delegate.on('listening', function (port, delegatePort) {
    this.bind(port, function (error) {
      if (error) {
        throw error
      }
      this.map[port] = delegatePort
    }.bind(this))
  }.bind(this))

  this.proxy = httpProxy.createProxyServer({
    ws: true
  })

}

Proxy.prototype.bind = function (port, callback) {
  if (this.servers[port]) {
    return callback(null, this.servers[port])
  }

  debug('Create proxy server on port %d', port)
  var server = this.servers[port] = _createServer.call(http)
  server.on('request', this.handleRequest.bind(this, port))
  server.on('upgrade', this.handleUpgrade.bind(this, port))

  listen(callback)

  function listen (callback) {
    server.on('listening', onListen)
    server.on('error', onError)
    server.listen(port)
    function onError (e) {
      if (e.code === 'EADDRINUSE') {
        console.log('Address in use, retrying...')
        setTimeout(function () {
          listen(callback)
        }, 1000)
        cleanup()
      }
    }

    function onListen () {
      cleanup()
      callback()
    }

    function cleanup () {
      server.removeListener('listening', onListen)
      server.removeListener('error', onError)
    }
  }
}

Proxy.prototype.handleRequest = function (port, req, res) {
  debug('Incoming request on port %d, check for changes!', port)
  this.delegate.check(function (error) {
    if (error) {
      debug('Got error while checking for changes: %s', error)
      res.writeHead(503, {'Content-Type': 'text/html'})
      return res.end('<body style="background-color: #242F36color: #aaa"><pre>' + ansiHTML(error) + '</pre></body>')
    }
    var delegatePort = this.map[port]
    debug('Forwarding to %d', delegatePort)
    this.proxy.web(req, res, {target: {port: delegatePort}}, function (err) {
      debug('Proxy error: %o. This is usually ok.', err)
      res.writeHead(503)
      res.end('Proxy error: ' + err.message)
    })
  }.bind(this))
}
Proxy.prototype.handleUpgrade = function (port, req, socket, head) {
  debug('Proxy server got an upgrade %o', head)
  var delegatePort = this.map[port]
  this.delegate.check(function (error) {
    if (error) {
      return console.error(error)
    }
    this.proxy.ws(req, socket, head, {target: {port: delegatePort}}, function (err) {
      debug('ws proxy error that most likely can be ignored: %o', err)
    })
  }.bind(this))
}

module.exports = function register (options) {
  http.createServer = function (requestListener) {
    debug('Trapped http.createServer call. Spawning a child process for it.')

    var mockedServer = _createServer.call(http) // Ignore the request listener here
    mockedServer.listen = function (port, listenCallback) {
      debug('Aborting listen on port %d', port)
      // intentionally skip call listenCallback
      return mockedServer
    }
    return mockedServer
  }
  require(options.filename)
  debug('Spawning delegate process')

  var delegate = new Delegate(options)

  delegate.spawn()

  new Proxy(delegate) // eslint-disable-line no-new

}
