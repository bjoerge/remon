// A change detector that always reports a change

module.exports = function () {
  return function (callback) {
    callback(null, true)
  }
}
