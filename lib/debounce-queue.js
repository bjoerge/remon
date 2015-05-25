var debug = require('debug')('remon:debouncer')
module.exports = function debounce (task) {
  var queue = []
  var hot = false

  return add

  function add (fn) {
    queue.push(fn)
    if (hot) {
      debug('add fn to queue')
    }
    if (!hot) {
      hot = true
      debug('calling task')
      task(function () {
        var args = Array.prototype.slice.call(arguments, 0)
        debug('flush with args %o', args)
        process.nextTick(function () {
          flush.apply(null, args)
        })
      })
    }
  }

  function flush () {
    var cb
    while ((cb = queue.shift())) {
      cb.apply(null, arguments)
    }
    hot = false
  }
}
/*
var check = debounce(function(done) {
  console.log('Check called!')
  setTimeout(done, 1000)
})
var checkSync = debounce(function(done) {
  console.log('Check sync called!')
  done()
})

[0, 1,2,3,4].forEach(function(num) {
  setTimeout(function() {
    check(function() {
      console.log('Done checking', num)
    })
    check(function() {
      console.log('Done checking', num, 'II')
    })
  }, Math.floor(Math.random()*5*1000))

})

[0, 1,2,3,4].forEach(function(num) {
    checkSync(function() {
      console.log('Done checking sync', num)
    })
})
  */
