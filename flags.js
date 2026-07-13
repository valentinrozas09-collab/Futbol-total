(function () {
  const emojiEl = document.getElementById("flags-emoji");
  const optionsEl = document.getElementById("flags-options");
  const writeForm = document.getElementById("flags-write-form");
  const writeInput = document.getElementById("flags-write-input");
  const writeSuggestionsEl = document.getElementById("flags-write-suggestions");
  const feedbackEl = document.getElementById("flags-feedback");
  const nextBtn = document.getElementById("btn-flags-next");
  const restartTimedBtn = document.getElementById("btn-flags-restart-timed");
  const streakEl = document.getElementById("flags-streak");
  const bestEl = document.getElementById("flags-best");
  const scoreEl = document.getElementById("flags-score");
  const timerWrap = document.getElementById("flags-timer-wrap");
  const timerEl = document.getElementById("flags-timer");
  const difficultyRow = document.getElementById("flags-difficulty-row");

  const modeChoiceBtn = document.getElementById("flags-mode-choice");
  const modeWriteBtn = document.getElementById("flags-mode-write");
  const diffEasyBtn = document.getElementById("flags-diff-easy");
  const diffHardBtn = document.getElementById("flags-diff-hard");
  const timeClassicBtn = document.getElementById("flags-time-classic");
  const timeTimedBtn = document.getElementById("flags-time-timed");

  const BEST_STREAK_KEY = "futbolTotal.flags.bestStreak";
  const BEST_TIMED_KEY = "futbolTotal.flags.bestTimed";
  const TIMED_SECONDS = 60;

  let pool = [];
  let target = null;
  let answered = false;
  let gameOver = false;
  let streak = 0;
  let correct = 0;
  let total = 0;
  let initialized = false;

  let answerMode = "choice"; // "choice" | "write"
  let difficulty = "easy"; // "easy" | "hard"
  let timeMode = "classic"; // "classic" | "timed"
  let timeLeft = TIMED_SECONDS;
  let timerInterval = null;

  let bestStreak = Number(localStorage.getItem(BEST_STREAK_KEY)) || 0;
  let bestTimed = Number(localStorage.getItem(BEST_TIMED_KEY)) || 0;

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

  // Excluye países cuya bandera es idéntica a la de otro (ej. Yugoslavia/Serbia,
  // Checoslovaquia/Chequia): con opción múltiple sería una pregunta ambigua/injusta.
  function buildPool() {
    const counts = {};
    for (const country in window.TEAM_FLAG) {
      const emoji = window.TEAM_FLAG[country];
      counts[emoji] = (counts[emoji] || 0) + 1;
    }
    return Object.keys(window.TEAM_FLAG).filter((c) => counts[window.TEAM_FLAG[c]] === 1);
  }

  function renderStats() {
    streakEl.textContent = String(streak);
    if (timeMode === "timed") {
      bestEl.textContent = String(bestTimed);
      scoreEl.textContent = `${correct} en esta ronda`;
    } else {
      bestEl.textContent = String(bestStreak);
      scoreEl.textContent = `${correct}/${total}`;
    }
  }

  // En difícil, los distractores son de la misma confederación que la respuesta
  // correcta: banderas y contextos mucho más parecidos entre sí.
  function pickOptions() {
    let candidates = pool.filter((c) => c !== target);
    if (difficulty === "hard") {
      const conf = window.TEAM_CONFEDERATION[target];
      const sameConf = candidates.filter((c) => window.TEAM_CONFEDERATION[c] === conf);
      if (sameConf.length >= 3) candidates = sameConf;
    }
    const distractors = shuffle(candidates).slice(0, 3);
    return shuffle([target, ...distractors]);
  }

  function hideWriteSuggestions() {
    writeSuggestionsEl.hidden = true;
    writeSuggestionsEl.innerHTML = "";
  }

  function renderWriteSuggestions() {
    const filter = normalize(writeInput.value);
    if (!filter) {
      hideWriteSuggestions();
      return;
    }
    const matches = pool.filter((c) => normalize(c).includes(filter)).slice(0, 8);
    if (!matches.length) {
      hideWriteSuggestions();
      return;
    }
    writeSuggestionsEl.innerHTML = matches
      .map(
        (c) => `
        <li class="suggestion-item" data-name="${c.replace(/"/g, "&quot;")}">
          <span class="suggestion-flag">${window.TEAM_FLAG[c] || "🏳️"}</span>
          <span class="suggestion-name">${c}</span>
        </li>`
      )
      .join("");
    writeSuggestionsEl.hidden = false;
  }

  writeSuggestionsEl.addEventListener("click", (e) => {
    const item = e.target.closest(".suggestion-item");
    if (!item) return;
    writeInput.value = item.dataset.name;
    hideWriteSuggestions();
  });
  writeInput.addEventListener("input", renderWriteSuggestions);
  writeInput.addEventListener("focus", renderWriteSuggestions);
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#flags-write-form .guess-input-wrap")) hideWriteSuggestions();
  });

  function newRound() {
    if (gameOver) return;
    answered = false;
    target = pool[Math.floor(Math.random() * pool.length)];
    emojiEl.textContent = window.TEAM_FLAG[target];
    feedbackEl.textContent = "";
    feedbackEl.className = "guess-result";
    nextBtn.hidden = true;

    if (answerMode === "choice") {
      optionsEl.hidden = false;
      writeForm.hidden = true;
      const options = pickOptions();
      optionsEl.innerHTML = "";
      for (const country of options) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "flag-option-btn";
        btn.textContent = country;
        btn.addEventListener("click", () => selectAnswer(country, btn));
        optionsEl.appendChild(btn);
      }
    } else {
      optionsEl.hidden = true;
      writeForm.hidden = false;
      writeInput.value = "";
      writeInput.disabled = false;
      writeForm.querySelector("button[type=submit]").disabled = false;
      hideWriteSuggestions();
      writeInput.focus();
    }
  }

  function resolveAnswer(isCorrect, revealButtons) {
    answered = true;
    total++;

    if (isCorrect) {
      correct++;
      streak++;
      if (streak > bestStreak) {
        bestStreak = streak;
        localStorage.setItem(BEST_STREAK_KEY, String(bestStreak));
      }
      feedbackEl.textContent = `¡Correcto! Es ${target}.`;
      feedbackEl.className = "guess-result win";
    } else {
      streak = 0;
      feedbackEl.textContent = `Incorrecto. Era ${target}.`;
      feedbackEl.className = "guess-result lose";
    }

    if (revealButtons) revealButtons();
    renderStats();

    if (timeMode === "timed") {
      if (!gameOver) setTimeout(newRound, 550);
    } else {
      nextBtn.hidden = false;
    }
  }

  function selectAnswer(country, btn) {
    if (answered || gameOver) return;
    const isCorrect = country === target;
    resolveAnswer(isCorrect, () => {
      btn.classList.add(isCorrect ? "correct" : "wrong");
      for (const child of optionsEl.children) {
        child.disabled = true;
        if (child.textContent === target) child.classList.add("correct");
      }
    });
  }

  function handleWriteSubmit(e) {
    e.preventDefault();
    if (answered || gameOver) return;
    const raw = writeInput.value.trim();
    if (!raw) return;
    hideWriteSuggestions();
    const isCorrect = normalize(raw) === normalize(target);
    resolveAnswer(isCorrect, () => {
      writeInput.disabled = true;
      writeForm.querySelector("button[type=submit]").disabled = true;
    });
  }

  writeForm.addEventListener("submit", handleWriteSubmit);
  nextBtn.addEventListener("click", newRound);

  // ---------- Contrarreloj ----------

  function tick() {
    timeLeft--;
    timerEl.textContent = String(timeLeft);
    if (timeLeft <= 0) endTimedRun();
  }

  function startTimer() {
    clearInterval(timerInterval);
    timeLeft = TIMED_SECONDS;
    timerEl.textContent = String(timeLeft);
    timerInterval = setInterval(tick, 1000);
  }

  function endTimedRun() {
    clearInterval(timerInterval);
    gameOver = true;
    nextBtn.hidden = true;
    const isRecord = correct > bestTimed;
    if (isRecord) {
      bestTimed = correct;
      localStorage.setItem(BEST_TIMED_KEY, String(bestTimed));
    }
    feedbackEl.textContent = isRecord
      ? `¡Tiempo! Nuevo récord: ${correct} aciertos en 60 segundos.`
      : `¡Tiempo! Conseguiste ${correct} aciertos en 60 segundos (récord: ${bestTimed}).`;
    feedbackEl.className = "guess-result " + (isRecord ? "win" : "");
    restartTimedBtn.hidden = false;
    renderStats();
  }

  restartTimedBtn.addEventListener("click", resetSession);

  // ---------- Configuración ----------

  function setAnswerMode(mode) {
    if (mode === answerMode) return;
    answerMode = mode;
    modeChoiceBtn.classList.toggle("active", mode === "choice");
    modeWriteBtn.classList.toggle("active", mode === "write");
    difficultyRow.hidden = mode !== "choice";
    resetSession();
  }

  function setDifficulty(diff) {
    if (diff === difficulty) return;
    difficulty = diff;
    diffEasyBtn.classList.toggle("active", diff === "easy");
    diffHardBtn.classList.toggle("active", diff === "hard");
    resetSession();
  }

  function setTimeMode(mode) {
    if (mode === timeMode) return;
    timeMode = mode;
    timeClassicBtn.classList.toggle("active", mode === "classic");
    timeTimedBtn.classList.toggle("active", mode === "timed");
    timerWrap.hidden = mode !== "timed";
    resetSession();
  }

  modeChoiceBtn.addEventListener("click", () => setAnswerMode("choice"));
  modeWriteBtn.addEventListener("click", () => setAnswerMode("write"));
  diffEasyBtn.addEventListener("click", () => setDifficulty("easy"));
  diffHardBtn.addEventListener("click", () => setDifficulty("hard"));
  timeClassicBtn.addEventListener("click", () => setTimeMode("classic"));
  timeTimedBtn.addEventListener("click", () => setTimeMode("timed"));

  function resetSession() {
    clearInterval(timerInterval);
    gameOver = false;
    streak = 0;
    correct = 0;
    total = 0;
    restartTimedBtn.hidden = true;
    feedbackEl.textContent = "";
    feedbackEl.className = "guess-result";
    if (timeMode === "timed") startTimer();
    renderStats();
    newRound();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    pool = buildPool();
    difficultyRow.hidden = answerMode !== "choice";
    timerWrap.hidden = timeMode !== "timed";
    resetSession();
  }

  document.addEventListener("flagsmode:shown", init);
  if (!document.getElementById("app-flags").hidden) init();
})();
