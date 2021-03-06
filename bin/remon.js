#!/usr/bin/env node
var pathIsAbsolute = require('path-is-absolute')
var subarg = require('subarg')
var path = require('path')
var fs = require('fs')

var argv = subarg(process.argv.slice(2), {
  alias: {
    h: 'help',
    r: 'require',
    d: 'detector'
  }
})

function showHelp () {
  process.stdout.write(fs.readFileSync(path.join(__dirname, '/usage.txt')))
}

if (argv.help) {
  showHelp()
  process.exit(0)
}

if (!argv._[0]) {
  showHelp()
  process.exit(1)
}

const cwd = process.cwd()
module.paths.push(cwd, path.join(cwd, 'node_modules'), path.join(__dirname, '../', 'detectors'))

function resolveModule (mod) {
  if (fs.existsSync(mod) || fs.existsSync(mod + '.js')) {
    return path.resolve(mod)
  }
  return mod
}

// Require modules specified with --require
[].concat(argv.require || []).map(resolveModule).forEach(require)

// Todo: find a better way to pass config down to delegate
var isDelegate = process.env.DELEGATE
if (isDelegate) {
  var detectors = [].concat(argv.detector || ['require'])
    .map(function (arg) {
      if (typeof arg === 'object') {
        return {name: arg._[0], opts: arg}
      }
      return {name: arg, opts: {}}
    })
    .map(function (detector) {
      return require(resolveModule(detector.name))(detector.opts)
    })
}
// make the filename absolute
var filename = argv._[0]
if (!pathIsAbsolute(filename)) {
  filename = path.join(process.cwd(), filename)
}

require('../')({
  filename: filename,
  argv: process.argv,
  detectors: detectors
})
