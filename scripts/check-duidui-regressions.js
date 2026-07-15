const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'assets', 'scripts', 'DuiDuiMahjongGame.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const modelPath = path.join(__dirname, '..', 'assets', 'scripts', 'model', 'DuiDuiMahjongModel.ts');
const themePath = path.join(__dirname, '..', 'assets', 'scripts', 'view', 'DuiDuiMahjongTheme.ts');
const adServicePath = path.join(__dirname, '..', 'assets', 'scripts', 'platform', 'DuiDuiAdService.ts');
const adConfigPath = path.join(__dirname, '..', 'assets', 'scripts', 'platform', 'DuiDuiAdConfig.ts');
const artDir = path.join(__dirname, '..', 'assets', 'resources', 'duidui');

function methodBody(name) {
  const markers = [`    private ${name}(`, `    ${name}(`];
  const start = markers.reduce((found, marker) => (found >= 0 ? found : source.indexOf(marker)), -1);
  if (start === -1) {
    throw new Error(`Missing method: ${name}`);
  }

  let depth = 0;
  let opened = false;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') {
      depth++;
      opened = true;
    } else if (source[i] === '}') {
      depth--;
      if (opened && depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  throw new Error(`Could not parse method body: ${name}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const touchStart = methodBody('onTileTouchStart');
const touchEnd = methodBody('onTileTouchEnd');
const onLoad = methodBody('onLoad');
assert(
  /ResolutionPolicy\.SHOW_ALL/.test(onLoad),
  'The game must use SHOW_ALL so narrow portrait screens do not crop the 720-wide UI.',
);
assert(
  !/ResolutionPolicy\.FIXED_HEIGHT/.test(onLoad),
  'FIXED_HEIGHT crops the game horizontally on tall/narrow phones.',
);

assert(
  !/restoreSnapshot\s*\(/.test(touchEnd),
  'Failed drag moves must not restore the whole board snapshot, because that destroys/recreates tiles.',
);
assert(
  /rollbackSlide\s*\(/.test(touchEnd),
  'Failed drag moves should use rollbackSlide() to keep the same tile objects and values.',
);

assert(
  fs.existsSync(modelPath) && fs.existsSync(themePath),
  'The project should be split into MVC-style model and view/theme modules.',
);
assert(
  fs.existsSync(adServicePath) && fs.existsSync(adConfigPath),
  'Commercial builds should isolate WeChat/Douyin ad integration in platform adapter modules.',
);
assert(
  /DuiDuiMahjongModel/.test(source) && /DuiDuiMahjongTheme/.test(source),
  'DuiDuiMahjongGame should act as the controller by importing the model and theme/view layer.',
);
assert(
  /DuiDuiAdService/.test(source),
  'DuiDuiMahjongGame should call the ad service instead of embedding platform ad APIs directly.',
);

const ensureDirectPair = methodBody('ensureDirectPair');
assert(
  !/\.type\s*=/.test(ensureDirectPair),
  'ensureDirectPair() must never change a tile type; it may only reposition existing tiles.',
);

const drawBackground = methodBody('drawBackground');
const theme = fs.readFileSync(themePath, 'utf8');
assert(
  /background:\s*'duidui\/background_clean'/.test(theme),
  'The LibTV background must use the clean no-board resource so it does not conflict with level row/column counts.',
);
assert(
  !/tileBase|tileHighlight|burstFx/.test(theme),
  'Unused generated tile/effect art should be removed from theme references.',
);
assert(
  !/for\s*\([^)]*\)[\s\S]*moveTo\s*\(/.test(drawBackground) && !/lineTo\s*\(/.test(drawBackground),
  'drawBackground() must not draw a baked board/grid; the board should be generated dynamically from each level.',
);
assert(
  !/roundRect\(-360,\s*370,\s*720,\s*270/.test(drawBackground) &&
    !/roundRect\(-360,\s*-640,\s*720,\s*245/.test(drawBackground) &&
    !/color\(92,\s*207,\s*190/.test(drawBackground),
  'drawBackground() should not paint old hard top/bottom color bands behind the clean LibTV background.',
);

const removePair = methodBody('removePair');
assert(
  !/shuffleBoard\s*\(/.test(removePair),
  'removePair() must not auto-shuffle when no direct pair remains; it should prompt the player to use a prop.',
);
assert(
  /道具/.test(removePair),
  'removePair() should explicitly prompt the player to use a prop when no clear elimination is available.',
);

assert(
  /animateRemovePair\s*\(/.test(removePair),
  'removePair() should drive a paired elimination animation instead of instantly destroying tiles.',
);
assert(
  !/first\.node\.destroy\s*\(\)\s*;\s*second\.node\.destroy\s*\(\)/.test(removePair),
  'removePair() must not destroy both tile nodes immediately; the visual removal should finish after tween feedback.',
);

const animateRemovePair = methodBody('animateRemovePair');
assert(
  !/createMatchLine\s*\(/.test(animateRemovePair),
  'animateRemovePair() should not draw a connector line; the elimination should feel like a pop/burst.',
);
assert(
  /playBurstRing\s*\(/.test(animateRemovePair) && /playFloatingScore\s*\(/.test(animateRemovePair),
  'animateRemovePair() should show a burst ring and a floating score/text cue.',
);
assert(
  /playPopFlash\s*\(/.test(animateRemovePair) && /playBoardPulse\s*\(/.test(animateRemovePair),
  'animateRemovePair() should add impact flash and board pulse feedback for stronger hand feel.',
);

const popTile = methodBody('popTile');
assert(
  /UIOpacity/.test(popTile) && /tween\s*\(/.test(popTile) && /\.call\s*\(\s*\(\)\s*=>[\s\S]*destroy\s*\(/.test(popTile),
  'popTile() should fade/scale the tiles with tween feedback before destroying their nodes.',
);

const playBurstRing = methodBody('playBurstRing');
assert(
  /circle\s*\(/.test(playBurstRing) && /UIOpacity/.test(playBurstRing) && /tween\s*\(/.test(playBurstRing),
  'playBurstRing() should draw a fading radial burst instead of a connector line.',
);

const playPopFlash = methodBody('playPopFlash');
const playBoardPulse = methodBody('playBoardPulse');
assert(
  /circle\s*\(/.test(playPopFlash) && /UIOpacity/.test(playPopFlash) && /tween\s*\(/.test(playPopFlash),
  'playPopFlash() should create a visible local hit flash.',
);
assert(
  /boardPanel/.test(playBoardPulse) && /tween\s*\(/.test(playBoardPulse) && /1\.015/.test(playBoardPulse),
  'playBoardPulse() should add a subtle board impact pulse.',
);

const showHint = methodBody('showHint');
assert(
  !/shuffleBoard\s*\(/.test(showHint),
  'showHint() must not auto-shuffle deadlocked boards; shuffling should only happen after the player uses a prop.',
);
assert(
  /道具/.test(showHint),
  'showHint() should tell the player to use a prop when no hint can produce an elimination.',
);
assert(
  /createMoveHint\s*\(\s*move\.tile\s*,\s*move\.dir\s*\)/.test(showHint),
  'Move hints should show the exact slide direction, not only highlight a tile.',
);

const createArrow = methodBody('createArrow');
assert(
  !/moveTo\s*\(/.test(createArrow) && !/lineTo\s*\(/.test(createArrow),
  'Hints should use pulse markers instead of drawing a connector line through the board.',
);

const createMoveHint = methodBody('createMoveHint');
assert(
  /HintMove_/.test(createMoveHint) && /directionLabel\s*\(/.test(createMoveHint) && /directionVector\s*\(/.test(createMoveHint),
  'createMoveHint() should render a named direction badge at the hinted tile.',
);
assert(
  /tween\s*\(\s*tile\.node\s*\)/.test(createMoveHint) && /repeat\s*\(/.test(createMoveHint),
  'createMoveHint() should nudge the tile in the suggested direction for better hand feel.',
);

assert(
  /道具/.test(touchEnd),
  'Failed drag moves should tell the player to use a prop instead of silently reverting.',
);

assert(
  /showSameTypeHints\s*\(\s*tile\s*\)/.test(touchStart),
  'Touching a tile should reveal the positions of matching mahjong tiles.',
);

const showSameTypeHints = methodBody('showSameTypeHints');
assert(
  /SameTypeHint_/.test(showSameTypeHints) && /filter\s*\(/.test(showSameTypeHints) && /\.type\s*===\s*tile\.type/.test(showSameTypeHints),
  'showSameTypeHints() should create visible markers for other tiles with the same type.',
);
assert(
  /shakeSameTypeTile\s*\(/.test(showSameTypeHints),
  'showSameTypeHints() should shake matching tiles so the player feels the connection immediately.',
);

const clearSameTypeHints = methodBody('clearSameTypeHints');
assert(
  /SameTypeHint/.test(clearSameTypeHints) && /stopAllByTarget/.test(clearSameTypeHints),
  'clearSameTypeHints() should remove same-type markers and reset tile tweens cleanly.',
);
assert(
  fs.existsSync(artDir) && fs.readdirSync(artDir).filter((name) => name.endsWith('.png')).join(',') === 'background_clean.png',
  'Only the used clean background image should remain in assets/resources/duidui.',
);

assert(
  /btn_shuffle/.test(source) && /useShuffleProp\s*\(/.test(source),
  'A visible shuffle prop button and useShuffleProp() handler should exist.',
);
assert(
  /showRewardedVideo\s*\(/.test(source) && /showInterstitial\s*\(/.test(source),
  'Commercial flow should gate props with rewarded video and show interstitial ads after victory.',
);

const buildGameRoot = methodBody('buildGameRoot');
assert(
  !/-576/.test(buildGameRoot),
  'Bottom controls must stay inside a safe area instead of sitting on the design edge.',
);
assert(
  /PropDock/.test(buildGameRoot) && /makeControlButton\s*\(/.test(buildGameRoot),
  'The game screen should use a dedicated bottom prop dock instead of loose debug-style buttons.',
);
const controlButtonMatches = [...buildGameRoot.matchAll(/makeControlButton\('([^']+)'/g)].map((match) => match[1]);
assert(
  controlButtonMatches.length === new Set(controlButtonMatches).size,
  'Bottom control buttons should have unique node names so prop feedback never targets the wrong skill.',
);
assert(
  ['btn_home', 'btn_restart', 'btn_hint', 'btn_shuffle', 'btn_undo'].every((name) => controlButtonMatches.includes(name)),
  'Home, restart, hint, shuffle, and undo controls should all be present in the prop dock.',
);
assert(
  /btn_hint[\s\S]*true/.test(buildGameRoot) && /btn_shuffle[\s\S]*true/.test(buildGameRoot) && /btn_undo[\s\S]*true/.test(buildGameRoot),
  'Hint, shuffle, and undo prop buttons should show an AD badge because they require rewarded ads.',
);
assert(
  /TopStat_/.test(buildGameRoot) && /makeStatPill\s*\(/.test(buildGameRoot),
  'The game screen should use compact top stat pills for level, time, and remaining tiles.',
);
assert(
  /PlayFrame/.test(buildGameRoot) && /BoardSlot/.test(buildGameRoot) && /TipRibbon/.test(buildGameRoot),
  'The game screen should be composed as a polished portrait play frame with a board slot and tip ribbon.',
);

const showHome = methodBody('showHome');
assert(
  /HomeHero/.test(showHome) && /HomeModeCard/.test(showHome) && /HomeStart/.test(showHome),
  'Home screen should use a complete casual-game entrance layout instead of flat stacked debug buttons.',
);
assert(
  !/TitleBack/.test(showHome),
  'Home screen should not use the old plain title-back panel layout.',
);

assert(
  /function findNodeDeep/.test(source),
  'Nested UI controls should be discoverable with findNodeDeep() for prompts and feedback.',
);

const showUsePropPrompt = methodBody('showUsePropPrompt');
assert(
  /findNodeDeep\s*\(/.test(showUsePropPrompt),
  'showUsePropPrompt() must find the shuffle button inside the prop dock, not only direct children of gameRoot.',
);

const makeControlButton = methodBody('makeControlButton');
assert(
  /findNodeDeep\(this\.gameRoot,\s*'PropDock'\)/.test(makeControlButton),
  'makeControlButton() should attach prop buttons to the prop dock, not scatter controls across gameRoot.',
);
assert(
  /requiresAd/.test(makeControlButton) && /AD/.test(makeControlButton),
  'makeControlButton() should render an AD badge on ad-gated prop buttons.',
);

const useShuffleProp = methodBody('useShuffleProp');
const useHintProp = methodBody('useHintProp');
const undo = methodBody('undo');
const transitionToHome = methodBody('transitionToHome');
assert(
  /runRewardedProp\s*\(/.test(useHintProp) && /showHint\s*\(\s*false\s*\)/.test(useHintProp),
  'Manual hint prop should require a rewarded ad before showing a hint.',
);
assert(
  /state === 'choosing'/.test(useShuffleProp) && /clearChoiceLayer\s*\(/.test(useShuffleProp) && /state !== 'playing'/.test(useShuffleProp) && /runRewardedProp\s*\(/.test(useShuffleProp),
  'useShuffleProp() should clear choice mode, guard against non-playing states, and require a rewarded ad.',
);
assert(
  /state !== 'playing'/.test(undo) && /undoStack\.length === 0/.test(undo) && /runRewardedProp\s*\(/.test(undo),
  'undo() should not run while another skill/mode is active, when no snapshot exists, or before rewarded ad completion.',
);
assert(
  /state === 'choosing'/.test(transitionToHome) && /clearChoiceLayer\s*\(/.test(transitionToHome) && /playScreenExit\s*\(/.test(transitionToHome),
  'transitionToHome() should clean choice state and exit through the screen animation.',
);

const portraitNodes = [
  ['TopHud', 0, 520, 650, 152],
  ['PlayFrame', 0, -2, 670, 802],
  ['PropDock', 0, -546, 660, 132],
  ['HomeHero', 0, 348, 650, 292],
  ['HomeStart', 0, -398, 520, 92],
];
for (const [name, x, y, w, h] of portraitNodes) {
  const left = x - w / 2;
  const right = x + w / 2;
  const bottom = y - h / 2;
  const top = y + h / 2;
  assert(
    left >= -360 && right <= 360 && bottom >= -640 && top <= 640,
    `${name} should fit inside the 720x1280 design viewport.`,
  );
}

const layoutBoard = methodBody('layoutBoard');
assert(
  /624\s*\/\s*rawH/.test(layoutBoard),
  'Board layout should use a conservative max height so the HUD and prop bar fit on screen.',
);
assert(
  !/color\(28,\s*105,\s*77/.test(layoutBoard) && !/color\(20,\s*75,\s*62/.test(layoutBoard),
  'The board surface should be a light casual play area, not the old dark green debug board.',
);

const drawTile = methodBody('drawTile');
assert(
  !/TileArt/.test(drawTile) && !/tileBase/.test(drawTile) && !/tileHighlight/.test(drawTile),
  'Tile faces should be drawn as clean mahjong tiles; the old LibTV board-frame images must not be stretched onto every tile.',
);

const showChoice = methodBody('showChoice');
assert(
  /UIOpacity/.test(showChoice) && /setScale\s*\(/.test(showChoice) && /tween\s*\(/.test(showChoice),
  'showChoice() should animate candidate rings in with fade and scale feedback.',
);

const showResult = methodBody('showResult');
assert(
  /UIOpacity/.test(showResult) && /setScale\s*\(/.test(showResult) && /tween\s*\(/.test(showResult),
  'showResult() should animate modal blocker/panel opacity and panel scale.',
);
assert(
  /closeResultModal\s*\(/.test(showResult) && !/modalLayer!\.active\s*=\s*false/.test(showResult),
  'Result buttons should close through an exit animation instead of hiding the modal immediately.',
);
assert(
  /playWinInterstitial\s*\(/.test(showResult),
  'Successful result screen should request an interstitial ad after victory.',
);

const closeResultModal = methodBody('closeResultModal');
assert(
  /UIOpacity/.test(closeResultModal) && /opacity:\s*0/.test(closeResultModal) && /scale:\s*new Vec3\(0\.82/.test(closeResultModal),
  'closeResultModal() should fade and shrink the result panel before running the next action.',
);

const playScreenEnter = methodBody('playScreenEnter');
const playScreenExit = methodBody('playScreenExit');
assert(
  /UIOpacity/.test(playScreenEnter) && /tween\s*\(/.test(playScreenEnter) && /setScale\s*\(/.test(playScreenEnter),
  'Screens should have an entry animation.',
);
assert(
  /UIOpacity/.test(playScreenExit) && /tween\s*\(/.test(playScreenExit) && /opacity:\s*0/.test(playScreenExit),
  'Screens should have an exit animation.',
);

const bindPress = methodBody('bindPress');
assert(
  /animated\s*=\s*true/.test(bindPress) && /Tween\.stopAllByTarget/.test(bindPress) && /0\.92/.test(bindPress) && /1\.04/.test(bindPress) && /tween\s*\(/.test(bindPress),
  'bindPress() should keep elastic button feedback by default.',
);

console.log('DuiDui regression checks passed.');
