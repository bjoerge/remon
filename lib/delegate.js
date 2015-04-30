var rpc = require('./ipc-rpc')
var debug = require('debug')('relegate:delegate')
var http = require('http')

function some (fns, cb) {
  if (fns.length === 0) {
    return cb(null, false)
  }
  var isDone = false
  var pending = fns.length
  fns.forEach(function (fn) {
    fn(function (err, bool) {
      pending--
      if (isDone) {
        return
      }
      if (err) {
        callback(err)
      }
      if (bool) {
        callback(null, true)
      }
      if (pending === 0) {
        callback(null, false)
      }
    })
  })

  function callback (err, val) {
    isDone = true
    cb(err, val)
  }
}

module.exports = function (options) {
  var checkers = options.checkers || []

  debug('using checkers %o', checkers)

  var master = rpc('delegate', process, {
    check: function (args, handle, callback) {
      debug('Master is requesting a change check')
      some(checkers, callback)
    },
    detach: function (callback) {
      var pending = servers.length
      servers.forEach(function (server) {
        server.close(function () {
          pending--
          if (pending === 0) {
            callback()
          }
        })
      })
    }
  })

  var servers = []

  var createServer = http.createServer
  var listen = http.Server.prototype.listen

  // Monkey patch http.createServer
  http.createServer = function createServer$$Relegate (requestListener) {
    debug('Trapped a http.createServer() call')
    var server = createServer.call(http, requestListener)
    servers.push(server)

    server.listen = function http$Server$listen$$Relegate (port) {
      var lastArg = arguments[arguments.length - 1]
      var listenCallback = typeof lastArg === 'function' && lastArg

      debug('Calling listen on random port instead of %d', port)
      listen.call(server, 0, function () {
        var address = server.address()
        var delegatePort = address.port
        address.port = port

        server.address = function $address$$Relegate () {
          return address
        }

        if (listenCallback) {
          listenCallback()
        }

        master.call('listening', [port, delegatePort], function (err) {
          if (err) {
            throw err
          }

          debug('Successfully told master the port to forward to (%d => %d)', port, delegatePort)
        })
      })
      return server
    }
    return server
  }

  // As we are in a spawned delegate process, a syntax error may have been introduced
  try {
    require(options.filename)
  } catch(e) {
    master.call('error', [e.stack], function () {
      throw e
    })
  }
}
