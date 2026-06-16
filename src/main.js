import * as THREE from 'three';
import { Stadium }           from './Stadium.js';
import { Character }         from './Character.js';
import { ThirdPersonCamera } from './ThirdPersonCamera.js';
import { PlayerController }  from './PlayerController.js';
import { MobileControls }    from './MobileControls.js';
import { Football, KICK_RANGE, BALL_RADIUS } from './Football.js';

// ── Mobile detection (done early — drives all quality settings) ───────────────
const IS_MOBILE = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// ── Renderer ──────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({
  antialias: !IS_MOBILE,   // AA is expensive on mobile GPU
  powerPreference: IS_MOBILE ? 'low-power' : 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
// Cap pixel ratio at 1 on mobile — going to 2 quadruples pixel count
renderer.setPixelRatio(IS_MOBILE ? Math.min(window.devicePixelRatio, 1) : Math.min(window.devicePixelRatio, 2));

if (IS_MOBILE) {
  renderer.shadowMap.enabled = false;         // shadows kill mobile GPU
  renderer.toneMapping       = THREE.LinearToneMapping;
  renderer.toneMappingExposure = 1.0;
} else {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
}
document.body.appendChild(renderer.domElement);

// ── Scene ─────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
// Lighter fog on mobile — saves fill-rate on distant pixels
scene.fog = new THREE.FogExp2(0x87ceeb, IS_MOBILE ? 0.007 : 0.005);

// ── Camera ────────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  60, window.innerWidth / window.innerHeight, 0.1, 800,
);

// ── Lighting ──────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xfff0e0, 0.75));

const sun = new THREE.DirectionalLight(0xfff5cc, 1.8);
sun.position.set(60, 100, 40);
sun.castShadow = !IS_MOBILE;
sun.shadow.mapSize.set(IS_MOBILE ? 512 : 2048, IS_MOBILE ? 512 : 2048);
sun.shadow.camera.near   = 1;
sun.shadow.camera.far    = 400;
sun.shadow.camera.left   = -130;
sun.shadow.camera.right  =  130;
sun.shadow.camera.top    =  130;
sun.shadow.camera.bottom = -130;
sun.shadow.bias = -0.0003;
scene.add(sun);

const fill = new THREE.DirectionalLight(0xaad4ff, 0.4);
fill.position.set(-40, 30, -20);
scene.add(fill);

// Spotlights add realism on desktop; skip on mobile (4 extra shadow-capable lights)
if (!IS_MOBILE) {
  [[-72, 38, -52], [72, 38, -52], [-72, 38, 52], [72, 38, 52]].forEach(([x, y, z]) => {
    const s = new THREE.SpotLight(0xfff8f0, 1.0, 250, Math.PI / 8, 0.4, 1);
    s.position.set(x, y, z);
    s.target.position.set(0, 0, 0);
    scene.add(s, s.target);
  });
} else {
  // Compensate with a brighter ambient on mobile
  scene.add(new THREE.AmbientLight(0xfff5e0, 0.5));
}

// ── Stadium ───────────────────────────────────────────────────────────────────
const stadium = new Stadium(scene);

// ── Character + Camera + Controller ───────────────────────────────────────────
const character  = new Character(scene);
character.position.set(0, 0, 0);

const tpCam      = new ThirdPersonCamera(camera, character.group);

// ── Football ──────────────────────────────────────────────────────────────────
const ball = new Football(scene);

// ── Mobile controls ───────────────────────────────────────────────────────────
const mobile = IS_MOBILE ? new MobileControls() : null;

const controller = new PlayerController(character, tpCam, mobile);

// ── Clouds ────────────────────────────────────────────────────────────────────
const cloudGeo = new THREE.SphereGeometry(1, 7, 5);
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
const clouds   = [];
for (let i = 0; i < 16; i++) {
  const group = new THREE.Group();
  const n     = 3 + Math.floor(Math.random() * 4);
  for (let j = 0; j < n; j++) {
    const c = new THREE.Mesh(cloudGeo, cloudMat);
    c.scale.set(6 + Math.random() * 8, 3 + Math.random() * 3, 5 + Math.random() * 6);
    c.position.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 8);
    group.add(c);
  }
  const angle  = (i / 16) * Math.PI * 2;
  const radius = 160 + Math.random() * 60;
  group.position.set(Math.cos(angle) * radius, 80 + Math.random() * 30, Math.sin(angle) * radius);
  group.userData = { angle, radius, speed: 0.02 + Math.random() * 0.03 };
  scene.add(group);
  clouds.push(group);
}

// ── Stamina bar references ─────────────────────────────────────────────────────
const staminaWrap = document.getElementById('stamina-wrap');
const staminaFill = document.getElementById('stamina-fill');

function updateStaminaBar(value) {          // value 0..100
  const pct = Math.max(0, Math.min(100, value));
  staminaFill.style.width = pct + '%';
  staminaFill.className = pct < 20 ? 'empty' : pct < 50 ? 'low' : '';
}

// ── Overlay (desktop: click-to-play; mobile: auto-hide after touch) ───────────
const overlay = document.getElementById('overlay');
const hint    = document.getElementById('hint');

if (IS_MOBILE) {
  // Mobile: tap anywhere on overlay to dismiss, no pointer lock
  overlay.querySelector('.play-btn').textContent = '▶  TAP TO PLAY';
  overlay.querySelector('.controls-grid').innerHTML = `
    <div><span>Left</span><br>Joystick</div>
    <div><span>Swipe right</span><br>Look around</div>
    <div><span>RUN</span><br>Sprint</div>
    <div><span>KICK</span><br>Kick ball</div>
    <div><span>Tap</span><br>to start</div>
    <div></div>
  `;
  overlay.addEventListener('click', () => {
    overlay.style.display = 'none';
    staminaWrap.style.display = 'flex';
  }, { once: true });
} else {
  // Desktop: pointer lock flow
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement !== null;
    overlay.style.display    = locked ? 'none' : 'flex';
    hint.style.display       = locked ? 'block' : 'none';
    staminaWrap.style.display = locked ? 'flex' : 'none';
  });
  overlay.addEventListener('click', () => tpCam.lock());
}

// ── Resize ────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Mobile: prevent back-gesture from navigating away ─────────────────────────
if (IS_MOBILE) {
  // Push a dummy history entry so the back gesture hits it instead of leaving
  history.pushState(null, '', location.href);
  window.addEventListener('popstate', () => {
    history.pushState(null, '', location.href);
  });

  // Prevent pull-to-refresh and all default browser touch handling globally
  document.addEventListener('touchstart', e => {
    if (e.target === renderer.domElement) e.preventDefault();
  }, { passive: false });
}

// ── Visibility change — eat huge delta when tab comes back ────────────────────
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) clock.getDelta(); // discard the stale delta
});

// ── Kick + collision state ─────────────────────────────────────────────────────
let kickCooldown = 0;
const _kickDir    = new THREE.Vector3();
const _p2b        = new THREE.Vector3();  // reusable player→ball vector
const PLAYER_R    = 0.4;
const COL_DIST    = BALL_RADIUS + PLAYER_R;

// ── Game loop ─────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let t = 0, frame = 0;

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  t += delta; frame++;

  // Apply mobile touch look to camera (zero-delta on desktop or when not dragging)
  if (mobile) {
    const ld = mobile.consumeLook();
    if (ld.x !== 0 || ld.y !== 0) tpCam.applyTouchPixels(ld.x, ld.y);
  }

  const stamina = controller.update(delta);
  updateStaminaBar(stamina);
  character.update(t, controller.isMoving());
  tpCam.update();

  // Ball physics
  ball.update(delta);

  // ── Ball-player collision (passive — walking into ball pushes it) ───────────
  _p2b.subVectors(ball.position, character.position);
  _p2b.y = 0;
  const pDist = _p2b.length();
  if (pDist > 0.01 && pDist < COL_DIST) {
    _p2b.normalize();
    const isSprinting = controller.keys['ShiftLeft'] || controller.keys['ShiftRight'] || mobile?.isSprinting;
    const pushSpd = controller.isMoving() ? (isSprinting ? 9 : 6) : 3;
    ball.vel.x = _p2b.x * pushSpd;
    ball.vel.z = _p2b.z * pushSpd;
    if (ball.vel.y < 1.5) ball.vel.y = 1.5;
    // Separate so ball doesn't stick to player
    ball.position.x = character.position.x + _p2b.x * (COL_DIST + 0.08);
    ball.position.z = character.position.z + _p2b.z * (COL_DIST + 0.08);
  }

  // ── Kick: Space (desktop) or KICK button (mobile) ───────────────────────────
  kickCooldown -= delta;
  const kickPressed = controller.keys['Space'] || mobile?.isKicking;
  if (kickPressed && kickCooldown <= 0 && ball.distanceTo(character.position) < KICK_RANGE) {
    _kickDir.set(Math.sin(character.targetYaw), 0, Math.cos(character.targetYaw));
    ball.kick(_kickDir);
    kickCooldown = 0.45;
  }

  // Throttle background updates harder on mobile to save CPU/GPU
  const crowdEvery = IS_MOBILE ? 8 : 3;
  const cloudEvery = IS_MOBILE ? 16 : 4;

  if (frame % cloudEvery === 0) {
    clouds.forEach(c => {
      c.userData.angle += c.userData.speed * 0.004 * cloudEvery;
      c.position.x = Math.cos(c.userData.angle) * c.userData.radius;
      c.position.z = Math.sin(c.userData.angle) * c.userData.radius;
    });
  }

  if (frame % crowdEvery === 0) stadium.update(t);

  renderer.render(scene, camera);
}
animate();
