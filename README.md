# Remon

A development tool that restarts your node.js server after code changes

It differs from other reload tools in that instead of watching the file system, it checks for source file changes on incoming HTTP requests.
Whenever a change is detected, the incoming request is put on hold while the application restarts. When the restart is completed, the incoming request is resumed.

`remon` does not require any configuration or setup, nor does it require you to modify existing code. It doesn't require (often cpu-intensive) file system watching as it just 
checks for modifications in files/modules that are loaded at runtime.

*Disclaimer*: Even though `remon` has been tested on multiple large-ish projects, it is still alpha and likely to be a bit unstable. Feel free to open an issue if you run into trouble.

# Getting started

```sh
npm install -g remon 
```

or if you wish to add it as a dependency to your project:

```sh
npm install --save-dev remon 
```

Then start your app with:

```
remon <your-script.js>
```

# Automatic reload

`remon` is a perfect fit for [quickreload](http://github.com/bjoerge/quickreload) which will tell the browser to reload when files are changed on disk. [Code example](/tree/master/examples/server.js)

# How it works:

- You start your app with `remon <your-script.js>`
- A master process is started
- Your script is then spawned in a child process
- Whenever `httpServer.listen(<port>)` is called from `your-script.js`, the `<port>` will be replaced with a random port
- The master process binds a http proxy on `<port>` instead, forwarding requests to the random port that the child process is bound to.
- On each incoming request, the master process will tell the child process to check for changes since previous request (using one or more change detectors, [more about that here](#change-detectors))
- If a change is detected, the incoming request is put on hold while the child process is restarted and resumed when the child process is up running again.

# Why?

Existing file watching tools has a lot of issues with due to compatibility problems with `fs.watch` and therefore falls back to polling the filesystem for changes. This means they are slower at picking up changes than they need to be, and puts a higher load than necessary on the CPU in large projects.

This problem is really painful when you hit the reload button just in time before the file change is detected, and the server unexpectedly gives you an outdated version.

Furthermore, if you hit reload before the server is completely restarted, one of these *three* things may happen:

1. The request is processed and completed *before* the monitor has even detected that the change occurred. You will get the previous version, not the new as you would expect.
2. The request is *partially* processed before changes are detected, and you may end up with a broken page where the HTML may be served, but remaining requests for other resources (js/css) may be aborted by the restarting server.
3. The server is down, busy restarting.

In my own experience, I end up hitting reload approximately three times before the server is finally restarted.

* `remon` overcomes this by checking for changes at *incoming* requests to see if anything has changed since the previous request.

* if a change is detected it will put the incoming request on hold until the app is fully restarted and ready to handle the request with the new version of the code.


# Change detectors

A change detector is simply a strategy that detects if any files has changed since the previous check was done.

The default change detector is `require` which taps into `require.cache` and checks the files there for modifications.

A change detector is implemented as a function which takes an options hash as first parameter and returns a detector
function that again takes a callback. This callback should be invoked with (err, truthy|falsy) depending on whether a change was found or not.

For example, here's an implementation of a detector that will always report true, and thus make the server restart before each request:

```js
module.exports = function always() {
  return function (callback) {
    callback(null, true)
  }
}
```

# Gotchas

* Remon works by monkey patching `http.createServer` and `HttpServer.listen`. Keep this in mind if you run into 
weird http related issues.

* If you read static files (i.e. non-require()-d files) into memory on app startup, changes in these files will not be detected. A change detector that deals with this scenario is planned.

* Your app will run in a single child process. It will probably not play well with the cluster module.

* There are currently no provided strategy for detecting changes in other files than those loaded via require("filename"). 
  Strategies to deal with static files, resources, etc. is future work.

# Usage

```
  Usage: remon [options] <script.js>

  Options:

    --help ,    -h        Output usage information
    --version,  -v        Output the version number

    --detector, -d <name> Use the given change detector. Defaults to
                          "require", which detects changes in require.cache.
                          Specify multiple change detectors with
                          -d <cd> -d <other cd>

    --require, -r <name>  Require the given module. Useful when you want to
                          include a require hook for transpilers, etc.
```

# Babel, CoffeeScript, etc.

Usage with [Babel](http://babeljs.io) or coffee-script is as simple as require-ing the require hook:

```
remon -r babel/register myscript.js
```

Or:

```
remon -r coffee-script/register myscript.coffee
```
