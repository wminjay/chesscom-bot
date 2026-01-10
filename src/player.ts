import type { Page } from 'puppeteer';
import { moveToSquares } from './board.js';

// 将代数坐标转换为棋盘上的像素坐标
function squareToCoords(square: string, isFlipped: boolean): { x: number; y: number } {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0); // 0-7
    const rank = parseInt(square[1]) - 1; // 0-7

    // 棋盘左上角是起点，每格大小需要从页面获取
    // 这里返回归一化坐标 (0-1 范围)
    let x = (file + 0.5) / 8;
    let y = (7 - rank + 0.5) / 8;

    if (isFlipped) {
        x = 1 - x;
        y = 1 - y;
    }

    return { x, y };
}

export async function makeMove(page: Page, move: string, playerColor: 'white' | 'black'): Promise<boolean> {
    try {
        const { from, to, promotion } = moveToSquares(move);
        const isFlipped = playerColor === 'black';

        // 获取棋盘元素和尺寸
        const board = await page.$('wc-chess-board, chess-board');
        if (!board) {
            console.error('找不到棋盘!');
            return false;
        }

        const box = await board.boundingBox();
        if (!box) {
            console.error('无法获取棋盘位置!');
            return false;
        }

        const fromCoords = squareToCoords(from, isFlipped);
        const toCoords = squareToCoords(to, isFlipped);

        const fromX = box.x + box.width * fromCoords.x;
        const fromY = box.y + box.height * fromCoords.y;
        const toX = box.x + box.width * toCoords.x;
        const toY = box.y + box.height * toCoords.y;

        console.log(`走棋: ${move} (${from} -> ${to})`);

        // 执行拖拽走棋
        await page.mouse.move(fromX, fromY);
        await page.mouse.down();
        await new Promise(r => setTimeout(r, 50));
        await page.mouse.move(toX, toY, { steps: 5 });
        await page.mouse.up();

        // 处理兵升变
        if (promotion) {
            await new Promise(r => setTimeout(r, 200));
            await handlePromotion(page, promotion);
        }

        return true;
    } catch (error) {
        console.error('走棋失败:', error);
        return false;
    }
}

async function handlePromotion(page: Page, piece: string): Promise<void> {
    // 点击升变选择
    const promotionMap: Record<string, string> = {
        'q': '.promotion-piece.wq, .promotion-piece.bq, [data-piece="q"]',
        'r': '.promotion-piece.wr, .promotion-piece.br, [data-piece="r"]',
        'b': '.promotion-piece.wb, .promotion-piece.bb, [data-piece="b"]',
        'n': '.promotion-piece.wn, .promotion-piece.bn, [data-piece="n"]',
    };

    const selector = promotionMap[piece.toLowerCase()];
    if (selector) {
        try {
            await page.click(selector);
        } catch {
            // 默认升变为皇后
            console.log('升变选择失败，尝试默认皇后');
        }
    }
}
