/**
 * GameCanvas.tsx - WebGL Three.js isometric viewport and 60fps simulation loop.
 * Features stable React ref decoupling, procedural RoomEnvironment, clamped dt,
 * headless software rendering optimization, and smooth camera damping.
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SnowplowVehicle } from './vehicle.ts';
import { SnowGrid, BuriedItem } from './snowGrid.ts';
import { VillageEnvironment } from './environment.ts';
import { ParticlePool } from './particles.ts';
import { soundManager } from './audio.ts';
import {
  PlayerUpgrades,
  calculateCombo,
  COMBO_MAX_TIMER,
  StageConfig,
  STAGES,
  calculateRunScore,
} from './rules.ts';

export interface GameHUDState {
  gameState: 'title' | 'playing' | 'paused' | 'victory';
  clearedPercent: number;
  totalClearable: number;
  currentStreak: number;
  comboMultiplier: number;
  comboTierName: string;
  comboTimeLeft: number;
  speedMps: number;
  boostPercent: number;
  snowCoins: number;
  stage: StageConfig;
  buriedFoundCount: number;
  totalBuriedCount: number;
  timeElapsed: number;
  isMuted: boolean;
  scoreBreakdown?: {
    baseCoins: number;
    timeBonus: number;
    comboBonus: number;
    secretsBonus: number;
    totalCoins: number;
  };
}

interface GameCanvasProps {
  gameState: 'title' | 'playing' | 'paused' | 'victory';
  stageIndex: number;
  upgrades: PlayerUpgrades;
  onUpdateHUD: (state: Partial<GameHUDState>) => void;
  onVictory: (summary: GameHUDState) => void;
  onCoinsEarned: (amount: number) => void;
  virtualInput?: { throttle: number; steer: number; boost: boolean };
}

// Reusable scratch objects (Zero GC)
const _cameraTarget = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  stageIndex,
  upgrades,
  onUpdateHUD,
  onVictory,
  onCoinsEarned,
  virtualInput,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // References for mutable game loop state (never causing React rerender)
  const stateRef = useRef<{
    gameState: 'title' | 'playing' | 'paused' | 'victory';
    stageIndex: number;
    upgrades: PlayerUpgrades;
    virtualInput?: { throttle: number; steer: number; boost: boolean };
    keys: {
      up: boolean;
      down: boolean;
      left: boolean;
      right: boolean;
      boost: boolean;
    };
    comboStreak: number;
    comboTimer: number;
    maxComboReached: number;
    timeElapsed: number;
    snowCoins: number;
    buriedFoundCount: number;
    totalBuriedCount: number;
  }>({
    gameState,
    stageIndex,
    upgrades,
    virtualInput,
    keys: { up: false, down: false, left: false, right: false, boost: false },
    comboStreak: 0,
    comboTimer: 0,
    maxComboReached: 1.0,
    timeElapsed: 0,
    snowCoins: 0,
    buriedFoundCount: 0,
    totalBuriedCount: 0,
  });

  // Keep stateRef in sync with props
  useEffect(() => {
    stateRef.current.gameState = gameState;
  }, [gameState]);

  useEffect(() => {
    stateRef.current.stageIndex = stageIndex;
  }, [stageIndex]);

  useEffect(() => {
    stateRef.current.upgrades = upgrades;
  }, [upgrades]);

  useEffect(() => {
    stateRef.current.virtualInput = virtualInput;
  }, [virtualInput]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect headless software WebGL
    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb0c4de); // soft winter periwinkle sky
    scene.fog = new THREE.FogExp2(0xb0c4de, 0.016);

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      250
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
      precision: isHeadless ? 'mediump' : 'highp',
    });

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);

    if (!isHeadless) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    container.appendChild(renderer.domElement);

    // Procedural Studio Environment Reflection
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch {
      // Ignore in restricted environments
    }

    // 2. Lighting Rig (Key + Hemisphere Fill)
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x334155, 0.9); // cool blue sky vs warm dark ground
    scene.add(hemiLight);

    const dirKeyLight = new THREE.DirectionalLight(0xfef08a, 1.35); // warm golden sun
    dirKeyLight.position.set(28, 45, 22);
    if (!isHeadless) {
      dirKeyLight.castShadow = true;
      dirKeyLight.shadow.mapSize.width = 1024;
      dirKeyLight.shadow.mapSize.height = 1024;
      dirKeyLight.shadow.camera.near = 10;
      dirKeyLight.shadow.camera.far = 90;
      dirKeyLight.shadow.camera.left = -30;
      dirKeyLight.shadow.camera.right = 30;
      dirKeyLight.shadow.camera.top = 30;
      dirKeyLight.shadow.camera.bottom = -30;
      dirKeyLight.shadow.bias = -0.0005;
    }
    scene.add(dirKeyLight);

    // 3. Game Subsystems
    const currentStage = STAGES[stateRef.current.stageIndex] || STAGES[0];
    const mapSize = currentStage.mapSize;

    // Snow Grid System & Ground Plane
    const snowGrid = new SnowGrid(mapSize, 128);
    snowGrid.generateBuriedItems(
      currentStage.buriedPresentsCount,
      currentStage.strandedSnowmenCount
    );

    stateRef.current.totalBuriedCount = snowGrid.buriedItems.length;
    stateRef.current.buriedFoundCount = 0;

    const groundGeo = new THREE.PlaneGeometry(mapSize * 2, mapSize * 2);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      map: snowGrid.groundTexture,
      roughness: 0.85,
      metalness: 0.05,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.y = 0;
    scene.add(groundMesh);

    // Village Environment
    const village = new VillageEnvironment(mapSize);
    village.setupBuriedItemMeshes(snowGrid.buriedItems);
    scene.add(village.group);

    // Particle Pool
    const particles = new ParticlePool();
    scene.add(particles.group);

    // Player Snowplow Vehicle
    const vehicle = new SnowplowVehicle(0, 5);
    vehicle.applyUpgrades(stateRef.current.upgrades);
    scene.add(vehicle.group);

    // 4. Input Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      soundManager.init();
      soundManager.resume();

      if (e.repeat) return;
      const k = e.key.toLowerCase();

      if (k === 'w' || k === 'arrowup') stateRef.current.keys.up = true;
      if (k === 's' || k === 'arrowdown') stateRef.current.keys.down = true;
      if (k === 'a' || k === 'arrowleft') stateRef.current.keys.left = true;
      if (k === 'd' || k === 'arrowright') stateRef.current.keys.right = true;
      if (k === ' ' || k === 'shift') stateRef.current.keys.boost = true;

      if (k === 'm') {
        const isMuted = soundManager.toggleMute();
        onUpdateHUD({ isMuted });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') stateRef.current.keys.up = false;
      if (k === 's' || k === 'arrowdown') stateRef.current.keys.down = false;
      if (k === 'a' || k === 'arrowleft') stateRef.current.keys.left = false;
      if (k === 'd' || k === 'arrowright') stateRef.current.keys.right = false;
      if (k === ' ' || k === 'shift') stateRef.current.keys.boost = false;
    };

    const handleBlur = () => {
      // Clear held keys on blur (per game craft guidelines)
      stateRef.current.keys.up = false;
      stateRef.current.keys.down = false;
      stateRef.current.keys.left = false;
      stateRef.current.keys.right = false;
      stateRef.current.keys.boost = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    // Window Resize Observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Pre-warm shaders
    renderer.compile(scene, camera);

    // 5. Game Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    let lastRenderTime = 0;
    let hudThrottleTimer = 0;
    let titleCameraAngle = 0;

    const gameLoop = (now: number) => {
      animationFrameId = requestAnimationFrame(gameLoop);

      // In headless software WebGL, cap loop to ~20fps to prevent CPU saturation
      if (isHeadless && now - lastRenderTime < 50) {
        return;
      }
      lastRenderTime = now;

      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05); // Clamped dt to prevent tunneling

      const currentState = stateRef.current.gameState;

      // Handle Title Screen vs Playing Modes
      if (currentState === 'title') {
        // Atmospheric live-world circular camera orbit over the cozy village
        titleCameraAngle += dt * 0.18;
        const orbitRadius = 24;
        camera.position.x = Math.sin(titleCameraAngle) * orbitRadius;
        camera.position.z = Math.cos(titleCameraAngle) * orbitRadius;
        camera.position.y = 16;
        camera.lookAt(0, 1.8, 0);

        village.update(dt);
        particles.update(dt, camera.position);
        renderer.render(scene, camera);
        return;
      }

      if (currentState === 'paused' || currentState === 'victory') {
        // Paused state: keep rendering static view
        renderer.render(scene, camera);
        return;
      }

      // --- PLAYING STATE SIMULATION ---
      stateRef.current.timeElapsed += dt;

      // Merge keyboard and virtual mobile joystick inputs
      const virt = stateRef.current.virtualInput;
      let throttle = 0;
      let steer = 0;
      let boost = stateRef.current.keys.boost;

      if (stateRef.current.keys.up) throttle += 1;
      if (stateRef.current.keys.down) throttle -= 1;
      if (stateRef.current.keys.left) steer -= 1;
      if (stateRef.current.keys.right) steer += 1;

      if (virt) {
        if (Math.abs(virt.throttle) > 0.05) throttle = virt.throttle;
        if (Math.abs(virt.steer) > 0.05) steer = virt.steer;
        if (virt.boost) boost = true;
      }

      // Check plowing action & snow clearing
      const bladeCenter = vehicle.getBladeCenter();
      const isMovingForward = vehicle.currentSpeed > 0.5;

      let isPlowingSnow = false;
      let newlyCleared = 0;
      let foundSecrets: BuriedItem[] = [];

      if (isMovingForward) {
        const plowResult = snowGrid.plowSwath(
          bladeCenter,
          vehicle.heading,
          vehicle.currentBladeWidth,
          vehicle.saltRadius
        );
        newlyCleared = plowResult.newlyClearedCount;
        foundSecrets = plowResult.foundItems;

        if (newlyCleared > 0) {
          isPlowingSnow = true;
        }
      }

      // Vehicle physics update with solid obstacle colliders
      vehicle.applyUpgrades(stateRef.current.upgrades);
      const { hasBumped } = vehicle.update(
        dt,
        { throttle, steer, boost },
        isPlowingSnow,
        mapSize,
        village.colliders
      );

      if (hasBumped) {
        soundManager.playBumpSound();
        particles.emitSnowSpray(vehicle.position, vehicle.heading, 1.8, 2, 0.7);
      }

      // Sound update: boost whoosh
      if (vehicle.isBoosting && boost) {
        particles.emitBoostTrail(vehicle.position, 2);
        if (Math.random() < 0.12) {
          soundManager.playBoostSound();
        }
      }

      // Snow Spray emission
      if (isPlowingSnow) {
        const speedNorm = Math.min(1.5, Math.abs(vehicle.currentSpeed) / 8);
        particles.emitSnowSpray(bladeCenter, vehicle.heading, vehicle.currentBladeWidth, 3, speedNorm);
      }

      // Update Combo Multiplier System
      const prevTier = calculateCombo(stateRef.current.comboStreak, stateRef.current.comboTimer);

      if (newlyCleared > 0) {
        stateRef.current.comboStreak += newlyCleared;
        stateRef.current.comboTimer = COMBO_MAX_TIMER; // reset timer grace period
      } else if (stateRef.current.comboTimer > 0) {
        stateRef.current.comboTimer -= dt;
        if (stateRef.current.comboTimer <= 0) {
          stateRef.current.comboStreak = 0;
          stateRef.current.comboTimer = 0;
        }
      }

      const currentCombo = calculateCombo(stateRef.current.comboStreak, stateRef.current.comboTimer);

      if (currentCombo.multiplier > stateRef.current.maxComboReached) {
        stateRef.current.maxComboReached = currentCombo.multiplier;
      }

      // Award coins for plowed snow with combo multiplier and cannon bonus
      if (newlyCleared > 0) {
        const cannonMultiplier = stateRef.current.upgrades.snowCannon > 0
          ? 1.0 + stateRef.current.upgrades.snowCannon * 0.5
          : 1.0;
        const earned = Math.round(newlyCleared * 0.4 * currentCombo.multiplier * cannonMultiplier);
        if (earned > 0) {
          stateRef.current.snowCoins += earned;
          onCoinsEarned(earned);
        }
      }

      // Play combo tier advance chime
      if (currentCombo.multiplier > prevTier.multiplier) {
        soundManager.playComboChime(Math.round(currentCombo.multiplier));
      }

      // Handle uncovered buried secrets / snowmen
      if (foundSecrets.length > 0) {
        foundSecrets.forEach((item) => {
          village.triggerItemReveal(item.id);
          soundManager.playTreasureFound();
          const bonus = item.type === 'present' ? 60 : 120;
          stateRef.current.snowCoins += bonus;
          stateRef.current.buriedFoundCount++;
          onCoinsEarned(bonus);
        });
      }

      // Update synth audio engine
      const speedNorm = Math.abs(vehicle.currentSpeed) / vehicle.maxSpeed;
      soundManager.updateVehicleAudio(speedNorm, isPlowingSnow, currentCombo.multiplier);

      // Subsystem updates
      village.update(dt);
      particles.update(dt, camera.position);

      // Smooth Isometric Camera Follow Rig (Pitched 45 deg, 45 deg azimuth)
      const isoDist = 18;
      const isoHeight = 15;
      _desiredCamPos.set(
        vehicle.position.x - isoDist * 0.707,
        vehicle.position.y + isoHeight,
        vehicle.position.z - isoDist * 0.707
      );

      // Exponential damping on camera position
      camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredCamPos.x, 5.0, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredCamPos.y, 5.0, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredCamPos.z, 5.0, dt);

      _cameraTarget.set(vehicle.position.x, 1.2, vehicle.position.z);
      camera.lookAt(_cameraTarget);

      // Check Victory Condition (cleared required % of snow)
      const clearedPercent = snowGrid.getClearedPercent();
      const stage = STAGES[stateRef.current.stageIndex] || STAGES[0];

      if (clearedPercent >= stage.targetPercent && stateRef.current.gameState === 'playing') {
        stateRef.current.gameState = 'victory';
        soundManager.playVictoryFanfare();

        const breakdown = calculateRunScore({
          clearedPercent,
          timeElapsed: stateRef.current.timeElapsed,
          parTime: stage.parTimeSeconds,
          maxCombo: stateRef.current.maxComboReached,
          buriedPresentsFound: stateRef.current.buriedFoundCount,
          strandedSnowmenSaved: 0,
          cannonBonus: 1 + stateRef.current.upgrades.snowCannon * 0.5,
        });

        onVictory({
          gameState: 'victory',
          clearedPercent,
          totalClearable: snowGrid.totalClearableCells,
          currentStreak: stateRef.current.comboStreak,
          comboMultiplier: currentCombo.multiplier,
          comboTierName: currentCombo.tierName,
          comboTimeLeft: stateRef.current.comboTimer,
          speedMps: Math.abs(vehicle.currentSpeed),
          boostPercent: (vehicle.boostTimeRemaining / vehicle.maxBoostDuration) * 100,
          snowCoins: stateRef.current.snowCoins,
          stage,
          buriedFoundCount: stateRef.current.buriedFoundCount,
          totalBuriedCount: stateRef.current.totalBuriedCount,
          timeElapsed: stateRef.current.timeElapsed,
          isMuted: soundManager.getIsMuted(),
          scoreBreakdown: breakdown,
        });
      }

      // Throttle React HUD state updates to ~12Hz for silky smooth 60fps simulation
      hudThrottleTimer += dt;
      if (hudThrottleTimer >= 0.08) {
        hudThrottleTimer = 0;
        onUpdateHUD({
          clearedPercent,
          totalClearable: snowGrid.totalClearableCells,
          currentStreak: stateRef.current.comboStreak,
          comboMultiplier: currentCombo.multiplier,
          comboTierName: currentCombo.tierName,
          comboTimeLeft: stateRef.current.comboTimer,
          speedMps: Math.abs(vehicle.currentSpeed),
          boostPercent: (vehicle.boostTimeRemaining / vehicle.maxBoostDuration) * 100,
          snowCoins: stateRef.current.snowCoins,
          stage,
          buriedFoundCount: stateRef.current.buriedFoundCount,
          totalBuriedCount: stateRef.current.totalBuriedCount,
          timeElapsed: stateRef.current.timeElapsed,
        });
      }

      // Render 3D Frame
      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('resize', handleResize);

      snowGrid.dispose();
      particles.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [stageIndex]);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full overflow-hidden bg-slate-900"
      data-testid="three-canvas-mount"
    />
  );
};
