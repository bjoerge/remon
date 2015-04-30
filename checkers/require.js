var difference = require('lodash.difference')
var debug = require('debug')('relegate:checker:require')
var fs = require('fs')
var Module = require('module')

// A checker that detects changes in require.cache entries
function find (arr, iterator, callback) {
  var done = false
  var pending = arr.length

  arr.forEach(function (item, i) {
    iterator(item, function (err, found) {
      --pending
      if (done) {
        return
      }
      if (err) {
        onError(err)
      }
      if (found) {
        onFind(item)
      }
      if (pending === 0) {
        callback(null, null)
      }
    })
  })

  function onFind (item) {
    done = true
    callback(null, item)
  }
  function onError (err) {
    done = true
    callback(err)
  }
}

function forEach (arr, iterator, callback) {
  var done = false
  var pending = arr.length

  arr.forEach(function (item, i) {
    iterator(item, function (err, found) {
      --pending
      if (done) {
        return
      }
      if (err) {
        onError(err)
      }
      if (pending === 0) {
        callback(null)
      }
    })
  })

  function onError (err) {
    done = true
    callback(err)
  }
}

// Subscribe to method calls on any objects
function subscribe (object, method, fn) {
  var original = object[method]
  object[method] = function () {
    var retval = original.apply(this, arguments)
    fn.apply(null, arguments)
    return retval
  }
  return function () {
    object[method] = original
  }
}

function notDep (file) {
  return file.indexOf('node_modules') === -1
}

module.exports = function (opts) {
  opts = opts || {}

  var filter = opts.filter || notDep

  var stats = {}

  function readModules () {
    return Object.keys(require.cache).filter(filter)
  }

  subscribe(Module.prototype, 'load', function (file) {
    if (filter(file)) {
      registerFile(file, function () {
        debug('Registered %s', file)
      })
    }
  })

  return function requireCheck (callback) {
    var existingModules = Object.keys(stats)
    var currentModules = readModules()
    var newModules = difference(currentModules, existingModules)

    debug('New modules since previous check: %d, %o', newModules.length)

    debug("I've got %d known files'", existingModules.length)

    checkChanges(existingModules, function (err, changed) {
      debug('Found change? %s', changed)
      debug('error', err)
      if (err || changed) {
        return callback(err, changed)
      }
      addNew(newModules, function (err) {
        callback(err, false)
      })
    })
  }

  function hasChanged (file, callback) {
    fs.stat(file, function (err, stat) {
      if (err) {
        debug("Error while stat'ing %s, %s", file, err)
        if (err.code === 'ENOTFOUND') {
          // a deleted module should count as a change
          debug('File not found %s', file)
          return callback(true)
        }
        return callback(false)
      }
      var prev = stats[file]
      var changed = prev.mtime.getTime() < stat.mtime.getTime()
      if (changed) {
        debug('%s changed since %o!', file, prev.mtime)
      }
      callback(changed)
    })
  }

  function registerFile (file, callback) {
    fs.stat(file, function (err, stat) {
      if (err) {
        debug('Error on stat for %s: %s', file, err)
        return callback(err)
      }
      stats[file] = stat
      // debug('Registered %s with stat %o', file, stat)
      callback(null, stat)
    })
  }

  function addNew (newModules, callback) {
    debug('Adding %d new files', newModules.length)
    if (newModules.length === 0) {
      return callback(null)
    }
    forEach(newModules, registerFile, callback)
  }

  function checkChanges (files, callback) {
    debug('Looking for changes in %d files', files.length)
    find(files, hasChanged, function (changedFile) {
      callback(null, changedFile)
    })
  }
}
