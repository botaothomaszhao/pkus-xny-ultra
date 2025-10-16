// ==UserScript==
// @name         强制刷新
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.1
// @license      GPL-3.0
// @description  提供强制服务器登出、彻底清除所有客户端数据并强制刷新的功能。
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      bdfz.xnykcxt.com
// ==/UserScript==

(function() {

    'use strict';

    // 1. 注入CSS样式，用于定义按钮和动画效果

    GM_addStyle(`

        #hard-refresh-container {

            position: fixed;

            bottom: 50px;

            right: 25px;

            z-index: 21474647;

            width: 48px;

            height: 48px;

        }

        #hard-refresh-btn {

            width: 100%;

            height: 100%;

            background-color: #ffffff;

            border: none;

            border-radius: 50%;

            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

            cursor: pointer;

            display: flex;

            align-items: center;

            justify-content: center;

            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);

        }

        #hard-refresh-btn:hover:not(:disabled) {

            transform: scale(1.1);

            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);

        }

        #hard-refresh-btn:active:not(:disabled) {

            transform: scale(0.95);

            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

        }

        #hard-refresh-btn .refresh-icon {

            width: 24px;

            height: 24px;

            color: #333333;

            transition: transform 0.3s ease;

            transform-origin: center;

        }

        #hard-refresh-btn .refresh-icon svg {

            width: 100%;

            height: 100%;

            fill: none;

            stroke: currentColor;

        }

        /* 加载状态：只让图标旋转，按钮保持原样 */

        #hard-refresh-container.loading #hard-refresh-btn {

            cursor: not-allowed;

        }

        #hard-refresh-container.loading .refresh-icon {

            animation: spin 1s linear infinite;

        }

        @keyframes spin {

            from {

                transform: rotate(0deg);

            }

            to {

                transform: rotate(360deg);

            }

        }

    `);

    // 2. 创建UI元素

    const container = document.createElement('div');

    container.id = 'hard-refresh-container';

    const button = document.createElement('button');

    button.id = 'hard-refresh-btn';

    button.title = 'Hard Refresh - 强制刷新并清除所有数据';

    // 刷新图标 (修复的SVG)

    const refreshIcon = document.createElement('div');

    refreshIcon.className = 'refresh-icon';

    refreshIcon.innerHTML = `

        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">

            <path d="M1 4v6h6"/>

            <path d="M23 20v-6h-6"/>

            <path d="m20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>

        </svg>

    `;

    button.appendChild(refreshIcon);

    container.appendChild(button);

    // 等待DOM加载完成后再添加按钮

    if (document.readyState === 'loading') {

        document.addEventListener('DOMContentLoaded', () => {

            document.body.appendChild(container);

        });

    } else {

        document.body.appendChild(container);

    }

    // 3. 定义核心清除函数

    async function nukeAndReload() {

        // 防止重复点击

        if (container.classList.contains('loading')) return;



        container.classList.add('loading');

        button.disabled = true;

        try {

            console.log('🚀 开始执行Hard Refresh...');

            // 阶段一: 主动请求服务器登出API

            console.log('📡 正在向服务器发送登出请求...');

            await new Promise((resolve) => {

                GM_xmlhttpRequest({

                    method: 'GET',

                    url: 'https://bdfz.xnykcxt.com:5002/exam/login/api/logout',

                    headers: {

                        'Accept': 'application/json, text/plain, */*',

                        'Cache-Control': 'no-cache'

                    },

                    timeout: 5000,

                    onload: (response) => {

                        console.log('✅ 服务器登出请求完成');

                        resolve(response);

                    },

                    onerror: (error) => {

                        console.warn('⚠️ 服务器登出请求失败，继续执行清理');

                        resolve(error);

                    },

                    ontimeout: () => {

                        console.warn('⏰ 服务器登出请求超时，继续执行清理');

                        resolve();

                    }

                });

            });

            // 阶段二: 注销Service Workers

            console.log('🔧 正在清理Service Workers...');

            if ('serviceWorker' in navigator) {

                const registrations = await navigator.serviceWorker.getRegistrations();

                await Promise.all(registrations.map(r => r.unregister()));

                console.log(`✅ 已清理 ${registrations.length} 个Service Workers`);

            }

            // 阶段三: 清空Cache Storage

            console.log('💾 正在清理Cache Storage...');

            if ('caches' in window) {

                const keys = await caches.keys();

                await Promise.all(keys.map(key => caches.delete(key)));

                console.log(`✅ 已清理 ${keys.length} 个缓存`);

            }

            // 阶段四: 删除IndexedDB



            // 阶段五: 清除 Local & Session Storage

            console.log('📦 正在清理Storage...');

            const localStorageSize = localStorage.length;

            const sessionStorageSize = sessionStorage.length;

            localStorage.clear();

            sessionStorage.clear();

            console.log(`✅ 已清理LocalStorage(${localStorageSize})和SessionStorage(${sessionStorageSize})`);

            // 阶段六: 清除 Cookies

            console.log('🍪 正在清理Cookies...');

            const cookies = document.cookie.split(";");

            let cookieCount = 0;

            for (const cookie of cookies) {

                const name = cookie.split("=")[0].trim();

                if (name) {

                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.xnykcxt.com`;

                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;

                    cookieCount++;

                }

            }

            console.log(`✅ 已清理 ${cookieCount} 个Cookies`);

            console.log('🎉 所有清理操作完成，准备刷新页面...');

        } catch (error) {

            console.error('❌ Hard Refresh过程中发生错误:', error);

        } finally {

            // 短暂延迟让用户看到完成状态

            setTimeout(() => {

                // 最后一步: 强制从服务器重新加载页面

                window.location.reload(true);

            }, 500);

        }

    }

    // 4. 绑定点击事件

    button.addEventListener('click', nukeAndReload);

    console.log('🎨 Hard Refresh按钮已加载完成');

})();
