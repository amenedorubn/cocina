// Voz (speechSynthesis es-ES), pitidos, vibración, y desbloqueo al primer toque.
const Voice = (() => {
  let audioCtx = null;
  let esVoice = null;
  let unlocked = false;

  function ctx() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function pickVoice() {
    try {
      const v = speechSynthesis.getVoices();
      esVoice = v.find(x => x.lang === 'es-ES') || v.find(x => x.lang && x.lang.startsWith('es')) || null;
    } catch (e) {}
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  function beep(n = 3, f = 880) {
    const c = ctx();
    if (!c) return;
    let t = c.currentTime;
    for (let i = 0; i < n; i++) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + 0.2);
      t += 0.28;
    }
  }

  function buzz(pattern) {
    try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) {}
  }

  function say(text) {
    const prefs = Store.prefs();
    if (!prefs.voice || !('speechSynthesis' in window) || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-ES';
      if (esVoice) u.voice = esVoice;
      u.rate = 1.02;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    ctx();
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  return { ctx, beep, buzz, say, unlock };
})();
