/**
 * HUD.tsx - World-Matched, Low-Occlusion Game Shell & HUD.
 * Title Screen with Bespoke SVG Lockup, In-Game Status Clusters,
 * Combo Multiplier Gauge, Upgrade Garage Modal, Pause & Victory Modals,
 * and Mobile Virtual Touch Controls.
 */
import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  Wrench,
  Sparkles,
  Zap,
  Gift,
  CheckCircle2,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { GameHUDState } from '../game/GameCanvas.tsx';
import {
  PlayerUpgrades,
  UPGRADE_DEFINITIONS,
  getUpgradeCost,
  getUpgradeValue,
  STAGES,
} from '../game/rules.ts';
import { soundManager } from '../game/audio.ts';

interface HUDProps {
  hudState: GameHUDState;
  upgrades: PlayerUpgrades;
  coins: number;
  onStartGame: () => void;
  onResumeGame: () => void;
  onPauseGame: () => void;
  onRestartStage: () => void;
  onSelectStage: (stageIndex: number) => void;
  onBuyUpgrade: (upgradeKey: keyof PlayerUpgrades) => void;
  onToggleMute: () => void;
  onVirtualTouchInput?: (input: { throttle: number; steer: number; boost: boolean }) => void;
}

export const HUD: React.FC<HUDProps> = ({
  hudState,
  upgrades,
  coins,
  onStartGame,
  onResumeGame,
  onPauseGame,
  onRestartStage,
  onSelectStage,
  onBuyUpgrade,
  onToggleMute,
  onVirtualTouchInput,
}) => {
  const [showGarage, setShowGarage] = useState(false);
  const { gameState, stage, clearedPercent, comboMultiplier, comboTierName, comboTimeLeft, speedMps, boostPercent, buriedFoundCount, totalBuriedCount, timeElapsed, isMuted } = hudState;

  // Toggle garage on 'e' or 'u'
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'u') {
        setShowGarage((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Format time mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-10 flex flex-col justify-between font-sans">
      {/* =========================================================================
          TITLE SCREEN
          ========================================================================= */}
      {gameState === 'title' && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-between p-6 md:p-10 bg-slate-950/40 backdrop-blur-[2px]">
          {/* Top branding bar */}
          <div className="w-full flex justify-between items-center max-w-5xl">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-xs font-semibold text-sky-300">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              ALPINE WINTER 3D ENGINE
            </div>
            <button
              onClick={onToggleMute}
              className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
            </button>
          </div>

          {/* Bespoke Center Title Lockup */}
          <div className="flex flex-col items-center text-center my-auto max-w-2xl">
            {/* Inline SVG Title Emblem */}
            <svg
              className="w-24 h-24 mb-4 drop-shadow-[0_0_24px_rgba(56,189,248,0.5)]"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <polygon points="50,6 63,32 94,36 71,57 78,88 50,72 22,88 29,57 6,36 37,32" fill="#38bdf8" fillOpacity="0.18" stroke="#38bdf8" strokeWidth="2.5" />
              <path d="M24 72 L76 72 L68 56 L32 56 Z" fill="#f59e0b" stroke="#fbbf24" strokeWidth="2" />
              <path d="M36 56 L38 42 L62 42 L64 56 Z" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
              <path d="M18 78 L82 78 L78 84 L22 84 Z" fill="#94a3b8" />
              <circle cx="50" cy="38" r="4" fill="#fbbf24" />
            </svg>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-2 font-mono text-ice-glow uppercase">
              FROSTPLOW
            </h1>
            <p className="text-base md:text-xl text-slate-300 font-medium max-w-lg mb-8">
              A cozy 3D snow-clearing adventure. Clear alpine streets, discover buried secrets, chain combo multipliers, and tune your snowcat.
            </p>

            {/* Stage Selector Pills */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {STAGES.map((stg, idx) => (
                <button
                  key={stg.id}
                  onClick={() => onSelectStage(idx)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${
                    stage.id === stg.id
                      ? 'bg-amber-500/90 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/30 font-bold'
                      : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                  }`}
                >
                  Stage {stg.id}: {stg.name}
                </button>
              ))}
            </div>

            {/* Primary Start CTA Button */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={onStartGame}
                data-start="true"
                className="px-10 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xl tracking-wide shadow-xl shadow-amber-500/30 transition transform hover:scale-105 active:scale-95 flex items-center gap-3 cursor-pointer"
              >
                <Play className="w-6 h-6 fill-current" />
                START PLOWING
              </button>

              <button
                onClick={() => setShowGarage(true)}
                className="px-6 py-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-base transition flex items-center gap-2 cursor-pointer"
              >
                <Wrench className="w-5 h-5 text-amber-400" />
                UPGRADES GARAGE
              </button>
            </div>
          </div>

          {/* Bottom Control Hint */}
          <div className="text-slate-400 text-xs md:text-sm tracking-wide font-medium">
            WASD / Arrow Keys Drive · Space Nitro Boost · E Garage · Esc Pause
          </div>
        </div>
      )}

      {/* =========================================================================
          IN-GAME HUD (LOW-OCCLUSION PLAYING OVERLAY)
          ========================================================================= */}
      {gameState === 'playing' && (
        <>
          {/* Top Row: Left Stage Info, Center Combo, Right Coins & Menu */}
          <div className="p-2 sm:p-4 md:p-6 flex flex-wrap sm:flex-nowrap justify-between items-start w-full gap-2">
            {/* Top-Left: District Contract & Snow Cleared Progress */}
            <div className="flex flex-col gap-1 p-2 sm:p-3 rounded-2xl bg-slate-950/85 border border-slate-700/60 shadow-lg min-w-[140px] sm:min-w-[210px]">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span className="truncate max-w-[110px] sm:max-w-none">{stage.name}</span>
                <span className="text-sky-300 font-mono tabular-nums">{formatTime(timeElapsed)}</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-2.5 sm:h-3 rounded-full overflow-hidden p-0.5 border border-slate-700/80">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 to-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (clearedPercent / stage.targetPercent) * 100)}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold">
                <span className="text-slate-200 tabular-nums">
                  {clearedPercent}% <span className="text-slate-400 font-normal">/ {stage.targetPercent}%</span>
                </span>
                <span className="text-amber-400 flex items-center gap-1 font-mono">
                  <Gift className="w-3 h-3" />
                  {buriedFoundCount}/{totalBuriedCount}
                </span>
              </div>
            </div>

            {/* Top-Right: Currency, Garage, Sound, Pause Buttons */}
            <div className="flex items-center gap-1 sm:gap-2 pointer-events-auto">
              {/* Coins Counter */}
              <div className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-950/85 border border-slate-700/80 text-amber-300 font-mono font-bold text-xs sm:text-sm shadow-md tabular-nums">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{coins.toLocaleString()}</span>
              </div>

              {/* Garage Button */}
              <button
                onClick={() => setShowGarage(true)}
                className="p-1.5 sm:p-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700 text-amber-400 transition cursor-pointer"
                aria-label="Open Upgrades Garage"
                title="Upgrades Garage (E)"
              >
                <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Mute Button */}
              <button
                onClick={onToggleMute}
                className="p-1.5 sm:p-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700 text-slate-300 transition cursor-pointer"
                aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />}
              </button>

              {/* Pause Button */}
              <button
                onClick={onPauseGame}
                className="p-1.5 sm:p-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700 text-slate-300 transition cursor-pointer"
                aria-label="Pause Game"
                title="Pause (Esc)"
              >
                <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Center: COMBO MULTIPLIER (Dynamic Heat & Chime Meter) */}
            <div className="flex flex-col items-center w-full sm:w-auto order-last sm:order-none mt-1 sm:mt-0">
              <div
                className={`px-3 py-1 sm:px-5 sm:py-2 rounded-2xl border transition-all transform duration-200 flex items-center gap-2 sm:gap-3 ${
                  comboMultiplier > 1.0
                    ? 'bg-amber-950/90 border-amber-500/80 shadow-lg shadow-amber-500/20 scale-105'
                    : 'bg-slate-950/60 border-slate-800 opacity-80'
                }`}
              >
                <Flame className={`w-4 h-4 sm:w-5 sm:h-5 ${comboMultiplier > 1.0 ? 'text-amber-400 animate-bounce' : 'text-slate-500'}`} />
                <div className="flex flex-col items-center">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-amber-400/90 font-mono">
                    {comboTierName}
                  </span>
                  <span className="text-xl sm:text-2xl md:text-3xl font-black font-mono tracking-tight text-white tabular-nums">
                    x{comboMultiplier.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Combo Grace Timer Bar */}
              {comboTimeLeft > 0 && (
                <div className="w-24 sm:w-28 bg-slate-800/80 h-1 sm:h-1.5 rounded-full overflow-hidden mt-1 border border-amber-500/40">
                  <div
                    className="h-full bg-amber-400 transition-all duration-75"
                    style={{ width: `${(comboTimeLeft / 1.8) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Bottom Center: Speedometer & Hot Cocoa Boost Meter */}
          <div className="p-4 md:p-6 flex flex-col items-center gap-2 pointer-events-none">
            <div className="flex items-center gap-4 px-5 py-2 rounded-2xl bg-slate-950/80 border border-slate-700/70 shadow-xl">
              {/* Speed */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">SPEED</span>
                <span className="text-xl font-bold font-mono text-white tabular-nums">
                  {Math.round(speedMps * 3.6)} <span className="text-xs font-normal text-slate-400">km/h</span>
                </span>
              </div>

              <div className="w-[1px] h-8 bg-slate-700"></div>

              {/* Boost Tank */}
              <div className="flex flex-col gap-1 w-32">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider font-mono">
                  <span className="text-sky-300 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-sky-400" />
                    NITRO BOOST
                  </span>
                  <span className="text-slate-300 tabular-nums">{Math.round(boostPercent)}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 to-cyan-300 rounded-full transition-all duration-100"
                    style={{ width: `${boostPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Mobile On-Screen Virtual Controls */}
            <div className="w-full flex justify-between items-end px-4 pb-2 md:hidden pointer-events-auto">
              {/* Steer D-Pad */}
              <div className="flex gap-2">
                <button
                  onPointerDown={() => onVirtualTouchInput?.({ throttle: 0, steer: -1, boost: false })}
                  onPointerUp={() => onVirtualTouchInput?.({ throttle: 0, steer: 0, boost: false })}
                  className="w-14 h-14 rounded-2xl bg-slate-900/90 border border-slate-700 text-white font-bold flex items-center justify-center active:bg-amber-500 active:text-slate-950"
                  aria-label="Steer Left"
                >
                  ◀
                </button>
                <button
                  onPointerDown={() => onVirtualTouchInput?.({ throttle: 0, steer: 1, boost: false })}
                  onPointerUp={() => onVirtualTouchInput?.({ throttle: 0, steer: 0, boost: false })}
                  className="w-14 h-14 rounded-2xl bg-slate-900/90 border border-slate-700 text-white font-bold flex items-center justify-center active:bg-amber-500 active:text-slate-950"
                  aria-label="Steer Right"
                >
                  ▶
                </button>
              </div>

              {/* Throttle & Boost */}
              <div className="flex gap-2">
                <button
                  onPointerDown={() => onVirtualTouchInput?.({ throttle: -1, steer: 0, boost: false })}
                  onPointerUp={() => onVirtualTouchInput?.({ throttle: 0, steer: 0, boost: false })}
                  className="w-14 h-14 rounded-2xl bg-slate-900/90 border border-slate-700 text-white font-bold flex items-center justify-center active:bg-slate-800"
                  aria-label="Reverse"
                >
                  REV
                </button>
                <button
                  onPointerDown={() => onVirtualTouchInput?.({ throttle: 1, steer: 0, boost: false })}
                  onPointerUp={() => onVirtualTouchInput?.({ throttle: 0, steer: 0, boost: false })}
                  className="w-16 h-16 rounded-2xl bg-amber-500 text-slate-950 font-black text-lg flex items-center justify-center active:bg-amber-400"
                  aria-label="Drive Forward"
                >
                  GO
                </button>
                <button
                  onPointerDown={() => onVirtualTouchInput?.({ throttle: 1, steer: 0, boost: true })}
                  onPointerUp={() => onVirtualTouchInput?.({ throttle: 0, steer: 0, boost: false })}
                  className="w-14 h-14 rounded-2xl bg-cyan-600 text-white font-bold flex items-center justify-center active:bg-cyan-400"
                  aria-label="Nitro Boost"
                >
                  ⚡
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          UPGRADE GARAGE MODAL
          ========================================================================= */}
      {showGarage && (
        <div className="pointer-events-auto fixed inset-0 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-[2px] z-20">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white font-mono uppercase">VILLAGE SNOWCAT GARAGE</h2>
                  <p className="text-xs text-slate-400">Upgrade your vehicle components for wider clearing and speed</p>
                </div>
              </div>

              {/* Coins in shop */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-mono font-bold text-base tabular-nums">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{coins.toLocaleString()}</span>
              </div>
            </div>

            {/* Upgrades List */}
            <div className="flex flex-col gap-3">
              {(Object.keys(UPGRADE_DEFINITIONS) as Array<keyof PlayerUpgrades>).map((key) => {
                const def = UPGRADE_DEFINITIONS[key];
                const currentLvl = upgrades[key];
                const cost = getUpgradeCost(key, currentLvl);
                const isMax = currentLvl >= def.maxLevel;
                const canAfford = coins >= cost && !isMax;
                const currentVal = getUpgradeValue(key, currentLvl);
                const nextVal = !isMax ? getUpgradeValue(key, currentLvl + 1) : currentVal;

                return (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-2xl bg-slate-950/70 border border-slate-800 gap-3"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-100">{def.name}</span>
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                          Lv. {currentLvl} / {def.maxLevel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {def.descriptions[Math.min(currentLvl, def.descriptions.length - 1)]}
                      </p>
                      <div className="text-xs font-mono text-sky-300">
                        Current: <span className="font-bold">{currentVal.toFixed(1)} {def.unit}</span>
                        {!isMax && (
                          <span className="text-emerald-400 font-bold ml-2">
                            → {nextVal.toFixed(1)} {def.unit}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        soundManager.playUpgradeSound();
                        onBuyUpgrade(key);
                      }}
                      disabled={!canAfford}
                      className={`px-5 py-2.5 rounded-xl font-bold font-mono text-sm transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                        isMax
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          : canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700/50'
                      }`}
                    >
                      {isMax ? (
                        <span>MAX LEVEL</span>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>{cost.toLocaleString()} ❄️</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowGarage(false)}
              className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm tracking-wide transition border border-slate-700 cursor-pointer"
            >
              RETURN TO VILLAGE
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          PAUSE MODAL
          ========================================================================= */}
      {gameState === 'paused' && (
        <div className="pointer-events-auto fixed inset-0 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-[2px] z-20">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center text-center gap-6">
            <h2 className="text-3xl font-black text-white font-mono uppercase tracking-wide">GAME PAUSED</h2>

            <div className="w-full flex flex-col gap-3">
              <button
                onClick={onResumeGame}
                className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                RESUME CONTRACT
              </button>

              <button
                onClick={() => setShowGarage(true)}
                className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
              >
                <Wrench className="w-4 h-4 text-amber-400" />
                UPGRADE GARAGE
              </button>

              <button
                onClick={onRestartStage}
                className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                RESTART CURRENT STAGE
              </button>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Press Esc or P to resume · M to mute sound
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VICTORY / STAGE CLEAR MODAL
          ========================================================================= */}
      {gameState === 'victory' && (
        <div className="pointer-events-auto fixed inset-0 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-[2px] z-20">
          <div className="w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center text-center gap-6 animate-in fade-in duration-300">
            {/* Header Badge */}
            <div className="p-4 rounded-3xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <span className="text-xs font-black uppercase tracking-widest text-amber-400 font-mono">
                CONTRACT COMPLETED
              </span>
              <h2 className="text-3xl md:text-4xl font-black text-white font-mono uppercase mt-1">
                {stage.name}
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                The streets are cleared! The cozy villagers can now safely travel.
              </p>
            </div>

            {/* Performance Metrics Tiles */}
            <div className="grid grid-cols-2 gap-3 w-full text-left font-mono">
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">CLEARED SNOW</span>
                <div className="text-xl font-bold text-sky-300 tabular-nums">{clearedPercent}%</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">TIME ELAPSED</span>
                <div className="text-xl font-bold text-slate-200 tabular-nums">{formatTime(timeElapsed)}</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">MAX COMBO</span>
                <div className="text-xl font-bold text-amber-400 tabular-nums">x{hudState.comboMultiplier.toFixed(1)}</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">SECRETS FOUND</span>
                <div className="text-xl font-bold text-emerald-400 tabular-nums">{buriedFoundCount}/{totalBuriedCount}</div>
              </div>
            </div>

            {/* Coins Earned Breakdown */}
            {hudState.scoreBreakdown && (
              <div className="w-full p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-xs font-mono text-amber-200 flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span>Base Snow Cleared:</span>
                  <span className="font-bold tabular-nums">+{hudState.scoreBreakdown.baseCoins} ❄️</span>
                </div>
                {hudState.scoreBreakdown.timeBonus > 0 && (
                  <div className="flex justify-between">
                    <span>Speed Par Bonus:</span>
                    <span className="font-bold tabular-nums">+{hudState.scoreBreakdown.timeBonus} ❄️</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Combo Streak Bonus:</span>
                  <span className="font-bold tabular-nums">+{hudState.scoreBreakdown.comboBonus} ❄️</span>
                </div>
                {hudState.scoreBreakdown.secretsBonus > 0 && (
                  <div className="flex justify-between">
                    <span>Buried Gifts & Snowmen:</span>
                    <span className="font-bold tabular-nums">+{hudState.scoreBreakdown.secretsBonus} ❄️</span>
                  </div>
                )}
                <div className="w-full h-[1px] bg-amber-500/30 my-1"></div>
                <div className="flex justify-between text-sm font-bold text-amber-300">
                  <span>Total Bonus Earned:</span>
                  <span className="tabular-nums">+{hudState.scoreBreakdown.totalCoins} ❄️</span>
                </div>
              </div>
            )}

            {/* Next / Play Again Actions */}
            <div className="w-full flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  const nextIdx = (stage.id) % STAGES.length;
                  onSelectStage(nextIdx);
                  onStartGame();
                }}
                data-start="true"
                className="flex-1 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <span>NEXT STAGE</span>
                <ChevronRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => setShowGarage(true)}
                className="py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
              >
                <Wrench className="w-4 h-4 text-amber-400" />
                GARAGE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
