import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export class StockfishEngine extends EventEmitter {
    private process: ChildProcess | null = null;
    private isReady: boolean = false;

    constructor() {
        super();
    }

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            // 使用系统安装的 stockfish
            this.process = spawn('stockfish', [], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            if (!this.process.stdout || !this.process.stdin) {
                reject(new Error('Failed to create stockfish process'));
                return;
            }

            let buffer = '';

            this.process.stdout.on('data', (data: Buffer) => {
                buffer += data.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    // console.log('Engine:', line);

                    if (line === 'uciok') {
                        this.send('isready');
                    } else if (line === 'readyok') {
                        this.isReady = true;
                        resolve();
                    } else if (line.startsWith('bestmove')) {
                        const match = line.match(/bestmove\s+(\S+)/);
                        if (match) {
                            this.emit('bestmove', match[1]);
                        }
                    }
                }
            });

            this.process.stderr?.on('data', (data: Buffer) => {
                // 忽略 stderr
            });

            this.process.on('error', (err) => {
                reject(err);
            });

            // 发送 UCI 初始化命令
            this.send('uci');
        });
    }

    private send(command: string): void {
        if (this.process?.stdin) {
            this.process.stdin.write(command + '\n');
        }
    }

    // 设置引擎强度 (1-20)
    setSkillLevel(level: number): void {
        this.send(`setoption name Skill Level value ${Math.min(20, Math.max(0, level))}`);
    }

    // 获取最佳走法 (带超时保护)
    async getBestMove(fen: string, thinkTime: number = 1000): Promise<string> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.removeListener('bestmove', handler);
                console.error('⚠️ 引擎超时，重新发送命令...');
                // 超时后尝试停止当前计算并重新请求
                this.send('stop');
                // 返回一个默认走法或拒绝
                reject(new Error('Engine timeout'));
            }, thinkTime + 5000); // 给额外5秒缓冲

            const handler = (move: string) => {
                clearTimeout(timeout);
                this.removeListener('bestmove', handler);
                resolve(move);
            };
            this.on('bestmove', handler);

            this.send(`position fen ${fen}`);
            this.send(`go movetime ${thinkTime}`);
        });
    }

    // 带重试的获取最佳走法
    async getBestMoveWithRetry(fen: string, thinkTime: number = 1000, retries: number = 3): Promise<string> {
        for (let i = 0; i < retries; i++) {
            try {
                return await this.getBestMove(fen, thinkTime);
            } catch (e) {
                console.log(`   重试 ${i + 1}/${retries}...`);
                if (i === retries - 1) throw e;
            }
        }
        throw new Error('Failed after retries');
    }

    quit(): void {
        this.send('quit');
        this.process?.kill();
    }
}
