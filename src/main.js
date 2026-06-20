import * as THREE from 'three';
import { Stadium }           from './Stadium.js';
import { Character }         from './Character.js';
import { ThirdPersonCamera } from './ThirdPersonCamera.js';
import { PlayerController }  from './PlayerController.js';
import { MobileControls }    from './MobileControls.js';
import { Football, KICK_RANGE, BALL_RADIUS } from './Football.js';
import { Screens }           from './Screens.js';
import {
  initNetwork, createRoom, joinRoom, leaveRoom,
  listenRooms, listenRoom, startGame,
  syncPosition, listenPositions, syncBall, listenBall, isReady,
} from './Network.js';

// ── Mobile detection ───────────────────────────────────────────────────────
const IS_MOBILE = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// ── Screens + username ─────────────────────────────────────────────────────
const screens = new Screens();
screens.init();

const STORAGE_KEY = 'fa_username';
let myUsername = localStorage.getItem(STORAGE_KEY) || '';
let currentRoom = null;
let amHost      = false;
let unsubRoom   = null;
let unsubRooms  = null;

// ── Connect to Firebase (non-blocking; solo play works without it) ─────────
const networkOk = initNetwork();

// ── Show first screen based on saved username ──────────────────────────────
if (myUsername) {
  screens.setLobbyUsername(myUsername);
  screens.show('lobby');
} else {
  screens.show('entry');
}

// ── Screen event handlers ──────────────────────────────────────────────────
screens.on('setUsername', name => {
  myUsername = name;
  localStorage.setItem(STORAGE_KEY, name);
  screens.setLobbyUsername(name);
  screens.show('lobby');
});

screens.on('createRoom', async () => {
  if (!networkOk) { screens.showError('No network — use Solo Play instead'); return; }
  try {
    const code = await createRoom(myUsername);
    currentRoom = code;
    amHost = true;
    _enterWaiting(code, true);
  } catch (e) {
    screens.showError('Could not create room: ' + e.message);
  }
});

screens.on('joinRoomScreen', () => {
  screens.show('rooms');
  if (!networkOk) { screens.updateRoomList([]); screens.showError('Network unavailable'); return; }
  unsubRooms = listenRooms(rooms => screens.updateRoomList(rooms));
});

screens.on('stopListeningRooms', () => {
  if (unsubRooms) { unsubRooms(); unsubRooms = null; }
});

screens.on('joinRoom', async code => {
  if (!networkOk) return;
  try {
    await joinRoom(code, myUsername);
    if (unsubRooms) { unsubRooms(); unsubRooms = null; }
    currentRoom = code;
    amHost = false;
    _enterWaiting(code, false);
  } catch (e) {
    screens.showError(e.message);
  }
});

screens.on('startGame', async () => {
  if (!amHost || !currentRoom) return;
  try { await startGame(currentRoom); } catch (e) { screens.showError('Could not start: ' + e.message); }
});

screens.on('leaveRoom', async () => {
  if (currentRoom) {
    await leaveRoom(currentRoom, myUsername);
    if (unsubRoom) { unsubRoom(); unsubRoom = null; }
    currentRoom = null;
  }
  screens.show('lobby');
});

screens.on('soloPlay', () => {
  _startGame({ solo: true, roomCode: null, opponent: null });
});

// ── Waiting room ───────────────────────────────────────────────────────────
function _enterWaiting(code, isHost) {
  screens.setWaitingRoom(code, isHost);
  screens.setWaitingPlayers([myUsername]);
  screens.show('waiting');

  if (unsubRoom) unsubRoom();
  unsubRoom = listenRoom(code, data => {
    if (!data) {
      screens.showError('Room was closed');
      if (unsubRoom) { unsubRoom(); unsubRoom = null; }
      currentRoom = null;
      screens.show('lobby');
      return;
    }
    const players = Object.keys(data.players || {});
    screens.setWaitingPlayers(players);
    screens.setWaitingRoom(code, isHost);

    if (data.status === 'playing') {
      if (unsubRoom) { unsubRoom(); unsubRoom = null; }
      const opponent = players.find(p => p !== myUsername) || null;
      _startGame({ solo: false, roomCode: code, opponent });
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════
// ── THREE.JS GAME ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
function _startGame({ solo, roomCode, opponent }) {
  // Hide all lobby screens
  ['entry','lobby','rooms','waiting'].forEach(id => {
    const el = document.getElementById(`screen-${id}`);
    if (el) el.style.display = 'none';
  });

  // ── Renderer ──────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    antialias: !IS_MOBILE,
    powerPreference: IS_MOBILE ? 'low-power' : 'high-performance',
  });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(IS_MOBILE ? Math.min(devicePixelRatio, 1) : Math.min(devicePixelRatio, 2));

  if (IS_MOBILE) {
    renderer.shadowMap.enabled   = false;
    renderer.toneMapping         = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;
  } else {
    renderer.shadowMap.enabled   = true;
    renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
  }
  document.body.appendChild(renderer.domElement);

  // ── Scene ──────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.FogExp2(0x87ceeb, IS_MOBILE ? 0.007 : 0.005);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 800);

  // ── Lighting ───────────────────────────────────────────────────────────────
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

  if (!IS_MOBILE) {
    [[-72,38,-52],[72,38,-52],[-72,38,52],[72,38,52]].forEach(([x,y,z]) => {
      const s = new THREE.SpotLight(0xfff8f0, 1.0, 250, Math.PI/8, 0.4, 1);
      s.position.set(x, y, z);
      s.target.position.set(0, 0, 0);
      scene.add(s, s.target);
    });
  } else {
    scene.add(new THREE.AmbientLight(0xfff5e0, 0.5));
  }

  // ── Stadium + Ball ─────────────────────────────────────────────────────────
  const stadium = new Stadium(scene);
  const ball    = new Football(scene);

  // ── My character ──────────────────────────────────────────────────────────
  const character  = new Character(scene);
  character.position.set(0, 0, 8);

  const tpCam      = new ThirdPersonCamera(camera, character.group);
  const mobile     = IS_MOBILE ? new MobileControls() : null;
  const controller = new PlayerController(character, tpCam, mobile);

  // ── Opponent character ─────────────────────────────────────────────────────
  let remoteChar = null;
  if (!solo && opponent) {
    remoteChar = new Character(scene);
    remoteChar.position.set(0, 0, -8);
  }

  // ── Clouds ────────────────────────────────────────────────────────────────
  const cloudGeo = new THREE.SphereGeometry(1, 7, 5);
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const clouds   = [];
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    for (let j = 0; j < 3 + Math.floor(Math.random() * 4); j++) {
      const c = new THREE.Mesh(cloudGeo, cloudMat);
      c.scale.set(6+Math.random()*8, 3+Math.random()*3, 5+Math.random()*6);
      c.position.set((Math.random()-.5)*12, (Math.random()-.5)*3, (Math.random()-.5)*8);
      g.add(c);
    }
    const angle = (i/16)*Math.PI*2, radius = 160+Math.random()*60;
    g.position.set(Math.cos(angle)*radius, 80+Math.random()*30, Math.sin(angle)*radius);
    g.userData = { angle, radius, speed: 0.02+Math.random()*0.03 };
    scene.add(g);
    clouds.push(g);
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  const staminaWrap = document.getElementById('stamina-wrap');
  const staminaFill = document.getElementById('stamina-fill');
  const playerTags  = document.getElementById('player-tags');

  function updateStaminaBar(v) {
    const pct = Math.max(0, Math.min(100, v));
    staminaFill.style.width = pct + '%';
    staminaFill.className = pct < 20 ? 'empty' : pct < 50 ? 'low' : '';
  }

  if (!solo && opponent) {
    playerTags.innerHTML = `
      <div class="ptag me">👤 ${myUsername} (you)</div>
      <div class="ptag them">👤 ${opponent}</div>
    `;
    playerTags.style.display = 'flex';
  }

  // ── Overlay / pointer lock ─────────────────────────────────────────────────
  const overlay = document.getElementById('overlay');
  overlay.style.display = 'flex';

  if (IS_MOBILE) {
    overlay.querySelector('.play-btn').textContent = '▶  TAP TO PLAY';
    overlay.querySelector('.controls-grid').innerHTML = `
      <div><span>Joystick</span><br>Move</div>
      <div><span>Swipe right</span><br>Look</div>
      <div><span>Full push</span><br>Sprint</div>
      <div><span>KICK</span><br>Kick ball</div>
      <div><span>Tap</span><br>to start</div>
      <div></div>
    `;
    overlay.addEventListener('click', () => {
      window.tryFullscreen();
      overlay.style.display = 'none';
      staminaWrap.style.display = 'flex';
    }, { once: true });
  } else {
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement !== null;
      overlay.style.display     = locked ? 'none' : 'flex';
      document.getElementById('hint').style.display = locked ? 'block' : 'none';
      staminaWrap.style.display = locked ? 'flex' : 'none';
    });
    overlay.addEventListener('click', () => tpCam.lock());
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ── Mobile: prevent back-gesture from leaving page ─────────────────────────
  if (IS_MOBILE) {
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', () => history.pushState(null, '', location.href));
    document.addEventListener('touchstart', e => {
      if (e.target === renderer.domElement) e.preventDefault();
    }, { passive: false });
  }

  // ── Visibility: discard stale delta on tab resume ─────────────────────────
  const clock = new THREE.Clock();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) clock.getDelta();
  });

  // ── Multiplayer network listeners ─────────────────────────────────────────
  let remotePositions = {};
  let syncTimer = 0;
  const SYNC_INTERVAL = 0.05;  // 20 Hz position updates

  // Ball authority: whoever last touched the ball broadcasts it for 3 seconds
  let ballAuthority = false;
  let ballAuthorityTimer = 0;

  if (!solo && roomCode && isReady()) {
    listenPositions(roomCode, data => { remotePositions = data || {}; });
    listenBall(roomCode, data => {
      // Only apply if opponent is authority (they touched it more recently)
      if (data && data._by !== myUsername) {
        ball.position.set(data.x, data.y, data.z);
        ball.vel.set(data.vx, data.vy, data.vz);
        ballAuthority = false;
        ballAuthorityTimer = 0;
      }
    });
  }

  // ── Kick + collision state ─────────────────────────────────────────────────
  let kickCooldown = 0;
  const _kickDir = new THREE.Vector3();
  const _p2b     = new THREE.Vector3();
  const PLAYER_R = 0.4;
  const COL_DIST = BALL_RADIUS + PLAYER_R;

  // ── Main loop ─────────────────────────────────────────────────────────────
  let t = 0, frame = 0;

  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    t += delta; frame++;

    if (mobile) {
      const ld = mobile.consumeLook();
      if (ld.x !== 0 || ld.y !== 0) tpCam.applyTouchPixels(ld.x, ld.y);
    }

    const stamina = controller.update(delta);
    updateStaminaBar(stamina);
    character.update(t, controller.isMoving());
    tpCam.update();
    ball.update(delta);

    // ── Ball-player passive collision ─────────────────────────────────────
    let ballTouched = false;
    _p2b.subVectors(ball.position, character.position);
    _p2b.y = 0;
    const pDist = _p2b.length();
    if (pDist > 0.01 && pDist < COL_DIST) {
      _p2b.normalize();
      const pushSpd = controller.isMoving() ? (controller.isSprinting ? 9 : 6) : 3;
      ball.vel.x = _p2b.x * pushSpd;
      ball.vel.z = _p2b.z * pushSpd;
      if (ball.vel.y < 1.5) ball.vel.y = 1.5;
      ball.position.x = character.position.x + _p2b.x * (COL_DIST + 0.08);
      ball.position.z = character.position.z + _p2b.z * (COL_DIST + 0.08);
      ballTouched = true;
    }

    // ── Kick ─────────────────────────────────────────────────────────────
    kickCooldown -= delta;
    const kickPressed = controller.keys['Space'] || mobile?.isKicking;
    if (kickPressed && kickCooldown <= 0 && ball.distanceTo(character.position) < KICK_RANGE) {
      _kickDir.set(Math.sin(character.targetYaw), 0, Math.cos(character.targetYaw));
      ball.kick(_kickDir);
      kickCooldown = 0.45;
      ballTouched  = true;
    }

    // ── Sync position + ball to Firebase ──────────────────────────────────
    if (!solo && roomCode && isReady()) {
      // Claim ball authority when touched; broadcast for 3 seconds after
      if (ballTouched) { ballAuthority = true; ballAuthorityTimer = 3.0; }
      ballAuthorityTimer = Math.max(0, ballAuthorityTimer - delta);
      if (ballAuthorityTimer === 0) ballAuthority = false;

      syncTimer += delta;
      if (syncTimer >= SYNC_INTERVAL) {
        syncTimer = 0;
        syncPosition(roomCode, myUsername,
          character.position.x, character.position.z, character.targetYaw);
        if (ballAuthority) {
          syncBall(roomCode, {
            x: ball.position.x, y: ball.position.y, z: ball.position.z,
            vx: ball.vel.x, vy: ball.vel.y, vz: ball.vel.z,
            _by: myUsername,
          });
        }
      }
    }

    // ── Apply remote player position ──────────────────────────────────────
    if (remoteChar && opponent && remotePositions[opponent]) {
      const rp = remotePositions[opponent];
      remoteChar.position.x = rp.x;
      remoteChar.position.z = rp.z;
      if (rp.yaw !== undefined) remoteChar.setFacingYaw(rp.yaw);
      remoteChar.update(t, true);
    }

    // ── Background updates ─────────────────────────────────────────────────
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
}
