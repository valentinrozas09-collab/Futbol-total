(function () {
  const SQUAD_SIZE = 11;
  const KNOCKOUT_STAGES = [
    { key: "R16", label: "Octavos de Final" },
    { key: "QF", label: "Cuartos de Final" },
    { key: "SF", label: "Semifinal" },
    { key: "F", label: "Final" },
  ];
  const YOUR_TEAM_LABEL = "Tu Equipo";

  const FORMATIONS = {
    "4-3-3": { GK: 1, DF: 4, MF: 3, FW: 3 },
    "4-4-2": { GK: 1, DF: 4, MF: 4, FW: 2 },
    "4-5-1": { GK: 1, DF: 4, MF: 5, FW: 1 },
    "5-4-1": { GK: 1, DF: 5, MF: 4, FW: 1 },
  };
  const POSITION_LABEL = { GK: "Arqueros", DF: "Defensores", MF: "Mediocampistas", FW: "Delanteros" };
  const POSITION_ORDER = ["GK", "DF", "MF", "FW"];

  const difficultyPicker = document.getElementById("difficulty-picker");
  const editionList = document.getElementById("edition-list");
  const formationList = document.getElementById("formation-list");
  const positionNeeds = document.getElementById("position-needs");

  const draftModeWheelBtn = document.getElementById("draft-mode-wheel");
  const draftModeManualBtn = document.getElementById("draft-mode-manual");
  const wheelPanel = document.getElementById("draft-wheel-panel");
  const manualPanel = document.getElementById("draft-manual-panel");
  const manualFilter = document.getElementById("manual-filter");
  const manualPlayerList = document.getElementById("manual-player-list");

  const wheel = document.getElementById("wheel");
  const btnSpin = document.getElementById("btn-spin");
  const wheelTeamPick = document.getElementById("wheel-team-pick");
  const wheelTeamName = document.getElementById("wheel-team-name");
  const wheelTeamFilter = document.getElementById("wheel-team-filter");
  const wheelTeamPlayers = document.getElementById("wheel-team-players");
  const btnPlay = document.getElementById("btn-play");
  const squadCount = document.getElementById("squad-count");
  const squadList = document.getElementById("squad-list");
  const btnAiComplete = document.getElementById("btn-ai-complete");
  const btnIdealSquad = document.getElementById("btn-ideal-squad");

  const matchPhaseTitle = document.getElementById("match-phase-title");
  const matchPhaseSubtitle = document.getElementById("match-phase-subtitle");
  const groupTableWrap = document.getElementById("group-table-wrap");
  const groupTableBody = document.getElementById("group-table-body");
  const scoreYou = document.getElementById("score-you");
  const scoreOpp = document.getElementById("score-opp");
  const opponentName = document.getElementById("opponent-name");
  const matchPreview = document.getElementById("match-preview");
  const roundTracker = document.getElementById("round-tracker");
  const btnNextMatch = document.getElementById("btn-next-match");
  const matchLog = document.getElementById("match-log");

  const resultTitle = document.getElementById("result-title");
  const resultText = document.getElementById("result-text");
  const btnRestart = document.getElementById("btn-restart");

  let edition = null;
  let editionYear = null;
  let pool = [];
  let squad = [];
  let wheelRotation = 0;
  let spinTeam = null;
  let formationKey = null;
  let requiredCounts = null; // null => sin restricción de posición (edición sin datos de posición)
  let aiDifficulty = "normal"; // "easy" | "normal" | "hard"

  // Estado del torneo
  let phase = null; // "group" | "knockout"
  let groupTeams = []; // [{name, isYou, pts, pj, g, e, p, gf, gc}]
  let groupSchedule = []; // [{you: oppName, otherA, otherB}] una entrada por jornada
  let groupMatchIndex = 0; // próxima jornada a jugar (0..2)
  let knockoutIndex = 0; // índice en KNOCKOUT_STAGES
  let facedTeams = new Set();
  let record = { wins: 0, draws: 0, losses: 0 };

  function showScreen(id) {
    document.querySelectorAll("#app-draft .screen").forEach((s) => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  }

  function flagFor(team) {
    return (window.TEAM_FLAG && window.TEAM_FLAG[team]) || "🏳️";
  }

  function normalize(str) {
    return str.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  // ---------- Dificultad de la IA rival ----------

  difficultyPicker.querySelectorAll("button[data-difficulty]").forEach((btn) => {
    btn.addEventListener("click", () => {
      aiDifficulty = btn.dataset.difficulty;
      difficultyPicker.querySelectorAll("button[data-difficulty]").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  // ---------- Edición ----------

  function buildEditionCards() {
    const years = Object.keys(window.WORLD_CUPS).sort();
    editionList.innerHTML = "";
    for (const year of years) {
      const data = window.WORLD_CUPS[year];
      const card = document.createElement("div");
      card.className = "edition-card";
      card.innerHTML = `<div class="year">${year}</div><div class="host">${data.host}</div>`;
      card.addEventListener("click", () => selectEdition(year));
      editionList.appendChild(card);
    }
  }

  function buildPool() {
    const list = [];
    for (const team of edition.teams) {
      const players = (edition.players && edition.players[team]) || [];
      if (players.length) {
        for (const name of players) list.push({ name, team });
      } else {
        list.push({ name: team, team }); // sin plantilla cargada: usamos el país como placeholder
      }
    }
    return list;
  }

  function hasPositionData() {
    return !!(edition.positions && Object.keys(edition.positions).length > 0);
  }

  function positionOf(player) {
    if (!edition.positions) return null;
    const teamMap = edition.positions[player.team];
    return (teamMap && teamMap[player.name]) || null;
  }

  function hashPower(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return 55 + (h % 40); // 55-94
  }

  function ratingOf(player) {
    if (window.playerRating) return window.playerRating(editionYear, player.team, player.name);
    return hashPower(player.name);
  }

  function ratingTier(rating) {
    if (rating >= 90) return "tier-elite";
    if (rating >= 80) return "tier-great";
    return "";
  }

  function ratingBadge(player) {
    const rating = ratingOf(player);
    return `<span class="rating-badge ${ratingTier(rating)}">${rating}</span>`;
  }

  function selectEdition(year) {
    editionYear = year;
    edition = window.WORLD_CUPS[year];
    pool = buildPool();
    squad = [];
    spinTeam = null;
    formationKey = null;
    requiredCounts = null;
    wheelTeamPick.hidden = true;
    wheel.textContent = "";

    if (hasPositionData()) {
      buildFormationCards();
      showScreen("screen-formation");
    } else {
      setDraftMode("wheel");
      renderSquad();
      renderManualList();
      showScreen("screen-draft");
    }
  }

  // ---------- Formación ----------

  function buildFormationCards() {
    formationList.innerHTML = "";
    for (const key of Object.keys(FORMATIONS)) {
      const counts = FORMATIONS[key];
      const card = document.createElement("div");
      card.className = "edition-card";
      card.innerHTML = `
        <div class="year">${key}</div>
        <div class="host">${counts.GK} Arq · ${counts.DF} Def · ${counts.MF} Med · ${counts.FW} Del</div>
      `;
      card.addEventListener("click", () => selectFormation(key));
      formationList.appendChild(card);
    }
  }

  function selectFormation(key) {
    formationKey = key;
    requiredCounts = { ...FORMATIONS[key] };
    squad = [];
    spinTeam = null;
    wheelTeamPick.hidden = true;
    wheel.textContent = "";
    setDraftMode("wheel");
    renderSquad();
    renderManualList();
    showScreen("screen-draft");
  }

  function filledCounts() {
    const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
    for (const p of squad) {
      const pos = positionOf(p);
      if (pos && counts[pos] !== undefined) counts[pos]++;
    }
    return counts;
  }

  function needsPosition(pos) {
    if (!requiredCounts) return true;
    if (!pos || requiredCounts[pos] === undefined) return false;
    return filledCounts()[pos] < requiredCounts[pos];
  }

  function canAddPlayer(player) {
    if (squad.length >= SQUAD_SIZE) return false;
    if (!requiredCounts) return true;
    return needsPosition(positionOf(player));
  }

  function renderPositionNeeds() {
    if (!requiredCounts) {
      positionNeeds.innerHTML = "";
      return;
    }
    const filled = filledCounts();
    positionNeeds.innerHTML = POSITION_ORDER.map((pos) => {
      const done = filled[pos] >= requiredCounts[pos];
      return `<span class="need-pill ${done ? "done" : ""}">${POSITION_LABEL[pos]}: ${filled[pos]}/${requiredCounts[pos]}</span>`;
    }).join("");
  }

  // ---------- Draft: ruleta y selección manual ----------

  function setDraftMode(mode) {
    const wheelMode = mode === "wheel";
    wheelPanel.hidden = !wheelMode;
    manualPanel.hidden = wheelMode;
    draftModeWheelBtn.classList.toggle("active", wheelMode);
    draftModeManualBtn.classList.toggle("active", !wheelMode);
  }

  draftModeWheelBtn.addEventListener("click", () => setDraftMode("wheel"));
  draftModeManualBtn.addEventListener("click", () => setDraftMode("manual"));

  function isInSquad(player) {
    return squad.some((s) => s.name === player.name && s.team === player.team);
  }

  function renderManualList() {
    const filter = normalize(manualFilter.value.trim());
    manualPlayerList.innerHTML = "";
    const filtered = pool.filter(
      (p) => !filter || normalize(p.name).includes(filter) || normalize(p.team).includes(filter)
    );
    for (const p of filtered) {
      const row = document.createElement("div");
      row.className = "manual-row";
      const added = isInSquad(p);
      const pos = positionOf(p);
      const disabled = !added && !canAddPlayer(p);
      row.innerHTML = `
        <span class="manual-name">${ratingBadge(p)}${pos ? `<span class="pos-badge">${pos}</span>` : ""}${p.name}</span>
        <span class="manual-team">${p.team}</span>
        <button type="button" class="btn-mini ${added ? "added" : ""}" ${disabled ? "disabled" : ""}>${added ? "Quitar" : "Agregar"}</button>
      `;
      row.querySelector("button").addEventListener("click", () => {
        if (isInSquad(p)) {
          removeFromSquad(p);
        } else if (canAddPlayer(p)) {
          squad.push(p);
        }
        renderSquad();
        renderManualList();
      });
      manualPlayerList.appendChild(row);
    }
  }

  manualFilter.addEventListener("input", renderManualList);

  function removeFromSquad(player) {
    squad = squad.filter((s) => !(s.name === player.name && s.team === player.team));
  }

  function renderSquad() {
    squadCount.textContent = `(${squad.length}/${SQUAD_SIZE})`;
    squadList.innerHTML = "";
    for (const p of squad) {
      const pos = positionOf(p);
      const li = document.createElement("li");
      li.innerHTML = `<span>${ratingBadge(p)}${pos ? `<span class="pos-badge">${pos}</span> ` : ""}${p.name} <span class="player-team">(${p.team})</span></span>`;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-mini";
      removeBtn.textContent = "Quitar";
      removeBtn.addEventListener("click", () => {
        removeFromSquad(p);
        renderSquad();
        renderManualList();
      });
      li.appendChild(removeBtn);
      squadList.appendChild(li);
    }
    btnPlay.disabled = squad.length < SQUAD_SIZE;
    btnSpin.disabled = squad.length >= SQUAD_SIZE;
    btnAiComplete.disabled = squad.length >= SQUAD_SIZE;
    renderPositionNeeds();
  }

  // ---------- Asistente de armado con IA ----------

  function bestAvailableByPosition(pos) {
    return pool
      .filter((p) => !isInSquad(p) && positionOf(p) === pos)
      .sort((a, b) => ratingOf(b) - ratingOf(a));
  }

  function aiCompleteSquad() {
    if (squad.length >= SQUAD_SIZE) return;

    if (!requiredCounts) {
      const candidates = pool.filter((p) => !isInSquad(p)).sort((a, b) => ratingOf(b) - ratingOf(a));
      squad.push(...candidates.slice(0, SQUAD_SIZE - squad.length));
    } else {
      for (const pos of POSITION_ORDER) {
        while (needsPosition(pos) && squad.length < SQUAD_SIZE) {
          const candidates = bestAvailableByPosition(pos);
          if (!candidates.length) break;
          squad.push(candidates[0]);
        }
      }
      // por si algún puesto se quedó sin jugadores disponibles, completa con los mejores restantes
      while (squad.length < SQUAD_SIZE) {
        const candidates = pool.filter((p) => !isInSquad(p) && canAddPlayer(p)).sort((a, b) => ratingOf(b) - ratingOf(a));
        if (!candidates.length) break;
        squad.push(candidates[0]);
      }
    }

    wheelTeamPick.hidden = true;
    spinTeam = null;
    renderSquad();
    renderManualList();
  }

  function buildIdealSquad() {
    if (squad.length && !confirm("Esto reemplaza tu plantel actual por el equipo ideal de la edición. ¿Continuar?")) {
      return;
    }

    if (!requiredCounts) {
      squad = [...pool].sort((a, b) => ratingOf(b) - ratingOf(a)).slice(0, SQUAD_SIZE);
    } else {
      const chosen = [];
      for (const pos of POSITION_ORDER) {
        const need = requiredCounts[pos] || 0;
        const candidates = pool.filter((p) => positionOf(p) === pos).sort((a, b) => ratingOf(b) - ratingOf(a));
        chosen.push(...candidates.slice(0, need));
      }
      squad = chosen;
    }

    wheelTeamPick.hidden = true;
    spinTeam = null;
    renderSquad();
    renderManualList();
  }

  btnAiComplete.addEventListener("click", aiCompleteSquad);
  btnIdealSquad.addEventListener("click", buildIdealSquad);

  function teamHasPickablePlayers(team) {
    return pool.some((p) => p.team === team && !isInSquad(p) && canAddPlayer(p));
  }

  function spinWheel() {
    if (squad.length >= SQUAD_SIZE) return;
    btnSpin.disabled = true;
    wheelTeamPick.hidden = true;

    const availableTeams = edition.teams.filter(teamHasPickablePlayers);
    if (!availableTeams.length) {
      wheel.textContent = "Sin jugadores disponibles";
      btnSpin.disabled = squad.length >= SQUAD_SIZE;
      return;
    }
    const winnerTeam = availableTeams[Math.floor(Math.random() * availableTeams.length)];

    wheelRotation += 1080 + Math.floor(Math.random() * 720);
    wheel.style.transform = `rotate(${wheelRotation}deg)`;
    wheel.textContent = "…";

    setTimeout(() => {
      spinTeam = winnerTeam;
      wheel.textContent = `${flagFor(winnerTeam)} ${winnerTeam}`;
      showTeamPicker(winnerTeam);
    }, 2200);
  }

  function showTeamPicker(team) {
    wheelTeamName.textContent = `${flagFor(team)} ${team}`;
    wheelTeamFilter.value = "";
    renderTeamPickerList(team);
    wheelTeamPick.hidden = false;
  }

  function renderTeamPickerList(team) {
    const filter = normalize(wheelTeamFilter.value.trim());
    const players = pool.filter(
      (p) => p.team === team && !isInSquad(p) && canAddPlayer(p) && (!filter || normalize(p.name).includes(filter))
    );
    wheelTeamPlayers.innerHTML = "";
    if (!players.length) {
      const msg = document.createElement("p");
      msg.className = "subtitle";
      msg.textContent = "No hay jugadores disponibles en las posiciones que necesitás. Girá de nuevo.";
      wheelTeamPlayers.appendChild(msg);
      return;
    }
    for (const p of players) {
      const pos = positionOf(p);
      const row = document.createElement("div");
      row.className = "manual-row";
      row.innerHTML = `
        <span class="manual-name">${ratingBadge(p)}${pos ? `<span class="pos-badge">${pos}</span>` : ""}${p.name}</span>
        <button type="button" class="btn-mini">Elegir</button>
      `;
      row.querySelector("button").addEventListener("click", () => {
        squad.push(p);
        wheelTeamPick.hidden = true;
        spinTeam = null;
        renderSquad();
        renderManualList();
      });
      wheelTeamPlayers.appendChild(row);
    }
  }

  wheelTeamFilter.addEventListener("input", () => {
    if (spinTeam) renderTeamPickerList(spinTeam);
  });

  btnSpin.addEventListener("click", spinWheel);

  // ---------- Rival con IA: arma su propio plantel y juega con ataque/defensa reales ----------

  const AI_DEFAULT_FORMATION = { GK: 1, DF: 4, MF: 3, FW: 3 };

  // Cuánto se desvía la IA del mejor 11 objetivo al armar un plantel: 0 = siempre el mejor
  // posible, valores más altos = elige al azar dentro de una ventana de candidatos más floja.
  const DIFFICULTY_NOISE = { easy: 3, normal: 1, hard: 0 };

  // Cuánto pesa el rating de un equipo al sortear rivales: 0 = totalmente al azar,
  // valores más altos = favorece selecciones fuertes. Sube en cada ronda eliminatoria.
  const DIFFICULTY_BASE_POWER = { easy: 0, normal: 1, hard: 2 };
  const KNOCKOUT_POWER_STEP = 0.75;

  // A partir de qué déficit (en puntos de rating) respecto a tu propio promedio la IA
  // considera que una línea tuya es "débil" y vale la pena explotarla.
  const ADAPT_THRESHOLD = { easy: Infinity, normal: 6, hard: 3 };

  // Escalones de formación según qué tan débil es tu línea más floja (más déficit = más carga).
  const TIERS_VS_WEAK_DEF = [
    { min: 3, counts: { GK: 1, DF: 4, MF: 2, FW: 4 }, label: "adelantó líneas para aprovechar tu defensa floja" },
    { min: 6, counts: { GK: 1, DF: 3, MF: 3, FW: 4 }, label: "cargó de delanteros para aprovechar tu defensa floja" },
    { min: 9, counts: { GK: 1, DF: 2, MF: 3, FW: 5 }, label: "apostó todo al ataque para explotar tu defensa" },
  ];
  const TIERS_VS_WEAK_MID = [
    { min: 3, counts: { GK: 1, DF: 4, MF: 4, FW: 2 }, label: "sumó un mediocampista para dominar la posesión" },
    { min: 6, counts: { GK: 1, DF: 4, MF: 5, FW: 1 }, label: "reforzó el mediocampo para dominar la posesión" },
    { min: 9, counts: { GK: 1, DF: 3, MF: 6, FW: 1 }, label: "abarrotó el mediocampo para ahogarte la salida" },
  ];
  const TIERS_VS_WEAK_FW = [
    { min: 3, counts: { GK: 1, DF: 4, MF: 3, FW: 3 }, label: null },
    { min: 6, counts: { GK: 1, DF: 3, MF: 4, FW: 3 }, label: "adelantó un defensor porque tu ataque no preocupa" },
    { min: 9, counts: { GK: 1, DF: 3, MF: 3, FW: 4 }, label: "jugó con línea alta porque tu ataque no preocupa" },
  ];

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function avgRating(players) {
    if (!players || !players.length) return 70;
    return players.reduce((sum, p) => sum + ratingOf(p), 0) / players.length;
  }

  function lineAvg(players, cats) {
    const rel = players.filter((p) => cats.includes(positionOf(p)));
    if (!rel.length) return null;
    return rel.reduce((sum, p) => sum + ratingOf(p), 0) / rel.length;
  }

  function attackRating(players) {
    const specific = lineAvg(players, ["FW", "MF"]);
    return specific != null ? specific : avgRating(players);
  }

  function defenseRating(players) {
    const specific = lineAvg(players, ["GK", "DF"]);
    return specific != null ? specific : avgRating(players);
  }

  // Compara cada línea de tu plantel contra tu propio promedio para encontrar tu punto más
  // flojo (defensa, medio o ataque) y con qué intensidad conviene explotarlo.
  function analyzeUserWeakness() {
    if (!hasPositionData() || !squad.length) return null;
    const def = lineAvg(squad, ["GK", "DF"]);
    const mid = lineAvg(squad, ["MF"]);
    const fw = lineAvg(squad, ["FW"]);
    if (def == null || mid == null || fw == null) return null;
    const overall = (def + mid + fw) / 3;
    return { def: def - overall, mid: mid - overall, fw: fw - overall };
  }

  // Elige la formación del rival según difficulty: en fácil siempre usa la formación
  // pareja; en normal/difícil detecta tu línea más floja y carga la formación en su
  // contra, con un escalón más agresivo cuanto mayor es el déficit.
  function pickAdaptiveFormation(difficulty) {
    const threshold = ADAPT_THRESHOLD[difficulty];
    const deviations = analyzeUserWeakness();
    if (!deviations || threshold === Infinity) return { counts: AI_DEFAULT_FORMATION, reason: null };

    const candidates = [
      { key: "def", dev: deviations.def, tiers: TIERS_VS_WEAK_DEF },
      { key: "mid", dev: deviations.mid, tiers: TIERS_VS_WEAK_MID },
      { key: "fw", dev: deviations.fw, tiers: TIERS_VS_WEAK_FW },
    ];
    const weakest = candidates.reduce((a, b) => (b.dev < a.dev ? b : a));
    const deficit = -weakest.dev;
    if (deficit < threshold) return { counts: AI_DEFAULT_FORMATION, reason: null };

    let chosenTier = weakest.tiers[0];
    for (const tier of weakest.tiers) {
      if (deficit >= tier.min) chosenTier = tier;
    }
    return { counts: chosenTier.counts, reason: chosenTier.label };
  }

  // Toma un jugador (o varios) de una lista ya ordenada por rating: con ruido 0 siempre
  // el mejor disponible; con ruido > 0 sortea dentro de una ventana de candidatos más
  // amplia, simulando una IA que no siempre arma el 11 óptimo.
  function pickWithNoise(sortedCandidates, need, difficulty) {
    if (need <= 0) return [];
    const noise = DIFFICULTY_NOISE[difficulty] ?? DIFFICULTY_NOISE.normal;
    if (noise <= 0) return sortedCandidates.slice(0, need);
    const windowSize = Math.min(sortedCandidates.length, need + noise * need);
    return shuffle(sortedCandidates.slice(0, windowSize)).slice(0, need);
  }

  // Arma el 11 real de un seleccionado según la formación y la dificultad pedidas:
  // toma jugadores de mayor rating por posición (con margen de error según dificultad).
  function aiSquadFor(teamName, formationCounts, difficulty) {
    const teamPlayers = (edition.players && edition.players[teamName]) || [];
    if (!teamPlayers.length) return [{ name: teamName, team: teamName }];

    const withRatings = teamPlayers.map((name) => ({ name, team: teamName }));
    if (!hasPositionData()) {
      return pickWithNoise(withRatings.sort((a, b) => ratingOf(b) - ratingOf(a)), 11, difficulty);
    }

    const chosen = [];
    for (const pos of POSITION_ORDER) {
      const need = formationCounts[pos] || 0;
      const candidates = withRatings.filter((p) => positionOf(p) === pos).sort((a, b) => ratingOf(b) - ratingOf(a));
      chosen.push(...pickWithNoise(candidates, need, difficulty));
    }
    if (chosen.length < 11) {
      const chosenNames = new Set(chosen.map((p) => p.name));
      const rest = withRatings.filter((p) => !chosenNames.has(p.name)).sort((a, b) => ratingOf(b) - ratingOf(a));
      chosen.push(...pickWithNoise(rest, 11 - chosen.length, difficulty));
    }
    return chosen;
  }

  // Fuerza objetiva de un seleccionado (siempre con su mejor 11, sin ruido de dificultad):
  // se usa solo para decidir qué tan probable es que salga sorteado como rival.
  function teamStrength(team) {
    return avgRating(aiSquadFor(team, AI_DEFAULT_FORMATION, "hard"));
  }

  function formationLabel(counts) {
    return `${counts.DF}-${counts.MF}-${counts.FW}`;
  }

  // ---------- Simulación de partidos ----------

  // Muestreo Poisson (algoritmo de Knuth): da la distribución de goles típica del fútbol real
  // (mayoría de partidos entre 0 y 3 goles por equipo, resultados de 5+ son raros).
  function poissonSample(lambda) {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }

  const AVG_GOALS = 1.3; // promedio real de goles por equipo en un Mundial

  // El ataque de un equipo se enfrenta a la defensa del otro (y viceversa), en vez de
  // comparar un único número de "poder": así un rival con delanteros fuertes castiga
  // de verdad a un plantel con defensa floja.
  function computeLambdas(squadA, squadB) {
    const attackA = attackRating(squadA);
    const defenseA = defenseRating(squadA);
    const attackB = attackRating(squadB);
    const defenseB = defenseRating(squadB);
    const lambdaA = Math.max(0.25, AVG_GOALS + (attackA - defenseB) / 40);
    const lambdaB = Math.max(0.25, AVG_GOALS + (attackB - defenseA) / 40);
    return [lambdaA, lambdaB];
  }

  function simulateMatch(squadA, squadB) {
    const [lambdaA, lambdaB] = computeLambdas(squadA, squadB);
    return [poissonSample(lambdaA), poissonSample(lambdaB)];
  }

  // ---------- Predicción de partido (IA analizando el partido) ----------

  const FACTORIALS = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800];

  function poissonPMF(k, lambda) {
    return (Math.exp(-lambda) * Math.pow(lambda, k)) / FACTORIALS[k];
  }

  function matchProbabilities(lambdaMe, lambdaOpp) {
    const MAXG = 10;
    let winP = 0, drawP = 0, loseP = 0;
    for (let i = 0; i <= MAXG; i++) {
      const pi = poissonPMF(i, lambdaMe);
      for (let j = 0; j <= MAXG; j++) {
        const p = pi * poissonPMF(j, lambdaOpp);
        if (i > j) winP += p;
        else if (i === j) drawP += p;
        else loseP += p;
      }
    }
    const total = winP + drawP + loseP || 1;
    return { winP: winP / total, drawP: drawP / total, loseP: loseP / total };
  }

  function topScouts(oppSquad, n) {
    return [...oppSquad].sort((a, b) => ratingOf(b) - ratingOf(a)).slice(0, n);
  }

  function renderMatchPreview(oppTeamName, oppSquad, formationCounts, reason) {
    if (!oppTeamName || !oppSquad) {
      matchPreview.innerHTML = "";
      return;
    }
    const [lambdaMe, lambdaOpp] = computeLambdas(squad, oppSquad);
    const { winP, drawP, loseP } = matchProbabilities(lambdaMe, lambdaOpp);
    const myAvg = Math.round(avgRating(squad));
    const oppAvg = Math.round(avgRating(oppSquad));
    const favorite = myAvg === oppAvg ? "Está parejo" : myAvg > oppAvg ? "Vos" : oppTeamName;
    const scouts = hasPositionData()
      ? topScouts(oppSquad, 3)
          .map((p) => `${p.name} (${positionOf(p) || "-"} · ${Math.round(ratingOf(p))})`)
          .join(", ")
      : "";

    matchPreview.innerHTML = `
      <div class="preview-label">🤖 IA analizando el partido…</div>
      <div class="preview-line">Favorito: <strong>${favorite}</strong> (rating promedio ${myAvg} vs ${oppAvg})</div>
      <div class="preview-line">${Math.round(winP * 100)}% victoria · ${Math.round(drawP * 100)}% empate · ${Math.round(loseP * 100)}% derrota</div>
      ${formationCounts ? `<div class="preview-line">📋 Formación rival: ${formationLabel(formationCounts)}</div>` : ""}
      ${scouts ? `<div class="preview-line scouting">🔎 Scouting: ${scouts}</div>` : ""}
      ${reason ? `<div class="preview-line warn">⚠️ ${oppTeamName} ${reason}.</div>` : ""}
    `;
  }

  let currentOppSquad = null;

  function setOpponent(oppTeamName) {
    opponentName.textContent = oppTeamName;
    const { counts, reason } = pickAdaptiveFormation(aiDifficulty);
    currentOppSquad = aiSquadFor(oppTeamName, counts, aiDifficulty);
    renderMatchPreview(oppTeamName, currentOppSquad, counts, reason);
  }

  function weightedIndex(weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return Math.floor(Math.random() * weights.length);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  // Sortea rivales dando más chances a los equipos fuertes cuanto mayor es `power`
  // (crece con la dificultad elegida y con el avance del torneo en la fase eliminatoria).
  function pickOpponents(n, exclude, power) {
    const pool = edition.teams.filter((t) => !exclude.has(t));
    const picked = [];
    for (let i = 0; i < n && pool.length; i++) {
      const idx = power <= 0 ? Math.floor(Math.random() * pool.length) : weightedIndex(pool.map((t) => Math.pow(teamStrength(t), power)));
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  }

  // ---------- Fase de grupos ----------

  function newTeamStat(name, isYou) {
    return { name, isYou, pts: 0, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0 };
  }

  function applyResult(stat, gf, gc) {
    stat.pj++;
    stat.gf += gf;
    stat.gc += gc;
    if (gf > gc) { stat.g++; stat.pts += 3; }
    else if (gf === gc) { stat.e++; stat.pts += 1; }
    else { stat.p++; }
  }

  // Calendario de 3 jornadas para un grupo de 4 (round-robin con "Tu equipo" fijo):
  // en cada jornada vos jugás un partido y, a la par, los otros dos equipos juegan el suyo.
  function buildGroupSchedule(opponents) {
    return [
      { you: opponents[0], otherA: opponents[1], otherB: opponents[2] },
      { you: opponents[1], otherA: opponents[2], otherB: opponents[0] },
      { you: opponents[2], otherA: opponents[0], otherB: opponents[1] },
    ];
  }

  function startGroupStage() {
    phase = "group";
    facedTeams = new Set();
    record = { wins: 0, draws: 0, losses: 0 };
    const opponents = pickOpponents(3, new Set(), DIFFICULTY_BASE_POWER[aiDifficulty]);
    opponents.forEach((t) => facedTeams.add(t));

    groupTeams = [newTeamStat(YOUR_TEAM_LABEL, true), ...opponents.map((t) => newTeamStat(t, false))];
    groupSchedule = buildGroupSchedule(opponents);

    groupMatchIndex = 0;
    matchPhaseTitle.textContent = "Fase de Grupos";
    matchPhaseSubtitle.textContent = "Jugá tus 3 partidos de grupo — el resto del grupo juega a la par";
    groupTableWrap.hidden = false;
    matchLog.innerHTML = "";
    scoreYou.textContent = "0";
    scoreOpp.textContent = "0";
    setOpponent(groupSchedule[0].you);
    renderGroupTable();
    renderRoundTracker();
    btnNextMatch.disabled = false;
    btnNextMatch.textContent = "Jugar siguiente partido";
    showScreen("screen-match");
  }

  function renderGroupTable() {
    const sorted = [...groupTeams].sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf);
    groupTableBody.innerHTML = "";
    sorted.forEach((t, idx) => {
      const tr = document.createElement("tr");
      if (t.isYou) tr.classList.add("you-row");
      if (idx < 2) tr.classList.add("qualified-row");
      tr.innerHTML = `
        <td>${t.name}${t.isYou ? "" : ""}</td>
        <td>${t.pts}</td><td>${t.pj}</td><td>${t.g}</td><td>${t.e}</td><td>${t.p}</td>
        <td>${t.gf}</td><td>${t.gc}</td><td>${t.gf - t.gc}</td>
      `;
      groupTableBody.appendChild(tr);
    });
  }

  function renderRoundTracker() {
    roundTracker.innerHTML = "";
    if (phase === "group") {
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement("div");
        dot.className = "round-dot";
        if (i === groupMatchIndex) dot.classList.add("current");
        roundTracker.appendChild(dot);
      }
    } else {
      KNOCKOUT_STAGES.forEach((stage, i) => {
        const dot = document.createElement("div");
        dot.className = "round-dot";
        if (i < knockoutIndex) dot.classList.add("win");
        if (i === knockoutIndex) dot.classList.add("current");
        roundTracker.appendChild(dot);
      });
    }
  }

  function playGroupMatch() {
    const round = groupSchedule[groupMatchIndex];
    const oppTeamName = round.you;
    const oppStat = groupTeams.find((t) => t.name === oppTeamName);
    const youStat = groupTeams.find((t) => t.isYou);

    const [myGoals, oppGoals] = simulateMatch(squad, currentOppSquad);
    applyResult(youStat, myGoals, oppGoals);
    applyResult(oppStat, oppGoals, myGoals);

    if (myGoals > oppGoals) record.wins++;
    else if (myGoals === oppGoals) record.draws++;
    else record.losses++;

    scoreYou.textContent = myGoals;
    scoreOpp.textContent = oppGoals;

    // el resto del grupo juega su partido en la misma jornada, a la par del tuyo
    const otherAStat = groupTeams.find((t) => t.name === round.otherA);
    const otherBStat = groupTeams.find((t) => t.name === round.otherB);
    const [gA, gB] = simulateMatch(
      aiSquadFor(round.otherA, AI_DEFAULT_FORMATION, "normal"),
      aiSquadFor(round.otherB, AI_DEFAULT_FORMATION, "normal")
    );
    applyResult(otherAStat, gA, gB);
    applyResult(otherBStat, gB, gA);

    const res = myGoals > oppGoals ? "Ganaste" : myGoals === oppGoals ? "Empataste" : "Perdiste";
    const entry = document.createElement("div");
    entry.className = "entry";
    entry.innerHTML = `
      <div>Jornada ${groupMatchIndex + 1}: vs ${oppTeamName} — ${myGoals} a ${oppGoals} (${res})</div>
      <div class="entry-sub">A la par: ${round.otherA} ${gA} - ${gB} ${round.otherB}</div>
    `;
    matchLog.prepend(entry);

    groupMatchIndex++;
    renderGroupTable();
    renderRoundTracker();

    if (groupMatchIndex >= 3) {
      const sorted = [...groupTeams].sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf);
      const top2 = sorted.slice(0, 2).map((t) => t.name);
      if (top2.includes(YOUR_TEAM_LABEL)) {
        setTimeout(startKnockoutStage, 1200);
        btnNextMatch.disabled = true;
        btnNextMatch.textContent = "Clasificaste a Octavos...";
      } else {
        endTournament(false, "grupos");
      }
      return;
    }
    setOpponent(groupSchedule[groupMatchIndex].you);
  }

  // ---------- Fase eliminatoria ----------

  function startKnockoutStage() {
    phase = "knockout";
    knockoutIndex = 0;
    groupTableWrap.hidden = true;
    matchPhaseTitle.textContent = KNOCKOUT_STAGES[0].label;
    matchPhaseSubtitle.textContent = "Ganá o quedás eliminado";
    scoreYou.textContent = "0";
    scoreOpp.textContent = "0";
    renderRoundTracker();
    nextKnockoutOpponent();
    btnNextMatch.disabled = false;
    btnNextMatch.textContent = "Jugar siguiente partido";
  }

  function nextKnockoutOpponent() {
    const power = DIFFICULTY_BASE_POWER[aiDifficulty] + knockoutIndex * KNOCKOUT_POWER_STEP;
    const [opp] = pickOpponents(1, facedTeams, power);
    facedTeams.add(opp);
    setOpponent(opp);
  }

  function playKnockoutMatch() {
    const oppTeamName = opponentName.textContent;
    let [myGoals, oppGoals] = simulateMatch(squad, currentOppSquad);

    let penalties = "";
    if (myGoals === oppGoals) {
      // en eliminación directa no hay empates: se define por penales
      if (Math.random() < 0.5) { myGoals++; penalties = " (por penales)"; }
      else { oppGoals++; penalties = " (por penales)"; }
    }

    const won = myGoals > oppGoals;
    if (won) record.wins++; else record.losses++;

    scoreYou.textContent = myGoals;
    scoreOpp.textContent = oppGoals;

    const entry = document.createElement("div");
    entry.className = "entry";
    entry.textContent = `${KNOCKOUT_STAGES[knockoutIndex].label}: vs ${oppTeamName} — ${myGoals} a ${oppGoals}${penalties} (${won ? "Ganaste" : "Perdiste"})`;
    matchLog.prepend(entry);

    if (!won) {
      endTournament(false, KNOCKOUT_STAGES[knockoutIndex].key);
      return;
    }

    knockoutIndex++;
    if (knockoutIndex >= KNOCKOUT_STAGES.length) {
      endTournament(true, "campeon");
      return;
    }
    matchPhaseTitle.textContent = KNOCKOUT_STAGES[knockoutIndex].label;
    renderRoundTracker();
    nextKnockoutOpponent();
    scoreYou.textContent = "0";
    scoreOpp.textContent = "0";
  }

  function playNextMatch() {
    if (phase === "group") playGroupMatch();
    else if (phase === "knockout") playKnockoutMatch();
  }

  btnNextMatch.addEventListener("click", playNextMatch);

  // ---------- Resultado final ----------

  const STAGE_ES = {
    grupos: "en la Fase de Grupos",
    R16: "en los Octavos de Final",
    QF: "en los Cuartos de Final",
    SF: "en la Semifinal",
    F: "en la Final",
  };

  function endTournament(champion, where) {
    btnNextMatch.disabled = true;
    matchPreview.innerHTML = "";
    resultTitle.className = champion ? "win" : "lose";
    if (champion) {
      const perfect = record.losses === 0 && record.draws === 0;
      resultTitle.textContent = perfect ? "¡Campeón! Racha perfecta 7 a 0" : "¡Campeón del Mundial!";
      resultText.textContent = `Ganaste el torneo del Mundial ${editionYear} (${record.wins}G ${record.draws}E ${record.losses}P).`;
    } else {
      resultTitle.textContent = "Eliminado";
      resultText.textContent = `Quedaste eliminado ${STAGE_ES[where] || ""} del Mundial ${editionYear}.`;
    }
    setTimeout(() => showScreen("screen-result"), 900);
  }

  function startTournament() {
    startGroupStage();
  }

  btnPlay.addEventListener("click", startTournament);

  function restart() {
    edition = null;
    editionYear = null;
    squad = [];
    spinTeam = null;
    formationKey = null;
    requiredCounts = null;
    currentOppSquad = null;
    wheelTeamPick.hidden = true;
    wheel.style.transform = "rotate(0deg)";
    wheel.textContent = "";
    matchPreview.innerHTML = "";
    showScreen("screen-edition");
  }

  btnRestart.addEventListener("click", restart);

  buildEditionCards();
})();
