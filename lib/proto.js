/**
 * Module dependencies.
 */

var utils = require('./utils');

// prototype

var app = module.exports = {};

/**
 * Utilize the given middleware `handle` to the given `route`,
 * defaulting to _/_. This "route" is the mount-point for the
 * middleware, when given a value other than _/_ the middleware
 * is only effective when that segment is present in the request's
 * pathname.
 *
 * For example if we were to mount a function at _/admin_, it would
 * be invoked on _/admin_, and _/admin/settings_, however it would
 * not be invoked for _/_, or _/posts_.
 *
 * Examples:
 *
 *      var app = stack();
 *      app.use(logger());
 *
 * This api is chainable, so the following is valid:
 *
 *      stack()
 *        .use(favicon());
 *
 * @param {String|Function} route, callback or server
 * @param {Function} callback or server
 * @return {Server} for chaining
 * @api public
 */

app.use = function(route, fn){
  // default route to '/'
  if ('string' != typeof route) {
    fn = route;
    route = '/';
  }

  // wrap sub-apps
  if ('function' == typeof fn.handle) {
    var server = fn;
    fn.route = route;
    fn = function(req, res, next){
      server.handle(req, res, next);
    };
  }

  // strip trailing slash
  if ('/' == route[route.length - 1]) {
    route = route.slice(0, -1);
  }

  this.stack.push({ route: route, handle: fn });

  return this;
};

/**
 * Handle server requests, punting them down
 * the middleware stack.
 *
 * @api private
 */

app.handle = function(req, res, out) {
  var stack = this.stack
    , fqdn = ~req.url.indexOf('://')
    , removed = ''
    , slashAdded = false
    , index = 0;

  function next(err) {
    var layer, path, status, c;

    if (slashAdded) {
      req.url = req.url.substr(1);
      slashAdded = false;
    }

    req.url = removed + req.url;
    req.originalUrl = req.originalUrl || req.url;
    removed = '';

    // next callback
    layer = stack[index++];

    // all done
    if (!layer || res.headerSent) {
      // delegate to parent
      if (out) return out(err);

      // unhandled error
      if (err) {
        // default to 500
        if (res.statusCode < 400) res.statusCode = 500;

        // respect err.status
        if (err.status) res.statusCode = err.status;

        // production gets a basic error message
        var msg = err.stack || err.toString();

        // log to stderr in a non-test env
        if ('test' != env) console.error(msg);
        if (res.headerSent) return;
        // res.setHeader('Content-Type', 'text/plain');
        // res.setHeader('Content-Length', Buffer.byteLength(msg));
        if ('HEAD' == req.method) return;
        // res.end(msg);
      } else {
        // res.statusCode = 404;
        // res.setHeader('Content-Type', 'text/plain');
        if ('HEAD' == req.method) return;
        // res.end('Cannot ' + req.method + ' ' + utils.escape(req.originalUrl));
      }
      return;
    }

    try {
      path = utils.parseUrl(req).pathname;
      if (undefined == path) path = '/';

      // skip this layer if the route doesn't match.
      if (0 != path.toLowerCase().indexOf(layer.route.toLowerCase())) return next(err);

      c = path[layer.route.length];
      if (c && '/' != c && '.' != c) return next(err);

      // Call the layer handler
      // Trim off the part of the url that matches the route
      removed = layer.route;
      req.url = req.url.substr(removed.length);

      // Ensure leading slash
      if (!fqdn && '/' != req.url[0]) {
        req.url = '/' + req.url;
        slashAdded = true;
      }

      var arity = layer.handle.length;
      if (err) {
        if (arity === 4) {
          layer.handle(err, req, res, next);
        } else {
          next(err);
        }
      } else if (arity < 4) {
        layer.handle(req, res, next);
      } else {
        next();
      }
    } catch (e) {
      next(e);
    }
  }
  next();
};