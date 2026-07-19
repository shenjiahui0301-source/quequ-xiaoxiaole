import { sys } from 'cc';
import { DUIDUI_AD_CONFIG, DUIDUI_AD_POLICY, DuiDuiAdPlatform, DuiDuiPlatformAdConfig } from './DuiDuiAdConfig';

type MiniGameAd = {
    show: () => Promise<void> | void;
    load?: () => Promise<void> | void;
    onClose?: (callback: (result?: { isEnded?: boolean }) => void) => void;
    offClose?: (callback: (result?: { isEnded?: boolean }) => void) => void;
    onError?: (callback: (error: unknown) => void) => void;
    offError?: (callback: (error: unknown) => void) => void;
};

type MiniGameBannerSize = {
    width: number;
    height: number;
};

type MiniGameBannerAd = {
    style: {
        left?: number;
        top?: number;
        width: number;
    };
    show: () => Promise<void> | void;
    onResize?: (callback: (size: MiniGameBannerSize) => void) => void;
    offResize?: (callback: (size: MiniGameBannerSize) => void) => void;
    onError?: (callback: (error: unknown) => void) => void;
    offError?: (callback: (error: unknown) => void) => void;
    destroy?: () => void;
};

type MiniGameApi = {
    createRewardedVideoAd?: (options: { adUnitId: string }) => MiniGameAd;
    createInterstitialAd?: (options: { adUnitId: string }) => MiniGameAd;
    createBannerAd?: (options: {
        adUnitId: string;
        style: { left?: number; top?: number; width: number };
    }) => MiniGameBannerAd;
    getSystemInfoSync?: () => { windowWidth: number; windowHeight: number };
};

export interface DuiDuiRewardResult {
    rewarded: boolean;
    message: string;
}

export class DuiDuiAdService {
    private readonly platform: DuiDuiAdPlatform;
    private readonly api: MiniGameApi | null;
    private readonly config: DuiDuiPlatformAdConfig;
    private rewardedVideoAd: MiniGameAd | null = null;
    private interstitialAd: MiniGameAd | null = null;
    private bannerAd: MiniGameBannerAd | null = null;
    private bannerResizeCallback: ((size: MiniGameBannerSize) => void) | null = null;
    private bannerErrorCallback: ((error: unknown) => void) | null = null;
    private readonly bootTime = Date.now();
    private lastInterstitialTime = 0;

    constructor(platform = detectAdPlatform(), api = resolveMiniGameApi(platform)) {
        this.platform = platform;
        this.api = api;
        this.config = DUIDUI_AD_CONFIG[platform];
    }

    getPlatform(): DuiDuiAdPlatform {
        return this.platform;
    }

    isRewardedAvailable(): boolean {
        if (this.platform === 'web') {
            return DUIDUI_AD_POLICY.allowPreviewRewardFallback;
        }
        return !!this.api?.createRewardedVideoAd && isConfigured(this.config.rewardedVideoAdUnitId);
    }

    async showRewardedVideo(reason: string): Promise<DuiDuiRewardResult> {
        if (this.platform === 'web') {
            return {
                rewarded: DUIDUI_AD_POLICY.allowPreviewRewardFallback,
                message: DUIDUI_AD_POLICY.allowPreviewRewardFallback ? '预览环境已模拟广告奖励' : '当前平台没有激励视频',
            };
        }
        if (!this.api?.createRewardedVideoAd || !isConfigured(this.config.rewardedVideoAdUnitId)) {
            return { rewarded: false, message: `${reason}需要先配置激励视频广告位` };
        }

        const ad = this.getRewardedVideoAd();
        return new Promise((resolve) => {
            let settled = false;
            const cleanup = () => {
                if (ad.offClose) {
                    ad.offClose(onClose);
                }
                if (ad.offError) {
                    ad.offError(onError);
                }
            };
            const finish = (result: DuiDuiRewardResult) => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                resolve(result);
            };
            const onClose = (result?: { isEnded?: boolean }) => {
                const rewarded = result ? result.isEnded !== false : true;
                finish({ rewarded, message: rewarded ? '广告观看完成' : '看完广告才能使用道具' });
            };
            const onError = () => {
                finish({ rewarded: false, message: '广告暂时不可用，请稍后再试' });
            };

            ad.onClose?.(onClose);
            ad.onError?.(onError);
            Promise.resolve(ad.show())
                .catch(() => Promise.resolve(ad.load?.()).then(() => ad.show()))
                .catch(onError);
        });
    }

    async showInterstitial(): Promise<boolean> {
        if (!this.api?.createInterstitialAd || !isConfigured(this.config.interstitialAdUnitId)) {
            return false;
        }

        const now = Date.now();
        if (now - this.bootTime < DUIDUI_AD_POLICY.interstitialStartupDelayMs) {
            return false;
        }
        if (now - this.lastInterstitialTime < DUIDUI_AD_POLICY.interstitialCooldownMs) {
            return false;
        }

        this.lastInterstitialTime = now;
        const ad = this.getInterstitialAd();
        try {
            await Promise.resolve(ad.show());
            return true;
        } catch {
            try {
                await Promise.resolve(ad.load?.());
                await Promise.resolve(ad.show());
                return true;
            } catch {
                return false;
            }
        }
    }

    async showBanner(): Promise<boolean> {
        if (!this.api?.createBannerAd || !this.api.getSystemInfoSync || !isConfigured(this.config.bannerAdUnitId)) {
            return false;
        }

        try {
            if (!this.bannerAd) {
                const { windowWidth, windowHeight } = this.api.getSystemInfoSync();
                this.bannerAd = this.api.createBannerAd({
                    adUnitId: this.config.bannerAdUnitId,
                    style: {
                        left: 0,
                        top: windowHeight,
                        width: windowWidth,
                    },
                });
                this.bannerResizeCallback = (size: MiniGameBannerSize) => {
                    if (!this.bannerAd) {
                        return;
                    }
                    this.bannerAd.style.left = (windowWidth - size.width) / 2;
                    this.bannerAd.style.top = windowHeight - size.height;
                };
                this.bannerErrorCallback = () => undefined;
                this.bannerAd.onResize?.(this.bannerResizeCallback);
                this.bannerAd.onError?.(this.bannerErrorCallback);
            }

            await Promise.resolve(this.bannerAd.show());
            return true;
        } catch {
            return false;
        }
    }

    destroyBanner(): void {
        if (!this.bannerAd) {
            return;
        }
        if (this.bannerResizeCallback) {
            this.bannerAd.offResize?.(this.bannerResizeCallback);
        }
        if (this.bannerErrorCallback) {
            this.bannerAd.offError?.(this.bannerErrorCallback);
        }
        this.bannerAd.destroy?.();
        this.bannerAd = null;
        this.bannerResizeCallback = null;
        this.bannerErrorCallback = null;
    }

    private getRewardedVideoAd(): MiniGameAd {
        if (!this.rewardedVideoAd) {
            this.rewardedVideoAd = this.api!.createRewardedVideoAd!({
                adUnitId: this.config.rewardedVideoAdUnitId,
            });
        }
        return this.rewardedVideoAd;
    }

    private getInterstitialAd(): MiniGameAd {
        if (!this.interstitialAd) {
            this.interstitialAd = this.api!.createInterstitialAd!({
                adUnitId: this.config.interstitialAdUnitId,
            });
        }
        return this.interstitialAd;
    }
}

function detectAdPlatform(): DuiDuiAdPlatform {
    if (sys.platform === sys.Platform.WECHAT_GAME) {
        return 'wechat';
    }

    const globalApi = globalThis as { tt?: MiniGameApi; wx?: MiniGameApi };
    if (globalApi.tt?.createRewardedVideoAd || globalApi.tt?.createInterstitialAd || globalApi.tt?.createBannerAd) {
        return 'douyin';
    }
    if (globalApi.wx?.createRewardedVideoAd || globalApi.wx?.createInterstitialAd || globalApi.wx?.createBannerAd) {
        return 'wechat';
    }
    return 'web';
}

function resolveMiniGameApi(platform: DuiDuiAdPlatform): MiniGameApi | null {
    const globalApi = globalThis as { tt?: MiniGameApi; wx?: MiniGameApi };
    if (platform === 'douyin') {
        return globalApi.tt || null;
    }
    if (platform === 'wechat') {
        return globalApi.wx || null;
    }
    return null;
}

function isConfigured(adUnitId: string): boolean {
    return !!adUnitId && !adUnitId.startsWith('REPLACE_WITH_');
}
