/*
 * grunt-express-server
 * https://github.com/ericclemmons/grunt-express-server
 *
 * Copyright (c) 2013 Eric Clemmons
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt, target) {
  if (!process._servers) {
    process._servers = {};
  }

  var backup    = null;
  var startdone = null;
  var stopdone  = null;
  var server    = process._servers[target]; // Store server between live reloads to close/restart express

  var finished = function() {
    if (startdone) {
      startdone();

      startdone = null;
    }
  };

  return {
    start: function(options) {
      if (server) {
        this.stop();

        if (grunt.task.current.flags.stop) {
          finished();

          return;
        }
      }

      backup = JSON.parse(JSON.stringify(process.env)); // Clone process.env

      // For some weird reason, on Windows the process.env stringify produces a "Path"
      // member instead of a "PATH" member, and grunt chokes when it can't find PATH.
      if (!backup.PATH) {
        if (backup.Path) {
          backup.PATH = backup.Path;
          delete backup.Path;
        }
      }

      grunt.log.writeln('Starting '.cyan + (options.background ? 'background' : 'foreground') + ' Express server');
      console.log(grunt.task.current);

      startdone = grunt.task.current.async();

      // Set PORT for new processes
      process.env.PORT = options.port;

      // Set NODE_ENV for new processes
      if (options.node_env) {
        process.env.NODE_ENV = options.node_env;
      }

      // Set debug mode for node-inspector
      if(options.debug) {
        options.args.unshift('--debug');
      }

      if (options.background) {
        server = process._servers[target] = grunt.util.spawn({
          cmd:      options.cmd,
          args:     options.args,
          env:      process.env,
          fallback: options.fallback
        }, function (error, result, code) {
          if (stopdone) {
            stopdone();
          }
          finished();
        });

        if (options.delay) {
          setTimeout(finished, options.delay);
        }

        if (options.output) {
          server.stdout.on('data', function(data) {
            var message = "" + data;
            var regex = new RegExp(options.output, "gi");
            if (message.match(regex)) {
              finished();
            }
          });
        }

        server.stdout.pipe(process.stdout);
        server.stderr.pipe(process.stderr);
      } else {
        // Server is ran in current process
        server = process._servers[target] = require(options.script);
      }

      process.on('exit', this.stopped.bind(this));
    },

    stop: function() {
      if (server && server.kill) {
        grunt.log.writeln('Stopping'.red + ' Express server');
        stopdone = grunt.task.current.async();
        server.kill('SIGTERM');
      }
      this.finish();
    },

    stopped: function() {
      grunt.log.writeln('Express server ' + 'Stopped'.red);
      process.removeAllListeners();
      if (server) {
          server = process._servers[target] = null;
      }
      this.finish();
    },

    finish: function() {
      // Restore original process.env
      if (backup) {
          process.env = JSON.parse(JSON.stringify(backup));
      }
      finished();
    }
  };
};
