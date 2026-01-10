import puppeteer from 'puppeteer';
import { createInterface } from 'readline';
import { StockfishEngine } from './engine.js';
import { getBoardState } from './board.js';
import { makeMove } from './player.js';

const THINK_TIME = 500; // 思考时间 (毫秒)
const CHECK_INTERVAL = 500; // 检查间隔 (毫秒)

// 询问用户选择
function askQuestion(question: string): Promise<string> {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function main() {
    console.log('');
    console.log('🎮 Chess.com 自动对战机器人');
    console.log('============================');
    console.log('');
    console.log('请选择对战模式:');
    console.log('  1. 🤖 人机对战 (vs 电脑)');
    console.log('  2. 👥 玩家对战 (vs 真人)');
    console.log('');

    const choice = await askQuestion('输入选项 (1 或 2): ');

    const isVsComputer = choice !== '2';
    const gameUrl = isVsComputer
        ? 'https://www.chess.com/play/computer'
        : 'https://www.chess.com/play/online';

    console.log('');
    console.log(`✅ 已选择: ${isVsComputer ? '人机对战' : '玩家对战'}`);

    // 初始化 Stockfish 引擎
    console.log('⚙️ 初始化 Stockfish 引擎...');
    const engine = new StockfishEngine();
    await engine.init();
    engine.setSkillLevel(20); // 最高强度
    console.log('✅ 引擎已就绪!');

    // 启动浏览器 (使用独立配置目录保存登录态)
    console.log('🌐 启动浏览器...');

    // 使用项目目录下的 .chrome-data 保存登录态
    const userDataDir = new URL('../.chrome-data', import.meta.url).pathname;

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        userDataDir,  // 首次登录后会自动保存
        args: ['--start-maximized'],
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000); // 60秒超时
    await page.goto(gameUrl, { waitUntil: 'domcontentloaded' });

    console.log(`✅ 浏览器已打开 chess.com ${isVsComputer ? '人机对战' : '玩家对战'}`);
    console.log('');
    console.log('👆 开始游戏后，机器人将自动接管!');
    console.log('============================================');

    let lastFen = '';
    let moveCount = 0;

    // 游戏主循环
    while (true) {
        await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));

        try {
            const state = await getBoardState(page);

            if (!state) {
                // 每5秒打印一次等待状态
                if (Date.now() % 5000 < CHECK_INTERVAL) {
                    console.log('⏳ 等待棋盘加载...');
                }
                continue; // 还没有找到棋盘
            }

            // 调试输出 (每次变化时打印)
            if (state.fen !== lastFen) {
                console.log(`📋 检测到棋盘 | 颜色: ${state.playerColor} | 轮到我: ${state.isMyTurn}`);
            }

            // 检查是否轮到我走
            if (!state.isMyTurn) {
                continue;
            }

            // 检查局面是否变化 (避免重复走同一步)
            if (state.fen === lastFen) {
                continue;
            }

            lastFen = state.fen;
            moveCount++;

            console.log(`\n🎯 回合 ${moveCount} - 轮到我们走棋`);
            console.log(`   颜色: ${state.playerColor === 'white' ? '⬜ 白方' : '⬛ 黑方'}`);
            console.log(`   FEN: ${state.fen}`);

            // 获取最佳走法 (带重试)
            try {
                const bestMove = await engine.getBestMoveWithRetry(state.fen, THINK_TIME);
                console.log(`   最佳走法: ${bestMove}`);

                // 执行走棋
                await makeMove(page, bestMove, state.playerColor);
                console.log('   ✅ 走棋完成!');
            } catch (engineError) {
                console.error('   ❌ 引擎错误，跳过本回合');
                lastFen = ''; // 重置以便下次重试
            }

        } catch (error) {
            // 忽略游戏未开始时的错误
        }
    }
}

// 运行主程序
main().catch(console.error);
