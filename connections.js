(function () {
  const boardEl = document.getElementById("connections-board");
  const solvedEl = document.getElementById("connections-solved");
  const mistakesEl = document.getElementById("connections-mistakes");
  const messageEl = document.getElementById("connections-message");
  const subtitleEl = document.getElementById("connections-subtitle");
  const submitBtn = document.getElementById("btn-connections-submit");
  const shuffleBtn = document.getElementById("btn-connections-shuffle");
  const deselectBtn = document.getElementById("btn-connections-deselect");
  const newBtn = document.getElementById("btn-connections-new");

  const GROUP_COLORS = ["c1", "c2", "c3", "c4"];
  const MAX_MISTAKES = 4;

  let tiles = [];
  let selected = [];
  let solvedGroups = [];
  let mistakesLeft = MAX_MISTAKES;
  let gameOver = false;
  let initialized = false;

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function flagFor(team) {
    return (window.TEAM_FLAG && window.TEAM_FLAG[team]) || "🏳️";
  }

  function buildRound() {
    const years = Object.keys(window.WORLD_CUPS);
    const year = years[Math.floor(Math.random() * years.length)];
    const edition = window.WORLD_CUPS[year];
    const letters = shuffle(Object.keys(edition.groups)).slice(0, 4);

    const roundTiles = [];
    for (const letter of letters) {
      const teams = edition.groups[letter];
      const candidates = [];
      for (const team of teams) {
        const players = (edition.players && edition.players[team]) || [];
        for (const name of players) candidates.push({ name, team });
      }
      const picked = shuffle(candidates).slice(0, 4);
      for (const p of picked) roundTiles.push({ name: p.name, team: p.team, groupLetter: letter, year, flash: null });
    }
    return shuffle(roundTiles);
  }

  function renderStats() {
    mistakesEl.textContent = String(mistakesLeft);
  }

  function renderSolved() {
    solvedEl.innerHTML = solvedGroups
      .map(
        (g) => `
        <div class="connections-solved-row ${g.color}">
          <div class="connections-solved-label">Grupo ${g.letter} — Mundial ${g.year}</div>
          <div class="connections-solved-players">${g.tiles.map((t) => `${flagFor(t.team)} ${t.name}`).join(" · ")}</div>
        </div>`
      )
      .join("");
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    for (const tile of tiles) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "connections-tile" +
        (selected.includes(tile) ? " selected" : "") +
        (tile.flash ? ` flash-${tile.flash}` : "");
      btn.innerHTML = `<span class="connections-tile-flag">${flagFor(tile.team)}</span><span class="connections-tile-name">${tile.name}</span>`;
      btn.disabled = gameOver;
      btn.addEventListener("click", () => toggleTile(tile));
      boardEl.appendChild(btn);
    }
    submitBtn.disabled = selected.length !== 4 || gameOver;
  }

  function toggleTile(tile) {
    if (gameOver) return;
    const idx = selected.indexOf(tile);
    if (idx >= 0) selected.splice(idx, 1);
    else if (selected.length < 4) selected.push(tile);
    renderBoard();
  }

  function endGame(won) {
    gameOver = true;
    if (!won) {
      const remainingByLetter = {};
      for (const t of tiles) {
        remainingByLetter[t.groupLetter] = remainingByLetter[t.groupLetter] || [];
        remainingByLetter[t.groupLetter].push(t);
      }
      for (const letter of Object.keys(remainingByLetter)) {
        const group = remainingByLetter[letter];
        solvedGroups.push({ letter, year: group[0].year, color: GROUP_COLORS[solvedGroups.length] || "c4", tiles: group });
      }
      tiles = [];
      renderSolved();
    }
    messageEl.textContent = won
      ? `¡Ganaste con ${mistakesLeft} errores de margen!`
      : "Se acabaron los intentos. Se revelaron los grupos.";
    messageEl.className = "guess-result " + (won ? "win" : "lose");
    renderBoard();
  }

  function submitSelection() {
    if (selected.length !== 4 || gameOver) return;
    const letters = selected.map((t) => t.groupLetter);
    const allSame = letters.every((l) => l === letters[0]);

    if (allSame) {
      const [t0] = selected;
      solvedGroups.push({
        letter: t0.groupLetter,
        year: t0.year,
        color: GROUP_COLORS[solvedGroups.length],
        tiles: selected.slice(),
      });
      tiles = tiles.filter((t) => !selected.includes(t));
      selected = [];
      messageEl.textContent = "";
      messageEl.className = "guess-result";
      renderSolved();
      if (tiles.length === 0) {
        endGame(true);
        return;
      }
    } else {
      const counts = {};
      letters.forEach((l) => (counts[l] = (counts[l] || 0) + 1));
      const closeCall = Object.values(counts).some((c) => c === 3);
      mistakesLeft--;
      messageEl.textContent = closeCall ? "¡Cerca! Tres de las cuatro fichas van juntas." : "Ese grupo no es correcto.";
      messageEl.className = "guess-result error";
      selected.forEach((t) => (t.flash = "wrong"));
      renderBoard();
      const toClear = selected.slice();
      selected = [];
      setTimeout(() => {
        toClear.forEach((t) => (t.flash = null));
        renderBoard();
      }, 700);
      if (mistakesLeft <= 0) {
        endGame(false);
        return;
      }
    }
    renderStats();
    renderBoard();
  }

  function startRound() {
    tiles = buildRound();
    selected = [];
    solvedGroups = [];
    mistakesLeft = MAX_MISTAKES;
    gameOver = false;
    messageEl.textContent = "";
    messageEl.className = "guess-result";
    subtitleEl.textContent = "Agrupá de a 4 los jugadores que compartieron grupo en un Mundial";
    renderStats();
    renderSolved();
    renderBoard();
  }

  submitBtn.addEventListener("click", submitSelection);
  shuffleBtn.addEventListener("click", () => {
    tiles = shuffle(tiles);
    renderBoard();
  });
  deselectBtn.addEventListener("click", () => {
    selected = [];
    renderBoard();
  });
  newBtn.addEventListener("click", startRound);

  function init() {
    if (initialized) return;
    initialized = true;
    startRound();
  }

  document.addEventListener("connectionsmode:shown", init);
  if (!document.getElementById("app-connections").hidden) init();
})();
