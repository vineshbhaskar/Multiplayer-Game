// Manages all pre-game screens: entry (username), lobby, room list, waiting room
export class Screens {
  constructor() {
    this._cbs = {};
    this._unsubRooms = null;
  }

  on(event, fn) { this._cbs[event] = fn; }
  _emit(event, data) { if (this._cbs[event]) this._cbs[event](data); }

  init() {
    // Entry screen
    const input  = document.getElementById('username-input');
    const submit = document.getElementById('username-submit');

    const doSubmit = () => {
      const val = input.value.trim().replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 16);
      if (val.length < 2) { this._shake(input); return; }
      this._emit('setUsername', val);
    };
    submit.onclick = doSubmit;
    input.onkeydown = e => { if (e.key === 'Enter') doSubmit(); };

    // Lobby
    document.getElementById('btn-create-room').onclick = () => this._emit('createRoom');
    document.getElementById('btn-join-room').onclick   = () => this._emit('joinRoomScreen');
    document.getElementById('btn-solo').onclick        = () => this._emit('soloPlay');

    // Room list
    document.getElementById('btn-back-lobby').onclick = () => {
      this._emit('stopListeningRooms');
      this.show('lobby');
    };

    // Waiting room
    document.getElementById('btn-start-game').onclick = () => this._emit('startGame');
    document.getElementById('btn-leave-room').onclick = () => this._emit('leaveRoom');
  }

  show(name) {
    ['entry','lobby','rooms','waiting'].forEach(id => {
      const el = document.getElementById(`screen-${id}`);
      if (el) el.style.display = (id === name) ? 'flex' : 'none';
    });
  }

  // ── Entry helpers ──────────────────────────────────────────────────────────
  prefillUsername(name) {
    document.getElementById('username-input').value = name;
  }

  // ── Lobby helpers ──────────────────────────────────────────────────────────
  setLobbyUsername(name) {
    document.getElementById('lobby-username').textContent = name;
  }

  // ── Room list helpers ──────────────────────────────────────────────────────
  updateRoomList(rooms) {
    const list = document.getElementById('room-list');
    if (!rooms.length) {
      list.innerHTML = '<p class="no-rooms">No open rooms yet.<br>Be the first to create one!</p>';
      return;
    }
    list.innerHTML = rooms.map(r => `
      <div class="room-item">
        <div class="room-info">
          <span class="room-host">🏟 ${r.host}</span>
          <span class="room-count">${r.playerCount}/2</span>
        </div>
        <button class="btn-join-item" data-code="${r.code}">Join</button>
      </div>
    `).join('');
    list.querySelectorAll('.btn-join-item').forEach(btn => {
      btn.onclick = () => this._emit('joinRoom', btn.dataset.code);
    });
  }

  // ── Waiting room helpers ───────────────────────────────────────────────────
  setWaitingRoom(code, isHost) {
    document.getElementById('waiting-room-code').textContent = code;
    document.getElementById('btn-start-game').style.display = isHost ? 'block' : 'none';
    document.getElementById('waiting-hint').textContent =
      isHost ? 'Start when all players are ready.' : 'Waiting for host to start…';
  }

  setWaitingPlayers(players) {
    const container = document.getElementById('waiting-players');
    container.innerHTML = players.map((p, i) =>
      `<div class="player-chip">${i === 0 ? '👑' : '👤'} ${p}</div>`
    ).join('');
  }

  setWaitingStatus(text) {
    document.getElementById('waiting-hint').textContent = text;
  }

  // ── Utility ───────────────────────────────────────────────────────────────
  _shake(el) {
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'shake 0.35s ease';
  }

  showError(msg) {
    let el = document.getElementById('screen-error-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'screen-error-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'toast show';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.className = 'toast', 3000);
  }
}
