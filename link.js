(function () {
  const stepsEl = document.getElementById("link-steps");
  const mistakesEl = document.getElementById("link-mistakes");
  const hintsEl = document.getElementById("link-hints");
  const targetEl = document.getElementById("link-target-team");
  const chainEl = document.getElementById("link-chain");
  const form = document.getElementById("link-form");
  const input = document.getElementById("link-input");
  const suggestionsEl = document.getElementById("link-suggestions");
  const hintBtn = document.getElementById("btn-link-hint");
  const resultEl = document.getElementById("link-result");
  const newBtn = document.getElementById("btn-link-new");

  const MAX_HINTS = 3;

  let graph = {};
  let teams = [];
  let chain = [];
  let target = null;
  let optimalLength = 0;
  let mistakes = 0;
  let hintsLeft = MAX_HINTS;
  let gameOver = false;
  let initialized = false;

  function stripAccents(str) {
    return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function normalize(str) {
    return stripAccents(str).toLowerCase().trim();
  }

  function flagFor(team) {
    return (window.TEAM_FLAG && window.TEAM_FLAG[team]) || "🏳️";
  }

  function buildGraph() {
    const g = {};
    for (const year of Object.keys(window.WORLD_CUPS)) {
      const groups = window.WORLD_CUPS[year].groups;
      for (const letter of Object.keys(groups)) {
        const groupTeams = groups[letter];
        for (const a of groupTeams) {
          g[a] = g[a] || new Set();
          for (const b of groupTeams) {
            if (a !== b) g[a].add(b);
          }
        }
      }
    }
    return g;
  }

  function shortestPath(start, end) {
    if (start === end) return [start];
    const visited = new Set([start]);
    const queue = [[start]];
    while (queue.length) {
      const path = queue.shift();
      const node = path[path.length - 1];
      for (const neighbor of graph[node] || []) {
        if (visited.has(neighbor)) continue;
        const newPath = path.concat(neighbor);
        if (neighbor === end) return newPath;
        visited.add(neighbor);
        queue.push(newPath);
      }
    }
    return null;
  }

  function pickPuzzle() {
    for (let attempt = 0; attempt < 300; attempt++) {
      const start = teams[Math.floor(Math.random() * teams.length)];
      const end = teams[Math.floor(Math.random() * teams.length)];
      if (start === end) continue;
      const path = shortestPath(start, end);
      if (path && path.length >= 4 && path.length <= 7) {
        return { start, end, optimalLength: path.length - 1 };
      }
    }
    const start = teams[0];
    const end = teams.find((t) => t !== start) || teams[0];
    const path = shortestPath(start, end);
    return { start, end, optimalLength: path ? path.length - 1 : 1 };
  }

  function renderStats() {
    stepsEl.textContent = String(chain.length - 1);
    mistakesEl.textContent = String(mistakes);
    hintsEl.textContent = String(hintsLeft);
    hintBtn.disabled = hintsLeft <= 0 || gameOver;
  }

  function renderChain() {
    chainEl.innerHTML = chain
      .map((team, idx) => {
        const arrow = idx > 0 ? '<span class="link-chain-arrow">→</span>' : "";
        const reached = gameOver && team === target ? " reached" : "";
        return `${arrow}<span class="link-chain-item${reached}">${flagFor(team)} ${team}</span>`;
      })
      .join("");
  }

  function hideSuggestions() {
    suggestionsEl.hidden = true;
    suggestionsEl.innerHTML = "";
  }

  function renderSuggestions() {
    const filter = normalize(input.value);
    if (!filter) {
      hideSuggestions();
      return;
    }
    const matches = teams.filter((t) => normalize(t).includes(filter)).slice(0, 8);
    if (!matches.length) {
      hideSuggestions();
      return;
    }
    suggestionsEl.innerHTML = matches
      .map(
        (t) => `
        <li class="suggestion-item" data-name="${t.replace(/"/g, "&quot;")}">
          <span class="suggestion-flag">${flagFor(t)}</span>
          <span class="suggestion-name">${t}</span>
        </li>`
      )
      .join("");
    suggestionsEl.hidden = false;
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

  function showMessage(text, cls) {
    resultEl.textContent = text;
    resultEl.className = "guess-result " + (cls || "");
  }

  function endGame() {
    gameOver = true;
    input.disabled = true;
    form.querySelector("button[type=submit]").disabled = true;
    hintBtn.disabled = true;
    renderChain();
    showMessage(`¡Llegaste a ${target} en ${chain.length - 1} pasos! (camino más corto: ${optimalLength})`, "win");
  }

  function afterMove() {
    renderStats();
    renderChain();
    if (chain[chain.length - 1] === target) endGame();
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (gameOver) return;

    const raw = input.value;
    const match = teams.find((t) => normalize(t) === normalize(raw));
    input.value = "";
    hideSuggestions();

    if (!match) {
      showMessage("Esa selección no jugó ningún Mundial de esta base de datos.", "error");
      return;
    }
    if (chain.includes(match)) {
      showMessage("Esa selección ya está en tu cadena.", "error");
      return;
    }
    const current = chain[chain.length - 1];
    if (!graph[current] || !graph[current].has(match)) {
      mistakes++;
      showMessage(`${match} no compartió grupo con ${current} en ningún Mundial.`, "error");
      renderStats();
      return;
    }

    chain.push(match);
    showMessage("", "");
    afterMove();
  }

  form.addEventListener("submit", handleSubmit);

  function useHint() {
    if (hintsLeft <= 0 || gameOver) return;
    const current = chain[chain.length - 1];
    const path = shortestPath(current, target);
    if (!path || path.length < 2) return;
    chain.push(path[1]);
    hintsLeft--;
    afterMove();
  }

  hintBtn.addEventListener("click", useHint);

  function startRound() {
    const puzzle = pickPuzzle();
    chain = [puzzle.start];
    target = puzzle.end;
    optimalLength = puzzle.optimalLength;
    mistakes = 0;
    hintsLeft = MAX_HINTS;
    gameOver = false;
    input.disabled = false;
    input.value = "";
    hideSuggestions();
    form.querySelector("button[type=submit]").disabled = false;
    targetEl.textContent = `${flagFor(target)} ${target}`;
    showMessage("", "");
    renderStats();
    renderChain();
  }

  newBtn.addEventListener("click", startRound);

  function init() {
    if (initialized) return;
    initialized = true;
    graph = buildGraph();
    teams = Object.keys(graph).sort();
    startRound();
  }

  document.addEventListener("linkmode:shown", init);
  if (!document.getElementById("app-link").hidden) init();
})();
