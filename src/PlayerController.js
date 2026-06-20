import * as THREE from 'three';

const WALK_MIN   = 2.0;   // speed when joystick barely tilted
const WALK_SPEED = 7;     // speed at full walk (joystick 50-75%)
const RUN_SPEED  = 13;    // speed when sprinting (joystick > 75%)
const BOUND_X    = 52;
const BOUND_Z    = 35;

const MAX_STAMINA  = 100;
const DRAIN_RATE   = 6;    // per second while sprinting (~17s to empty)
const REGEN_RATE   = 10;   // per second while resting
const REGEN_DELAY  = 2.0;  // seconds before regen starts after sprint
const SPRINT_FLOOR = 15;   // must recover above this before sprinting again

export class PlayerController {
  constructor(character, thirdPersonCamera, mobileControls = null) {
    this.character = character;
    this.cam       = thirdPersonCamera;
    this.mobile    = mobileControls;

    this.keys = {};

    this.stamina      = MAX_STAMINA;
    this._regenTimer  = 0;
    this._exhausted   = false;

    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', e => { this.keys[e.code] = true;  });
    window.addEventListener('keyup',   e => { this.keys[e.code] = false; });
  }

  _wantsSprint() {
    const shiftHeld    = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const mobileFullPush = (this.mobile?.joystickMag ?? 0) > 0.75;
    return shiftHeld || mobileFullPush;
  }

  // Proportional speed based on joystick magnitude (mobile) or keyboard (desktop full-speed)
  get _speed() {
    const sprinting = this._wantsSprint() && !this._exhausted && this.stamina > 0;
    if (sprinting) return RUN_SPEED;

    if (this.mobile) {
      const mag = Math.min(this.mobile.joystickMag, 0.75) / 0.75;  // 0..1 in walk range
      return WALK_MIN + (WALK_SPEED - WALK_MIN) * mag;
    }
    return WALK_SPEED;
  }

  get isSprinting() {
    return this._wantsSprint() && !this._exhausted && this.stamina > 0;
  }

  isMoving() {
    const kb = !!(
      this.keys['KeyW']  || this.keys['ArrowUp']    ||
      this.keys['KeyS']  || this.keys['ArrowDown']  ||
      this.keys['KeyA']  || this.keys['ArrowLeft']  ||
      this.keys['KeyD']  || this.keys['ArrowRight']
    );
    return kb || (this.mobile?.isMoving() ?? false);
  }

  update(delta) {
    // ── Stamina ────────────────────────────────────────────────────────────
    const sprinting = this.isSprinting && this.isMoving();

    if (sprinting) {
      this._regenTimer = REGEN_DELAY;
      this.stamina = Math.max(0, this.stamina - DRAIN_RATE * delta);
      if (this.stamina === 0) this._exhausted = true;
    } else {
      this._regenTimer = Math.max(0, this._regenTimer - delta);
      if (this._regenTimer === 0) {
        this.stamina = Math.min(MAX_STAMINA, this.stamina + REGEN_RATE * delta);
        if (this._exhausted && this.stamina >= SPRINT_FLOOR) this._exhausted = false;
      }
    }

    // ── Movement ───────────────────────────────────────────────────────────
    const fwd   = this.cam.getForwardDir();
    const right = this.cam.getRightDir();
    const dir   = new THREE.Vector3();

    if (this.keys['KeyW'] || this.keys['ArrowUp'])    dir.add(fwd);
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  dir.sub(fwd);
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  dir.sub(right);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dir.add(right);

    if (this.mobile?.isMoving()) {
      const m = this.mobile.movement;
      dir.addScaledVector(right, m.x);   // positive m.x = joystick right = move right
      dir.addScaledVector(fwd,  -m.y);   // positive m.y = joystick down  = move back
    }

    dir.y = 0;

    if (dir.lengthSq() > 0) {
      dir.normalize();
      const pos = this.character.position;
      const spd = this._speed;
      pos.x = Math.max(-BOUND_X, Math.min(BOUND_X, pos.x + dir.x * spd * delta));
      pos.z = Math.max(-BOUND_Z, Math.min(BOUND_Z, pos.z + dir.z * spd * delta));
      this.character.setFacingYaw(Math.atan2(dir.x, dir.z));
    }

    return this.stamina;
  }
}
