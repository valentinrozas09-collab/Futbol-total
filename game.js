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

  const matchPhaseTitle = document.getElementById("match-phase-title");
  const matchPhaseSubtitle = document.getElementById("match-phase-subtitle");
  const groupTableWrap = document.getElementById("group-table-wrap");
  const groupTableBody = document.getElementById("group-table-body");
  const scoreYou = document.getElementById("score-you");
  const scoreOpp = document.getElementById("score-opp");
  const opponentName = document.getElementById("opponent-name");
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

  // Estado del torneo
  let phase = null; // "group" | "knockout"
  let groupTeams = []; // [{name, isYou, pts, pj, g, e, p, gf, gc}]
  let groupMatchIndex = 0; // próximo partido tuyo a jugar (0..2)
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
    renderPositionNeeds();
  }

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

  // ---------- Simulación de partidos ----------

  function hashPower(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return 55 + (h % 40); // 55-94
  }

  function squadPower() {
    return squad.reduce((sum, p) => sum + ratingOf(p), 0) / squad.length;
  }

  function teamPower(teamName) {
    const players = (edition.players && edition.players[teamName]) || [];
    if (players.length && window.playerRating) {
      const sum = players.reduce((s, name) => s + window.playerRating(editionYear, teamName, name), 0);
      return sum / players.length;
    }
    return hashPower(teamName);
  }

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

  function simulateScore(powerA, powerB) {
    const diff = powerA - powerB; // rating va de 60 a 99, así que diff típico es -35..35
    const AVG_GOALS = 1.3; // promedio real de goles por equipo en un Mundial
    const lambdaA = Math.max(0.25, AVG_GOALS + diff / 40);
    const lambdaB = Math.max(0.25, AVG_GOALS - diff / 40);
    return [poissonSample(lambdaA), poissonSample(lambdaB)];
  }

  function pickRandomTeams(n, exclude) {
    const candidates = edition.teams.filter((t) => !exclude.has(t));
    const shuffled = candidates.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
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

  function startGroupStage() {
    phase = "group";
    facedTeams = new Set();
    record = { wins: 0, draws: 0, losses: 0 };
    const opponents = pickRandomTeams(3, new Set());
    opponents.forEach((t) => facedTeams.add(t));

    groupTeams = [newTeamStat(YOUR_TEAM_LABEL, true), ...opponents.map((t) => newTeamStat(t, false))];

    // simulamos ya los 3 partidos entre los 3 oponentes (no involucran a "Tu Equipo")
    for (let i = 0; i < opponents.length; i++) {
      for (let j = i + 1; j < opponents.length; j++) {
        const statA = groupTeams.find((t) => t.name === opponents[i]);
        const statB = groupTeams.find((t) => t.name === opponents[j]);
        const [gA, gB] = simulateScore(teamPower(opponents[i]), teamPower(opponents[j]));
        applyResult(statA, gA, gB);
        applyResult(statB, gB, gA);
      }
    }

    groupMatchIndex = 0;
    matchPhaseTitle.textContent = "Fase de Grupos";
    matchPhaseSubtitle.textContent = "Jugá tus 3 partidos de grupo";
    groupTableWrap.hidden = false;
    matchLog.innerHTML = "";
    scoreYou.textContent = "0";
    scoreOpp.textContent = "0";
    opponentName.textContent = opponents[0];
    renderGroupTable();
    renderRoundTracker();
    btnNextMatch.disabled = false;
    btnNextMatch.textContent = "Jugar siguiente partido";
    showScreen("screen-match");
  }

  function currentGroupOpponents() {
    return groupTeams.filter((t) => !t.isYou).map((t) => t.name);
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
    const opponents = currentGroupOpponents();
    const oppTeamName = opponents[groupMatchIndex];
    const oppStat = groupTeams.find((t) => t.name === oppTeamName);
    const youStat = groupTeams.find((t) => t.isYou);

    const [myGoals, oppGoals] = simulateScore(squadPower(), teamPower(oppTeamName));
    applyResult(youStat, myGoals, oppGoals);
    applyResult(oppStat, oppGoals, myGoals);

    if (myGoals > oppGoals) record.wins++;
    else if (myGoals === oppGoals) record.draws++;
    else record.losses++;

    scoreYou.textContent = myGoals;
    scoreOpp.textContent = oppGoals;

    const entry = document.createElement("div");
    entry.className = "entry";
    const res = myGoals > oppGoals ? "Ganaste" : myGoals === oppGoals ? "Empataste" : "Perdiste";
    entry.textContent = `Fase de grupos: vs ${oppTeamName} — ${myGoals} a ${oppGoals} (${res})`;
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
    opponentName.textContent = opponents[groupMatchIndex];
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
    const [opp] = pickRandomTeams(1, facedTeams);
    facedTeams.add(opp);
    opponentName.textContent = opp;
  }

  function playKnockoutMatch() {
    const oppTeamName = opponentName.textContent;
    let [myGoals, oppGoals] = simulateScore(squadPower(), teamPower(oppTeamName));

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
    wheelTeamPick.hidden = true;
    wheel.style.transform = "rotate(0deg)";
    wheel.textContent = "";
    showScreen("screen-edition");
  }

  btnRestart.addEventListener("click", restart);

  buildEditionCards();
})();
