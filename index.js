var debug = require('debug')('relegate:main')
module.exports = function (options) {
  var isDelegate = process.env.DELEGATE
  debug('Initializing %s', isDelegate ? 'delegate' : 'master')

  if (isDelegate) {
    require('./lib/delegate')(options)
  } else {
    require('./lib/master')(options)
  }
}
