// ==UserScript==

// @name         自动注入 course_userInfo 到 sessionStorage

// @namespace    http://tampermonkey.net/

// @version      1.0

// @description  如果 sessionStorage 中不存在 course_userInfo，则注入 {"id":0}，并每5分钟检查一次。

// @author       c-jeremy

// @match        *://bdfz.xnykcxt.com:5002/*

// @grant        none

// @run-at       document-end

// ==/UserScript==

(function() {

    'use strict';

    const itemKey = 'course_userInfo';

    const itemValue = '{"id":0}';

    const checkInterval = 5 * 60 * 1000; // 5分钟（以毫秒为单位）

    /**

     * 检查并注入数据的函数

     */

    function checkAndInject() {

        // 检查 sessionStorage 中是否存在指定的项

        if (sessionStorage.getItem(itemKey) === null) {

            console.log(`检测到 sessionStorage 中缺少 '${itemKey}'，正在注入...`);

            // 如果不存在，则设置该项

            sessionStorage.setItem(itemKey, itemValue);

            console.log(`'${itemKey}' 已成功注入，值为: ${itemValue}`);

        }

    }

    // 1. 页面加载后立即执行一次检查

    checkAndInject();

    // 2. 设置定时器，每隔5分钟重复执行检查

    setInterval(checkAndInject, checkInterval);

})();
