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

type MiniGameApi = {
    createRewardedVideoAd?: (options: { adUnitId: string }) => MiniGameAd;
    createInterstitialAd?: (options: { adUnitId: string }) => MiniGameAd;
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
    if (globalApi.tt?.createRewardedVideoAd || globalApi.tt?.createInterstitialAd) {
        return 'douyin';
    }
    if (globalApi.wx?.createRewardedVideoAd || globalApi.wx?.createInterstitialAd) {
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
