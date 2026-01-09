'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

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
  I: '#00FFFF',
  O: '#FFFF00',
  T: '#FF00FF',
  S: '#00FF00',
  Z: '#FF0000',
  J: '#0000FF',
  L: '#FFA500'
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
  const [gameStarted, setGameStarted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [flashingRows, setFlashingRows] = useState<number[]>([]);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicGainNodeRef = useRef<GainNode | null>(null);
  const musicTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const clearLines = useCallback((board: Board): { newBoard: Board; linesCleared: number; completedRows: number[] } => {
    const completedRows: number[] = [];
    board.forEach((row, index) => {
      if (row.every(cell => cell === 1)) {
        completedRows.push(index);
      }
    });
    
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
    
    return { newBoard, linesCleared, completedRows };
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
        const { newBoard, linesCleared: clearedCount, completedRows } = clearLines(mergedBoard);
        
        if (completedRows.length > 0) {
          // Flash animation
          setFlashingRows(completedRows);
          setTimeout(() => {
            setBoard(newBoard);
            setScore(prev => prev + clearedCount * 100 * level);
            setLinesCleared(prev => prev + clearedCount);
            setFlashingRows([]);
            
            const nextPiece = createPiece();
            if (checkCollision(nextPiece, newBoard)) {
              setGameOver(true);
            } else {
              setCurrentPiece(nextPiece);
            }
          }, 300);
        } else {
          setBoard(newBoard);
          const nextPiece = createPiece();
          if (checkCollision(nextPiece, newBoard)) {
            setGameOver(true);
          } else {
            setCurrentPiece(nextPiece);
          }
        }
      }
      return;
    }

    setCurrentPiece(newPiece);
  }, [currentPiece, board, gameOver, checkCollision, mergePiece, clearLines, createPiece, rotatePiece, level]);

  const stopMusic = useCallback(() => {
    if (musicTimeoutRef.current) {
      clearTimeout(musicTimeoutRef.current);
      musicTimeoutRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    musicGainNodeRef.current = null;
  }, []);

  const startMusic = useCallback((currentLevel: number) => {
    if (isMusicMuted) return;
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 0.15;
      gainNode.connect(audioContextRef.current.destination);
      musicGainNodeRef.current = gainNode;
    }

    const ctx = audioContextRef.current;
    const gainNode = musicGainNodeRef.current;
    if (!ctx || !gainNode) return;

    // Tetris theme melody (simplified)
    const melody = [
      { note: 659.25, duration: 0.4 }, // E
      { note: 493.88, duration: 0.2 }, // B
      { note: 523.25, duration: 0.2 }, // C
      { note: 587.33, duration: 0.4 }, // D
      { note: 523.25, duration: 0.2 }, // C
      { note: 493.88, duration: 0.2 }, // B
      { note: 440.00, duration: 0.4 }, // A
      { note: 440.00, duration: 0.2 }, // A
      { note: 523.25, duration: 0.2 }, // C
      { note: 659.25, duration: 0.4 }, // E
      { note: 587.33, duration: 0.2 }, // D
      { note: 523.25, duration: 0.2 }, // C
      { note: 493.88, duration: 0.6 }, // B
      { note: 523.25, duration: 0.2 }, // C
      { note: 587.33, duration: 0.4 }, // D
      { note: 659.25, duration: 0.4 }, // E
      { note: 523.25, duration: 0.4 }, // C
      { note: 440.00, duration: 0.4 }, // A
      { note: 440.00, duration: 0.4 }, // A
    ];

    // Speed multiplier based on level (gets faster as level increases)
    const speedMultiplier = 1 + (currentLevel - 1) * 0.15;
    
    // Volume increases slightly with level
    const volumeMultiplier = 1 + (currentLevel - 1) * 0.05;
    gainNode.gain.value = Math.min(0.3, 0.15 * volumeMultiplier);

    const currentTime = ctx.currentTime;
    
    melody.forEach(({ note, duration }, index) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = note;
      osc.connect(gainNode);
      
      const adjustedDuration = duration / speedMultiplier;
      const startTime = currentTime + melody.slice(0, index).reduce((sum, { duration }) => sum + duration / speedMultiplier, 0);
      
      osc.start(startTime);
      osc.stop(startTime + adjustedDuration);
    });
    
    const totalDuration = melody.reduce((sum, { duration }) => sum + duration / speedMultiplier, 0);
    musicTimeoutRef.current = setTimeout(() => startMusic(currentLevel), totalDuration * 1000);
  }, [isMusicMuted]);

  const resetGame = useCallback(() => {
    stopMusic();
    setBoard(Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0)));
    setCurrentPiece(createPiece());
    setScore(0);
    setGameOver(false);
    setLevel(1);
    setLinesCleared(0);
    setGameStarted(false);
    setElapsedTime(0);
  }, [createPiece, stopMusic]);

  const startGame = useCallback(() => {
    setGameStarted(true);
    setCurrentPiece(createPiece());
    if (!isMusicMuted) {
      startMusic(1);
    }
  }, [createPiece, startMusic, isMusicMuted]);

  const toggleMusic = useCallback(() => {
    setIsMusicMuted(prev => {
      const newMuted = !prev;
      if (newMuted) {
        stopMusic();
      } else if (gameStarted && !gameOver) {
        startMusic(level);
      }
      return newMuted;
    });
  }, [stopMusic, startMusic, level, gameStarted, gameOver]);

  useEffect(() => {
    if (!currentPiece && !gameOver && gameStarted) {
      setCurrentPiece(createPiece());
    }
  }, [currentPiece, gameOver, gameStarted, createPiece]);

  // Timer effect - also updates level based on time
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const interval = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;
        // Increase level every 30 seconds
        const newLevel = Math.floor(newTime / 30) + 1;
        setLevel(newLevel);
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStarted, gameOver]);

  // Restart music when level changes to update speed
  useEffect(() => {
    if (gameStarted && !gameOver && !isMusicMuted && audioContextRef.current) {
      if (musicTimeoutRef.current) {
        clearTimeout(musicTimeoutRef.current);
      }
      startMusic(level);
    }
  }, [level, gameStarted, gameOver, isMusicMuted, startMusic]);

  useEffect(() => {
    if (gameOver || !gameStarted) return;

    const speed = Math.max(100, 500 - (level - 1) * 50);
    const interval = setInterval(() => {
      movePiece('down');
    }, speed);

    return () => clearInterval(interval);
  }, [movePiece, gameOver, gameStarted, level]);

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
    <div className="min-h-screen bg-[#008080] flex flex-col p-2 sm:p-3" style={{ fontFamily: 'Courier New, monospace' }}>
      {/* Centered Header */}
      <div className="text-center mb-2">
        <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-1 text-[#FFFF00]" style={{ 
          textShadow: '2px 2px 0px #FF00FF, 4px 4px 0px #00FFFF',
          letterSpacing: '0.05em'
        }}>
          Nullshot&apos;s Tetris Competition
        </h1>
        <p className="text-sm sm:text-base md:text-lg font-bold text-[#00FF00]" style={{ textShadow: '2px 2px 0px #000' }}>
          Win $50 USDC - Highest Score Wins!
        </p>
      </div>

      {/* Game Area with 3 columns */}
      <div className="flex-1 flex flex-col lg:flex-row gap-2 sm:gap-3 items-start justify-center max-w-7xl mx-auto w-full">
        
        {/* Left Column - How to Win + Competition Twist */}
        <div className="w-full lg:w-64 xl:w-72 flex flex-col gap-2 sm:gap-3">
          {/* How to Win */}
          <div className="bg-[#00FF00] p-2 sm:p-3 rounded-none text-black text-left border-2 border-[#FFFF00]" style={{ boxShadow: '3px 3px 0px #000' }}>
            <h2 className="text-xs sm:text-sm md:text-base font-bold mb-1 text-[#FF00FF]" style={{ textShadow: '1px 1px 0px #000' }}>🏆 How to Win</h2>
            <ol className="list-decimal list-inside space-y-1 font-bold text-[9px] sm:text-[10px] md:text-xs">
              <li>Play the Tetris game as many times as you want</li>
              <li>Submit your screenshot of the highscore and tag #nullshotgames</li>
            </ol>
          </div>

          {/* Competition Twist */}
          <div className="bg-[#FF00FF] p-2 sm:p-3 rounded-none text-black text-left border-2 border-[#FFFF00]" style={{ boxShadow: '3px 3px 0px #000' }}>
            <h2 className="text-xs sm:text-sm md:text-base font-bold mb-1 text-[#FFFF00]" style={{ textShadow: '2px 2px 0px #000' }}>🎮 Competition Twist</h2>
            <p className="mb-1 font-bold text-[9px] sm:text-[10px] md:text-xs">
              Want to make it harder for others? Come into the Jam Studio and prompt changes to increase the difficulty!
            </p>
            <p className="text-[8px] sm:text-[9px] md:text-[10px] font-bold">
              Note: Nullshot&apos;s Jam room game master will be the final decision maker on which prompted changes will be merged into the game.
            </p>
          </div>
        </div>

        {/* Center Column - Game Board */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <div className="bg-black p-1 sm:p-2 border-3 sm:border-4 border-[#00FFFF]" style={{ boxShadow: '4px 4px 0px #FF00FF' }}>
            <div className="grid gap-[1px] bg-[#808080]" style={{
              gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
              width: 'fit-content'
            }}>
              {renderBoard().map((row, y) =>
                row.map((cell, x) => (
                  <div
                    key={`${y}-${x}`}
                    className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"
                    style={{
                      backgroundColor: flashingRows.includes(y)
                        ? '#FFFFFF'
                        : cell === 2 && currentPiece 
                        ? COLORS[currentPiece.type]
                        : cell === 1 
                        ? '#808080' 
                        : '#000000',
                      border: cell ? '1px solid rgba(255,255,255,0.3)' : 'none',
                      transition: 'background-color 0.1s'
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Start Button + Scoreboard */}
        <div className="w-full lg:w-64 xl:w-72 flex flex-col gap-2 sm:gap-3">
          {/* Start Button */}
          {!gameStarted && !gameOver && (
            <button
              onClick={startGame}
              className="bg-[#00FF00] text-black px-4 py-2 sm:py-3 border-2 border-[#FFFF00] font-bold text-sm sm:text-base hover:bg-[#FFFF00] hover:text-black transition w-full"
              style={{ boxShadow: '3px 3px 0px #FF00FF' }}
            >
              START GAME
            </button>
          )}

          {/* Scoreboard */}
          <div className="flex flex-col gap-2 sm:gap-3">
            <div className="bg-[#0000FF] p-2 sm:p-3 border-2 border-[#FFFF00] text-white" style={{ boxShadow: '3px 3px 0px #000' }}>
              <h2 className="text-sm sm:text-base font-bold mb-1 text-[#00FFFF]">Score</h2>
              <p className="text-xl sm:text-2xl font-bold text-[#FFFF00]">{score}</p>
              <div className="mt-2 pt-2 border-t-2 border-[#00FFFF]">
                <p className="text-xs font-bold">Level: <span className="text-[#00FF00] font-bold">{level}</span></p>
                <p className="text-xs font-bold">Lines: <span className="text-[#00FF00] font-bold">{linesCleared}</span></p>
                <p className="text-xs font-bold">Time: <span className="text-[#00FF00] font-bold">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</span></p>
              </div>
            </div>

            <div className="bg-[#FF00FF] p-2 sm:p-3 border-2 border-[#00FFFF] text-black text-left" style={{ boxShadow: '3px 3px 0px #000' }}>
              <h2 className="text-xs sm:text-sm font-bold mb-1 text-[#FFFF00]">Controls</h2>
              <div className="space-y-1 text-[10px] sm:text-xs font-bold">
                <p>← → : Move</p>
                <p>↑ : Rotate</p>
                <p>↓ : Drop faster</p>
              </div>
              <button
                onClick={toggleMusic}
                className="mt-2 bg-[#FFFF00] text-black px-2 py-1 border-2 border-black font-bold hover:bg-[#00FF00] transition text-[10px] sm:text-xs w-full"
                style={{ boxShadow: '2px 2px 0px #000' }}
              >
                {isMusicMuted ? '🔇 Unmute Music' : '🔊 Mute Music'}
              </button>
            </div>

            {gameOver && (
              <div className="bg-[#FF0000] p-2 sm:p-3 border-2 border-[#FFFF00] text-white" style={{ boxShadow: '3px 3px 0px #000' }}>
                <h2 className="text-sm sm:text-base font-bold mb-1 text-[#FFFF00]" style={{ textShadow: '2px 2px 0px #000' }}>Game Over!</h2>
                <button
                  onClick={resetGame}
                  className="bg-[#FFFF00] text-black px-3 py-1 sm:py-2 border-2 border-black font-bold hover:bg-[#00FF00] transition text-xs w-full"
                  style={{ boxShadow: '3px 3px 0px #000' }}
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







