import { sys } from 'cc';
import { DuiDuiAdPlatform } from './DuiDuiAdConfig';

export type DuiDuiSidebarLaunchOptions = {
    scene?: string | number;
    query?: Record<string, string | undefined>;
    launch_from?: string;
    location?: string;
};

type DouyinSceneResult = {
    isExist?: boolean;
};

type DouyinSidebarApi = {
    checkScene?: (options: {
        scene: 'sidebar';
        success?: (result: DouyinSceneResult) => void;
        fail?: (error: unknown) => void;
    }) => void;
    navigateToScene?: (options: {
        scene: 'sidebar';
        success?: () => void;
        fail?: (error: unknown) => void;
    }) => void;
    onShow?: (callback: (options: DuiDuiSidebarLaunchOptions) => void) => void;
    offShow?: (callback: (options: DuiDuiSidebarLaunchOptions) => void) => void;
    getLaunchOptionsSync?: () => DuiDuiSidebarLaunchOptions;
};

export class DuiDuiSidebarService {
    private readonly platform: DuiDuiAdPlatform;
    private readonly api: DouyinSidebarApi | null;
    private latestLaunchOptions: DuiDuiSidebarLaunchOptions | null = null;
    private readonly onShowCallback = (options: DuiDuiSidebarLaunchOptions) => {
        this.latestLaunchOptions = options;
    };

    constructor(platform = detectSidebarPlatform(), api = resolveSidebarApi(platform)) {
        this.platform = platform;
        this.api = api;
        this.latestLaunchOptions = api?.getLaunchOptionsSync?.() || null;

        if (this.platform === 'douyin') {
            this.api?.onShow?.(this.onShowCallback);
        }
    }

    async checkSidebarSupport(): Promise<boolean> {
        if (this.platform !== 'douyin' || !this.api?.checkScene) {
            return false;
        }

        return new Promise((resolve) => {
            let settled = false;
            const finish = (supported: boolean) => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve(supported);
            };

            try {
                this.api!.checkScene!({
                    scene: 'sidebar',
                    success: (result) => finish(result.isExist === true),
                    fail: () => finish(false),
                });
            } catch {
                finish(false);
            }
        });
    }

    async navigateToSidebar(): Promise<boolean> {
        if (this.platform !== 'douyin' || !this.api?.navigateToScene) {
            return false;
        }

        return new Promise((resolve) => {
            let settled = false;
            const finish = (opened: boolean) => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve(opened);
            };

            try {
                this.api!.navigateToScene!({
                    scene: 'sidebar',
                    success: () => finish(true),
                    fail: () => finish(false),
                });
            } catch {
                finish(false);
            }
        });
    }

    isFromSidebar(): boolean {
        const options = this.latestLaunchOptions || this.api?.getLaunchOptionsSync?.() || null;
        if (!options) {
            return false;
        }

        const launchFrom = options.launch_from || options.query?.launch_from;
        const location = options.location || options.query?.location;
        return launchFrom === 'homepage' && location === 'sidebar_card';
    }

    destroy(): void {
        if (this.platform !== 'douyin') {
            return;
        }
        this.api?.offShow?.(this.onShowCallback);
    }
}

function detectSidebarPlatform(): DuiDuiAdPlatform {
    if (sys.platform === sys.Platform.WECHAT_GAME) {
        return 'wechat';
    }

    const globalApi = globalThis as { tt?: DouyinSidebarApi; wx?: unknown };
    if (globalApi.tt?.checkScene || globalApi.tt?.navigateToScene || globalApi.tt?.onShow) {
        return 'douyin';
    }
    if (globalApi.wx) {
        return 'wechat';
    }
    return 'web';
}

function resolveSidebarApi(platform: DuiDuiAdPlatform): DouyinSidebarApi | null {
    if (platform !== 'douyin') {
        return null;
    }

    const globalApi = globalThis as { tt?: DouyinSidebarApi };
    return globalApi.tt || null;
}
