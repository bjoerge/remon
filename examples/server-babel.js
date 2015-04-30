const app = require("express")();

app.use(require('quickreload')({server: app}))

const lastServerRestart = new Date().toString();

app.get("/", function (req, res) {
  res.status(200).send(`
    <html>
      <head>
      <title>Relegate CoffeeScript example</title>
      </head>
      <body>
        <h1>Relegate CoffeeScript example</h1>'
        <h2>Last server restart: ${lastServerRestart}</h2>
        <p>Try edit "./examples/server.js"</p>
      </body>
    </html>
  `);
});

app.get("/error", function (req, res) {
  throw new Error("Oh noes")
});

app.use(require("dev-error-handler"));

const server = app.listen(3000, function () {

  const host = server.address().address;
  const port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);

});
