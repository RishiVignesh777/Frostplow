/**
 * 2D Solid Obstacle Collision System.
 * Handles circle-vs-circle and circle-vs-oriented box (OBB) collision detection and pushout resolution
 * to ensure vehicles never pass through trees, houses, fences, street lamps, or terrain boundaries.
 */

export interface CircleCollider {
  type: 'circle';
  x: number;
  z: number;
  radius: number;
  label?: string;
}

export interface BoxCollider {
  type: 'box';
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
  rotY: number; // in radians
  label?: string;
}

export type ObstacleCollider = CircleCollider | BoxCollider;

export interface CollisionResult {
  collided: boolean;
  normalX: number;
  normalZ: number;
  penetration: number;
}

/**
 * Circle vs Circle collision detection & resolution
 */
export function resolveCircleVsCircle(
  px: number,
  pz: number,
  pRadius: number,
  cx: number,
  cz: number,
  cRadius: number
): CollisionResult {
  const dx = px - cx;
  const dz = pz - cz;
  const distSq = dx * dx + dz * dz;
  const minDist = pRadius + cRadius;

  if (distSq >= minDist * minDist) {
    return { collided: false, normalX: 0, normalZ: 0, penetration: 0 };
  }

  const dist = Math.sqrt(distSq);
  if (dist === 0) {
    // Exactly overlapping centers: push along positive X
    return { collided: true, normalX: 1, normalZ: 0, penetration: minDist };
  }

  const normalX = dx / dist;
  const normalZ = dz / dist;
  const penetration = minDist - dist;

  return { collided: true, normalX, normalZ, penetration };
}

/**
 * Circle vs Oriented Bounding Box (OBB) collision detection & resolution
 */
export function resolveCircleVsBox(
  px: number,
  pz: number,
  pRadius: number,
  bx: number,
  bz: number,
  halfW: number,
  halfD: number,
  rotY: number
): CollisionResult {
  // Transform circle point into box local coordinates
  const relX = px - bx;
  const relZ = pz - bz;

  const cosNeg = Math.cos(-rotY);
  const sinNeg = Math.sin(-rotY);

  const localX = relX * cosNeg - relZ * sinNeg;
  const localZ = relX * sinNeg + relZ * cosNeg;

  // Closest point on box in local space
  const clampedX = Math.max(-halfW, Math.min(halfW, localX));
  const clampedZ = Math.max(-halfD, Math.min(halfD, localZ));

  const diffX = localX - clampedX;
  const diffZ = localZ - clampedZ;
  const distSq = diffX * diffX + diffZ * diffZ;

  // Case 1: Point is inside box
  if (diffX === 0 && diffZ === 0) {
    const distToRight = halfW - localX;
    const distToLeft = localX - (-halfW);
    const distToTop = halfD - localZ;
    const distToBottom = localZ - (-halfD);

    const minDist = Math.min(distToRight, distToLeft, distToTop, distToBottom);

    let localNormX = 0;
    let localNormZ = 0;

    if (minDist === distToRight) localNormX = 1;
    else if (minDist === distToLeft) localNormX = -1;
    else if (minDist === distToTop) localNormZ = 1;
    else localNormZ = -1;

    const penetration = pRadius + minDist;

    // Transform local normal to world space
    const cosPos = Math.cos(rotY);
    const sinPos = Math.sin(rotY);
    const worldNormX = localNormX * cosPos - localNormZ * sinPos;
    const worldNormZ = localNormX * sinPos + localNormZ * cosPos;

    return { collided: true, normalX: worldNormX, normalZ: worldNormZ, penetration };
  }

  // Case 2: Point is outside box, check distance to closest boundary point
  if (distSq >= pRadius * pRadius) {
    return { collided: false, normalX: 0, normalZ: 0, penetration: 0 };
  }

  const dist = Math.sqrt(distSq);
  const localNormX = diffX / dist;
  const localNormZ = diffZ / dist;
  const penetration = pRadius - dist;

  // Transform normal back to world coordinates
  const cosPos = Math.cos(rotY);
  const sinPos = Math.sin(rotY);
  const worldNormX = localNormX * cosPos - localNormZ * sinPos;
  const worldNormZ = localNormX * sinPos + localNormZ * cosPos;

  return { collided: true, normalX: worldNormX, normalZ: worldNormZ, penetration };
}

/**
 * Resolve collision between a vehicle hull and all scene obstacles.
 * Uses a dual-circle collision hull (front and rear) for accurate turning and wall sliding.
 */
export function resolveVehicleCollisions(
  vehiclePos: { x: number; z: number },
  heading: number,
  obstacles: ObstacleCollider[]
): {
  newX: number;
  newZ: number;
  hasCollision: boolean;
  totalPenetration: number;
  averageNormalX: number;
  averageNormalZ: number;
} {
  let currX = vehiclePos.x;
  let currZ = vehiclePos.z;

  const hullRadius = 0.95;
  const frontOffset = 0.75;
  const rearOffset = -0.75;

  let hasCollision = false;
  let totalPenetration = 0;
  let sumNormalX = 0;
  let sumNormalZ = 0;
  let collisionCount = 0;

  // Test both front and rear hull points
  const points = [
    { offset: frontOffset, isFront: true },
    { offset: rearOffset, isFront: false },
    { offset: 0, isFront: false }, // center
  ];

  for (let pass = 0; pass < 2; pass++) { // 2 relaxation passes for corner sliding
    for (const pt of points) {
      const fwdX = Math.sin(heading);
      const fwdZ = Math.cos(heading);

      const circleX = currX + fwdX * pt.offset;
      const circleZ = currZ + fwdZ * pt.offset;

      for (const obs of obstacles) {
        let res: CollisionResult;
        if (obs.type === 'circle') {
          res = resolveCircleVsCircle(circleX, circleZ, hullRadius, obs.x, obs.z, obs.radius);
        } else {
          res = resolveCircleVsBox(circleX, circleZ, hullRadius, obs.x, obs.z, obs.halfWidth, obs.halfDepth, obs.rotY);
        }

        if (res.collided && res.penetration > 0.001) {
          hasCollision = true;
          totalPenetration += res.penetration;
          sumNormalX += res.normalX;
          sumNormalZ += res.normalZ;
          collisionCount++;

          // Push vehicle position out
          currX += res.normalX * res.penetration;
          currZ += res.normalZ * res.penetration;
        }
      }
    }
  }

  const averageNormalX = collisionCount > 0 ? sumNormalX / collisionCount : 0;
  const averageNormalZ = collisionCount > 0 ? sumNormalZ / collisionCount : 0;

  return {
    newX: currX,
    newZ: currZ,
    hasCollision,
    totalPenetration,
    averageNormalX,
    averageNormalZ,
  };
}
