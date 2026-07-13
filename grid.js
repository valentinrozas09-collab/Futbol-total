(function () {
  const boardEl = document.getElementById("grid-board");
  const scoreEl = document.getElementById("grid-score");
  const resultEl = document.getElementById("grid-result");
  const newBtn = document.getElementById("btn-grid-new");

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

  let pool = [];
  let uniqueNames = [];
  let rows = [];
  let cols = [];
  let cells = []; // { rowCat, colCat, filled, locked, correct }
  let activeCellIdx = null;
  let initialized = false;

  function stripAccents(str) {
    return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function normalize(str) {
    return stripAccents(str).toLowerCase().trim();
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
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

  function cellHasSolution(rowCat, colCat) {
    return pool.some((p) => p.flags[rowCat.id] && p.flags[colCat.id]);
  }

  function pickCategories() {
    for (let attempt = 0; attempt < 80; attempt++) {
      const chosen = shuffle(CATEGORY_DEFS).slice(0, 6);
      const candidateRows = chosen.slice(0, 3);
      const candidateCols = chosen.slice(3, 6);
      let ok = true;
      for (const r of candidateRows) {
        for (const c of candidateCols) {
          if (!cellHasSolution(r, c)) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
      if (ok) return { rows: candidateRows, cols: candidateCols };
    }
    // combinación de respaldo, siempre soluble
    const byId = Object.fromEntries(CATEGORY_DEFS.map((c) => [c.id, c]));
    return {
      rows: [byId.gk, byId.df, byId.fw],
      cols: [byId.conmebol, byId.uefa, byId.elite],
    };
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

  function submitGuess(idx, typedName) {
    const cell = cells[idx];
    if (cell.locked || !typedName.trim()) return;

    const norm = normalize(typedName);
    const usedNames = new Set(cells.filter((c) => c.filled && c.correct).map((c) => normalize(c.filled.name)));
    if (usedNames.has(norm)) {
      const input = document.getElementById(`grid-input-${idx}`);
      if (input) input.placeholder = "Ya usaste a ese jugador";
      return;
    }

    const match = pool.find((p) => normalize(p.name) === norm && p.flags[cell.rowCat.id] && p.flags[cell.colCat.id]);
    cell.locked = true;
    activeCellIdx = null;

    if (match) {
      cell.filled = match;
      cell.correct = true;
    } else {
      cell.filled = { name: typedName.trim() };
      cell.correct = false;
    }

    renderBoard();
    updateScore();

    if (cells.every((c) => c.locked)) endGame();
  }

  function updateScore() {
    const correct = cells.filter((c) => c.correct).length;
    scoreEl.textContent = `${correct}/9`;
  }

  function endGame() {
    const correct = cells.filter((c) => c.correct).length;
    resultEl.textContent =
      correct === 9 ? "¡Grilla perfecta! Completaste las 9 celdas." : `Terminaste la grilla: ${correct}/9 aciertos.`;
    resultEl.className = "guess-result " + (correct === 9 ? "win" : correct === 0 ? "lose" : "");
  }

  function startNewGrid() {
    const picked = pickCategories();
    rows = picked.rows;
    cols = picked.cols;
    cells = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        cells.push({ rowCat: rows[i], colCat: cols[j], filled: null, locked: false, correct: false });
      }
    }
    activeCellIdx = null;
    resultEl.textContent = "";
    resultEl.className = "guess-result";
    updateScore();
    renderBoard();
  }

  newBtn.addEventListener("click", startNewGrid);

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
