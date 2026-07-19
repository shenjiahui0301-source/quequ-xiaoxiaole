# Changelog

## 2026-07-19

### Added
- 接入 Banner 广告，支持微信小游戏与抖音小游戏平台适配。
- 首页首次展示后常驻 Banner 广告，覆盖首页、游戏中、结算等后续游戏界面。
- Banner 广告根据平台窗口尺寸自动底部居中布局，并监听窗口变化重新定位。
- 增加 Banner 广告位配置字段，Web 环境保持空配置，不影响本地预览。
- 接入抖音小游戏侧边栏复访能力，首页在抖音支持侧边栏时显示“侧边栏回访”入口。
- 新增抖音侧边栏平台服务，封装 `checkScene`、`navigateToScene` 与 `onShow` 来源识别。

### Changed
- 首页展示流程在加载界面结束进入首页后触发 Banner 展示。
- 广告服务增加 Banner 创建失败保护，避免广告 SDK 异常影响游戏主流程。
- 侧边栏入口采用无奖励文案，不承诺福利、礼包或领取内容，微信与 Web 环境不显示入口。

### Verification
- `node scripts/check-duidui-regressions.js`
