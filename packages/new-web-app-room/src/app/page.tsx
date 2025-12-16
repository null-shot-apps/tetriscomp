'use client';

import { useEffect, useState, useCallback } from 'react';

// Tetris piece shapes
const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]]
};

const COLORS = {
  I: '#00f0f0',
  O: '#f0f000',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#f0a000'
};

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

type ShapeType = keyof typeof SHAPES;
type Board = number[][];

interface Piece {
  shape: number[][];
  x: number;
  y: number;
  type: ShapeType;
}

export default function TetrisGame() {
  const [board, setBoard] = useState<Board>(() => 
    Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0))
  );
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [level, setLevel] = useState(1);
  const [linesCleared, setLinesCleared] = useState(0);

  const createPiece = useCallback((): Piece => {
    const types = Object.keys(SHAPES) as ShapeType[];
    const type = types[Math.floor(Math.random() * types.length)];
    return {
      shape: SHAPES[type],
      x: Math.floor(BOARD_WIDTH / 2) - 1,
      y: 0,
      type
    };
  }, []);

  const checkCollision = useCallback((piece: Piece, board: Board, offsetX = 0, offsetY = 0): boolean => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = piece.x + x + offsetX;
          const newY = piece.y + y + offsetY;
          
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
            return true;
          }
          
          if (newY >= 0 && board[newY][newX]) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const mergePiece = useCallback((piece: Piece, board: Board): Board => {
    const newBoard = board.map(row => [...row]);
    piece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          const boardY = piece.y + y;
          const boardX = piece.x + x;
          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
            newBoard[boardY][boardX] = 1;
          }
        }
      });
    });
    return newBoard;
  }, []);

  const clearLines = useCallback((board: Board): { newBoard: Board; linesCleared: number } => {
    let linesCleared = 0;
    const newBoard = board.filter(row => {
      if (row.every(cell => cell === 1)) {
        linesCleared++;
        return false;
      }
      return true;
    });
    
    while (newBoard.length < BOARD_HEIGHT) {
      newBoard.unshift(Array(BOARD_WIDTH).fill(0));
    }
    
    return { newBoard, linesCleared };
  }, []);

  const rotatePiece = useCallback((piece: Piece): number[][] => {
    const rotated = piece.shape[0].map((_, i) =>
      piece.shape.map(row => row[i]).reverse()
    );
    return rotated;
  }, []);

  const movePiece = useCallback((direction: 'left' | 'right' | 'down' | 'rotate') => {
    if (!currentPiece || gameOver) return;

    const newPiece = direction === 'left' 
      ? { ...currentPiece, x: currentPiece.x - 1 }
      : direction === 'right'
      ? { ...currentPiece, x: currentPiece.x + 1 }
      : direction === 'down'
      ? { ...currentPiece, y: currentPiece.y + 1 }
      : { ...currentPiece, shape: rotatePiece(currentPiece) };

    if (checkCollision(newPiece, board)) {
      if (direction === 'down') {
        const mergedBoard = mergePiece(currentPiece, board);
        const { newBoard, linesCleared: clearedCount } = clearLines(mergedBoard);
        setBoard(newBoard);
        setScore(prev => prev + clearedCount * 100 * level);
        setLinesCleared(prev => {
          const newTotal = prev + clearedCount;
          const newLevel = Math.floor(newTotal / 10) + 1;
          setLevel(newLevel);
          return newTotal;
        });
        
        const nextPiece = createPiece();
        if (checkCollision(nextPiece, newBoard)) {
          setGameOver(true);
        } else {
          setCurrentPiece(nextPiece);
        }
      }
      return;
    }

    setCurrentPiece(newPiece);
  }, [currentPiece, board, gameOver, checkCollision, mergePiece, clearLines, createPiece, rotatePiece]);

  const resetGame = useCallback(() => {
    setBoard(Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0)));
    setCurrentPiece(createPiece());
    setScore(0);
    setGameOver(false);
    setLevel(1);
    setLinesCleared(0);
  }, [createPiece]);

  useEffect(() => {
    if (!currentPiece && !gameOver) {
      setCurrentPiece(createPiece());
    }
  }, [currentPiece, gameOver, createPiece]);

  useEffect(() => {
    if (gameOver) return;

    const speed = Math.max(100, 500 - (level - 1) * 50);
    const interval = setInterval(() => {
      movePiece('down');
    }, speed);

    return () => clearInterval(interval);
  }, [movePiece, gameOver, level]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameOver) return;

      switch (e.key) {
        case 'ArrowLeft':
          movePiece('left');
          break;
        case 'ArrowRight':
          movePiece('right');
          break;
        case 'ArrowDown':
          movePiece('down');
          break;
        case 'ArrowUp':
          movePiece('rotate');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [movePiece, gameOver]);

  const renderBoard = () => {
    const displayBoard = board.map(row => [...row]);
    
    if (currentPiece) {
      currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value) {
            const boardY = currentPiece.y + y;
            const boardX = currentPiece.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              displayBoard[boardY][boardX] = 2;
            }
          }
        });
      });
    }

    return displayBoard;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="text-center max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold text-white mb-2">Nullshot&apos;s Tetris Competition</h1>
        <p className="text-2xl font-bold text-yellow-400 mb-4">Win $50 USDC - Highest Score Wins!</p>
        
        <div className="bg-blue-900/50 backdrop-blur-sm p-6 rounded-lg mb-6 text-white text-left max-w-2xl mx-auto border-2 border-blue-400">
          <h2 className="text-xl font-bold mb-3 text-yellow-300">🎮 Competition Twist</h2>
          <p className="mb-3">
            Want to make it harder for others? Come into the Jam Studio and prompt changes to increase the difficulty!
          </p>
          <p className="text-sm text-gray-300 italic">
            Note: Nullshot&apos;s Jam room game master will be the final decision maker on which prompted changes will be merged into the game.
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-8 items-start justify-center">
          {/* Game Board */}
          <div className="bg-gray-900 p-4 rounded-lg shadow-2xl">
            <div className="grid gap-[1px] bg-gray-700" style={{
              gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
              width: 'fit-content'
            }}>
              {renderBoard().map((row, y) =>
                row.map((cell, x) => (
                  <div
                    key={`${y}-${x}`}
                    className="w-7 h-7 transition-colors"
                    style={{
                      backgroundColor: cell === 2 && currentPiece 
                        ? COLORS[currentPiece.type]
                        : cell === 1 
                        ? '#4a5568' 
                        : '#1a202c'
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Side Panel */}
          <div className="flex flex-col gap-4">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-white">
              <h2 className="text-2xl font-bold mb-2">Score</h2>
              <p className="text-4xl font-bold text-yellow-400">{score}</p>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-sm text-gray-400">Level: <span className="text-white font-bold">{level}</span></p>
                <p className="text-sm text-gray-400">Lines: <span className="text-white font-bold">{linesCleared}</span></p>
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-white text-left">
              <h2 className="text-xl font-bold mb-3">Controls</h2>
              <div className="space-y-2 text-sm">
                <p>← → : Move</p>
                <p>↑ : Rotate</p>
                <p>↓ : Drop faster</p>
              </div>
            </div>

            {gameOver && (
              <div className="bg-red-600 p-6 rounded-lg shadow-xl text-white">
                <h2 className="text-2xl font-bold mb-3">Game Over!</h2>
                <button
                  onClick={resetGame}
                  className="bg-white text-red-600 px-6 py-2 rounded-lg font-bold hover:bg-gray-100 transition"
                >
                  Play Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

















