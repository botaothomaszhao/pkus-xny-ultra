// ==UserScript==

// @name        新能源强制下载任何文件

// @namespace   http://tampermonkey.net/

// @version     1.0

// @description 用于显示通常被隐藏的下载等按钮。

// @author      c-jeremy

// @match       *://bdfz.xnykcxt.com:5002/exam*

// @grant       GM_addStyle

// ==/UserScript==

(function() {

    'use strict';


    var css = `

        [hidden]:not(#errorWrapper),

        button.hidden,

        div#editorModeButtons.hidden {

            display: block !important;

        }

    `;

    // 使用 GM_addStyle 函数注入 CSS

    GM_addStyle(css);

})();
