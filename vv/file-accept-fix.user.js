// ==UserScript==
// @name         文件上传选项修复
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      v1.1
// @license      GPL-3.0
// @description  将文件上传输入框的 accept 属性修改为 "*/*"，解决上传文件无调用相机选项的问题。
// @author       botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const inputSelector = 'input[type="file"]';

    // accept 列表（扩展名或 mime），例如 '.png .jpg .jpeg .pjp .pjpeg .gif .webp .svg .bmp .tif .tiff .ico .heic .heif .avif .jp2 .jpx'
    const acceptValue = '.png .jpg .jpeg .pjp .pjpeg .gif .webp .svg .bmp .tif .tiff .ico .heic .heif .avif .jp2 .jpx';

    // 可选配置：capture 属性值，如 "user" 或 "environment"，Edge实测只要设置就会直接唤起
    const captureValue = null;

    function relaxAccept(el) {
        if (!el || el.tagName !== 'INPUT' || el.type !== 'file') return;
        el.setAttribute('accept', acceptValue);
        if (captureValue) {
            el.setAttribute('capture', captureValue);
        }
    }

    // 处理已有元素
    document.querySelectorAll(inputSelector).forEach(relaxAccept);

    // 监听动态插入的元素
    const mo = new MutationObserver(records => {
        for (const r of records) {
            for (const n of r.addedNodes) {
                if (n.nodeType !== 1) continue;
                if (n.matches && n.matches(inputSelector)) relaxAccept(n);
                const list = n.querySelectorAll && n.querySelectorAll(inputSelector);
                if (list && list.length) list.forEach(relaxAccept);
            }
        }
    });
    mo.observe(document.documentElement, {childList: true, subtree: true});

})();
