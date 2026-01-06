// ==UserScript==
// @name         强制显示答案
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.1.0
// @license      GPL-3.0
// @description  强制显示题目上被隐藏的“答案”等按钮。
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
                        const keysToEnable = ["previewAnswer", "answerWayHandle", "answerWayPhoto", "answerWayTalking", "answerWayVideo", "answerWayKeyboard", "questionTalkingSwitch"];
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
            // 在 sandbox 中 console.error 不可见，但保留无害
            console.error('[Content Modifier] Error modifying data:', e);
            return data;
        }
    }

    function setupXHRInterceptor() {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url) {
            if (url && typeof url === 'string' && url.endsWith('/content')) {
                this._isContentTarget = true;
            }
            originalOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function () {
            // 处理题目目录请求
            if (this._isContentTarget) {
                const originalDescriptorText = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');
                const originalDescriptorResponse = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response');

                Object.defineProperty(this, 'responseText', {
                    get: function () {
                        const realResponseText = originalDescriptorText.get.call(this);
                        try {
                            const data = JSON.parse(realResponseText);
                            const modifiedData = modifyContentData(data);
                            return JSON.stringify(modifiedData);
                        } catch (e) {
                            return realResponseText;
                        }
                    },
                    configurable: true
                });

                Object.defineProperty(this, 'response', {
                    get: function () {
                        const realResponse = originalDescriptorResponse.get.call(this);
                        try {
                            const data = (typeof realResponse === 'string') ? JSON.parse(realResponse) : realResponse;
                            return modifyContentData(data);
                        } catch (e) {
                            return realResponse;
                        }
                    },
                    configurable: true
                });
            }

            // 最终总是调用原始的 send 方法
            originalSend.apply(this, arguments);
        };
    }

    setupXHRInterceptor();
})();
