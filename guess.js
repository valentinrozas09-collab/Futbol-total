(function () {
  const MAX_ATTEMPTS = 8;

  const editionPicker = document.getElementById("guess-edition-picker");
  const subtitleEl = document.getElementById("guess-subtitle");
  const form = document.getElementById("guess-form");
  const input = document.getElementById("guess-input");
  const suggestionsEl = document.getElementById("guess-suggestions");
  const tbody = document.getElementById("guess-tbody");
  const resultEl = document.getElementById("guess-result");
  const restartBtn = document.getElementById("btn-guess-restart");
  const hintBtn = document.getElementById("btn-hint");
  const hintsListEl = document.getElementById("hints-list");

  let currentEdition = null;
  let pool = [];
  let target = null;
  let attemptsUsed = 0;
  let guessedNames = new Set();
  let gameOver = false;
  let initialized = false;
  let editionLocked = false;
  let hintsRevealed = 0;
  let activeHints = [];
  let revealedHintTexts = [];
  const HINTS_PER_GAME = 5;

  function stripAccents(str) {
    return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function letterCount(name) {
    return stripAccents(name).replace(/[^a-zA-Z]/g, "").length;
  }

  function flagFor(team) {
    return (window.TEAM_FLAG && window.TEAM_FLAG[team]) || "🏳️";
  }

  function teamGroup(team) {
    const groups = window.WORLD_CUPS[currentEdition].groups;
    for (const letter of Object.keys(groups)) {
      if (groups[letter].includes(team)) return letter;
    }
    return "?";
  }

  const CONTINENT_BY_CONFEDERATION = {
    CONMEBOL: "Sudamérica",
    UEFA: "Europa",
    CAF: "África",
    AFC: "Asia",
    CONCACAF: "Norte/Centroamérica o el Caribe",
    OFC: "Oceanía",
  };

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function randomLetterHint(t) {
    const letters = stripAccents(t.name).replace(/[^a-zA-Z]/g, "");
    const idx = Math.floor(Math.random() * letters.length);
    return `La letra número ${idx + 1} de su nombre (sin contar espacios) es "${letters[idx].toUpperCase()}"`;
  }

  const HINT_POOL = [
    (t) => `Juega para ${flagFor(t.team)} ${t.team}`,
    (t) => `Su selección es de ${CONTINENT_BY_CONFEDERATION[window.TEAM_CONFEDERATION[t.team]] || "?"}`,
    (t) => `Su confederación es ${window.TEAM_CONFEDERATION[t.team]}`,
    (t) => `Está en el Grupo ${teamGroup(t.team)} del Mundial ${currentEdition}`,
    (t) => `Su nombre empieza con "${stripAccents(t.name).trim()[0].toUpperCase()}"`,
    (t) => `Su nombre tiene ${letterCount(t.name)} letras (sin contar espacios)`,
    (t) => `Su nombre completo tiene ${t.name.trim().split(/\s+/).length} palabra(s)`,
    randomLetterHint,
  ];

  function pickActiveHints() {
    return shuffle(HINT_POOL).slice(0, HINTS_PER_GAME);
  }

  function renderHints() {
    hintsListEl.innerHTML = "";
    for (const text of revealedHintTexts) {
      const li = document.createElement("li");
      li.textContent = text;
      hintsListEl.appendChild(li);
    }
    hintBtn.textContent = `💡 Pedir pista (${hintsRevealed}/${activeHints.length})`;
    hintBtn.disabled = gameOver || hintsRevealed >= activeHints.length;
  }

  function revealHint() {
    if (gameOver || hintsRevealed >= activeHints.length) return;
    revealedHintTexts.push(activeHints[hintsRevealed](target));
    hintsRevealed++;
    renderHints();
  }

  hintBtn.addEventListener("click", revealHint);

  function letterTiles(guessName, targetName) {
    const guessChars = guessName.split("");
    const guessNorm = stripAccents(guessName).toUpperCase().split("");
    const targetNorm = stripAccents(targetName).toUpperCase().split("");

    const freq = {};
    targetNorm.forEach((ch) => {
      if (/[A-Z]/.test(ch)) freq[ch] = (freq[ch] || 0) + 1;
    });

    const states = new Array(guessChars.length).fill(null);

    // 1ra pasada: aciertos exactos (misma letra, misma posición)
    guessNorm.forEach((ch, i) => {
      if (!/[A-Z]/.test(ch)) {
        states[i] = "space";
        return;
      }
      if (ch === targetNorm[i]) {
        states[i] = "hit";
        freq[ch]--;
      }
    });

    // 2da pasada: letra presente en otra posición
    guessNorm.forEach((ch, i) => {
      if (states[i]) return;
      if (freq[ch] > 0) {
        states[i] = "present";
        freq[ch]--;
      } else {
        states[i] = "absent";
      }
    });

    return guessChars.map((ch, i) => ({ char: ch, state: states[i] }));
  }

  function editionsWithPlayers() {
    return Object.keys(window.WORLD_CUPS)
      .filter((year) => {
        const players = window.WORLD_CUPS[year].players;
        return players && Object.keys(players).length > 0;
      })
      .sort();
  }

  function renderEditionPicker() {
    const allYears = Object.keys(window.WORLD_CUPS).sort();
    const available = new Set(editionsWithPlayers());
    editionPicker.innerHTML = "";
    for (const year of allYears) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill-btn";
      btn.textContent = year;
      if (year === String(currentEdition)) btn.classList.add("active");
      if (!available.has(year)) {
        btn.classList.add("disabled");
        btn.disabled = true;
        btn.title = "Todavía no hay jugadores cargados para este Mundial";
      } else if (editionLocked) {
        btn.classList.add("disabled");
        btn.disabled = true;
        btn.title = "Reiniciá la partida para cambiar de Mundial";
      } else {
        btn.addEventListener("click", () => changeEdition(year));
      }
      editionPicker.appendChild(btn);
    }
  }

  function changeEdition(year) {
    if (String(year) === String(currentEdition) || editionLocked) return;
    currentEdition = year;
    pool = buildPool();
    resetGame();
  }

  function buildPool() {
    const edition = window.WORLD_CUPS[currentEdition];
    const list = [];
    for (const team of edition.teams) {
      const players = (edition.players && edition.players[team]) || [];
      for (const name of players) list.push({ name, team });
    }
    return list;
  }

  function hideSuggestions() {
    suggestionsEl.hidden = true;
    suggestionsEl.innerHTML = "";
  }

  function renderSuggestions() {
    const filter = normalizeSearch(input.value.trim());
    if (!filter) {
      hideSuggestions();
      return;
    }
    const matches = pool
      .filter((p) => normalizeSearch(p.name).includes(filter) || normalizeSearch(p.team).includes(filter))
      .slice(0, 8);

    if (!matches.length) {
      hideSuggestions();
      return;
    }

    suggestionsEl.innerHTML = matches
      .map(
        (p) => `
        <li class="suggestion-item" data-name="${p.name.replace(/"/g, "&quot;")}">
          <span class="suggestion-flag">${flagFor(p.team)}</span>
          <span class="suggestion-name">${p.name}</span>
          <span class="suggestion-team">${p.team}</span>
        </li>`
      )
      .join("");
    suggestionsEl.hidden = false;
  }

  function normalizeSearch(str) {
    return stripAccents(str).toLowerCase();
  }

  suggestionsEl.addEventListener("click", (e) => {
    const item = e.target.closest(".suggestion-item");
    if (!item) return;
    input.value = item.dataset.name;
    hideSuggestions();
    input.focus();
  });

  input.addEventListener("input", renderSuggestions);
  input.addEventListener("focus", renderSuggestions);
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".guess-input-wrap")) hideSuggestions();
  });

  function pickTarget() {
    target = pool[Math.floor(Math.random() * pool.length)];
  }

  function resetGame() {
    attemptsUsed = 0;
    guessedNames = new Set();
    gameOver = false;
    editionLocked = false;
    hintsRevealed = 0;
    revealedHintTexts = [];
    activeHints = pickActiveHints();
    tbody.innerHTML = "";
    resultEl.textContent = "";
    resultEl.className = "guess-result";
    restartBtn.hidden = true;
    input.value = "";
    hideSuggestions();
    input.disabled = false;
    form.querySelector("button[type=submit]").disabled = false;
    const host = window.WORLD_CUPS[currentEdition].host;
    subtitleEl.innerHTML = `Mundial ${currentEdition} (${host}) — Tenés <strong id="guess-remaining">${MAX_ATTEMPTS}</strong> intentos`;
    renderEditionPicker();
    pickTarget();
    renderHints();
  }

  function findByName(name) {
    const norm = name.trim().toLowerCase();
    return pool.find((p) => p.name.toLowerCase() === norm) || null;
  }

  function renderRow(guess) {
    const tr = document.createElement("tr");

    const teamMatch = guess.team === target.team;
    const confGuess = window.TEAM_CONFEDERATION[guess.team];
    const confTarget = window.TEAM_CONFEDERATION[target.team];
    const confMatch = confGuess === confTarget;
    const groupGuess = teamGroup(guess.team);
    const groupTarget = teamGroup(target.team);
    const groupMatch = groupGuess === groupTarget;
    const initGuess = stripAccents(guess.name).trim()[0].toUpperCase();
    const initTarget = stripAccents(target.name).trim()[0].toUpperCase();
    const initMatch = initGuess === initTarget;
    const initArrow = initMatch ? "=" : initGuess < initTarget ? "↓" : "↑";
    const lenGuess = letterCount(guess.name);
    const lenTarget = letterCount(target.name);
    const lenMatch = lenGuess === lenTarget;
    const lenArrow = lenMatch ? "=" : lenGuess < lenTarget ? "↑" : "↓";

    const tiles = letterTiles(guess.name, target.name)
      .map((t) => `<span class="tile ${t.state}">${t.state === "space" ? "&nbsp;" : t.char}</span>`)
      .join("");

    tr.innerHTML = `
      <td>${flagFor(guess.team)} ${guess.name}</td>
      <td class="cell ${teamMatch ? "hit" : "miss"}">${guess.team}</td>
      <td class="cell ${confMatch ? "hit" : "miss"}">${confGuess}</td>
      <td class="cell ${groupMatch ? "hit" : "miss"}">${groupGuess}</td>
      <td class="cell ${initMatch ? "hit" : "miss"}">${initGuess} ${initArrow}</td>
      <td class="cell ${lenMatch ? "hit" : "miss"}">${lenGuess} ${lenArrow}</td>
      <td class="tiles-cell"><span class="tiles">${tiles}</span></td>
    `;
    tbody.prepend(tr);
  }

  function endGame(won) {
    gameOver = true;
    input.disabled = true;
    form.querySelector("button[type=submit]").disabled = true;
    restartBtn.hidden = false;
    hintBtn.disabled = true;
    if (won) {
      resultEl.textContent = `¡Correcto! Era ${target.name} (${target.team}).`;
      resultEl.className = "guess-result win";
    } else {
      resultEl.textContent = `Se acabaron los intentos. Era ${target.name} (${target.team}).`;
      resultEl.className = "guess-result lose";
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (gameOver) return;

    const raw = input.value;
    const guess = findByName(raw);
    if (!guess) {
      resultEl.textContent = `Ese jugador no está en la lista del Mundial ${currentEdition}.`;
      resultEl.className = "guess-result error";
      return;
    }
    if (guessedNames.has(guess.name)) {
      resultEl.textContent = "Ya probaste ese jugador.";
      resultEl.className = "guess-result error";
      return;
    }

    guessedNames.add(guess.name);
    renderRow(guess);
    input.value = "";
    hideSuggestions();
    resultEl.textContent = "";
    resultEl.className = "guess-result";

    if (!editionLocked) {
      editionLocked = true;
      renderEditionPicker();
    }

    if (guess.name === target.name) {
      endGame(true);
      return;
    }

    attemptsUsed++;
    document.getElementById("guess-remaining").textContent = String(MAX_ATTEMPTS - attemptsUsed);
    if (attemptsUsed >= MAX_ATTEMPTS) endGame(false);
  }

  function init() {
    if (initialized) return;
    initialized = true;
    currentEdition = editionsWithPlayers()[0] || Object.keys(window.WORLD_CUPS).sort()[0];
    pool = buildPool();
    resetGame();
    form.addEventListener("submit", handleSubmit);
    restartBtn.addEventListener("click", resetGame);
  }

  document.addEventListener("guessmode:shown", init);
  if (!document.getElementById("app-guess").hidden) init();
})();
