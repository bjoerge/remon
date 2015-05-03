# Relegate

A development reload proxy for node based web apps.

Disclaimer: Even though `relegate` has been tested on multiple large-ish projects, it is still alpha and likely to be a bit unstable. Feel free to open an issue if you run into trouble.

# How it works:

- You start your app with `relegate <your-script.js>`
- A master process is started
- Your script is then spawned in a child process
- Whenever you somewhere in `your-script` calls `httpServer.listen(<port>)`, `<port>` will be replaced with a random port
- The master process binds a http proxy on  `<port>` instead, forwarding requests to the random port instead
- On each incoming request, the master process will tell the child process to check for changes since previous request (using one or more change detectors, more about that here)
- If a change is detected, the incoming request is put on hold while the child process is restarted

# Why?

Existing file watching tools has a lot of issues with due to compatibility problems with`fs.watch` and
therefore falls back to polling the filesystem for changes. This means they are slower at picking up changes than they need to be, and puts a higher load than necessary on the CPU in large projects.

This problem is really painful when you hit the reload button before the file change is detected, and the server serves
you the old version when the new version is what you'd expect.

Furthermore, if you hit reload before the server is completely restarted, one of these *three* things may happen:

1. The request is processed and completed *before* the monitor has even detected that the change occurred. You will get the previous version, not the new as you would expect.
2. The request is *partially* processed before changes are detected, and you may end up with a broken page where the HTML may be served, but remaining requests for other resources (js/css) may be aborted by the restarting server.
3. The server is down, busy restarting.

In my own experience, I end up hitting reload approximately three times before the server is finally restarted.

* `relegate` overcomes this by checking for changes at *incoming* requests to see if anything has changed since the previous request.

* if a change is detected it will puts any incoming request on hold until the app is fully restarted and ready to handle the request.


# Change detectors

A change detector is simply a strategy that detects if any files has changed since last check was issued.

The default change detector is `require` which taps into require.cache and  


It is implemented as a function with the signature 

# Assumptions / current limitations

* Your app will run in a single child process. It will probably not play well with the cluster module.

* There are currently no provided strategy for detecting changes in other files than those loaded via require("filename"). 
  Strategies to deal with static files, resources, etc. is future work.

# Gotchas

Relegate works by monkey patching `http.createServer` and `HttpServer.listen`. Keep this in mind if you run into 
weird http related issues.

# Usage

```
  Usage: relegate [options] <script.js>

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
relegate -r babel/register myscript.js
```

Or:

```
relegate -r coffee-script/register myscript.coffee
```