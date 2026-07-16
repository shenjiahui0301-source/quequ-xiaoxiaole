import {
    _decorator,
    AudioClip,
    AudioSource,
    Color,
    Component,
    EventMouse,
    EventTouch,
    Graphics,
    input,
    Input,
    Label,
    LabelOutline,
    Layers,
    Node,
    ResolutionPolicy,
    resources,
    Sprite,
    SpriteFrame,
    sys,
    Tween,
    tween,
    UIOpacity,
    UITransform,
    Vec2,
    Vec3,
    view,
} from 'cc';
import { DuiBoardSnapshot, DuiDirection, DuiDuiMahjongModel, DuiSlidePlan } from './model/DuiDuiMahjongModel';
import { DuiDuiAdService } from './platform/DuiDuiAdService';
import { DuiDuiMahjongTheme } from './view/DuiDuiMahjongTheme';

const { ccclass } = _decorator;

type Direction = DuiDirection;
type GameState = 'loading' | 'home' | 'playing' | 'choosing' | 'success' | 'failed';

interface GameSettings {
    music: boolean;
    sound: boolean;
    vibration: boolean;
    autoHint: boolean;
}

interface LevelConfig {
    rows: number;
    cols: number;
    cellW: number;
    cellH: number;
    types: number;
    difficulty: number;
    time: number;
}

interface TileData {
    id: number;
    type: number;
    row: number;
    col: number;
    node: Node;
}

type BoardSnapshot = DuiBoardSnapshot;

interface SlidePlan extends DuiSlidePlan<TileData> {
    startPositions: Map<number, Vec3>;
}

const MODE_NAMES = ['新手', '挑战', '地狱'];
const GAME_TITLE = '雀趣消消乐';
const GAME_SUBTITLE = '麻将连连看';
const LEVELS: LevelConfig[][] = [
    [
        { rows: 7, cols: 8, cellW: 80, cellH: 100, types: 18, difficulty: 1, time: -99 },
    ],
    [
        { rows: 4, cols: 4, cellW: 80, cellH: 100, types: 6, difficulty: 1, time: 300 },
        { rows: 6, cols: 7, cellW: 75, cellH: 100, types: 20, difficulty: 1, time: 300 },
        { rows: 8, cols: 9, cellW: 73.6, cellH: 92, types: 25, difficulty: 1, time: 350 },
        { rows: 10, cols: 10, cellW: 65.6, cellH: 76.5, types: 30, difficulty: 1, time: 400 },
        { rows: 12, cols: 11, cellW: 60.8, cellH: 65.7, types: 30, difficulty: 1, time: 500 },
    ],
    [
        { rows: 6, cols: 7, cellW: 75, cellH: 100, types: 20, difficulty: 2, time: 300 },
        { rows: 8, cols: 9, cellW: 68.8, cellH: 90, types: 30, difficulty: 3, time: 400 },
        { rows: 12, cols: 11, cellW: 58.4, cellH: 63, types: 30, difficulty: 3, time: 500 },
    ],
];

@ccclass('DuiDuiMahjongGame')
export class DuiDuiMahjongGame extends Component {
    private readonly designW = 720;
    private readonly designH = 1280;

    private root: Node | null = null;
    private backgroundNode: Node | null = null;
    private loadingRoot: Node | null = null;
    private loadingProgressFill: Node | null = null;
    private homeRoot: Node | null = null;
    private gameRoot: Node | null = null;
    private boardPanel: Node | null = null;
    private boardLayer: Node | null = null;
    private effectLayer: Node | null = null;
    private choiceLayer: Node | null = null;
    private modalLayer: Node | null = null;
    private settingsLayer: Node | null = null;
    private toastNode: Node | null = null;
    private toastLabel: Label | null = null;
    private levelLabel: Label | null = null;
    private timeLabel: Label | null = null;
    private remainLabel: Label | null = null;
    private readonly adService = new DuiDuiAdService();
    private readonly boardModel = new DuiDuiMahjongModel<TileData>();
    private readonly artSprites: Partial<Record<keyof typeof DuiDuiMahjongTheme.artPaths, SpriteFrame>> = {};
    private readonly loadingDuration = 2;
    private loadingElapsed = 0;
    private bgmSource: AudioSource | null = null;
    private bgmClipLoaded = false;
    private audioUnlockRegistered = false;
    private audioUserGestureReceived = false;
    private clickSource: AudioSource | null = null;
    private clickClip: AudioClip | null = null;
    private removeSource: AudioSource | null = null;
    private removeClip: AudioClip | null = null;

    private state: GameState = 'home';
    private mode = 1;
    private levelByMode = [0, 0, 0];
    private level: LevelConfig = LEVELS[1][0];
    private grid: (TileData | null)[][] = [];
    private tiles: TileData[] = [];
    private nextTileId = 1;
    private tileW = 80;
    private tileH = 100;
    private gap = 1;
    private boardW = 0;
    private boardH = 0;
    private timeLeft = 0;
    private undoStack: BoardSnapshot[] = [];

    private activeTile: TileData | null = null;
    private selectedTile: TileData | null = null;
    private dragPlan: SlidePlan | null = null;
    private dragPixels = 0;
    private dragWarmup = new Vec2();
    private dragSnapshot: BoardSnapshot | null = null;
    private choosingTile: TileData | null = null;
    private sameTypeHintTiles: TileData[] = [];
    private screenTransitioning = false;
    private adRequesting = false;
    private settingsOpen = false;
    private settings: GameSettings = {
        music: true,
        sound: true,
        vibration: true,
        autoHint: true,
    };

    onLoad() {
        this.applyDesignResolutionPolicy();
        this.node.layer = Layers.Enum.UI_2D;

        const transform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        transform.setContentSize(this.designW, this.designH);

        this.loadProgress();
        this.loadSettings();
    }

    private applyDesignResolutionPolicy() {
        const frameSize = view.getFrameSize();
        const designAspect = this.designW / this.designH;
        const frameAspect = frameSize.height > 0 ? frameSize.width / frameSize.height : designAspect;
        const policy = frameAspect <= designAspect ? ResolutionPolicy.FIXED_WIDTH : ResolutionPolicy.FIXED_HEIGHT;
        view.setDesignResolutionSize(this.designW, this.designH, policy);
    }

    start() {
        this.loadArtSprites();
        this.buildShell();
        this.showLoading();
        this.registerBackgroundMusicUnlock();
        this.loadBackgroundMusic();
        this.loadClickSound();
        this.loadRemoveSound();
    }

    onDestroy() {
        this.unregisterBackgroundMusicUnlock();
        this.stopBackgroundMusic();
    }

    update(dt: number) {
        if (this.state === 'loading') {
            this.updateLoading(dt);
            return;
        }

        if (this.state !== 'playing' || this.level.time <= 0) {
            return;
        }
        if (this.settingsOpen) {
            return;
        }

        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
            this.timeLeft = 0;
            this.refreshHud();
            this.showResult(false);
            return;
        }

        this.refreshHud();
    }

    private buildShell() {
        const oldRoot = this.node.getChildByName('DuiDuiRoot');
        if (oldRoot) {
            oldRoot.destroy();
        }

        this.root = makeNode('DuiDuiRoot', this.node, 0, 0, this.designW, this.designH);
        this.drawBackground();
        this.settingsLayer = makeNode('SettingsLayer', this.root, 0, 0, this.designW, this.designH);
        this.applySettingsLayerFrame();
        this.settingsLayer.active = false;
        this.toastNode = makeNode('Toast', this.root, 0, -430, 560, 64);
        this.toastNode.active = false;
        drawRoundRect(this.toastNode, 560, 64, color(45, 58, 54, 226), color(255, 255, 255, 120), 2, 22);
        this.toastNode.addComponent(UIOpacity).opacity = 0;
        this.toastLabel = addLabel(this.toastNode, '', 24, color(255, 255, 255), 0, 0, 520, 54, true);
    }

    private loadArtSprites() {
        const paths = DuiDuiMahjongTheme.artPaths;
        (Object.keys(paths) as Array<keyof typeof paths>).forEach((key) => {
            resources.load(`${paths[key]}/spriteFrame`, SpriteFrame, (err, spriteFrame) => {
                if (err || !spriteFrame) {
                    return;
                }
                this.artSprites[key] = spriteFrame;
                if (key === 'background') {
                    this.applyBackgroundSprite();
                }
            });
        });
    }

    private loadBackgroundMusic() {
        if (!this.bgmSource) {
            this.bgmSource = this.node.getComponent(AudioSource) || this.node.addComponent(AudioSource);
            this.bgmSource.loop = true;
            this.bgmSource.volume = 0.42;
        }

        resources.load('duidui/bgm', AudioClip, (err, clip) => {
            if (err || !clip || !this.bgmSource) {
                return;
            }

            this.bgmSource.clip = clip;
            this.bgmClipLoaded = true;
            this.syncBackgroundMusic();
        });
    }

    private registerBackgroundMusicUnlock() {
        if (this.audioUnlockRegistered) {
            return;
        }

        this.audioUnlockRegistered = true;
        input.on(Input.EventType.TOUCH_START, this.handleAudioUnlockGesture, this);
        input.on(Input.EventType.MOUSE_DOWN, this.handleAudioUnlockGesture, this);
    }

    private unregisterBackgroundMusicUnlock() {
        if (!this.audioUnlockRegistered) {
            return;
        }

        input.off(Input.EventType.TOUCH_START, this.handleAudioUnlockGesture, this);
        input.off(Input.EventType.MOUSE_DOWN, this.handleAudioUnlockGesture, this);
        this.audioUnlockRegistered = false;
    }

    private handleAudioUnlockGesture() {
        this.audioUserGestureReceived = true;
        this.unregisterBackgroundMusicUnlock();
        this.syncBackgroundMusic();
    }

    private syncBackgroundMusic() {
        if (!this.bgmSource || !this.bgmClipLoaded) {
            return;
        }

        if (this.settings.music) {
            if (!this.bgmSource.playing && (!sys.isBrowser || this.audioUserGestureReceived)) {
                this.bgmSource.play();
            }
            return;
        }

        this.stopBackgroundMusic();
    }

    private stopBackgroundMusic() {
        if (this.bgmSource && this.bgmSource.playing) {
            this.bgmSource.stop();
        }
    }

    private loadClickSound() {
        if (!this.clickSource) {
            const node = makeNode('ClickAudio', this.node, 0, 0, 1, 1);
            this.clickSource = node.addComponent(AudioSource);
            this.clickSource.loop = false;
            this.clickSource.volume = 0.72;
        }

        resources.load('duidui/click', AudioClip, (err, clip) => {
            if (err || !clip || !this.clickSource) {
                return;
            }
            this.clickClip = clip;
            this.clickSource.clip = clip;
        });
    }

    private playClickSound() {
        if (!this.settings.sound || !this.clickSource || !this.clickClip) {
            return;
        }

        this.clickSource.playOneShot(this.clickClip, 0.72);
    }

    private loadRemoveSound() {
        if (!this.removeSource) {
            const node = makeNode('RemoveAudio', this.node, 0, 0, 1, 1);
            this.removeSource = node.addComponent(AudioSource);
            this.removeSource.loop = false;
            this.removeSource.volume = 0.86;
        }

        resources.load('duidui/explode', AudioClip, (err, clip) => {
            if (err || !clip || !this.removeSource) {
                return;
            }
            this.removeClip = clip;
            this.removeSource.clip = clip;
        });
    }

    private playRemoveSound() {
        if (!this.settings.sound || !this.removeSource || !this.removeClip) {
            return;
        }

        this.removeSource.playOneShot(this.removeClip, 0.86);
    }

    private applyBackgroundSprite() {
        if (!this.backgroundNode || !this.artSprites.background) {
            return;
        }

        destroyChildren(this.backgroundNode);
        const spriteNode = makeNode('LibTVBackground', this.backgroundNode, 0, 0, this.designW, this.designH);
        const sprite = spriteNode.addComponent(Sprite);
        sprite.spriteFrame = this.artSprites.background;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    }

    private drawBackground() {
        if (!this.root) {
            return;
        }

        const bg = makeNode('Background', this.root, 0, 0, this.designW, this.designH);
        this.backgroundNode = bg;
        const g = bg.addComponent(Graphics);
        g.clear();
        g.fillColor = color(224, 249, 232);
        g.rect(-360, -640, 720, 1280);
        g.fill();

        g.fillColor = color(255, 250, 207, 150);
        g.circle(250, -480, 220);
        g.fill();
        g.fillColor = color(139, 220, 204, 105);
        g.circle(-286, 440, 180);
        g.fill();
        g.fillColor = color(255, 255, 255, 88);
        g.circle(266, 440, 58);
        g.circle(-250, -430, 42);
        g.fill();
        this.applyBackgroundSprite();
    }

    private showLoading() {
        this.clearGameNodes();
        this.state = 'loading';
        this.loadingElapsed = 0;

        if (!this.root) {
            return;
        }

        this.loadingRoot = makeNode('LoadingRoot', this.root, 0, 0, this.designW, this.designH);
        this.createHomeLogo(this.loadingRoot, 176);

        const track = makeNode('LoadingProgressTrack', this.loadingRoot, 0, -268, 468, 34);
        drawRoundRect(track, 468, 34, color(255, 255, 247, 210), color(58, 177, 140, 210), 4, 17);
        this.loadingProgressFill = makeNode('LoadingProgressFill', track, -217, 0, 34, 24);
        drawRoundRect(this.loadingProgressFill, 34, 24, color(58, 177, 140, 235), color(255, 255, 255, 88), 1, 12);
        addLabel(this.loadingRoot, '加载中', 24, color(43, 139, 104), 0, -214, 220, 38, true);
        this.updateLoadingProgressBar(0);
        this.playScreenEnter(this.loadingRoot);
    }

    private updateLoading(dt: number) {
        this.loadingElapsed += dt;
        const progress = Math.min(1, this.loadingElapsed / this.loadingDuration);
        this.updateLoadingProgressBar(progress);
        if (progress >= 1) {
            this.showHome();
        }
    }

    private updateLoadingProgressBar(progress: number) {
        if (!this.loadingProgressFill) {
            return;
        }

        const barW = 468;
        const barH = 24;
        const fillW = Math.max(barH, barW * progress);
        this.loadingProgressFill.setPosition(-barW / 2 + fillW / 2, 0, 0);
        setSize(this.loadingProgressFill, fillW, barH);
        drawRoundRect(this.loadingProgressFill, fillW, barH, color(58, 177, 140, 235), color(255, 255, 255, 88), 1, barH / 2);
    }

    private createHomeLogo(parent: Node, y: number) {
        const hero = makeNode('HomeHero', parent, 0, y, 650, 292);
        drawRoundRect(hero, 650, 292, color(255, 252, 229, 228), color(255, 196, 82), 5, 36);
        const heroGlow = makeNode('HomeHeroGlow', hero, 0, -78, 560, 70);
        drawRoundRect(heroGlow, 560, 70, color(255, 217, 92, 92), color(255, 255, 255, 0), 0, 34);
        addLabel(hero, GAME_TITLE, 72, color(214, 67, 60), 0, 58, 560, 94, true);
        addLabel(hero, GAME_SUBTITLE, 34, color(43, 139, 104), 0, -8, 420, 54, true);

        const stand = makeNode('MahjongStand', hero, 0, -104, 510, 120);
        for (let i = 0; i < 5; i++) {
            const tile = makeNode(`Sample_${i}`, stand, -184 + i * 92, 0, 76, 98);
            tile.angle = [-8, -3, 4, -4, 7][i];
            this.drawSampleTile(tile, i + 13, i);
        }
    }

    private showHome() {
        this.clearGameNodes();
        this.state = 'home';

        if (!this.root) {
            return;
        }

        this.homeRoot = makeNode('Home', this.root, 0, 0, this.designW, this.designH);

        this.createHomeLogo(this.homeRoot, 348);

        const progress = makeNode('HomeProgress', this.homeRoot, 0, 156, 552, 76);
        drawRoundRect(progress, 552, 76, color(58, 177, 140, 220), color(255, 255, 255, 165), 3, 28);
        addLabel(progress, `挑战进度  第 ${this.levelByMode[1] + 1} 关`, 28, color(255, 255, 255), 0, 0, 510, 58, true);

        this.makeHomeButton('HomeModeCard_Tutorial', '新手教学', '先熟悉怎么挪牌', 0, 24, color(64, 164, 123), () => this.transitionToLevel(0), '学');
        this.makeHomeButton('HomeModeCard_Challenge', '挑战模式', '从当前关卡继续', 0, -100, color(220, 87, 73), () => this.transitionToLevel(1), '闯');
        this.makeHomeButton('HomeModeCard_Hell', '地狱模式', '更密集的牌局', 0, -224, color(83, 111, 188), () => this.transitionToLevel(2), '难');

        const settings = makeNode('HomeSettings', this.homeRoot, 250, -398, 92, 92);
        drawRoundRect(settings, 92, 92, color(78, 132, 190), color(255, 255, 255, 168), 4, 30);
        addLabel(settings, '设', 34, color(255, 255, 255), 0, 2, 76, 64, true);
        this.bindPress(settings, () => this.showSettings());

        const start = makeNode('HomeStart', this.homeRoot, -44, -398, 430, 92);
        drawRoundRect(start, 430, 92, color(255, 199, 67), color(255, 255, 255, 185), 4, 34);
        addLabel(start, '开始挑战', 36, color(118, 63, 32), -20, 0, 360, 70, true);
        addLabel(start, '>', 50, color(118, 63, 32), 158, 2, 60, 70, true);
        this.bindPress(start, () => this.transitionToLevel(1));
        this.playScreenEnter(this.homeRoot);
    }

    private makeHomeButton(name: string, text: string, desc: string, x: number, y: number, fill: Color, callback: () => void, icon: string) {
        if (!this.homeRoot) {
            return;
        }

        const button = makeNode(name, this.homeRoot, x, y, 566, 104);
        drawRoundRect(button, 566, 104, color(255, 255, 247, 232), fill, 4, 26);
        const badge = makeNode(`${name}_Badge`, button, -230, 0, 70, 70);
        drawRoundRect(badge, 70, 70, fill, color(255, 255, 255, 150), 3, 26);
        addLabel(badge, icon, 30, color(255, 255, 255), 0, 0, 58, 56, true);
        addLabel(button, text, 30, fill, -72, 18, 300, 44, true);
        addLabel(button, desc, 20, color(102, 106, 92), -72, -22, 330, 34);
        const action = makeNode(`${name}_Action`, button, 214, 0, 100, 58);
        drawRoundRect(action, 100, 58, fill, color(255, 255, 255, 120), 2, 22);
        addLabel(action, '开始', 24, color(255, 255, 255), 0, 0, 92, 52, true);
        this.bindPress(button, callback);
    }

    private transitionToLevel(mode: number) {
        if (this.screenTransitioning) {
            return;
        }

        this.screenTransitioning = true;
        const outgoing = this.gameRoot || this.homeRoot;
        this.playScreenExit(outgoing, () => {
            this.screenTransitioning = false;
            this.startLevel(mode);
        });
    }

    private transitionToHome() {
        if (this.screenTransitioning) {
            return;
        }
        if (this.state === 'choosing') {
            this.clearChoiceLayer();
        }

        this.screenTransitioning = true;
        const outgoing = this.gameRoot || this.homeRoot;
        this.playScreenExit(outgoing, () => {
            this.screenTransitioning = false;
            this.showHome();
        });
    }

    private playScreenEnter(node: Node | null) {
        if (!node) {
            return;
        }

        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        opacity.opacity = 0;
        node.setScale(0.88, 0.88, 1);
        tween(opacity)
            .to(0.18, { opacity: 255 })
            .start();
        tween(node)
            .to(0.18, { scale: new Vec3(1.08, 1.08, 1) })
            .to(0.1, { scale: new Vec3(0.98, 0.98, 1) })
            .to(0.08, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    private playScreenExit(node: Node | null, done: () => void) {
        if (!node) {
            done();
            return;
        }

        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        tween(opacity)
            .to(0.18, { opacity: 0 })
            .start();
        tween(node)
            .to(0.18, { scale: new Vec3(0.9, 0.9, 1) })
            .call(done)
            .start();
    }

    private startLevel(mode: number, keepBoard = false) {
        this.mode = clampInt(mode, 0, LEVELS.length - 1);
        const maxIndex = LEVELS[this.mode].length - 1;
        this.levelByMode[this.mode] = clampInt(this.levelByMode[this.mode], 0, maxIndex);
        this.level = LEVELS[this.mode][this.levelByMode[this.mode]];
        this.timeLeft = this.level.time;
        this.undoStack = [];
        this.state = 'playing';

        this.clearGameNodes();
        this.buildGameRoot();

        if (keepBoard) {
            this.restoreSnapshot(this.captureSnapshot(), false);
        } else {
            this.createLevelBoard();
        }

        this.refreshHud();
        this.playScreenEnter(this.gameRoot);
        if (this.mode === 0 && this.settings.autoHint) {
            this.scheduleOnce(() => this.showHint(true), 1.2);
        }
    }

    private buildGameRoot() {
        if (!this.root) {
            return;
        }

        this.gameRoot = makeNode('Game', this.root, 0, 0, this.designW, this.designH);

        const top = makeNode('TopHud', this.gameRoot, 0, 520, 650, 152);
        drawRoundRect(top, 650, 152, color(255, 253, 233, 232), color(255, 194, 76), 5, 34);
        const titleBadge = makeNode('TopTitleBadge', top, 0, 40, 430, 56);
        drawRoundRect(titleBadge, 430, 56, color(70, 177, 143, 224), color(255, 255, 255, 140), 3, 22);
        addLabel(titleBadge, modeTitle(this.mode), 28, color(255, 255, 255), 0, 0, 380, 42, true);
        this.levelLabel = this.makeStatPill(top, 'TopStat_Level', '关卡', -204, -30, 168, color(46, 151, 116));
        this.timeLabel = this.makeStatPill(top, 'TopStat_Time', '时间', 0, -30, 168, color(211, 72, 76));
        this.remainLabel = this.makeStatPill(top, 'TopStat_Remain', '剩余', 204, -30, 168, color(69, 108, 190));

        const playFrame = makeNode('PlayFrame', this.gameRoot, 0, -2, 670, 802);
        drawRoundRect(playFrame, 670, 802, color(255, 250, 225, 220), color(93, 179, 143), 5, 36);
        const tipRibbon = makeNode('TipRibbon', playFrame, 0, 352, 560, 54);
        drawRoundRect(tipRibbon, 560, 54, color(70, 177, 143, 224), color(255, 255, 255, 140), 2, 22);
        addLabel(tipRibbon, '滑动麻将，同线相同即可消除', 23, color(255, 255, 255), 0, 0, 520, 42, true);

        const boardSlot = makeNode('BoardSlot', playFrame, 0, -24, 628, 674);
        drawRoundRect(boardSlot, 628, 674, color(255, 255, 246, 210), color(255, 219, 130), 4, 28);

        this.boardPanel = makeNode('BoardPanel', boardSlot, 0, -2, 610, 610);
        this.boardLayer = makeNode('BoardLayer', this.boardPanel, 0, 0, 600, 600);
        this.effectLayer = makeNode('EffectLayer', this.boardPanel, 0, 0, 600, 600);
        this.choiceLayer = makeNode('ChoiceLayer', this.boardPanel, 0, 0, 600, 600);
        this.choiceLayer.active = false;

        this.modalLayer = makeNode('ModalLayer', this.gameRoot, 0, 0, this.designW, this.designH);
        this.modalLayer.active = false;

        const dock = makeNode('PropDock', this.gameRoot, 0, -546, 660, 132);
        drawRoundRect(dock, 660, 132, color(255, 253, 238, 236), color(255, 204, 86), 4, 34);
        this.makeControlButton('btn_home', '首页', -275, 0, color(88, 137, 198), () => this.transitionToHome(), '回');
        this.makeControlButton('btn_restart', '重开', -165, 0, color(220, 88, 74), () => this.transitionToLevel(this.mode), '刷');
        this.makeControlButton('btn_hint', '提示', -55, 0, color(52, 164, 121), () => this.useHintProp(), '?', true);
        this.makeControlButton('btn_shuffle', '洗牌', 55, 0, color(146, 98, 198), () => this.useShuffleProp(), '洗', true);
        this.makeControlButton('btn_undo', '撤回', 165, 0, color(225, 151, 52), () => this.undo(), '退', true);
        this.makeControlButton('btn_settings', '设置', 275, 0, color(78, 132, 190), () => this.showSettings(), '设');
    }

    private makeStatPill(parent: Node, name: string, title: string, x: number, y: number, w: number, accent: Color): Label {
        const pill = makeNode(name, parent, x, y, w, 72);
        drawRoundRect(pill, w, 72, color(255, 255, 255, 238), accent, 3, 22);
        addLabel(pill, title, 15, color(104, 108, 96), 0, 18, w - 16, 22, false);
        return addLabel(pill, '', 23, accent, 0, -12, w - 16, 36, true);
    }

    private makeControlButton(name: string, text: string, x: number, y: number, fill: Color, callback: () => void, icon = '', requiresAd = false) {
        if (!this.gameRoot) {
            return;
        }

        const parent = findNodeDeep(this.gameRoot, 'PropDock') || this.gameRoot;
        const button = makeNode(name, parent, x, y, 96, 112);
        const shadow = makeNode(`${name}_Shadow`, button, 0, -7, 84, 64);
        drawRoundRect(shadow, 84, 64, color(157, 111, 55, 68), color(255, 255, 255, 0), 0, 24);
        const iconBack = makeNode(`${name}_Icon`, button, 0, 14, 78, 78);
        drawRoundRect(iconBack, 78, 78, fill, color(255, 255, 255, 172), 4, 28);
        addLabel(iconBack, icon || text.slice(0, 1), 30, color(255, 255, 255), 0, 0, 66, 58, true);
        if (requiresAd) {
            const adBadge = makeNode(`${name}_AdBadge`, button, 28, 44, 42, 24);
            drawRoundRect(adBadge, 42, 24, color(255, 76, 64), color(255, 255, 255, 180), 2, 10);
            addLabel(adBadge, 'AD', 14, color(255, 255, 255), 0, 0, 36, 18, true);
        }
        addLabel(button, text, 18, color(94, 78, 57), 0, -40, 92, 28, true);
        this.bindPress(button, callback);
    }

    private createLevelBoard() {
        this.nextTileId = 1;
        this.tiles = [];
        this.grid = this.boardModel.createGrid(this.level);

        this.layoutBoard();

        const total = this.level.rows * this.level.cols;
        const values = this.boardModel.createPairedValues(total, this.level.types);

        let cursor = 0;
        for (let row = 0; row < this.level.rows; row++) {
            for (let col = 0; col < this.level.cols; col++) {
                this.addTile(values[cursor++], row, col);
            }
        }

        this.ensureDirectPair();
        this.refreshHud();
    }

    private layoutBoard() {
        const rawW = this.level.cols * this.level.cellW + this.level.cols + 1;
        const rawH = this.level.rows * this.level.cellH + this.level.rows + 1;
        const scale = Math.min(586 / rawW, 624 / rawH, 1.35);
        this.tileW = Math.floor(this.level.cellW * scale);
        this.tileH = Math.floor(this.level.cellH * scale);
        this.gap = Math.max(1, Math.round(2 * scale));
        this.boardW = this.level.cols * this.tileW + this.gap * (this.level.cols + 1);
        this.boardH = this.level.rows * this.tileH + this.gap * (this.level.rows + 1);

        const panelW = Math.min(610, this.boardW + 30 + (this.level.difficulty > 1 ? 36 : 0));
        const panelH = Math.min(650, this.boardH + 30 + (this.level.difficulty > 1 ? 36 : 0));

        setSize(this.boardPanel, panelW, panelH);
        setSize(this.boardLayer, this.boardW, this.boardH);
        setSize(this.effectLayer, this.boardW, this.boardH);
        setSize(this.choiceLayer, this.boardW, this.boardH);
        if (this.boardPanel) {
            this.boardPanel.setPosition(0, 0, 0);
        }

        if (this.boardPanel) {
            drawRoundRect(this.boardPanel, panelW, panelH, color(255, 252, 238, 236), color(255, 188, 78), 4, 26);
            const inner = this.boardPanel.getComponent(Graphics);
            if (inner) {
                inner.fillColor = color(255, 255, 255, 142);
                inner.roundRect(-panelW / 2 + 12, -panelH / 2 + 12, panelW - 24, panelH - 24, 20);
                inner.fill();
                inner.strokeColor = color(96, 183, 146, 96);
                inner.lineWidth = 2;
                inner.roundRect(-panelW / 2 + 20, -panelH / 2 + 20, panelW - 40, panelH - 40, 16);
                inner.stroke();
                inner.fillColor = color(255, 220, 105, 80);
                inner.circle(-panelW / 2 + 36, panelH / 2 - 36, 12);
                inner.circle(panelW / 2 - 38, -panelH / 2 + 36, 10);
                inner.fill();
            }
        }
    }

    private addTile(type: number, row: number, col: number) {
        if (!this.boardLayer) {
            return;
        }

        const node = makeNode(`Tile_${this.nextTileId}`, this.boardLayer, 0, 0, this.tileW, this.tileH);
        const tile: TileData = {
            id: this.nextTileId++,
            type,
            row,
            col,
            node,
        };

        node.setPosition(this.cellToPosition(row, col));
        this.grid[row][col] = tile;
        this.tiles.push(tile);
        this.drawTile(tile, false);
        this.bindTileEvents(tile);
    }

    private drawTile(tile: TileData, highlighted: boolean) {
        const node = tile.node;
        setSize(node, this.tileW, this.tileH);
        destroyChildren(node);

        const accent = DuiDuiMahjongTheme.accentColor(tile.type);
        const face = highlighted ? color(255, 246, 166) : color(255, 255, 247);
        const border = highlighted ? color(231, 76, 70) : color(78, 139, 111);
        drawRoundRect(node, this.tileW, this.tileH, color(151, 107, 66, 92), color(255, 255, 255, 0), 0, 10);
        const body = makeNode('TileFace', node, 0, Math.max(2, this.tileH * 0.03), this.tileW - 4, this.tileH - 8);
        drawRoundRect(body, this.tileW - 4, this.tileH - 8, face, border, highlighted ? 5 : 3, 10);

        const g = body.getComponent(Graphics);
        if (g) {
            g.fillColor = color(255, 255, 255, 180);
            g.roundRect(-this.tileW / 2 + 11, this.tileH / 2 - 28, this.tileW - 22, 12, 6);
            g.fill();
            g.fillColor = accent;
            g.circle(-this.tileW / 2 + 18, this.tileH / 2 - 22, Math.max(4, this.tileW * 0.065));
            g.fill();
            g.fillColor = color(accent.r, accent.g, accent.b, 150);
            g.circle(this.tileW / 2 - 18, -this.tileH / 2 + 18, Math.max(3, this.tileW * 0.052));
            g.fill();
            if (highlighted) {
                g.strokeColor = color(255, 255, 255, 210);
                g.lineWidth = 2;
                g.roundRect(-this.tileW / 2 + 9, -this.tileH / 2 + 11, this.tileW - 18, this.tileH - 22, 8);
                g.stroke();
            }
        }

        const symbol = DuiDuiMahjongTheme.symbol(tile.type);
        const fontSize = symbol.length > 1 ? Math.floor(this.tileW * 0.32) : Math.floor(this.tileW * 0.46);
        addLabel(body, symbol, fontSize, accent, 0, 3, this.tileW - 14, this.tileH - 30, true);
        addLabel(body, String(tile.type), Math.max(13, Math.floor(this.tileW * 0.18)), color(87, 92, 78), 0, -this.tileH * 0.34, this.tileW - 12, 22);

        if (this.level.difficulty > 1) {
            node.angle = tile.id % 2 === 0 ? 3 : -3;
        } else {
            node.angle = 0;
        }
    }

    private drawSampleTile(node: Node, type: number, index: number) {
        drawRoundRect(node, 76, 98, color(151, 107, 66, 82), color(255, 255, 255, 0), 0, 10);
        const face = makeNode(`SampleFace_${index}`, node, 0, 3, 70, 88);
        drawRoundRect(face, 70, 88, color(255, 255, 247), color(45, 140, 105), 3, 10);
        const accent = DuiDuiMahjongTheme.accentColor(index + 1);
        const g = face.getComponent(Graphics);
        if (g) {
            g.fillColor = accent;
            g.circle(-18, 26, 7);
            g.circle(18, -26, 6);
            g.fill();
        }
        addLabel(face, DuiDuiMahjongTheme.symbol(type), 32, accent, 0, 7, 58, 54, true);
    }

    private bindTileEvents(tile: TileData) {
        tile.node.on(Input.EventType.TOUCH_START, (event: EventTouch) => this.onTileTouchStart(tile, event), this);
        tile.node.on(Input.EventType.TOUCH_MOVE, (event: EventTouch) => this.onTileTouchMove(tile, event), this);
        tile.node.on(Input.EventType.TOUCH_END, () => this.onTileTouchEnd(tile), this);
        tile.node.on(Input.EventType.TOUCH_CANCEL, () => this.onTileTouchEnd(tile), this);
    }

    private onTileTouchStart(tile: TileData, _event: EventTouch) {
        if (this.state === 'choosing') {
            return;
        }
        if (this.state !== 'playing' || this.tiles.indexOf(tile) === -1) {
            return;
        }

        this.playTapFeedback();
        this.clearChoiceLayer();
        this.hideHint();
        this.activeTile = tile;
        this.selectedTile = tile;
        this.dragPlan = null;
        this.dragPixels = 0;
        this.dragWarmup.set(0, 0);
        this.dragSnapshot = this.captureSnapshot();
        this.drawTile(tile, true);
        Tween.stopAllByTarget(tile.node);
        tile.node.setScale(1.04, 1.04, 1);
        tile.node.setSiblingIndex(9999);
        this.showSameTypeHints(tile);
    }

    private onTileTouchMove(tile: TileData, event: EventTouch) {
        if (this.state !== 'playing' || this.activeTile !== tile) {
            return;
        }

        const delta = event.getUIDelta();
        if (!this.dragPlan) {
            this.dragWarmup.x += delta.x;
            this.dragWarmup.y += delta.y;
            const absX = Math.abs(this.dragWarmup.x);
            const absY = Math.abs(this.dragWarmup.y);
            if (Math.max(absX, absY) < 15) {
                return;
            }
            const dir: Direction = absX > absY
                ? (this.dragWarmup.x > 0 ? 'right' : 'left')
                : (this.dragWarmup.y > 0 ? 'up' : 'down');
            this.dragPlan = this.createSlidePlan(tile, dir);
            if (!this.dragPlan) {
                this.dragWarmup.set(0, 0);
                this.shakeTile(tile);
                return;
            }
            this.dragPixels = 0;
        }

        const plan = this.dragPlan;
        const directionSign = plan.dir === 'right' || plan.dir === 'up' ? 1 : -1;
        const axisDelta = plan.dir === 'left' || plan.dir === 'right' ? delta.x : delta.y;
        const cellSize = plan.dir === 'left' || plan.dir === 'right' ? this.tileW + this.gap : this.tileH + this.gap;
        this.dragPixels = clamp(this.dragPixels + axisDelta * directionSign, 0, plan.maxSteps * cellSize);
        this.applyDragOffset(plan, this.dragPixels / cellSize);
    }

    private onTileTouchEnd(tile: TileData) {
        if (this.state !== 'playing' || this.activeTile !== tile) {
            return;
        }

        this.clearSameTypeHints();
        this.drawTile(tile, false);
        Tween.stopAllByTarget(tile.node);
        tile.node.setScale(1, 1, 1);
        const plan = this.dragPlan;
        this.activeTile = null;
        this.dragPlan = null;

        let moved = false;
        if (plan) {
            const cellSize = plan.dir === 'left' || plan.dir === 'right' ? this.tileW + this.gap : this.tileH + this.gap;
            const steps = clampInt(Math.round(this.dragPixels / cellSize), 0, plan.maxSteps);
            if (steps > 0) {
                this.commitSlide(plan, steps);
                moved = true;
            } else {
                this.restorePlanPositions(plan);
            }
        }

        if (this.tryResolveMatches(tile)) {
            return;
        }

        if (moved && plan) {
            this.rollbackSlide(plan);
            this.showUsePropPrompt('没有消除，使用洗牌道具');
        }

        this.dragSnapshot = null;
        this.selectedTile = null;
    }

    private createSlidePlan(tile: TileData, dir: Direction): SlidePlan | null {
        const modelPlan = this.boardModel.createSlidePlan(tile, this.grid, this.level, dir);
        if (!modelPlan) {
            return null;
        }

        const startPositions = new Map<number, Vec3>();
        for (const item of modelPlan.group) {
            startPositions.set(item.id, item.node.getPosition().clone());
        }

        return { ...modelPlan, startPositions };
    }

    private applyDragOffset(plan: SlidePlan, stepsFloat: number) {
        const delta = DuiDuiMahjongModel.directionDelta(plan.dir);
        const offsetX = delta.col * (this.tileW + this.gap) * stepsFloat;
        const offsetY = delta.row * (this.tileH + this.gap) * stepsFloat;
        for (const tile of plan.group) {
            const start = plan.startPositions.get(tile.id);
            if (!start) {
                continue;
            }
            tile.node.setPosition(start.x + offsetX, start.y + offsetY, 0);
        }
    }

    private commitSlide(plan: SlidePlan, steps: number) {
        this.boardModel.commitSlide(plan, this.grid, steps);
        for (const tile of plan.group) {
            this.animateTileToCell(tile);
        }

        this.refreshHud();
    }

    private restorePlanPositions(plan: SlidePlan) {
        for (const tile of plan.group) {
            const start = plan.startPositions.get(tile.id);
            if (start) {
                Tween.stopAllByTarget(tile.node);
                tween(tile.node).to(0.12, { position: start }).start();
            }
        }
    }

    private rollbackSlide(plan: SlidePlan) {
        this.boardModel.rollbackSlide(plan, this.grid, this.level);
        for (const tile of plan.group) {
            this.drawTile(tile, false);
            Tween.stopAllByTarget(tile.node);
            this.animateTileToCell(tile);
        }

        this.refreshHud();
    }

    private showSameTypeHints(tile: TileData) {
        if (!this.effectLayer) {
            return;
        }

        this.clearSameTypeHints();
        const matches = this.tiles.filter((other) => other !== tile && other.type === tile.type);
        this.sameTypeHintTiles = matches;

        matches.forEach((match, index) => {
            const pos = this.cellToPosition(match.row, match.col);
            const hint = makeNode(`SameTypeHint_${match.id}`, this.effectLayer, pos.x, pos.y, this.tileW + 18, this.tileH + 18);
            const opacity = hint.addComponent(UIOpacity);
            opacity.opacity = 0;
            hint.setScale(0.72, 0.72, 1);
            drawRoundRect(hint, this.tileW + 18, this.tileH + 18, color(255, 236, 94, 62), color(255, 248, 128), 4, 8);
            tween(hint)
                .delay(index * 0.035)
                .to(0.12, { scale: new Vec3(1.12, 1.12, 1) })
                .to(0.14, { scale: new Vec3(1, 1, 1) })
                .union()
                .repeat(3)
                .start();
            tween(opacity)
                .delay(index * 0.035)
                .to(0.1, { opacity: 255 })
                .delay(0.5)
                .to(0.18, { opacity: 120 })
                .start();
            this.shakeSameTypeTile(match, index);
        });
    }

    private clearSameTypeHints() {
        if (this.effectLayer) {
            for (const child of [...this.effectLayer.children]) {
                if (child.name.startsWith('SameTypeHint')) {
                    child.destroy();
                }
            }
        }

        for (const tile of this.sameTypeHintTiles) {
            if (this.tiles.indexOf(tile) === -1 || !tile.node.isValid) {
                continue;
            }
            Tween.stopAllByTarget(tile.node);
            tile.node.setScale(1, 1, 1);
            tile.node.angle = this.level.difficulty > 1 ? (tile.id % 2 === 0 ? 3 : -3) : 0;
            this.animateTileToCell(tile);
            this.drawTile(tile, false);
        }
        this.sameTypeHintTiles = [];
    }

    private shakeSameTypeTile(tile: TileData, index: number) {
        const origin = this.cellToPosition(tile.row, tile.col);
        Tween.stopAllByTarget(tile.node);
        tween(tile.node)
            .delay(index * 0.035)
            .to(0.045, { position: new Vec3(origin.x - 5, origin.y + 2, 0), angle: tile.node.angle - 5, scale: new Vec3(1.05, 1.05, 1) })
            .to(0.045, { position: new Vec3(origin.x + 5, origin.y - 2, 0), angle: tile.node.angle + 5, scale: new Vec3(1.03, 1.03, 1) })
            .to(0.055, { position: origin, angle: this.level.difficulty > 1 ? (tile.id % 2 === 0 ? 3 : -3) : 0, scale: new Vec3(1, 1, 1) })
            .union()
            .repeat(2)
            .start();
    }

    private tryResolveMatches(tile: TileData): boolean {
        if (this.tiles.indexOf(tile) === -1) {
            return false;
        }

        const candidates = this.findClearMatches(tile);
        if (candidates.length === 0) {
            return false;
        }

        if (candidates.length === 1) {
            this.pushUndoIfNeeded();
            this.removePair(tile, candidates[0]);
            return true;
        }

        this.showChoice(tile, candidates);
        return true;
    }

    private showChoice(tile: TileData, candidates: TileData[]) {
        if (!this.choiceLayer) {
            return;
        }

        this.state = 'choosing';
        this.choosingTile = tile;
        this.choiceLayer.active = true;
        destroyChildren(this.choiceLayer);
        this.drawTile(tile, true);
        Tween.stopAllByTarget(tile.node);
        tile.node.setScale(1.04, 1.04, 1);
        this.showToast('选择一张相同牌消除');

        candidates.forEach((candidate, index) => {
            this.drawTile(candidate, true);
            Tween.stopAllByTarget(candidate.node);
            candidate.node.setScale(1, 1, 1);
            tween(candidate.node)
                .delay(index * 0.04)
                .to(0.16, { scale: new Vec3(1.06, 1.06, 1) })
                .to(0.2, { scale: new Vec3(1, 1, 1) })
                .union()
                .repeat(5)
                .start();

            const ghost = makeNode(`Choice_${candidate.id}`, this.choiceLayer, 0, 0, this.tileW + 14, this.tileH + 14);
            ghost.setPosition(this.cellToPosition(candidate.row, candidate.col));
            ghost.setScale(0.62, 0.62, 1);
            const opacity = ghost.addComponent(UIOpacity);
            opacity.opacity = 0;
            drawRoundRect(ghost, this.tileW + 14, this.tileH + 14, color(255, 222, 84, 80), color(255, 242, 104), 4, 8);
            tween(ghost)
                .delay(index * 0.04)
                .to(0.12, { scale: new Vec3(1.12, 1.12, 1) })
                .to(0.12, { scale: new Vec3(1, 1, 1) })
                .start();
            tween(opacity)
                .delay(index * 0.04)
                .to(0.12, { opacity: 255 })
                .start();
            ghost.on(Input.EventType.TOUCH_END, () => {
                if (this.state !== 'choosing' || this.choosingTile !== tile) {
                    return;
                }
                this.playTapFeedback();
                this.pushUndoIfNeeded();
                this.clearChoiceLayer();
                this.removePair(tile, candidate);
            }, this);
        });
    }

    private clearChoiceLayer() {
        const hasChoiceLayerContent = !!this.choiceLayer && (this.choiceLayer.active || this.choiceLayer.children.length > 0);
        if (!hasChoiceLayerContent && !this.choosingTile && this.sameTypeHintTiles.length === 0 && this.state !== 'choosing') {
            return;
        }

        this.clearSameTypeHints();
        if (this.choiceLayer) {
            this.choiceLayer.active = false;
            destroyChildren(this.choiceLayer);
        }
        if (this.choosingTile) {
            Tween.stopAllByTarget(this.choosingTile.node);
            this.choosingTile.node.setScale(1, 1, 1);
            this.drawTile(this.choosingTile, false);
        }
        for (const tile of this.tiles) {
            Tween.stopAllByTarget(tile.node);
            tile.node.setScale(1, 1, 1);
            this.drawTile(tile, false);
        }
        this.choosingTile = null;
        if (this.state === 'choosing') {
            this.state = 'playing';
        }
    }

    private removePair(first: TileData, second: TileData) {
        if (this.state !== 'playing' && this.state !== 'choosing') {
            return;
        }

        this.state = 'playing';
        this.grid[first.row][first.col] = null;
        this.grid[second.row][second.col] = null;
        this.tiles = this.tiles.filter((tile) => tile !== first && tile !== second);
        this.playRemoveSound();
        this.animateRemovePair(first, second);
        this.selectedTile = null;
        this.dragSnapshot = null;
        this.refreshHud();

        if (this.tiles.length === 0) {
            this.completeLevel();
        } else if (!this.findAnyDirectPair()) {
            this.showUsePropPrompt('没有可直接消除，使用洗牌道具');
        }
    }

    private animateRemovePair(first: TileData, second: TileData) {
        const firstPos = this.cellToPosition(first.row, first.col);
        const secondPos = this.cellToPosition(second.row, second.col);
        const mid = new Vec3((firstPos.x + secondPos.x) / 2, (firstPos.y + secondPos.y) / 2, 0);

        this.playBoardPulse();
        this.playPopFlash(firstPos);
        this.playPopFlash(secondPos);
        this.playBurstRing(firstPos);
        this.playBurstRing(secondPos);
        this.playFloatingScore(mid);
        this.playRemoveEffect(first);
        this.playRemoveEffect(second);
        this.popTile(first.node, firstPos, 0);
        this.popTile(second.node, secondPos, 0.03);
    }

    private popTile(node: Node, origin: Vec3, delay: number) {
        Tween.stopAllByTarget(node);
        node.setSiblingIndex(9999);
        const opacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        opacity.opacity = 255;
        const start = node.getPosition().clone();
        const punch = new Vec3(origin.x, origin.y + 8, 0);
        const floatAway = new Vec3(origin.x, origin.y + 24, 0);

        tween(node)
            .delay(delay)
            .to(0.05, { scale: new Vec3(1.18, 1.18, 1), position: punch })
            .to(0.06, { scale: new Vec3(0.92, 0.92, 1), position: start })
            .to(0.12, { scale: new Vec3(0.08, 0.08, 1), position: floatAway, angle: node.angle + randomRange(-24, 24) })
            .call(() => node.destroy())
            .start();
        tween(opacity)
            .delay(delay + 0.08)
            .to(0.12, { opacity: 0 })
            .start();
    }

    private playBoardPulse() {
        if (!this.boardPanel) {
            return;
        }

        Tween.stopAllByTarget(this.boardPanel);
        this.boardPanel.setScale(1, 1, 1);
        tween(this.boardPanel)
            .to(0.05, { scale: new Vec3(1.015, 1.015, 1) })
            .to(0.08, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    private playPopFlash(pos: Vec3) {
        if (!this.effectLayer) {
            return;
        }

        const flash = makeNode('PopFlash', this.effectLayer, pos.x, pos.y, 92, 92);
        const g = flash.addComponent(Graphics);
        g.fillColor = color(255, 255, 255, 210);
        g.circle(0, 0, 30);
        g.fill();
        g.fillColor = color(255, 224, 76, 180);
        g.circle(0, 0, 18);
        g.fill();

        const opacity = flash.addComponent(UIOpacity);
        flash.setScale(0.35, 0.35, 1);
        tween(flash)
            .to(0.08, { scale: new Vec3(1.05, 1.05, 1) })
            .to(0.08, { scale: new Vec3(1.28, 1.28, 1) })
            .start();
        tween(opacity)
            .set({ opacity: 255 })
            .to(0.16, { opacity: 0 })
            .call(() => flash.destroy())
            .start();
    }

    private playBurstRing(pos: Vec3) {
        if (!this.effectLayer) {
            return;
        }

        const ring = makeNode('BurstRing', this.effectLayer, pos.x, pos.y, 150, 150);
        const g = ring.addComponent(Graphics);
        g.strokeColor = color(255, 244, 118, 235);
        g.lineWidth = 7;
        g.circle(0, 0, 24);
        g.stroke();
        g.strokeColor = color(255, 255, 255, 190);
        g.lineWidth = 3;
        g.circle(0, 0, 38);
        g.stroke();

        const opacity = ring.addComponent(UIOpacity);
        ring.setScale(0.28, 0.28, 1);
        tween(ring)
            .to(0.22, { scale: new Vec3(1.24, 1.24, 1) })
            .start();
        tween(opacity)
            .set({ opacity: 255 })
            .to(0.24, { opacity: 0 })
            .call(() => ring.destroy())
            .start();
    }

    private playFloatingScore(pos: Vec3) {
        if (!this.effectLayer) {
            return;
        }

        const score = makeNode('FloatingScore', this.effectLayer, pos.x, pos.y + 6, 150, 54);
        const opacity = score.addComponent(UIOpacity);
        opacity.opacity = 0;
        addLabel(score, '+2', 34, color(255, 246, 128), 0, 0, 140, 48, true);
        score.setScale(0.72, 0.72, 1);
        tween(score)
            .to(0.08, { scale: new Vec3(1.14, 1.14, 1), position: new Vec3(pos.x, pos.y + 22, 0) })
            .to(0.2, { scale: new Vec3(1, 1, 1), position: new Vec3(pos.x, pos.y + 54, 0) })
            .delay(0.12)
            .call(() => score.destroy())
            .start();
        tween(opacity)
            .to(0.08, { opacity: 255 })
            .delay(0.2)
            .to(0.16, { opacity: 0 })
            .start();
    }

    private playRemoveEffect(tile: TileData) {
        if (!this.effectLayer) {
            return;
        }

        const pos = this.cellToPosition(tile.row, tile.col);
        for (let i = 0; i < 12; i++) {
            const size = i % 2 === 0 ? 24 : 16;
            const chip = makeNode(`Chip_${tile.id}_${i}`, this.effectLayer, pos.x, pos.y, size, size);
            const accent = DuiDuiMahjongTheme.accentColor(tile.type + i);
            drawRoundRect(chip, size, size, accent, color(255, 255, 255, 180), 2, 6);
            const opacity = chip.addComponent(UIOpacity);
            const tx = pos.x + randomRange(-128, 128);
            const ty = pos.y + randomRange(-128, 128);
            tween(chip)
                .to(0.32 + i * 0.012, { position: new Vec3(tx, ty, 0), scale: new Vec3(0.08, 0.08, 1), angle: randomRange(-260, 260) })
                .call(() => chip.destroy())
                .start();
            tween(opacity)
                .delay(0.12)
                .to(0.22, { opacity: 0 })
                .start();
        }
    }

    private completeLevel() {
        this.state = 'success';
        if (this.mode === 1 || this.mode === 2) {
            this.levelByMode[this.mode] = Math.min(this.levelByMode[this.mode] + 1, LEVELS[this.mode].length - 1);
            this.saveProgress();
        }
        this.scheduleOnce(() => this.showResult(true), 0.35);
    }

    private showResult(success: boolean) {
        if (!this.modalLayer) {
            return;
        }

        this.state = success ? 'success' : 'failed';
        this.modalLayer.active = true;
        destroyChildren(this.modalLayer);

        const blocker = makeNode('ModalBlocker', this.modalLayer, 0, 0, this.designW, this.designH);
        drawRoundRect(blocker, this.designW, this.designH, color(28, 42, 42, 164), color(14, 20, 24, 0), 0, 0);
        const blockerOpacity = blocker.addComponent(UIOpacity);
        blockerOpacity.opacity = 0;

        const panel = makeNode('ResultPanel', this.modalLayer, 0, 18, 560, 386);
        panel.setScale(0.72, 0.72, 1);
        const panelOpacity = panel.addComponent(UIOpacity);
        panelOpacity.opacity = 0;
        drawRoundRect(panel, 560, 386, color(255, 251, 229), success ? color(72, 169, 123) : color(218, 91, 76), 5, 34);
        const badge = makeNode('ResultBadge', panel, 0, 136, 238, 82);
        drawRoundRect(badge, 238, 82, success ? color(255, 214, 77) : color(255, 151, 91), color(255, 255, 255, 170), 4, 28);
        addLabel(badge, success ? '过关啦' : '时间到', 42, success ? color(42, 126, 87) : color(176, 57, 48), 0, 2, 210, 66, true);
        addLabel(panel, success ? '继续下一关，保持手感' : '牌局还没结束，再试一次', 26, color(76, 86, 78), 0, 62, 470, 46, true);
        addLabel(panel, success ? '第 ' + (this.levelByMode[this.mode] + 1) + ' 关' : `剩余 ${this.tiles.length} 张`, 24, success ? color(42, 140, 99) : color(204, 83, 66), 0, 20, 420, 42, true);

        const primary = makeNode('ResultPrimary', panel, 0, -70, 338, 76);
        drawRoundRect(primary, 338, 76, success ? color(50, 166, 112) : color(220, 84, 70), color(255, 255, 255, 156), 3, 28);
        addLabel(primary, success ? '下一关' : '重新开始', 30, color(255, 255, 255), 0, 0, 300, 64, true);
        this.bindPress(primary, () => {
            this.closeResultModal(panel, blockerOpacity, panelOpacity, () => this.startLevel(this.mode));
        });

        const home = makeNode('ResultHome', panel, 0, -158, 270, 60);
        drawRoundRect(home, 270, 60, color(82, 116, 178), color(255, 255, 255, 120), 2, 24);
        addLabel(home, '返回首页', 25, color(255, 255, 255), 0, 0, 238, 52, true);
        this.bindPress(home, () => {
            this.closeResultModal(panel, blockerOpacity, panelOpacity, () => this.showHome());
        });

        tween(blockerOpacity)
            .to(0.14, { opacity: 255 })
            .start();
        tween(panelOpacity)
            .delay(0.04)
            .to(0.1, { opacity: 255 })
            .start();
        tween(panel)
            .delay(0.04)
            .to(0.12, { scale: new Vec3(1.08, 1.08, 1) })
            .to(0.1, { scale: new Vec3(0.98, 0.98, 1) })
            .to(0.08, { scale: new Vec3(1, 1, 1) })
            .start();

        if (success) {
            this.scheduleOnce(() => this.playWinInterstitial(), 0.45);
        }
    }

    private async playWinInterstitial() {
        await this.adService.showInterstitial();
    }

    private showSettings() {
        if (!this.settingsLayer || this.settingsOpen) {
            return;
        }
        if (this.state === 'choosing') {
            this.clearChoiceLayer();
        }

        this.settingsOpen = true;
        this.applyDesignResolutionPolicy();
        this.settingsLayer.active = true;
        this.settingsLayer.setSiblingIndex(9999);
        this.applySettingsLayerFrame();
        destroyChildren(this.settingsLayer);

        const overlay = this.getAdaptiveOverlaySize();
        const blocker = makeNode('SettingsBlocker', this.settingsLayer, 0, 0, overlay.width, overlay.height);
        drawRoundRect(blocker, overlay.width, overlay.height, color(25, 36, 38, 154), color(0, 0, 0, 0), 0, 0);
        const blockerOpacity = blocker.addComponent(UIOpacity);
        blockerOpacity.opacity = 0;
        this.blockSettingsBackdropInput(blocker);

        const panel = makeNode('SettingsPanel', this.settingsLayer, 0, 24, 600, 560);
        panel.setScale(0.78, 0.78, 1);
        const panelOpacity = panel.addComponent(UIOpacity);
        panelOpacity.opacity = 0;
        drawRoundRect(panel, 600, 560, color(255, 252, 232), color(62, 159, 127), 5, 34);

        const titleBadge = makeNode('SettingsTitleBadge', panel, 0, 216, 244, 78);
        drawRoundRect(titleBadge, 244, 78, color(255, 218, 80), color(255, 255, 255, 168), 4, 28);
        addLabel(titleBadge, '游戏设置', 38, color(64, 116, 91), 0, 2, 210, 58, true);

        const close = makeNode('SettingsClose', panel, 238, 218, 66, 66);
        drawRoundRect(close, 66, 66, color(224, 86, 74), color(255, 255, 255, 150), 3, 24);
        addLabel(close, '×', 38, color(255, 255, 255), 0, 1, 50, 50, true);
        this.bindPress(close, () => this.hideSettings());

        this.makeSettingSwitch(panel, '背景音乐', 114, this.settings.music, () => {
            this.settings.music = !this.settings.music;
            this.saveSettings();
            this.syncBackgroundMusic();
            this.refreshSettingsRows(panel);
        });
        this.makeSettingSwitch(panel, '音效反馈', 12, this.settings.sound, () => {
            this.settings.sound = !this.settings.sound;
            this.saveSettings();
            this.refreshSettingsRows(panel);
        });
        this.makeSettingSwitch(panel, '震动提示', -90, this.settings.vibration, () => {
            this.settings.vibration = !this.settings.vibration;
            this.saveSettings();
            this.refreshSettingsRows(panel);
        });
        this.makeSettingSwitch(panel, '新手提示', -192, this.settings.autoHint, () => {
            this.settings.autoHint = !this.settings.autoHint;
            this.saveSettings();
            this.refreshSettingsRows(panel);
        });

        tween(blockerOpacity)
            .to(0.12, { opacity: 255 })
            .start();
        tween(panelOpacity)
            .delay(0.04)
            .to(0.1, { opacity: 255 })
            .start();
        tween(panel)
            .delay(0.04)
            .to(0.12, { scale: new Vec3(1.06, 1.06, 1) })
            .to(0.08, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    private getAdaptiveOverlaySize() {
        const visibleSize = view.getVisibleSize();
        return {
            width: visibleSize.width,
            height: visibleSize.height,
        };
    }

    private applySettingsLayerFrame() {
        if (!this.settingsLayer) {
            return;
        }

        const overlay = this.getAdaptiveOverlaySize();
        const transform = this.settingsLayer.getComponent(UITransform) || this.settingsLayer.addComponent(UITransform);
        transform.setContentSize(overlay.width, overlay.height);
    }

    private blockSettingsBackdropInput(blocker: Node) {
        blocker.on(Input.EventType.TOUCH_START, this.stopSettingsBackdropEvent, this);
        blocker.on(Input.EventType.TOUCH_MOVE, this.stopSettingsBackdropEvent, this);
        blocker.on(Input.EventType.TOUCH_END, this.stopSettingsBackdropEvent, this);
        blocker.on(Input.EventType.TOUCH_CANCEL, this.stopSettingsBackdropEvent, this);
        blocker.on(Input.EventType.MOUSE_DOWN, this.stopSettingsBackdropEvent, this);
        blocker.on(Input.EventType.MOUSE_UP, this.stopSettingsBackdropEvent, this);
    }

    private stopSettingsBackdropEvent(event?: EventTouch | EventMouse) {
        if (!event) {
            return;
        }

        event.preventSwallow = false;
        if (typeof event.stopPropagation === 'function') {
            event.stopPropagation();
        }
    }

    private makeSettingSwitch(parent: Node, title: string, y: number, enabled: boolean, callback: () => void) {
        const row = makeNode(`Setting_${title}`, parent, 0, y, 516, 78);
        drawRoundRect(row, 516, 78, color(255, 255, 247, 232), enabled ? color(66, 164, 124) : color(150, 156, 152), 3, 26);
        addLabel(row, title, 29, enabled ? color(48, 137, 101) : color(104, 112, 108), -128, 0, 220, 44, true);

        const track = makeNode(`${row.name}_Track`, row, 190, 0, 108, 48);
        drawRoundRect(track, 108, 48, enabled ? color(62, 174, 123) : color(168, 174, 170), color(255, 255, 255, 152), 2, 22);
        const knob = makeNode(`${row.name}_Knob`, track, enabled ? 28 : -28, 0, 42, 42);
        drawRoundRect(knob, 42, 42, color(255, 255, 255), enabled ? color(52, 142, 103) : color(138, 144, 140), 2, 20);
        addLabel(track, enabled ? '开' : '关', 18, color(255, 255, 255), enabled ? -24 : 24, 0, 42, 32, true);
        this.bindPress(row, callback);
    }

    private refreshSettingsRows(panel: Node) {
        const rows = [
            ['Setting_背景音乐', this.settings.music],
            ['Setting_音效反馈', this.settings.sound],
            ['Setting_震动提示', this.settings.vibration],
            ['Setting_新手提示', this.settings.autoHint],
        ] as const;

        for (const [name, enabled] of rows) {
            const row = findNodeDeep(panel, name);
            if (!row) {
                continue;
            }

            const title = row.name.replace('Setting_', '');
            const y = row.getPosition().y;
            row.destroy();
            this.makeSettingSwitch(panel, title, y, enabled, () => {
                this.toggleSetting(title, panel);
            });
        }
    }

    private toggleSetting(title: string, panel: Node) {
        if (title === '背景音乐') {
            this.settings.music = !this.settings.music;
            this.syncBackgroundMusic();
        } else if (title === '音效反馈') {
            this.settings.sound = !this.settings.sound;
        } else if (title === '震动提示') {
            this.settings.vibration = !this.settings.vibration;
        } else if (title === '新手提示') {
            this.settings.autoHint = !this.settings.autoHint;
        }
        this.saveSettings();
        this.refreshSettingsRows(panel);
    }

    private hideSettings(done?: () => void) {
        if (!this.settingsLayer || !this.settingsOpen) {
            if (done) {
                done();
            }
            return;
        }

        const layer = this.settingsLayer;
        const panel = findNodeDeep(layer, 'SettingsPanel');
        const blocker = findNodeDeep(layer, 'SettingsBlocker');
        const panelOpacity = panel ? panel.getComponent(UIOpacity) : null;
        const blockerOpacity = blocker ? blocker.getComponent(UIOpacity) : null;

        const finish = () => {
            destroyChildren(layer);
            layer.active = false;
            this.settingsOpen = false;
            if (done) {
                done();
            }
        };

        if (!panel || !panelOpacity || !blockerOpacity) {
            finish();
            return;
        }

        Tween.stopAllByTarget(panel);
        Tween.stopAllByTarget(panelOpacity);
        Tween.stopAllByTarget(blockerOpacity);
        tween(blockerOpacity)
            .to(0.1, { opacity: 0 })
            .start();
        tween(panelOpacity)
            .to(0.08, { opacity: 0 })
            .start();
        tween(panel)
            .to(0.1, { scale: new Vec3(0.82, 0.82, 1) })
            .call(finish)
            .start();
    }

    private closeResultModal(panel: Node, blockerOpacity: UIOpacity, panelOpacity: UIOpacity, done: () => void) {
        Tween.stopAllByTarget(panel);
        Tween.stopAllByTarget(blockerOpacity);
        Tween.stopAllByTarget(panelOpacity);

        tween(blockerOpacity)
            .to(0.12, { opacity: 0 })
            .start();
        tween(panelOpacity)
            .to(0.1, { opacity: 0 })
            .start();
        tween(panel)
            .to(0.1, { scale: new Vec3(0.82, 0.82, 1) })
            .call(() => {
                if (this.modalLayer) {
                    this.modalLayer.active = false;
                }
                done();
            })
            .start();
    }

    private restartCurrent() {
        if (this.state === 'choosing') {
            this.clearChoiceLayer();
        }
        this.startLevel(this.mode);
    }

    private useHintProp() {
        if (this.state !== 'playing') {
            return;
        }

        this.runRewardedProp('提示', () => {
            this.showHint(false);
        });
    }

    private undo() {
        if (this.undoStack.length === 0 || this.state !== 'playing') {
            this.showToast('没有可撤回的步骤');
            return;
        }

        this.runRewardedProp('撤回', () => {
            const snapshot = this.undoStack.pop();
            if (snapshot) {
                this.restoreSnapshot(snapshot, true);
                this.showToast('已撤回');
            }
        });
    }

    private useShuffleProp() {
        if (this.state === 'choosing') {
            this.clearChoiceLayer();
        }
        if (this.state !== 'playing') {
            return;
        }
        if (this.tiles.length < 2) {
            this.showToast('当前不需要道具');
            return;
        }

        this.runRewardedProp('洗牌', () => {
            this.hideHint();
            this.shuffleBoard(true);
            this.showToast('已使用洗牌道具');
        });
    }

    private async runRewardedProp(name: string, granted: () => void) {
        if (this.adRequesting) {
            this.showToast('广告加载中，请稍等');
            return;
        }

        this.adRequesting = true;
        this.showToast(`${name}道具需要观看广告`);
        const result = await this.adService.showRewardedVideo(name);
        this.adRequesting = false;
        if (!result.rewarded) {
            this.showToast(result.message);
            return;
        }

        granted();
    }

    private pushUndo(snapshot = this.captureSnapshot()) {
        this.undoStack.push(snapshot);
        if (this.undoStack.length > 12) {
            this.undoStack.shift();
        }
    }

    private pushUndoIfNeeded() {
        if (this.dragSnapshot) {
            this.pushUndo(this.dragSnapshot);
            this.dragSnapshot = null;
        } else {
            this.pushUndo();
        }
    }

    private captureSnapshot(): BoardSnapshot {
        return this.boardModel.captureSnapshot(this.mode, this.levelByMode[this.mode], this.timeLeft, this.tiles);
    }

    private restoreSnapshot(snapshot: BoardSnapshot, animate: boolean) {
        if (!this.boardLayer) {
            return;
        }

        for (const tile of this.tiles) {
            tile.node.destroy();
        }
        this.tiles = [];
        this.nextTileId = 1;
        this.mode = snapshot.mode;
        this.levelByMode[this.mode] = snapshot.level;
        this.level = LEVELS[this.mode][snapshot.level];
        this.grid = this.boardModel.createGrid(this.level);
        this.timeLeft = snapshot.timeLeft;
        this.state = 'playing';
        this.layoutBoard();

        for (const saved of snapshot.tiles) {
            this.nextTileId = Math.max(this.nextTileId, saved.id + 1);
            const node = makeNode(`Tile_${saved.id}`, this.boardLayer, 0, 0, this.tileW, this.tileH);
            const tile: TileData = {
                id: saved.id,
                type: saved.type,
                row: saved.row,
                col: saved.col,
                node,
            };
            const pos = this.cellToPosition(tile.row, tile.col);
            node.setPosition(animate ? new Vec3(pos.x, pos.y + 18, 0) : pos);
            this.grid[tile.row][tile.col] = tile;
            this.tiles.push(tile);
            this.drawTile(tile, false);
            this.bindTileEvents(tile);
            if (animate) {
                tween(node).to(0.12, { position: pos }).start();
            }
        }

        this.refreshHud();
    }

    private shuffleBoard(saveUndo = true) {
        if (saveUndo) {
            this.pushUndo();
        }

        const positions: Vec2[] = [];
        for (let row = 0; row < this.level.rows; row++) {
            for (let col = 0; col < this.level.cols; col++) {
                if (this.grid[row][col]) {
                    positions.push(new Vec2(row, col));
                }
            }
        }
        shuffle(positions);

        for (let row = 0; row < this.level.rows; row++) {
            for (let col = 0; col < this.level.cols; col++) {
                this.grid[row][col] = null;
            }
        }

        this.tiles.forEach((tile, index) => {
            const pos = positions[index];
            tile.row = pos.x;
            tile.col = pos.y;
            this.grid[tile.row][tile.col] = tile;
            this.animateTileToCell(tile);
        });

        this.ensureDirectPair();
        this.refreshHud();
    }

    private ensureDirectPair() {
        const changed = this.boardModel.ensureDirectPair(this.level, this.grid, this.tiles);
        if (!changed) {
            return;
        }

        for (const tile of this.tiles) {
            this.drawTile(tile, false);
            this.animateTileToCell(tile);
        }
    }

    private findSameTypePair(): [TileData, TileData] | null {
        return this.boardModel.findSameTypePair(this.tiles);
    }

    private showHint(auto: boolean) {
        if (this.state !== 'playing') {
            return;
        }

        this.hideHint();
        const pair = this.findAnyDirectPair();
        if (pair) {
            this.drawTile(pair[0], true);
            this.drawTile(pair[1], true);
            this.createArrow(pair[0], pair[1]);
            this.showToast(auto ? '这两张可以直接对上' : '找到一对');
            this.scheduleOnce(() => this.hideHint(), 2.2);
            return;
        }

        const move = this.findAnyUsefulSlide();
        if (move) {
            this.drawTile(move.tile, true);
            this.createMoveHint(move.tile, move.dir);
            this.showToast(`把亮起的牌${directionLabel(move.dir)}`);
            this.scheduleOnce(() => this.hideHint(), 2.2);
            return;
        }

        this.showUsePropPrompt('没有可消除走法，使用洗牌道具');
    }

    private showUsePropPrompt(text = '使用洗牌道具试试') {
        this.showToast(text);
        const shuffleButton = this.gameRoot ? findNodeDeep(this.gameRoot, 'btn_shuffle') : null;
        if (!shuffleButton) {
            return;
        }

        Tween.stopAllByTarget(shuffleButton);
        shuffleButton.setScale(1, 1, 1);
        tween(shuffleButton)
            .to(0.08, { scale: new Vec3(1.12, 1.12, 1), angle: -5 })
            .to(0.08, { scale: new Vec3(1.06, 1.06, 1), angle: 5 })
            .to(0.08, { scale: new Vec3(1, 1, 1), angle: 0 })
            .union()
            .repeat(2)
            .start();
    }

    private hideHint() {
        let removedHint = false;
        if (this.effectLayer) {
            for (const child of [...this.effectLayer.children]) {
                if (child.name.startsWith('Hint')) {
                    child.destroy();
                    removedHint = true;
                }
            }
        }
        if (!removedHint) {
            return;
        }
        for (const tile of this.tiles) {
            this.drawTile(tile, false);
        }
    }

    private createArrow(first: TileData, second: TileData) {
        if (!this.effectLayer) {
            return;
        }

        [first, second].forEach((tile, index) => {
            const pos = this.cellToPosition(tile.row, tile.col);
            const pulse = makeNode(`HintPulse_${tile.id}`, this.effectLayer, pos.x, pos.y, this.tileW + 18, this.tileH + 18);
            const opacity = pulse.addComponent(UIOpacity);
            opacity.opacity = 0;
            drawRoundRect(pulse, this.tileW + 18, this.tileH + 18, color(255, 230, 86, 76), color(255, 248, 125), 4, 8);
            pulse.setScale(0.7, 0.7, 1);
            tween(pulse)
                .delay(index * 0.05)
                .to(0.14, { scale: new Vec3(1.14, 1.14, 1) })
                .to(0.2, { scale: new Vec3(1, 1, 1) })
                .union()
                .repeat(4)
                .start();
            tween(opacity)
                .delay(index * 0.05)
                .to(0.12, { opacity: 255 })
                .delay(1.25)
                .to(0.18, { opacity: 0 })
                .call(() => pulse.destroy())
                .start();
        });
    }

    private createMoveHint(tile: TileData, dir: Direction) {
        if (!this.effectLayer) {
            return;
        }

        const pos = this.cellToPosition(tile.row, tile.col);
        const vector = directionVector(dir);
        const hint = makeNode(`HintMove_${tile.id}`, this.effectLayer, pos.x, pos.y, this.tileW + 108, this.tileH + 72);
        const opacity = hint.addComponent(UIOpacity);
        opacity.opacity = 0;

        drawRoundRect(hint, this.tileW + 18, this.tileH + 18, color(255, 230, 86, 72), color(255, 248, 125), 4, 8);
        const badge = makeNode(`HintMoveBadge_${tile.id}`, hint, vector.x * (this.tileW * 0.62), vector.y * (this.tileH * 0.62), 108, 46);
        drawRoundRect(badge, 108, 46, color(255, 114, 86, 238), color(255, 255, 255, 170), 3, 18);
        addLabel(badge, directionLabel(dir), 22, color(255, 255, 255), 0, 0, 94, 38, true);

        hint.setScale(0.74, 0.74, 1);
        tween(hint)
            .to(0.12, { scale: new Vec3(1.12, 1.12, 1) })
            .to(0.12, { scale: new Vec3(1, 1, 1) })
            .union()
            .repeat(4)
            .start();
        tween(opacity)
            .to(0.12, { opacity: 255 })
            .delay(1.45)
            .to(0.2, { opacity: 0 })
            .call(() => hint.destroy())
            .start();

        const origin = this.cellToPosition(tile.row, tile.col);
        Tween.stopAllByTarget(tile.node);
        tween(tile.node)
            .to(0.1, { position: new Vec3(origin.x + vector.x * 14, origin.y + vector.y * 14, 0), scale: new Vec3(1.06, 1.06, 1) })
            .to(0.1, { position: origin, scale: new Vec3(1, 1, 1) })
            .union()
            .repeat(4)
            .start();
    }

    private findAnyUsefulSlide(): { tile: TileData; dir: Direction } | null {
        return this.boardModel.findAnyUsefulSlide(this.level, this.grid, this.tiles);
    }

    private findAnyDirectPair(): [TileData, TileData] | null {
        return this.boardModel.findAnyDirectPair(this.tiles, this.grid);
    }

    private findClearMatches(tile: TileData): TileData[] {
        return this.boardModel.findClearMatches(tile, this.tiles, this.grid);
    }

    private animateTileToCell(tile: TileData) {
        const target = this.cellToPosition(tile.row, tile.col);
        tween(tile.node).to(0.14, { position: target }).start();
    }

    private cellToPosition(row: number, col: number): Vec3 {
        const x = -this.boardW / 2 + this.gap + this.tileW / 2 + col * (this.tileW + this.gap);
        const y = -this.boardH / 2 + this.gap + this.tileH / 2 + row * (this.tileH + this.gap);
        return new Vec3(x, y, 0);
    }

    private isInside(row: number, col: number): boolean {
        return row >= 0 && row < this.level.rows && col >= 0 && col < this.level.cols;
    }

    private refreshHud() {
        if (this.levelLabel) {
            this.levelLabel.string = this.mode === 0 ? '新手教学' : `第 ${this.levelByMode[this.mode] + 1} 关`;
        }
        if (this.timeLabel) {
            this.timeLabel.string = this.level.time > 0 ? `${Math.ceil(this.timeLeft)}秒` : '不限时';
        }
        if (this.remainLabel) {
            this.remainLabel.string = `剩 ${this.tiles.length}`;
        }
    }

    private showToast(text: string) {
        if (!this.toastNode || !this.toastLabel) {
            return;
        }

        this.toastLabel.string = text;
        this.toastNode.active = true;
        const opacity = this.toastNode.getComponent(UIOpacity);
        if (!opacity) {
            return;
        }
        tween(opacity)
            .set({ opacity: 0 })
            .to(0.12, { opacity: 255 })
            .delay(1.2)
            .to(0.18, { opacity: 0 })
            .call(() => {
                if (this.toastNode) {
                    this.toastNode.active = false;
                }
            })
            .start();
    }

    private shakeTile(tile: TileData) {
        const origin = tile.node.getPosition().clone();
        tween(tile.node)
            .to(0.04, { position: new Vec3(origin.x + 8, origin.y, 0) })
            .to(0.04, { position: new Vec3(origin.x - 8, origin.y, 0) })
            .to(0.04, { position: origin })
            .start();
    }

    private bindPress(node: Node, callback: () => void, animated = true) {
        const base = node.getScale().clone();
        if (animated) {
            node.on(Input.EventType.TOUCH_START, () => {
                Tween.stopAllByTarget(node);
                tween(node)
                    .to(0.06, { scale: new Vec3(base.x * 0.92, base.y * 0.92, base.z) })
                    .start();
            }, this);
            node.on(Input.EventType.TOUCH_CANCEL, () => {
                Tween.stopAllByTarget(node);
                tween(node)
                    .to(0.08, { scale: base })
                    .start();
            }, this);
        }
        node.on(Input.EventType.TOUCH_END, () => {
            if (animated) {
                Tween.stopAllByTarget(node);
                tween(node)
                    .to(0.08, { scale: new Vec3(base.x * 1.04, base.y * 1.04, base.z) })
                    .to(0.08, { scale: base })
                    .start();
            }
            this.playTapFeedback();
            callback();
        }, this);
    }

    private playTapFeedback() {
        this.audioUserGestureReceived = true;
        this.syncBackgroundMusic();
        this.playClickSound();

        if (!this.settings.sound && !this.settings.vibration) {
            return;
        }

        if (this.settings.vibration) {
            const platformSys = sys as unknown as { vibrate?: (duration?: number) => void };
            if (platformSys.vibrate) {
                platformSys.vibrate(20);
            }
        }
    }

    private clearGameNodes() {
        if (this.loadingRoot) {
            this.loadingRoot.destroy();
            this.loadingRoot = null;
        }
        this.loadingProgressFill = null;
        if (this.homeRoot) {
            this.homeRoot.destroy();
            this.homeRoot = null;
        }
        if (this.gameRoot) {
            this.gameRoot.destroy();
            this.gameRoot = null;
        }
        this.boardPanel = null;
        this.boardLayer = null;
        this.effectLayer = null;
        this.choiceLayer = null;
        this.modalLayer = null;
        this.tiles = [];
        this.grid = [];
        this.activeTile = null;
        this.selectedTile = null;
        this.dragPlan = null;
        this.dragSnapshot = null;
        this.choosingTile = null;
        this.sameTypeHintTiles = [];
    }

    private loadProgress() {
        for (let mode = 1; mode < LEVELS.length; mode++) {
            const saved = Number(sys.localStorage.getItem(`duidui_progress_${mode}`));
            if (!Number.isNaN(saved)) {
                this.levelByMode[mode] = clampInt(saved, 0, LEVELS[mode].length - 1);
            }
        }
    }

    private saveProgress() {
        sys.localStorage.setItem(`duidui_progress_${this.mode}`, String(this.levelByMode[this.mode]));
    }

    private loadSettings() {
        const saved = sys.localStorage.getItem('duidui_settings');
        if (!saved) {
            return;
        }

        try {
            const parsed = JSON.parse(saved) as Partial<GameSettings>;
            this.settings = {
                music: parsed.music !== false,
                sound: parsed.sound !== false,
                vibration: parsed.vibration !== false,
                autoHint: parsed.autoHint !== false,
            };
        } catch {
            this.settings = {
                music: true,
                sound: true,
                vibration: true,
                autoHint: true,
            };
        }
    }

    private saveSettings() {
        sys.localStorage.setItem('duidui_settings', JSON.stringify(this.settings));
    }
}

function makeNode(name: string, parent: Node | null, x: number, y: number, w: number, h: number): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(w, h);
    node.setPosition(x, y, 0);
    if (parent) {
        parent.addChild(node);
    }
    return node;
}

function setSize(node: Node | null, w: number, h: number) {
    if (!node) {
        return;
    }
    const transform = node.getComponent(UITransform) || node.addComponent(UITransform);
    transform.setContentSize(w, h);
}

function drawRoundRect(node: Node, w: number, h: number, fill: Color, stroke?: Color, lineWidth = 0, radius = 8) {
    const graphics = node.getComponent(Graphics) || node.addComponent(Graphics);
    graphics.clear();
    graphics.fillColor = fill;
    graphics.roundRect(-w / 2, -h / 2, w, h, radius);
    graphics.fill();
    if (stroke && lineWidth > 0) {
        graphics.lineWidth = lineWidth;
        graphics.strokeColor = stroke;
        graphics.roundRect(-w / 2 + lineWidth / 2, -h / 2 + lineWidth / 2, w - lineWidth, h - lineWidth, radius);
        graphics.stroke();
    }
}

function addLabel(parent: Node, text: string, fontSize: number, textColor: Color, x: number, y: number, w: number, h: number, outline = false): Label {
    const node = makeNode(`${parent.name}_Label`, parent, x, y, w, h);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.round(fontSize * 1.12);
    label.color = textColor;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    label.enableWrapText = false;
    if (outline) {
        const labelOutline = node.addComponent(LabelOutline);
        labelOutline.color = color(73, 43, 26, 150);
        labelOutline.width = Math.max(1, Math.floor(fontSize / 16));
    }
    return label;
}

function destroyChildren(node: Node) {
    for (const child of [...node.children]) {
        child.destroy();
    }
}

function findNodeDeep(root: Node, name: string): Node | null {
    if (root.name === name) {
        return root;
    }

    for (const child of root.children) {
        const found = findNodeDeep(child, name);
        if (found) {
            return found;
        }
    }

    return null;
}

function color(r: number, g: number, b: number, a = 255): Color {
    return new Color(r, g, b, a);
}

function randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

function directionVector(dir: Direction): Vec2 {
    if (dir === 'left') {
        return new Vec2(-1, 0);
    }
    if (dir === 'right') {
        return new Vec2(1, 0);
    }
    if (dir === 'up') {
        return new Vec2(0, 1);
    }
    return new Vec2(0, -1);
}

function directionLabel(dir: Direction): string {
    if (dir === 'left') {
        return '向左';
    }
    if (dir === 'right') {
        return '向右';
    }
    if (dir === 'up') {
        return '向上';
    }
    return '向下';
}

function modeTitle(mode: number): string {
    if (mode === 0) {
        return '新手教学';
    }
    if (mode === 2) {
        return '地狱模式';
    }
    return '挑战模式';
}

function shuffle<T>(items: T[]) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = items[i];
        items[i] = items[j];
        items[j] = temp;
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function clampInt(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.floor(value)));
}
