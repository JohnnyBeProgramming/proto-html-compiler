﻿var sp = require('proto-js-string');
var path = require('path');
var fs = require('fs');
var q = require('q');

var debug = true;
var toHtml = require('htmlparser-to-html');
var HtmlCompiler = {
    opts: {
        base: './',
        dest: './gen',
        debug: false,
        prefix: '$__$',
        clearHtml: false,
        mergeGroups: true,
        minifyScripts: true,
        scriptElements: true,
        ignoreComments: false,
        compressPrefix: null,
        compressContents: false,
        trimWhiteSpace: true,
        excludeStatements: [
            'console.debug',
        ].concat(!debug ? [
            'console.log',
        ] : []),
    },
    spx: new sp(),
    ctx: function (options) {
        var opts = options || {};
        for (var prop in HtmlCompiler.opts) {
            if (prop in opts == false) {
                opts[prop] = HtmlCompiler.opts[prop];
            }
        }
        return opts;
    },

    hashCode: function (val) {
        var hash = 0, i, chr, len;
        if (val.length == 0) return hash;
        for (i = 0, len = val.length; i < len; i++) {
            chr = val.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    },

    html: function (file, contents, options) {
        return HtmlCompiler
            .gen(file, contents, options)
            .then(function (output) {
                return HtmlCompiler.genFile(file, output, options);
            });
    },

    gen: function (file, contents, options) {
        var deferred = q.defer();
        var opts = HtmlCompiler.ctx(options);

        // Strip non-html prefix
        var pilot = contents.indexOf('<html');
        if (pilot > 0) contents = contents.substr(pilot);

        var htmlparser = require("htmlparser");
        var handler = new htmlparser.DefaultHandler(function (error, dom) {
            if (error)
                deferred.reject(new Error(error));
            else if (dom.length > 0 && dom[0].name == 'html') {
                var html = dom[0];
                var output = {
                    lang: html.attribs.lang,
                    head: [],
                    body: [],
                    clean: opts.clearHtml,
                };

                html.children.forEach(function (child) {
                    if (child.type == 'tag') {
                        switch (child.name) {
                            case 'head':
                                output.head = HtmlCompiler.inspectGroup(child, 'document.head', options);
                                break;
                            case 'body':
                                output.body = HtmlCompiler.inspectGroup(child, 'document.body', options);
                                break;
                        }
                    }
                });

                deferred.resolve(output);
            }
        });

        var parser = new htmlparser.Parser(handler);
        parser.parseComplete(contents);

        return deferred.promise;
    },

    genFile: function (filename, output, options) {

        // Generate Data (sync)
        HtmlCompiler.genJSON(filename, output, options);

        // Generate the compiled script (async)
        return HtmlCompiler.genScript(filename, output, options);
    },

    genJSON: function (filename, output, options) {
        var opts = HtmlCompiler.ctx(options);
        var contents = JSON.stringify(output, null, 4);
        var targetPath = path.join((opts.dest || process.cwd()), 'data/');
        var targetJSON = path.join(targetPath, filename + '.json');
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath);
        }
        fs.writeFileSync(targetJSON, contents);
    },

    genScript: function (filename, output, options) {
        var q = require('q');
        var deferred = q.defer();
        var opts = HtmlCompiler.ctx(options);

        var targetPath = path.join((opts.dest || process.cwd()), 'script/');
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath);
        }

        try {
            // Parse the contents and resolve promise
            var fileContents = JSON.stringify(output);
            if (fileContents) {
                deferred.resolve(fileContents);
            } else {
                deferred.reject(new Error('No Result'));
            }

        } catch (ex) {
            deferred.reject(ex);
        }

        return deferred.promise;
    },

    genMinified: function (fileContents, options) {
        var opts = HtmlCompiler.ctx(options);
        try {
            // Check for minification?
            var prefs = { fromString: true };
            if (opts.minifyScripts) {
                prefs = {
                    fromString: true,
                    mangle: {},
                    warnings: false,
                    compress: {
                        pure_funcs: opts.excludeStatements,
                    }
                };
            } else {
                prefs = {
                    fromString: true,
                    mangle: false,
                    compress: false
                }
            }

            var UglifyJS = require("uglify-js");
            var minified = UglifyJS.minify(fileContents, prefs);

            fileContents = minified.code;

        } catch (ex) {
            console.log(' - Error: ' + ex.message);
        }
        return fileContents;
    },

    expandElem: function (item) {
        return toHtml(item);
    },

    parseElem: function (item, parentIdent, options) {
        var output = null;
        var opts = options || HtmlCompiler.opts;
        var attrs = item.attribs || {};
        var compileOtps = null;
        if ('html-compile' in attrs) {
            compileOtps = attrs['html-compile'];
        }
        if (compileOtps == 'none') {
            return null;
        }
        switch (item.type) {
            case 'tag':
                switch (item.name) {
                    case 'base':
                        if (item.attribs && item.attribs.href) {
                            output = {
                                type: 'script',
                                text: opts.prefix + '.base("' + item.attribs.href + '");',
                            };
                        }
                        break;
                    case 'title':
                        if (!item.children.length) break;
                        output = {
                            type: 'script',
                            text: opts.prefix + '.title(' + JSON.stringify(item.children[0].data) + ');',
                        };
                        break;
                    case 'meta':
                        output = {
                            type: 'script',
                            text: opts.prefix + '.meta(' + JSON.stringify(item.attribs) + ');',
                        };
                        break;
                    case 'link':
                        var type = 'link';
                        var data = item.attribs;
                        var isUrl = item.attribs && item.attribs.href;
                        if (isUrl && item.attribs.rel == 'stylesheet') {
                            // Try and fetch local file
                            var relPath = item.attribs.href;
                            var filePath = path.join(opts.base, relPath);
                            if (fs.existsSync(filePath)) {
                                var buffer = fs.readFileSync(filePath, 'utf8');
                                isUrl = false;
                                data = buffer;
                            }
                            type = 'style';
                        }

                        output = {
                            type: 'script',
                            text: opts.prefix + '.' + type + '(' + JSON.stringify(data) + ', ' + parentIdent + ');',
                        };
                        break;
                    default:
                        var contents = HtmlCompiler.expandElem(item);
                        output = {
                            type: 'html',
                            text: contents,
                        };
                        break;
                }
                break;
            case 'style':
                if (!item.children.length) break;
                var data = item.children[0].data;
                output = {
                    type: 'script',
                    text: opts.prefix + '.style(' + JSON.stringify(data) + ', ' + parentIdent + ');',
                };
                break;
            case 'script':
                var isUrl = item.attribs && item.attribs.src;
                var data = isUrl ? item.attribs.src : item.children[0].data;
                if (isUrl) {
                    // Try and fetch local file
                    var filePath = path.join(opts.base, data);
                    if (fs.existsSync(filePath)) {
                        // Do something
                        var buffer = fs.readFileSync(filePath, 'utf8');
                        isUrl = false;
                        data = buffer;
                    }
                }

                output = {
                    type: 'script',
                    text: opts.prefix + '.script(' + JSON.stringify(data) + ', ' + JSON.stringify(isUrl) + ');',
                };
                break;
            case 'text':
                // Check if not empty?
                if (!opts.trimWhiteSpace || !item.data.replace(/ +?/g, '')) {
                    output = {
                        type: 'text',
                        text: item.data,
                    };
                }
                break;

            case 'comment':
                // Disable comments?
                if (!opts.ignoreComments) {
                    output = {
                        type: 'comment',
                        text: item.data,
                    };
                }
                break;
            default:
                console.log('   ? [UNKNOWN ELEM]: ', item);
                break;
        }
        return output;
    },

    scriptElems: function (output, parentIdent, options) {
        var list = [];
        var opts = options || HtmlCompiler.opts;
        if (output && output.length) {
            output.forEach(function (item) {
                // Check if the tag can be converted to a script
                switch (item.type) {
                    case 'comment':
                        if (!opts.ignoreComments) {
                            item = {
                                type: 'script',
                                text: opts.prefix + '.comment(' + parentIdent + ',' + JSON.stringify(item.text) + ');',
                            };
                        } else {
                            // Remove comments
                            item = null;
                        }
                        break;
                    case 'html':
                        item = {
                            type: 'script',
                            text: opts.prefix + '.html(' + parentIdent + ',' + JSON.stringify(item.text) + ');',
                        };
                        break;
                }

                if (item) {
                    list.push(item);
                }
            });
        }
        return list;
    },

    compressScripts: function (output, parentIdent, options) {
        // ToDo: Make Compression work...
        var list = [];
        var opts = options || HtmlCompiler.opts;
        if (output && output.length) {
            output.forEach(function (item) {
                if (!item.text) return;
                if (item.type == 'script') {
                    var pre = (opts.compressPrefix || '');
                    if (pre == '') {
                        var payload = item.text.replace(/( *\r\n *)/g, '');
                        var checksum = spx.encoders.md5(payload);
                        pre += '/*' + item.text.length + '::' + checksum + '*/';
                    }
                    var str = pre + item.text;
                    var enc = HtmlCompiler.spx.encoders.lzw.encode(str);
                    item.text = '"' + enc + '"' + '[\'\']().decompress().script("' + parentIdent + '")';
                }

                if (item) {
                    list.push(item);
                }
            });
        }
        return list;
    },

    inspectGroup: function (domElem, parentIdent, options) {
        var result = [];
        var opts = options || HtmlCompiler.opts;
        if (domElem.children) {
            domElem.children.forEach(function (item) {
                var output = HtmlCompiler.parseElem(item, parentIdent, options);
                if (output) {
                    result.push(output);
                }
            });
        }
        if (opts.scriptElements) {
            result = HtmlCompiler.scriptElems(result, parentIdent, options);
        }
        if (opts.mergeGroups) {
            result = HtmlCompiler.mergeGroups(result, options);
        }
        if (opts.compressContents) {
            result = HtmlCompiler.compressScripts(result, parentIdent, options);
        }
        return result;
    },

    mergeGroups: function (nodes, options) {
        if (!nodes.length) return nodes;
        var newNodes = [];
        var lastNode = null;
        for (var i = 0; i < nodes.length; i++) {
            var currNode = nodes[i];
            if (lastNode && lastNode.type == currNode.type) {
                lastNode.text += '\r\n' + currNode.text;
            } else {
                newNodes.push(currNode);
                lastNode = currNode;
            }
        }
        return newNodes;
    },

};

module.exports = HtmlCompiler;