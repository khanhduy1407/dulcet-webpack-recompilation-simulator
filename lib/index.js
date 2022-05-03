'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var tempfs = require('temp-fs');
var fs = require('fs');
var path = require('path');

module.exports = function () {
  function WebpackRecompilationHelper(compiler, options) {
    var _this = this;

    _classCallCheck(this, WebpackRecompilationHelper);

    this.compiler = compiler;
    this.options = options || {};
    this.mappings = { files: {}, folders: {} };
    // The tmp direcotry for the modified files
    this.tmpDirectory = this.options.tmpDirectory;
    // As we don't want to change the real source files we tell webpack to use
    // a version in the tmp directory
    compiler.plugin('normal-module-factory', function (nmf) {
      nmf.plugin('before-resolve', function (data, callback) {
        return callback(null, _this._resolveDependency(data));
      });
    });
    // Store the stats after the compilation is done
    compiler.plugin('done', function (stats) {
      _this.stats = stats;
    });
  }

  /**
   * This function creates a tmp version of the given file and modifies it
   * and will add the mapping so this file will be used during the next compilation
   *
   * @param {string} filename - The absolute path to the source file e.g. /a/path/main.js
   * @param {object} options - You have to set options.banner, options.footer or options.content to modify the file
   */


  _createClass(WebpackRecompilationHelper, [{
    key: 'simulateFileChange',
    value: function simulateFileChange(filename, options) {
      options = options || {};
      filename = path.resolve(filename);
      var tmpDir = tempfs.mkdirSync({ dir: this.tmpDirectory, track: true, recursive: true });
      var tmpFile = path.join(tmpDir.path, path.basename(filename));
      var originalFileContent = fs.readFileSync(filename).toString();
      var banner = options.banner || '';
      var footer = options.footer || '';
      var content = options.content;
      if (content === undefined) {
        content = banner + originalFileContent + footer;
      }
      if (content === originalFileContent) {
        throw new Error('File was not changed');
      }
      fs.writeFileSync(tmpFile, content);
      this.addMapping(filename, fs.realpathSync(tmpFile));
    }

    /**
     * Add a mapping so that webpack will use the targetFile instead of the sourceFile
     * during compilation
     */

  }, {
    key: 'addMapping',
    value: function addMapping(sourceFile, targetFile) {
      this.mappings.files[sourceFile] = targetFile;
      this.mappings.folders[path.dirname(targetFile)] = path.dirname(sourceFile);
    }

    /**
     * @private
     *
     * This function uses the mapping to compile the fake file instead of the real source file
     */

  }, {
    key: '_resolveDependency',
    value: function _resolveDependency(data) {
      // Context mapping
      data.context = this.mappings.folders[data.context] || data.context;
      // File mapping
      var requestParts = data.request.split('!');
      var requestedFile = path.resolve(data.context, requestParts.pop());
      if (this.mappings.files[requestedFile]) {
        requestParts.push(this.mappings.files[requestedFile]);
        data.request = requestParts.join('!');
      }
      return data;
    }

    /**
     * Compile
     */

  }, {
    key: 'run',
    value: function run() {
      var _this2 = this;

      return new Promise(function (resolve) {
        return(
          // Wait for 10ms before starting the compile run
          setTimeout(function () {
            return _this2.compiler.run(function () {
              return(
                // Wait for the next tick before resolving to allow all
                // plugins to finish
                process.nextTick(function () {
                  return resolve(_this2.stats);
                })
              );
            });
          }, 10)
        );
      });
    }
  }]);

  return WebpackRecompilationHelper;
}();
