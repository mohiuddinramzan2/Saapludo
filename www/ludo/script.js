// ===================== লুডু — গেম লজিক =====================

const COLORS = ['red', 'green', 'yellow', 'blue'];
const COLOR_LABEL = { red: 'লাল', green: 'সবুজ', yellow: 'হলুদ', blue: 'নীল' };
const COLOR_HEX   = { red: '#D64545', green: '#3FA34D', yellow: '#E0B400', blue: '#3866C2' };
const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// ৫২ ঘরের মূল ট্র্যাক (15x15 গ্রিডে সারি,কলাম — ০-ইনডেক্সড), লাল-এর শুরু থেকে ঘড়ির কাঁটার দিকে
const RING = [
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],[6,0]
];

const START_INDEX = { red: 0, green: 13, yellow: 26, blue: 39 };

const HOME_COLUMNS = {
  red:    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  green:  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  yellow: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  blue:   [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
};

const SAFE_SET = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const CORNERS = [
  { r: 6, c: 6, tint: 'red' },
  { r: 6, c: 8, tint: 'green' },
  { r: 8, c: 8, tint: 'yellow' },
  { r: 8, c: 6, tint: 'blue' },
];
const CENTER = { r: 7, c: 7 };

const YARD_SPANS = {
  red:    { row: '1 / 7',  col: '1 / 7' },
  green:  { row: '1 / 7',  col: '10 / 16' },
  yellow: { row: '10 / 16', col: '10 / 16' },
  blue:   { row: '10 / 16', col: '1 / 7' },
};

const COLOR_OFFSET = { red: [-16, -16], green: [16, -16], yellow: [16, 16], blue: [-16, 16] };

// --- লুকআপ টেবিল তৈরি ---
const cellMap = {};
RING.forEach((rc, idx) => { cellMap[rc.join(',')] = { type: 'ring', idx }; });
COLORS.forEach(color => {
  HOME_COLUMNS[color].forEach((rc, i) => { cellMap[rc.join(',')] = { type: 'home', color, idx: i }; });
});
CORNERS.forEach(c => { cellMap[`${c.r},${c.c}`] = { type: 'corner', tint: c.tint }; });
cellMap[`${CENTER.r},${CENTER.c}`] = { type: 'center' };

function inYardRange(r, c){
  return (r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c > 8) || (r > 8 && c < 6);
}

function getCoordForStep(color, step){
  if (step < 0) return null;
  if (step <= 50){
    const ringIdx = (START_INDEX[color] + step) % 52;
    const [r, c] = RING[ringIdx];
    return { r, c };
  }
  const [r, c] = HOME_COLUMNS[color][step - 51];
  return { r, c };
}

// ========================= state =========================
let players = [];          // [{color,name}]
let tokens = {};           // tokens[color] = [step,step,step,step]  (-1 = yard, 0..56 = path/home, 56 = finished)
let currentIdx = 0;
let rolling = false;
let awaitingMove = false;
let movableSet = [];       // [{tIdx}]
let consecutiveSixes = 0;
let gameOver = false;
let selectedCount = 2;

// ========================= বোর্ড রেন্ডার =========================
const boardEl = document.getElementById('board');

function buildBoard(){
  boardEl.innerHTML = '';

  COLORS.forEach(color => {
    const span = YARD_SPANS[color];
    const yard = document.createElement('div');
    yard.className = `yard yard-${color}`;
    yard.id = `yard-${color}`;
    yard.style.gridRow = span.row;
    yard.style.gridColumn = span.col;

    const inner = document.createElement('div');
    inner.className = 'yard-inner';
    for (let i = 0; i < 4; i++){
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.id = `slot-${color}-${i}`;
      inner.appendChild(slot);
    }
    yard.appendChild(inner);
    boardEl.appendChild(yard);
  });

  for (let r = 0; r <= 14; r++){
    for (let c = 0; c <= 14; c++){
      if (inYardRange(r, c)) continue;
      const info = cellMap[`${r},${c}`];
      const div = document.createElement('div');
      div.style.gridRow = `${r + 1} / span 1`;
      div.style.gridColumn = `${c + 1} / span 1`;
      div.className = 'cell';

      if (!info){ boardEl.appendChild(div); continue; }

      if (info.type === 'ring'){
        if (SAFE_SET.has(info.idx)) div.classList.add('safe');
        COLORS.forEach(color => { if (START_INDEX[color] === info.idx) div.classList.add(`start-${color}`); });
      } else if (info.type === 'home'){
        div.classList.add(`home-col-${info.color}`);
      } else if (info.type === 'corner'){
        div.classList.add(`start-${info.tint}`);
      } else if (info.type === 'center'){
        div.textContent = '🏠';
        div.style.background = 'var(--saffron)';
        div.style.fontSize = '1.1rem';
      }
      boardEl.appendChild(div);
    }
  }
}

function clearOnboardTokens(){
  boardEl.querySelectorAll('.token-onboard').forEach(t => t.remove());
  boardEl.querySelectorAll('.slot').forEach(s => { s.innerHTML = ''; });
}

function renderTokens(){
  clearOnboardTokens();
  const occupancy = {};

  players.forEach(p => {
    const color = p.color;
    tokens[color].forEach((step, tIdx) => {
      if (step < 0){
        // ইয়ার্ডে
        const slot = document.getElementById(`slot-${color}-${tIdx}`);
        if (!slot) return;
        const el = document.createElement('div');
        el.className = `token-yard tok-${color}`;
        el.dataset.color = color;
        el.dataset.tidx = tIdx;
        el.textContent = tIdx + 1;
        slot.appendChild(el);
        return;
      }
      if (step >= 56) return; // ঘরে পৌঁছে গেছে, বোর্ডে দেখানোর প্রয়োজন নেই

      const coord = getCoordForStep(color, step);
      const key = `${coord.r},${coord.c}`;
      const n = occupancy[key] || 0;
      occupancy[key] = n + 1;

      const el = document.createElement('div');
      el.className = `token-onboard tok-${color}`;
      el.dataset.color = color;
      el.dataset.tidx = tIdx;
      el.textContent = tIdx + 1;
      el.style.gridRow = `${coord.r + 1} / span 1`;
      el.style.gridColumn = `${coord.c + 1} / span 1`;
      const [dx, dy] = COLOR_OFFSET[color];
      el.style.transform = `translate(${dx + n * 5}%, ${dy + n * 5}%)`;
      boardEl.appendChild(el);
    });
  });

  applyMovableHighlight();
}

function applyMovableHighlight(){
  boardEl.querySelectorAll('.movable').forEach(e => e.classList.remove('movable'));
  document.querySelectorAll('.slot .movable').forEach(e => e.classList.remove('movable'));
  if (!awaitingMove) return;
  const color = players[currentIdx].color;
  movableSet.forEach(tIdx => {
    const onboard = boardEl.querySelector(`.token-onboard[data-color="${color}"][data-tidx="${tIdx}"]`);
    if (onboard) onboard.classList.add('movable');
    const yardTok = document.querySelector(`#slot-${color}-${tIdx} .token-yard`);
    if (yardTok) yardTok.classList.add('movable');
  });
}

// ক্লিক ডেলিগেশন — মুভেবল গুটিতে ট্যাপ
boardEl.addEventListener('click', (e) => {
  const target = e.target.closest('.movable');
  if (!target || !awaitingMove) return;
  const color = target.dataset.color;
  const tIdx = parseInt(target.dataset.tidx, 10);
  if (color !== players[currentIdx].color) return;
  if (!movableSet.includes(tIdx)) return;
  performMove(tIdx);
});

// ========================= সেটআপ =========================
const setupOverlay = document.getElementById('setupOverlay');
const countRow = document.getElementById('countRow');
const nameInputsEl = document.getElementById('nameInputs');
const startGameBtn = document.getElementById('startGameBtn');

function activeColorsForCount(count){
  if (count === 2) return ['red', 'yellow'];
  if (count === 3) return ['red', 'green', 'yellow'];
  return ['red', 'green', 'yellow', 'blue'];
}

function renderNameInputs(){
  nameInputsEl.innerHTML = '';
  const active = activeColorsForCount(selectedCount);
  active.forEach((color, i) => {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '8px';

    const dot = document.createElement('span');
    dot.style.width = '16px';
    dot.style.height = '16px';
    dot.style.borderRadius = '50%';
    dot.style.flexShrink = '0';
    dot.style.background = COLOR_HEX[color];

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 14;
    input.value = `প্লেয়ার ${i + 1} (${COLOR_LABEL[color]})`;
    input.dataset.color = color;

    wrap.appendChild(dot);
    wrap.appendChild(input);
    nameInputsEl.appendChild(wrap);
  });
}

countRow.addEventListener('click', (e) => {
  const btn = e.target.closest('.count-btn');
  if (!btn) return;
  selectedCount = parseInt(btn.dataset.count, 10);
  countRow.querySelectorAll('.count-btn').forEach(b => b.classList.toggle('selected', b === btn));
  renderNameInputs();
});

startGameBtn.addEventListener('click', () => {
  const inputs = [...nameInputsEl.querySelectorAll('input')];
  players = inputs.map(inp => ({ color: inp.dataset.color, name: inp.value.trim() || COLOR_LABEL[inp.dataset.color] }));
  tokens = {};
  COLORS.forEach(c => { tokens[c] = [-1, -1, -1, -1]; });

  currentIdx = 0;
  gameOver = false;
  awaitingMove = false;
  movableSet = [];
  consecutiveSixes = 0;

  setupOverlay.hidden = true;
  markYardActivity();
  renderPlayerList();
  renderTokens();
  updateTurnBanner();
  hintText.textContent = '"ডাইস ছুঁড়ুন"-এ চেপে খেলা শুরু করুন।';
});

function markYardActivity(){
  COLORS.forEach(color => {
    const yard = document.getElementById(`yard-${color}`);
    const isActive = players.some(p => p.color === color);
    yard.classList.toggle('inactive', !isActive);
  });
}

countRow.querySelector('[data-count="2"]').classList.add('selected');
renderNameInputs();

// ========================= টার্ন ব্যানার / প্লেয়ার লিস্ট =========================
const playerListEl = document.getElementById('playerList');
const turnDot = document.getElementById('turnDot');
const turnText = document.getElementById('turnText');
const hintText = document.getElementById('hintText');

function homeCount(color){
  return tokens[color].filter(s => s >= 56).length;
}

function renderPlayerList(){
  playerListEl.innerHTML = '';
  players.forEach((p, i) => {
    const li = document.createElement('li');
    if (i === currentIdx) li.classList.add('active');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = COLOR_HEX[p.color];
    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;
    const posSpan = document.createElement('span');
    posSpan.className = 'pos';
    posSpan.textContent = `🏠 ${homeCount(p.color)}/৪`;
    li.appendChild(dot);
    li.appendChild(nameSpan);
    li.appendChild(posSpan);
    playerListEl.appendChild(li);
  });
}

function updateTurnBanner(){
  const p = players[currentIdx];
  if (!p) return;
  turnDot.style.background = COLOR_HEX[p.color];
  turnText.textContent = `${p.name}-এর পালা`;
  playerListEl.querySelectorAll('li').forEach((li, i) => li.classList.toggle('active', i === currentIdx));
}

// ========================= ডাইস =========================
const rollBtn = document.getElementById('rollBtn');
const diceEl = document.getElementById('dice');
const diceFaceEl = document.getElementById('diceFace');

rollBtn.addEventListener('click', () => {
  if (rolling || awaitingMove || gameOver || players.length === 0) return;
  rolling = true;
  rollBtn.disabled = true;
  diceEl.classList.add('rolling');

  let ticks = 0;
  const spin = setInterval(() => {
    diceFaceEl.textContent = DICE_FACES[1 + Math.floor(Math.random() * 6)];
    ticks++;
    if (ticks > 7){
      clearInterval(spin);
      const value = 1 + Math.floor(Math.random() * 6);
      diceFaceEl.textContent = DICE_FACES[value];
      diceEl.classList.remove('rolling');
      rolling = false;
      onDiceRolled(value);
    }
  }, 60);
});

let lastRoll = 0;

function onDiceRolled(value){
  lastRoll = value;

  if (value === 6) consecutiveSixes++; else consecutiveSixes = 0;
  if (consecutiveSixes === 3){
    consecutiveSixes = 0;
    hintText.textContent = 'পরপর ৩ বার ৬! এই পালা বাতিল হলো।';
    rollBtn.disabled = false;
    passTurn();
    return;
  }

  const color = players[currentIdx].color;
  const myTokens = tokens[color];
  const movable = [];
  myTokens.forEach((step, tIdx) => {
    if (step === -1){
      if (value === 6) movable.push(tIdx);
    } else if (step < 56){
      if (step + value <= 56) movable.push(tIdx);
    }
  });

  if (movable.length === 0){
    hintText.textContent = value === 6
      ? 'কোনো গুটি চালানো সম্ভব নয়, কিন্তু ৬ পড়েছে — আবার ছুঁড়ুন!'
      : 'কোনো গুটি চালানো সম্ভব নয় — পালা শেষ।';
    rollBtn.disabled = false;
    if (value === 6) return; // আবার চান্স, একই প্লেয়ার রোল করবে
    passTurn();
    return;
  }

  movableSet = movable;
  awaitingMove = true;
  applyMovableHighlight();
  hintText.textContent = movable.length === 1
    ? 'হাইলাইট করা গুটিতে ট্যাপ করুন।'
    : 'কোন গুটি চালাবেন? একটিতে ট্যাপ করুন।';
}

function performMove(tIdx){
  awaitingMove = false;
  const player = players[currentIdx];
  const color = player.color;
  const step = tokens[color][tIdx];
  const newStep = step === -1 ? 0 : step + lastRoll;
  tokens[color][tIdx] = newStep;

  let captured = false;

  if (newStep <= 50){
    const ringIdx = (START_INDEX[color] + newStep) % 52;
    if (!SAFE_SET.has(ringIdx)){
      players.forEach(other => {
        if (other.color === color) return;
        tokens[other.color].forEach((oStep, oIdx) => {
          if (oStep >= 0 && oStep <= 50){
            const oRingIdx = (START_INDEX[other.color] + oStep) % 52;
            if (oRingIdx === ringIdx){
              tokens[other.color][oIdx] = -1;
              captured = true;
            }
          }
        });
      });
    }
  }

  renderTokens();
  renderPlayerList();

  let msg = step === -1
    ? `${player.name} ৬ পড়ায় গুটি ${tIdx + 1} বের করলেন।`
    : `${player.name} গুটি ${tIdx + 1} নিয়ে ${lastRoll} ঘর এগোলেন।`;
  if (captured) msg += ' 💥 প্রতিপক্ষের গুটি কেটে দিলেন!';
  if (newStep === 56) msg += ' 🏆 এই গুটি ঘরে পৌঁছে গেছে!';
  hintText.textContent = msg;

  if (homeCount(color) === 4){
    endGame(player);
    return;
  }

  rollBtn.disabled = false;
  const extraTurn = lastRoll === 6 || captured || newStep === 56;
  if (extraTurn){
    hintText.textContent += ' আবার চান্স!';
  } else {
    passTurn();
  }
}

function passTurn(){
  awaitingMove = false;
  movableSet = [];
  consecutiveSixes = 0;
  currentIdx = (currentIdx + 1) % players.length;
  updateTurnBanner();
  renderTokens();
}

// ========================= জয় / রিস্টার্ট =========================
const winOverlay = document.getElementById('winOverlay');
const winText = document.getElementById('winText');
const playAgainBtn = document.getElementById('playAgainBtn');
const restartBtn = document.getElementById('restartBtn');

function endGame(player){
  gameOver = true;
  awaitingMove = false;
  winText.textContent = `🏆 ${player.name} জয়ী হয়েছেন!`;
  winOverlay.hidden = false;
}

playAgainBtn.addEventListener('click', () => {
  winOverlay.hidden = true;
  setupOverlay.hidden = false;
});
restartBtn.addEventListener('click', () => {
  winOverlay.hidden = true;
  setupOverlay.hidden = false;
});

// ========================= init =========================
buildBoard();
