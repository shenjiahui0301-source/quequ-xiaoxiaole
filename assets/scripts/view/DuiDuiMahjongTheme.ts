import { Color } from 'cc';

export interface DuiDuiArtPaths {
    background: string;
     mahjongAtlas: string;
}

export class DuiDuiMahjongTheme {
    static readonly artPaths: DuiDuiArtPaths = {
        background: 'duidui/background_clean',
        mahjongAtlas: 'duidui/mahjong-font',
    };

    static readonly symbols = [
        '一', '二', '三', '四', '五', '六', '七', '八', '九',
        '东', '南', '西', '北', '中', '发', '白',
        '春', '夏', '秋', '冬', '梅', '兰', '竹', '菊',
        '1筒', '2筒', '3筒', '4筒', '5筒', '6筒',
    ];

    private static readonly accentPalette = [
        new Color(228, 70, 72),
        new Color(44, 154, 111),
        new Color(64, 119, 210),
        new Color(183, 91, 206),
        new Color(232, 150, 54),
        new Color(35, 164, 176),
    ];

    static accentColor(type: number): Color {
        const source = this.accentPalette[(type - 1) % this.accentPalette.length];
        return new Color(source.r, source.g, source.b, source.a);
    }

    static symbol(type: number): string {
        return this.symbols[(type - 1) % this.symbols.length];
    }
}
