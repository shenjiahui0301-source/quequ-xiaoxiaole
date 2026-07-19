# 微信与抖音小游戏 Banner 广告接入设计

## 目标

在现有激励视频和插屏广告平台适配层中增加 Banner 广告能力。游戏加载界面结束、首次进入首页时展示 Banner，之后在首页、关卡和结果界面持续常驻。微信、抖音分别使用各自平台广告 API，Web 预览环境静默跳过。

## 范围

- 为微信、抖音和 Web 平台配置增加 `bannerAdUnitId`。
- 在 `DuiDuiAdService` 中封装 Banner 的创建、展示、定位与销毁。
- 首次进入首页时触发展示，后续界面切换不重复创建或隐藏。
- 游戏组件销毁时清理 Banner 实例与事件监听器。
- 广告未配置、API 不支持、无合适广告或展示失败时不阻断游戏。

不包含广告位申请、真实广告位 ID 的创建或填写，也不包含定时轮换 Banner、收益优化策略和游戏布局重构。

## 架构

继续沿用现有分层：`DuiDuiMahjongGame` 只负责在生命周期节点调用广告服务；`DuiDuiAdService` 负责统一平台行为；`DuiDuiAdConfig` 负责各平台广告位配置。

`DuiDuiMahjongGame.showHome()` 是加载流程进入首页以及后续返回首页的共同入口。它会调用幂等的 `showBanner()`：第一次调用创建并展示，后续调用复用同一实例。进入关卡、显示结果页时不调用 `hide()`，因此 Banner 持续常驻。

## 平台适配

平台 API 类型增加：

- `createBannerAd({ adUnitId, style })`
- `getSystemInfoSync()`
- Banner 的 `style`、`show()`、`onResize()`、`offResize()`、`onError()`、`offError()` 与 `destroy()`

微信使用 `wx`，抖音使用 `tt`。平台探测同时识别 `createBannerAd`，但继续优先使用 Cocos 的微信平台枚举。在 Web 或缺少 API 时，服务直接返回失败状态，不显示模拟广告。

## 尺寸与定位

创建时读取 `windowWidth` 和 `windowHeight`，以窗口可用宽度作为目标宽度。广告原生渲染尺寸可能与请求尺寸不同，因此监听 `onResize`，使用回调中的真实 `width` 和 `height` 将广告设置为：

- `left = (windowWidth - width) / 2`
- `top = windowHeight - height`

这样 Banner 在不同屏幕宽度和广告素材比例下都保持底部居中。只修改位置，不在回调中反复修改宽度，避免递归触发尺寸变化。

## 生命周期与错误处理

`showBanner()` 满足以下行为：

1. 广告位未配置或平台不支持时返回 `false`。
2. 已有实例时只再次调用 `show()`，不重复注册事件。
3. 首次调用时创建实例、绑定尺寸和错误监听、定位并展示。
4. `show()` 失败或广告加载错误时吞掉平台异常并返回 `false`，游戏照常运行。

新增 `destroyBanner()`，解绑服务注册的监听器并销毁实例。游戏组件的 `onDestroy()` 调用该方法，防止原生广告及回调在场景退出后残留。

## 配置

微信、抖音配置分别增加占位值：

- `REPLACE_WITH_WECHAT_BANNER_AD_UNIT_ID`
- `REPLACE_WITH_DOUYIN_BANNER_AD_UNIT_ID`

Web 配置为空字符串。正式构建前由开发者在对应平台流量主后台创建 Banner 广告位并替换占位值。

## 测试与验收

先扩展 `scripts/check-duidui-regressions.js`，并确认新断言在实现前失败。断言覆盖：

- 三个平台均包含 Banner 配置。
- 广告服务通过平台适配 API 创建 Banner。
- Banner 根据系统窗口与真实尺寸底部居中。
- `showHome()` 触发展示，加载界面不展示。
- 关卡切换不隐藏或销毁 Banner。
- 组件销毁时释放 Banner。

实现后重新运行回归脚本和 TypeScript 编译检查。验收标准是：配置真实广告位 ID 后，微信和抖音实机从首次进入首页开始显示底部 Banner，跨游戏界面持续存在；任何广告失败均不影响操作和界面切换。
