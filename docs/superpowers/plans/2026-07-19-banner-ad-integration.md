# Persistent Banner Ad Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show one bottom-centered native Banner ad from the first home-screen entry onward on WeChat and Douyin mini games, without interrupting gameplay when ads are unavailable.

**Architecture:** Extend the existing `DuiDuiAdConfig` and `DuiDuiAdService` platform boundary rather than calling `wx` or `tt` from the game controller. `DuiDuiMahjongGame` triggers the idempotent Banner display from `showHome()` and releases it from `onDestroy()`; native resize callbacks keep the persistent ad bottom-centered.

**Tech Stack:** Cocos Creator 3.8.7, TypeScript, WeChat Mini Game `wx` API, Douyin Mini Game `tt` API, Node.js source-regression checks.

## Global Constraints

- The loading screen must never show the Banner.
- The first `showHome()` call creates and shows it; later home, gameplay, and result screens keep the same instance visible.
- Web preview must silently skip Banner display.
- Missing IDs, unsupported APIs, no-fill responses, and rejected `show()` promises must not interrupt the game.
- Banner positioning is `left = (windowWidth - width) / 2` and `top = windowHeight - height` using the native resize result.
- No Banner rotation, revenue optimization, layout refactor, or real advertising IDs are included.

## File Structure

- Modify `assets/scripts/platform/DuiDuiAdConfig.ts`: add one Banner advertising-unit ID per platform.
- Modify `assets/scripts/platform/DuiDuiAdService.ts`: define the cross-platform Banner surface and own its lifecycle.
- Modify `assets/scripts/DuiDuiMahjongGame.ts`: trigger the persistent Banner at first home entry and release it when the component is destroyed.
- Modify `scripts/check-duidui-regressions.js`: statically verify configuration, platform adaptation, positioning, and controller lifecycle behavior.

---

### Task 1: Banner Configuration and Platform Service

**Files:**
- Modify: `scripts/check-duidui-regressions.js`
- Modify: `assets/scripts/platform/DuiDuiAdConfig.ts`
- Modify: `assets/scripts/platform/DuiDuiAdService.ts`

**Interfaces:**
- Consumes: existing `DuiDuiAdPlatform`, `DUIDUI_AD_CONFIG`, `detectAdPlatform()`, and `resolveMiniGameApi()`.
- Produces: `DuiDuiPlatformAdConfig.bannerAdUnitId: string`, `DuiDuiAdService.showBanner(): Promise<boolean>`, and `DuiDuiAdService.destroyBanner(): void`.

- [ ] **Step 1: Add failing service-level regression assertions**

Append assertions that load `DuiDuiAdConfig.ts` and `DuiDuiAdService.ts`, then require:

```js
const adService = fs.readFileSync(adServicePath, 'utf8');
const adConfig = fs.readFileSync(adConfigPath, 'utf8');

assert(
  /bannerAdUnitId:\s*string/.test(adConfig) &&
    /REPLACE_WITH_WECHAT_BANNER_AD_UNIT_ID/.test(adConfig) &&
    /REPLACE_WITH_DOUYIN_BANNER_AD_UNIT_ID/.test(adConfig),
  'WeChat and Douyin ad configs should provide separate Banner ad unit IDs.',
);
assert(
  /createBannerAd/.test(adService) && /getSystemInfoSync/.test(adService),
  'The platform ad service should adapt native Banner creation and window sizing APIs.',
);
assert(
  /async showBanner\s*\(\s*\)\s*:\s*Promise<boolean>/.test(adService) &&
    /destroyBanner\s*\(\s*\)/.test(adService),
  'The ad service should expose Banner display and cleanup lifecycle methods.',
);
assert(
  /\(windowWidth\s*-\s*size\.width\)\s*\/\s*2/.test(adService) &&
    /windowHeight\s*-\s*size\.height/.test(adService),
  'Banner resize handling should keep the native ad bottom-centered.',
);
```

- [ ] **Step 2: Run the regression script and verify RED**

Run: `node scripts/check-duidui-regressions.js`

Expected: FAIL with `WeChat and Douyin ad configs should provide separate Banner ad unit IDs.`

- [ ] **Step 3: Add Banner IDs to platform configuration**

Extend the interface and all records:

```ts
export interface DuiDuiPlatformAdConfig {
    rewardedVideoAdUnitId: string;
    interstitialAdUnitId: string;
    bannerAdUnitId: string;
}
```

Use `REPLACE_WITH_WECHAT_BANNER_AD_UNIT_ID`, `REPLACE_WITH_DOUYIN_BANNER_AD_UNIT_ID`, and `''` for the respective platform records.

- [ ] **Step 4: Implement the minimal Banner platform surface**

Add Banner-specific types with mutable `style`, native resize/error registration, `show()`, and `destroy()`. Extend `MiniGameApi` with:

```ts
createBannerAd?: (options: {
    adUnitId: string;
    style: { left?: number; top?: number; width: number };
}) => MiniGameBannerAd;
getSystemInfoSync?: () => { windowWidth: number; windowHeight: number };
```

Add service fields for the instance and stable callbacks. Implement `showBanner()` so it validates configuration and API support, reads the window size, creates only one instance, registers callbacks once, and awaits `show()`. The resize callback must assign:

```ts
this.bannerAd.style.left = (windowWidth - size.width) / 2;
this.bannerAd.style.top = windowHeight - size.height;
```

Implement `destroyBanner()` so it unregisters the same callback references, calls `destroy()`, and clears the field. Extend global API declarations, platform detection, and platform resolution to include Banner methods.

- [ ] **Step 5: Run the regression script and verify GREEN**

Run: `node scripts/check-duidui-regressions.js`

Expected: PASS and the script's existing final success message.

- [ ] **Step 6: Commit the service task**

```bash
git add scripts/check-duidui-regressions.js assets/scripts/platform/DuiDuiAdConfig.ts assets/scripts/platform/DuiDuiAdService.ts
git commit -m "feat: add cross-platform banner ad service"
```

### Task 2: Game Lifecycle Integration

**Files:**
- Modify: `scripts/check-duidui-regressions.js`
- Modify: `assets/scripts/DuiDuiMahjongGame.ts`

**Interfaces:**
- Consumes: `DuiDuiAdService.showBanner(): Promise<boolean>` and `DuiDuiAdService.destroyBanner(): void` from Task 1.
- Produces: controller behavior that starts Banner display from `showHome()` only and releases it from Cocos `onDestroy()`.

- [ ] **Step 1: Add failing controller regression assertions**

Use the existing `methodBody()` helper and add:

```js
const showHomeForBanner = methodBody('showHome');
const showLoadingForBanner = methodBody('showLoading');
const startLevelForBanner = methodBody('startLevel');
const onDestroyForBanner = methodBody('onDestroy');

assert(
  /this\.adService\.showBanner\s*\(\s*\)/.test(showHomeForBanner) &&
    !/showBanner\s*\(/.test(showLoadingForBanner),
  'Banner display should begin only after loading reaches the home screen.',
);
assert(
  !/destroyBanner\s*\(/.test(startLevelForBanner) && !/hideBanner\s*\(/.test(source),
  'Banner should remain visible while switching into gameplay and result screens.',
);
assert(
  /this\.adService\.destroyBanner\s*\(\s*\)/.test(onDestroyForBanner),
  'Component teardown should release the native Banner instance.',
);
```

- [ ] **Step 2: Run the regression script and verify RED**

Run: `node scripts/check-duidui-regressions.js`

Expected: FAIL with `Banner display should begin only after loading reaches the home screen.`

- [ ] **Step 3: Add the minimal controller lifecycle calls**

At the end of `showHome()`, after the home UI has been built, trigger the non-blocking display and intentionally ignore the boolean result:

```ts
void this.adService.showBanner();
```

Add or extend the Cocos component teardown method:

```ts
onDestroy() {
    this.adService.destroyBanner();
}
```

Do not add Banner calls to `showLoading()`, `startLevel()`, result modals, or screen-transition methods.

- [ ] **Step 4: Run the regression script and verify GREEN**

Run: `node scripts/check-duidui-regressions.js`

Expected: PASS and the script's existing final success message.

- [ ] **Step 5: Run TypeScript compilation**

Run: `npx tsc --noEmit -p tsconfig.json`

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 6: Review the focused diff**

Run: `git diff --check` and `git diff -- assets/scripts/platform/DuiDuiAdConfig.ts assets/scripts/platform/DuiDuiAdService.ts assets/scripts/DuiDuiMahjongGame.ts scripts/check-duidui-regressions.js`

Expected: no whitespace errors; only Banner configuration, service lifecycle, controller hooks, and regression assertions are present.

- [ ] **Step 7: Commit the controller integration**

```bash
git add scripts/check-duidui-regressions.js assets/scripts/DuiDuiMahjongGame.ts
git commit -m "feat: show persistent banner after loading"
```

### Task 3: Final Verification

**Files:**
- Verify: `assets/scripts/platform/DuiDuiAdConfig.ts`
- Verify: `assets/scripts/platform/DuiDuiAdService.ts`
- Verify: `assets/scripts/DuiDuiMahjongGame.ts`
- Verify: `scripts/check-duidui-regressions.js`

**Interfaces:**
- Consumes: completed Task 1 and Task 2 behavior.
- Produces: fresh evidence that the feature is regression-safe and type-correct.

- [ ] **Step 1: Run all automated checks from a clean command invocation**

Run: `node scripts/check-duidui-regressions.js`

Expected: PASS.

Run: `npx tsc --noEmit -p tsconfig.json`

Expected: exit code 0.

- [ ] **Step 2: Confirm repository scope**

Run: `git status --short`

Expected: no Banner-related uncommitted files; pre-existing `.vs/` and `assets/wechat*` files may remain untracked and must not be staged.

- [ ] **Step 3: Record real-device follow-up**

Report that production verification still requires replacing both Banner placeholders and checking one WeChat and one Douyin real-device build, because native ads do not render in the Web preview fallback.
