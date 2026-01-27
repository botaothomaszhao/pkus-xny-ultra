// ==UserScript==
// @name         纯黑白模式
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      v3.2
// @license      GPL-3.0
// @description  将背景修改为纯黑色，实现极简的暗黑风格，并为侧边栏添加平滑切换动画。
// @author       c-jeremy ZhongChuTaFei
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;700&display=swap');
        /* ---- 全局与基础样式 ---- */
        body * { font-family: 'Noto Serif SC', serif !important; }
        body, body html { background-color: #fff !important; }
        /* ---- 按背景颜色分组 ---- */
        /* 白色背景 */
        body .app, body .folder, body .treeBox, body .wrap, body .ant-tree-node-selected,
        body .ant-tree-node-content-wrapper-open, body .ant-tree-treenode-selected {
            background-color: #ffffff !important;
        }
        /* 黑色背景 */
        body .slider, body .put, body .ant-tag-has-color, body .sideActive {
            background-color: #000000 !important;
        }
        /* 浅灰色背景 */
        body .score, body .tips, body .maxAvgScore {
            background-color: #eee !important;
            color: #000000 !important;
            font-size: 15px !important;
        }
        /* 中灰色背景 */
        body .swiper-box, body .swiper-container { background-color: #ddd !important; }
        /* ---- 按组件/功能分类 ---- */
        /* 按钮 */
        body .ant-btn-danger {
            background-color: #fff !important;
            color: #000 !important;
            border-color: #000000 !important;
            border-width: 1px !important;
            border-style: solid !important;
        }
        body .ant-btn-primary {
            background-color: #fff !important;
            border-color: #000000 !important;
            color: #000 !important;
        }
        /* 侧边栏与菜单 (带平滑移动动画) */
        body .menu {
            position: relative !important;
            background-color: #000000 !important;
            color: rgba(255, 255, 255, 0.7) !important;
        }
        body .menu div {
            position: relative;
            z-index: 1;
            transition: color 0.4s ease;
            border-radius: 8px !important;
        }
        body .menu div.active {
            background-color: transparent !important;
            color: #ffffff !important;
            font-weight: 500 !important;
        }
        .menu-active-indicator {
            position: absolute !important;
            z-index: 0;
            left: 4px !important;
            right: 4px !important;
            background-color: #333 !important;
            border-radius: 8px !important;
            transition: top 0.4s cubic-bezier(0.65, 0, 0.35, 1), height 0.4s cubic-bezier(0.65, 0, 0.35, 1) !important;
        }
        body .put { z-index: 190 !important; }
        /* 文件树 */
        body .treeBox {
            border-color: #000000 !important;
            border-width: 1px !important;
            border-style: solid !important;
        }
        body .ant-tree.ant-tree-directory .ant-tree-child-tree > li.ant-tree-treenode-selected > span.ant-tree-node-content-wrapper::before,
        body .ant-tree.ant-tree-directory > li.ant-tree-treenode-selected > span.ant-tree-node-content-wrapper::before {
            background-color: #eee !important;
            border-radius: 5px !important;
            font-weight: 500 !important;
        }
        body .wrap .nav .treeBox .folder .folderName[data-v-56a2485d]:hover {
            color: #fff !important;
            background-color: #eee !important;
        }
        /* 弹窗 */
        body .ant-modal-content {
            background-color: rgba(255, 255, 255, 0.6) !important;
            -webkit-backdrop-filter: blur(10px) !important;
            backdrop-filter: blur(10px) !important;
            border-radius: 12px !important;
        }
        body .ant-modal-header {
            background-color: rgba(255, 255, 255, 0.6) !important;
            backdrop-filter: blur(10px) !important;
            border-bottom: 1px solid #000;
            border-radius: 12px 12px 0 0;
        }
        /* 分数显示 */
        body .scoreRate {
            background-color: #eee !important;
            color: #000000 !important;
            font-size: 15px !important;
            margin-top: 1.5rem;
            border-left-width: 2px;
            border-left-style: solid;
            border-left-color: currentColor;
            padding-left: 1.5rem;
            border-radius: 0px !important;
            /* height: 70px !important; */
        }
        /* 其他独立元素 */
        body .donw { display: block !important; }
        body .ant-row-flex, body .tips1, body .name-box { color: #000 !important; }
        body .folderName { color: #000000 !important; }
        body .folderName.active {
            background-color: #eeeeee !important;
            color: #000000 !important;
        }
        body .ant-badge { color: #000000 !important; }
        body .title { background-color: transparent !important; }
    `);

    // --- 平滑移动动画逻辑 ---
    function setupSlidingIndicator(menu) {
        if (menu.querySelector('.menu-active-indicator')) return;
        const indicator = document.createElement('div');
        indicator.className = 'menu-active-indicator';
        menu.prepend(indicator);
        const updateIndicator = () => {
            const activeElement = menu.querySelector('div.active');
            if (activeElement) {
                indicator.style.top = `${activeElement.offsetTop}px`;
                indicator.style.height = `${activeElement.offsetHeight}px`;
                indicator.style.opacity = '1';
            } else {
                indicator.style.opacity = '0';
            }
        };
        setTimeout(updateIndicator, 150);
        const menuObserver = new MutationObserver(() => {
            updateIndicator();
        });
        menuObserver.observe(menu, {attributes: true, attributeFilter: ['class'], subtree: true});
        window.addEventListener('resize', updateIndicator);
    }

    const initialObserver = new MutationObserver((mutations, obs) => {
        const menu = document.querySelector('.menu');
        if (menu) {
            setupSlidingIndicator(menu);
            obs.disconnect();
        }
    });

    initialObserver.observe(document.body, {childList: true, subtree: true});
})();
