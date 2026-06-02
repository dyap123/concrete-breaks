/* ====================================================================
   Dino — a compact Chrome-dino clone, deep-space styled.
   Canvas game: jump (Space / ↑ / click) over obstacles, score climbs,
   speed ramps. High score persists in localStorage.
==================================================================== */
const { useRef, useEffect, useState, useCallback } = React;

function DinoGame({ compact, user, onHi }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const stateRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const [hi, setHi] = useState(() => +(localStorage.getItem('dino_hi') || 0));
  const [fs, setFs] = useState(false);        // native fullscreen (desktop)
  const [expanded, setExpanded] = useState(false); // CSS overlay fallback (iPad/iOS — no Fullscreen API)
  // keep latest callback/user without restarting the game loop
  const onHiRef = useRef(onHi); onHiRef.current = onHi;
  const userRef = useRef(user); userRef.current = user;

  // reflect this crew member's shared best from Firebase
  useEffect(() => { if (user && (user.dinoHi || 0) > hi) setHi(user.dinoHi); }, [user && user.dinoHi]);

  // fullscreen state + Esc/native changes
  useEffect(() => { const h = () => setFs(!!(document.fullscreenElement || document.webkitFullscreenElement)); document.addEventListener('fullscreenchange', h); document.addEventListener('webkitfullscreenchange', h); return () => { document.removeEventListener('fullscreenchange', h); document.removeEventListener('webkitfullscreenchange', h); }; }, []);
  const toggleFs = useCallback(() => {
    const el = stageRef.current; if (!el) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (expanded) { setExpanded(false); return; }
    // Prefer the native Fullscreen API; iPad/iPhone Safari lack it on non-video
    // elements, so fall back to a CSS overlay that fills the viewport.
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) { try { const p = req.call(el); if (p && p.catch) p.catch(() => setExpanded(true)); } catch (e) { setExpanded(true); } }
    else setExpanded(true);
  }, [expanded]);

  const W = 300, H = compact ? 116 : 150, GROUND = H - 22;

  const reset = useCallback(() => {
    stateRef.current = {
      dy: 0, y: GROUND, jumping: false, ducking: false,
      obstacles: [], t: 0, speed: 4.6, spawnT: 40, score: 0, alive: true,
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
    const ctx = canvasRef.current.getContext('2d', { alpha: false });
    let raf, last = performance.now(), lastScoreInt = -1;
    // Solid obstacle fill (no per-frame gradient / no shadowBlur — both are
    // expensive on weak GPUs and were the main cause of the stutter).
    const magenta = 'oklch(.66 .18 330)';
    const ink = '#e8ecff';

    const loop = (now) => {
      const s = stateRef.current;
      if (!s) return;
      // delta-time step (frames normalised to 60fps) so speed is identical
      // whether the machine runs at 60, 30, or anything in between.
      let dt = (now - last) / 16.667; last = now;
      if (dt > 3) dt = 3;            // clamp after a tab stall
      s.t += dt;

      // physics
      s.dy += 0.62 * dt; s.y += s.dy * dt;
      if (s.y >= GROUND) { s.y = GROUND; s.dy = 0; s.jumping = false; }

      // time-based spawn — gets more frequent as the score climbs
      s.spawnT = (s.spawnT || 0) - dt;
      if (s.spawnT <= 0) {
        const tall = Math.random() < .35;
        s.obstacles.push({ x: W + 10, w: tall ? 12 : 16, h: tall ? 30 : 20 });
        s.spawnT = Math.max(34, 96 - s.score * .10 + Math.random() * 16);
      }
      // steeper ramp — clearly faster the longer you survive (capped so it stays playable)
      s.speed = 4.6 + Math.min(s.score * 0.02, 9);
      s.obstacles.forEach((o) => { o.x -= s.speed * dt; });
      s.obstacles = s.obstacles.filter((o) => o.x + o.w > -4);
      s.score += 0.20 * dt;

      // collision
      const dx0 = 26, dx1 = 48, dyBot = s.y;
      for (const o of s.obstacles) {
        const oy = GROUND - o.h;
        if (dx1 > o.x + 2 && dx0 < o.x + o.w - 2 && dyBot > oy + 2) { s.alive = false; break; }
      }

      // ---- draw (opaque bg, flat fills, no blur) ----
      ctx.fillStyle = '#0b1026'; ctx.fillRect(0, 0, W, H);
      s.stars.forEach((st) => {
        st.x -= s.speed * .25 * dt; if (st.x < 0) st.x = W;
        ctx.fillStyle = `rgba(180,200,255,${st.a})`;
        ctx.fillRect(st.x, st.y, st.r, st.r);
      });
      ctx.strokeStyle = 'rgba(140,165,255,.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, GROUND + 1); ctx.lineTo(W, GROUND + 1); ctx.stroke();
      ctx.fillStyle = 'rgba(140,165,255,.22)';
      for (let i = 0; i < 8; i++) {
        const gx = (W - ((s.t * s.speed * .6 + i * 46) % (W + 46)));
        ctx.fillRect(gx, GROUND + 6, 10, 2);
      }
      ctx.fillStyle = magenta;
      s.obstacles.forEach((o) => {
        const oy = GROUND - o.h;
        ctx.beginPath();
        ctx.moveTo(o.x + o.w / 2, oy); ctx.lineTo(o.x + o.w, GROUND); ctx.lineTo(o.x, GROUND);
        ctx.closePath(); ctx.fill();
      });
      const bob = s.jumping ? 0 : Math.sin(s.t * .3) * 1.2;
      ctx.fillStyle = ink;
      roundRect(ctx, 26, s.y - 26 + bob, 22, 26, 5); ctx.fill();
      ctx.fillStyle = '#0a0f22'; ctx.fillRect(41, s.y - 21 + bob, 3, 3);
      if (!s.jumping) {
        ctx.fillStyle = ink;
        const ph = Math.floor(s.t / 6) % 2;
        ctx.fillRect(29, s.y, 5, 4);
        ctx.fillRect(40 - ph * 2, s.y, 5, 4);
      }

      // only re-render React when the displayed integer score changes
      const si = Math.floor(s.score);
      if (si !== lastScoreInt) { lastScoreInt = si; setScore(si); }
      if (!s.alive) {
        setRunning(false); setOver(true);
        const hs = Math.max(hi, si);
        setHi(hs); localStorage.setItem('dino_hi', hs);
        // push a new personal best to the shared leaderboard
        const u = userRef.current;
        if (onHiRef.current && u && si > (u.dinoHi || 0)) onHiRef.current(si);
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
    <div className="dino" onPointerDown={(e) => { e.preventDefault(); jump(); }}>
      <div className="dino-head">
        <span className="dino-title">⊟ BREAK RUNNER</span>
        <span className="dino-score mono">{String(score).padStart(5, '0')} · HI {String(hi).padStart(5, '0')}</span>
        <button className="dino-fs" onClick={(e) => { e.stopPropagation(); toggleFs(); }} title="Fullscreen">⛶</button>
      </div>
      <div className={'dino-stage' + (expanded ? ' dino-stage--full' : '')} ref={stageRef}>
        <canvas ref={canvasRef} width={W} height={H} style={{ width: '100%', height: H, display: 'block' }} />
        {expanded && <button className="dino-exit mono" onClick={(e) => { e.stopPropagation(); setExpanded(false); }}>✕ exit</button>}
        {(!running) && (
          <div className="dino-overlay">
            <div className="dino-msg disp">{over ? 'CRUNCHED' : 'BREAK TIME'}</div>
            <button className="dino-btn" onClick={(e) => { e.stopPropagation(); start(); }}>
              {over ? '↻ Run again' : '▶ Play'}
            </button>
            <div className="dino-hint mono">tap / space / ↑ to jump</div>
          </div>
        )}
      </div>
      <style>{`
        .dino{padding:11px 12px 12px;}
        .dino-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;}
        .dino-title{font-family:var(--font-d);font-size:11px;letter-spacing:.12em;color:var(--ink-dim);}
        .dino-score{font-size:10px;color:var(--ink-faint);letter-spacing:.04em;flex:1;text-align:right;}
        .dino-fs{font-size:12px;color:var(--ink-faint);border:1px solid var(--line);border-radius:6px;
          padding:1px 6px;line-height:1.2;transition:.12s;flex:none;}
        .dino-fs:hover{color:var(--cyan);border-color:var(--cyan);}
        .dino-stage:fullscreen,.dino-stage:-webkit-full-screen{display:flex;align-items:center;justify-content:center;
          background:#070a16;border-radius:0;border:none;}
        .dino-stage:fullscreen canvas,.dino-stage:-webkit-full-screen canvas{
          width:auto!important;height:90vh!important;max-width:98vw;image-rendering:pixelated;}
        .dino-stage:fullscreen .dino-overlay,.dino-stage:-webkit-full-screen .dino-overlay{backdrop-filter:none;}
        .dino-stage:fullscreen .dino-msg,.dino-stage:-webkit-full-screen .dino-msg{font-size:28px;}
        /* CSS pseudo-fullscreen — fallback for iPad/iOS (no Fullscreen API on non-video) */
        .dino-stage--full{position:fixed;inset:0;z-index:300;background:#070a16;border-radius:0;border:none;
          display:flex;align-items:center;justify-content:center;touch-action:none;}
        .dino-stage--full canvas{width:auto!important;height:88vh!important;max-width:98vw;image-rendering:pixelated;}
        .dino-stage--full .dino-msg{font-size:28px;}
        .dino-exit{position:fixed;top:max(14px,env(safe-area-inset-top));right:14px;z-index:301;
          font-size:12px;color:var(--ink-dim);background:rgba(8,12,28,.7);border:1px solid var(--line-strong);
          border-radius:99px;padding:8px 14px;letter-spacing:.04em;}
        .dino-exit:hover{color:var(--ink);border-color:var(--cyan);}
        .dino-stage{position:relative;border-radius:var(--r-sm);overflow:hidden;
          background:linear-gradient(180deg,rgba(8,12,30,.6),rgba(12,18,44,.3));
          border:1px solid var(--line);cursor:pointer;}
        .dino-overlay{position:absolute;inset:0;display:flex;flex-direction:column;
          align-items:center;justify-content:center;gap:7px;
          background:rgba(8,12,28,.42);backdrop-filter:blur(2px);}
        .dino-msg{font-size:14px;letter-spacing:.18em;color:var(--ink);}
        .dino-btn{background:linear-gradient(180deg,oklch(.8 .13 205/.22),oklch(.8 .13 205/.08));
          border:1px solid var(--line-strong);color:var(--ink);border-radius:99px;
          padding:6px 16px;font-size:12px;font-weight:600;letter-spacing:.02em;transition:transform .12s,filter .15s;}
        .dino-btn:hover{transform:translateY(-1px);filter:brightness(1.1);}
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
