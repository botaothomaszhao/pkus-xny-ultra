# PKUS XNY Ultra

---

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![GitHub last commit](https://img.shields.io/github/last-commit/c-jeremy/pkus-xny-ultra)](https://github.com/c-jeremy/pkus-xny-ultra/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/c-jeremy/pkus-xny-ultra)](https://github.com/c-jeremy/pkus-xny-ultra/issues)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-compatible-green)](https://www.tampermonkey.net/)
[![Greasemonkey](https://img.shields.io/badge/Greasemonkey-compatible-green)](https://www.greasespot.net/)

This document is also available in [简体中文(Chinese Simplified version)](https://github.com/c-jeremy/pkus-xny-ultra/blob/main/README-zh-CN.md).

> [!TIP]
> `v2.0`, which combined all functionalities, is published. Note that it is **NOT COMPATIBLE** with v1 scripts.

## Mechanism
This repository contains a collection of user scripts (Tampermonkey/Greasemonkey) that enhance and automate the PKUS XNY system (https://bdfz.xnykcxt.com:5002/stu/) for educational purposes.

Each script targets a specific pain point or use case, providing improvements in usability, automation, UI, and workflow reliability.

Our enhancement is implemented through [Tampermonkey](http://tampermonkey.net). This is a browser extension for managing and running user scripts. Once the configured site is being requested on the browser, Tampermonkey will automatically add the code directly to the correct place of the web page, for the browser to execute, to modify the original website or to automate it.

## What Did We Enhance?
- Added UI/UX improvements such as removing unused elements, custom fonts, and overlay dialogs to Gemini.
- Automated routine and error-prone actions (like login, navigation, and element cleanup).
- Provided one-tap solutions for refresh, navigation replay, and path favorites.
- Improved reliability of navigation and drawing functions, especially under dynamic DOM changes.
- Included an image Q&A feature using Gemini API by long-pressing images on mobile.

## File Correspondence and Functionality

| File Name | Description |
|-----------|-------------|
| `ask-gemini.user.js` | Long-press on images to query Google's Gemini model for image-related Q&A. Displays overlay UI, allows model selection, and uses your Gemini API key for inference. *You will need International Internet Connection to use this script*. |
| `auto-login.user.js` | Automatically finds and clicks the login button on the XNY system login page, streamlining the login process. |
| `del-unused.user.js` | Removes elements with specific classes (silder, tag, time) automatically from the DOM, both on load and dynamically, keeping the UI clean. |
| `fav-path.user.js` | Adds a 'favorites' system for navigation paths, including UI for saving, viewing, and deleting favorite locations. |
| `font-noto-serif.user.js` | Globally applies the Noto Serif Simplified Chinese font to all text elements, improving readability and aesthetics. |
| `force-download.user.js` | Display buttons such as downloads that are usually hidden when viewing PDF. |
| `handwriting-fix.user.js` | Fixes handwriting canvas scrolling/glitch issues by disabling unwanted scrolling on dynamically loaded canvases only, improving the drawing experience. |
| `hard-refresh.user.js` | Adds a floating button for a true 'hard refresh': logs user out, clears all web storage, service workers, and cookies, and reloads the page. *The reason for this is because that XNY system has the bug that newly published scores and self-review modals cannot be shown without re-logging in.* |
| `path-replay.user.js` | Records and replays the most recent navigation path, allowing one-tap restoration to the last location after login or refresh. |
|  `ui.user.js`  | Updates the UI/UX into a shadcn/ui inspired one. |
| `LICENSE` | GNU General Public License v3.0 – see License section below. |

## How to Install
1. Install [Tampermonkey](https://www.tampermonkey.net/) (or a similar UserScript manager) in your browser.
2. Download the desired `.user.js` files from this repo.
3. Open each file in your browser or Tampermonkey to install the script.
4. For ask-gemini.user.js, set your Gemini API key in the script source as instructed in the comments. You will also need an International Internet Connection.

## No Warranty & License
This software is provided "as is", without warranty of any kind. See the [LICENSE](LICENSE) file (GPL v3.0) for details. Use at your own risk.

The software is developed, tested, and distributed beforehand for Insiders users on **Tampermonkey on Microsoft Edge** on Android devices. The software is theoretically able to run on any modern browsers as long as similar user scripts management extensions are installed. However, we do not guarantee its liability, and please make sure you know what you are doing if you are using the software on other platforms.
