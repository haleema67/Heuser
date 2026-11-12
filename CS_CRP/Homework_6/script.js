(() => {
  "use strict";
  const KEY = "lanternEcho_v1";
  const FREQ = [262, 330, 392, 523];
  const NAMES = ["amber", "teal", "rose", "violet"];

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);
  const board = $("board"), statusEl = $("status"), roundEl = $("round"), bestEl = $("best");
  const startBtn = $("startBtn"), pauseBtn = $("pauseBtn"), muteBtn = $("muteBtn"), resetBtn = $("resetBtn");
  const sparks = $("sparks");
  const lanterns = Array.from(document.querySelectorAll(".lantern"));

  // ---- Saved data (best score + mute) ----
  let saved = { best: 0, muted: false };
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d && Number.isFinite(d.best) && d.best >= 0 && d.best < 1e6) saved.best = Math.floor(d.best);
      if (d && typeof d.muted === "boolean") saved.muted = d.muted;
    } catch (e) { saved = { best: 0, muted: false }; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* storage blocked: game still works */ }
  }

  // ---- Game state: menu | showing | input | paused | over ----
  let state = "menu", prevState = "menu";
  let sequence = [], inputIndex = 0, round = 0;
  let timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function setStatus(t) { statusEl.textContent = t; }
  function render() {
    roundEl.textContent = round;
    bestEl.textContent = saved.best;
    board.classList.toggle("locked", state !== "input");
    board.classList.toggle("paused", state === "paused");
    pauseBtn.disabled = !(state === "showing" || state === "input" || state === "paused");
    pauseBtn.textContent = state === "paused" ? "Resume" : "Pause";
    startBtn.textContent = state === "menu" ? "Start" : "Restart";
    muteBtn.textContent = saved.muted ? "Sound off" : "Sound on";
    muteBtn.setAttribute("aria-pressed", String(saved.muted));
  }

  // ---- Sound (generated with Web Audio, no files) ----
  let ctx = null;
  function audio() {
    if (saved.muted) return null;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }
  function tone(freq, dur, type = "sine", vol = 0.18, delay = 0) {
    const c = audio(); if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  const sfx = {
    note: (i) => tone(FREQ[i], 0.35, "triangle"),
    win: () => { tone(523, 0.15, "sine", 0.15); tone(659, 0.2, "sine", 0.15, 0.12); },
    lose: () => { tone(160, 0.5, "sawtooth", 0.15); tone(110, 0.6, "sawtooth", 0.15, 0.15); },
    click: () => tone(700, 0.06, "square", 0.06)
  };

  // ---- Visual feedback ----
  function burst(i) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const b = board.getBoundingClientRect(), r = lanterns[i].getBoundingClientRect();
    const cx = r.left - b.left + r.width / 2, cy = r.top - b.top + r.height / 2;
    const color = getComputedStyle(lanterns[i]).getPropertyValue("--c");
    for (let k = 0; k < 10; k++) {
      const s = document.createElement("span");
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 50;
      s.className = "spark";
      s.style.cssText = `left:${cx}px;top:${cy}px;--c:${color};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
      s.addEventListener("animationend", () => s.remove());
      sparks.appendChild(s);
    }
    while (sparks.childElementCount > 80) sparks.firstChild.remove(); // cap particles
  }
  function flash(i, ms) {
    const el = lanterns[i];
    el.classList.add("lit"); sfx.note(i); burst(i);
    later(() => el.classList.remove("lit"), ms);
  }

  // ---- Core logic ----
  function startGame() {
    clearTimers();
    lanterns.forEach((l) => l.classList.remove("lit"));
    sequence = []; round = 0; inputIndex = 0;
    sfx.click();
    nextRound();
  }
  function nextRound() {
    sequence.push(Math.floor(Math.random() * 4));
    round = sequence.length;
    playSequence();
  }
  function playSequence() {
    clearTimers();
    state = "showing"; inputIndex = 0;
    setStatus("Watch the lanterns...");
    render();
    const step = Math.max(260, 650 - round * 25);
    later(() => {}, 0);
    sequence.forEach((n, k) => later(() => flash(n, step * 0.6), 500 + k * step));
    later(() => {
      state = "input"; inputIndex = 0;
      setStatus("Your turn. Repeat the order.");
      render();
    }, 500 + sequence.length * step);
  }
  function press(i) {
    if (state !== "input") return; // ignores taps while showing, paused, or over
    flash(i, 220);
    if (i === sequence[inputIndex]) {
      inputIndex++;
      if (inputIndex === sequence.length) {
        state = "showing"; // lock input right away so rapid taps cannot double-count
        if (round > saved.best) { saved.best = round; save(); }
        setStatus("Nice. Round " + round + " cleared.");
        render();
        later(sfx.win, 250);
        later(nextRound, 1000);
      }
    } else {
      gameOver();
    }
  }
  function gameOver() {
    clearTimers();
    state = "over";
    const reached = round - 1;
    sfx.lose();
    board.classList.remove("shake"); void board.offsetWidth; board.classList.add("shake");
    setStatus("Wrong lantern. You cleared " + Math.max(0, reached) + " round" + (reached === 1 ? "" : "s") + ". Press Restart.");
    if (reached > saved.best) { saved.best = reached; save(); }
    render();
  }
  function togglePause() {
    if (state === "paused") {
      if (prevState === "showing") { playSequence(); return; } // replay so the player never misses a flash
      state = "input"; setStatus("Your turn. Repeat the order."); render();
    } else if (state === "showing" || state === "input") {
      prevState = state; clearTimers();
      lanterns.forEach((l) => l.classList.remove("lit"));
      state = "paused"; setStatus("Paused."); render();
    }
  }

  // ---- Reset data (two taps to confirm, no popup) ----
  let resetArmed = false, resetTimer = null;
  function disarmReset() { resetArmed = false; resetBtn.classList.remove("confirm"); resetBtn.textContent = "Reset data"; clearTimeout(resetTimer); }
  resetBtn.addEventListener("click", () => {
    if (!resetArmed) {
      resetArmed = true; resetBtn.classList.add("confirm"); resetBtn.textContent = "Tap again to confirm";
      resetTimer = setTimeout(disarmReset, 3000); return;
    }
    disarmReset();
    saved = { best: 0, muted: false };
    try { localStorage.removeItem(KEY); } catch (e) {}
    setStatus("Saved data cleared."); render();
  });

  // ---- Events ----
  lanterns.forEach((l) => l.addEventListener("pointerdown", (e) => { e.preventDefault(); press(Number(l.dataset.i)); }));
  lanterns.forEach((l) => l.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); })); // keys handled globally
  startBtn.addEventListener("click", startGame);
  pauseBtn.addEventListener("click", togglePause);
  muteBtn.addEventListener("click", () => { saved.muted = !saved.muted; save(); if (!saved.muted) sfx.click(); render(); });
  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.key >= "1" && e.key <= "4") press(Number(e.key) - 1);
    else if (e.code === "Space" && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); togglePause(); }
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && (state === "showing" || state === "input")) togglePause(); });
  window.addEventListener("resize", () => { sparks.replaceChildren(); }); // clear stale particle positions

  load(); render();
})();
