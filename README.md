# HTML Compiler and Translator (Javascript)

This package can compile and parse the HTML DOM into a JSON object for more efficient storage and retrieval. 

Given a valid JSON payload, the compiler can then translate this into the resulting HTML DOM into the current page.

The compiler can also generate files to a designated folder where you can inspect and copy the data models. 

## Getting Started

You can install the library from npm:

    npm install proto-html-compiler --save-dev

## Example Usage

In NodeJS, you can get the package and configure the options:

    // Get the package
    var fs = require('fs');
    var compiler = require('proto-html-compiler');

    // Initialise compiler options
    compiler.init({
        debug: false,
        base: '../app',
        dest: './compiled/',
        clearHtml: false,
        mergeGroups: false,
        queueActions: true,
        minifyScripts: true,
        scriptElements: true,
        ignoreComments: true,
        trimWhiteSpace: true,
        /*
        templHtml: './templates/Compiled.html',
        templPathJS: './templates/Injector.js',
        */
    }, fs);
    
    // Compile the html text into a JSON object
    compiler.gen(filename, htmlContents)
            .then(function(output) {
              console.log('Compiled Output:', output);
            })
    

## Motivation

This library was written because I needed a way to represent a HTML document as a JSON data model that can be modified and re-applied or replaced if need be.  

## Tests

No tests have been set up for this project.

## Contributors

This library is provided "as-is" and totally free to use. No support comes with it. If you want to make a contribution or include a new feature, you can create a pull request. I will reserve the right to update this package as new requirements become available.   

## MIT License

Copyright (c) 2014-2015 JohnnyBeProgramming - http://www.prototyped.info

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
