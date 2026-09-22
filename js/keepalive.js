// EXPERIMENTAL: ¿un audio en bucle casi silencioso + Media Session mantiene
// vivos los avisos con la pantalla bloqueada en Chrome Android?
// Ver README.md, sección "Experimental". Se activa/desactiva con el
// interruptor en la pantalla de inicio de una receta; no está activo por defecto.
const KeepAlive = (() => {
  let audioEl = null;
  let running = false;

  function buildQuietLoopDataUri(seconds = 2, sampleRate = 8000, freq = 220, amplitude = 0.02) {
    const n = seconds * sampleRate;
    const bytesPerSample = 2;
    const blockAlign = bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = n * bytesPerSample;
    const buf = new ArrayBuffer(44 + dataSize);
    const v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, sampleRate, true);
    v.setUint32(28, byteRate, true); v.setUint16(32, blockAlign, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, dataSize, true);
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const fade = Math.min(1, i / 200, (n - i) / 200);
      const s = Math.sin(2 * Math.PI * freq * t) * amplitude * fade;
      v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 32767, true);
    }
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return 'data:audio/wav;base64,' + btoa(binary);
  }

  function start(recipeTitle) {
    if (running) return;
    running = true;
    if (!audioEl) {
      audioEl = new Audio(buildQuietLoopDataUri());
      audioEl.loop = true;
      audioEl.setAttribute('playsinline', '');
    }
    audioEl.play().catch(() => {});
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: recipeTitle || 'Cocinando',
          artist: 'Copiloto Cocina',
        });
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setActionHandler('play', () => audioEl.play().catch(() => {}));
        navigator.mediaSession.setActionHandler('pause', () => {});
        navigator.mediaSession.setActionHandler('stop', () => stop());
      } catch (e) {}
    }
  }

  function stop() {
    running = false;
    if (audioEl) { try { audioEl.pause(); } catch (e) {} }
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.metadata = null;
      } catch (e) {}
    }
  }

  return { start, stop, isRunning: () => running };
})();
