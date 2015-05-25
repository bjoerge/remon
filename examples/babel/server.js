import http from 'http'

const lastServerRestart = new Date().toString()

const server = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'})
  res.end(`<html>
    <head>
      <title>Remon babel example</title>
    </head>
    <body>
      <h1>Remon babel example</h1>
      <p>Last server restart was: <b>${lastServerRestart}</b></p>
      <p>Try edit "./examples/babel/server.js" and hit reload</p>
    </body>
    </html>
  `);
}).listen(3000);

server.on('listening', function () {
  const host = server.address().address
  const port = server.address().port
  console.log('Example app listening at http://%s:%s', host, port)
})
