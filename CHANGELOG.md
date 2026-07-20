# Changelog

## 2026-07-20

### Changed
- 创建微信初版审核专用构建分支，屏蔽道具激励视频广告门槛。
- 提示、洗牌、撤回道具点击后直接使用，不再弹出观看广告确认弹窗。
- 移除道具按钮上的 AD 标记，避免审核包展示未接入广告位的激励视频入口。

### Verification
- `node scripts/check-duidui-regressions.js`
- `git diff --check`

## 2026-07-19

### Added
- 接入 Banner 广告，支持微信小游戏与抖音小游戏平台适配。
- 首页首次展示后常驻 Banner 广告，覆盖首页、游戏中、结算等后续游戏界面。
- Banner 广告根据平台窗口尺寸自动底部居中布局，并监听窗口变化重新定位。
- 增加 Banner 广告位配置字段，Web 环境保持空配置，不影响本地预览。

### Changed
- 首页展示流程在加载界面结束进入首页后触发 Banner 展示。
- 广告服务增加 Banner 创建失败保护，避免广告 SDK 异常影响游戏主流程。

### Verification
- `node scripts/check-duidui-regressions.js`
