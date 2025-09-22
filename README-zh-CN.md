# PKUS XNY Ultra (北大附中新能源课程系统增强脚本)

---

[![许可证: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![GitHub last commit](https://img.shields.io/github/last-commit/c-jeremy/pkus-xny-ultra)](https://github.com/c-jeremy/pkus-xny-ultra/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/c-jeremy/pkus-xny-ultra)](https://github.com/c-jeremy/pkus-xny-ultra/issues)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-compatible-green)](https://www.tampermonkey.net/)
[![Greasemonkey](https://img.shields.io/badge/Greasemonkey-compatible-green)](https://www.greasespot.net/)

## 工作原理
本仓库包含一系列用户脚本（适用于 Tampermonkey/Greasemonkey），用于增强和自动化北大附中新能源课程系统 (北大附中高三备考系统，https://bdfz.xnykcxt.com:5002/stu/)，以服务于教育目的。

每个脚本都针对一个特定的痛点或使用场景，在可用性、自动化、用户界面和工作流程可靠性方面提供了改进。

我们的增强功能是通过 [Tampermonkey](http://tampermonkey.net) (油猴) 实现的。这是一款用于管理和运行用户脚本的浏览器扩展。当您在浏览器中访问已配置的网站时，Tampermonkey 会自动将代码注入到网页的正确位置并由浏览器执行，从而修改原始网站或实现自动化操作。

## 我们增强了什么？
- **优化了 UI/UX**：例如移除了未使用的元素、应用自定义字体，以及添加悬浮对话框和按钮等。
- **自动化操作**：自动化了例行且容易出错，或者需要重复劳动的操作（如登录、导航和元素清理）。
- **一键式解决方案**：为刷新、导航路径重放和路径收藏提供了“一键直达”的解决方案。
- **提升可靠性**：改进了导航和绘图功能的可靠性，特别是在动态 DOM 变化以及与手势冲突的复杂情况下。
- **集成 AI 功能**：在移动设备上通过长按图片，即可使用 Gemini API 进行图片问答。

## 文件对应功能说明

| 文件名 | 描述 |
|-----------|-------------|
| `ask-gemini.user.js` | 在图片上长按以调用 Google 的 Gemini 模型进行图片相关的问答。脚本会显示一个悬浮 UI，允许选择模型，并使用您自己的 Gemini API 密钥进行推理。*请注意：使用此脚本需要能够访问国际互联网的环境。* |
| `auto-login.user.js` | 在 XNY 系统的登录页面上自动查找并点击登录按钮，简化登录流程。 |
| `del-unused.user.js` | 自动从 DOM 中移除具有特定类名（silder, tag, time）的元素，无论是在页面加载时还是动态生成时，都能保持界面整洁。 |
| `fav-path.user.js` | 为导航路径添加了一个“收藏夹”系统，包括用于保存、查看和删除收藏位置的用户界面。 |
| `font-noto-serif.user.js` | 全局应用“思源宋体 (Noto Serif Simplified Chinese)”字体到所有文本元素，提升可读性和美观度。 |
| `handwriting-fix.user.js` | 通过仅在动态加载的画布上禁用不必要的滚动，修复了手写板画布的滚动/抖动问题，改善了绘图体验。 |
| `hard-refresh.user.js` | 添加一个悬浮按钮，用于执行真正的“硬刷新”：登出用户，清除所有网站存储、服务工作线程和 Cookie，然后重新加载页面。*因为新能源系统存在一个 Bug，即新发布的分数和自阅弹窗不重新登录就无法显示。* |
| `path-replay.user.js` | 记录并重放最近一次的导航路径，允许在登录或刷新后一键恢复到最后访问的位置。 |
| `LICENSE` | GNU 通用公共许可证 v3.0 – 详见下文的许可证部分。 |

## 如何安装
以下是详细的安装步骤：

1.  **安装“油猴”扩展程序**
    *   首先，您需要在您的浏览器上安装一个用户脚本管理器。[Tampermonkey (油猴)](https://www.tampermonkey.net/) 是最受欢迎的选择，几乎支持所有现代浏览器（如 Chrome, Edge, Firefox, Safari）。
    *   请访问 [Tampermonkey 官网](https://www.tampermonkey.net/)，根据您的浏览器类型选择并安装对应的扩展程序。您也可以直接在浏览器的扩展商店中搜索 "Tampermonkey" 进行安装。

2.  **获取并安装脚本**
    *   访问本项目的 GitHub 仓库页面。
    *   Star本repo。
    *   找到您想要安装的脚本文件（以 `.user.js` 结尾）。
    *   点击文件名进入文件内容页面。
    *   在文件内容页面的右上角，找到并点击 **`Raw`** 按钮。
    *   点击 `Raw` 按钮后，Tampermonkey 扩展会自动检测到这是一个用户脚本，并弹出一个新的安装页面。
    *   在这个新页面上，您会看到脚本的源代码和信息。点击 **`安装`** 按钮即可完成安装。
    *   对您需要安装的每一个 `.user.js` 文件重复以上步骤。

3.  **配置特定脚本（如需）**
    *   对于 `ask-gemini.user.js` 脚本，您需要进行额外配置才能使用。
    *   在浏览器右上角点击 Tampermonkey 扩展图标，然后选择 **`管理面板`**。
    *   在已安装脚本列表中找到 `ask-gemini.user.js`，点击其右侧的 **`编辑`** 图标（一支笔的形状）。
    *   在打开的代码编辑器中，找到如下一行（通常在文件顶部）：
        ```javascript
        const GEMINI_API_KEY = "YOUR_API_KEY_HERE";
        ```
    *   将 `"YOUR_API_KEY_HERE"` 替换为您自己的 Gemini API 密钥（请确保密钥被英文双引号包裹）。
    *   修改完成后，按 `Ctrl + S` 或点击编辑器菜单中的“文件”->“保存”来保存您的更改。
    *   请再次确认，使用此脚本需要您能够访问国际互联网。

## 无保证与许可协议
本软件按“原样”提供，不附带任何形式的保证。有关详细信息，请参阅 [LICENSE](LICENSE) 文件 (GPL v3.0)。使用风险自负。

本软件主要在 **安卓设备上的 Microsoft Edge 浏览器的 Tampermonkey 环境** 中为内部测试用户开发、测试和分发。理论上，只要安装了类似的用户脚本管理扩展，本软件就能在任何现代浏览器上运行。但是，我们不保证其在其他平台上的可靠性，请确保您在使用本软件时了解您正在进行的操作。
