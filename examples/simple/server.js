var http = require('http')

var lastServerRestart = new Date().toString()

var server = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'})
  res.end('<html>'+
    '<head>'+
      '<title>Remon example</title>'+
    '</head>' +
    '<body>' +
      '<h1>Remon example</h1>' +
      '<p>Last server restart was: <b>'+lastServerRestart +'</b></p>' +
      '<p>Try edit "./examples/simple/server.js" and hit reload</p>' +
    '</body>'+
    '</html>'
  );
}).listen(3000);

server.on('listening', function () {
  var host = server.address().address
  var port = server.address().port
  console.log('Example app listening at http://%s:%s', host, port)
})
