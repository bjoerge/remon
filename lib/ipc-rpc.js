var REPLY_TIMEOUT = 1000 * 5

var messageId = 0

module.exports = function rpc (channelName, channel, opts, methods) {
  var debug = require('debug')('remon:ipc-rpc-' + channelName)

  if (typeof methods === 'undefined') {
    methods = opts
    opts = {}
  }

  channel.on('message', onMessage)

  return {
    call: function (methodName, args, handle, callback) {
      if (typeof args === 'function') {
        callback = args
        args = undefined
        handle = undefined
      } else if (typeof handle === 'function') {
        callback = handle
        handle = undefined
      }
      var msgId = messageId++
      var _timer = setTimeout(timeout, opts.timeout || REPLY_TIMEOUT)

      channel.on('message', checkMessage)

      var outgoing = {id: msgId, method: methodName, args: args}
      channel.send(outgoing, handle)

      function checkMessage (message, handle) {
        if (message.id !== msgId) {
          return
        }
        debug('got pending reply: %o', message)
        var error = message.error
        if (error) {
          var _error = new Error('An error occurred while processing message ' + JSON.stringify(message) + '. Remote stack trace: ' + error.stack)
          _error.remote = error
          callback(_error)
        } else {
          callback(null, message.returnValue, handle)
        }
        destroy()
      }

      function destroy () {
        clearTimeout(_timer)
        channel.removeListener('message', checkMessage)
      }

      function timeout () {
        destroy()
        debug('timeout on method %s with args %o', methodName, args)
        callback(new Error('IPC RPC timeout after ' + opts.timeout || REPLY_TIMEOUT + 'ms'))
      }
    },
    destroy: function () {
      channel.removeListener('message', onMessage)
    }
  }

  function onMessage (message, handle) {
    var methodName = message.method
    var isReply = message.replyTo

    if (isReply) {
      return
    }

    var args = message.args || []

    debug('received message %o', message)
    if (!methodName) {
      debug('no method specified in message %o, skipping', channelName, message)
      return
    }

    if ((typeof methods[methodName]) !== 'function') {
      debug('Unknown rpc over ipc method `%s`', message.method)
      return
    }

    debug('calling %s.%s(%s)', channelName, methodName, args.map(JSON.stringify).join('', ''))

    var fn = methods[methodName]
    var passArgs = []
    if (fn.length > 1) {
      passArgs.push(args)
    }
    if (fn.length > 2) {
      passArgs.push(handle)
    }
    passArgs.push(callback)

    var error = null

    try {
      fn.apply(methods, passArgs)
    } catch (e) {
      error = e
    }
    if (error) {
      return handleError(error)
    }

    function handleError (err) {
      var reply = {
        id: message.id,
        error: {
          message: err.message,
          stack: err.stack
        }
      }
      debug('replying with error %o', error)
      channel.send(reply)
    }

    function callback (err, returnValue, replyHandle) {
      if (err) {
        return handleError(err)
      }
      var reply = {
        id: message.id,
        replyTo: methodName,
        returnValue: returnValue
      }

      debug('replying with success message %o', reply)
      channel.send(reply, replyHandle)
    }
  }
}
