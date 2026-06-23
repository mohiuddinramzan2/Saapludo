// ===================== সাপলুডু — গেম লজিক =====================

const LADDERS = { 4:14, 9:31, 20:38, 28:84, 40:59, 51:67, 63:81, 71:91 };
const SNAKES  = { 17:7, 54:34, 62:19, 64:60, 87:24, 93:73, 95:75, 98:79 };

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const COLOR_META = [
  { cls: 'p0', name: 'লাল',    hex: '#D64545' },
  { cls: 'p1', name: 'সবুজ',   hex: '#3FA34D' },
  { cls: 'p2', name: 'হলুদ',   hex: '#E0B400' },
  { cls: 'p3', name: 'নীল',    hex: '#3866C2' },
];

// --- state ---
let players = [];
let currentIdx = 0;
let rolling = false;
let gameOver = false;
let consecutiveSixes = 0;
let selectedCount = 2;

// ---------- বোর্ড তৈরি ----------
const boardEl = document.getElementById('board');
let tokenLayer;

function rFromNumber(num){
  // num: 1..100  ->  { r (0=bottom..9=top), col (0..9), displayRow (0=top..9=bottom) }
  const rBottom = Math.floor((num - 1) / 10);
  const rem = num - rBottom * 10; // 1..10
  let col;
  if (rBottom % 2 === 0) col = rem - 1;
  else col = 10 - rem;
  const displayRow = 9 - rBottom;
  return { col, displayRow };
}

function buildBoard(){
  boardEl.innerHTML = '';
  for (let displayRow = 0; displayRow <= 9; displayRow++){
    const rBottom = 9 - displayRow;
    for (let col = 0; col <= 9; col++){
      const num = rBottom % 2 === 0 ? rBottom * 10 + col + 1 : rBottom * 10 + (10 - col);
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.num = num;
      cell.textContent = num;
      if (num === 100) cell.classList.add('finish');

      if (LADDERS[num]){
        cell.classList.add('ladder-cell');
        const m = document.createElement('span');
        m.className = 'marker';
        m.textContent = '🪜';
        cell.appendChild(m);
        const to = document.createElement('span');
        to.className = 'marker to';
        to.textContent = '→' + LADDERS[num];
        cell.appendChild(to);
      }
      if (SNAKES[num]){
        cell.classList.add('snake-cell');
        const m = document.createElement('span');
        m.className = 'marker';
        m.textContent = '🐍';
        cell.appendChild(m);
        const to = document.createElement('span');
        to.className = 'marker to';
        to.textContent = '→' + SNAKES[num];
        cell.appendChild(to);
      }
      boardEl.appendChild(cell);
    }
  }
  tokenLayer = document.createElement('div');
  tokenLayer.className = 'token-layer';
  boardEl.appendChild(tokenLayer);
}

function positionToPercent(num){
  if (num <= 0) return null;
  const { col, displayRow } = rFromNumber(num);
  return { left: col * 10 + 0.25, top: displayRow * 10 + 0.25 };
}

function renderTokens(){
  tokenLayer.querySelectorAll('.token').forEach(t => t.remove());
  players.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = `token ${p.colorCls}`;
    el.id = `token-${i}`;
    if (p.position > 0){
      const pos = positionToPercent(p.position);
      el.style.left = pos.left + '%';
      el.style.top = pos.top + '%';
      el.style.opacity = 1;
    } else {
      el.style.left = '0%';
      el.style.top = '0%';
      el.style.opacity = 0;
    }
    tokenLayer.appendChild(el);
  });
}

function moveTokenVisual(playerIdx, num){
  const el = document.getElementById(`token-${playerIdx}`);
  if (!el) return;
  const pos = positionToPercent(num);
  el.style.opacity = 1;
  el.style.left = pos.left + '%';
  el.style.top = pos.top + '%';
}

// ---------- সেটআপ ----------
const setupOverlay = document.getElementById('setupOverlay');
const countRow = document.getElementById('countRow');
const nameInputsEl = document.getElementById('nameInputs');
const startGameBtn = document.getElementById('startGameBtn');

function renderNameInputs(){
  nameInputsEl.innerHTML = '';
  for (let i = 0; i < selectedCount; i++){
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '8px';

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.width = '16px';
    dot.style.height = '16px';
    dot.style.borderRadius = '50%';
    dot.style.flexShrink = '0';
    dot.style.background = COLOR_META[i].hex;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 14;
    input.value = `প্লেয়ার ${i + 1} (${COLOR_META[i].name})`;
    input.dataset.idx = i;

    wrap.appendChild(dot);
    wrap.appendChild(input);
    nameInputsEl.appendChild(wrap);
  }
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
  players = inputs.map((inp, i) => ({
    name: inp.value.trim() || `প্লেয়ার ${i + 1}`,
    colorCls: COLOR_META[i].cls,
    colorHex: COLOR_META[i].hex,
    position: 0,
  }));
  currentIdx = 0;
  gameOver = false;
  consecutiveSixes = 0;
  setupOverlay.hidden = true;
  renderPlayerList();
  renderTokens();
  updateTurnBanner();
});

// default selection
countRow.querySelector('[data-count="2"]').classList.add('selected');
renderNameInputs();

// ---------- প্লেয়ার লিস্ট / টার্ন ব্যানার ----------
const playerListEl = document.getElementById('playerList');
const turnDot = document.getElementById('turnDot');
const turnText = document.getElementById('turnText');
const hintText = document.getElementById('hintText');

function renderPlayerList(){
  playerListEl.innerHTML = '';
  players.forEach((p, i) => {
    const li = document.createElement('li');
    li.id = `player-li-${i}`;
    if (i === currentIdx) li.classList.add('active');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = p.colorHex;
    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;
    const posSpan = document.createElement('span');
    posSpan.className = 'pos';
    posSpan.textContent = p.position > 0 ? `ঘর ${p.position}` : 'শুরু হয়নি';
    li.appendChild(dot);
    li.appendChild(nameSpan);
    li.appendChild(posSpan);
    playerListEl.appendChild(li);
  });
}

function updateTurnBanner(){
  const p = players[currentIdx];
  if (!p) return;
  turnDot.style.background = p.colorHex;
  turnText.textContent = `${p.name}-এর পালা`;
  playerListEl.querySelectorAll('li').forEach((li, i) => li.classList.toggle('active', i === currentIdx));
}

// ---------- ডাইস / মুভমেন্ট ----------
const rollBtn = document.getElementById('rollBtn');
const diceEl = document.getElementById('dice');
const diceFaceEl = document.getElementById('diceFace');

rollBtn.addEventListener('click', () => {
  if (rolling || gameOver || players.length === 0) return;
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
      handleRoll(value);
    }
  }, 60);
});

function handleRoll(value){
  if (value === 6){
    consecutiveSixes++;
  } else {
    consecutiveSixes = 0;
  }

  if (consecutiveSixes === 3){
    consecutiveSixes = 0;
    hintText.textContent = 'পরপর ৩ বার ৬! এই পালা বাতিল হলো।';
    rolling = false;
    rollBtn.disabled = false;
    advanceTurn(false);
    return;
  }

  const player = players[currentIdx];
  const target = player.position + value;

  if (target > 100){
    hintText.textContent = `১০০ এর বেশি হয়ে যাচ্ছে — এই দান বাদ গেল।`;
    rolling = false;
    rollBtn.disabled = false;
    advanceTurn(value === 6);
    return;
  }

  player.position = target;
  moveTokenVisual(currentIdx, target);
  renderPlayerList();

  setTimeout(() => {
    if (LADDERS[target]){
      hintText.textContent = `${player.name} মই বেয়ে ${LADDERS[target]} নম্বরে উঠে গেলেন! 🪜`;
      player.position = LADDERS[target];
      moveTokenVisual(currentIdx, player.position);
    } else if (SNAKES[target]){
      hintText.textContent = `${player.name} সাপের মুখে পড়ে ${SNAKES[target]} নম্বরে নেমে গেলেন! 🐍`;
      player.position = SNAKES[target];
      moveTokenVisual(currentIdx, player.position);
    } else {
      hintText.textContent = `${player.name} ${value} ঘর এগিয়ে ${target} নম্বরে এলেন।`;
    }
    renderPlayerList();

    setTimeout(() => {
      rolling = false;
      rollBtn.disabled = false;

      if (player.position === 100){
        endGame(player);
        return;
      }
      advanceTurn(value === 6);
    }, 420);
  }, 480);
}

function advanceTurn(extraTurn){
  if (!extraTurn){
    currentIdx = (currentIdx + 1) % players.length;
  } else {
    hintText.textContent += ' (৬ পড়েছে — আবার চান্স!)';
  }
  updateTurnBanner();
}

// ---------- জয় / রিস্টার্ট ----------
const winOverlay = document.getElementById('winOverlay');
const winText = document.getElementById('winText');
const playAgainBtn = document.getElementById('playAgainBtn');
const restartBtn = document.getElementById('restartBtn');

function endGame(player){
  gameOver = true;
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

// ---------- init ----------
buildBoard();
