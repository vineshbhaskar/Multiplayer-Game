import * as THREE from 'three';

const TOUCH_SENS  = 0.006;   // radians per pixel for touch drag
const MOUSE_SENS  = 0.0022;  // radians per pixel for pointer-lock mouse

export class ThirdPersonCamera {
  constructor(camera, characterGroup) {
    this.camera    = camera;
    this.target    = characterGroup;

    this.yaw       = Math.PI;   // start BEHIND the character (faces +Z)
    this.pitch     = 0.28;
    this.distance  = 7;
    this.heightOff = 1.6;

    this._setInitialPosition();
    this._currentPos = camera.position.clone();
    this._locked     = false;

    this._bindPointerLock();
  }

  _setInitialPosition() {
    const cp   = this.target.position;
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    this.camera.position.set(
      cp.x + this.distance * Math.sin(this.yaw) * cosP,
      cp.y + this.heightOff + this.distance * sinP,
      cp.z + this.distance * Math.cos(this.yaw) * cosP,
    );
  }

  // ── Pointer-lock (desktop mouse look) ──────────────────────────────────────
  _bindPointerLock() {
    document.addEventListener('mousemove', e => {
      if (!this._locked) return;
      this.applyLookDelta(e.movementX * MOUSE_SENS, e.movementY * MOUSE_SENS);
    });

    document.addEventListener('pointerlockchange', () => {
      this._locked = document.pointerLockElement !== null;
    });
  }

  lock()   { document.body.requestPointerLock(); }
  unlock() { document.exitPointerLock(); }

  // ── Shared look delta (called from mouse OR touch) ──────────────────────────
  applyLookDelta(dyaw, dpitch) {
    this.yaw   -= dyaw;
    this.pitch += dpitch;
    this.pitch  = Math.max(-0.05, Math.min(0.78, this.pitch));
  }

  // Touch delta in pixels → convert then apply
  applyTouchPixels(dx, dy) {
    this.applyLookDelta(dx * TOUCH_SENS, dy * TOUCH_SENS);
  }

  // ── Forward / right dirs for player movement ────────────────────────────────
  getForwardDir() {
    const cp  = this.target.position;
    const dir = new THREE.Vector3(cp.x - this._currentPos.x, 0, cp.z - this._currentPos.z);
    return dir.lengthSq() > 0.001 ? dir.normalize() : new THREE.Vector3(0, 0, 1);
  }

  getRightDir() {
    const fwd = this.getForwardDir();
    return new THREE.Vector3(-fwd.z, 0, fwd.x); // corrected: screen-right = world -X when camera is behind
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  update() {
    const cp   = this.target.position;
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);

    const desired = new THREE.Vector3(
      cp.x + this.distance * Math.sin(this.yaw) * cosP,
      cp.y + this.heightOff + this.distance * sinP,
      cp.z + this.distance * Math.cos(this.yaw) * cosP,
    );

    this._currentPos.lerp(desired, 0.18);
    this.camera.position.copy(this._currentPos);

    const lookAt = new THREE.Vector3(cp.x, cp.y + this.heightOff * 0.7, cp.z);
    this.camera.lookAt(lookAt);
  }
}
