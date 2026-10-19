import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCircleVsCircle,
  resolveCircleVsBox,
  resolveVehicleCollisions,
} from './collision.ts';
import type { ObstacleCollider } from './collision.ts';

test('circle vs circle collision detects overlap and calculates correct normal and pushout', () => {
  // Overlapping circles along X axis
  const res = resolveCircleVsCircle(0, 0, 1.0, 1.5, 0, 1.0);
  assert.equal(res.collided, true);
  assert.ok(Math.abs(res.normalX - (-1.0)) < 0.001); // pushed left
  assert.ok(Math.abs(res.normalZ) < 0.001);
  assert.ok(Math.abs(res.penetration - 0.5) < 0.001); // 2.0 - 1.5 = 0.5

  // Non-overlapping circles
  const noCollision = resolveCircleVsCircle(0, 0, 1.0, 5.0, 5.0, 1.0);
  assert.equal(noCollision.collided, false);
});

test('circle vs oriented box (OBB) collision detects house wall collision and pushes vehicle out', () => {
  // House centered at (10, 10), halfWidth = 2, halfDepth = 2, rotY = 0
  // Vehicle circle approaching from left at (7.5, 10), radius = 1.0
  const hitLeft = resolveCircleVsBox(7.5, 10, 1.0, 10, 10, 2, 2, 0);
  assert.equal(hitLeft.collided, true);
  assert.ok(hitLeft.normalX < -0.9); // pushes left
  assert.ok(hitLeft.penetration > 0.4);

  // Vehicle far away
  const miss = resolveCircleVsBox(0, 0, 1.0, 10, 10, 2, 2, 0);
  assert.equal(miss.collided, false);
});

test('resolveVehicleCollisions prevents penetration into street lamps and trees', () => {
  const obstacles: ObstacleCollider[] = [
    { type: 'circle', x: 5.5, z: 4.5, radius: 0.4, label: 'street_lamp' },
    { type: 'box', x: 11, z: 9, halfWidth: 2.2, halfDepth: 2.0, rotY: -Math.PI / 4, label: 'chalet' },
  ];

  // Vehicle attempting to drive right through the street lamp
  const initialPos = { x: 5.5, z: 4.8 }; // within hull radius of lamp (0.95 + 0.4 = 1.35)
  const result = resolveVehicleCollisions(initialPos, 0, obstacles);

  assert.equal(result.hasCollision, true);
  // Position should have been pushed away from lamp center (5.5, 4.5)
  const newDist = Math.sqrt((result.newX - 5.5) ** 2 + (result.newZ - 4.5) ** 2);
  assert.ok(newDist >= 1.25); // pushed out to safe distance
});
