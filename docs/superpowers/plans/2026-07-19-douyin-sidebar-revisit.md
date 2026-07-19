# Douyin Sidebar Revisit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Douyin-only sidebar revisit entry without affecting WeChat or Web builds.

**Architecture:** Keep native platform calls inside `assets/scripts/platform/DuiDuiSidebarService.ts`. `DuiDuiMahjongGame` renders a homepage entry only when the service reports support, and delegates click behavior back to the service.

**Tech Stack:** Cocos Creator TypeScript, Douyin Mini Game `tt` APIs, existing static regression script.

## Global Constraints

- Do not introduce rewards, gifts, coins, hint counts, daily claims, or inventory.
- Do not call `tt` sidebar APIs from WeChat or Web paths.
- Do not modify unrelated gameplay, ad timing, or banner behavior.
- Preserve existing untracked `.vs/` and `assets/wechat*` files.

---

### Task 1: Add Static Regression Coverage

**Files:**
- Modify: `scripts/check-duidui-regressions.js`

**Interfaces:**
- Consumes: source files as text.
- Produces: assertions that fail until sidebar service and homepage integration exist.

- [ ] **Step 1: Add failing assertions**

Add checks requiring `DuiDuiSidebarService.ts`, Douyin `checkScene`/`navigateToScene`/`onShow`, homepage support gating, click handling, and neutral copy.

- [ ] **Step 2: Verify RED**

Run: `node scripts/check-duidui-regressions.js`
Expected: FAIL because `DuiDuiSidebarService.ts` does not exist yet.

### Task 2: Add Douyin Sidebar Platform Service

**Files:**
- Create: `assets/scripts/platform/DuiDuiSidebarService.ts`

**Interfaces:**
- Produces:
  - `DuiDuiSidebarService.checkSidebarSupport(): Promise<boolean>`
  - `DuiDuiSidebarService.navigateToSidebar(): Promise<boolean>`
  - `DuiDuiSidebarService.isFromSidebar(): boolean`
  - `DuiDuiSidebarService.destroy(): void`

- [ ] **Step 1: Implement minimal service**

Detect Douyin by explicit platform value or `globalThis.tt`. Return false on non-Douyin platforms. Track launch/show options with `getLaunchOptionsSync` and `onShow`.

- [ ] **Step 2: Verify service assertions**

Run: `node scripts/check-duidui-regressions.js`
Expected: still FAIL because game controller integration is missing.

### Task 3: Render Homepage Entry and Handle Clicks

**Files:**
- Modify: `assets/scripts/DuiDuiMahjongGame.ts`

**Interfaces:**
- Consumes: `DuiDuiSidebarService`.
- Produces:
  - homepage support check after `showHome()`
  - neutral Douyin-only entry
  - click handler that navigates or reports sidebar return

- [ ] **Step 1: Wire service into lifecycle**

Create the service, call `destroy()` in `onDestroy()`, and check sidebar support from `showHome()`.

- [ ] **Step 2: Add homepage entry**

Render a button only after Douyin support returns true and the current screen is still home.

- [ ] **Step 3: Handle click**

If `isFromSidebar()` is true, show a neutral return toast. Otherwise call `navigateToSidebar()` and show a failure toast if navigation fails.

### Task 4: Changelog and Verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add changelog entry**

Document Douyin-only sidebar revisit support and neutral no-reward behavior.

- [ ] **Step 2: Verify GREEN**

Run: `node scripts/check-duidui-regressions.js`
Expected: PASS.

- [ ] **Step 3: Whitespace check**

Run: `git diff --check`
Expected: no output and exit code 0.
