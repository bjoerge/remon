import express from 'express'
import browserify from 'browserify'
import quickreload from 'quickreload'
import rebundler from 'rebundler'
import serve from 'staticr/serve'
import devErrorHandler from 'dev-error-handler'

const app = express()

app.use(quickreload({server: app}))

const lastServerRestart = new Date().toString()

const fail = false

app.get('/', function(req, res) {

  if (fail) {
    throw new Error('Failing because fail is set to true in ./examples/advanced/server.js')
  }

  res.status(200).send(`<html>
    <head>
      <title>Remon advanced example</title>
      <script src="./browser.js"></script>
    </head>
    <body>
      <h1>Remon advanced example</h1>
      <p>Last server restart was: <b>${lastServerRestart}</b></p>
      <p>Try edit "./examples/advanced/server.js"</p>
    </body>
    </html>
  `)
})

const entry = rebundler({persist: true, persistKey: process.env.REMON_PROCESS_ID}, function(cache, packageCache) {
  return browserify(require.resolve("./browser.js"), {
    cache: cache,
    packageCache: packageCache,
    fullPaths: true
  })
});

app.use(serve({ '/browser.js': ()=> entry().bundle() }))
app.use(devErrorHandler)

const server = app.listen(3000)

server.on('listening', function () {

  const host = server.address().address
  const port = server.address().port

  console.log('Example app listening at http://%s:%s', host, port)
})
