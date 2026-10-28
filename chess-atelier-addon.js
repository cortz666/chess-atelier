/* Chess Atelier ♡ — Modo bot y reloj dual (se añade sobre la versión actual).
   Mantiene el motor de reglas, el archivo de partidas y el almacenamiento existente.
   Añadir ANTES de </body> en index.html:
   <script src="./chess-atelier-addon.js"></script>
*/
(function () {
  'use strict';
  if (window.__chessAtelierAddon) return;
  window.__chessAtelierAddon = true;

  const required = ['board-panel', 'turn-white', 'turn-black', 'chessboard'];
  if (required.some(id => !document.getElementById(id)) || typeof Chess === 'undefined' || typeof app === 'undefined') {
    console.error('Chess Atelier: primero debe cargarse el script original del tablero.');
    return;
  }
  const byId = id => document.getElementById(id);
  const BOT_LEVELS = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' };
  const VALUES = { p: 100, n: 320, b: 335, r: 510, q: 900, k: 0 };
  const css = `
    .ca-game-options{display:grid;gap:11px;padding:15px;background:#fff8fa;border:1px solid #efd7e2;border-radius:15px;margin-bottom:14px}
    .ca-game-options .ca-label{font-size:11px;font-weight:800;letter-spacing:.06em;color:#925971}
    .ca-mode-row{display:flex;gap:9px;flex-wrap:wrap}
    .ca-mode{border:1px solid #ecd2dc;background:#fffafc;color:#8e5170;border-radius:12px;min-height:44px;padding:10px;font-weight:800;font-size:12px;flex:1}
    .ca-mode.on{background:#884764;border-color:#884764;color:#fff}
    .ca-bot-settings{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:#856278;font-weight:700}
    .ca-bot-settings[hidden]{display:none}
    .ca-bot-settings small{width:100%;line-height:1.5}
    .ca-bot-settings select,.ca-clock-actions select{background:white;border:1px solid #e5cdda;border-radius:9px;padding:9px;color:#744b60;min-height:44px;max-width:100%;font-size:14px}
    .ca-clock-panel{border:1px solid #eddae2;border-radius:15px;padding:14px;margin-top:14px;background:#fff8fb;display:grid;gap:12px}
    .ca-clock-actions{display:flex;flex-wrap:wrap;align-items:center;gap:9px}
    .ca-clock-actions .ca-heading{font-size:13px;font-weight:800;color:#814d67;margin-right:auto}
    .ca-clock-actions label{font-weight:800;color:#896276;font-size:12px}
    .ca-time-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    .ca-time-grid>div{border:1px solid #f0e0e8;border-radius:12px;padding:11px;background:#fff}
    .ca-time-grid span{display:block;font-size:11px;color:#9a7a8b;font-weight:700;margin-bottom:5px}
    .ca-time-grid strong{font-variant-numeric:tabular-nums;font-size:21px;color:#753f5c}
    .ca-player-clock{font-variant-numeric:tabular-nums;font-size:19px;color:#855370;font-weight:800}
    .ca-player-clock.running{color:#b04572}
    .ca-player-clock.flagged{color:#d4434e}
    .ca-timer-wrap{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
    .ca-move-ms{display:block;font-size:10px;font-weight:700;color:#a47e90;margin-top:2px}
    .move-san.current .ca-move-ms{color:#fff}
    @media(max-width:430px){.ca-clock-actions .ca-heading{width:100%}.ca-clock-actions select{width:100%}.ca-clock-actions .btn{flex:1}.ca-player-clock{font-size:16px}.ca-timer-wrap{gap:5px}.ca-time-grid strong{font-size:19px}}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const modePanel = document.createElement('section');
  modePanel.className = 'ca-game-options live-only';
  modePanel.setAttribute('aria-label', 'Modos de juego');
  modePanel.innerHTML = `
    <div class="ca-label">♕ ¿CÓMO QUIERES JUGAR?</div>
    <div class="ca-mode-row">
      <button type="button" id="ca-local" class="ca-mode on" aria-pressed="true">♙ Dos jugadores</button>
      <button type="button" id="ca-bot" class="ca-mode" aria-pressed="false">♛ Contra bot</button>
    </div>
    <div id="ca-bot-options" class="ca-bot-settings" hidden>
      <label for="ca-level">Dificultad:</label>
      <select id="ca-level">
        <option value="beginner">🌷 Principiante</option>
        <option value="intermediate">♘ Intermedio</option>
        <option value="advanced">♛ Avanzado</option>
      </select>
      <small id="ca-level-note">Practica sin presión. Tú juegas con blancas.</small>
    </div>`;
  byId('board-panel').querySelector('.panel-top').insertAdjacentElement('afterend', modePanel);
  for (const [turnId, color] of [['turn-black','black'], ['turn-white','white']]) {
    const tag = byId(turnId);
    const wrap = document.createElement('div'); wrap.className = 'ca-timer-wrap';
    const time = document.createElement('span');
    time.className = 'ca-player-clock'; time.id = 'ca-' + color + '-time';
    time.textContent = '—:—';
    tag.parentNode.insertBefore(wrap, tag);
    wrap.append(time, tag);
  }
  const clockPanel = document.createElement('section');
  clockPanel.className = 'ca-clock-panel live-only';
  clockPanel.setAttribute('aria-label', 'Control de tiempo y duración por jugada');
  clockPanel.innerHTML = `
    <div class="ca-clock-actions">
      <div class="ca-heading">⏱ Reloj de ajedrez</div>
      <label for="ca-time-choice">Tiempo</label>
      <select id="ca-time-choice">
        <option value="0">Sin límite · cronómetro</option>
        <option value="180">3 minutos</option>
        <option value="300">5 minutos</option>
        <option value="600">10 minutos</option>
        <option value="900">15 minutos</option>
        <option value="1800">30 minutos</option>
      </select>
      <button type="button" class="btn btn-primary btn-sm" id="ca-timer-start">▶ Iniciar</button>
      <button type="button" class="btn btn-outline btn-sm" id="ca-timer-reset">↻ Reiniciar reloj</button>
    </div>
    <div class="ca-time-grid">
      <div><span>Jugada en curso</span><strong id="ca-current-time">00:00.0</strong></div>
      <div><span>Última jugada</span><strong id="ca-last-time">—</strong></div>
    </div>
    <small id="ca-time-help">Inicia el reloj cuando quieras. El tiempo cambia automáticamente después de cada jugada.</small>`;
  byId('board-panel').querySelector('.board-under').insertAdjacentElement('afterend', clockPanel);

  let botTimer = null;
  let botThinking = false;
  let lastPersist = Date.now();
  function botName(level) { return 'Bot · ' + (BOT_LEVELS[level] || 'Principiante'); }
  function newClock(limit = 0) {
    const value = [0,180,300,600,900,1800].includes(Number(limit)) ? Number(limit) : 0;
    return { enabled:false, running:false, limit:value, white:value*1000, black:value*1000,
      usedWhite:0, usedBlack:0, turnMs:0, stamp:Date.now(), flag:null };
  }
  function clock() { return app.active.clock || (app.active.clock = newClock()); }
  function fmt(ms, tenth = false) {
    const v = Math.max(0, Number(ms) || 0), seconds = Math.floor(v/1000);
    return String(Math.floor(seconds/60)).padStart(2,'0') + ':' +
      String(seconds%60).padStart(2,'0') + (tenth ? '.' + Math.floor((v%1000)/100) : '');
  }
  function stopBot() { if (botTimer !== null) clearTimeout(botTimer); botTimer=null; botThinking=false; }
  // Los tiempos se mantienen correctos si la pestaña deja de estar activa.
  function advanceClock() {
    const c = clock();
    if (!c.enabled || !c.running || c.flag || review || app.active.saved || Chess.status(app.active.states).done) return;
    const now = Date.now(), delta = Math.max(0, now - (Number(c.stamp) || now)); c.stamp = now;
    if (!delta) return;
    const white = app.active.states.at(-1).t === 1;
    const remaining = white ? 'white' : 'black', used = white ? 'usedWhite' : 'usedBlack';
    const elapsed = c.limit ? Math.min(delta, c[remaining]) : delta;
    c[used] += elapsed; c.turnMs += elapsed;
    if (c.limit) {
      c[remaining] = Math.max(0, c[remaining] - delta);
      if (c[remaining] === 0) {
        c.flag = white ? 'w' : 'b'; c.running = false; stopBot(); persist();
      }
    }
  }
  // Conserva las reglas originales y agrega la pérdida por tiempo.
  const baseStatus = calculatedStatus;
  calculatedStatus = function() {
    const st = baseStatus(), c = clock();
    return c.flag && !st.done ? {
      done:true, result:c.flag === 'w' ? 'black' : 'white',
      text:'Tiempo agotado · ganan las ' + (c.flag === 'w' ? 'negras' : 'blancas'), check:false
    } : st;
  };
  function renderClock() {
    const c = clock(), whiteTurn = app.active.states.at(-1).t === 1;
    const lastMove = app.active.moves.at(-1);
    for (const color of ['white','black']) {
      const el = byId('ca-' + color + '-time');
      el.textContent = c.enabled ? fmt(c.limit ? c[color] : c[color === 'white' ? 'usedWhite' : 'usedBlack']) : '—:—';
      el.classList.toggle('running', !!(c.enabled && c.running && (color === 'white') === whiteTurn));
      el.classList.toggle('flagged', c.flag === (color === 'white' ? 'w' : 'b'));
    }
    byId('ca-current-time').textContent = c.enabled ? fmt(c.turnMs, true) : '00:00.0';
    byId('ca-last-time').textContent = lastMove && Number.isFinite(lastMove.timeMs) ? fmt(lastMove.timeMs, true) : '—';
    byId('ca-timer-start').textContent = !c.enabled ? '▶ Iniciar' : c.running ? '⏸ Pausar' : '▶ Reanudar';
    byId('ca-timer-start').disabled = app.active.saved || !!c.flag || Chess.status(app.active.states).done;
    byId('ca-timer-reset').disabled = !!app.active.saved;
    byId('ca-time-choice').disabled = !!c.enabled || !!app.active.saved;
    byId('ca-time-choice').value = String(c.limit);
    byId('ca-time-help').textContent = c.flag ? 'Tiempo agotado. Guarda la partida o empieza otra.' :
      !c.enabled ? 'Inicia el reloj cuando quieras. Los tiempos se registran en cada jugada.' :
      !c.running ? 'Reloj en pausa. Puedes reanudarlo.' : c.limit ?
      'Cada participante dispone de ' + (c.limit/60) + ' minutos.' :
      'Cronómetro activo: mide el turno actual y el tiempo total de cada participante.';
  }
  function tick() {
    const previousFlag = clock().flag;
    advanceClock(); renderClock();
    if (!previousFlag && clock().flag) { renderBoard(); renderNames(); showToast('⏱ ' + calculatedStatus().text); }
    if (clock().running && Date.now() - lastPersist >= 12000) { lastPersist=Date.now(); persist(); }
  }
  function renderMode() {
    const enabled = app.active.mode === 'bot', level = app.active.level || 'beginner';
    byId('ca-local').classList.toggle('on', !enabled);
    byId('ca-bot').classList.toggle('on', enabled);
    byId('ca-local').setAttribute('aria-pressed', String(!enabled));
    byId('ca-bot').setAttribute('aria-pressed', String(enabled));
    byId('ca-bot-options').hidden = !enabled;
    byId('ca-level').value = level;
    byId('ca-level-note').textContent = ({
      beginner:'Movimientos variados; puede dejar piezas sin proteger.',
      intermediate:'Protege piezas y calcula intercambios sencillos.',
      advanced:'Considera más movimientos antes de decidir.'
    })[level];
    if (enabled) { byId('black-name').value = app.active.black; byId('black-name').disabled = true; }
    else if (!app.active.saved) byId('black-name').disabled = false;
  }
  const oldRender = render;
  render = function() { oldRender(); renderMode(); renderClock(); };
  const oldRenderBoard = renderBoard;
  renderBoard = function() {
    oldRenderBoard();
    const viewing = !!getReviewRecord(), c = clock();
    if (!viewing) {
      byId('board-description').textContent = app.active.mode === 'bot' ?
        'Contra ' + app.active.black + ' · Tú juegas con blancas' :
        'Modo local · Dos jugadores · Piezas blancas abajo';
      if (c.flag) byId('game-status').textContent = calculatedStatus().text;
      else if (botThinking && app.active.mode === 'bot') byId('game-status').textContent = '♛ El bot está pensando…';
    }
  };
  const oldRenderNames = renderNames;
  renderNames = function() {
    oldRenderNames();
    if (!review && botThinking && app.active.mode === 'bot') byId('turn-black').textContent = 'Pensando…';
  };
  const oldRenderMoves = renderMoves;
  renderMoves = function() {
    oldRenderMoves();
    const nodes = byId('moves-list').querySelectorAll('.move-san');
    const moves = displayedRecord().moves;
    nodes.forEach((el, i) => {
      if (Number.isFinite(moves[i]?.timeMs)) {
        const span = document.createElement('span');
        span.className = 'ca-move-ms';
        span.textContent = '⏱ ' + fmt(moves[i].timeMs, true);
        el.appendChild(span);
      }
    });
  };
  // Evitar movimientos después del tiempo agotado o durante el turno del bot.
  const oldClickSquare = clickSquare;
  clickSquare = function(i) {
    if (clock().flag) { showToast('El tiempo se agotó. Guarda tu partida.'); return; }
    if (app.active.mode === 'bot' && app.active.states.at(-1).t === -1) {
      showToast('El bot está pensando ♛'); return;
    }
    oldClickSquare(i);
  };
  // Para el motor original, el bot también utiliza exactamente la misma validación legal.
  function scorePosition(s) {
    let score=0;
    for (let i=0; i<128; i++) {
      if (i & 0x88) { i += 7; continue; }
      const p=s.b[i]; if (p === '.') continue;
      const white = Chess.side(p)===1, type=p.toLowerCase(), x=i&7, y=i>>4;
      const center=7-Math.abs(x-3.5)-Math.abs(y-3.5);
      const advance = type==='p' ? (white ? 6-y : y-1)*3 : 0;
      const bonus = (type==='n'?center*11:type==='b'?center*6:type==='p'?center*3:0)+advance;
      score += (white?1:-1) * (VALUES[type] + bonus);
    }
    return score;
  }
  function priority(s,m) {
    const captured=s.b[m[1]],attacker=s.b[m[0]];
    return (captured==='.'?0:VALUES[captured.toLowerCase()]*10) - VALUES[attacker.toLowerCase()]/10 +
      (m[2]==='q'?900:0) + (m[3]==='ep'?120:0);
  }
  function search(s,depth,alpha,beta,ctx) {
    ctx.nodes++;
    if (ctx.nodes > ctx.max || Date.now() > ctx.deadline) return scorePosition(s)*s.t;
    const moves=Chess.legal(s);
    if (!moves.length) return Chess.checked(s) ? -100000-depth : 0;
    if (!depth) return scorePosition(s)*s.t;
    moves.sort((a,b)=>priority(s,b)-priority(s,a));
    let best=-Infinity;
    for (const m of moves) {
      const value=-search(Chess.apply(s,m),depth-1,-beta,-alpha,ctx);
      best=Math.max(best,value); alpha=Math.max(alpha,value);
      if(alpha>=beta) break;
    }
    return best;
  }
  function chooseMove(s,level) {
    const moves=Chess.legal(s);
    if (!moves.length) return null;
    if (level==='beginner') return moves[Math.floor(Math.random()*moves.length)];
    const depth=level==='advanced'?3:2;
    const ctx={nodes:0,max:level==='advanced'?16000:5000,deadline:Date.now()+(level==='advanced'?1300:700)};
    const candidates=moves.sort((a,b)=>priority(s,b)-priority(s,a)).map(m=>({
      m, score:-search(Chess.apply(s,m),depth-1,-1e6,1e6,ctx) +
        (level==='intermediate' ? (Math.random()-.5)*26 : 0)
    })).sort((a,b)=>b.score-a.score);
    return level==='intermediate' && candidates.length>1 && Math.random()<.12 ? candidates[1].m : candidates[0].m;
  }
  function scheduleBot() {
    const a=app.active, s=a.states.at(-1);
    if (a.mode!=='bot'||s.t!==-1||a.saved||review||calculatedStatus().done||botThinking) return;
    botThinking=true;
    byId('game-status').textContent='♛ El bot está pensando…';
    botTimer=setTimeout(()=>{
      botTimer=null;
      if (app.active.id!==a.id||review||app.active.saved||app.active.states.at(-1).t!==-1) {
        botThinking=false;return;
      }
      advanceClock();
      if (calculatedStatus().done) { botThinking=false; render(); return; }
      const m=chooseMove(app.active.states.at(-1), app.active.level||'beginner');
      botThinking=false;
      if (m) play(m,'bot');
    }, 400);
  }
  const oldPlay = play;
  play = function(m, source='human') {
    if (review || app.active.saved || calculatedStatus().done) return;
    if (app.active.mode==='bot' && app.active.states.at(-1).t===-1 && source!=='bot') return;
    advanceClock();
    if (calculatedStatus().done) { render(); return; }
    const c=clock(), before=JSON.parse(JSON.stringify(c)), length=app.active.moves.length;
    oldPlay(m);
    if (app.active.moves.length===length) return;
    const last=app.active.moves.at(-1);
    last.beforeClock=before;
    if (c.enabled) last.timeMs=c.turnMs;
    c.turnMs=0; c.stamp=Date.now();
    if (calculatedStatus().done) c.running=false;
    persist(); render();
    if (app.active.mode==='bot' && app.active.states.at(-1).t===-1 && !calculatedStatus().done) scheduleBot();
  };
  const oldUndo=undo;
  undo=function() {
    if (review || app.active.saved || !app.active.moves.length) return;
    stopBot();
    const two=app.active.mode==='bot' && app.active.states.at(-1).t===1 && app.active.moves.length>=2;
    let snapshot=null;
    for(let i=0;i<(two?2:1);i++) {
      snapshot=app.active.moves.at(-1)?.beforeClock||snapshot;
      oldUndo();
    }
    app.active.clock=snapshot ? {...snapshot, running:false, flag:null, stamp:Date.now()} : newClock(clock().limit);
    persist(); render();
    if (app.active.mode==='bot' && app.active.states.at(-1).t===-1) scheduleBot();
  };
  const oldNewGame=newGame;
  newGame=function() {
    const mode=app.active.mode||'local',level=app.active.level||'beginner',limit=clock().limit,oldId=app.active.id;
    // Se preserva la confirmación original, si hay jugadas sin guardar.
    oldNewGame();
    if (oldId===app.active.id) return;
    stopBot();
    app.active.mode=mode;app.active.level=level;app.active.clock=newClock(limit);
    if (mode==='bot') app.active.black=botName(level);
    persist();render();
  };
  const oldFinish=finishGame;
  finishGame=function() { advanceClock();clock().running=false;oldFinish();renderClock(); };
  function selectMode(mode) {
    if(review||app.active.mode===mode||(!app.active.mode&&mode==='local'))return;
    if (app.active.moves.length&&!app.active.saved &&
      !confirm('Cambiar de modo inicia otra partida. ¿Continuar?')) return;
    stopBot();
    const level=app.active.level||'beginner',limit=clock().limit;
    selected=-1;app.active=newActive(app.profile);
    app.active.mode=mode;app.active.level=level;app.active.clock=newClock(limit);
    if(mode==='bot')app.active.black=botName(level);
    persist();render();
    showToast(mode==='bot'?'♛ Bot listo. ¡Juegas con blancas!':'Partida local lista ♡');
  }
  // Los botones originales ya tenían listeners antes de cargar este complemento.
  // Capturamos sus clics para evitar que esos listeners omitan el estado del bot/reloj.
  for (const [id, action] of [
    ['undo-btn', () => undo()],
    ['new-btn', () => newGame()],
    ['save-btn', () => finishGame()],
    ['register-btn', () => finishGame()],
    ['review-exit', () => exitReview()]
  ]) {
    byId(id).addEventListener('click', e => {
      e.stopImmediatePropagation();
      action();
    }, true);
  }
  byId('ca-local').addEventListener('click',()=>selectMode('local'));
  byId('ca-bot').addEventListener('click',()=>selectMode('bot'));
  byId('ca-level').addEventListener('change',e=>{
    const level=e.target.value;if(!BOT_LEVELS[level])return;
    app.active.level=level;
    if(app.active.mode==='bot')app.active.black=botName(level);
    persist();render();
  });
  byId('ca-timer-start').addEventListener('click',()=>{
    const c=clock();if(app.active.saved||calculatedStatus().done)return;
    if(!c.enabled){c.enabled=true;c.running=true;}
    else {advanceClock();c.running=!c.running;}
    c.stamp=Date.now();persist();renderClock();
  });
  byId('ca-timer-reset').addEventListener('click',()=>{
    if(app.active.saved)return;
    if(clock().enabled&&!confirm('¿Reiniciar los relojes sin borrar la partida?'))return;
    const limit=clock().limit;
    app.active.clock=newClock(limit);
    app.active.moves.forEach(m=>{delete m.timeMs;delete m.beforeClock;});
    persist();render();showToast('Relojes reiniciados ♡');
  });
  byId('ca-time-choice').addEventListener('change',e=>{
    if(clock().enabled)return;
    app.active.clock=newClock(e.target.value);persist();renderClock();
  });
  const oldReview=reviewGame;
  reviewGame=function(id) {stopBot();clock().running=false;oldReview(id);};
  const oldExit=exitReview;
  exitReview=function() {oldExit();scheduleBot();};
  const oldImport=importData;
  importData=async function(file) {stopBot();await oldImport(file);render();scheduleBot();};
  const oldGetter=window.getChessAtelier3DState;
  window.getChessAtelier3DState=function() {
    const state=oldGetter();
    if(state)state.readonly=state.readonly||!!clock().flag||
      (app.active.mode==='bot'&&app.active.states.at(-1).t===-1);
    return state;
  };
  if(!app.active.mode) app.active.mode='local';
  render();tick();
  const interval=setInterval(tick,250);
  window.addEventListener('pagehide',()=>{advanceClock();persist();});
  scheduleBot();
})();
