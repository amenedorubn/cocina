// Wake Lock de pantalla, con re-adquisición al volver a primer plano.
const WakeLock = (() => {
  let sentinel = null;
  let wanted = false;
  let onChange = () => {};

  async function acquire() {
    wanted = true;
    if (!('wakeLock' in navigator)) { onChange('manual'); return; }
    try {
      sentinel = await navigator.wakeLock.request('screen');
      onChange('ok');
      sentinel.addEventListener('release', () => { if (wanted) onChange('released'); else onChange('off'); });
    } catch (e) { onChange('manual'); }
  }

  function release() {
    wanted = false;
    try { sentinel && sentinel.release(); } catch (e) {}
    sentinel = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wanted && (!sentinel || sentinel.released)) acquire();
  });

  return {
    acquire, release,
    onStatus(fn) { onChange = fn; },
  };
})();
