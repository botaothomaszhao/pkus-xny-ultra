// ==UserScript==
// @name         PDF操作栏
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.1.1
// @license      GPL-3.0
// @description  让预览PDF组件显示通常被隐藏的下载等操作栏按钮。后果自负。
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/stu/*
// @run-at       document-body
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const CSS = '[hidden]:not(#errorWrapper), button.hidden, div#editorModeButtons.hidden { display: block !important; }';

    function injectStyleInto(doc) {
        if (!doc) return false;
        try {
            const styleId = 'xny-pdf-button-fix';
            if (doc.getElementById(styleId)) return true;
            const style = doc.createElement('style');
            style.id = styleId;
            style.textContent = CSS;
            (doc.head || doc.documentElement).appendChild(style);
            return true;
        } catch (_) {
            return false;
        }
    }

    // 针对单个 iframe 的一次性处理：如果已经就绪则立即注入；并在 load 时再注入一次兜底。
    function processIframe(iframe) {
        if (!iframe || iframe.__pdfFixBound) return;
        iframe.__pdfFixBound = true;

        // 如果 iframe 可访问且已完成加载，则立即尝试注入。
        try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc?.readyState === 'complete') injectStyleInto(doc);
        } catch (_) {
            // 跨域/沙箱限制访问可能会抛异常；忽略并依赖 load 事件注入。
        }

        // 在 load 事件触发时注入（以覆盖后续加载完成的情况）。
        iframe.addEventListener('load', () => {
            try {
                injectStyleInto(iframe.contentDocument || iframe.contentWindow?.document);
            } catch (_) {
            }
        });
    }

    // 处理页面初次加载时就已经存在的 iframe。
    document.querySelectorAll('iframe').forEach(processIframe);

    // 监听 iframe 属性变化（src/sandbox），发生变化后重置标记并重新处理一次。
    const attrMo = new MutationObserver((muts) => {
        for (const mut of muts) {
            const el = mut.target;
            if (!el || el.tagName !== 'IFRAME') continue;
            el.__pdfFixBound = false;
            processIframe(el);
            try {
                const doc = el.contentDocument || el.contentWindow?.document;
                if (doc && doc.readyState === 'complete') {
                    injectStyleInto(doc);
                }
            } catch (_) {
            }
        }
    });

    document.querySelectorAll('iframe').forEach((f) => {
        attrMo.observe(f, {attributes: true, attributeFilter: ['src', 'sandbox']});
    });

    // 监听新增节点：处理新加入的 iframe，或包含 iframe 的片段，挂上属性监听（attrMo）。
    const domMo = new MutationObserver((muts) => {
        for (const mut of muts) {
            mut.addedNodes.forEach((node) => {
                if (node.nodeType !== 1) return;

                const el = node;
                const iframes = [];
                if (el.tagName === 'IFRAME') {
                    iframes.push(el);
                }
                // 新增节点后代中可能包含 iframe。
                el.querySelectorAll?.('iframe').forEach((f) => iframes.push(f));

                for (const f of iframes) {
                    processIframe(f);
                    attrMo.observe(f, {attributes: true, attributeFilter: ['src', 'sandbox']});
                }
            });
        }
    });

    domMo.observe(document.body, {childList: true, subtree: true});
})();
