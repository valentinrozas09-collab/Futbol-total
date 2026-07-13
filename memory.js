(function () {
  const difficultyEl = document.getElementById("memory-difficulty");
  const gridEl = document.getElementById("memory-grid");
  const movesEl = document.getElementById("memory-moves");
  const pairsEl = document.getElementById("memory-pairs");
  const resultEl = document.getElementById("memory-result");
  const restartBtn = document.getElementById("btn-memory-restart");

  const DIFFICULTIES = [
    { key: "easy", label: "6 pares", pairs: 6, cols: 4 },
    { key: "medium", label: "8 pares", pairs: 8, cols: 4 },
    { key: "hard", label: "12 pares", pairs: 12, cols: 6 },
  ];

  let currentDifficulty = DIFFICULTIES[1];
  let cards = [];
  let flipped = [];
  let matchedCount = 0;
  let moves = 0;
  let locked = false;
  let initialized = false;

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function uniqueFlags() {
    return Array.from(new Set(Object.values(window.TEAM_FLAG)));
  }

  function renderDifficultyPicker() {
    difficultyEl.innerHTML = "";
    for (const d of DIFFICULTIES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill-btn" + (d.key === currentDifficulty.key ? " active" : "");
      btn.textContent = d.label;
      btn.addEventListener("click", () => {
        currentDifficulty = d;
        startGame();
      });
      difficultyEl.appendChild(btn);
    }
  }

  function updateStats() {
    movesEl.textContent = String(moves);
    pairsEl.textContent = `${matchedCount}/${currentDifficulty.pairs}`;
  }

  function renderGrid() {
    gridEl.style.setProperty("--memory-cols", String(currentDifficulty.cols));
    gridEl.innerHTML = "";
    for (const card of cards) {
      const cell = document.createElement("button");
      cell.type = "button";
      const shown = card.flipped || card.matched;
      cell.className = "memory-card" + (shown ? " flipped" : "") + (card.matched ? " matched" : "");
      cell.textContent = shown ? card.emoji : "⚽";
      cell.disabled = card.matched;
      cell.addEventListener("click", () => flipCard(card));
      gridEl.appendChild(cell);
    }
  }

  function flipCard(card) {
    if (locked || card.flipped || card.matched || flipped.length >= 2) return;
    card.flipped = true;
    flipped.push(card);
    renderGrid();

    if (flipped.length === 2) {
      moves++;
      updateStats();
      const [a, b] = flipped;
      if (a.emoji === b.emoji) {
        a.matched = true;
        b.matched = true;
        matchedCount++;
        flipped = [];
        updateStats();
        renderGrid();
        if (matchedCount === currentDifficulty.pairs) endGame();
      } else {
        locked = true;
        setTimeout(() => {
          a.flipped = false;
          b.flipped = false;
          flipped = [];
          locked = false;
          renderGrid();
        }, 800);
      }
    }
  }

  function endGame() {
    resultEl.textContent = `¡Ganaste en ${moves} movimientos!`;
    resultEl.className = "guess-result win";
    restartBtn.hidden = false;
  }

  function startGame() {
    renderDifficultyPicker();
    const flags = shuffle(uniqueFlags()).slice(0, currentDifficulty.pairs);
    cards = shuffle([...flags, ...flags]).map((emoji, id) => ({ id, emoji, flipped: false, matched: false }));
    flipped = [];
    matchedCount = 0;
    moves = 0;
    locked = false;
    resultEl.textContent = "";
    resultEl.className = "guess-result";
    restartBtn.hidden = true;
    updateStats();
    renderGrid();
  }

  restartBtn.addEventListener("click", startGame);

  function init() {
    if (initialized) return;
    initialized = true;
    startGame();
  }

  document.addEventListener("memorymode:shown", init);
  if (!document.getElementById("app-memory").hidden) init();
})();
