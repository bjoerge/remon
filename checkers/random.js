// A simple change detecter that reports change at random intervals
module.exports = function (opts) {
  opts = opts || {}
  var probability = opts.probability || opts.p || 0.5
  return function randomCheck (callback) {
    callback(null, Math.random() < probability)
  }
}
