(function () {
  const boardEl = document.getElementById("grid-board");
  const scoreEl = document.getElementById("grid-score");
  const bestEl = document.getElementById("grid-best");
  const resultEl = document.getElementById("grid-result");
  const newBtn = document.getElementById("btn-grid-new");
  const difficultyButtons = Array.from(document.querySelectorAll("#grid-difficulty button[data-grid-difficulty]"));
  const modeRandomBtn = document.getElementById("grid-mode-random");
  const modeDailyBtn = document.getElementById("grid-mode-daily");
  const shareWrap = document.getElementById("grid-share-wrap");
  const shareTextEl = document.getElementById("grid-share-text");
  const shareBtn = document.getElementById("btn-grid-share");

  const CATEGORY_DEFS = [
    { id: "champion", label: "Campeón de su Mundial", test: (p) => p.edition.winner === p.team },
    { id: "runnerup", label: "Subcampeón de su Mundial", test: (p) => p.edition.runnerUp === p.team },
    { id: "goldenball", label: "Ganó el Balón de Oro", test: (p) => p.edition.goldenBall === p.name },
    { id: "goldenboot", label: "Ganó la Bota de Oro", test: (p) => p.edition.goldenBoot === p.name },
    { id: "elite", label: "Rating 90+", test: (p) => ratingOf(p) >= 90 },
    { id: "star", label: "Figura histórica", test: (p) => !!(window.STAR_PLAYERS && window.STAR_PLAYERS.has(p.name)) },
    { id: "gk", label: "Arquero", test: (p) => positionOf(p) === "GK" },
    { id: "df", label: "Defensor", test: (p) => positionOf(p) === "DF" },
    { id: "mf", label: "Mediocampista", test: (p) => positionOf(p) === "MF" },
    { id: "fw", label: "Delantero", test: (p) => positionOf(p) === "FW" },
    { id: "conmebol", label: "Selección de CONMEBOL", test: (p) => window.TEAM_CONFEDERATION[p.team] === "CONMEBOL" },
    { id: "uefa", label: "Selección de UEFA", test: (p) => window.TEAM_CONFEDERATION[p.team] === "UEFA" },
    { id: "host", label: "Jugó en el Mundial que organizó su país", test: (p) => p.edition.host.includes(p.team) },
  ];
  const CATEGORY_BY_ID = Object.fromEntries(CATEGORY_DEFS.map((c) => [c.id, c]));
  const DIFFICULTY_LABEL = { easy: "Fácil", normal: "Normal", hard: "Difícil" };

  let pool = [];
  let uniqueNames = [];
  let rows = [];
  let cols = [];
  let cells = []; // { rowCat, colCat, filled, locked, correct }
  let activeCellIdx = null;
  let initialized = false;
  let difficulty = "normal"; // "easy" | "normal" | "hard"
  let boardMode = "random"; // "random" | "daily"

  function stripAccents(str) {
    return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function normalize(str) {
    return stripAccents(str).toLowerCase().trim();
  }

  function shuffle(arr, rng) {
    const rand = rng || Math.random;
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Generador determinístico (mulberry32): misma semilla → misma secuencia,
  // así la grilla diaria es idéntica para todos sin necesidad de backend.
  function seededRandom(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) {
      h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function positionOf(p) {
    const teamMap = p.edition.positions && p.edition.positions[p.team];
    return (teamMap && teamMap[p.name]) || null;
  }

  function ratingOf(p) {
    if (window.playerRating) return window.playerRating(p.year, p.team, p.name);
    return 70;
  }

  function buildPool() {
    const list = [];
    for (const year of Object.keys(window.WORLD_CUPS)) {
      const edition = window.WORLD_CUPS[year];
      for (const team of edition.teams) {
        const players = (edition.players && edition.players[team]) || [];
        for (const name of players) list.push({ name, team, year, edition });
      }
    }
    for (const p of list) {
      p.flags = {};
      for (const cat of CATEGORY_DEFS) p.flags[cat.id] = !!cat.test(p);
    }
    return list;
  }

  function cellSolutionCount(rowCat, colCat) {
    let count = 0;
    for (const p of pool) if (p.flags[rowCat.id] && p.flags[colCat.id]) count++;
    return count;
  }

  // Junta varias combinaciones válidas de categorías y las ordena por cantidad total
  // de soluciones posibles: menos soluciones = celdas más difíciles de adivinar.
  function pickCategories(diff, rng) {
    const rand = rng || Math.random;
    const valid = [];
    for (let attempt = 0; attempt < 150 && valid.length < 25; attempt++) {
      const chosen = shuffle(CATEGORY_DEFS, rand).slice(0, 6);
      const candidateRows = chosen.slice(0, 3);
      const candidateCols = chosen.slice(3, 6);
      let total = 0;
      let ok = true;
      for (const r of candidateRows) {
        for (const c of candidateCols) {
          const count = cellSolutionCount(r, c);
          if (count === 0) {
            ok = false;
            break;
          }
          total += count;
        }
        if (!ok) break;
      }
      if (ok) valid.push({ rows: candidateRows, cols: candidateCols, score: total });
    }

    if (!valid.length) {
      return {
        rows: [CATEGORY_BY_ID.gk, CATEGORY_BY_ID.df, CATEGORY_BY_ID.fw],
        cols: [CATEGORY_BY_ID.conmebol, CATEGORY_BY_ID.uefa, CATEGORY_BY_ID.elite],
      };
    }

    valid.sort((a, b) => a.score - b.score);
    if (diff === "hard") return valid[0];
    if (diff === "easy") return valid[valid.length - 1];
    return valid[Math.floor(valid.length / 2)];
  }

  function renderCellContent(idx) {
    const cell = cells[idx];
    const div = document.createElement("div");
    div.className = "grid-cell guess" + (cell.locked ? (cell.correct ? " correct" : " wrong") : "");

    if (cell.locked) {
      div.innerHTML = cell.correct
        ? `<div class="grid-cell-name">${cell.filled.name}</div><div class="grid-cell-sub">${cell.filled.team} · ${cell.filled.year}</div>`
        : `<div class="grid-cell-name">✗</div><div class="grid-cell-sub">${cell.filled.name || "sin respuesta"}</div>`;
    } else if (activeCellIdx === idx) {
      div.innerHTML = `<input type="text" class="grid-cell-input" id="grid-input-${idx}" placeholder="Jugador...">`;
    } else {
      div.textContent = "?";
      div.addEventListener("click", () => openCell(idx));
    }
    return div;
  }

  function renderBoard() {
    boardEl.innerHTML = "";

    const corner = document.createElement("div");
    corner.className = "grid-cell corner";
    boardEl.appendChild(corner);

    for (const c of cols) {
      const header = document.createElement("div");
      header.className = "grid-cell header";
      header.textContent = c.label;
      boardEl.appendChild(header);
    }

    for (let i = 0; i < 3; i++) {
      const rowHeader = document.createElement("div");
      rowHeader.className = "grid-cell header";
      rowHeader.textContent = rows[i].label;
      boardEl.appendChild(rowHeader);

      for (let j = 0; j < 3; j++) {
        boardEl.appendChild(renderCellContent(i * 3 + j));
      }
    }

    if (activeCellIdx != null) {
      const input = document.getElementById(`grid-input-${activeCellIdx}`);
      if (input) {
        input.focus();
        input.addEventListener("input", () => renderSuggestions(activeCellIdx, input));
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submitGuess(activeCellIdx, input.value);
          }
        });
      }
    }
  }

  function renderSuggestions(idx, input) {
    const cellEl = input.closest(".grid-cell");
    let list = cellEl.querySelector(".guess-suggestions");
    if (!list) {
      list = document.createElement("ul");
      list.className = "guess-suggestions";
      cellEl.appendChild(list);
    }
    const filter = normalize(input.value);
    if (!filter) {
      list.hidden = true;
      list.innerHTML = "";
      return;
    }
    const matches = uniqueNames.filter((n) => normalize(n).includes(filter)).slice(0, 6);
    if (!matches.length) {
      list.hidden = true;
      list.innerHTML = "";
      return;
    }
    list.innerHTML = matches
      .map((n) => `<li class="suggestion-item" data-name="${n.replace(/"/g, "&quot;")}"><span class="suggestion-name">${n}</span></li>`)
      .join("");
    list.hidden = false;
    list.querySelectorAll(".suggestion-item").forEach((li) => {
      li.addEventListener("click", () => {
        input.value = li.dataset.name;
        list.hidden = true;
        submitGuess(idx, input.value);
      });
    });
  }

  function openCell(idx) {
    if (cells[idx].locked) return;
    activeCellIdx = idx;
    renderBoard();
  }

  // Busca coincidencia para una celda: primero exacta; si no hay, acepta un nombre
  // parcial (apodo, apellido, nombre incompleto) siempre que apunte a un único
  // jugador posible — si hay varios, no se resuelve sola para no adivinar por vos.
  function findMatch(cell, norm) {
    const exact = pool.find((p) => normalize(p.name) === norm && p.flags[cell.rowCat.id] && p.flags[cell.colCat.id]);
    if (exact) return { status: "match", player: exact };

    const partial = pool.filter(
      (p) => p.flags[cell.rowCat.id] && p.flags[cell.colCat.id] && normalize(p.name).includes(norm)
    );
    const uniqueNames = Array.from(new Set(partial.map((p) => p.name)));
    if (uniqueNames.length === 1) return { status: "match", player: partial.find((p) => p.name === uniqueNames[0]) };
    if (uniqueNames.length > 1) return { status: "ambiguous", names: uniqueNames };
    return { status: "none" };
  }

  function submitGuess(idx, typedName) {
    const cell = cells[idx];
    if (cell.locked || !typedName.trim()) return;

    const norm = normalize(typedName);
    const result = findMatch(cell, norm);

    if (result.status === "ambiguous") {
      const input = document.getElementById(`grid-input-${idx}`);
      if (input) input.placeholder = "Hay varios jugadores posibles, escribí el nombre completo";
      return;
    }

    const resolvedName = result.status === "match" ? result.player.name : typedName.trim();
    const usedNames = new Set(cells.filter((c) => c.filled && c.correct).map((c) => normalize(c.filled.name)));
    if (usedNames.has(normalize(resolvedName))) {
      const input = document.getElementById(`grid-input-${idx}`);
      if (input) input.placeholder = "Ya usaste a ese jugador";
      return;
    }

    cell.locked = true;
    activeCellIdx = null;

    if (result.status === "match") {
      cell.filled = { name: result.player.name, team: result.player.team, year: result.player.year };
      cell.correct = true;
    } else {
      cell.filled = { name: typedName.trim() };
      cell.correct = false;
    }

    renderBoard();
    updateScore();
    saveDailyState();

    if (cells.every((c) => c.locked)) endGame();
  }

  function updateScore() {
    const correct = cells.filter((c) => c.correct).length;
    scoreEl.textContent = `${correct}/9`;
  }

  // ---------- Mejor puntaje persistente ----------

  function bestKey(diff) {
    return `futbolTotal.grid.best.${diff}`;
  }

  function loadBest(diff) {
    return Number(localStorage.getItem(bestKey(diff))) || 0;
  }

  function saveBestIfHigher(diff, score) {
    const best = loadBest(diff);
    if (score > best) localStorage.setItem(bestKey(diff), String(score));
    return Math.max(best, score);
  }

  // ---------- Grilla diaria compartible ----------

  function dailyKey(diff) {
    return `futbolTotal.grid.daily.${diff}`;
  }

  function serializeCells() {
    return cells.map((c) => ({
      rowCatId: c.rowCat.id,
      colCatId: c.colCat.id,
      locked: c.locked,
      correct: c.correct,
      filled: c.filled,
    }));
  }

  function deserializeCells(saved) {
    return saved.map((s) => ({
      rowCat: CATEGORY_BY_ID[s.rowCatId],
      colCat: CATEGORY_BY_ID[s.colCatId],
      locked: s.locked,
      correct: s.correct,
      filled: s.filled,
    }));
  }

  function loadDailyState(diff) {
    try {
      const raw = localStorage.getItem(dailyKey(diff));
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.date !== todayStr() || !Array.isArray(data.cells) || data.cells.length !== 9) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveDailyState() {
    if (boardMode !== "daily") return;
    localStorage.setItem(dailyKey(difficulty), JSON.stringify({ date: todayStr(), cells: serializeCells() }));
  }

  function buildShareText() {
    const correct = cells.filter((c) => c.correct).length;
    let grid = "";
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) grid += cells[i * 3 + j].correct ? "🟩" : "🟥";
      grid += "\n";
    }
    return `Grid Mundialista (${DIFFICULTY_LABEL[difficulty]}) ${todayStr()}: ${correct}/9\n${grid.trim()}`;
  }

  function refreshShare() {
    const allLocked = cells.length === 9 && cells.every((c) => c.locked);
    if (boardMode === "daily" && allLocked) {
      shareTextEl.value = buildShareText();
      shareWrap.hidden = false;
    } else {
      shareWrap.hidden = true;
    }
  }

  shareBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(shareTextEl.value);
      shareBtn.textContent = "✅ Copiado";
      setTimeout(() => {
        shareBtn.textContent = "📋 Copiar resultado";
      }, 1500);
    } catch (e) {
      shareTextEl.focus();
      shareTextEl.select();
    }
  });

  function endGame() {
    const correct = cells.filter((c) => c.correct).length;
    resultEl.textContent =
      correct === 9 ? "¡Grilla perfecta! Completaste las 9 celdas." : `Terminaste la grilla: ${correct}/9 aciertos.`;
    resultEl.className = "guess-result " + (correct === 9 ? "win" : correct === 0 ? "lose" : "");
    const newBest = saveBestIfHigher(difficulty, correct);
    bestEl.textContent = `${newBest}/9`;
    refreshShare();
  }

  function buildCellsFrom(picked) {
    const out = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        out.push({ rowCat: picked.rows[i], colCat: picked.cols[j], filled: null, locked: false, correct: false });
      }
    }
    return out;
  }

  function startNewGrid() {
    activeCellIdx = null;

    if (boardMode === "daily") {
      const saved = loadDailyState(difficulty);
      if (saved) {
        cells = deserializeCells(saved);
      } else {
        const rng = seededRandom(`${todayStr()}|${difficulty}`);
        cells = buildCellsFrom(pickCategories(difficulty, rng));
        saveDailyState();
      }
      rows = [cells[0].rowCat, cells[1].rowCat, cells[2].rowCat];
      cols = [cells[0].colCat, cells[3].colCat, cells[6].colCat];
    } else {
      const picked = pickCategories(difficulty, Math.random);
      rows = picked.rows;
      cols = picked.cols;
      cells = buildCellsFrom(picked);
    }

    resultEl.textContent = "";
    resultEl.className = "guess-result";
    bestEl.textContent = `${loadBest(difficulty)}/9`;
    updateScore();
    renderBoard();
    refreshShare();
  }

  newBtn.addEventListener("click", startNewGrid);

  difficultyButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const diff = btn.dataset.gridDifficulty;
      if (diff === difficulty) return;
      difficulty = diff;
      difficultyButtons.forEach((b) => b.classList.toggle("active", b === btn));
      startNewGrid();
    });
  });

  modeRandomBtn.addEventListener("click", () => {
    if (boardMode === "random") return;
    boardMode = "random";
    modeRandomBtn.classList.add("active");
    modeDailyBtn.classList.remove("active");
    newBtn.hidden = false;
    startNewGrid();
  });

  modeDailyBtn.addEventListener("click", () => {
    if (boardMode === "daily") return;
    boardMode = "daily";
    modeDailyBtn.classList.add("active");
    modeRandomBtn.classList.remove("active");
    newBtn.hidden = true;
    startNewGrid();
  });

  function init() {
    if (initialized) return;
    initialized = true;
    pool = buildPool();
    uniqueNames = Array.from(new Set(pool.map((p) => p.name))).sort();
    startNewGrid();
  }

  document.addEventListener("gridmode:shown", init);
  if (!document.getElementById("app-grid").hidden) init();
})();
