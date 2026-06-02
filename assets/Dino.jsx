/* ====================================================================
   Dino — a compact Chrome-dino clone, deep-space styled.
   Canvas game: jump (Space / ↑ / click) over obstacles, score climbs,
   speed ramps. High score persists in localStorage.
==================================================================== */
const { useRef, useEffect, useState, useCallback } = React;

function DinoGame({ compact }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const [hi, setHi] = useState(() => +(localStorage.getItem('dino_hi') || 0));

  const W = 300, H = compact ? 116 : 150, GROUND = H - 22;

  const reset = useCallback(() => {
    stateRef.current = {
      dy: 0, y: GROUND, jumping: false, ducking: false,
      obstacles: [], t: 0, speed: 4.2, spawn: 70, score: 0, alive: true,
      stars: Array.from({ length: 18 }, () => ({
        x: Math.random() * W, y: Math.random() * (GROUND - 10),
        r: Math.random() * 1.2 + .3, a: Math.random() * .5 + .2,
      })),
    };
  }, [GROUND]);

  const start = useCallback(() => {
    reset(); setOver(false); setScore(0); setRunning(true);
  }, [reset]);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (!s || !s.alive) { if (over || !running) start(); return; }
    if (!s.jumping) { s.dy = -10.4; s.jumping = true; }
  }, [over, running, start]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        // only swallow the key when the game has focus-ish (pointer over widget handled by App)
        if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
        e.preventDefault(); jump();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump]);

  useEffect(() => {
    if (!running) return;
    const ctx = canvasRef.current.getContext('2d');
    let raf;
    const css = getComputedStyle(document.documentElement);
    const cyan = css.getPropertyValue('--cyan') || '#5fd';
    const magenta = css.getPropertyValue('--magenta') || '#e5c';
    const ink = '#e8ecff';

    const loop = () => {
      const s = stateRef.current;
      if (!s) return;
      s.t++;
      // physics
      s.dy += 0.62; s.y += s.dy;
      if (s.y >= GROUND) { s.y = GROUND; s.dy = 0; s.jumping = false; }
      // spawn
      if (s.t % Math.round(s.spawn) === 0) {
        const tall = Math.random() < .35;
        s.obstacles.push({ x: W + 10, w: tall ? 12 : 16, h: tall ? 30 : 20 });
        s.spawn = Math.max(42, 72 - s.score * .04 + Math.random() * 18);
      }
      s.speed = 4.2 + s.score * 0.004;
      s.obstacles.forEach((o) => { o.x -= s.speed; });
      s.obstacles = s.obstacles.filter((o) => o.x + o.w > -4);
      s.score += 0.18;

      // collision (dino box ~ x 26..50)
      const dx0 = 26, dx1 = 48, dyTop = s.y - 26, dyBot = s.y;
      for (const o of s.obstacles) {
        const oy = GROUND - o.h;
        if (dx1 > o.x + 2 && dx0 < o.x + o.w - 2 && dyBot > oy + 2) {
          s.alive = false; break;
        }
      }

      // ---- draw ----
      ctx.clearRect(0, 0, W, H);
      // faint stars
      s.stars.forEach((st) => {
        st.x -= s.speed * .25; if (st.x < 0) st.x = W;
        ctx.fillStyle = `rgba(180,200,255,${st.a})`;
        ctx.fillRect(st.x, st.y, st.r, st.r);
      });
      // ground line
      ctx.strokeStyle = 'rgba(140,165,255,.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, GROUND + 1); ctx.lineTo(W, GROUND + 1); ctx.stroke();
      // ground ticks (parallax)
      ctx.fillStyle = 'rgba(140,165,255,.22)';
      for (let i = 0; i < 8; i++) {
        const gx = (W - ((s.t * s.speed * .6 + i * 46) % (W + 46)));
        ctx.fillRect(gx, GROUND + 6, 10, 2);
      }
      // obstacles (crystal cacti)
      s.obstacles.forEach((o) => {
        const oy = GROUND - o.h;
        const g = ctx.createLinearGradient(o.x, oy, o.x, GROUND);
        g.addColorStop(0, magenta); g.addColorStop(1, 'oklch(.5 .16 320)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(o.x + o.w / 2, oy);
        ctx.lineTo(o.x + o.w, GROUND);
        ctx.lineTo(o.x, GROUND);
        ctx.closePath(); ctx.fill();
      });
      // dino (rounded glowing block runner)
      const bob = s.jumping ? 0 : Math.sin(s.t * .3) * 1.2;
      ctx.save();
      ctx.shadowColor = cyan; ctx.shadowBlur = 10;
      ctx.fillStyle = ink;
      roundRect(ctx, 26, s.y - 26 + bob, 22, 26, 5); ctx.fill();
      ctx.restore();
      // eye
      ctx.fillStyle = '#0a0f22';
      ctx.fillRect(41, s.y - 21 + bob, 3, 3);
      // legs
      if (!s.jumping) {
        ctx.fillStyle = ink;
        const ph = Math.floor(s.t / 6) % 2;
        ctx.fillRect(29, s.y, 5, 4 - ph * 0);
        ctx.fillRect(40 - ph * 2, s.y, 5, 4);
      }

      setScore(Math.floor(s.score));
      if (!s.alive) {
        setRunning(false); setOver(true);
        const hs = Math.max(hi, Math.floor(s.score));
        setHi(hs); localStorage.setItem('dino_hi', hs);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, GROUND, hi]);

  // idle draw
  useEffect(() => {
    if (running) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(140,165,255,.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, GROUND + 1); ctx.lineTo(W, GROUND + 1); ctx.stroke();
    ctx.fillStyle = '#e8ecff';
    roundRect(ctx, 26, GROUND - 26, 22, 26, 5); ctx.fill();
    ctx.fillStyle = '#0a0f22'; ctx.fillRect(41, GROUND - 21, 3, 3);
  }, [running, over, GROUND]);

  return (
    <div className="dino" onMouseDown={(e) => { e.preventDefault(); jump(); }}>
      <div className="dino-head">
        <span className="dino-title">⊟ ORBIT RUNNER</span>
        <span className="dino-score mono">{String(score).padStart(5, '0')} · HI {String(hi).padStart(5, '0')}</span>
      </div>
      <div className="dino-stage">
        <canvas ref={canvasRef} width={W} height={H} style={{ width: '100%', height: H, display: 'block' }} />
        {(!running) && (
          <div className="dino-overlay">
            <div className="dino-msg disp">{over ? 'CRUNCHED' : 'BREAK TIME'}</div>
            <button className="dino-btn" onClick={(e) => { e.stopPropagation(); start(); }}>
              {over ? '↻ Run again' : '▶ Play'}
            </button>
            <div className="dino-hint mono">space / ↑ / click to jump</div>
          </div>
        )}
      </div>
      <style>{`
        .dino{padding:11px 12px 12px;}
        .dino-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;}
        .dino-title{font-family:var(--font-d);font-size:11px;letter-spacing:.12em;color:var(--ink-dim);}
        .dino-score{font-size:10px;color:var(--ink-faint);letter-spacing:.04em;}
        .dino-stage{position:relative;border-radius:var(--r-sm);overflow:hidden;
          background:linear-gradient(180deg,rgba(8,12,30,.6),rgba(12,18,44,.3));
          border:1px solid var(--line);cursor:pointer;}
        .dino-overlay{position:absolute;inset:0;display:flex;flex-direction:column;
          align-items:center;justify-content:center;gap:7px;
          background:rgba(8,12,28,.42);backdrop-filter:blur(2px);}
        .dino-msg{font-size:14px;letter-spacing:.18em;color:var(--ink);}
        .dino-btn{background:linear-gradient(180deg,oklch(.8 .13 205/.22),oklch(.8 .13 205/.08));
          border:1px solid var(--line-strong);color:var(--ink);border-radius:99px;
          padding:6px 16px;font-size:12px;font-weight:600;letter-spacing:.02em;
          box-shadow:0 0 18px -6px var(--glow-cyan);transition:transform .12s,box-shadow .2s;}
        .dino-btn:hover{transform:translateY(-1px);box-shadow:0 0 24px -4px var(--glow-cyan);}
        .dino-hint{font-size:9px;color:var(--ink-faint);letter-spacing:.06em;}
      `}</style>
    </div>
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

Object.assign(window, { DinoGame });
