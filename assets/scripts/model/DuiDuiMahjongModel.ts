export type DuiDirection = 'up' | 'down' | 'left' | 'right';

export interface DuiLevelConfig {
    rows: number;
    cols: number;
    cellW: number;
    cellH: number;
    types: number;
    difficulty: number;
    time: number;
}

export interface DuiModelTile {
    id: number;
    type: number;
    row: number;
    col: number;
}

export interface DuiCell {
    row: number;
    col: number;
}

export interface DuiTileSnapshot {
    id: number;
    type: number;
    row: number;
    col: number;
}

export interface DuiBoardSnapshot {
    mode: number;
    level: number;
    timeLeft: number;
    tiles: DuiTileSnapshot[];
}

export interface DuiSlidePlan<T extends DuiModelTile> {
    dir: DuiDirection;
    group: T[];
    maxSteps: number;
    startCells: Map<number, DuiCell>;
}

export class DuiDuiMahjongModel<T extends DuiModelTile> {
    createGrid(level: DuiLevelConfig): (T | null)[][] {
        const grid: (T | null)[][] = [];
        for (let row = 0; row < level.rows; row++) {
            grid[row] = [];
            for (let col = 0; col < level.cols; col++) {
                grid[row][col] = null;
            }
        }
        return grid;
    }

    createPairedValues(total: number, typeCount: number): number[] {
        const values: number[] = [];
        for (let i = 0; i < total / 2; i++) {
            const value = randomInt(1, typeCount);
            values.push(value, value);
        }
        shuffle(values);
        return values;
    }

    captureSnapshot(mode: number, level: number, timeLeft: number, tiles: T[]): DuiBoardSnapshot {
        return {
            mode,
            level,
            timeLeft,
            tiles: tiles.map((tile) => ({
                id: tile.id,
                type: tile.type,
                row: tile.row,
                col: tile.col,
            })),
        };
    }

    createSlidePlan(tile: T, grid: (T | null)[][], level: DuiLevelConfig, dir: DuiDirection): DuiSlidePlan<T> | null {
        const delta = DuiDuiMahjongModel.directionDelta(dir);
        const group: T[] = [tile];
        let sawEmpty = false;
        let emptyCount = 0;
        let row = tile.row + delta.row;
        let col = tile.col + delta.col;

        while (this.isInside(level, row, col)) {
            const cell = grid[row][col];
            if (!cell) {
                sawEmpty = true;
                emptyCount++;
            } else if (sawEmpty) {
                break;
            } else {
                group.push(cell);
            }
            row += delta.row;
            col += delta.col;
        }

        if (!sawEmpty || emptyCount <= 0) {
            return null;
        }

        const startCells = new Map<number, DuiCell>();
        for (const item of group) {
            startCells.set(item.id, { row: item.row, col: item.col });
        }

        return { dir, group, maxSteps: emptyCount, startCells };
    }

    commitSlide(plan: DuiSlidePlan<T>, grid: (T | null)[][], steps: number) {
        const delta = DuiDuiMahjongModel.directionDelta(plan.dir);
        for (const tile of plan.group) {
            grid[tile.row][tile.col] = null;
        }

        for (const tile of plan.group) {
            tile.row += delta.row * steps;
            tile.col += delta.col * steps;
            grid[tile.row][tile.col] = tile;
        }
    }

    rollbackSlide(plan: DuiSlidePlan<T>, grid: (T | null)[][], level: DuiLevelConfig) {
        for (const tile of plan.group) {
            if (this.isInside(level, tile.row, tile.col) && grid[tile.row][tile.col] === tile) {
                grid[tile.row][tile.col] = null;
            }
        }

        for (const tile of plan.group) {
            const startCell = plan.startCells.get(tile.id);
            if (!startCell) {
                continue;
            }
            tile.row = startCell.row;
            tile.col = startCell.col;
            grid[tile.row][tile.col] = tile;
        }
    }

    findSameTypeTiles(tile: T, tiles: T[]): T[] {
        return tiles.filter((other) => other !== tile && other.type === tile.type);
    }

    findSameTypePair(tiles: T[]): [T, T] | null {
        for (let i = 0; i < tiles.length; i++) {
            for (let j = i + 1; j < tiles.length; j++) {
                if (tiles[i].type === tiles[j].type) {
                    return [tiles[i], tiles[j]];
                }
            }
        }
        return null;
    }

    findClearMatches(tile: T, tiles: T[], grid: (T | null)[][]): T[] {
        const result: T[] = [];
        for (const other of tiles) {
            if (other === tile || other.type !== tile.type) {
                continue;
            }
            if (tile.row !== other.row && tile.col !== other.col) {
                continue;
            }
            if (this.isPathClear(grid, tile.row, tile.col, other.row, other.col)) {
                result.push(other);
            }
        }
        result.sort((a, b) => distanceCells(tile, a) - distanceCells(tile, b));
        return result;
    }

    findAnyDirectPair(tiles: T[], grid: (T | null)[][]): [T, T] | null {
        for (const tile of tiles) {
            const matches = this.findClearMatches(tile, tiles, grid);
            if (matches.length > 0) {
                return [tile, matches[0]];
            }
        }
        return null;
    }

    ensureDirectPair(level: DuiLevelConfig, grid: (T | null)[][], tiles: T[]): boolean {
        if (this.findAnyDirectPair(tiles, grid) || tiles.length < 2) {
            return false;
        }

        const pair = this.findSameTypePair(tiles);
        if (!pair) {
            return false;
        }

        const firstCell = { row: 0, col: 0 };
        const secondCell = level.cols > 1 ? { row: 0, col: 1 } : { row: 1, col: 0 };
        if (!this.isInside(level, secondCell.row, secondCell.col)) {
            return false;
        }

        for (let row = 0; row < level.rows; row++) {
            for (let col = 0; col < level.cols; col++) {
                grid[row][col] = null;
            }
        }

        const [a, b] = pair;
        a.row = firstCell.row;
        a.col = firstCell.col;
        b.row = secondCell.row;
        b.col = secondCell.col;
        grid[a.row][a.col] = a;
        grid[b.row][b.col] = b;

        for (const tile of tiles) {
            if (tile === a || tile === b) {
                continue;
            }
            let placed = false;
            for (let row = 0; row < level.rows && !placed; row++) {
                for (let col = 0; col < level.cols && !placed; col++) {
                    if (!grid[row][col]) {
                        tile.row = row;
                        tile.col = col;
                        grid[row][col] = tile;
                        placed = true;
                    }
                }
            }
        }
        return true;
    }

    findAnyUsefulSlide(level: DuiLevelConfig, grid: (T | null)[][], tiles: T[]): { tile: T; dir: DuiDirection } | null {
        const dirs: DuiDirection[] = ['up', 'down', 'left', 'right'];
        for (const tile of tiles) {
            for (const dir of dirs) {
                const plan = this.createSlidePlan(tile, grid, level, dir);
                if (!plan) {
                    continue;
                }
                const delta = DuiDuiMahjongModel.directionDelta(dir);
                for (let step = 1; step <= plan.maxSteps; step++) {
                    const simulatedRow = tile.row + delta.row * step;
                    const simulatedCol = tile.col + delta.col * step;
                    if (this.hasMatchAt(tile, simulatedRow, simulatedCol, plan.group, delta, step, level, grid, tiles)) {
                        return { tile, dir };
                    }
                }
            }
        }
        return null;
    }

    hasMatchAt(
        tile: T,
        row: number,
        col: number,
        group: T[],
        delta: DuiCell,
        step: number,
        level: DuiLevelConfig,
        grid: (T | null)[][],
        tiles: T[],
    ): boolean {
        const movedIds = new Set(group.map((item) => item.id));
        const virtualGrid: (T | null)[][] = [];
        for (let r = 0; r < level.rows; r++) {
            virtualGrid[r] = [];
            for (let c = 0; c < level.cols; c++) {
                const cell = grid[r][c];
                virtualGrid[r][c] = cell && !movedIds.has(cell.id) ? cell : null;
            }
        }
        for (const item of group) {
            virtualGrid[item.row + delta.row * step][item.col + delta.col * step] = item;
        }

        for (const other of tiles) {
            if (other === tile || other.type !== tile.type) {
                continue;
            }
            const otherRow = movedIds.has(other.id) ? other.row + delta.row * step : other.row;
            const otherCol = movedIds.has(other.id) ? other.col + delta.col * step : other.col;
            if ((otherRow === row || otherCol === col) && this.isPathClear(virtualGrid, row, col, otherRow, otherCol)) {
                return true;
            }
        }
        return false;
    }

    isPathClear(grid: (T | null)[][], rowA: number, colA: number, rowB: number, colB: number): boolean {
        if (rowA === rowB) {
            const min = Math.min(colA, colB) + 1;
            const max = Math.max(colA, colB);
            for (let col = min; col < max; col++) {
                if (grid[rowA][col]) {
                    return false;
                }
            }
            return true;
        }

        if (colA === colB) {
            const min = Math.min(rowA, rowB) + 1;
            const max = Math.max(rowA, rowB);
            for (let row = min; row < max; row++) {
                if (grid[row][colA]) {
                    return false;
                }
            }
            return true;
        }

        return false;
    }

    static directionDelta(dir: DuiDirection): DuiCell {
        switch (dir) {
            case 'up':
                return { row: 1, col: 0 };
            case 'down':
                return { row: -1, col: 0 };
            case 'left':
                return { row: 0, col: -1 };
            case 'right':
                return { row: 0, col: 1 };
        }
    }

    private isInside(level: DuiLevelConfig, row: number, col: number): boolean {
        return row >= 0 && row < level.rows && col >= 0 && col < level.cols;
    }
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[]) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = items[i];
        items[i] = items[j];
        items[j] = temp;
    }
}

function distanceCells(a: DuiModelTile, b: DuiModelTile): number {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}
