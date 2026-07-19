export type DuiDuiAdPlatform = 'wechat' | 'douyin' | 'web';

export interface DuiDuiPlatformAdConfig {
    rewardedVideoAdUnitId: string;
    interstitialAdUnitId: string;
    bannerAdUnitId: string;
}

// Replace these placeholders with the ad unit IDs created in each platform console
// before submitting the WeChat/Douyin commercial build.
export const DUIDUI_AD_CONFIG: Record<DuiDuiAdPlatform, DuiDuiPlatformAdConfig> = {
    wechat: {
        rewardedVideoAdUnitId: 'REPLACE_WITH_WECHAT_REWARDED_VIDEO_AD_UNIT_ID',
        interstitialAdUnitId: 'REPLACE_WITH_WECHAT_INTERSTITIAL_AD_UNIT_ID',
        bannerAdUnitId: 'REPLACE_WITH_WECHAT_BANNER_AD_UNIT_ID',
    },
    douyin: {
        rewardedVideoAdUnitId: 'REPLACE_WITH_DOUYIN_REWARDED_VIDEO_AD_UNIT_ID',
        interstitialAdUnitId: 'REPLACE_WITH_DOUYIN_INTERSTITIAL_AD_UNIT_ID',
        bannerAdUnitId: 'REPLACE_WITH_DOUYIN_BANNER_AD_UNIT_ID',
    },
    web: {
        rewardedVideoAdUnitId: '',
        interstitialAdUnitId: '',
        bannerAdUnitId: '',
    },
};

export const DUIDUI_AD_POLICY = {
    // Douyin and WeChat reject early/frequent interstitial requests; keeping this
    // in code makes victory ads polite instead of spamming platform errors.
    interstitialStartupDelayMs: 30000,
    interstitialCooldownMs: 60000,
    allowPreviewRewardFallback: true,
};
