/**
 * Interactive Snow Grid System.
 * Tracks snow depth, road network, snowbanks, and dynamic ground texture.
 */
import * as THREE from 'three';

export interface BuriedItem {
  id: string;
  type: 'present' | 'snowman' | 'pinecone';
  x: number;
  z: number;
  isFound: boolean;
  mesh?: THREE.Group;
}

export class SnowGrid {
  public readonly mapSize: number; // e.g. 40 (world coordinates -40 to +40)
  public readonly resolution: number; // grid cells along one axis (e.g. 128)
  public readonly cellWorldSize: number;

  private snowDepths: Float32Array; // 0.0 (cleared) to 1.0 (deep fresh snow)
  private isRoadCell: Uint8Array; // 1 if clearable road/driveway/plaza, 0 if building/boundary

  public totalClearableCells: number = 0;
  public clearedCells: number = 0;

  // Dynamic canvas for ground visual texture
  public groundCanvas: HTMLCanvasElement;
  private groundCtx: CanvasRenderingContext2D;
  public groundTexture: THREE.CanvasTexture;

  // Buried secrets
  public buriedItems: BuriedItem[] = [];

  constructor(mapSize: number = 40, resolution: number = 128) {
    this.mapSize = mapSize;
    this.resolution = resolution;
    this.cellWorldSize = (mapSize * 2) / resolution;

    const totalCells = resolution * resolution;
    this.snowDepths = new Float32Array(totalCells);
    this.isRoadCell = new Uint8Array(totalCells);

    // Initialize 2D Canvas for crisp texture painting
    this.groundCanvas = document.createElement('canvas');
    this.groundCanvas.width = resolution * 4; // 512x512 crisp resolution
    this.groundCanvas.height = resolution * 4;
    this.groundCtx = this.groundCanvas.getContext('2d', { willReadFrequently: false })!;

    this.groundTexture = new THREE.CanvasTexture(this.groundCanvas);
    this.groundTexture.colorSpace = THREE.SRGBColorSpace;
    this.groundTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.groundTexture.magFilter = THREE.LinearFilter;
    this.groundTexture.generateMipmaps = true;

    this.initLayout();
    this.renderInitialCanvas();
  }

  /**
   * World to grid coordinates conversion
   */
  public worldToGrid(x: number, z: number): { gx: number; gz: number } | null {
    const half = this.mapSize;
    if (x < -half || x > half || z < -half || z > half) return null;
    const gx = Math.floor(((x + half) / (half * 2)) * this.resolution);
    const gz = Math.floor(((z + half) / (half * 2)) * this.resolution);
    if (gx < 0 || gx >= this.resolution || gz < 0 || gz >= this.resolution) return null;
    return { gx, gz };
  }

  /**
   * Set up road network, plazas, driveways, and initialize snow
   */
  private initLayout() {
    this.totalClearableCells = 0;
    this.clearedCells = 0;

    for (let gz = 0; gz < this.resolution; gz++) {
      for (let gx = 0; gx < this.resolution; gx++) {
        const idx = gz * this.resolution + gx;
        const wx = (gx / this.resolution) * (this.mapSize * 2) - this.mapSize;
        const wz = (gz / this.resolution) * (this.mapSize * 2) - this.mapSize;

        // Village Road Network Design:
        // Main Street along Z axis: x between -4.5 and +4.5
        const isMainStreet = Math.abs(wx) <= 4.2 && Math.abs(wz) <= this.mapSize - 4;
        // Cross Street along X axis: z between -3.5 and +3.5
        const isCrossStreet = Math.abs(wz) <= 3.8 && Math.abs(wx) <= this.mapSize - 4;
        // Central Town Square Plaza: radius <= 11
        const distFromCenter = Math.sqrt(wx * wx + wz * wz);
        const isCenterPlaza = distFromCenter <= 10.5;
        // Ring road / chalet loop: radius between 19 and 25
        const isRingRoad = distFromCenter >= 18 && distFromCenter <= 24.5;
        // Cabin driveways radiating outward
        const isDriveway1 = wx > 6 && wx < 22 && Math.abs(wz - 16) < 3.0;
        const isDriveway2 = wx < -6 && wx > -22 && Math.abs(wz + 16) < 3.0;
        const isDriveway3 = wz > 6 && wz < 24 && Math.abs(wx + 17) < 3.0;
        const isDriveway4 = wz < -6 && wz > -24 && Math.abs(wx - 17) < 3.0;

        const isRoad = isMainStreet || isCrossStreet || isCenterPlaza || isRingRoad || isDriveway1 || isDriveway2 || isDriveway3 || isDriveway4;

        if (isRoad) {
          this.isRoadCell[idx] = 1;
          this.snowDepths[idx] = 1.0; // Fresh 100% snow
          this.totalClearableCells++;
        } else {
          this.isRoadCell[idx] = 0;
          this.snowDepths[idx] = 0.9;
        }
      }
    }
  }

  /**
   * Populate buried secrets and stranded snowmen on roads
   */
  public generateBuriedItems(presentsCount: number, snowmenCount: number) {
    this.buriedItems = [];

    // Place presents at interesting road / plaza points
    const potentialSpots: { x: number; z: number; type: 'present' | 'snowman' | 'pinecone' }[] = [
      { x: 3.5, z: 8, type: 'present' },
      { x: -3.5, z: -10, type: 'present' },
      { x: 12, z: 3.5, type: 'present' },
      { x: -14, z: -3.5, type: 'present' },
      { x: 18, z: 16, type: 'present' },
      { x: -18, z: -16, type: 'present' },
      { x: -17, z: 14, type: 'present' },
      { x: 17, z: -14, type: 'present' },
      { x: 0, z: -18, type: 'present' },
      { x: 0, z: 18, type: 'present' },
      { x: 6.5, z: -6.5, type: 'snowman' },
      { x: -7.5, z: 7.5, type: 'snowman' },
      { x: 16, z: 0, type: 'snowman' },
      { x: -16, z: 0, type: 'snowman' },
    ];

    let pCount = 0;
    let sCount = 0;

    for (let i = 0; i < potentialSpots.length; i++) {
      const spot = potentialSpots[i];
      if (spot.type === 'present' && pCount < presentsCount) {
        this.buriedItems.push({
          id: `present_${pCount}`,
          type: 'present',
          x: spot.x,
          z: spot.z,
          isFound: false,
        });
        pCount++;
      } else if (spot.type === 'snowman' && sCount < snowmenCount) {
        this.buriedItems.push({
          id: `snowman_${sCount}`,
          type: 'snowman',
          x: spot.x,
          z: spot.z,
          isFound: false,
        });
        sCount++;
      }
    }
  }

  /**
   * Pre-render base winter ground map:
   * Dark cobblestone/asphalt paths covered with crisp white snow layer.
   */
  private renderInitialCanvas() {
    const w = this.groundCanvas.width;
    const h = this.groundCanvas.height;
    const ctx = this.groundCtx;

    // Base background: soft winter ground (periwinkle-white snow with subtle blue-gray shade)
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, w, h);

    // Draw untouched fresh snow blanket over roads (pure bright snowy white #f8fafc with subtle sparkle)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    this.groundTexture.needsUpdate = true;
  }

  /**
   * Plow snow along a blade swath.
   * Returns number of freshly cleared cells and any discovered treasures!
   */
  public plowSwath(
    centerPos: THREE.Vector3,
    headingAngle: number,
    bladeWidth: number,
    saltRadius: number = 0
  ): { newlyClearedCount: number; foundItems: BuriedItem[] } {
    let newlyClearedCount = 0;
    const foundItems: BuriedItem[] = [];

    // Calculate blade left and right endpoints in world space
    const halfWidth = bladeWidth / 2;
    // Normal perpendicular to heading
    const perpX = Math.cos(headingAngle + Math.PI / 2);
    const perpZ = Math.sin(headingAngle + Math.PI / 2);

    // Sample along the blade edge
    const sampleSteps = Math.max(4, Math.ceil(bladeWidth / (this.cellWorldSize * 0.7)));

    // Prepare canvas drawing context updates
    const canvasScale = this.groundCanvas.width / this.resolution;

    this.groundCtx.fillStyle = '#334155'; // Dark damp cleared road/cobblestone color
    this.groundCtx.strokeStyle = '#1e293b'; // Road edge groove

    let canvasDirty = false;

    for (let step = 0; step <= sampleSteps; step++) {
      const t = (step / sampleSteps) * 2 - 1; // -1 to +1
      const sampleX = centerPos.x + perpX * halfWidth * t;
      const sampleZ = centerPos.z + perpZ * halfWidth * t;

      const gridPos = this.worldToGrid(sampleX, sampleZ);
      if (!gridPos) continue;

      const { gx, gz } = gridPos;
      const idx = gz * this.resolution + gx;

      if (this.isRoadCell[idx] === 1 && this.snowDepths[idx] > 0.05) {
        this.snowDepths[idx] = 0.0;
        this.clearedCells++;
        newlyClearedCount++;

        // Paint cleared road on ground texture
        const cx = gx * canvasScale;
        const cy = gz * canvasScale;
        const radius = Math.max(3, canvasScale * 1.3);

        this.groundCtx.beginPath();
        this.groundCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.groundCtx.fill();
        canvasDirty = true;
      }
    }

    // Apply salt spreader radius behind vehicle if active
    if (saltRadius > 0.5) {
      const saltGridRadius = Math.ceil(saltRadius / this.cellWorldSize);
      const centerGrid = this.worldToGrid(centerPos.x, centerPos.z);
      if (centerGrid) {
        for (let dz = -saltGridRadius; dz <= saltGridRadius; dz++) {
          for (let dx = -saltGridRadius; dx <= saltGridRadius; dx++) {
            if (dx * dx + dz * dz <= saltGridRadius * saltGridRadius) {
              const sgx = centerGrid.gx + dx;
              const sgz = centerGrid.gz + dz;
              if (sgx >= 0 && sgx < this.resolution && sgz >= 0 && sgz < this.resolution) {
                const sIdx = sgz * this.resolution + sgx;
                if (this.isRoadCell[sIdx] === 1 && this.snowDepths[sIdx] > 0.05) {
                  this.snowDepths[sIdx] = 0.0;
                  this.clearedCells++;
                  newlyClearedCount++;

                  const cx = sgx * canvasScale;
                  const cy = sgz * canvasScale;
                  this.groundCtx.beginPath();
                  this.groundCtx.arc(cx, cy, canvasScale * 1.2, 0, Math.PI * 2);
                  this.groundCtx.fill();
                  canvasDirty = true;
                }
              }
            }
          }
        }
      }
    }

    if (canvasDirty) {
      this.groundTexture.needsUpdate = true;
    }

    // Check for uncovering buried items within plow range
    const uncoverDistSq = (halfWidth + 1.2) * (halfWidth + 1.2);
    for (const item of this.buriedItems) {
      if (!item.isFound) {
        const dx = item.x - centerPos.x;
        const dz = item.z - centerPos.z;
        if (dx * dx + dz * dz <= uncoverDistSq) {
          item.isFound = true;
          foundItems.push(item);
        }
      }
    }

    return { newlyClearedCount, foundItems };
  }

  public getClearedPercent(): number {
    if (this.totalClearableCells === 0) return 0;
    return Math.min(100, Math.round((this.clearedCells / this.totalClearableCells) * 100));
  }

  public reset() {
    this.initLayout();
    this.renderInitialCanvas();
    for (const item of this.buriedItems) {
      item.isFound = false;
      if (item.mesh) {
        item.mesh.visible = true;
        item.mesh.position.y = -0.5; // buried initially
      }
    }
  }

  public dispose() {
    this.groundTexture.dispose();
  }
}
