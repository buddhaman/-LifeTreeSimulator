// Simple Verlet particle physics skeleton in 3D
// x, y follow screen coordinates, z is up

import { Node } from './graph';

export class VerletParticle {
  x: number;
  y: number;
  z: number;
  oldX: number;
  oldY: number;
  oldZ: number;
  pinned: boolean;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.oldX = x;
    this.oldY = y;
    this.oldZ = z;
    this.pinned = false;
  }

  update(dt: number) {
    if (this.pinned) return;

    const vx = this.x - this.oldX;
    const vy = this.y - this.oldY;
    const vz = this.z - this.oldZ;

    this.oldX = this.x;
    this.oldY = this.y;
    this.oldZ = this.z;

    this.x += vx;
    this.y += vy;
    this.z += vz;
  }

  applyForce(fx: number, fy: number, fz: number) {
    if (this.pinned) return;
    this.x += fx;
    this.y += fy;
    this.z += fz;
  }
}

export class VerletConstraint {
  p1: VerletParticle;
  p2: VerletParticle;
  restLength: number;

  constructor(p1: VerletParticle, p2: VerletParticle) {
    this.p1 = p1;
    this.p2 = p2;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    this.restLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  solve() {
    const dx = this.p2.x - this.p1.x;
    const dy = this.p2.y - this.p1.y;
    const dz = this.p2.z - this.p1.z;

    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance === 0) return;

    const diff = (this.restLength - distance) / distance;
    const offsetX = dx * diff * 0.5;
    const offsetY = dy * diff * 0.5;
    const offsetZ = dz * diff * 0.5;

    if (!this.p1.pinned) {
      this.p1.x -= offsetX;
      this.p1.y -= offsetY;
      this.p1.z -= offsetZ;
    }

    if (!this.p2.pinned) {
      this.p2.x += offsetX;
      this.p2.y += offsetY;
      this.p2.z += offsetZ;
    }
  }
}

export class Skeleton {
  particles: VerletParticle[] = [];
  constraints: VerletConstraint[] = [];

  // Important body parts
  head: VerletParticle;
  leftFoot: VerletParticle;
  rightFoot: VerletParticle;

  // Current node reference
  currentNode: Node | null = null;

  // Eye blinking
  private blinkTimer: number = 0;
  private isBlinking: boolean = false;

  constructor(x: number, y: number) {
    // Create person-shaped skeleton in 3D
    // z=0 is the ground, z increases upward
    // Facing upward (negative y direction in world space)

    // Body structure (from bottom to top):
    // Feet -> Ankles -> Knees -> Hips -> Spine -> Shoulders -> Head

    const legLength = 45;
    const torsoLength = 50;
    const armLength = 38;
    const headRadius = 13;

    // Left leg
    this.leftFoot = new VerletParticle(x - 15, y, 0);
    const leftAnkle = new VerletParticle(x - 15, y - 5, legLength * 0.3);
    const leftKnee = new VerletParticle(x - 10, y - 10, legLength * 0.6);
    const leftHip = new VerletParticle(x - 8, y - 15, legLength);

    // Right leg
    this.rightFoot = new VerletParticle(x + 15, y, 0);
    const rightAnkle = new VerletParticle(x + 15, y - 5, legLength * 0.3);
    const rightKnee = new VerletParticle(x + 10, y - 10, legLength * 0.6);
    const rightHip = new VerletParticle(x + 8, y - 15, legLength);

    // Torso
    const pelvis = new VerletParticle(x, y - 15, legLength);
    const lowerSpine = new VerletParticle(x, y - 20, legLength + torsoLength * 0.3);
    const upperSpine = new VerletParticle(x, y - 25, legLength + torsoLength * 0.6);
    const neck = new VerletParticle(x, y - 30, legLength + torsoLength);

    // Head
    this.head = new VerletParticle(x, y - 35, legLength + torsoLength + headRadius);

    // Arms (positioned upward along with body)
    const leftShoulder = new VerletParticle(x - 12, y - 28, legLength + torsoLength * 0.8);
    const leftElbow = new VerletParticle(x - 20, y - 20, legLength + torsoLength * 0.5);
    const leftHand = new VerletParticle(x - 25, y - 15, legLength + torsoLength * 0.2);

    const rightShoulder = new VerletParticle(x + 12, y - 28, legLength + torsoLength * 0.8);
    const rightElbow = new VerletParticle(x + 20, y - 20, legLength + torsoLength * 0.5);
    const rightHand = new VerletParticle(x + 25, y - 15, legLength + torsoLength * 0.2);

    // Add all particles
    this.particles.push(
      this.leftFoot, leftAnkle, leftKnee, leftHip,
      this.rightFoot, rightAnkle, rightKnee, rightHip,
      pelvis, lowerSpine, upperSpine, neck, this.head,
      leftShoulder, leftElbow, leftHand,
      rightShoulder, rightElbow, rightHand
    );

    // Create constraints (skeleton bones)
    // Left leg
    this.constraints.push(new VerletConstraint(this.leftFoot, leftAnkle));
    this.constraints.push(new VerletConstraint(leftAnkle, leftKnee));
    this.constraints.push(new VerletConstraint(leftKnee, leftHip));

    // Right leg
    this.constraints.push(new VerletConstraint(this.rightFoot, rightAnkle));
    this.constraints.push(new VerletConstraint(rightAnkle, rightKnee));
    this.constraints.push(new VerletConstraint(rightKnee, rightHip));

    // Pelvis and hips
    this.constraints.push(new VerletConstraint(leftHip, pelvis));
    this.constraints.push(new VerletConstraint(rightHip, pelvis));
    this.constraints.push(new VerletConstraint(leftHip, rightHip));

    // Spine
    this.constraints.push(new VerletConstraint(pelvis, lowerSpine));
    this.constraints.push(new VerletConstraint(lowerSpine, upperSpine));
    this.constraints.push(new VerletConstraint(upperSpine, neck));
    this.constraints.push(new VerletConstraint(neck, this.head));

    // Left arm
    this.constraints.push(new VerletConstraint(neck, leftShoulder));
    this.constraints.push(new VerletConstraint(leftShoulder, leftElbow));
    this.constraints.push(new VerletConstraint(leftElbow, leftHand));

    // Right arm
    this.constraints.push(new VerletConstraint(neck, rightShoulder));
    this.constraints.push(new VerletConstraint(rightShoulder, rightElbow));
    this.constraints.push(new VerletConstraint(rightElbow, rightHand));

    // Feet will be pinned in update() based on currentNode
    this.leftFoot.pinned = true;
    this.rightFoot.pinned = true;
  }

  // Set the node the skeleton is standing on
  setNode(node: Node) {
    this.currentNode = node;
  }

  update(dt: number = 1) {
    // Apply upward force to head (no gravity, so limbs flail)
    const upwardForce = 0.5;
    this.head.applyForce(0, 0, upwardForce);

    // Update particles
    for (const particle of this.particles) {
      particle.update(dt);
    }

    // Solve constraints (multiple iterations for stability)
    const iterations = 3;
    for (let i = 0; i < iterations; i++) {
      for (const constraint of this.constraints) {
        constraint.solve();
      }
    }

    // Keep feet pinned on top of current node (only if we have a node)
    if (this.currentNode) {
      const footSpacing = 20; // Distance between feet
      const nodeTopY = this.currentNode.y - this.currentNode.currentHeight / 2;

      this.leftFoot.x = this.currentNode.x - footSpacing / 2;
      this.leftFoot.y = nodeTopY;
      this.leftFoot.z = 0;

      this.rightFoot.x = this.currentNode.x + footSpacing / 2;
      this.rightFoot.y = nodeTopY;
      this.rightFoot.z = 0;
    }

    // Eye blinking logic
    this.blinkTimer++;
    if (this.isBlinking) {
      if (this.blinkTimer > 15) { // Blink for 15 frames (about 0.25 seconds)
        this.isBlinking = false;
        this.blinkTimer = 0;
      }
    } else {
      if (this.blinkTimer > 180 + Math.random() * 240) { // Blink every 3-7 seconds
        this.isBlinking = true;
        this.blinkTimer = 0;
      }
    }
  }

  // Render in 2D (screen y = particle.y - particle.z for projection, so higher z appears higher on screen)
  render(ctx: CanvasRenderingContext2D) {
    // Draw constraints (bones)
    ctx.strokeStyle = '#1d1d1f';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';

    for (const constraint of this.constraints) {
      const screenY1 = constraint.p1.y - constraint.p1.z;
      const screenY2 = constraint.p2.y - constraint.p2.z;

      ctx.beginPath();
      ctx.moveTo(constraint.p1.x, screenY1);
      ctx.lineTo(constraint.p2.x, screenY2);
      ctx.stroke();
    }

    // Draw particles (joints) - same size as constraints
    for (const particle of this.particles) {
      const screenY = particle.y - particle.z;

      // Draw head larger
      if (particle === this.head) {
        ctx.fillStyle = '#1d1d1f';
        ctx.beginPath();
        ctx.arc(particle.x, screenY, 13, 0, Math.PI * 2);
        ctx.fill();

        // Draw eyes (big white with black pupils)
        if (!this.isBlinking) {
          const eyeOffsetX = 5;
          const eyeOffsetY = -3;

          // Left eye
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(particle.x - eyeOffsetX, screenY + eyeOffsetY, 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Left pupil
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(particle.x - eyeOffsetX, screenY + eyeOffsetY, 1.5, 0, Math.PI * 2);
          ctx.fill();

          // Right eye
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(particle.x + eyeOffsetX, screenY + eyeOffsetY, 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Right pupil
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(particle.x + eyeOffsetX, screenY + eyeOffsetY, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#1d1d1f';
        ctx.beginPath();
        ctx.arc(particle.x, screenY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
