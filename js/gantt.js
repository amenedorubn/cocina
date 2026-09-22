// Diagrama de carriles (fuego / manos / micro / reposo) a partir de plan_gantt.
const LANES = {
  fuego: { n: 'Fuego', c: 'var(--fuego)' },
  manos: { n: 'Manos', c: 'var(--manos)' },
  micro: { n: 'Micro', c: 'var(--micro)' },
  reposo: { n: 'Reposo', c: 'var(--reposo)' },
};

function renderGantt(el, plan, totalMin, currentStep) {
  if (!plan || !plan.length) { el.innerHTML = ''; return; }
  const usedLanes = Object.keys(LANES).filter(k => plan.some(p => p.carril === k));
  const total = totalMin || Math.max(...plan.map(p => p.hasta_min));
  let h = '';
  for (const k of usedLanes) {
    h += `<div class="lane"><span style="color:${LANES[k].c}">${LANES[k].n}</span><div class="track">`;
    plan.filter(p => p.carril === k).forEach(p => {
      const cls = currentStep == null ? '' : (p.paso === currentStep ? 'now' : (p.paso < currentStep ? 'done' : ''));
      const left = p.desde_min / total * 100;
      const width = (p.hasta_min - p.desde_min) / total * 100;
      h += `<div class="seg ${cls}" style="left:${left}%;width:${width}%;background:${LANES[k].c}">${p.etiqueta || ''}</div>`;
    });
    h += '</div></div>';
  }
  const step = Math.max(1, Math.round(total / 5));
  const marks = [];
  for (let m = 0; m <= total; m += step) marks.push(m);
  if (marks[marks.length - 1] !== total) marks.push(total);
  h += `<div class="ticks"><span></span><div>${marks.map(m => `<span>${m}${m === total ? ' min' : ''}</span>`).join('')}</div></div>`;
  el.innerHTML = h;
}
