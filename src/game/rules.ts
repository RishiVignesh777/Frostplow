/**
 * Pure game rules, combo calculations, upgrade definitions, and stage configurations.
 * Decoupled from Three.js and DOM for deterministic unit testing.
 */

export interface UpgradeTier {
  level: number;
  maxLevel: number;
  cost: number;
  value: number;
  label: string;
  description: string;
}

export interface PlayerUpgrades {
  bladeWidth: number; // 1 to 5
  enginePower: number; // 1 to 5
  saltSpreader: number; // 0 to 4
  snowCannon: number; // 0 to 4
  boostTank: number; // 1 to 5
}

export const DEFAULT_UPGRADES: PlayerUpgrades = {
  bladeWidth: 1,
  enginePower: 1,
  saltSpreader: 0,
  snowCannon: 0,
  boostTank: 1,
};

export const UPGRADE_DEFINITIONS: Record<keyof PlayerUpgrades, {
  name: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  baseValue: number;
  valuePerLevel: number;
  unit: string;
  descriptions: string[];
}> = {
  bladeWidth: {
    name: "Plow Blade Width",
    maxLevel: 5,
    baseCost: 80,
    costMultiplier: 1.8,
    baseValue: 2.2, // blade width in meters
    valuePerLevel: 0.6,
    unit: "m swath",
    descriptions: [
      "Standard municipal scoop",
      "Reinforced steel wings",
      "Wide highway scraper blade",
      "Heavy V-Plow snow splitter",
      "Titan King V-Plow with wing extensions",
    ],
  },
  enginePower: {
    name: "Engine & Track Power",
    maxLevel: 5,
    baseCost: 100,
    costMultiplier: 1.75,
    baseValue: 8.5, // top speed in m/s
    valuePerLevel: 1.8,
    unit: "m/s top speed",
    descriptions: [
      "Reliable 4-cylinder diesel",
      "Turbocharged snowcat tracks",
      "High-torque alpine crawler",
      "Twin-turbo arctic powerplant",
      "Beast-class hydromatic drive",
    ],
  },
  saltSpreader: {
    name: "Salt & Brine Sprayer",
    maxLevel: 4,
    baseCost: 150,
    costMultiplier: 2.0,
    baseValue: 0.0, // 0 = disabled, otherwise radius
    valuePerLevel: 1.2,
    unit: "m melt radius",
    descriptions: [
      "Not installed",
      "Manual rear spreader funnel",
      "Pressurized brine spray bar",
      "High-speed rotary salt distributor",
      "Thermal brine mist system",
    ],
  },
  snowCannon: {
    name: "Snow Blower & Cannon",
    maxLevel: 4,
    baseCost: 200,
    costMultiplier: 2.1,
    baseValue: 1.0, // multiplier on snow coin rewards
    valuePerLevel: 0.5,
    unit: "x coin bonus",
    descriptions: [
      "Standard side-bank deposit",
      "High-flow snow thrower chute",
      "Dual directional snow cannons",
      "High-velocity blizzard vortex",
      "Supersonic snow disperser",
    ],
  },
  boostTank: {
    name: "Chai / Cocoa Turbo Boost",
    maxLevel: 5,
    baseCost: 120,
    costMultiplier: 1.7,
    baseValue: 3.0, // seconds of boost capacity
    valuePerLevel: 1.5,
    unit: "sec duration",
    descriptions: [
      "Thermos mini-reserve (3s)",
      "Double-shot thermos tank (4.5s)",
      "Pressurized cocoa manifold (6s)",
      "Alpine rapid-recharge boiler (7.5s)",
      "Perpetual hot cocoa supercharger (9s)",
    ],
  },
};

export function getUpgradeCost(upgradeKey: keyof PlayerUpgrades, currentLevel: number): number {
  const def = UPGRADE_DEFINITIONS[upgradeKey];
  if (currentLevel >= def.maxLevel) return 0;
  return Math.round(def.baseCost * Math.pow(def.costMultiplier, currentLevel - (upgradeKey === "saltSpreader" || upgradeKey === "snowCannon" ? 0 : 1)));
}

export function getUpgradeValue(upgradeKey: keyof PlayerUpgrades, currentLevel: number): number {
  const def = UPGRADE_DEFINITIONS[upgradeKey];
  if (upgradeKey === "saltSpreader" && currentLevel === 0) return 0;
  if (upgradeKey === "snowCannon" && currentLevel === 0) return 1.0;
  return def.baseValue + (currentLevel - (upgradeKey === "saltSpreader" || upgradeKey === "snowCannon" ? 0 : 1)) * def.valuePerLevel;
}

export interface ComboState {
  streak: number; // number of plowed snow patches in active run
  timer: number; // time left before combo drops in seconds
  multiplier: number;
  tierName: string;
}

export const COMBO_MAX_TIMER = 1.8; // seconds grace period to keep combo alive

export function calculateCombo(streak: number, timer: number): {
  multiplier: number;
  tierName: string;
  isMax: boolean;
} {
  if (timer <= 0 || streak <= 0) {
    return { multiplier: 1.0, tierName: "CRUISING", isMax: false };
  }

  if (streak >= 120) {
    return { multiplier: 8.0, tierName: "BLIZZARD RUSH!", isMax: true };
  } else if (streak >= 70) {
    return { multiplier: 5.0, tierName: "SNOW TYPHOON", isMax: false };
  } else if (streak >= 40) {
    return { multiplier: 3.5, tierName: "AVALANCHE POWER", isMax: false };
  } else if (streak >= 20) {
    return { multiplier: 2.5, tierName: "FROST SURGE", isMax: false };
  } else if (streak >= 8) {
    return { multiplier: 1.8, tierName: "STEADY PLOW", isMax: false };
  } else if (streak >= 3) {
    return { multiplier: 1.3, tierName: "ROLLING", isMax: false };
  }

  return { multiplier: 1.0, tierName: "CRUISING", isMax: false };
}

export interface StageConfig {
  id: number;
  name: string;
  subtitle: string;
  description: string;
  targetPercent: number; // required % to clear
  coinReward: number;
  parTimeSeconds: number;
  mapSize: number; // half-extent
  driftDensity: number; // 0..1
  buriedPresentsCount: number;
  strandedSnowmenCount: number;
}

export const STAGES: StageConfig[] = [
  {
    id: 1,
    name: "Pine Ridge Village",
    subtitle: "Town Square & Main Street",
    description: "Clear the morning snow around the bakery, town clock, and the great holiday spruce tree.",
    targetPercent: 75,
    coinReward: 350,
    parTimeSeconds: 120,
    mapSize: 36,
    driftDensity: 0.55,
    buriedPresentsCount: 4,
    strandedSnowmenCount: 2,
  },
  {
    id: 2,
    name: "Chalet Valley",
    subtitle: "Steep Driveways & Frozen Pond",
    description: "Winding mountain cabin trails with icy patches and heavy drifts blocking front doors.",
    targetPercent: 80,
    coinReward: 600,
    parTimeSeconds: 150,
    mapSize: 42,
    driftDensity: 0.7,
    buriedPresentsCount: 6,
    strandedSnowmenCount: 3,
  },
  {
    id: 3,
    name: "Starlight Summit",
    subtitle: "Alpine Observatory & Radio Tower",
    description: "Gale-force blizzard aftermath on steep switchbacks. Keep the beacon road clear!",
    targetPercent: 85,
    coinReward: 950,
    parTimeSeconds: 180,
    mapSize: 48,
    driftDensity: 0.85,
    buriedPresentsCount: 8,
    strandedSnowmenCount: 4,
  },
];

export function calculateClearedPercentage(clearedCells: number, totalClearableCells: number): number {
  if (totalClearableCells <= 0) return 0;
  return Math.min(100, Math.round((clearedCells / totalClearableCells) * 100));
}

export function calculateRunScore(params: {
  clearedPercent: number;
  timeElapsed: number;
  parTime: number;
  maxCombo: number;
  buriedPresentsFound: number;
  strandedSnowmenSaved: number;
  cannonBonus: number;
}): {
  baseCoins: number;
  timeBonus: number;
  comboBonus: number;
  secretsBonus: number;
  totalCoins: number;
} {
  const baseCoins = Math.round(params.clearedPercent * 4 * params.cannonBonus);
  const timeBonus = params.timeElapsed <= params.parTime
    ? Math.round((params.parTime - params.timeElapsed) * 2.5)
    : 0;
  const comboBonus = Math.round(params.maxCombo * 35);
  const secretsBonus = (params.buriedPresentsFound * 60) + (params.strandedSnowmenSaved * 120);

  const totalCoins = baseCoins + timeBonus + comboBonus + secretsBonus;

  return {
    baseCoins,
    timeBonus,
    comboBonus,
    secretsBonus,
    totalCoins,
  };
}
