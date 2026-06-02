/* ====================================================================
   ChartCanvas — thin React wrapper around Chart.js (loaded globally as
   window.Chart). Recreates the chart whenever type/data/options change
   and tears it down on unmount. Used by the Dashboard + Leaderboard.
==================================================================== */
const { useRef: useRefCh, useEffect: useEffectCh } = React;

if (window.Chart) {
  Chart.defaults.color = '#aab2dd';
  Chart.defaults.borderColor = 'rgba(120,140,230,.14)';
  Chart.defaults.font.family = 'IBM Plex Sans';
  Chart.defaults.font.size = 11;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10,15,34,.95)';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(140,165,255,.3)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  // (No canvas shadowBlur glow — it's GPU-expensive. Depth comes from the cheap
  //  gradient fills below instead, same idea as the transform-only celebration.)
  // clean dashed design-strength reference line (drawn, NOT a legend entry)
  Chart.register({
    id: 'fcLine',
    afterDatasetsDraw(chart, args, opts) {
      const v = opts && opts.value; if (!v) return;
      const y = chart.scales.y; if (!y) return;
      const py = y.getPixelForValue(v);
      const { left, right, top, bottom } = chart.chartArea;
      if (py < top || py > bottom) return;
      const ctx = chart.ctx; ctx.save();
      ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(right, py);
      ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(180,190,235,.5)'; ctx.stroke();
      ctx.setLineDash([]); ctx.font = '600 10px "IBM Plex Mono"'; ctx.fillStyle = 'rgba(232,236,255,.82)'; ctx.textAlign = 'right';
      ctx.fillText("design f'c " + Number(v).toLocaleString(), right - 6, py - 5);
      ctx.restore();
    },
  });
}

/* %f'c → [hue, chroma] for pass-coded gradients (green ≥100, amber ≥85, red below) */
function tierStops(pct) {
  if (pct == null) return [250, 0.06];
  if (pct >= 100) return [155, 0.15];
  if (pct >= 85) return [70, 0.14];
  return [18, 0.19];
}
/* scriptable vertical-gradient bar fill, coloured by each value's %f'c */
function strengthBarColor(values, fc) {
  return (c) => {
    const area = c.chart.chartArea; if (!area) return 'rgba(74,142,255,.5)';
    const v = values[c.dataIndex]; const pct = (v != null && fc) ? v / fc * 100 : null;
    const [h, ch] = tierStops(pct);
    const g = c.chart.ctx.createLinearGradient(0, area.bottom, 0, area.top);
    g.addColorStop(0, `oklch(.5 ${ch} ${h} / .18)`);
    g.addColorStop(0.5, `oklch(.7 ${ch} ${h} / .8)`);
    g.addColorStop(1, `oklch(.88 ${ch} ${h} / 1)`);
    return g;
  };
}
/* translucent area fill under a line for depth (top→transparent) */
function lineAreaGrad(color) {
  return (c) => {
    const area = c.chart.chartArea; if (!area) return 'transparent';
    const g = c.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, color.replace(/\)\s*$/, ' / .26)'));
    g.addColorStop(1, color.replace(/\)\s*$/, ' / 0)'));
    return g;
  };
}

function ChartCanvas({ type, data, options, height = 240 }) {
  const ref = useRefCh(null);
  const chart = useRefCh(null);
  const key = JSON.stringify({ type, data, options });
  useEffectCh(() => {
    if (!window.Chart || !ref.current) return;
    chart.current = new window.Chart(ref.current.getContext('2d'), {
      type,
      data,
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 700, easing: 'easeOutQuart' },
        ...options,
      },
    });
    return () => { if (chart.current) { chart.current.destroy(); chart.current = null; } };
  }, [key]);
  return (
    <div style={{ position: 'relative', height }}>
      <canvas ref={ref}></canvas>
    </div>
  );
}

/* hue helpers so chart series match the strength-tier colours */
function mixColor(mix) {
  const h = mix ? window.accentForStrength(mix.fc) : 220;
  return `oklch(.78 .15 ${h})`;
}

Object.assign(window, { ChartCanvas, mixColor, strengthBarColor, lineAreaGrad });
