(function () {
  const emojiEl = document.getElementById("flags-emoji");
  const optionsEl = document.getElementById("flags-options");
  const feedbackEl = document.getElementById("flags-feedback");
  const nextBtn = document.getElementById("btn-flags-next");
  const streakEl = document.getElementById("flags-streak");
  const bestEl = document.getElementById("flags-best");
  const scoreEl = document.getElementById("flags-score");

  let pool = [];
  let target = null;
  let answered = false;
  let streak = 0;
  let best = 0;
  let correct = 0;
  let total = 0;
  let initialized = false;

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
    bestEl.textContent = String(best);
    scoreEl.textContent = `${correct}/${total}`;
  }

  function newRound() {
    answered = false;
    target = pool[Math.floor(Math.random() * pool.length)];
    emojiEl.textContent = window.TEAM_FLAG[target];
    feedbackEl.textContent = "";
    feedbackEl.className = "guess-result";
    nextBtn.hidden = true;

    const distractors = shuffle(pool.filter((c) => c !== target)).slice(0, 3);
    const options = shuffle([target, ...distractors]);

    optionsEl.innerHTML = "";
    for (const country of options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "flag-option-btn";
      btn.textContent = country;
      btn.addEventListener("click", () => selectAnswer(country, btn));
      optionsEl.appendChild(btn);
    }
  }

  function selectAnswer(country, btn) {
    if (answered) return;
    answered = true;
    total++;

    if (country === target) {
      correct++;
      streak++;
      best = Math.max(best, streak);
      btn.classList.add("correct");
      feedbackEl.textContent = `¡Correcto! Es ${target}.`;
      feedbackEl.className = "guess-result win";
    } else {
      streak = 0;
      btn.classList.add("wrong");
      feedbackEl.textContent = `Incorrecto. Era ${target}.`;
      feedbackEl.className = "guess-result lose";
    }

    for (const child of optionsEl.children) {
      child.disabled = true;
      if (child.textContent === target) child.classList.add("correct");
    }

    renderStats();
    nextBtn.hidden = false;
  }

  nextBtn.addEventListener("click", newRound);

  function init() {
    if (initialized) return;
    initialized = true;
    pool = buildPool();
    renderStats();
    newRound();
  }

  document.addEventListener("flagsmode:shown", init);
  if (!document.getElementById("app-flags").hidden) init();
})();
