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
        animation: { duration: 420 },
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

Object.assign(window, { ChartCanvas, mixColor });
