import * as THREE from 'three';

export class Character {
  constructor(scene) {
    this.scene     = scene;
    this.group     = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.limbs     = {};

    this._build();
    this.group.add(this.bodyGroup);
    scene.add(this.group);

    this.targetYaw = 0;
  }

  // ── Material helpers ────────────────────────────────────────────────────────
  _m(color, opts = {}) {
    return new THREE.MeshLambertMaterial({ color, ...opts });
  }
  _cyl(rt, rb, h, seg = 12) { return new THREE.CylinderGeometry(rt, rb, h, seg); }
  _box(w, h, d)              { return new THREE.BoxGeometry(w, h, d); }
  _sph(r, ws = 14, hs = 12) { return new THREE.SphereGeometry(r, ws, hs); }

  // ── Face texture (canvas-painted) ──────────────────────────────────────────
  _makeFace() {
    const W = 512, H = 512;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');

    // ── Skin base ────────────────────────────────────────────────────────────
    const skinGrad = c.createRadialGradient(W/2, H/2, 20, W/2, H*0.45, 240);
    skinGrad.addColorStop(0, '#f8d5a3');
    skinGrad.addColorStop(1, '#e8b882');
    c.fillStyle = skinGrad;
    c.fillRect(0, 0, W, H);

    // Cheek blush
    c.fillStyle = 'rgba(255,170,140,0.22)';
    c.beginPath(); c.ellipse(130, 285, 58, 38, -0.2, 0, Math.PI*2); c.fill();
    c.beginPath(); c.ellipse(382, 285, 58, 38,  0.2, 0, Math.PI*2); c.fill();

    // ── Eye helper ───────────────────────────────────────────────────────────
    const eye = (ex, ey, flip) => {
      // Shadow under brow
      c.fillStyle = 'rgba(0,0,0,0.08)';
      c.beginPath(); c.ellipse(ex, ey - 10, 44, 20, 0, 0, Math.PI*2); c.fill();
      // Eyelid / white
      c.fillStyle = '#fff';
      c.beginPath(); c.ellipse(ex, ey, 40, 27, 0, 0, Math.PI*2); c.fill();
      // Iris gradient
      const ig = c.createRadialGradient(ex-4, ey-4, 2, ex, ey, 20);
      ig.addColorStop(0, '#7a5230');
      ig.addColorStop(0.5, '#4a2e10');
      ig.addColorStop(1, '#1a0a00');
      c.fillStyle = ig;
      c.beginPath(); c.arc(ex, ey, 20, 0, Math.PI*2); c.fill();
      // Pupil
      c.fillStyle = '#090909';
      c.beginPath(); c.arc(ex, ey, 11, 0, Math.PI*2); c.fill();
      // Specular
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath(); c.arc(ex - 7, ey - 7, 5.5, 0, Math.PI*2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.beginPath(); c.arc(ex + 9, ey - 3, 2.5, 0, Math.PI*2); c.fill();
      // Outline
      c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.lineWidth = 2;
      c.beginPath(); c.ellipse(ex, ey, 40, 27, 0, 0, Math.PI*2); c.stroke();
      // Lash hint
      c.strokeStyle = '#1a0a00';
      c.lineWidth = 3;
      c.beginPath();
      if (flip) {
        c.moveTo(ex - 40, ey - 12); c.quadraticCurveTo(ex, ey - 34, ex + 40, ey - 14);
      } else {
        c.moveTo(ex - 40, ey - 12); c.quadraticCurveTo(ex, ey - 34, ex + 40, ey - 14);
      }
      c.stroke();
    };

    eye(164, 208, false);
    eye(348, 208, true);

    // ── Eyebrows ─────────────────────────────────────────────────────────────
    const brow = (bx, by, dir) => {
      c.save();
      c.strokeStyle = '#3a1e08';
      c.lineWidth = 10;
      c.lineCap = 'round';
      c.shadowColor = 'rgba(0,0,0,0.3)';
      c.shadowBlur = 4;
      c.beginPath();
      c.moveTo(bx - 46, by + dir * 5);
      c.quadraticCurveTo(bx + 2, by - 16, bx + 46, by + dir * 3);
      c.stroke();
      c.restore();
    };
    brow(164, 163, -1);
    brow(348, 163, 1);

    // ── Nose ─────────────────────────────────────────────────────────────────
    c.strokeStyle = 'rgba(160,95,50,0.55)';
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(256, 228); c.lineTo(238, 285);
    c.quadraticCurveTo(256, 302, 274, 285);
    c.stroke();
    // Nostril shadows
    c.fillStyle = 'rgba(140,70,30,0.35)';
    c.beginPath(); c.ellipse(240, 290, 13, 9, -0.4, 0, Math.PI*2); c.fill();
    c.beginPath(); c.ellipse(272, 290, 13, 9,  0.4, 0, Math.PI*2); c.fill();

    // ── Mouth ─────────────────────────────────────────────────────────────────
    // Upper lip shape
    c.fillStyle = '#c47060';
    c.beginPath();
    c.moveTo(212, 336);
    c.quadraticCurveTo(234, 320, 256, 324);
    c.quadraticCurveTo(278, 320, 300, 336);
    c.quadraticCurveTo(256, 350, 212, 336);
    c.fill();
    // Lower lip
    c.fillStyle = '#d98070';
    c.beginPath();
    c.moveTo(212, 336);
    c.quadraticCurveTo(256, 375, 300, 336);
    c.quadraticCurveTo(256, 380, 212, 336);
    c.fill();
    // Lip line
    c.strokeStyle = 'rgba(160,60,50,0.7)';
    c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(212, 336); c.quadraticCurveTo(256, 346, 300, 336); c.stroke();
    // Corner shadows
    c.fillStyle = 'rgba(120,40,30,0.4)';
    c.beginPath(); c.arc(212, 336, 5, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(300, 336, 5, 0, Math.PI*2); c.fill();

    // Chin highlight
    c.fillStyle = 'rgba(255,255,255,0.1)';
    c.beginPath(); c.ellipse(256, 400, 45, 22, 0, 0, Math.PI*2); c.fill();

    // Ear hints (for side views)
    c.fillStyle = '#e8b882';
    c.beginPath(); c.ellipse(24, 256, 18, 28, 0, 0, Math.PI*2); c.fill();
    c.beginPath(); c.ellipse(488, 256, 18, 28, 0, 0, Math.PI*2); c.fill();

    return new THREE.CanvasTexture(cv);
  }

  // ── Boot group ─────────────────────────────────────────────────────────────
  _buildBoot() {
    const g = new THREE.Group();
    const dark  = this._m(0x111111);
    const sole  = this._m(0x0a0a0a);
    const lace  = this._m(0xffffff);

    // Main boot (elongated, slightly tilted forward)
    const body = new THREE.Mesh(this._box(0.2, 0.13, 0.40), dark);
    body.position.set(0, 0, 0.05);
    g.add(body);

    // Heel bump
    const heel = new THREE.Mesh(this._sph(0.09, 8, 6), dark);
    heel.scale.set(1.1, 0.8, 1);
    heel.position.set(0, 0, -0.17);
    g.add(heel);

    // Toe cap (slightly lighter)
    const toe = new THREE.Mesh(this._sph(0.09, 8, 6), this._m(0x222222));
    toe.scale.set(1.05, 0.75, 1.2);
    toe.position.set(0, 0.01, 0.22);
    g.add(toe);

    // Sole plate
    const soleM = new THREE.Mesh(this._box(0.22, 0.04, 0.44), sole);
    soleM.position.set(0, -0.085, 0.04);
    g.add(soleM);

    // Lace strip
    const laceStrip = new THREE.Mesh(this._box(0.09, 0.02, 0.22), lace);
    laceStrip.position.set(0, 0.07, 0.08);
    g.add(laceStrip);

    // Cleats (stud pattern)
    const cleatGeo = new THREE.CylinderGeometry(0.022, 0.016, 0.04, 6);
    const cleatMat = this._m(0x555555);
    [[-0.07, -0.15], [0.07, -0.15], [-0.08, 0.04], [0.08, 0.04], [-0.06, 0.21], [0.06, 0.21]].forEach(([cx, cz]) => {
      const cl = new THREE.Mesh(cleatGeo, cleatMat);
      cl.position.set(cx, -0.11, cz - 0.01);
      g.add(cl);
    });

    return g;
  }

  // ── Main build ──────────────────────────────────────────────────────────────
  _build() {
    // ── Palette ─────────────────────────────────────────────────────────────
    const skin    = this._m(0xf5c9a0);
    const jerseyR = this._m(0xd40020); // deep red kit
    const jerAcct = this._m(0xffffff); // white accents
    const shortsC = this._m(0xffffff); // white shorts
    const sockRed = this._m(0xd40020); // red socks
    const sockWht = this._m(0xffffff); // white sock stripe
    const hair    = this._m(0x0e0600);

    // ── HEAD ────────────────────────────────────────────────────────────────
    const head = new THREE.Mesh(
      this._sph(0.30, 18, 16),
      new THREE.MeshLambertMaterial({ map: this._makeFace() }),
    );
    head.position.y = 2.04;
    head.castShadow = true;

    // Hair cap (covers top ~55%)
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.315, 16, 10, 0, Math.PI*2, 0, 1.2),
      hair,
    );
    hairCap.position.y = 0.04;
    head.add(hairCap);

    // Side / back hair fill
    const hairSide = new THREE.Mesh(
      new THREE.SphereGeometry(0.318, 12, 8, 0, Math.PI*2, 0.9, 0.85),
      hair,
    );
    hairSide.rotation.x = 0.25;
    head.add(hairSide);

    this.limbs.head = head;

    // ── NECK ────────────────────────────────────────────────────────────────
    const neck = new THREE.Mesh(this._cyl(0.10, 0.12, 0.22, 10), skin);
    neck.position.y = 1.78;

    // ── TORSO ───────────────────────────────────────────────────────────────
    // Main jersey body (tapers slightly toward waist)
    const torsoGeo = new THREE.CylinderGeometry(0.30, 0.26, 0.78, 12);
    const torso = new THREE.Mesh(torsoGeo, jerseyR);
    torso.position.y = 1.52;
    torso.castShadow = true;

    // Collar (V-neck shape: flat ring at top)
    const collar = new THREE.Mesh(this._cyl(0.155, 0.135, 0.06, 8), jerAcct);
    collar.position.set(0, 0.42, 0);
    torso.add(collar);

    // Chest badge area
    const badge = new THREE.Mesh(this._box(0.12, 0.12, 0.02), jerAcct);
    badge.position.set(-0.14, 0.18, 0.275);
    torso.add(badge);

    // Number plate on back
    const numBack = new THREE.Mesh(this._box(0.22, 0.24, 0.02), jerAcct);
    numBack.position.set(0, 0.06, -0.275);
    torso.add(numBack);

    // Side stripe (darker red panel)
    [-1, 1].forEach(side => {
      const panel = new THREE.Mesh(this._box(0.08, 0.78, 0.4), this._m(0xaa0018));
      panel.position.set(side * 0.22, 0, 0);
      torso.add(panel);
    });

    // ── SHOULDERS ────────────────────────────────────────────────────────────
    const shoulderGeo = new THREE.SphereGeometry(0.14, 10, 8);
    const lShoulder = new THREE.Mesh(shoulderGeo, jerseyR);
    lShoulder.scale.set(1, 0.85, 0.95);
    lShoulder.position.set(0.42, 1.78, 0);
    const rShoulder = lShoulder.clone();
    rShoulder.position.x = -0.42;

    // ── UPPER ARMS ───────────────────────────────────────────────────────────
    const lUArm = new THREE.Mesh(this._cyl(0.105, 0.09, 0.38, 10), jerseyR);
    lUArm.position.set(0.43, 1.55, 0);
    // Sleeve cap stripe
    const sleeveCap = new THREE.Mesh(this._cyl(0.107, 0.107, 0.06, 10), jerAcct);
    sleeveCap.position.y = 0.19;
    lUArm.add(sleeveCap);
    // Sleeve end stripe
    const sleeveEnd = new THREE.Mesh(this._cyl(0.093, 0.093, 0.06, 10), jerAcct);
    sleeveEnd.position.y = -0.19;
    lUArm.add(sleeveEnd);

    const rUArm = lUArm.clone();
    rUArm.position.x = -0.43;
    // Clone children properly
    rUArm.clear();
    rUArm.add(sleeveCap.clone());
    rUArm.add(sleeveEnd.clone());

    this.limbs.lUArm = lUArm;
    this.limbs.rUArm = rUArm;

    // ── FOREARMS ─────────────────────────────────────────────────────────────
    const lFArm = new THREE.Mesh(this._cyl(0.082, 0.072, 0.32, 10), skin);
    lFArm.position.set(0, -0.38, 0);
    lUArm.add(lFArm);

    const rFArm = lFArm.clone();
    rUArm.add(rFArm);

    // Hands
    const handM = new THREE.Mesh(this._sph(0.09, 9, 7), skin);
    handM.position.y = -0.19;
    lFArm.add(handM);
    rFArm.add(handM.clone());

    this.limbs.lFArm = lFArm;
    this.limbs.rFArm = rFArm;

    // ── BELT ──────────────────────────────────────────────────────────────────
    const belt = new THREE.Mesh(this._box(0.58, 0.07, 0.38), this._m(0x333333));
    belt.position.y = 1.14;

    // ── PELVIS / SHORTS ───────────────────────────────────────────────────────
    const pelvisGeo = new THREE.CylinderGeometry(0.26, 0.22, 0.30, 10);
    const pelvis = new THREE.Mesh(pelvisGeo, shortsC);
    pelvis.position.y = 0.98;

    // Shorts seam stripe
    [-0.13, 0.13].forEach(side => {
      const seam = new THREE.Mesh(this._box(0.04, 0.30, 0.02), this._m(0xdddddd));
      seam.position.set(side, 0, 0.22);
      pelvis.add(seam);
    });

    // ── THIGHS ────────────────────────────────────────────────────────────────
    const lThigh = new THREE.Mesh(this._cyl(0.130, 0.110, 0.48, 10), shortsC);
    lThigh.position.set(0.175, 0.80, 0);

    // Shorts hem
    const hem = new THREE.Mesh(this._cyl(0.132, 0.132, 0.05, 10), jerAcct);
    hem.position.y = -0.24;
    lThigh.add(hem);

    const rThigh = lThigh.clone();
    rThigh.position.x = -0.175;
    rThigh.clear();
    rThigh.add(hem.clone());

    this.limbs.lThigh = lThigh;
    this.limbs.rThigh = rThigh;

    // ── SHINS / SOCKS ─────────────────────────────────────────────────────────
    const lShin = new THREE.Mesh(this._cyl(0.100, 0.085, 0.44, 10), sockRed);
    lShin.position.set(0, -0.48, 0);
    lThigh.add(lShin);

    // Sock top white band
    const sockBand = new THREE.Mesh(this._cyl(0.102, 0.102, 0.07, 10), sockWht);
    sockBand.position.y = 0.20;
    lShin.add(sockBand);

    const rShin = lShin.clone();
    rThigh.add(rShin);

    this.limbs.lShin = lShin;
    this.limbs.rShin = rShin;

    // ── BOOTS ─────────────────────────────────────────────────────────────────
    const lBoot = this._buildBoot();
    lBoot.position.set(0, -0.28, 0.0);
    lShin.add(lBoot);

    const rBoot = this._buildBoot();
    rBoot.position.set(0, -0.28, 0.0);
    rShin.add(rBoot);

    // ── ASSEMBLE ──────────────────────────────────────────────────────────────
    this.bodyGroup.add(
      head, neck, torso, belt,
      lShoulder, rShoulder,
      lUArm, rUArm,
      pelvis, lThigh, rThigh,
    );

    // Lift so boots sit ON the ground
    this.bodyGroup.position.y = 0.05;
  }

  // ── Public API ──────────────────────────────────────────────────────────────
  get position() { return this.group.position; }
  setFacingYaw(y) { this.targetYaw = y; }

  update(t, isMoving) {
    // Smooth body rotation
    let diff = this.targetYaw - this.bodyGroup.rotation.y;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.bodyGroup.rotation.y += diff * 0.14;

    isMoving ? this._walkAnim(t) : this._idleAnim(t);
  }

  _walkAnim(t) {
    const { lThigh, rThigh, lShin, rShin, lUArm, rUArm, lFArm, rFArm } = this.limbs;
    const s = Math.sin(t * 9);

    lThigh.rotation.x = s * 0.65;
    rThigh.rotation.x = -s * 0.65;
    lShin.rotation.x  = Math.max(0, -s) * 0.80;
    rShin.rotation.x  = Math.max(0,  s) * 0.80;

    lUArm.rotation.x = -s * 0.55;
    rUArm.rotation.x =  s * 0.55;
    lFArm.rotation.x = Math.max(0, s) * 0.45;
    rFArm.rotation.x = Math.max(0, -s) * 0.45;
    lUArm.rotation.z = 0.10;
    rUArm.rotation.z = -0.10;

    // Subtle trunk twist
    this.bodyGroup.rotation.y += Math.sin(t * 9 + Math.PI / 2) * 0.018;

    this.group.position.y = Math.abs(Math.sin(t * 9)) * 0.055;
  }

  _idleAnim(t) {
    const { lThigh, rThigh, lShin, rShin, lUArm, rUArm, lFArm, rFArm, head } = this.limbs;
    const d = 0.83;
    lThigh.rotation.x *= d; rThigh.rotation.x *= d;
    lShin.rotation.x  *= d; rShin.rotation.x  *= d;
    lUArm.rotation.x  *= d; rUArm.rotation.x  *= d;
    lFArm.rotation.x  *= d; rFArm.rotation.x  *= d;

    lUArm.rotation.z =  0.10 + Math.sin(t * 1.1) * 0.025;
    rUArm.rotation.z = -0.10 - Math.sin(t * 1.1) * 0.025;

    // Breathing bob
    this.group.position.y = Math.sin(t * 1.4) * 0.012;

    // Subtle look-around
    head.rotation.y = Math.sin(t * 0.65) * 0.14;
    head.rotation.x = Math.sin(t * 0.42) * 0.05;
  }
}
