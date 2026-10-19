import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCombo,
  calculateClearedPercentage,
  calculateRunScore,
  getUpgradeCost,
  getUpgradeValue,
  DEFAULT_UPGRADES,
  STAGES,
} from './rules.ts';

test('combo calculations return progressive tiers and multipliers', () => {
  // Idle or zero streak
  assert.equal(calculateCombo(0, 0).multiplier, 1.0);
  assert.equal(calculateCombo(5, 0).multiplier, 1.0); // expired timer

  // Rolling tier
  const rolling = calculateCombo(4, 1.5);
  assert.equal(rolling.multiplier, 1.3);
  assert.equal(rolling.tierName, 'ROLLING');
  assert.equal(rolling.isMax, false);

  // Steady Plow
  const steady = calculateCombo(12, 1.2);
  assert.equal(steady.multiplier, 1.8);
  assert.equal(steady.tierName, 'STEADY PLOW');

  // Frost Surge
  const surge = calculateCombo(25, 1.0);
  assert.equal(surge.multiplier, 2.5);

  // Avalanche Power
  const avalanche = calculateCombo(50, 1.0);
  assert.equal(avalanche.multiplier, 3.5);

  // Snow Typhoon
  const typhoon = calculateCombo(80, 1.0);
  assert.equal(typhoon.multiplier, 5.0);

  // Blizzard Rush (Max tier)
  const maxTier = calculateCombo(130, 1.8);
  assert.equal(maxTier.multiplier, 8.0);
  assert.equal(maxTier.tierName, 'BLIZZARD RUSH!');
  assert.equal(maxTier.isMax, true);
});

test('upgrade cost and value progression are calculated accurately', () => {
  // Blade Width Level 1 -> 2
  const bladeCost1 = getUpgradeCost('bladeWidth', 1);
  assert.ok(bladeCost1 > 0);
  const bladeVal1 = getUpgradeValue('bladeWidth', 1);
  const bladeVal2 = getUpgradeValue('bladeWidth', 2);
  assert.ok(bladeVal2 > bladeVal1);

  // Salt Spreader (starts at level 0)
  assert.equal(getUpgradeValue('saltSpreader', 0), 0);
  const saltCost0 = getUpgradeCost('saltSpreader', 0);
  assert.ok(saltCost0 > 0);
  assert.ok(getUpgradeValue('saltSpreader', 1) > 0);

  // Max level cost returns 0 (capped)
  const maxBladeCost = getUpgradeCost('bladeWidth', 5);
  assert.equal(maxBladeCost, 0);
});

test('calculateClearedPercentage handles bounds and precision', () => {
  assert.equal(calculateClearedPercentage(0, 500), 0);
  assert.equal(calculateClearedPercentage(250, 500), 50);
  assert.equal(calculateClearedPercentage(375, 500), 75);
  assert.equal(calculateClearedPercentage(500, 500), 100);
  assert.equal(calculateClearedPercentage(600, 500), 100); // capped
  assert.equal(calculateClearedPercentage(10, 0), 0); // divide by zero guard
});

test('run score calculation computes base, combo, secrets and par time bonuses', () => {
  const result = calculateRunScore({
    clearedPercent: 80,
    timeElapsed: 90,
    parTime: 120, // under par by 30s
    maxCombo: 5.0,
    buriedPresentsFound: 3,
    strandedSnowmenSaved: 1,
    cannonBonus: 1.0,
  });

  assert.equal(result.baseCoins, 320); // 80 * 4
  assert.equal(result.timeBonus, 75); // 30 * 2.5
  assert.equal(result.comboBonus, 175); // 5 * 35
  assert.equal(result.secretsBonus, 3 * 60 + 1 * 120); // 180 + 120 = 300
  assert.equal(result.totalCoins, 320 + 75 + 175 + 300);
});

test('stages have valid configurations and increasing targets', () => {
  assert.equal(STAGES.length, 3);
  assert.ok(STAGES[0].targetPercent < STAGES[1].targetPercent);
  assert.ok(STAGES[1].targetPercent < STAGES[2].targetPercent);
  assert.ok(STAGES[0].coinReward < STAGES[1].coinReward);
});
