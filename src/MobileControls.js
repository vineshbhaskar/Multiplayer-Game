// Virtual joystick + touch-look + kick button for mobile play.
export class MobileControls {
  constructor() {
    this.movement  = { x: 0, y: 0 };   // -1..1 each axis
    this._lookAcc  = { x: 0, y: 0 };   // pixels accumulated since last consume
    this.isKicking = false;

    this._joy  = { active: false, id: null, bx: 0, by: 0, R: 55 };
    this._look = { active: false, id: null, lx: 0, ly: 0 };

    this._build();
    this._bind();
  }

  // ── DOM ─────────────────────────────────────────────────────────────────────
  _build() {
    const ui = document.createElement('div');
    ui.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60;';
    this._root = ui;

    // ── Joystick base ────────────────────────────────────────────────────────
    const jBase = document.createElement('div');
    jBase.style.cssText = `
      position:absolute; bottom:36px; left:36px;
      width:140px; height:140px; border-radius:50%;
      background:rgba(255,255,255,0.08);
      border:2px solid rgba(255,255,255,0.22);
      pointer-events:auto; touch-action:none;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 0 30px rgba(0,0,0,0.4), inset 0 0 20px rgba(255,255,255,0.03);
    `;

    const jThumb = document.createElement('div');
    jThumb.style.cssText = `
      width:58px; height:58px; border-radius:50%;
      background:radial-gradient(circle at 38% 38%, rgba(255,255,255,0.55), rgba(255,255,255,0.2));
      border:2px solid rgba(255,255,255,0.5);
      pointer-events:none;
      box-shadow:0 3px 12px rgba(0,0,0,0.4);
      transition:transform 0.04s;
    `;
    jBase.appendChild(jThumb);
    this._jBase  = jBase;
    this._jThumb = jThumb;

    const label = (txt, st) => {
      const d = document.createElement('div');
      d.textContent = txt;
      d.style.cssText = `position:absolute;color:rgba(255,255,255,0.25);font-size:11px;font-weight:600;pointer-events:none;${st}`;
      jBase.appendChild(d);
    };
    label('▲', 'top:8px;left:50%;transform:translateX(-50%)');
    label('▼', 'bottom:8px;left:50%;transform:translateX(-50%)');
    label('◀', 'left:8px;top:50%;transform:translateY(-50%)');
    label('▶', 'right:8px;top:50%;transform:translateY(-50%)');

    // ── Look zone ────────────────────────────────────────────────────────────
    const lookZone = document.createElement('div');
    lookZone.style.cssText = `
      position:absolute; left:45%; right:0; top:0; bottom:150px;
      pointer-events:auto; touch-action:none;
    `;
    this._lookZone = lookZone;

    const lookHint = document.createElement('div');
    lookHint.style.cssText = `
      position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
      color:rgba(255,255,255,0.12); font-size:12px; letter-spacing:1px;
      pointer-events:none; text-align:center; user-select:none;
    `;
    lookHint.innerHTML = 'SWIPE<br>TO LOOK';
    lookZone.appendChild(lookHint);
    this._lookHint = lookHint;

    // ── Kick button ──────────────────────────────────────────────────────────
    const kick = document.createElement('div');
    kick.style.cssText = `
      position:absolute; bottom:36px; right:36px;
      width:96px; height:96px; border-radius:50%;
      background:radial-gradient(circle at 35% 30%, #ff5a35, #c40020);
      border:3px solid rgba(255,140,100,0.7);
      display:flex; align-items:center; justify-content:center;
      pointer-events:auto; touch-action:none;
      box-shadow:0 4px 24px rgba(220,30,30,0.55),inset 0 1px 2px rgba(255,255,255,0.25);
      user-select:none; transition:transform 0.08s, opacity 0.08s;
    `;
    kick.innerHTML = `<div style="text-align:center;color:#fff;font-weight:900;font-size:14px;text-shadow:0 1px 4px rgba(0,0,0,0.6);line-height:1.3;">⚽<br>KICK</div>`;
    this._kick = kick;

    ui.appendChild(jBase);
    ui.appendChild(lookZone);
    ui.appendChild(kick);
    document.body.appendChild(ui);
  }

  // ── Events ──────────────────────────────────────────────────────────────────
  _bind() {
    const jo = this._joy;
    const lk = this._look;

    this._jBase.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      jo.active = true; jo.id = t.identifier;
      const r = this._jBase.getBoundingClientRect();
      jo.bx = r.left + r.width / 2;
      jo.by = r.top  + r.height / 2;
      this._moveJoy(t);
    }, { passive: false });

    this._lookZone.addEventListener('touchstart', e => {
      e.preventDefault();
      if (!lk.active) {
        const t = e.changedTouches[0];
        lk.active = true; lk.id = t.identifier;
        lk.lx = t.clientX; lk.ly = t.clientY;
        this._lookHint.style.opacity = '0';
      }
    }, { passive: false });

    document.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === jo.id) this._moveJoy(t);
        if (t.identifier === lk.id) this._moveLook(t);
      }
    }, { passive: false });

    document.addEventListener('touchend', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === jo.id) {
          jo.active = false; jo.id = null;
          this.movement.x = 0; this.movement.y = 0;
          this._jThumb.style.transform = 'translate(0,0)';
        }
        if (t.identifier === lk.id) {
          lk.active = false; lk.id = null;
        }
      }
    });

    this._kick.addEventListener('touchstart', e => {
      e.preventDefault();
      this.isKicking = true;
      this._kick.style.transform = 'scale(0.88)';
      this._kick.style.opacity = '0.85';
    }, { passive: false });
    this._kick.addEventListener('touchend', () => {
      this.isKicking = false;
      this._kick.style.transform = 'scale(1)';
      this._kick.style.opacity = '1';
    });
  }

  _moveJoy(touch) {
    const dx  = touch.clientX - this._joy.bx;
    const dy  = touch.clientY - this._joy.by;
    const len = Math.sqrt(dx * dx + dy * dy);
    const R   = this._joy.R;
    const cl  = Math.min(len, R);
    const ang = Math.atan2(dy, dx);
    const cx  = Math.cos(ang) * cl;
    const cy  = Math.sin(ang) * cl;
    this.movement.x = cx / R;
    this.movement.y = cy / R;
    this._jThumb.style.transform = `translate(${cx}px,${cy}px)`;
  }

  _moveLook(touch) {
    this._lookAcc.x += touch.clientX - this._look.lx;
    this._lookAcc.y += touch.clientY - this._look.ly;
    this._look.lx = touch.clientX;
    this._look.ly = touch.clientY;
  }

  // Joystick push magnitude 0..1 (used for auto-sprint detection)
  get joystickMag() {
    const { x, y } = this.movement;
    return Math.sqrt(x * x + y * y);
  }

  consumeLook() {
    const d = { x: this._lookAcc.x, y: this._lookAcc.y };
    this._lookAcc.x = 0; this._lookAcc.y = 0;
    return d;
  }

  isMoving() {
    return Math.abs(this.movement.x) > 0.08 || Math.abs(this.movement.y) > 0.08;
  }

  show() { this._root.style.display = ''; }
  hide() { this._root.style.display = 'none'; }
}
