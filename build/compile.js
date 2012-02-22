var less = require('less'),
    async = require('async'),
    utils = require('kanso-utils/utils'),
    spawn = require('child_process').spawn,
    attachments = require('kanso-utils/attachments'),
    path = require('path');


function compileLess(doc, project_path, f, compress, callback) {
    /**
     * we get a rather cryptic error when trying to compile a file that
     * doesn't exist, so check early for that and report something
     * sensible
     */
    path.exists(f, function (exists) {
        if (!exists) {
            return callback(new Error('File does not exist: ' + f));
        }
        console.log('Compiling ' + utils.relpath(f, project_path));

        fs.readFile(f, 'utf-8', function (err, data) {
            if (err) {
                return callback(err);
            }
            var options = {
                silent: false,
                verbose: true,
                color: true,
                compress: compress,
                paths: [path.dirname(f)].concat(doc._less_paths),
                filename: f
            }
            console.log(['creating parser', options]);
            var parser = new (less.Parser)(options);

            try {
                console.log('parsing ' + f);
                parser.parse(data, function (err, root) {
                    if (err) {
                        less.writeError(err, options);
                        return callback(err);
                    }
                    try {
                        console.log('converting to css');
                        callback(null, root.toCSS(options));
                    }
                    catch (e) {
                        less.writeError(e, options);
                        callback(e);
                    }
                });
            }
            catch (e) {
                // sometimes errors are synchronous
                less.writeError(e, options);
                return callback(e);
            }
        });
    });
};

module.exports = function (root, _path, settings, doc, callback) {
    var filenames = Object.keys(doc._less_compile);
    async.forEachLimit(filenames, 5, function (f, cb) {
        var compress = doc._less_compile[f].compress;
        var att_path = doc._less_compile[f].att_path;
        compileLess(doc, _path, f, compress, function (err, css) {
            if (err) {
                console.error('Error compiling ' + f);
                return cb(err);
            }
            try {
                console.log(['adding to attachments', att_path]);
                attachments.add(doc, att_path, att_path, css);
            }
            catch (e) {
                return cb(e);
            }
            cb();
        });
    },
    function (err) {
        delete doc._less_paths;
        delete doc._less_compile;
        callback(err, doc);
    });
};
