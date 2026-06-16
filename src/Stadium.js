import * as THREE from 'three';

// Pitch dimensions (metres)
const PW = 110;  // length along X
const PD = 75;   // width  along Z

// Stand gap from pitch edge
const SIDE_GAP = 8;   // north/south (Z sides)
const END_GAP  = 6;   // east/west   (X ends)

export class Stadium {
  constructor(scene) {
    this.scene = scene;
    this.crowdBodies = [];   // InstancedMesh refs for wave animation
    this.crowdMeta  = [];    // { mesh, offsets[], axis }

    this._buildSky();
    this._buildPitch();
    this._buildGoals();
    this._buildStands();
    this._buildFloodlightPoles();
    this._buildPerimeterNets();
  }

  // ── Sky gradient backdrop ───────────────────────────────────────────────────
  _buildSky() {
    // Large hemisphere to fake sky gradient
    const geo = new THREE.SphereGeometry(480, 16, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x87ceeb,
      side: THREE.BackSide,
    });
    this.scene.add(new THREE.Mesh(geo, mat));
  }

  // ── Pitch ───────────────────────────────────────────────────────────────────
  _buildPitch() {
    const tex = this._makePitchTexture();

    // Playing surface
    const pitchMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PD),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    pitchMesh.rotation.x = -Math.PI / 2;
    pitchMesh.receiveShadow = true;
    this.scene.add(pitchMesh);

    // Surrounding apron (darker green)
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(PW + END_GAP * 2 + 10, PD + SIDE_GAP * 2 + 10),
      new THREE.MeshLambertMaterial({ color: 0x1e6012 }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.02;
    apron.receiveShadow = true;
    this.scene.add(apron);
  }

  _makePitchTexture() {
    const W = 1024, H = 700;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');

    // Alternating stripe pattern
    const stripes = 12;
    const sw = W / stripes;
    for (let i = 0; i < stripes; i++) {
      c.fillStyle = i % 2 === 0 ? '#2e8020' : '#359426';
      c.fillRect(i * sw, 0, sw, H);
    }

    // ── White markings ──────────────────────────────────────────────────────
    c.strokeStyle = 'rgba(255,255,255,0.95)';
    c.lineWidth = 3.5;
    c.lineCap = 'round';

    const mx = 30, my = 25; // margin in canvas pixels
    const fw = W - mx * 2, fh = H - my * 2; // field rect

    // Border
    c.strokeRect(mx, my, fw, fh);

    // Halfway line
    c.beginPath();
    c.moveTo(W / 2, my);
    c.lineTo(W / 2, H - my);
    c.stroke();

    // Centre circle (radius ~9.15 m → scaled)
    const cx = W / 2, cy = H / 2;
    const scaleX = fw / PW, scaleY = fh / PD;
    c.beginPath();
    c.ellipse(cx, cy, 9.15 * scaleX, 9.15 * scaleY, 0, 0, Math.PI * 2);
    c.stroke();

    // Centre spot
    c.fillStyle = 'white';
    c.beginPath(); c.arc(cx, cy, 3, 0, Math.PI * 2); c.fill();

    // ── Penalty areas (16.5 m deep, 40.32 m wide) ───────────────────────────
    const penDepth = 16.5 * scaleX;
    const penHalf  = 20.16 * scaleY;
    // Left (west) penalty box
    c.strokeRect(mx, cy - penHalf, penDepth, penHalf * 2);
    // Right (east) penalty box
    c.strokeRect(W - mx - penDepth, cy - penHalf, penDepth, penHalf * 2);

    // ── Goal areas (5.5 m deep, 18.32 m wide) ───────────────────────────────
    const gaDepth = 5.5 * scaleX;
    const gaHalf  = 9.16 * scaleY;
    c.strokeRect(mx, cy - gaHalf, gaDepth, gaHalf * 2);
    c.strokeRect(W - mx - gaDepth, cy - gaHalf, gaDepth, gaHalf * 2);

    // ── Penalty spots (11 m from goal line) ─────────────────────────────────
    const penSpot = 11 * scaleX;
    c.fillStyle = 'white';
    c.beginPath(); c.arc(mx + penSpot, cy, 4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(W - mx - penSpot, cy, 4, 0, Math.PI * 2); c.fill();

    // ── Penalty arcs ─────────────────────────────────────────────────────────
    c.save();
    c.beginPath();
    c.ellipse(mx + penSpot, cy, 9.15 * scaleX, 9.15 * scaleY, 0, -Math.PI * 0.65, Math.PI * 0.65);
    c.clip();
    c.strokeRect(mx + penDepth, cy - penHalf, 1, penHalf * 2); // dummy to force stroke outside box
    c.restore();
    c.beginPath();
    c.ellipse(mx + penSpot, cy, 9.15 * scaleX, 9.15 * scaleY, 0, -Math.PI * 0.65, Math.PI * 0.65);
    c.stroke();
    c.beginPath();
    c.ellipse(W - mx - penSpot, cy, 9.15 * scaleX, 9.15 * scaleY, 0, Math.PI - Math.PI * 0.65, Math.PI + Math.PI * 0.65);
    c.stroke();

    // ── Corner arcs ──────────────────────────────────────────────────────────
    const cr = 1 * scaleX;
    const corners = [[mx, my], [W - mx, my], [mx, H - my], [W - mx, H - my]];
    corners.forEach(([px, py]) => {
      const startA = Math.atan2(cy - py, cx - px) - Math.PI / 4;
      c.beginPath();
      c.arc(px, py, cr * 8, startA, startA + Math.PI / 2);
      c.stroke();
    });

    return new THREE.CanvasTexture(cv);
  }

  // ── Goals ───────────────────────────────────────────────────────────────────
  _buildGoals() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const netMat = new THREE.MeshLambertMaterial({
      color: 0xdddddd,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      wireframe: true,
    });

    const POST_R = 0.18;
    const GOAL_W = 14;    // scaled up to match big ball (ball diameter ≈ 2.2 m)
    const GOAL_H = 6;

    const makeGoal = (x, dir) => {
      const g = new THREE.Group();

      const post = (px, pz) => {
        const m = new THREE.Mesh(
          new THREE.CylinderGeometry(POST_R, POST_R, GOAL_H, 10),
          mat,
        );
        m.position.set(px, GOAL_H / 2, pz);
        m.castShadow = true;
        g.add(m);
      };

      post(0, -GOAL_W / 2);
      post(0,  GOAL_W / 2);

      // Crossbar
      const cb = new THREE.Mesh(
        new THREE.CylinderGeometry(POST_R, POST_R, GOAL_W, 10),
        mat,
      );
      cb.rotation.x = Math.PI / 2;
      cb.position.set(0, GOAL_H, 0);
      cb.castShadow = true;
      g.add(cb);

      // Back post (depth ~2 m)
      const depth = 2;
      const backX = x + dir * depth;

      // Top bar
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(POST_R * 0.8, POST_R * 0.8, depth, 6),
        mat,
      );
      top.rotation.z = Math.PI / 2;
      top.position.set(dir * depth / 2, GOAL_H, -GOAL_W / 2);
      g.add(top.clone());
      top.position.z = GOAL_W / 2;
      g.add(top);

      // Net
      const netGeo = new THREE.BoxGeometry(depth, GOAL_H, GOAL_W);
      const net = new THREE.Mesh(netGeo, netMat);
      net.position.set(dir * depth / 2, GOAL_H / 2, 0);
      g.add(net);

      g.position.set(x, 0, 0);
      this.scene.add(g);
    };

    makeGoal(-(PW / 2),  1);
    makeGoal( (PW / 2), -1);
  }

  // ── Stands ──────────────────────────────────────────────────────────────────
  _buildStands() {
    // Concrete colours
    const concreteMat = new THREE.MeshLambertMaterial({ color: 0x9e9e9e });
    const roofMat     = new THREE.MeshLambertMaterial({ color: 0x616161, side: THREE.DoubleSide });
    const trackMat    = new THREE.MeshLambertMaterial({ color: 0xc8a870 }); // athletics track colour

    const ROWS      = 10;
    const ROW_H     = 1.3;
    const ROW_D     = 2.0;
    const STAND_H   = ROWS * ROW_H;
    const STAND_D   = ROWS * ROW_D;

    // Thin athletics track around pitch
    const track = new THREE.Mesh(
      new THREE.PlaneGeometry(PW + 16, PD + 16),
      trackMat,
    );
    track.rotation.x = -Math.PI / 2;
    track.position.y = -0.01;
    this.scene.add(track);

    // Helper: build a straight tiered stand section
    const buildStand = (length, pivotX, pivotZ, rotY) => {
      const group = new THREE.Group();

      for (let r = 0; r < ROWS; r++) {
        // Riser (vertical slab)
        const riser = new THREE.Mesh(
          new THREE.BoxGeometry(length, ROW_H, 0.25),
          concreteMat,
        );
        riser.position.set(0, r * ROW_H + ROW_H / 2, r * ROW_D);
        riser.castShadow = true;
        riser.receiveShadow = true;
        group.add(riser);

        // Tread (horizontal slab)
        const tread = new THREE.Mesh(
          new THREE.BoxGeometry(length, 0.15, ROW_D),
          concreteMat,
        );
        tread.position.set(0, r * ROW_H + ROW_H, r * ROW_D + ROW_D / 2);
        tread.castShadow = true;
        tread.receiveShadow = true;
        group.add(tread);

        // Seat row (coloured)
        this._addSeatRow(group, length, r, ROW_H, ROW_D);
      }

      // Roof canopy (angled slightly)
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(length + 6, 0.6, STAND_D * 0.55),
        roofMat,
      );
      roof.position.set(0, STAND_H + 3, STAND_D * 0.6);
      roof.rotation.x = -0.1;
      roof.castShadow = true;
      group.add(roof);

      // Crowd
      this._addCrowd(group, length, ROWS, ROW_H, ROW_D);

      group.position.set(pivotX, 0, pivotZ);
      group.rotation.y = rotY;
      this.scene.add(group);
    };

    const sideLen = PW + 14;
    const endLen  = PD + 14;

    const southZ = -(PD / 2 + SIDE_GAP);
    const northZ =  (PD / 2 + SIDE_GAP);
    const westX  = -(PW / 2 + END_GAP);
    const eastX  =  (PW / 2 + END_GAP);

    // South stand — faces north (+z), rows go in -z direction
    buildStand(sideLen,  0, southZ,       0);
    // North stand — faces south (-z), rows go in +z direction → flip π
    buildStand(sideLen,  0, northZ, Math.PI);
    // West end  — faces east (+x), rows go in -x direction → rotate +π/2
    buildStand(endLen, westX,     0,  Math.PI / 2);
    // East end  — faces west (-x), rows go in +x direction → rotate -π/2
    buildStand(endLen, eastX,     0, -Math.PI / 2);
  }

  _addSeatRow(group, length, rowIndex, ROW_H, ROW_D) {
    const palette = [
      0xe53935, 0x1e88e5, 0x43a047, 0xfdd835,
      0xfb8c00, 0x8e24aa, 0x00897b, 0xf4511e,
    ];
    const color = palette[rowIndex % palette.length];
    const seatMat = new THREE.MeshLambertMaterial({ color });

    const count = Math.floor(length / 1.1);
    const seatW = 0.85, seatD = 0.5, seatH = 0.6;

    const dummy  = new THREE.Object3D();
    const instMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(seatW, seatH, seatD),
      seatMat,
      count,
    );

    for (let i = 0; i < count; i++) {
      const x = -length / 2 + (i + 0.5) * (length / count);
      dummy.position.set(x, rowIndex * ROW_H + ROW_H + seatH / 2, rowIndex * ROW_D + ROW_D * 0.15);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);
    }
    instMesh.instanceMatrix.needsUpdate = true;
    instMesh.castShadow = true;
    group.add(instMesh);
  }

  _addCrowd(group, length, rows, ROW_H, ROW_D) {
    const skinColors = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524];
    const shirtColors = [
      0xcc0000, 0x0033cc, 0xffcc00, 0x009900,
      0xff6600, 0x6600cc, 0xffffff, 0x000000,
      0xff3399, 0x00cccc, 0xff9900, 0x3399ff,
    ];

    const headGeo = new THREE.SphereGeometry(0.28, 7, 6);
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.7, 7);

    const dummy = new THREE.Object3D();

    for (let r = 0; r < rows; r++) {
      const count = Math.floor(length / 1.1);
      const rowY = r * ROW_H + ROW_H + 0.7;
      const rowZ = r * ROW_D + ROW_D * 0.15;

      // Bodies — each row one instanced mesh
      const shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
      const bodyMesh = new THREE.InstancedMesh(
        bodyGeo,
        new THREE.MeshLambertMaterial({ color: shirtColor }),
        count,
      );
      const headMesh = new THREE.InstancedMesh(
        headGeo,
        new THREE.MeshLambertMaterial({ color: skinColors[Math.floor(Math.random() * skinColors.length)] }),
        count,
      );

      const offsets = [];
      for (let i = 0; i < count; i++) {
        const x = -length / 2 + (i + 0.5) * (length / count) + (Math.random() - 0.5) * 0.2;
        const yJitter  = Math.random() * 0.15;
        // Face toward pitch: in local stand space the pitch is in +Z direction,
        // so Y rotation of Math.PI makes the body's front face +Z (toward pitch).
        const faceY    = Math.PI + (Math.random() - 0.5) * 0.25;
        const leanX    = -0.14 + (Math.random() - 0.5) * 0.06; // lean forward toward pitch
        const sc       = 0.85 + Math.random() * 0.3;

        dummy.position.set(x, rowY + yJitter, rowZ);
        dummy.rotation.set(leanX, faceY, 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        bodyMesh.setMatrixAt(i, dummy.matrix);

        dummy.position.set(x, rowY + yJitter + 0.6, rowZ);
        dummy.rotation.set(leanX * 0.5, faceY, 0);
        dummy.scale.setScalar(0.9 + Math.random() * 0.2);
        dummy.updateMatrix();
        headMesh.setMatrixAt(i, dummy.matrix);

        offsets.push({ x, baseY: rowY + yJitter, z: rowZ, phase: Math.random() * Math.PI * 2, faceY, leanX });
      }
      bodyMesh.instanceMatrix.needsUpdate = true;
      headMesh.instanceMatrix.needsUpdate = true;
      group.add(bodyMesh);
      group.add(headMesh);

      this.crowdMeta.push({ bodyMesh, headMesh, offsets, count });
    }
  }

  // ── Floodlight poles ────────────────────────────────────────────────────────
  _buildFloodlightPoles() {
    const poleMat  = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });

    const corners = [
      [-(PW / 2 + END_GAP + 14), -(PD / 2 + SIDE_GAP + 14)],
      [ (PW / 2 + END_GAP + 14), -(PD / 2 + SIDE_GAP + 14)],
      [-(PW / 2 + END_GAP + 14),  (PD / 2 + SIDE_GAP + 14)],
      [ (PW / 2 + END_GAP + 14),  (PD / 2 + SIDE_GAP + 14)],
    ];

    corners.forEach(([cx, cz]) => {
      // Pole
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.55, 40, 8),
        poleMat,
      );
      pole.position.set(cx, 20, cz);
      pole.castShadow = true;
      this.scene.add(pole);

      // Light bank at top
      const bank = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const bulb = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 0.5, 0.8),
          lightMat,
        );
        bulb.position.set((i - 2.5) * 2, 0, 0);
        bank.add(bulb);
      }
      bank.position.set(cx, 41, cz);
      // Angle bank toward pitch centre
      bank.lookAt(new THREE.Vector3(0, 35, 0));
      this.scene.add(bank);
    });
  }

  // ── Perimeter cage nets ────────────────────────────────────────────────────
  _buildPerimeterNets() {
    const NET_H  = 15;         // tall enough that ball can't fly over
    const NX     = PW / 2 + 2; // 57  — just outside pitch edge on X
    const NZ     = PD / 2 + 2; // 39.5 — just outside pitch edge on Z

    const netMat = new THREE.MeshBasicMaterial({
      color: 0xd0d0d0,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      wireframe: true,
    });

    const poleMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.14, NET_H, 6);

    // Helper: build one flat net wall + support poles
    const addWall = (width, height, px, py, pz, ry) => {
      const segsW = Math.round(width / 1.5);
      const segsH = Math.round(height / 1.5);
      const geo   = new THREE.PlaneGeometry(width, height, segsW, segsH);
      const mesh  = new THREE.Mesh(geo, netMat);
      mesh.position.set(px, py, pz);
      mesh.rotation.y = ry;
      this.scene.add(mesh);

      // Poles every 10 m along wall width
      const poleCount = Math.ceil(width / 10) + 1;
      for (let i = 0; i < poleCount; i++) {
        const t  = i / (poleCount - 1) - 0.5; // -0.5 … +0.5
        const pole = new THREE.Mesh(poleGeo, poleMat);
        // offset in the wall's local X (apply rotation)
        const lx = t * width;
        pole.position.set(
          px + Math.cos(ry) * lx,
          NET_H / 2,
          pz - Math.sin(ry) * lx,
        );
        pole.castShadow = true;
        this.scene.add(pole);
      }
    };

    // North & South walls (lie along world X, face ±Z)
    addWall(NX * 2,  NET_H,  0, NET_H / 2,  NZ, 0);
    addWall(NX * 2,  NET_H,  0, NET_H / 2, -NZ, 0);

    // East & West walls (lie along world Z, face ±X)
    addWall(NZ * 2, NET_H,  NX, NET_H / 2, 0, Math.PI / 2);
    addWall(NZ * 2, NET_H, -NX, NET_H / 2, 0, Math.PI / 2);
  }

  // ── Crowd wave animation ────────────────────────────────────────────────────
  update(t) {
    if (this.crowdMeta.length === 0) return;
    const dummy = new THREE.Object3D();
    const WAVE_SPEED = 1.2;
    const WAVE_AMP   = 0.35;

    this.crowdMeta.forEach(({ bodyMesh, headMesh, offsets, count }) => {
      for (let i = 0; i < count; i++) {
        const o      = offsets[i];
        const sway   = Math.sin(t * WAVE_SPEED + o.phase) * WAVE_AMP;
        const scaleY = 1 + Math.max(0, sway) * 0.4;
        // Positive sway = lean toward pitch (more excited, arms up)
        const leanNow = o.leanX - sway * 0.22;

        dummy.position.set(o.x, o.baseY + sway * 0.3, o.z);
        dummy.rotation.set(leanNow, o.faceY, 0);
        dummy.scale.set(1, scaleY, 1);
        dummy.updateMatrix();
        bodyMesh.setMatrixAt(i, dummy.matrix);

        dummy.position.set(o.x, o.baseY + 0.6 + sway * 0.3, o.z);
        dummy.rotation.set(leanNow * 0.5, o.faceY, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        headMesh.setMatrixAt(i, dummy.matrix);
      }
      bodyMesh.instanceMatrix.needsUpdate = true;
      headMesh.instanceMatrix.needsUpdate = true;
    });
  }
}
