/**
 * Zero-GC Pooled Particle System.
 * Pre-allocated BufferGeometry with typed arrays for high-performance snow spray,
 * ambient falling snow, boost trails, and celebration sparkles.
 */
import * as THREE from 'three';

export class ParticlePool {
  public group: THREE.Group;

  // Snow Spray Particles (thrown by plow blade)
  private readonly MAX_SPRAY = 250;
  private sprayPositions: Float32Array;
  private sprayVelocities: Float32Array;
  private sprayLifetimes: Float32Array;
  private sprayGeo: THREE.BufferGeometry;
  private sprayPoints: THREE.Points;
  private sprayIndex: number = 0;

  // Ambient Falling Snowflakes
  private readonly MAX_FALLING = 400;
  private fallPositions: Float32Array;
  private fallVelocities: Float32Array;
  private fallGeo: THREE.BufferGeometry;
  private fallPoints: THREE.Points;

  // Boost Ice / Nitro Trail
  private readonly MAX_BOOST = 120;
  private boostPositions: Float32Array;
  private boostVelocities: Float32Array;
  private boostLifetimes: Float32Array;
  private boostGeo: THREE.BufferGeometry;
  private boostPoints: THREE.Points;
  private boostIndex: number = 0;

  constructor() {
    this.group = new THREE.Group();

    // 1. Snow Spray Setup
    this.sprayPositions = new Float32Array(this.MAX_SPRAY * 3);
    this.sprayVelocities = new Float32Array(this.MAX_SPRAY * 3);
    this.sprayLifetimes = new Float32Array(this.MAX_SPRAY);

    this.sprayGeo = new THREE.BufferGeometry();
    this.sprayGeo.setAttribute('position', new THREE.BufferAttribute(this.sprayPositions, 3));

    const sprayMat = new THREE.PointsMaterial({
      color: 0xf8fafc,
      size: 0.35,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.sprayPoints = new THREE.Points(this.sprayGeo, sprayMat);
    this.group.add(this.sprayPoints);

    // 2. Ambient Falling Snow Setup
    this.fallPositions = new Float32Array(this.MAX_FALLING * 3);
    this.fallVelocities = new Float32Array(this.MAX_FALLING * 3);

    for (let i = 0; i < this.MAX_FALLING; i++) {
      this.fallPositions[i * 3 + 0] = (Math.random() - 0.5) * 60;
      this.fallPositions[i * 3 + 1] = Math.random() * 25;
      this.fallPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;

      this.fallVelocities[i * 3 + 0] = (Math.random() - 0.5) * 0.5; // slight drift
      this.fallVelocities[i * 3 + 1] = -1.2 - Math.random() * 1.5; // downward
      this.fallVelocities[i * 3 + 2] = 0.2 + (Math.random() - 0.5) * 0.4;
    }

    this.fallGeo = new THREE.BufferGeometry();
    this.fallGeo.setAttribute('position', new THREE.BufferAttribute(this.fallPositions, 3));

    const fallMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.22,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.fallPoints = new THREE.Points(this.fallGeo, fallMat);
    this.group.add(this.fallPoints);

    // 3. Boost Trail Setup
    this.boostPositions = new Float32Array(this.MAX_BOOST * 3);
    this.boostVelocities = new Float32Array(this.MAX_BOOST * 3);
    this.boostLifetimes = new Float32Array(this.MAX_BOOST);

    this.boostGeo = new THREE.BufferGeometry();
    this.boostGeo.setAttribute('position', new THREE.BufferAttribute(this.boostPositions, 3));

    const boostMat = new THREE.PointsMaterial({
      color: 0x38bdf8, // cyan ice boost
      size: 0.4,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    this.boostPoints = new THREE.Points(this.boostGeo, boostMat);
    this.group.add(this.boostPoints);
  }

  /**
   * Spawn a burst of snow spray from blade edges
   */
  public emitSnowSpray(
    bladeCenter: THREE.Vector3,
    heading: number,
    bladeWidth: number,
    count: number = 4,
    speedFactor: number = 1.0
  ) {
    const perpX = Math.cos(heading + Math.PI / 2);
    const perpZ = Math.sin(heading + Math.PI / 2);

    for (let c = 0; c < count; c++) {
      const idx = this.sprayIndex;
      this.sprayIndex = (this.sprayIndex + 1) % this.MAX_SPRAY;

      // Random side: left (-1) or right (+1)
      const side = Math.random() > 0.5 ? 1 : -1;
      const distFromCenter = (bladeWidth / 2) * (0.6 + Math.random() * 0.4);

      const spawnX = bladeCenter.x + perpX * distFromCenter * side;
      const spawnZ = bladeCenter.z + perpZ * distFromCenter * side;
      const spawnY = 0.25 + Math.random() * 0.3;

      this.sprayPositions[idx * 3 + 0] = spawnX;
      this.sprayPositions[idx * 3 + 1] = spawnY;
      this.sprayPositions[idx * 3 + 2] = spawnZ;

      // Velocity: throw outward to the side and slightly up & back
      const outSpeed = (2.5 + Math.random() * 3.5) * speedFactor;
      this.sprayVelocities[idx * 3 + 0] = perpX * side * outSpeed + (Math.random() - 0.5);
      this.sprayVelocities[idx * 3 + 1] = 1.8 + Math.random() * 2.2 * speedFactor;
      this.sprayVelocities[idx * 3 + 2] = perpZ * side * outSpeed + (Math.random() - 0.5);

      this.sprayLifetimes[idx] = 0.5 + Math.random() * 0.3; // lifetime in seconds
    }
  }

  /**
   * Spawn boost nitro ice sparks behind vehicle
   */
  public emitBoostTrail(rearPos: THREE.Vector3, count: number = 3) {
    for (let c = 0; c < count; c++) {
      const idx = this.boostIndex;
      this.boostIndex = (this.boostIndex + 1) % this.MAX_BOOST;

      this.boostPositions[idx * 3 + 0] = rearPos.x + (Math.random() - 0.5) * 0.6;
      this.boostPositions[idx * 3 + 1] = 0.3 + Math.random() * 0.4;
      this.boostPositions[idx * 3 + 2] = rearPos.z + (Math.random() - 0.5) * 0.6;

      this.boostVelocities[idx * 3 + 0] = (Math.random() - 0.5) * 1.5;
      this.boostVelocities[idx * 3 + 1] = 0.8 + Math.random() * 1.2;
      this.boostVelocities[idx * 3 + 2] = (Math.random() - 0.5) * 1.5;

      this.boostLifetimes[idx] = 0.35 + Math.random() * 0.2;
    }
  }

  /**
   * Update particle positions and lifetimes
   */
  public update(dt: number, cameraPos: THREE.Vector3) {
    // 1. Update Snow Spray
    let sprayActive = false;
    for (let i = 0; i < this.MAX_SPRAY; i++) {
      if (this.sprayLifetimes[i] > 0) {
        sprayActive = true;
        this.sprayLifetimes[i] -= dt;

        this.sprayPositions[i * 3 + 0] += this.sprayVelocities[i * 3 + 0] * dt;
        this.sprayPositions[i * 3 + 1] += this.sprayVelocities[i * 3 + 1] * dt;
        this.sprayPositions[i * 3 + 2] += this.sprayVelocities[i * 3 + 2] * dt;

        // Gravity pull
        this.sprayVelocities[i * 3 + 1] -= 9.8 * dt;

        // Ground collision
        if (this.sprayPositions[i * 3 + 1] < 0.05) {
          this.sprayPositions[i * 3 + 1] = 0.05;
          this.sprayVelocities[i * 3 + 0] *= 0.5;
          this.sprayVelocities[i * 3 + 2] *= 0.5;
        }

        if (this.sprayLifetimes[i] <= 0) {
          // Hide offscreen
          this.sprayPositions[i * 3 + 1] = -100;
        }
      }
    }
    if (sprayActive) {
      this.sprayGeo.attributes.position.needsUpdate = true;
    }

    // 2. Update Ambient Falling Snow
    for (let i = 0; i < this.MAX_FALLING; i++) {
      this.fallPositions[i * 3 + 0] += this.fallVelocities[i * 3 + 0] * dt;
      this.fallPositions[i * 3 + 1] += this.fallVelocities[i * 3 + 1] * dt;
      this.fallPositions[i * 3 + 2] += this.fallVelocities[i * 3 + 2] * dt;

      // Wrap around relative to camera position so snow stays centered around view
      const dx = this.fallPositions[i * 3 + 0] - cameraPos.x;
      const dz = this.fallPositions[i * 3 + 2] - cameraPos.z;

      if (this.fallPositions[i * 3 + 1] < 0) {
        this.fallPositions[i * 3 + 1] = 22 + Math.random() * 4;
        this.fallPositions[i * 3 + 0] = cameraPos.x + (Math.random() - 0.5) * 55;
        this.fallPositions[i * 3 + 2] = cameraPos.z + (Math.random() - 0.5) * 55;
      }
      if (Math.abs(dx) > 35) {
        this.fallPositions[i * 3 + 0] = cameraPos.x - Math.sign(dx) * 32;
      }
      if (Math.abs(dz) > 35) {
        this.fallPositions[i * 3 + 2] = cameraPos.z - Math.sign(dz) * 32;
      }
    }
    this.fallGeo.attributes.position.needsUpdate = true;

    // 3. Update Boost Trail
    let boostActive = false;
    for (let i = 0; i < this.MAX_BOOST; i++) {
      if (this.boostLifetimes[i] > 0) {
        boostActive = true;
        this.boostLifetimes[i] -= dt;

        this.boostPositions[i * 3 + 0] += this.boostVelocities[i * 3 + 0] * dt;
        this.boostPositions[i * 3 + 1] += this.boostVelocities[i * 3 + 1] * dt;
        this.boostPositions[i * 3 + 2] += this.boostVelocities[i * 3 + 2] * dt;

        if (this.boostLifetimes[i] <= 0) {
          this.boostPositions[i * 3 + 1] = -100;
        }
      }
    }
    if (boostActive) {
      this.boostGeo.attributes.position.needsUpdate = true;
    }
  }

  public dispose() {
    this.sprayGeo.dispose();
    this.fallGeo.dispose();
    this.boostGeo.dispose();
  }
}
