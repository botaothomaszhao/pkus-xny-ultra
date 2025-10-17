// ==UserScript==
// @name         删除无用元素
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.1.1
// @license      GPL-3.0
// @description  自动删除 class 为 silder、tag、name 的元素
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        none
// @run-at       document-body
// ==/UserScript==

(function() {

    'use strict';

    // 删除指定 class 元素的函数

    function removeTargetElements() {

        const targetClasses = ['silder', 'tag', 'time'];

        let totalRemoved = 0;



        targetClasses.forEach(className => {

            const elements = document.querySelectorAll(`.${className}`);

            elements.forEach(element => {

                element.remove();

            });

            if (elements.length > 0) {

                console.log(`已删除 ${elements.length} 个 ${className} 元素`);

                totalRemoved += elements.length;

            }

        });



        if (totalRemoved > 0) {

            console.log(`总共删除了 ${totalRemoved} 个目标元素`);

        }

    }

    // 立即尝试删除（如果页面已经加载）

    removeTargetElements();

    // 当 DOM 内容加载完成时删除

    if (document.readyState === 'loading') {

        document.addEventListener('DOMContentLoaded', removeTargetElements);

    } else {

        removeTargetElements();

    }

    // 使用 MutationObserver 监听动态添加的元素

    const observer = new MutationObserver(function(mutations) {

        mutations.forEach(function(mutation) {

            mutation.addedNodes.forEach(function(node) {

                if (node.nodeType === 1) { // 元素节点

                    const targetClasses = ['silder', 'tag', 'time'];



                    // 检查新添加的节点本身

                    if (node.classList) {

                        targetClasses.forEach(className => {

                            if (node.classList.contains(className)) {

                                node.remove();

                                console.log(`删除了动态添加的 ${className} 元素`);

                            }

                        });

                    }



                    // 检查新添加节点的子元素

                    if (node.querySelectorAll) {

                        targetClasses.forEach(className => {

                            const childElements = node.querySelectorAll(`.${className}`);

                            childElements.forEach(element => {

                                element.remove();

                                console.log(`删除了动态添加的子 ${className} 元素`);

                            });

                        });

                    }

                }

            });

        });

    });

    // 开始观察

    observer.observe(document.body, {

        childList: true,

        subtree: true

    });

    // 页面加载完成后再次执行清理

    window.addEventListener('load', removeTargetElements);

})();
