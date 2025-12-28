import React, { useEffect, useRef } from 'react';

// --- Constants ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 20;
const PLAYER_SPEED = 5;
const BULLET_WIDTH = 4;
const BULLET_HEIGHT = 10;
const BULLET_SPEED = 7;
const ALIEN_ROWS = 5;
const ALIEN_COLS = 11;
const ALIEN_WIDTH = 30;
const ALIEN_HEIGHT = 20;
const ALIEN_PADDING = 15;
const ALIEN_OFFSET_X = 50;
const ALIEN_OFFSET_Y = 50;
const ALIEN_DROP_HEIGHT = 20;

// --- Types ---
type Position = { x: number; y: number };
type Bullet = Position & { active: boolean; fromPlayer: boolean };
type Alien = Position & { active: boolean };

interface GameState {
  playerX: number;
  bullets: Bullet[];
  aliens: Alien[];
  alienDirection: number; // 1 for right, -1 for left
  score: number;
  gameOver: boolean;
  gameWon: boolean;
  lastAlienMoveTime: number;
  alienMoveInterval: number;
}

const SpaceInvaders: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Mutable game state (ref allows access inside animation frame without closure issues)
  const gameState = useRef<GameState>({
    playerX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
    bullets: [],
    aliens: [],
    alienDirection: 1,
    score: 0,
    gameOver: false,
    gameWon: false,
    lastAlienMoveTime: 0,
    alienMoveInterval: 800, // ms per step (decreases as they speed up)
  });

  // Input state
  const keys = useRef<{ [key: string]: boolean }>({});

  // Initialize Game
  const initGame = () => {
    const aliens: Alien[] = [];
    for (let r = 0; r < ALIEN_ROWS; r++) {
      for (let c = 0; c < ALIEN_COLS; c++) {
        aliens.push({
          x: ALIEN_OFFSET_X + c * (ALIEN_WIDTH + ALIEN_PADDING),
          y: ALIEN_OFFSET_Y + r * (ALIEN_HEIGHT + ALIEN_PADDING),
          active: true,
        });
      }
    }

    gameState.current = {
      playerX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
      bullets: [],
      aliens,
      alienDirection: 1,
      score: 0,
      gameOver: false,
      gameWon: false,
      lastAlienMoveTime: 0,
      alienMoveInterval: 600,
    };
  };

  useEffect(() => {
    initGame();

    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      
      // Fire bullet on Space
      if (e.code === 'Space' && !gameState.current.gameOver && !gameState.current.gameWon) {
        // Limit player bullets (optional simple cooldown by checking existing count or time)
        const activePlayerBullets = gameState.current.bullets.filter(b => b.active && b.fromPlayer).length;
        if (activePlayerBullets < 3) {
             gameState.current.bullets.push({
                x: gameState.current.playerX + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2,
                y: CANVAS_HEIGHT - PLAYER_HEIGHT - 10,
                active: true,
                fromPlayer: true
             });
        }
      }

      // Restart
      if (e.code === 'Enter' && (gameState.current.gameOver || gameState.current.gameWon)) {
        initGame();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Start Loop
    requestRef.current = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const update = (time: number) => {
    const state = gameState.current;
    if (!state.gameOver && !state.gameWon) {
      // 1. Player Movement
      if (keys.current['ArrowLeft']) state.playerX = Math.max(0, state.playerX - PLAYER_SPEED);
      if (keys.current['ArrowRight']) state.playerX = Math.min(CANVAS_WIDTH - PLAYER_WIDTH, state.playerX + PLAYER_SPEED);

      // 2. Bullet Movement
      state.bullets.forEach(b => {
        if (b.active) {
          b.y += b.fromPlayer ? -BULLET_SPEED : BULLET_SPEED;
          // Deactivate if off screen
          if (b.y < 0 || b.y > CANVAS_HEIGHT) b.active = false;
        }
      });

      // 3. Alien Movement (Grid logic)
      if (time - state.lastAlienMoveTime > state.alienMoveInterval) {
        state.lastAlienMoveTime = time;
        
        let hitEdge = false;
        const activeAliens = state.aliens.filter(a => a.active);
        
        // Check edges
        activeAliens.forEach(a => {
            const nextX = a.x + (state.alienDirection * 10); // Move 10px per step
            if (nextX <= 0 || nextX + ALIEN_WIDTH >= CANVAS_WIDTH) {
                hitEdge = true;
            }
        });

        if (hitEdge) {
            state.alienDirection *= -1;
            state.aliens.forEach(a => a.y += ALIEN_DROP_HEIGHT);
            
            // Check Game Over (Invasion successful)
            if (activeAliens.some(a => a.y + ALIEN_HEIGHT >= CANVAS_HEIGHT - PLAYER_HEIGHT)) {
                state.gameOver = true;
            }
        } else {
            state.aliens.forEach(a => a.x += state.alienDirection * 10);
        }
        
        // Alien Shooting (Random chance)
        if (Math.random() < 0.05 && activeAliens.length > 0) {
            const shooter = activeAliens[Math.floor(Math.random() * activeAliens.length)];
            state.bullets.push({
                x: shooter.x + ALIEN_WIDTH / 2,
                y: shooter.y + ALIEN_HEIGHT,
                active: true,
                fromPlayer: false
            });
        }
      }

      // 4. Collisions
      // Player Bullet vs Alien
      state.bullets.filter(b => b.active && b.fromPlayer).forEach(b => {
        state.aliens.forEach(a => {
            if (a.active && 
                b.x < a.x + ALIEN_WIDTH && 
                b.x + BULLET_WIDTH > a.x && 
                b.y < a.y + ALIEN_HEIGHT && 
                b.y + BULLET_HEIGHT > a.y) {
                    a.active = false;
                    b.active = false;
                    state.score += 10;
                    // Speed up slightly
                    state.alienMoveInterval = Math.max(100, state.alienMoveInterval * 0.98);
            }
        });
      });

      // Alien Bullet vs Player
      const playerRect = { x: state.playerX, y: CANVAS_HEIGHT - PLAYER_HEIGHT - 10, w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
      state.bullets.filter(b => b.active && !b.fromPlayer).forEach(b => {
         if (b.x < playerRect.x + playerRect.w &&
             b.x + BULLET_WIDTH > playerRect.x &&
             b.y < playerRect.y + playerRect.h &&
             b.y + BULLET_HEIGHT > playerRect.y) {
                 state.gameOver = true;
         }
      });

      // Cleanup inactive bullets
      state.bullets = state.bullets.filter(b => b.active);

      // Check Win
      if (state.aliens.every(a => !a.active)) {
          state.gameWon = true;
      }
    }

    draw();
    requestRef.current = requestAnimationFrame(update);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear Background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Player
    ctx.fillStyle = '#00FF00'; // Green
    ctx.fillRect(gameState.current.playerX, CANVAS_HEIGHT - PLAYER_HEIGHT - 10, PLAYER_WIDTH, PLAYER_HEIGHT);
    // Simple turret detail
    ctx.fillRect(gameState.current.playerX + PLAYER_WIDTH/2 - 5, CANVAS_HEIGHT - PLAYER_HEIGHT - 20, 10, 10);

    // Draw Aliens
    ctx.fillStyle = '#FFFFFF';
    gameState.current.aliens.forEach(a => {
        if (a.active) {
            ctx.fillRect(a.x, a.y, ALIEN_WIDTH, ALIEN_HEIGHT);
            // Eyes
            ctx.fillStyle = 'black';
            ctx.fillRect(a.x + 5, a.y + 5, 5, 5);
            ctx.fillRect(a.x + ALIEN_WIDTH - 10, a.y + 5, 5, 5);
            ctx.fillStyle = '#FFFFFF';
        }
    });

    // Draw Bullets
    gameState.current.bullets.forEach(b => {
        ctx.fillStyle = b.fromPlayer ? '#FFFF00' : '#FF0000';
        ctx.fillRect(b.x, b.y, BULLET_WIDTH, BULLET_HEIGHT);
    });

    // Draw HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px "Press Start 2P", sans-serif'; // Fallback to sans-serif
    ctx.fillText(`SCORE: ${gameState.current.score}`, 20, 30);

    // Game Over / Win Screen
    if (gameState.current.gameOver) {
        ctx.fillStyle = 'red';
        ctx.font = '50px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'white';
        ctx.fillText('Press ENTER to Restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
        ctx.textAlign = 'left';
    } else if (gameState.current.gameWon) {
        ctx.fillStyle = 'green';
        ctx.font = '50px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('YOU WIN!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'white';
        ctx.fillText('Press ENTER to Restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
        ctx.textAlign = 'left';
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#222' }}>
      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT}
        style={{ border: '4px solid #444', background: '#000', boxShadow: '0 0 20px rgba(0,255,0,0.2)' }}
      />
    </div>
  );
};

export default SpaceInvaders;
