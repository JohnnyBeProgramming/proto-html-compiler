﻿(function (window, document) {
    try {
        // Define the payload
        var encoders = {};
        var module = {};
        var ctx = window.___ctx___ = window.___ctx___ || {
            busy: true,
            init: function () {
                // Save Initial state
                if (!ctx.state) {
                    ctx.state = {
                        head: document.head.innerHTML,
                        body: document.body.innerHTML,
                    };
                }

                // Include: String Prototype
                /*{1}*/

                // Link included module
                if (module.exports) {
                    encoders.sp = module.exports;

                    var spx = new encoders.sp();
                    encoders.lzw = spx.encoders.lwz;
                    encoders.md5 = spx.encoders.md5;
                    encoders.base64 = spx.encoders.base64;
                    module.exports = null;
                }

                // Include: Remote Script Loader
                /*{2}*/

                // Link included module
                if (module.exports) {
                    module.exports = null;
                }
            },
            reset: function () {
                if (ctx.state) {
                    document.head.innerHTML = ctx.state.head;
                    document.body.innerHTML = ctx.state.body;
                }
                console.clear();
            },
            insert: function (item, parentElem) {
                console.debug('   + ' + item.type);
                switch (item.type) {
                    case 'script':
                        if (item.text) {
                            item.text['']().script(parentElem);
                        }
                        break;
                    case 'html':
                        if (item.text) {
                            ctx.html(item.text, parentElem);
                        }
                        break;
                    case 'comment':
                        if (item.text) {
                            ctx.comment(item.text, parentElem);
                        }
                        break;
                    default: break;
                }
            },
            title: function (desc) {
                if (desc) {
                    document.title = desc;
                }
            },
            link: function (attrs, parentElem, callback) {
                var link = document.createElement('link');
                link.onload = function () {
                    if (callback) callback(link);
                }
                if (attrs) {
                    for (var attrName in attrs) {
                        link[attrName] = attrs[attrName];
                    }
                }
                document.head.appendChild(link);
            },
            base: function (path) {
                var elem = document.createElement("base");
                elem.setAttribute('href', path);
                document.getElementsByTagName("head")[0].appendChild(elem);
            },
            meta: function (attrs) {
                var elem = document.createElement("meta");
                for (var name in attrs) {
                    elem.setAttribute(name, attrs[name]);
                }
                document.getElementsByTagName("head")[0].appendChild(elem);
            },
            html: function (contents, parentElem) {
                if (contents) {
                    var div = document.createElement('div');
                    div.innerHTML = contents;
                    if (div.childNodes && div.childNodes.length) {
                        for (var i = 0; i < div.childNodes.length; i++) {
                            var child = div.childNodes[i];
                            (parentElem || document.body).appendChild(child);
                        }
                    }
                }
            },
            comment: function (text, parentElem) {
                if (text) {
                    var c = document.createComment(text);
                    (parentElem || document.body).appendChild(c);
                }
            },
            style: function (contents, parentElem) {
                var style = document.createElement('style');
                style.textContent = contents;
                (parentElem || document.head).appendChild(style);
            },
            script: function (input, isUrl, parentElem, callback) {
                if (isUrl) {
                    // This is an import url
                    var isDone = false;
                    var url = input.toString();
                    input['']().inject(function (ctx) {
                        if (callback) callback(input);
                    }, false, parentElem || document.body);
                } else {
                    // This is javascript contents
                    input['']().script(parentElem || document.body);
                    if (callback) callback(input);
                }
            },
            load: function (payload) {
                if (payload) {
                    var success = true;
                    try {
                        // Decode and parse contents of the payload
                        var decoded = encoders.base64.decode(payload);
                        var htmlObj = JSON.parse(decoded);

                        if (htmlObj.clean) {
                            document.head.innerHTML = '';
                            document.body.innerHTML = '';
                        }

                        console.debug(' - Unpacking:', htmlObj);

                        // 1) Set document Language
                        var html = document.getElementsByTagName('html')[0];
                        if (htmlObj.lang && (html.lang != htmlObj.lang)) {
                            console.debug(' - Setting Language: ', htmlObj.lang);
                            html.lang = htmlObj.lang;
                        }

                        // 2) Load Headers
                        if (htmlObj.head && htmlObj.head.length) {
                            console.debug(' - Loading Headers...');
                            htmlObj.head.forEach(function (item) {
                                ctx.insert(item, document.head);
                            });
                        }

                        // 3) Load Body
                        if (htmlObj.body && htmlObj.body.length) {
                            console.debug(' - Loading Body...');
                            htmlObj.body.forEach(function (item) {
                                ctx.insert(item, document.body);
                            });
                        }

                        // 4) Call Ready
                        var queue = window.___ctx___.queue;
                        if (queue && queue.buffer && queue.buffer.length) {
                            console.debug(' - Running queued...');
                            queue.commit(function () {
                                ctx.ready(true);
                            });
                        } else {
                            ctx.ready(true);
                        }

                    } catch (ex) {
                        success = false;
                        ctx.ready(false);
                        alert(ex.message);
                    }

                }
            },
            ready: function (success) {
                if (success) {
                    console.debug(' - Ready.');
                } else {
                    console.debug(' - Not Ready.');
                }
                ctx.busy = !success;
            },
        };

        ctx.queue = {
            buffer: [],
            delay: 10 * 1000, //2 * 60 * 1000,
            async: typeof Promise === 'function',
            attach: function (func) {
                var action = ctx.queue.async ? function () {
                    // Modern browsers
                    return new Promise(function (resolve, reject) {
                        try {
                            func(resolve, reject);
                        } catch (ex) {
                            reject(ex);
                        }
                    });
                } : function () {
                    // Fallback: Simply call the action directly...
                    if (typeof func === 'function') {
                        func(function (result) {
                            // Resolved
                        }, function (err) {
                            // Rejected
                        });
                    }
                    return null;
                };
                ctx.queue.buffer.push(action);
                return ctx.queue;
            },

            // --------------------------------------------------------------------------

            init: function () {
                return ctx.queue.attach(function (resolve, reject) {
                    var result = ctx.init();
                    resolve(result);
                });
            },
            reset: function () {
                return ctx.queue.attach(function (resolve, reject) {
                    var result = ctx.reset();
                    resolve(result);
                });
            },
            insert: function (item, parentElem) {
                return ctx.queue.attach(function (resolve, reject) {
                    var result = ctx.insert(item, parentElem);
                    resolve(result);
                });
            },
            title: function (desc) {
                return ctx.queue.attach(function (resolve, reject) {
                    var result = ctx.title(desc);
                    resolve(result);
                });
            },
            base: function (path) {
                return ctx.queue.attach(function (resolve, reject) {
                    var result = ctx.base(path);
                    resolve(result);
                });
            },
            meta: function (attrs) {
                return ctx.queue.attach(function (resolve, reject) {
                    var result = ctx.meta(attrs);
                    resolve(result);
                });
            },
            html: function (contents, parentElem) {
                return ctx.queue.attach(function (resolve, reject) {
                    var result = ctx.html(contents, parentElem);
                    resolve(result);
                });
            },
            comment: function (text, parentElem) {
                return ctx.queue.attach(function (resolve, reject) {
                    var result = ctx.comment(text, parentElem);
                    resolve(result);
                });
            },
            style: function (contents, parentElem) {
                return ctx.queue.attach(function (resolve, reject) {
                    var result = ctx.style(contents, parentElem);
                    resolve(result);
                });
            },
            load: function (payload) {
                return ctx.queue.attach(function (resolve, reject) {
                    var result = ctx.load(payload);
                    resolve(result);
                });
            },
            link: function (attrs, parentElem, callback) {
                return ctx.queue.attach(function (resolve, reject) {
                    var done = false;
                    var result = ctx.link(attrs, parentElem, function (result) {
                        done = true;
                        resolve(result);
                        if (callback) callback(result);
                    });
                    var intv = setInterval(function () {
                        clearInterval(intv);
                        if (!done) {
                            reject(new Error('Promised <link> timed out.'));
                        }
                    }, ctx.queue.delay);
                });
            },
            script: function (input, isUrl, parentElem, callback) {
                return ctx.queue.attach(function (resolve, reject) {
                    var done = false;
                    var result = ctx.script(input, isUrl, parentElem, function (result) {
                        done = true;
                        resolve(result);
                        if (callback) callback(result);
                    });
                    var intv = setInterval(function () {
                        clearInterval(intv);
                        if (!done) {
                            reject(new Error('Promised <script> timed out.'));
                        }
                    }, ctx.queue.delay);
                });
            },

            // --------------------------------------------------------------------------

            step: function () {
                var pending = null;
                if (ctx.queue.buffer && ctx.queue.buffer.length) {
                    var nextCall = ctx.queue.buffer[0];
                    if (typeof nextCall === 'function') {
                        pending = nextCall(); // Call next action

                        if (pending && pending.then) {
                            pending.then(function () {
                                do { /* Process next queued item */ }
                                while (!ctx.queue.step() && ctx.queue.buffer.length);
                            }, function (error) {
                                if (confirm(error.message + '\r\nContinue Loading?')) {
                                    do { /* Process next queued item */ }
                                    while (!ctx.queue.step() && ctx.queue.buffer.length);
                                } else {
                                    throw error;
                                }
                            });
                        } else {
                            pending = null; // Run next
                        }
                    } else {
                        throw new Error('Expected queued action to be a function.');
                    }

                    ctx.queue.buffer.splice(0, 1);

                    if (!ctx.queue.buffer.length) {
                        ctx.ready(true);
                    }
                }
                return pending;
            },
            commit: function () {
                var isReady = true;
                if (ctx.queue.async) {
                    console.debug(' - Queued:', ctx.queue.buffer.length);
                } else if (confirm('Warning: Application might not run correctly.\r\nContinue?')) {
                    console.debug(' - Orderly:', ctx.queue.buffer.length);
                } else {
                    console.debug(' - Canceled.');
                    isReady = false;
                }

                if (isReady) {
                    do { // Process next queued item
                    } while (!ctx.queue.step() && ctx.queue.buffer.length);
                }
            },
        };


        // Check if available
        if (ctx.busy) {
            ctx.init();
        } else if (ctx.state) {
            ctx.reset();
        }

        // Load contents
        ctx.load(/*{0}*/);

    } catch (ex) {
        alert(ex.message);
    }

    return ctx;

})(window || {}, document || {});
