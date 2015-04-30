# Relegate

Reload proxy for node based web apps.

Puts your node web server behind a proxy, and restarts it when source files has changed.

`relegate` is alpha and likely to be a bit unstable at the moment. Feel free to open an issue if you run into trouble.

# Why?

Existing tools usually doesn't work that well with OSX due to compatibility issues with `fs.watch` and
therefore falls back to polling the filesystem for changes. This means they are slower at picking up changes than they need to be, and puts a higher than necessary load on the CPU for large projects.

This problem is really painful when you hit the reload button before the file change is detected, and the server serves
you the old version when the new version is what you'd expect.

If you hit reload before the server is completely restarted, one of these *three* things may happen:

1. The request is processed and completed *before* the monitor has even detected that the change occurred. You will get the previous version, not the new as you would expect.
2. The request is *partially* processed before changes are detected, and you may end up with a broken page where the HTML may be served, but remaining requests for other resources (js/css) may be aborted by the restarting server.
3. The server is down, busy restarting.

In my own experience, I end up hitting reload approximately three times before the server is finally restarted.

* `relegate` checks require.cache at *incoming* requests to see if any of the loaded files has changed since the previous request.

* if a change is detected it will puts any incoming request on hold until the app is fully restarted and ready to handle the request.

# Assumptions / current limitations

* Your app will run in a single child process. It will probably not play well with the cluster module.

* Only files in require.cache will trigger a full reload of the app. Static files, resources, etc. should be served as-is
 or bundled on the fly.

# Usage

```
  Usage: relegate [options] <script.js>

  Options:

    -h, --help            output usage information
    -v, --version         output the version number

    --checker, -c <name>  use the given checker strategy. Defaults to
                          "require", which detects changes in require.cache.

    --require, -r <name>  require the given module. Useful when you want to
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