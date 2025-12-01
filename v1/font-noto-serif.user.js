// ==UserScript==

// @name         全局字体更改：Noto Serif Simplified Chinese

// @namespace    http://tampermonkey.net/

// @version      0.1

// @description  将 https://bdfz.xnykcxt.com:5002/* 上的所有文字字体更改为 Noto Serif Simplified Chinese。

// @author       CJeremy

// @match        https://bdfz.xnykcxt.com:5002/*

// @grant        GM_addStyle

// @run-at       document-start

// ==/UserScript==

(function() {

    'use strict';

    // 从 Google Fonts 引入 Noto Serif Simplified Chinese 字体

    const fontCss = `

        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap');

    `;

    // 将所有元素的字体都设置为 Noto Serif Simplified Chinese

    // 使用 !important 来确保覆盖网站原有的样式

    const style = `

        * {

            font-family: 'Noto Serif SC', serif !important;

        }

    `;

    // 注入 CSS

    GM_addStyle(fontCss);

    GM_addStyle(style);

})();