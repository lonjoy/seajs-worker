define(function(require, exports, module) {
  var SeaWorker, has_q, is_worker;
  has_q = typeof Q === 'function';
  is_worker = typeof importScripts === 'function';
  Function.prototype.worker_method = function(name, fn) {
    if (!is_worker || typeof fn !== 'function') {
      return;
    }
    return this.prototype[name] = fn;
  };
  Function.prototype.browser_method = function(name, fn) {
    if (is_worker || typeof fn !== 'function') {
      return;
    }
    return this.prototype[name] = fn;
  };
  Function.prototype.worker_service = function(name, fn) {
    if (typeof fn !== 'function') {
      return;
    }
    if (is_worker) {
      return this.prototype[name] = fn;
    } else {
      return this.prototype[name] = function() {
        var args, cb, n;
        n = arguments.length;
        cb = arguments[n - 1];
        if (typeof cb === 'function') {
          args = Array.prototype.slice.call(arguments, 0, n - 1);
        } else {
          args = Array.prototype.slice.call(arguments, 0, n);
          cb = null;
        }
        if (has_q) {
          return this.invoke_promise(name, args, cb);
        } else {
          return this.invoke(name, args, cb);
        }
      };
    }
  };
  SeaWorker = (function() {
    SeaWorker.worker_method('init', function() {
      return self.onmessage = (function(_this) {
        return function(e) {
          var args, err, id, name, result;
          name = e.data.service;
          args = e.data.payload;
          id = e.data.id;
          try {
            result = _this[name].apply(void 0, args);
            return self.postMessage({
              service: name,
              id: id,
              result: result
            });
          } catch (_error) {
            err = _error;
            return self.postMessage({
              service: name,
              id: id,
              error: err.toString()
            });
          }
        };
      })(this);
    });

    SeaWorker.browser_method('init', function() {
      var launcher_url, payload, this_url;
      this.cb = {};
      this.id = 0;
      this_url = module.uri;
      launcher_url = this_url.replace("worker.js", "launcher.js");
      payload = {
        sea_url: seajs.data.loader,
        opts: SeaWorker.__sea_opts,
        worker_url: this.constructor.__sea_mod_uri
      };
      this._worker = new Worker(launcher_url);
      this._worker.onmessage = (function(_this) {
        return function(e) {
          var _ref;
          if (((_ref = e.data) != null ? _ref.service : void 0) != null) {
            return _this.handle(e.data);
          }
        };
      })(this);
      return this._worker.postMessage(payload);
    });

    SeaWorker.browser_method('handle', function(data) {
      var c, err;
      c = this.cb[data.id];
      delete this.cb[data.id];
      if (c.service !== data.service) {
        err = "Expect callback id=" + data.id + " for service " + c.service + ". Got " + data.service;
        if (has_q) {
          c.promise.reject(err);
        } else {
          throw err;
        }
      }
      if (has_q) {
        if (data.error != null) {
          c.promise.reject(data.error);
        } else {
          c.promise.resolve(data.result);
        }
      } else {
        if (typeof c.fn === "function") {
          c.fn(data.error, data.result);
        }
      }
    });

    SeaWorker.browser_method('invoke', function(service, args, callback) {
      this._worker.postMessage({
        service: service,
        payload: args,
        id: this.id
      });
      this.cb[this.id] = {
        service: service,
        fn: callback
      };
      return this.id++;
    });

    SeaWorker.browser_method('invoke_promise', function(service, args, callback) {
      var deferred;
      deferred = Q.defer();
      this._worker.postMessage({
        service: service,
        payload: args,
        id: this.id
      });
      this.cb[this.id] = {
        service: service,
        fn: callback,
        promise: deferred
      };
      this.id++;
      return deferred.promise.nodeify(callback);
    });

    function SeaWorker() {
      this.init();
    }

    SeaWorker.register = function(worker_class) {
      var worker;
      if (!is_worker) {
        return;
      }
      return worker = new worker_class();
    };

    SeaWorker.config = function(sea_opts) {
      return SeaWorker.__sea_opts = sea_opts;
    };

    seajs.on("exec", function(mod) {
      var _ref;
      return (_ref = mod.exports) != null ? _ref.__sea_mod_uri = mod.uri : void 0;
    });

    return SeaWorker;

  })();
  return module.exports = SeaWorker;
});
