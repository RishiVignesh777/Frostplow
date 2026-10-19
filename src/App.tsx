/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameCanvas, GameHUDState } from './game/GameCanvas.tsx';
import { HUD } from './components/HUD.tsx';
import {
  PlayerUpgrades,
  DEFAULT_UPGRADES,
  STAGES,
  getUpgradeCost,
} from './game/rules.ts';
import { soundManager } from './game/audio.ts';

const UPGRADES_STORAGE_KEY = 'frostplow_upgrades';
const COINS_STORAGE_KEY = 'frostplow_coins';

export default function App() {
  const [gameState, setGameState] = useState<'title' | 'playing' | 'paused' | 'victory'>('title');
  const [stageIndex, setStageIndex] = useState<number>(0);
  const [coins, setCoins] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(COINS_STORAGE_KEY);
      return saved ? parseInt(saved, 10) : 150; // start with 150 starter coins
    } catch {
      return 150;
    }
  });

  const [upgrades, setUpgrades] = useState<PlayerUpgrades>(() => {
    try {
      const saved = localStorage.getItem(UPGRADES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_UPGRADES;
    } catch {
      return DEFAULT_UPGRADES;
    }
  });

  const [virtualInput, setVirtualInput] = useState<{ throttle: number; steer: number; boost: boolean }>({
    throttle: 0,
    steer: 0,
    boost: false,
  });

  const [hudState, setHudState] = useState<GameHUDState>({
    gameState: 'title',
    clearedPercent: 0,
    totalClearable: 1,
    currentStreak: 0,
    comboMultiplier: 1.0,
    comboTierName: 'CRUISING',
    comboTimeLeft: 0,
    speedMps: 0,
    boostPercent: 100,
    snowCoins: 0,
    stage: STAGES[0],
    buriedFoundCount: 0,
    totalBuriedCount: 0,
    timeElapsed: 0,
    isMuted: false,
  });

  // Mirror game state to document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = gameState === 'victory' ? 'gameover' : gameState;
  }, [gameState]);

  // Support ?autostart=1 query parameter to boot straight into playing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        soundManager.init();
        soundManager.resume();
        setGameState('playing');
      }
    }
  }, []);

  // Sync coins to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(COINS_STORAGE_KEY, coins.toString());
    } catch {
      // Ignore
    }
  }, [coins]);

  // Sync upgrades to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(UPGRADES_STORAGE_KEY, JSON.stringify(upgrades));
    } catch {
      // Ignore
    }
  }, [upgrades]);

  const handleStartGame = useCallback(() => {
    soundManager.init();
    soundManager.resume();
    setGameState('playing');
  }, []);

  const handleResumeGame = useCallback(() => {
    soundManager.resume();
    setGameState('playing');
  }, []);

  const handlePauseGame = useCallback(() => {
    setGameState('paused');
  }, []);

  const handleRestartStage = useCallback(() => {
    // Re-mount canvas for current stage
    setStageIndex((prev) => prev);
    setGameState('playing');
  }, []);

  const handleSelectStage = useCallback((idx: number) => {
    setStageIndex(idx);
    setHudState((prev) => ({ ...prev, stage: STAGES[idx] || STAGES[0] }));
  }, []);

  const handleBuyUpgrade = useCallback((upgradeKey: keyof PlayerUpgrades) => {
    setUpgrades((prev) => {
      const currentLevel = prev[upgradeKey];
      const cost = getUpgradeCost(upgradeKey, currentLevel);
      if (coins >= cost) {
        setCoins((c) => c - cost);
        return {
          ...prev,
          [upgradeKey]: currentLevel + 1,
        };
      }
      return prev;
    });
  }, [coins]);

  const handleToggleMute = useCallback(() => {
    const isMuted = soundManager.toggleMute();
    setHudState((prev) => ({ ...prev, isMuted }));
  }, []);

  const handleVictory = useCallback((summary: GameHUDState) => {
    setGameState('victory');
    setHudState(summary);
    if (summary.scoreBreakdown) {
      setCoins((c) => c + summary.scoreBreakdown!.totalCoins);
    }
  }, []);

  const handleCoinsEarned = useCallback((amount: number) => {
    setCoins((c) => c + amount);
  }, []);

  // Global key bindings for Start (Enter/Space), Pause (Esc/P), Garage (E)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'title') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleStartGame();
        }
      } else if (gameState === 'playing') {
        if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
          e.preventDefault();
          handlePauseGame();
        }
      } else if (gameState === 'paused') {
        if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
          e.preventDefault();
          handleResumeGame();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, handleStartGame, handlePauseGame, handleResumeGame]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* 3D WebGL Canvas Layer */}
      <GameCanvas
        gameState={gameState}
        stageIndex={stageIndex}
        upgrades={upgrades}
        onUpdateHUD={(update) => setHudState((prev) => ({ ...prev, ...update }))}
        onVictory={handleVictory}
        onCoinsEarned={handleCoinsEarned}
        virtualInput={virtualInput}
      />

      {/* Low-Occlusion HUD & Game Shell Overlays */}
      <HUD
        hudState={{ ...hudState, gameState }}
        upgrades={upgrades}
        coins={coins}
        onStartGame={handleStartGame}
        onResumeGame={handleResumeGame}
        onPauseGame={handlePauseGame}
        onRestartStage={handleRestartStage}
        onSelectStage={handleSelectStage}
        onBuyUpgrade={handleBuyUpgrade}
        onToggleMute={handleToggleMute}
        onVirtualTouchInput={setVirtualInput}
      />
    </div>
  );
}
