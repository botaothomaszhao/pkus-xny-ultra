// ==UserScript==
// @name         删除无用元素
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.1.2
// @license      GPL-3.0
// @description  自动删除指定的元素，包括头部“学科素养”、“考试用时”和未提交时的空图片框
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        none
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    // 只删除没有 pos-relative 的目标元素
    const selectors = [
        '.tag',
        '.time',
        '.result2:not(.pos-relative)'
    ];

    function removeTargetElements(root = document) {
        let totalRemoved = 0;
        // 如果 root 自身匹配某个选择器，先移除 root
        if (root !== document && root.matches) {
            for (const sel of selectors) {
                if (root.matches(sel)) {
                    root.remove();
                    totalRemoved++;
                    // 已移除 root，后续不需要对子孙再做同样的移除（root 被移除后其子孙也被移除）
                }
            }
        }
        // 移除 root 内的匹配元素（querySelectorAll 不包含 root 本身）
        for (const sel of selectors) {
            const elements = root.querySelectorAll(sel);
            elements.forEach(el => el.remove());
            totalRemoved += elements.length;
        }
        if (totalRemoved > 0 && root === document) {
            console.log(`总共删除了 ${totalRemoved} 个目标元素`);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => removeTargetElements());
    } else {
        removeTargetElements();
    }
    window.addEventListener('load', () => removeTargetElements());

    const observer = new MutationObserver(mutations => {
        mutations.forEach(m =>
            m.addedNodes.forEach(function (node) {
                if (node.nodeType === 1)
                    removeTargetElements(node)
            })
        )
    });
    observer.observe(document.body, {childList: true, subtree: true});
})();
