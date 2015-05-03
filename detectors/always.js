// A change detector that always reports a change

module.exports = function always() {
  return function (callback) {
    callback(null, true)
  }
}
