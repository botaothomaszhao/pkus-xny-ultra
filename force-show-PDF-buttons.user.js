// ==UserScript==
// @name         force-show-PDF-buttons
// @namespace    https://github.com/botaothomaszhao
// @version      1.2.0
// @license      MIT
// @author       botaothomaszhao
// @description  Force show hidden PDF toolbar buttons (download/print, etc.) inside embedded PDF iframes. Lightweight, no polling retries; works on Via and Edge.
// @match        *://bdfz.xnykcxt.com:5002/stu/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const CSS =
    '[hidden]:not(#errorWrapper), button.hidden, div#editorModeButtons.hidden { display: block !important; }';

  function injectStyleInto(doc) {
    if (!doc) return false;
    try {
      const styleId = 'tampermonkey-pdf-button-fix';
      if (doc.getElementById(styleId)) return true; // avoid duplicates
      const style = doc.createElement('style');
      style.id = styleId;
      style.textContent = CSS;
      (doc.head || doc.documentElement).appendChild(style);
      return true;
    } catch (_) {
      return false;
    }
  }

  // Single-shot handling for an iframe: inject once if ready, and on load.
  function processIframe(iframe) {
    if (!iframe || iframe.__pdfFixBound) return;
    iframe.__pdfFixBound = true;

    // Immediate attempt if iframe is already accessible and ready.
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc && doc.readyState === 'complete') {
        injectStyleInto(doc);
      }
    } catch (_) {
      // Cross-origin/sandbox access may throw; ignore and rely on load event.
    }

    // Inject on load.
    iframe.addEventListener(
      'load',
      () => {
        try {
          injectStyleInto(iframe.contentDocument || iframe.contentWindow?.document);
        } catch (_) {}
      },
      { once: false }
    );
  }

  function watchIframes() {
    // Handle iframes present at load.
    document.querySelectorAll('iframe').forEach(processIframe);

    // Watch for newly added iframes or fragments containing iframes.
    const addMo = new MutationObserver((muts) => {
      for (const mut of muts) {
        mut.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.tagName === 'IFRAME') {
            processIframe(node);
          }
          node.querySelectorAll?.('iframe').forEach(processIframe);
        });
      }
    });
    addMo.observe(document.documentElement, { childList: true, subtree: true });

    // Watch iframe attribute changes (src/sandbox) and re-process once.
    const attrMo = new MutationObserver((muts) => {
      for (const mut of muts) {
        const el = mut.target;
        if (!el || el.tagName !== 'IFRAME') continue;
        el.__pdfFixBound = false;
        processIframe(el);
        try {
          const doc = el.contentDocument || el.contentWindow?.document;
          if (doc && doc.readyState === 'complete') {
            injectStyleInto(doc);
          }
        } catch (_) {}
      }
    });

    function observeAttrsForIframes(root = document) {
      root.querySelectorAll('iframe').forEach((f) => {
        attrMo.observe(f, { attributes: true, attributeFilter: ['src', 'sandbox'] });
      });
    }
    observeAttrsForIframes(document);

    const hookMo = new MutationObserver((muts) => {
      for (const mut of muts) {
        mut.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.tagName === 'IFRAME') {
            attrMo.observe(node, { attributes: true, attributeFilter: ['src', 'sandbox'] });
          }
          observeAttrsForIframes(node);
        });
      }
    });
    hookMo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchIframes, { once: true });
  } else {
    watchIframes();
  }
})();
