(function () {
  const MODES = [
    { btn: "mode-draft", app: "app-draft" },
    { btn: "mode-guess", app: "app-guess", event: "guessmode:shown" },
    { btn: "mode-flags", app: "app-flags", event: "flagsmode:shown" },
    { btn: "mode-memory", app: "app-memory", event: "memorymode:shown" },
    { btn: "mode-grid", app: "app-grid", event: "gridmode:shown" },
    { btn: "mode-connections", app: "app-connections", event: "connectionsmode:shown" },
    { btn: "mode-link", app: "app-link", event: "linkmode:shown" },
  ].map((m) => ({
    ...m,
    btnEl: document.getElementById(m.btn),
    appEl: document.getElementById(m.app),
  }));

  function show(target) {
    for (const m of MODES) {
      const active = m === target;
      m.appEl.hidden = !active;
      m.btnEl.classList.toggle("active", active);
    }
    if (target.event) document.dispatchEvent(new CustomEvent(target.event));
  }

  for (const m of MODES) {
    m.btnEl.addEventListener("click", () => show(m));
  }
})();
