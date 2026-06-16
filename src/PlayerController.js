import * as THREE from 'three';

const WALK_SPEED   = 7;
const RUN_SPEED    = 13;
const BOUND_X      = 52;
const BOUND_Z      = 35;

const MAX_STAMINA   = 100;
const DRAIN_RATE    = 22;   // per second while sprinting
const REGEN_RATE    = 18;   // per second while not sprinting
const REGEN_DELAY   = 0.8;  // seconds of rest before regen starts
const SPRINT_FLOOR  = 8;    // stamina must recover above this to sprint again

export class PlayerController {
  constructor(character, thirdPersonCamera, mobileControls = null) {
    this.character = character;
    this.cam       = thirdPersonCamera;
    this.mobile    = mobileControls;

    this.keys = {};

    // Stamina
    this.stamina      = MAX_STAMINA;
    this._regenTimer  = 0;       // countdown before regen starts
    this._exhausted   = false;   // locked out of sprinting until floor reached

    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', e => { this.keys[e.code] = true;  });
    window.addEventListener('keyup',   e => { this.keys[e.code] = false; });
  }

  // Returns true if player wants to sprint AND has enough stamina
  _wantsSprint() {
    const shiftHeld = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    // Mobile: auto-sprint when joystick pushed past 75 %
    const mobileFullPush = (this.mobile?.joystickMag ?? 0) > 0.75;
    return shiftHeld || mobileFullPush;
  }

  get _speed() {
    if (this._exhausted || this.stamina <= 0) return WALK_SPEED;
    return this._wantsSprint() ? RUN_SPEED : WALK_SPEED;
  }

  get isSprinting() {
    return this._speed === RUN_SPEED;
  }

  isMoving() {
    const kb = !!(
      this.keys['KeyW']     || this.keys['ArrowUp']   ||
      this.keys['KeyS']     || this.keys['ArrowDown']  ||
      this.keys['KeyA']     || this.keys['ArrowLeft']  ||
      this.keys['KeyD']     || this.keys['ArrowRight']
    );
    return kb || (this.mobile?.isMoving() ?? false);
  }

  // Called every frame — returns stamina 0..100 for the HUD
  update(delta) {
    // ── Stamina logic ──────────────────────────────────────────────────────────
    const sprinting = this.isSprinting && this.isMoving();

    if (sprinting) {
      this._regenTimer = REGEN_DELAY;
      this.stamina = Math.max(0, this.stamina - DRAIN_RATE * delta);
      if (this.stamina === 0) this._exhausted = true;
    } else {
      this._regenTimer = Math.max(0, this._regenTimer - delta);
      if (this._regenTimer === 0) {
        this.stamina = Math.min(MAX_STAMINA, this.stamina + REGEN_RATE * delta);
        if (this._exhausted && this.stamina >= SPRINT_FLOOR) {
          this._exhausted = false;
        }
      }
    }

    // ── Movement ───────────────────────────────────────────────────────────────
    const fwd   = this.cam.getForwardDir();
    const right = this.cam.getRightDir();
    const dir   = new THREE.Vector3();

    if (this.keys['KeyW'] || this.keys['ArrowUp'])    dir.add(fwd);
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  dir.sub(fwd);
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  dir.sub(right);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dir.add(right);

    if (this.mobile?.isMoving()) {
      const m = this.mobile.movement;
      dir.addScaledVector(right, -m.x);
      dir.addScaledVector(fwd, -m.y);
    }

    dir.y = 0;

    if (dir.lengthSq() > 0) {
      dir.normalize();
      const pos = this.character.position;
      pos.x = Math.max(-BOUND_X, Math.min(BOUND_X, pos.x + dir.x * this._speed * delta));
      pos.z = Math.max(-BOUND_Z, Math.min(BOUND_Z, pos.z + dir.z * this._speed * delta));
      this.character.setFacingYaw(Math.atan2(dir.x, dir.z));
    }

    return this.stamina;
  }
}
