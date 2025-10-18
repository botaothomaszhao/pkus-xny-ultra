// ==UserScript==
// @name         新能源课程系统 - 黑白UI（仅样式）
// @namespace    http://tampermonkey.net/
// @version      2.0-ui
// @license      MIT
// @description  仅应用黑白配色与字体，不包含任何功能性改动（按钮、菜单、设置等）。
// @author       c-jeremy
// @match        *://bdfz.xnykcxt.com:5002/stu/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  GM_addStyle(`
    /* ========== 全局 / 纯黑背景样式（来自 v2/main.js） ========== */
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;700&display=swap');

    /* ---- 全局与基础样式 ---- */
    body * {
      font-family: 'Noto Serif SC', serif !important;
    }
    body, body html {
      background-color: #fff !important;
    }

    /* ---- 按背景颜色分组 ---- */
    /* 白色背景 */
    body .app,
    body .folder,
    body .treeBox,
    body .wrap,
    body .ant-tree-node-selected,
    body .ant-tree-node-content-wrapper-open,
    body .ant-tree-treenode-selected {
      background-color: #ffffff !important;
    }
    body .tag, body .time {
      display: none !important;
    }

    /* 黑色背景 */
    body .slider,
    body .put,
    body .ant-tag-has-color,
    body .sideActive {
      background-color: #000000 !important;
    }

    /* 浅灰色背景 */
    body .score,
    body .tips,
    body .maxAvgScore {
      background-color: #eee !important;
      color: #000000 !important;
      font-size: 15px !important;
    }

    /* 中灰色背景 */
    body .swiper-box,
    body .swiper-container {
      background-color: #ddd !important;
    }

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
      transition:
        top 0.4s cubic-bezier(0.65, 0, 0.35, 1),
        height 0.4s cubic-bezier(0.65, 0, 0.35, 1) !important;
    }

    body .put {
      z-index: 190 !important;
    }

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
    }

    /* 其他独立元素 */
    body .ant-row-flex, body .tips1, body .name-box { color: #000 !important; }
    body .folderName { color: #000000 !important; }
    body .folderName.active {
      background-color: #eeeeee !important;
      color: #000000 !important;
    }
    body .ant-badge { color: #000000 !important; }
    body .title { background-color: transparent !important; }
  `);
})();