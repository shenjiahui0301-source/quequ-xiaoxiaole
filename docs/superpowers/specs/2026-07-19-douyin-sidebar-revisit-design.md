# Douyin Sidebar Revisit Design

## Goal

Add Douyin Mini Game sidebar revisit support without changing WeChat or Web behavior.

## Requirements

- Only Douyin builds may call `tt` sidebar APIs.
- WeChat and Web builds must not show the sidebar entry.
- The homepage shows a neutral sidebar entry only when Douyin reports sidebar support.
- The entry text must not promise rewards, gifts, coins, or claimable benefits.
- Returning from the sidebar is detected from Douyin launch/show options and surfaced as a short in-game toast.
- No persistent reward inventory, hint count, economy, or daily claim system is introduced.

## Architecture

Add a focused `DuiDuiSidebarService` platform adapter next to the existing ad adapter. It owns Douyin API detection, `tt.onShow` launch tracking, `tt.checkScene({ scene: 'sidebar' })`, `tt.navigateToScene({ scene: 'sidebar' })`, and source detection. `DuiDuiMahjongGame` asks the service whether to render a homepage entry and reacts to button taps with a toast or navigation request.

## UI

The homepage adds a small Douyin-only button near the existing settings/start controls. Copy uses "侧边栏回访" and "添加到侧边栏" style language, avoiding "福利", "礼包", and "领取".

## Error Handling

Unsupported platforms return false without throwing. Douyin API failures produce a toast and keep the game playable.

## Testing

Extend `scripts/check-duidui-regressions.js` with static checks for the new service, Douyin-only API usage, homepage rendering gate, and absence of reward wording.
