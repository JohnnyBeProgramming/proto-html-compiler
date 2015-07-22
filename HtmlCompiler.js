var sp = require('proto-js-string');
var path = require('path');
var q = require('q');

var toHtml = require('htmlparser-to-html');
var defaults = {
    base: './',
    dest: 'gen/',
    debug: false,
    prefix: '$__$',
    clearHtml: false,
    mergeGroups: true,
    queueActions: true,
    minifyScripts: true,
    scriptElements: true,
    ignoreComments: true,
    compressPrefix: null,
    compressContents: false,
    trimWhiteSpace: true,
    excludeStatements: [
        // Functions to exclude....
        //'console.log', 
    ],
    templHtml: path.join(__dirname || '', './templates/Compiler.template.html'),
    templPathJS: path.join(__dirname || '', './templates/Compiler.template.js'),
};

var HtmlCompiler = {
    opts: defaults,
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

    init: function (options, fs) {
        try {
            HtmlCompiler.opts = defaults;
            HtmlCompiler.opts = HtmlCompiler.ctx(options);
            HtmlCompiler.opts.fs = fs;
        }
        catch (ex) {
            console.log('Error: ' + ex.message)
        }
        return HtmlCompiler.opts;
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

    genScript: function (filename, output, options) {
        var q = require('q');
        var deferred = q.defer();
        var opts = HtmlCompiler.ctx(options);

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
                        pure_funcs: (!opts.debug ? ['console.debug'] : []).concat(opts.excludeStatements),
                    }
                };
            } else {
                prefs = {
                    fromString: true,
                    mangle: false,
                    compress: false
                }
            }

            var UglifyJS = require('uglify-js');
            var minified = UglifyJS.minify(fileContents, prefs);

            fileContents = minified.code;
        } catch (ex) {
            console.log(' - Error: ' + ex.message);
        }
        return fileContents;
    },

    genTemplate: function (fileContents, vendorScripts, appScripts, options) {
        var opts = HtmlCompiler.ctx(options);
        var defaultTemplate = 'var payload = ' + JSON.stringify(fileContents, null, 4);
        try {
            // Check for template
            var templPathJS = opts.templPathJS;
            if (!templPathJS) return defaultTemplate;
            if (path.resolve(templPathJS) != path.normalize(templPathJS)) {
                templPathJS = path.join(process.cwd(), templPathJS);
            }

            // Parse the pre-defined scripting template...
            if (opts.fs && fileContents && templPathJS) {
                if (!opts.fs.existsSync(templPathJS)) return defaultTemplate;
                var contents = opts.fs.readFileSync(templPathJS, 'utf-8').replace(/^\uFEFF/, '');
                var payload = fileContents;
                var encodePayload = true;
                if (encodePayload) {
                    var jsonEnc = HtmlCompiler.spx.encoders.base64.encode(fileContents);
                    payload = '\'' + jsonEnc + '\'';
                }

                fileContents = (contents || '')
                    .replace(/___ctx___/g, opts.prefix)
                    .replace('/*{0}*/', payload || '')
                    .replace('/*{1}*/', vendorScripts || '')
                    .replace('/*{2}*/', appScripts || '')
            }
        } catch (ex) {
            console.log('Error: ' + ex.message);
        }
        return fileContents;
    },

    genIndex: function (targetFile, targets, options) {
        var opts = HtmlCompiler.ctx(options);
        if (opts.fs) {
            var templHtml = opts.templHtml;
            if (!templHtml) return false;
            if (path.resolve(templHtml) != path.normalize(templHtml)) {
                templHtml = path.join(process.cwd(), templHtml);
            }
            if (!opts.fs.existsSync(templHtml)) {
                console.log(' - Warning: Template file not found: ' + templHtml);
                return false;
            }

            var links = '';
            var list = [];
            for (var filename in targets) {
                list.push(filename);
            }

            try {
                var output = opts.fs.readFileSync(templHtml, 'utf-8');
                list.sort().forEach(function (filename) {
                    var jscript = targets[filename];
                    var style = 'width: 200px; margin-right: 8px;';
                    var css = 'btn btn-lg btn-primary pull-left';
                    if (jscript) {
                        jscript = escape(jscript);

                        links += '<li><a class="' + css + '" style="' + style + '" href="javascript:' + jscript + '">'
                               + filename.replace(/(\.html)$/i, '')
                               + '</a></li>';
                    }
                });

                var placeholder = '<li><a href="javascript:void()">Placeholder</a></li>';
                var result = output
                                .replace(placeholder, links);

                opts.fs.writeFileSync(targetFile, result);
            } catch (ex) {
                console.log('Error: ' + ex.message);
                throw ex;
            }
        }
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

        var prefix = opts.queueActions ? opts.prefix + '.queue' : opts.prefix;
        switch (item.type) {
            case 'tag':
                switch (item.name) {
                    case 'base':
                        if (item.attribs && item.attribs.href) {
                            output = {
                                type: 'base',
                                text: item.attribs.href,
                            };
                        }
                        break;
                    case 'title':
                        if (item.children.length) {
                            output = {
                                type: 'title',
                                text: item.children[0].data,
                            };
                        }
                        break;
                    case 'meta':
                        output = {
                            type: 'meta',
                            text: item.attribs,
                        };
                        break;
                    case 'link':
                        var type = 'link';
                        var data = item.attribs;
                        var isUrl = item.attribs && item.attribs.href;
                        if (isUrl && item.attribs.rel == 'stylesheet') {
                            try {
                                if (opts.fs) {
                                    // Try and fetch local file
                                    var relPath = item.attribs.href;
                                    var filePath = path.join(opts.base, relPath);
                                    if (opts.fs.existsSync(filePath)) {
                                        var buffer = opts.fs.readFileSync(filePath, 'utf8');
                                        isUrl = false;
                                        type = 'style';
                                        data = buffer;
                                    } else {
                                        type = 'link';
                                        data = item.attribs;
                                    }
                                }
                            } catch (ex) {
                                console.log('Error: ' + ex.message);
                            }
                        }

                        output = {
                            type: type,
                            text: data,
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
                    type: 'style',
                    text: data,
                };
                break;
            case 'script':
                var isUrl = item.attribs && item.attribs.src ? true : false;
                var data = isUrl
                            ? item.attribs.src
                            : (item.children.length ? item.children[0].data : null);

                if (isUrl) {
                    // Try and fetch local file
                    var filePath = path.join(opts.base, data);
                    if (opts.fs && opts.fs.existsSync(filePath)) {
                        try {
                            var buffer = opts.fs.readFileSync(filePath, 'utf8');
                            isUrl = false;
                            data = buffer;
                        } catch (ex) {
                            console.log('Error: ' + ex.message);
                        }
                    } else {
                        // Online URL...
                    }
                }

                var cond = HtmlCompiler.scriptCondition(item.attribs);
                output = {
                    type: 'script',
                    text: cond + prefix + '.script(' + JSON.stringify(data) + ', ' + JSON.stringify(isUrl) + ');',
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
                /*
                output = {
                    type: 'html',
                    text: item.data,
                };
                */
                break;
        }
        return output;
    },

    scriptCondition: function (attrs) {
        var cond = '';
        var condAttr = 'html-compile';
        if (attrs && condAttr in attrs) {
            cond = 'if (' + attrs[condAttr] + ') ';
        }
        return cond;
    },

    scriptElems: function (output, parentIdent, options) {
        var list = [];
        var opts = options || HtmlCompiler.opts;
        var prefix = opts.queueActions ? opts.prefix + '.queue' : opts.prefix;
        if (output && output.length) {
            output.forEach(function (item) {
                // Check if the tag can be converted to a script
                switch (item.type) {
                    case 'base':
                        if (item.text) {
                            item = {
                                type: 'script',
                                text: prefix + '.base(' + JSON.stringify(item.text) + ');',
                            };
                        } else {
                            item = null;
                        }
                        break;
                    case 'title':
                        if (item.text) {
                            item = {
                                type: 'script',
                                text: prefix + '.title(' + JSON.stringify(item.text) + ');',
                            };
                        } else {
                            item = null;
                        }
                        break;
                    case 'meta':
                        if (item.text) {
                            item = {
                                type: 'script',
                                text: prefix + '.meta(' + JSON.stringify(item.text) + ');',
                            }
                        } else {
                            item = null;
                        }
                        break;
                    case 'link':
                        if (item.text) {
                            var cond = HtmlCompiler.scriptCondition(item.text);
                            item = {
                                type: 'script',
                                text: cond + prefix + '.link(' + JSON.stringify(item.text) + ', ' + parentIdent + ');',
                            };
                        } else {
                            // Remove comments
                            item = null;
                        }
                        break;
                    case 'style':
                        if (item.text) {
                            item = {
                                type: 'script',
                                text: prefix + '.style(' + JSON.stringify(item.text) + ', ' + parentIdent + ');',
                            }
                        } else {
                            // Remove comments
                            item = null;
                        }
                        break;
                    case 'comment':
                        if (!opts.ignoreComments) {
                            item = {
                                type: 'script',
                                text: prefix + '.comment(' + JSON.stringify(item.text) + ', ' + parentIdent + ');',
                            };
                        } else {
                            // Remove comments
                            item = null;
                        }
                        break;
                    case 'html':
                        item = {
                            type: 'script',
                            text: prefix + '.html(' + JSON.stringify(item.text) + ', ' + parentIdent + ');',
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