// ==UserScript==
// @name         强制显示答案
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.1.2
// @license      GPL-3.0
// @description  强制显示题目上被隐藏的"答案"等按钮。
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/stu/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 修改题目数据以启用答案显示等功能
    function modifyContentData(data) {
        try {
            if (data && Array.isArray(data.extra)) {
                data.extra.forEach(item => {
                    if (item?.content) {
                        const content = item.content;
                        const keysToEnable = ["previewAnswer",
                            "answerWayHandle", "answerWayPhoto", "answerWayKeyboard"];
                        keysToEnable.forEach(key => {
                            if (typeof content[key] !== 'undefined') {
                                content[key] = 1;
                            }
                        });
                        if (typeof content.mustDoSwitch !== 'undefined') {
                            content.mustDoSwitch = 0;
                        }
                    }
                });
            }
            return data;
        } catch (e) {
            console.error('[Content Modifier] Error:', e);
            return data;
        }
    }

    // 修改页面数据以启用考试的答案显示
    function modifyEntityData(data) {
        try {
            if (data && Array.isArray(data.extra)) {
                data.extra.forEach(item => {
                    if (typeof item.openAnswer !== 'undefined' && item.paperFinishTag === 1) {
                        item.openAnswer = 1;
                    }
                });
            }
            return data;
        } catch (e) {
            return data;
        }
    }

    const OriginalXHR = window.XMLHttpRequest;
    const originalDescriptorText = Object.getOwnPropertyDescriptor(OriginalXHR.prototype, 'responseText');
    const originalDescriptorResponse = Object.getOwnPropertyDescriptor(OriginalXHR.prototype, 'response');
    
    function definePropertyForXHR(xhr, propertyName, realGetter, modifier) {
        Object.defineProperty(xhr, propertyName, {
            get: function () {
                const realValue = realGetter.get.call(this); // 获取原始值
                if (this.readyState !== 4) return realValue;
    
                try {
                    const data = (typeof realValue === 'string') ? JSON.parse(realValue) : realValue;
                    const modified = modifier(data);
                    return (propertyName === 'responseText') ? JSON.stringify(modified) : modified;
                } catch (e) {
                    return realValue; // 出错时返回原始值
                }
            },
            configurable: true
        });
    }
    
    window.XMLHttpRequest = function() {
        const xhr = new OriginalXHR();
        let targetModifier = null;

        const originalOpen = xhr.open;
        xhr.open = function(method, url) {
            // 判断目标 URL
            if (url && typeof url === 'string') {
                if (url.endsWith('/content')) {
                    targetModifier = modifyContentData;
                } else if (url.includes('/paper/entity/catalog/')) {
                    targetModifier = modifyEntityData;
                }

                if (targetModifier) {                   
                    definePropertyForXHR(xhr, 'responseText', originalDescriptorText, targetModifier);
                    definePropertyForXHR(xhr, 'response', originalDescriptorResponse, targetModifier);
                }
            }
            return originalOpen.apply(this, arguments);
        };

        return xhr;
    };

    window.XMLHttpRequest.prototype = OriginalXHR.prototype;
})();
