# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PKUS XNY Ultra is a collection of user scripts (Tampermonkey/Greasemonkey) that enhance and automate the PKUS XNY educational system (https://bdfz.xnykcxt.com:5002/stu/). The project provides UI/UX improvements, automation features, and workflow enhancements for students using this educational platform.

## Architecture

### Script Structure
The project has two main versions:

**v1 Scripts (Individual Modules)**
- Individual `.user.js` files in the root directory, each targeting specific functionality
- Each script is self-contained with its own Tampermonkey header and implementation
- Can be installed individually based on user needs

**v2 Scripts (Combined Module)**
- Located in `/v2/` directory
- `main.js`: Combined script with all functionality integrated
- `features.user.js` and `ui-only.user.js`: Modular components
- **NOT COMPATIBLE** with v1 scripts - users must choose one version

### Key Components

**Core Functionality Modules:**
- **Authentication**: `auto-login.user.js` - Automates login button clicks
- **Navigation**: `fav-path.user.js`, `path-replay.user.js` - Path bookmarks and restoration
- **UI Enhancement**: `ui.user.js`, `del-unused.user.js`, `font-noto-serif.user.js` - Visual improvements
- **Content Access**: `force-download.user.js`, `force-show-PDF-buttons.user.js` - PDF download features
- **Canvas/Drawing**: `handwriting-fix.user.js` - Fixes canvas scrolling issues
- **System Integration**: `seamless-login.user.js` - Maintains session state
- **AI Features**: `ask-gemini.user.js` - Image Q&A using Gemini API
- **System Refresh**: `hard-refresh.user.js` - Complete system reset functionality

**Settings Management:**
- Centralized settings system in v2 using `GM_getValue`/`GM_setValue`
- Configuration keys: `autoLogin`, `enableHandwritingFix`, `forceShowPDFButtons`, `enableSmartHints`, `enableMockEnhance`, `enableAnswerForce`, `autoExpandAnswerArea`
- Settings page accessible via `#/settings/plugin`

**Data Storage:**
- Favorites: `bdfz_path_favorites_v2`
- Path persistence: `bdfz_persistent_path_v3`
- Settings: `bdfz_enhancer_settings_v3`
- Greetings state: `bdfz_enhancer_greetings_done_v1`

## Development Environment

### Target Platform
- **Primary Target**: Tampermonkey on Microsoft Edge for Android
- **Compatibility**: Modern browsers with user script manager support
- **Testing Environment**: Insiders users on Tampermonkey/Microsoft Edge/Android

### No Build Process
This project uses plain JavaScript user scripts with no compilation or build steps:
- Scripts are installed directly into Tampermonkey/Greasemonkey
- No package.json, npm, or build tools required
- Development involves editing `.user.js` files directly

### Dependencies
**External Libraries:**
- Pinyin Match: `https://unpkg.com/pinyin-match@1.2.8/dist/main.js` (for Chinese search)
- Google Fonts: Noto Serif SC family
- **API Integration**: Google Gemini API (requires international internet connection)

**Browser APIs:**
- Tampermonkey APIs: `GM_addStyle`, `GM_xmlhttpRequest`, `GM_setValue`, `GM_getValue`, `GM_notification`
- Standard Web APIs: XMLHttpRequest, MutationObserver, sessionStorage

## Installation and Testing

### Installation Steps
1. Install Tampermonkey extension in browser
2. Download `.user.js` files
3. Open in browser or Tampermonkey to install
4. For `ask-gemini.user.js`: Set Gemini API key in script source

### Testing Approach
- Test on target system: `https://bdfz.xnykcxt.com:5002/stu/`
- Verify individual script functionality before integration
- Test mobile touch interactions for handwriting fixes
- Verify PDF button visibility in different contexts

## Key Implementation Details

### Navigation Path System
Scripts use a selector-based path recording system:
```javascript
// Example path structure
[
  { selector: "div.menu > div", text: "课程" },
  { selector: "div.folderName", text: "数学" },
  { selector: "span.ant-tree-node-content-wrapper", text: "第一章" }
]
```

### XHR Interception
The v2 script intercepts specific API endpoints:
- `/enchance`: Mock enhancement requests (note: API has spelling error)
- `/content`: Modify content data to force answer visibility
- `/catalog/entity`: Process directory data for search functionality

### UI Components
- **Pill Menu**: Floating action button with expand/collapse animations
- **Drawers**: Bottom sheet modals for favorites and search
- **Settings Page**: Full-page settings interface with toggle switches

## Important Notes

### API Spelling
The target system uses `/enchance` (not `/enhance`) - maintain this spelling exactly.

### Session Management
The `seamless-login.user.js` script maintains `course_userInfo` in sessionStorage to prevent login requirements for score display and self-review features.

### Compatibility Warning
- v1 and v2 scripts are incompatible
- v2 is a complete rewrite with centralized settings
- Users must choose one version exclusively

### License
GPL v3.0 - all derivatives must be open source under the same license.