/**
 * Procedural Snowcat Snowplow 3D Composite Model and Arcade Vehicle Physics.
 * Built with 10+ distinct procedural parts, varying PBR materials, contact shadow,
 * dynamic steering, rotating beacon, and upgrade-responsive visual attachments.
 */
import * as THREE from 'three';
import { PlayerUpgrades, getUpgradeValue } from './rules.ts';

export class SnowplowVehicle {
  public group: THREE.Group;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public heading: number = 0; // in radians (0 = facing +X)
  public steeringAngle: number = 0; // -maxSteer to +maxSteer
  public currentSpeed: number = 0; // forward speed in m/s

  // Visual sub-components
  private chassisMesh!: THREE.Mesh;
  private cabinMesh!: THREE.Mesh;
  private windowMesh!: THREE.Mesh;
  private leftTrackMesh!: THREE.Mesh;
  private rightTrackMesh!: THREE.Mesh;
  private bladeAssembly!: THREE.Group;
  private bladeMesh!: THREE.Mesh;
  private beaconLightMesh!: THREE.Mesh;
  private exhaustPipeMesh!: THREE.Mesh;
  private saltSpreaderAttachment!: THREE.Group;
  private snowCannonAttachment!: THREE.Group;
  private contactShadowMesh!: THREE.Mesh;

  // Headlight spot visual cones
  private leftLightCone!: THREE.Mesh;
  private rightLightCone!: THREE.Mesh;

  // Suspension / body tilt
  private bodyPitch: number = 0;
  private bodyRoll: number = 0;

  // Vehicle parameters
  public maxSpeed: number = 9.0;
  public acceleration: number = 14.0;
  public braking: number = 18.0;
  public turnSpeed: number = 2.8;
  public currentBladeWidth: number = 2.2;
  public saltRadius: number = 0;
  public isBoosting: boolean = false;
  public boostTimeRemaining: number = 0;
  public maxBoostDuration: number = 3.0;

  constructor(initialX: number = 0, initialZ: number = 0) {
    this.group = new THREE.Group();
    this.position = new THREE.Vector3(initialX, 0, initialZ);
    this.velocity = new THREE.Vector3();
    this.heading = Math.PI / 2; // facing north (+Z) initially

    this.buildProceduralModel();
    this.group.position.copy(this.position);
    this.group.rotation.y = this.heading;
  }

  private buildProceduralModel() {
    // Shared PBR Materials with high roughness contrast
    const steelMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155, // dark slate steel
      metalness: 0.8,
      roughness: 0.35,
    });

    const rubberTrackMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // dark charcoal rubber tracks
      metalness: 0.1,
      roughness: 0.85,
    });

    const alpinePaintMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // warm alpine amber-yellow
      metalness: 0.2,
      roughness: 0.25, // glossy automotive coat
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transmission: 0.75,
      opacity: 0.9,
      transparent: true,
      roughness: 0.1,
      ior: 1.5,
    });

    const bladeSteelMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // bright steel blade with wear
      metalness: 0.85,
      roughness: 0.2,
    });

    const beaconEmissiveMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });

    const lightConeMaterial = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });

    // 1. Lower Chassis (BoxGeometry with beveled feel)
    const chassisGeo = new THREE.BoxGeometry(1.6, 0.45, 2.2);
    this.chassisMesh = new THREE.Mesh(chassisGeo, steelMaterial);
    this.chassisMesh.position.y = 0.45;
    this.group.add(this.chassisMesh);

    // 2. Left and Right Heavy Crawler Tracks
    const trackGeo = new THREE.BoxGeometry(0.4, 0.55, 2.5);
    this.leftTrackMesh = new THREE.Mesh(trackGeo, rubberTrackMaterial);
    this.leftTrackMesh.position.set(-0.95, 0.32, 0);
    this.group.add(this.leftTrackMesh);

    this.rightTrackMesh = new THREE.Mesh(trackGeo, rubberTrackMaterial);
    this.rightTrackMesh.position.set(0.95, 0.32, 0);
    this.group.add(this.rightTrackMesh);

    // Bogie wheels on tracks (decorative cylinders)
    const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.42, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    for (let i = -1; i <= 1; i += 0.66) {
      const leftWheel = new THREE.Mesh(wheelGeo, steelMaterial);
      leftWheel.position.set(-0.95, 0.28, i);
      this.group.add(leftWheel);

      const rightWheel = new THREE.Mesh(wheelGeo, steelMaterial);
      rightWheel.position.set(0.95, 0.28, i);
      this.group.add(rightWheel);
    }

    // 3. Cabin (Alpine Body with slight taper)
    const cabGeo = new THREE.BoxGeometry(1.4, 0.85, 1.4);
    this.cabinMesh = new THREE.Mesh(cabGeo, alpinePaintMaterial);
    this.cabinMesh.position.set(0, 1.05, -0.1);
    this.group.add(this.cabinMesh);

    // 4. Windows (Front Panoramic Windshield & Sides)
    const frontWindowGeo = new THREE.BoxGeometry(1.25, 0.45, 0.08);
    this.windowMesh = new THREE.Mesh(frontWindowGeo, glassMaterial);
    this.windowMesh.position.set(0, 1.15, 0.61);
    this.group.add(this.windowMesh);

    const sideWindowGeo = new THREE.BoxGeometry(0.08, 0.4, 0.9);
    const leftSideWindow = new THREE.Mesh(sideWindowGeo, glassMaterial);
    leftSideWindow.position.set(-0.71, 1.15, -0.1);
    this.group.add(leftSideWindow);

    const rightSideWindow = new THREE.Mesh(sideWindowGeo, glassMaterial);
    rightSideWindow.position.set(0.71, 1.15, -0.1);
    this.group.add(rightSideWindow);

    // 5. Roof Rack & Flashing Amber Warning Beacon
    const rackGeo = new THREE.BoxGeometry(1.2, 0.08, 1.1);
    const rack = new THREE.Mesh(rackGeo, steelMaterial);
    rack.position.set(0, 1.5, -0.1);
    this.group.add(rack);

    const beaconGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.18, 10);
    this.beaconLightMesh = new THREE.Mesh(beaconGeo, beaconEmissiveMaterial);
    this.beaconLightMesh.position.set(0, 1.63, -0.1);
    this.group.add(this.beaconLightMesh);

    // 6. Vertical Exhaust Stack
    const exhaustGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8);
    this.exhaustPipeMesh = new THREE.Mesh(exhaustGeo, steelMaterial);
    this.exhaustPipeMesh.position.set(0.6, 1.4, -0.7);
    this.exhaustPipeMesh.rotation.z = -0.1;
    this.group.add(this.exhaustPipeMesh);

    // 7. Front Hydraulic Arms & Plow Blade Assembly
    this.bladeAssembly = new THREE.Group();
    this.bladeAssembly.position.set(0, 0.35, 1.25);

    // Hydraulic push arms
    const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8);
    armGeo.rotateX(Math.PI / 2);
    const leftArm = new THREE.Mesh(armGeo, steelMaterial);
    leftArm.position.set(-0.55, 0, 0);
    this.bladeAssembly.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, steelMaterial);
    rightArm.position.set(0.55, 0, 0);
    this.bladeAssembly.add(rightArm);

    // The Curved Plow Blade itself
    this.rebuildBladeMesh(2.2, bladeSteelMaterial);
    this.group.add(this.bladeAssembly);

    // 8. Headlights & Volumetric Light Cones
    const headlightGeo = new THREE.BoxGeometry(0.2, 0.12, 0.08);
    const leftHeadlight = new THREE.Mesh(headlightGeo, beaconEmissiveMaterial);
    leftHeadlight.position.set(-0.55, 0.85, 0.62);
    this.group.add(leftHeadlight);

    const rightHeadlight = new THREE.Mesh(headlightGeo, beaconEmissiveMaterial);
    rightHeadlight.position.set(0.55, 0.85, 0.62);
    this.group.add(rightHeadlight);

    // Volumetric forward light beams
    const coneGeo = new THREE.ConeGeometry(1.2, 5.0, 16, 1, true);
    coneGeo.rotateX(-Math.PI / 2);
    coneGeo.translate(0, 0, 2.5);

    this.leftLightCone = new THREE.Mesh(coneGeo, lightConeMaterial);
    this.leftLightCone.position.set(-0.55, 0.85, 0.62);
    this.group.add(this.leftLightCone);

    this.rightLightCone = new THREE.Mesh(coneGeo, lightConeMaterial);
    this.rightLightCone.position.set(0.55, 0.85, 0.62);
    this.group.add(this.rightLightCone);

    // 9. Rear Attachments (Salt Spreader & Snow Cannon)
    this.saltSpreaderAttachment = new THREE.Group();
    const hopperGeo = new THREE.ConeGeometry(0.4, 0.6, 8);
    hopperGeo.rotateX(Math.PI);
    const hopper = new THREE.Mesh(hopperGeo, alpinePaintMaterial);
    hopper.position.set(0, 0.8, -1.25);
    this.saltSpreaderAttachment.add(hopper);
    this.saltSpreaderAttachment.visible = false;
    this.group.add(this.saltSpreaderAttachment);

    this.snowCannonAttachment = new THREE.Group();
    const cannonBarrelGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.8, 10);
    cannonBarrelGeo.rotateX(Math.PI / 3);
    const cannonBarrel = new THREE.Mesh(cannonBarrelGeo, steelMaterial);
    cannonBarrel.position.set(0.35, 1.3, -0.6);
    this.snowCannonAttachment.add(cannonBarrel);
    this.snowCannonAttachment.visible = false;
    this.group.add(this.snowCannonAttachment);

    // 10. Contact Shadow Disc (grounding shadow)
    const shadowGeo = new THREE.CircleGeometry(1.7, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.contactShadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadowMesh.position.y = 0.02; // elevated slightly to prevent Z-fighting
    this.group.add(this.contactShadowMesh);
  }

  /**
   * Dynamically rebuild the plow blade geometry when blade width upgrade changes
   */
  public rebuildBladeMesh(width: number, customMat?: THREE.Material) {
    this.currentBladeWidth = width;
    if (this.bladeMesh) {
      this.bladeAssembly.remove(this.bladeMesh);
      this.bladeMesh.geometry.dispose();
    }

    const mat = customMat || (this.bladeMesh ? this.bladeMesh.material : new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.85,
      roughness: 0.2,
    }));

    // Beveled curved plow blade shape
    const bladeGeo = new THREE.BoxGeometry(width, 0.65, 0.18);
    this.bladeMesh = new THREE.Mesh(bladeGeo, mat);
    this.bladeMesh.position.set(0, 0.05, 0.4);

    // Add left and right snow-curling deflectors
    const deflectorGeo = new THREE.BoxGeometry(0.12, 0.65, 0.35);
    const leftDeflector = new THREE.Mesh(deflectorGeo, mat);
    leftDeflector.position.set(-width / 2 + 0.06, 0, -0.1);
    leftDeflector.rotation.y = -0.35;
    this.bladeMesh.add(leftDeflector);

    const rightDeflector = new THREE.Mesh(deflectorGeo, mat);
    rightDeflector.position.set(width / 2 - 0.06, 0, -0.1);
    rightDeflector.rotation.y = 0.35;
    this.bladeMesh.add(rightDeflector);

    this.bladeAssembly.add(this.bladeMesh);
  }

  /**
   * Apply current player upgrades to vehicle stats and attachments
   */
  public applyUpgrades(upgrades: PlayerUpgrades) {
    const bladeWidth = getUpgradeValue('bladeWidth', upgrades.bladeWidth);
    this.rebuildBladeMesh(bladeWidth);

    this.maxSpeed = getUpgradeValue('enginePower', upgrades.enginePower);
    this.saltRadius = getUpgradeValue('saltSpreader', upgrades.saltSpreader);
    this.saltSpreaderAttachment.visible = upgrades.saltSpreader > 0;

    const cannonLevel = upgrades.snowCannon;
    this.snowCannonAttachment.visible = cannonLevel > 0;

    this.maxBoostDuration = getUpgradeValue('boostTank', upgrades.boostTank);
    this.boostTimeRemaining = this.maxBoostDuration;
  }

  /**
   * Physics and Controls update
   */
  public update(
    dt: number,
    inputs: { throttle: number; steer: number; boost: boolean },
    isPlowingSnow: boolean,
    mapBounds: number
  ) {
    // Boost activation
    if (inputs.boost && this.boostTimeRemaining > 0 && inputs.throttle > 0) {
      this.isBoosting = true;
      this.boostTimeRemaining = Math.max(0, this.boostTimeRemaining - dt);
    } else {
      this.isBoosting = false;
      // Gradual boost recharge when not boosting (0.35 sec per second)
      this.boostTimeRemaining = Math.min(this.maxBoostDuration, this.boostTimeRemaining + dt * 0.35);
    }

    // Effective max speed & acceleration modifiers
    let effectiveMaxSpeed = this.maxSpeed;
    if (this.isBoosting) effectiveMaxSpeed *= 1.6;
    if (isPlowingSnow && !this.isBoosting) effectiveMaxSpeed *= 0.88; // snow resistance

    // Forward/reverse throttle
    if (inputs.throttle > 0) {
      const accel = this.isBoosting ? this.acceleration * 1.5 : this.acceleration;
      this.currentSpeed = Math.min(effectiveMaxSpeed, this.currentSpeed + accel * inputs.throttle * dt);
    } else if (inputs.throttle < 0) {
      // Reverse is slower (max 4.5 m/s)
      this.currentSpeed = Math.max(-4.5, this.currentSpeed - this.braking * Math.abs(inputs.throttle) * dt);
    } else {
      // Coasting friction / deceleration
      const friction = 8.5;
      if (this.currentSpeed > 0) {
        this.currentSpeed = Math.max(0, this.currentSpeed - friction * dt);
      } else if (this.currentSpeed < 0) {
        this.currentSpeed = Math.min(0, this.currentSpeed + friction * dt);
      }
    }

    // Steering (effective only when vehicle has velocity)
    if (Math.abs(this.currentSpeed) > 0.1) {
      const dirSign = this.currentSpeed >= 0 ? 1 : -1;
      const effectiveTurn = this.turnSpeed * (1 - Math.min(0.5, Math.abs(this.currentSpeed) / 20));
      this.heading -= inputs.steer * effectiveTurn * dirSign * dt;
    }

    // Update position
    const forwardX = Math.sin(this.heading);
    const forwardZ = Math.cos(this.heading);

    this.velocity.set(forwardX * this.currentSpeed, 0, forwardZ * this.currentSpeed);
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // Map bounds clamp (soft bounce against boundary snowbanks)
    const bound = mapBounds - 2.5;
    if (this.position.x > bound) {
      this.position.x = bound;
      this.currentSpeed *= 0.5;
    } else if (this.position.x < -bound) {
      this.position.x = -bound;
      this.currentSpeed *= 0.5;
    }
    if (this.position.z > bound) {
      this.position.z = bound;
      this.currentSpeed *= 0.5;
    } else if (this.position.z < -bound) {
      this.position.z = -bound;
      this.currentSpeed *= 0.5;
    }

    // Dynamic visual tilts
    // Pitch: nose dips under braking/acceleration
    const targetPitch = (this.currentSpeed / this.maxSpeed) * 0.04 * (inputs.throttle > 0 ? -1 : 1);
    this.bodyPitch = THREE.MathUtils.damp(this.bodyPitch, targetPitch, 8, dt);

    // Roll: body leans into turns
    const targetRoll = -inputs.steer * (Math.abs(this.currentSpeed) / this.maxSpeed) * 0.06;
    this.bodyRoll = THREE.MathUtils.damp(this.bodyRoll, targetRoll, 8, dt);

    // Blade steering pivot (blade angles slightly with steering input)
    if (this.bladeAssembly) {
      const targetBladeAngle = -inputs.steer * 0.2;
      this.bladeAssembly.rotation.y = THREE.MathUtils.damp(this.bladeAssembly.rotation.y, targetBladeAngle, 10, dt);
    }

    // Flashing rooftop beacon animation
    if (this.beaconLightMesh) {
      const beaconTime = performance.now() * 0.008;
      const flash = (Math.sin(beaconTime) + 1) * 0.5;
      (this.beaconLightMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + flash * 0.8;
    }

    // Apply transforms to root group
    this.group.position.copy(this.position);
    this.group.rotation.y = this.heading;
    this.group.rotation.x = this.bodyPitch;
    this.group.rotation.z = this.bodyRoll;
  }

  /**
   * Returns current plow blade center position in world coordinates
   */
  public getBladeCenter(): THREE.Vector3 {
    const forwardX = Math.sin(this.heading);
    const forwardZ = Math.cos(this.heading);
    return new THREE.Vector3(
      this.position.x + forwardX * 1.6,
      0,
      this.position.z + forwardZ * 1.6
    );
  }

  public reset(x: number = 0, z: number = 0, heading: number = Math.PI / 2) {
    this.position.set(x, 0, z);
    this.velocity.set(0, 0, 0);
    this.currentSpeed = 0;
    this.heading = heading;
    this.boostTimeRemaining = this.maxBoostDuration;
    this.group.position.copy(this.position);
    this.group.rotation.y = this.heading;
  }
}
