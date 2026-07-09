(function () {
  const btnDraft = document.getElementById("mode-draft");
  const btnGuess = document.getElementById("mode-guess");
  const appDraft = document.getElementById("app-draft");
  const appGuess = document.getElementById("app-guess");

  function showDraft() {
    appDraft.hidden = false;
    appGuess.hidden = true;
    btnDraft.classList.add("active");
    btnGuess.classList.remove("active");
  }

  function showGuess() {
    appDraft.hidden = true;
    appGuess.hidden = false;
    btnGuess.classList.add("active");
    btnDraft.classList.remove("active");
    document.dispatchEvent(new CustomEvent("guessmode:shown"));
  }

  btnDraft.addEventListener("click", showDraft);
  btnGuess.addEventListener("click", showGuess);
})();
