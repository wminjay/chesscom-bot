import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export class StockfishEngine extends EventEmitter {
    private process: ChildProcess | null = null;
    private isReady: boolean = false;
    private buffer: string = '';

    constructor() {
        super();
    }

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            // 使用系统安装的 stockfish (brew install stockfish)
            console.log(`   使用引擎: stockfish`);

            this.process = spawn('stockfish', [], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            if (!this.process.stdout || !this.process.stdin) {
                reject(new Error('Failed to create stockfish process'));
                return;
            }

            this.buffer = '';

            this.process.stdout.on('data', (data: Buffer) => {
                this.buffer += data.toString();
                const lines = this.buffer.split('\n');
                this.buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line === 'uciok') {
                        this.send('isready');
                    } else if (line === 'readyok') {
                        this.isReady = true;
                        if (!this.listenerCount('ready')) {
                            resolve();
                        }
                        this.emit('ready');
                    } else if (line.startsWith('bestmove')) {
                        const match = line.match(/bestmove\s+(\S+)/);
                        if (match) {
                            this.emit('bestmove', match[1]);
                        }
                    }
                }
            });

            this.process.stderr?.on('data', (data: Buffer) => {
                console.error(`[Engine Error] ${data}`);
            });

            this.process.on('error', (err) => {
                console.error('Stockfish error:', err);
                reject(err);
            });

            this.process.on('exit', (code, signal) => {
                console.error(`⚠️ Stockfish 进程退出，code: ${code}, signal: ${signal}`);
                this.isReady = false;
            });

            // 发送 UCI 初始化命令
            this.send('uci');
        });
    }

    private send(command: string): void {
        if (this.process?.stdin && !this.process.killed) {
            this.process.stdin.write(command + '\n');
        }
    }

    // 设置引擎强度 (1-20)
    setSkillLevel(level: number): void {
        this.send(`setoption name Skill Level value ${Math.min(20, Math.max(0, level))}`);
    }

    // 获取最佳走法 (简化版本，更可靠)
    async getBestMove(fen: string, thinkTime: number = 1000): Promise<string> {
        return new Promise((resolve, reject) => {
            // 检查进程是否存活
            if (!this.process || this.process.killed) {
                reject(new Error('Engine process not running'));
                return;
            }

            const timeout = setTimeout(() => {
                this.removeListener('bestmove', handler);
                this.send('stop');
                // 再等一小会儿看能不能收到 bestmove
                setTimeout(() => {
                    reject(new Error('Engine timeout'));
                }, 500);
            }, thinkTime + 3000);

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
    async getBestMoveWithRetry(fen: string, thinkTime: number = 1000, retries: number = 2): Promise<string> {
        for (let i = 0; i < retries; i++) {
            try {
                return await this.getBestMove(fen, thinkTime);
            } catch (e) {
                if (i < retries - 1) {
                    console.log(`   重试 ${i + 1}/${retries}...`);
                    await new Promise(r => setTimeout(r, 300));
                } else {
                    throw e;
                }
            }
        }
        throw new Error('Failed after retries');
    }

    quit(): void {
        this.send('quit');
        this.process?.kill();
    }
}
