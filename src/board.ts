import type { Page } from 'puppeteer';

// 棋子符号到 FEN 字符的映射
const PIECE_MAP: Record<string, string> = {
    'wk': 'K', 'wq': 'Q', 'wr': 'R', 'wb': 'B', 'wn': 'N', 'wp': 'P',
    'bk': 'k', 'bq': 'q', 'br': 'r', 'bb': 'b', 'bn': 'n', 'bp': 'p',
};

export interface BoardState {
    fen: string;
    isMyTurn: boolean;
    playerColor: 'white' | 'black';
}

export async function getBoardState(page: Page): Promise<BoardState | null> {
    try {
        const state = await page.evaluate(() => {
            // 检查游戏是否已开始
            // 人机模式：检查 bot-selection Play 按钮是否存在
            const playButton = document.querySelector(
                'button.bot-selection-cta-button-button, [data-cy="bot-selection-cta-button"], button[data-cy="new-game-index-play"]'
            );
            const resignButton = document.querySelector('[data-cy="resign"], .resign-button-component');
            const gameOverModal = document.querySelector('.game-over-modal, .game-result-header, .game-result-component, [data-cy="game-over-modal"], .board-modal-container');

            // 如果有 Play 按钮（未开始游戏）或有游戏结束弹窗，不走棋
            if (playButton || gameOverModal) {
                return null;
            }

            const board = document.querySelector('wc-chess-board, chess-board');
            if (!board) return null;

            // 检测玩家颜色 (棋盘是否翻转)
            const isFlipped = board.classList.contains('flipped');
            const playerColor = isFlipped ? 'black' : 'white';

            // 获取所有棋子
            const pieces = board.querySelectorAll('.piece');
            const boardArray: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));

            pieces.forEach((piece) => {
                const classList = Array.from(piece.classList);

                // 找到棋子类型 (如 'wp', 'bk' 等)
                const pieceClass = classList.find(c => /^[wb][kqrbnp]$/.test(c));

                // 找到位置 (如 'square-14' 表示 a4)
                const squareClass = classList.find(c => c.startsWith('square-'));

                if (pieceClass && squareClass) {
                    const squareNum = squareClass.replace('square-', '');
                    const file = parseInt(squareNum[0]) - 1; // 列 (0-7)
                    const rank = parseInt(squareNum[1]) - 1; // 行 (0-7)

                    if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
                        boardArray[7 - rank][file] = pieceClass;
                    }
                }
            });

            // 检测是否轮到我走
            // 方法1: 在线对战模式 - 使用时钟
            const bottomClock = document.querySelector('.clock-bottom');
            let isMyTurn = bottomClock?.classList.contains('clock-player-turn') ?? false;

            // 方法2: 人机对战模式 - 通过走子数判断
            if (!bottomClock) {
                // 获取 move list 中的走子数
                const moveNodes = document.querySelectorAll('vertical-move-list .node, vertical-move-list [data-ply]');
                const moveCount = moveNodes.length;

                // 如果走子数是偶数，白方走；奇数，黑方走
                if (playerColor === 'white') {
                    isMyTurn = moveCount % 2 === 0;
                } else {
                    isMyTurn = moveCount % 2 === 1;
                }

                // 额外检查：如果有高亮方块且不是我方颜色的棋子刚走完
                const highlights = board.querySelectorAll('.highlight');
                if (highlights.length === 2) {
                    // 有高亮说明刚有棋子移动
                    // 通过检查最后一步是否是对方的走子来判断
                    const lastMoveSquare = highlights[1];
                    const squareClass = Array.from(lastMoveSquare.classList).find(c => c.startsWith('square-'));
                    if (squareClass) {
                        const squareNum = squareClass.replace('square-', '');
                        const file = parseInt(squareNum[0]) - 1;
                        const rank = parseInt(squareNum[1]) - 1;
                        const movedPiece = boardArray[7 - rank]?.[file];
                        if (movedPiece) {
                            const isWhitePiece = movedPiece.startsWith('w');
                            // 如果最后移动的是对方棋子，轮到我走
                            isMyTurn = (playerColor === 'white') !== isWhitePiece;
                        }
                    }
                }
            }

            return { boardArray, isMyTurn, playerColor };
        });

        if (!state) return null;

        // 转换为 FEN
        const fen = boardToFEN(state.boardArray, state.playerColor, state.isMyTurn);

        return {
            fen,
            isMyTurn: state.isMyTurn,
            playerColor: state.playerColor as 'white' | 'black',
        };
    } catch (error) {
        console.error('Error getting board state:', error);
        return null;
    }
}

function boardToFEN(board: (string | null)[][], playerColor: string, isMyTurn: boolean): string {
    let fen = '';

    for (let rank = 0; rank < 8; rank++) {
        let emptyCount = 0;
        for (let file = 0; file < 8; file++) {
            const piece = board[rank][file];
            if (piece) {
                if (emptyCount > 0) {
                    fen += emptyCount;
                    emptyCount = 0;
                }
                fen += PIECE_MAP[piece] || '?';
            } else {
                emptyCount++;
            }
        }
        if (emptyCount > 0) {
            fen += emptyCount;
        }
        if (rank < 7) {
            fen += '/';
        }
    }

    // 计算回合方
    const turnColor = isMyTurn ? playerColor : (playerColor === 'white' ? 'black' : 'white');
    const turn = turnColor === 'white' ? 'w' : 'b';

    // 计算易位权限 (简单的位置检测)
    // 注意: board[0] 是 Rank 8 (黑), board[7] 是 Rank 1 (白)
    let castling = '';

    // White: King at e1 (7,4), Rooks at h1 (7,7) and a1 (7,0)
    if (board[7][4] === 'wk') {
        if (board[7][7] === 'wr') castling += 'K';
        if (board[7][0] === 'wr') castling += 'Q';
    }

    // Black: King at e8 (0,4), Rooks at h8 (0,7) and a8 (0,0)
    if (board[0][4] === 'bk') {
        if (board[0][7] === 'br') castling += 'k';
        if (board[0][0] === 'br') castling += 'q';
    }

    if (castling === '') castling = '-';

    fen += ` ${turn} ${castling} - 0 1`;

    return fen;
}

// 将走法转换为棋盘坐标
export function moveToSquares(move: string): { from: string; to: string; promotion?: string } {
    const from = move.substring(0, 2);
    const to = move.substring(2, 4);
    const promotion = move.length > 4 ? move[4] : undefined;
    return { from, to, promotion };
}
