import * as THREE from 'three';

export const BALL_RADIUS = 1.1;  // bigger than the ~1.8 m player
const GRAVITY      = -24;    // m/s² (slightly exaggerated for fun)
const BOUNCE       = 0.60;   // energy retained on bounce
const ROLL_FRIC    = 0.984;  // per-frame speed multiplier on ground
const AIR_DRAG     = 0.998;  // per-frame speed multiplier in air
const KICK_POWER   = 20;     // m/s  base kick speed (horizontal)
const KICK_LOFT    = 8;      // m/s  upward component
export const KICK_RANGE = 2.5; // metres – how close the player must be

export class Football {
  constructor(scene) {
    this.vel = new THREE.Vector3();
    this._onGround = false;

    const geo = new THREE.SphereGeometry(BALL_RADIUS, 28, 20);
    const mat = new THREE.MeshLambertMaterial({ map: this._makeTexture() });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(10, BALL_RADIUS, 0);
    this.mesh.castShadow  = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  // ── Canvas football texture ─────────────────────────────────────────────────
  _makeTexture() {
    const S = 512;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, S, S);

    // Pentagon patch centres in UV space.
    // u = lon/360 (Three.js sphere wraps 0→1), v_canvas = 1 - (lat+90)/180
    const patches = [
      [0.50, 0.00],  // north pole
      [0.00, 0.352], [0.20, 0.352], [0.40, 0.352], [0.60, 0.352], [0.80, 0.352],
      [0.10, 0.648], [0.30, 0.648], [0.50, 0.648], [0.70, 0.648], [0.90, 0.648],
      [0.50, 1.00],  // south pole
    ];

    ctx.fillStyle   = '#161616';
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth   = 3;

    const R = S * 0.088;
    patches.forEach(([u, v]) => {
      this._pentagon(ctx, u * S, v * S, R);
      // Draw wrapped copies so seams look clean
      if (u < 0.15) this._pentagon(ctx, (u + 1) * S, v * S, R);
      if (u > 0.85) this._pentagon(ctx, (u - 1) * S, v * S, R);
      if (v < 0.10) this._pentagon(ctx, u * S, (v + 1) * S, R);
      if (v > 0.90) this._pentagon(ctx, u * S, (v - 1) * S, R);
    });

    // Subtle seam lines connecting patches (gives hand-stitched feel)
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth   = 1.5;
    for (let x = 0; x < S; x += S / 5) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
    }
    for (let y = 0; y < S; y += S / 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
    }

    return new THREE.CanvasTexture(cv);
  }

  _pentagon(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // ── Public API ──────────────────────────────────────────────────────────────
  get position() { return this.mesh.position; }

  kick(direction, power = 1.0) {
    const d = direction.clone().setY(0).normalize();
    this.vel.set(
      d.x * KICK_POWER * power,
      KICK_LOFT * power,
      d.z * KICK_POWER * power,
    );
  }

  distanceTo(pos) {
    return this.mesh.position.distanceTo(pos);
  }

  // ── Physics update ──────────────────────────────────────────────────────────
  update(delta) {
    const pos   = this.mesh.position;
    const FLOOR = BALL_RADIUS;

    // Gravity
    this.vel.y += GRAVITY * delta;

    // Drag
    const inAir = pos.y > FLOOR + 0.08;
    const dragFactor = Math.pow(inAir ? AIR_DRAG : ROLL_FRIC, delta * 60);
    this.vel.x *= dragFactor;
    this.vel.z *= dragFactor;

    // Move
    pos.addScaledVector(this.vel, delta);

    // Ground bounce
    if (pos.y <= FLOOR) {
      pos.y = FLOOR;
      if (this.vel.y < -0.8) {
        this.vel.y = -this.vel.y * BOUNCE;
      } else {
        this.vel.y = 0;
      }
    }

    // Net walls — matches the perimeter net positions in Stadium
    const BX = 55.5, BZ = 38.0;
    if (Math.abs(pos.x) > BX) {
      pos.x = Math.sign(pos.x) * BX;
      this.vel.x *= -0.35;   // net absorbs energy
      this.vel.z *= 0.65;
    }
    if (Math.abs(pos.z) > BZ) {
      pos.z = Math.sign(pos.z) * BZ;
      this.vel.z *= -0.35;
      this.vel.x *= 0.65;
    }

    // Rolling rotation: axis perpendicular to velocity, in XZ plane
    const hSpeed = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
    if (hSpeed > 0.05) {
      const axis = new THREE.Vector3(-this.vel.z, 0, this.vel.x).normalize();
      this.mesh.rotateOnWorldAxis(axis, (hSpeed * delta) / BALL_RADIUS);
    }

    // Spin in the air (maintain angular momentum – just keep existing rotation)
    // Three.js rotation already accumulates, nothing extra needed.
  }
}
