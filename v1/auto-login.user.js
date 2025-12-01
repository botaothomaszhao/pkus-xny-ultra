// ==UserScript==

// @name         自动点击登录按钮

// @namespace    http://tampermonkey.net/

// @version      0.1

// @description  在登录页面加载后自动点击登录按钮。

// @author       CJeremy

// @match        https://bdfz.xnykcxt.com:5002/*

// @grant        none

// @run-at       document-end

// ==/UserScript==

(function() {

    'use strict';

    // 确保在整个页面（包括所有资源如图片）完全加载后再执行脚本

    window.addEventListener('load', function() {

        // 查找带有 class "ant-btn-primary" 的按钮

        var loginButton = document.querySelector('.ant-btn-lg');
//alert(2);
        // 如果找到了按钮，则模拟点击

        if (loginButton && loginButton.innerText == "开始使用") {
            //alert(1);
            /*var txt = document.querySelector(".ant-input-lg[type='text']");
            var pwd = document.querySelector(".ant-input-lg[type='password']");
            txt.value="114514";
            pwd.value="meiyoumima";*/
            console.log('找到了登录按钮，正在尝试点击...');

            setTimeout(function() {

  loginButton.click();

}, 750);

        } else {

            console.log('未找到指定的登录按钮。');

        }

    });

})();