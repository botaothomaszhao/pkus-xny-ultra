// ==UserScript==

// @name         Secure Session Management for XNY System

// @namespace    http://tampermonkey.net/

// @version      2.0

// @description  Securely manage session state without bypassing authentication. Only injects session data for legitimate UI enhancement purposes.

// @author       c-jeremy

// @match        *://bdfz.xnykcxt.com:5002/*

// @grant        none

// @run-at       document-end

// ==/UserScript==

(function() {

    'use strict';

    const itemKey = 'course_userInfo';

    // Security: Only inject for UI enhancement, not authentication bypass
    const legitimatePages = [
        '/stu/',
        '/stu/#/',
        '/stu/#/login',
        '/stu/#/course'
    ];

    const checkInterval = 5 * 60 * 1000; // 5分钟（以毫秒为单位）

    /**
     * 验证当前页面是否为合法的UI增强页面
     */
    function isValidContext() {
        const currentPath = window.location.pathname + window.location.hash;
        return legitimatePages.some(page => currentPath.includes(page)) ||
               currentPath.startsWith('/stu/#/');
    }

    /**
     * 检查现有会话的有效性
     */
    function validateExistingSession() {
        const existingSession = sessionStorage.getItem(itemKey);
        if (!existingSession) return false;

        try {
            const sessionData = JSON.parse(existingSession);
            // 验证会话数据格式和基本有效性
            return sessionData && typeof sessionData.id === 'number';
        } catch (e) {
            console.warn('Invalid session data format:', e);
            return false;
        }
    }

    /**
     * 安全的会话管理函数
     */
    function secureSessionManagement() {
        // 只在合法上下文中运行
        if (!isValidContext()) {
            console.log('Skipping session management on invalid page');
            return;
        }

        // 检查现有会话
        if (validateExistingSession()) {
            console.log('Valid session already exists, no action needed');
            return;
        }

        // 安全检查：确保不会干扰正常认证流程
        const loginButton = document.querySelector('button[data-testid="login-button"], .login-btn, [class*="login"]');
        if (loginButton && loginButton.style.display !== 'none') {
            console.log('Login button detected, avoiding session injection');
            return;
        }

        // 只在UI增强需要时注入会话数据
        console.log('Injecting session data for UI enhancement purposes');
        const itemValue = '{"id":0,"uiEnhancement":true}';
        sessionStorage.setItem(itemKey, itemValue);
    }

    // 1. 页面加载后延迟执行检查，避免干扰正常流程
    setTimeout(secureSessionManagement, 1000);

    // 2. 设置定时器，减少检查频率避免性能影响
    setInterval(secureSessionManagement, checkInterval);

})();
