/**
 * Cozy Alpine Village Procedural Environment.
 * Houses, chalets, decorated holiday trees, pine forests, street lamps,
 * frozen pond, fences, and buried treasure models.
 */
import * as THREE from 'three';
import { BuriedItem } from './snowGrid.ts';
import { ObstacleCollider } from './collision.ts';

export class VillageEnvironment {
  public group: THREE.Group;
  public chimneySmokes: { mesh: THREE.Mesh; initialY: number; speed: number }[] = [];
  public treasureMeshes: Map<string, THREE.Group> = new Map();
  public colliders: ObstacleCollider[] = [];

  constructor(mapSize: number = 40) {
    this.group = new THREE.Group();
    this.buildVillage(mapSize);
  }

  private buildVillage(mapSize: number) {
    // Shared Materials
    const chaletWoodMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a21, // warm dark cabin cedar
      roughness: 0.8,
      metalness: 0.1,
    });

    const chaletPlasterMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7, // warm cream alpine plaster
      roughness: 0.7,
      metalness: 0.05,
    });

    const snowRoofMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // thick powdery snow
      roughness: 0.9,
      metalness: 0.05,
    });

    const windowGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.85,
      roughness: 0.3,
    });

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.9,
      metalness: 0.1,
    });

    const pineFoliageMat = new THREE.MeshStandardMaterial({
      color: 0x14532d, // rich alpine pine green
      roughness: 0.8,
      metalness: 0.1,
    });

    const pineSnowMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.9,
    });

    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.6,
      opacity: 0.85,
      transparent: true,
      ior: 1.31,
    });

    // 1. Build Chalets & Buildings
    const housePositions: { x: number; z: number; rotY: number; isLarge?: boolean; isBakery?: boolean }[] = [
      // Town Square Buildings
      { x: -11, z: 9, rotY: Math.PI / 4, isBakery: true },
      { x: -11, z: -9, rotY: -Math.PI / 4, isLarge: true },
      { x: 11, z: 9, rotY: -Math.PI / 4 },
      { x: 11, z: -9, rotY: Math.PI / 4 },
      // Cabin Valley Driveway Chalets
      { x: 23, z: 16, rotY: -Math.PI / 2 },
      { x: -23, z: -16, rotY: Math.PI / 2 },
      { x: -17, z: 25, rotY: 0 },
      { x: 17, z: -25, rotY: Math.PI },
      // Clock Tower / Alpine Bell Tower at North Square
      { x: 0, z: -11.5, rotY: 0, isLarge: true },
    ];

    housePositions.forEach((pos, idx) => {
      const houseGroup = new THREE.Group();
      houseGroup.position.set(pos.x, 0, pos.z);
      houseGroup.rotation.y = pos.rotY;

      const scale = pos.isLarge ? 1.3 : 1.0;

      // Base body
      const wallGeo = new THREE.BoxGeometry(4 * scale, 3 * scale, 3.5 * scale);
      const wall = new THREE.Mesh(wallGeo, pos.isBakery ? chaletPlasterMat : chaletWoodMat);
      wall.position.y = 1.5 * scale;
      houseGroup.add(wall);

      // Wooden corner timbers
      const timberGeo = new THREE.BoxGeometry(0.3 * scale, 3.1 * scale, 0.3 * scale);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const timber = new THREE.Mesh(timberGeo, chaletWoodMat);
          timber.position.set((1.95 * sx) * scale, 1.55 * scale, (1.7 * sz) * scale);
          houseGroup.add(timber);
        }
      }

      // Steep Snow-Capped Gable Roof
      const roofGeo = new THREE.ConeGeometry(3.2 * scale, 2.2 * scale, 4);
      roofGeo.rotateY(Math.PI / 4);
      const roof = new THREE.Mesh(roofGeo, snowRoofMat);
      roof.position.y = 3.8 * scale;
      roof.scale.set(1.1, 1, 1.25);
      houseGroup.add(roof);

      // Glowing Windows
      const winGeo = new THREE.BoxGeometry(0.8 * scale, 0.9 * scale, 0.1);
      const frontWin1 = new THREE.Mesh(winGeo, windowGlowMat);
      frontWin1.position.set(-1.1 * scale, 1.6 * scale, 1.8 * scale);
      houseGroup.add(frontWin1);

      const frontWin2 = new THREE.Mesh(winGeo, windowGlowMat);
      frontWin2.position.set(1.1 * scale, 1.6 * scale, 1.8 * scale);
      houseGroup.add(frontWin2);

      // Stone Chimney
      const chimneyGeo = new THREE.BoxGeometry(0.6 * scale, 2.0 * scale, 0.6 * scale);
      const chimney = new THREE.Mesh(chimneyGeo, stoneMat);
      chimney.position.set(1.0 * scale, 3.8 * scale, -0.6 * scale);
      houseGroup.add(chimney);

      // Chimney smoke puff
      const smokeGeo = new THREE.SphereGeometry(0.25 * scale, 8, 8);
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0xf1f5f9,
        transparent: true,
        opacity: 0.35,
      });
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      const initY = (4.8 + idx * 0.2) * scale;
      smoke.position.set(1.0 * scale, initY, -0.6 * scale);
      houseGroup.add(smoke);
      this.chimneySmokes.push({ mesh: smoke, initialY: initY, speed: 0.8 + Math.random() * 0.4 });

      // Solid Box Collider for Chalet / House
      this.colliders.push({
        type: 'box',
        x: pos.x,
        z: pos.z,
        halfWidth: 2.1 * scale,
        halfDepth: 1.85 * scale,
        rotY: pos.rotY,
        label: pos.isBakery ? 'bakery' : 'chalet',
      });

      this.group.add(houseGroup);
    });

    // 2. Centerpiece: The Great Village Holiday Tree
    const holidayTreeGroup = new THREE.Group();
    holidayTreeGroup.position.set(0, 0, 0);

    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 2.2, 8);
    const trunk = new THREE.Mesh(trunkGeo, chaletWoodMat);
    trunk.position.y = 1.1;
    holidayTreeGroup.add(trunk);

    // 4 tiered lush pine cones with snow tops
    const tiers = [
      { r: 2.6, h: 2.2, y: 2.4 },
      { r: 2.0, h: 1.9, y: 3.8 },
      { r: 1.4, h: 1.6, y: 5.0 },
      { r: 0.8, h: 1.2, y: 6.0 },
    ];

    tiers.forEach((t) => {
      const boughGeo = new THREE.ConeGeometry(t.r, t.h, 10);
      const bough = new THREE.Mesh(boughGeo, pineFoliageMat);
      bough.position.y = t.y;
      holidayTreeGroup.add(bough);

      const snowCapGeo = new THREE.ConeGeometry(t.r * 1.03, t.h * 0.4, 10);
      const snowCap = new THREE.Mesh(snowCapGeo, pineSnowMat);
      snowCap.position.y = t.y + t.h * 0.22;
      holidayTreeGroup.add(snowCap);
    });

    // Golden Tree Topper Star
    const starGeo = new THREE.OctahedronGeometry(0.4, 0);
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.8,
    });
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.y = 7.0;
    holidayTreeGroup.add(star);

    // Colored festive tree lights
    const bulbGeo = new THREE.SphereGeometry(0.1, 6, 6);
    const bulbColors = [0xef4444, 0x3b82f6, 0xeab308, 0x10b981, 0xa855f7];
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 8;
      const height = 2.0 + (i / 24) * 4.2;
      const radius = 2.4 * (1 - (i / 24) * 0.75);
      const mat = new THREE.MeshBasicMaterial({ color: bulbColors[i % bulbColors.length] });
      const bulb = new THREE.Mesh(bulbGeo, mat);
      bulb.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      holidayTreeGroup.add(bulb);
    }

    this.group.add(holidayTreeGroup);

    // Solid Circle Collider for Great Holiday Tree
    this.colliders.push({
      type: 'circle',
      x: 0,
      z: 0,
      radius: 1.5,
      label: 'holiday_tree',
    });

    // 3. Ambient Pine Trees around Village Perimeters
    const pinePositions: { x: number; z: number; scale: number }[] = [];
    for (let i = 0; i < 45; i++) {
      const angle = (i / 45) * Math.PI * 2;
      const radius = 27 + Math.random() * 11;
      const px = Math.cos(angle) * radius;
      const pz = Math.sin(angle) * radius;
      // ensure not blocking main roads
      if (Math.abs(px) > 5.5 || Math.abs(pz) > 5.5) {
        pinePositions.push({ x: px, z: pz, scale: 0.8 + Math.random() * 0.5 });
      }
    }

    // Additional clusters in quiet corners
    const clusterSpots = [
      { cx: -18, cz: 6 },
      { cx: 18, cz: -6 },
      { cx: -8, cz: 22 },
      { cx: 8, cz: -22 },
    ];
    clusterSpots.forEach((c) => {
      for (let j = 0; j < 4; j++) {
        pinePositions.push({
          x: c.cx + (Math.random() - 0.5) * 6,
          z: c.cz + (Math.random() - 0.5) * 6,
          scale: 0.75 + Math.random() * 0.45,
        });
      }
    });

    pinePositions.forEach((p) => {
      const tree = this.createPineTree(p.scale, chaletWoodMat, pineFoliageMat, pineSnowMat);
      tree.position.set(p.x, 0, p.z);
      this.group.add(tree);

      // Solid Circle Collider for Pine Tree Trunk
      this.colliders.push({
        type: 'circle',
        x: p.x,
        z: p.z,
        radius: 0.85 * p.scale,
        label: 'pine_tree',
      });
    });

    // 4. Street Lamps with Warm Point Lights
    const lampPositions = [
      { x: -5.5, z: 4.5 },
      { x: 5.5, z: 4.5 },
      { x: -5.5, z: -4.5 },
      { x: 5.5, z: -4.5 },
      { x: 0, z: 12.5 },
      { x: 0, z: -12.5 },
      { x: 12.5, z: 0 },
      { x: -12.5, z: 0 },
    ];

    lampPositions.forEach((lp) => {
      const lamp = this.createStreetLamp(chaletWoodMat, windowGlowMat);
      lamp.position.set(lp.x, 0, lp.z);
      this.group.add(lamp);

      // Solid Circle Collider for Wooden Stick / Street Lamp Post
      this.colliders.push({
        type: 'circle',
        x: lp.x,
        z: lp.z,
        radius: 0.38,
        label: 'street_lamp',
      });

      // Warm subtle point light
      const pointLight = new THREE.PointLight(0xfef08a, 1.4, 7);
      pointLight.position.set(lp.x, 2.8, lp.z);
      this.group.add(pointLight);
    });

    // 5. Frozen Pond with Glossy Ice
    const pondGeo = new THREE.CylinderGeometry(5.5, 5.5, 0.15, 24);
    const pond = new THREE.Mesh(pondGeo, iceMat);
    pond.position.set(-18, 0.05, -7);
    this.group.add(pond);

    // Snowbank ring around the pond
    const bankGeo = new THREE.TorusGeometry(5.6, 0.55, 8, 24);
    bankGeo.rotateX(Math.PI / 2);
    const bank = new THREE.Mesh(bankGeo, snowRoofMat);
    bank.position.set(-18, 0.2, -7);
    this.group.add(bank);

    // Solid Circle Collider for Frozen Pond
    this.colliders.push({
      type: 'circle',
      x: -18,
      z: -7,
      radius: 5.6,
      label: 'frozen_pond',
    });

    // 6. Natural Perimeter Mountain Silhouettes
    const mountainMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // snowy rock
      roughness: 0.95,
      metalness: 0.05,
    });

    for (let m = 0; m < 16; m++) {
      const angle = (m / 16) * Math.PI * 2;
      const dist = mapSize + 6;
      const mx = Math.cos(angle) * dist;
      const mz = Math.sin(angle) * dist;
      const mHeight = 12 + Math.sin(m * 2.5) * 5;
      const mRad = 8 + Math.cos(m * 1.5) * 3;

      const peakGeo = new THREE.ConeGeometry(mRad, mHeight, 6);
      const peak = new THREE.Mesh(peakGeo, mountainMat);
      peak.position.set(mx, mHeight / 2 - 1, mz);
      this.group.add(peak);

      const snowCapGeo = new THREE.ConeGeometry(mRad * 0.7, mHeight * 0.45, 6);
      const snowCap = new THREE.Mesh(snowCapGeo, snowRoofMat);
      snowCap.position.set(mx, mHeight - (mHeight * 0.45) / 2 - 1, mz);
      this.group.add(snowCap);
    }
  }

  private createPineTree(
    scale: number,
    trunkMat: THREE.Material,
    foliageMat: THREE.Material,
    snowMat: THREE.Material
  ): THREE.Group {
    const tree = new THREE.Group();
    tree.scale.set(scale, scale, scale);

    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 1.6, 6);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.8;
    tree.add(trunk);

    const cones = [
      { r: 1.8, h: 1.6, y: 1.8 },
      { r: 1.3, h: 1.4, y: 2.8 },
      { r: 0.8, h: 1.1, y: 3.7 },
    ];

    cones.forEach((c) => {
      const boughGeo = new THREE.ConeGeometry(c.r, c.h, 7);
      const bough = new THREE.Mesh(boughGeo, foliageMat);
      bough.position.y = c.y;
      tree.add(bough);

      const snowGeo = new THREE.ConeGeometry(c.r * 1.02, c.h * 0.35, 7);
      const snow = new THREE.Mesh(snowGeo, snowMat);
      snow.position.y = c.y + c.h * 0.2;
      tree.add(snow);
    });

    return tree;
  }

  private createStreetLamp(postMat: THREE.Material, glowMat: THREE.Material): THREE.Group {
    const lamp = new THREE.Group();

    // Wooden / Iron Post
    const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 2.8, 8);
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = 1.4;
    lamp.add(post);

    // Crossbar
    const armGeo = new THREE.BoxGeometry(0.6, 0.08, 0.08);
    const arm = new THREE.Mesh(armGeo, postMat);
    arm.position.set(0.2, 2.7, 0);
    lamp.add(arm);

    // Lantern Lantern Housing & Glow
    const lanternGeo = new THREE.BoxGeometry(0.3, 0.45, 0.3);
    const lantern = new THREE.Mesh(lanternGeo, glowMat);
    lantern.position.set(0.4, 2.5, 0);
    lamp.add(lantern);

    // Little snow cap on top of lantern
    const snowCapGeo = new THREE.ConeGeometry(0.25, 0.18, 4);
    snowCapGeo.rotateY(Math.PI / 4);
    const snowCap = new THREE.Mesh(snowCapGeo, new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 }));
    snowCap.position.set(0.4, 2.8, 0);
    lamp.add(snowCap);

    return lamp;
  }

  /**
   * Instantiate 3D meshes for buried presents and snowmen
   */
  public setupBuriedItemMeshes(items: BuriedItem[]) {
    // Clear any previous
    this.treasureMeshes.forEach((mesh) => this.group.remove(mesh));
    this.treasureMeshes.clear();

    const presentBoxMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // festive bright red
      roughness: 0.3,
      metalness: 0.2,
    });

    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24, // gold ribbon
      roughness: 0.2,
      metalness: 0.8,
    });

    const snowmanBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.9,
    });

    const carrotMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.6,
    });

    const hatMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
    });

    items.forEach((item) => {
      const itemGroup = new THREE.Group();
      itemGroup.position.set(item.x, 0, item.z);

      if (item.type === 'present') {
        // Red gift box
        const boxGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
        const box = new THREE.Mesh(boxGeo, presentBoxMat);
        box.position.y = 0.35;
        itemGroup.add(box);

        // Gold ribbon straps
        const ribHGeo = new THREE.BoxGeometry(0.72, 0.15, 0.72);
        const ribH = new THREE.Mesh(ribHGeo, ribbonMat);
        ribH.position.y = 0.35;
        itemGroup.add(ribH);

        const ribVGeo = new THREE.BoxGeometry(0.15, 0.72, 0.72);
        const ribV = new THREE.Mesh(ribVGeo, ribbonMat);
        ribV.position.y = 0.35;
        itemGroup.add(ribV);

        // Bow on top
        const bowGeo = new THREE.SphereGeometry(0.16, 8, 8);
        const bow = new THREE.Mesh(bowGeo, ribbonMat);
        bow.position.y = 0.75;
        itemGroup.add(bow);
      } else {
        // Cute Snowman
        const lowerBallGeo = new THREE.SphereGeometry(0.55, 12, 12);
        const lowerBall = new THREE.Mesh(lowerBallGeo, snowmanBodyMat);
        lowerBall.position.y = 0.55;
        itemGroup.add(lowerBall);

        const headGeo = new THREE.SphereGeometry(0.38, 12, 12);
        const head = new THREE.Mesh(headGeo, snowmanBodyMat);
        head.position.y = 1.35;
        itemGroup.add(head);

        // Carrot nose
        const carrotGeo = new THREE.ConeGeometry(0.08, 0.3, 8);
        carrotGeo.rotateX(Math.PI / 2);
        const carrot = new THREE.Mesh(carrotGeo, carrotMat);
        carrot.position.set(0, 1.35, 0.45);
        itemGroup.add(carrot);

        // Black Top Hat
        const hatBrimGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12);
        const hatBrim = new THREE.Mesh(hatBrimGeo, hatMat);
        hatBrim.position.y = 1.68;
        itemGroup.add(hatBrim);

        const hatCrownGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.4, 12);
        const hatCrown = new THREE.Mesh(hatCrownGeo, hatMat);
        hatCrown.position.y = 1.9;
        itemGroup.add(hatCrown);
      }

      item.mesh = itemGroup;
      itemGroup.visible = false; // hidden under snow until uncovered!
      this.group.add(itemGroup);
      this.treasureMeshes.set(item.id, itemGroup);
    });
  }

  /**
   * Reveal animation when a buried secret is plowed
   */
  public triggerItemReveal(itemId: string) {
    const mesh = this.treasureMeshes.get(itemId);
    if (!mesh) return;
    mesh.visible = true;
    mesh.position.y = 0;
    mesh.scale.set(0.1, 0.1, 0.1);

    // Pop up animation
    let elapsed = 0;
    const animatePop = () => {
      elapsed += 0.05;
      const s = Math.min(1.0, elapsed * 2.2);
      mesh.scale.set(s, s + Math.sin(elapsed * Math.PI) * 0.3, s);
      mesh.rotation.y += 0.08;
      if (elapsed < 1.0) {
        requestAnimationFrame(animatePop);
      } else {
        mesh.scale.set(1, 1, 1);
      }
    };
    animatePop();
  }

  /**
   * Update chimney smoke puffs gently
   */
  public update(dt: number) {
    this.chimneySmokes.forEach((smoke) => {
      smoke.mesh.position.y += smoke.speed * dt;
      smoke.mesh.position.x += 0.15 * dt; // gentle wind
      const scale = 1 + (smoke.mesh.position.y - smoke.initialY) * 0.45;
      smoke.mesh.scale.set(scale, scale, scale);
      (smoke.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.35 - (smoke.mesh.position.y - smoke.initialY) * 0.12
      );

      // Loop back down when high
      if (smoke.mesh.position.y > smoke.initialY + 2.8) {
        smoke.mesh.position.y = smoke.initialY;
        smoke.mesh.position.x = 1.0;
        smoke.mesh.scale.set(1, 1, 1);
        (smoke.mesh.material as THREE.MeshBasicMaterial).opacity = 0.35;
      }
    });

    // Idle rotation for revealed treasures
    this.treasureMeshes.forEach((mesh) => {
      if (mesh.visible) {
        mesh.rotation.y += 0.8 * dt;
      }
    });
  }
}
