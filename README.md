# Chess Autopilot 🤖♟️

A chess bot that automatically plays on Chess.com using the Stockfish engine.

## 💡 Origin Story

This project was born from a father-son bet: 

> "I bet I can write a program in 30 minutes that beats you at chess!"

As a dad who doesn't know how to play chess, I turned to programming and the world's strongest chess engine (Stockfish) to compete against my son. The result? This bot was built in about 20 minutes, powered by AI-assisted coding. 

**Spoiler: Dad won the bet!** 🏆

## Features

- 🎮 Supports both **vs Computer** and **vs Player** modes
- 🧠 Powered by **Stockfish 17** (~3500 ELO)
- 🔄 Auto-detects board state and makes moves
- 💾 Saves login session for convenience

## Quick Start

```bash
# Install dependencies
npm install

# Install Stockfish (macOS)
brew install stockfish

# Run the bot
npm start
```

## How It Works

1. **Board Recognition** - Reads piece positions from Chess.com DOM
2. **Engine Analysis** - Sends position to Stockfish via UCI protocol  
3. **Auto Play** - Simulates mouse drag to make moves

## Tech Stack

- **Puppeteer** - Browser automation
- **Stockfish** - Chess engine (Alpha-Beta + NNUE)
- **TypeScript** - Type-safe code

## Project Structure

```
src/
├── bot.ts      # Main entry point
├── engine.ts   # Stockfish UCI wrapper
├── board.ts    # Board state detection
└── player.ts   # Move execution
```

## ⚠️ Disclaimer

This project is for **educational purposes only** - to learn about:
- Browser automation with Puppeteer
- Chess engine integration (UCI protocol)
- Web scraping techniques

Using this bot in online games **violates Chess.com's Terms of Service** and may result in account suspension. **Use at your own risk.**

## License

MIT
