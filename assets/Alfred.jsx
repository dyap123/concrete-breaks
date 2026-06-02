/* ====================================================================
   Alfred — quick-launch assistant. A ⌘K command palette plus a small
   presence in the left rail. Commands are supplied by App.
==================================================================== */
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA, useMemo: useMemoA } = React;

/* The orb that lives at the top of the left rail. */
function AlfredOrb({ onOpen, hint }) {
  return (
    <button className="alfred-orb" onClick={onOpen} title="Ask Alfred  ·  ⌘K">
      <span className="orb-core">
        <span className="orb-ring"></span>
        <span className="orb-dot"></span>
      </span>
      <span className="orb-text">
        <span className="orb-name disp">ALFRED</span>
        <span className="orb-hint mono">{hint || 'press ⌘K'}</span>
      </span>
      <span className="orb-kbd mono">⌘K</span>
      <style>{`
        .alfred-orb{display:flex;align-items:center;gap:11px;width:100%;
          padding:11px 12px;border-radius:var(--r-md);text-align:left;
          background:linear-gradient(135deg,rgba(20,28,62,.7),rgba(12,18,44,.5));
          border:1px solid var(--line);transition:border-color .2s,box-shadow .25s,transform .12s;}
        .alfred-orb:hover{border-color:var(--line-strong);box-shadow:0 0 26px -10px var(--glow-cyan);transform:translateY(-1px);}
        .orb-core{position:relative;width:30px;height:30px;flex:none;display:grid;place-items:center;}
        .orb-ring{position:absolute;inset:0;border-radius:50%;
          background:conic-gradient(from 0deg,var(--cyan),var(--violet),var(--magenta),var(--cyan));
          animation:spin 7s linear infinite;opacity:.9;
          -webkit-mask:radial-gradient(closest-side,transparent 64%,#000 66%);
          mask:radial-gradient(closest-side,transparent 64%,#000 66%);}
        .orb-dot{width:11px;height:11px;border-radius:50%;
          background:radial-gradient(circle at 35% 30%,#fff,var(--cyan));
          box-shadow:0 0 14px 2px var(--glow-cyan);animation:pulseGlow 2.6s ease-in-out infinite;}
        .orb-text{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;}
        .orb-name{font-size:12px;letter-spacing:.16em;color:var(--ink);}
        .orb-hint{font-size:9.5px;color:var(--ink-faint);letter-spacing:.04em;}
        .orb-kbd{font-size:10px;color:var(--ink-dim);border:1px solid var(--line);
          border-radius:6px;padding:3px 6px;background:rgba(8,12,28,.5);}
      `}</style>
    </button>
  );
}

/* The ⌘K palette modal. */
function AlfredPalette({ open, onClose, commands }) {
  const [q, setQ] = useStateA('');
  const [idx, setIdx] = useStateA(0);
  const inputRef = useRefA(null);

  useEffectA(() => {
    if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  const filtered = useMemoA(() => {
    const t = q.trim().toLowerCase();
    if (!t) return commands;
    return commands.filter((c) =>
      (c.label + ' ' + (c.group || '') + ' ' + (c.keywords || '')).toLowerCase().includes(t),
    );
  }, [q, commands]);

  useEffectA(() => { setIdx(0); }, [q]);

  const run = (c) => { if (!c) return; onClose(); setTimeout(() => c.action(), 0); };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(filtered[idx]); }
    else if (e.key === 'Escape') { onClose(); }
  };

  if (!open) return null;

  // group while preserving order
  const groups = [];
  filtered.forEach((c) => {
    let g = groups.find((x) => x.name === (c.group || ''));
    if (!g) { g = { name: c.group || '', items: [] }; groups.push(g); }
    g.items.push(c);
  });
  let flat = -1;

  return (
    <div className="alf-backdrop" onMouseDown={onClose}>
      <div className="alf-panel glass fadeUp" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="alf-search">
          <span className="alf-orb-mini"><span className="orb-dot" style={{ width: 8, height: 8 }}></span></span>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Ask Alfred or jump to anything…" className="alf-input" />
          <span className="alf-esc mono">esc</span>
        </div>
        <div className="alf-list scrollY">
          {groups.length === 0 && <div className="alf-empty mono">No matches. Try “export”, “mix”, “chat”…</div>}
          {groups.map((g) => (
            <div key={g.name} className="alf-group">
              {g.name && <div className="alf-glabel mono">{g.name}</div>}
              {g.items.map((c) => {
                flat++; const active = flat === idx;
                return (
                  <button key={c.id} className={'alf-item' + (active ? ' active' : '')}
                    onMouseEnter={() => setIdx(filtered.indexOf(c))} onClick={() => run(c)}>
                    <span className="alf-ic" style={c.hue != null ? { color: `oklch(.8 .14 ${c.hue})` } : null}>{c.icon}</span>
                    <span className="alf-label">{c.label}</span>
                    {c.note && <span className="alf-note mono">{c.note}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .alf-backdrop{position:fixed;inset:0;z-index:90;display:flex;justify-content:center;
          align-items:flex-start;padding-top:13vh;background:rgba(4,7,18,.62);
          backdrop-filter:blur(4px);animation:fadeUp .2s both;}
        .alf-panel{width:min(620px,92vw);max-height:64vh;display:flex;flex-direction:column;
          border-radius:var(--r-lg);border-color:var(--line-strong);box-shadow:var(--shadow),0 0 60px -28px var(--glow-cyan);overflow:hidden;}
        .alf-search{display:flex;align-items:center;gap:11px;padding:15px 16px;border-bottom:1px solid var(--line);}
        .alf-orb-mini{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;flex:none;
          background:conic-gradient(from 0deg,var(--cyan),var(--violet),var(--magenta),var(--cyan));}
        .alf-input{flex:1;background:none;border:none;outline:none;font-size:16px;color:var(--ink);}
        .alf-input::placeholder{color:var(--ink-faint);}
        .alf-esc{font-size:10px;color:var(--ink-faint);border:1px solid var(--line);border-radius:6px;padding:2px 7px;}
        .alf-list{padding:8px;}
        .alf-empty{padding:24px;text-align:center;color:var(--ink-faint);font-size:12px;}
        .alf-group{margin-bottom:6px;}
        .alf-glabel{font-size:9.5px;letter-spacing:.14em;color:var(--ink-faint);
          text-transform:uppercase;padding:8px 10px 4px;}
        .alf-item{display:flex;align-items:center;gap:12px;width:100%;text-align:left;
          padding:9px 11px;border-radius:var(--r-sm);background:none;border:1px solid transparent;transition:background .12s;}
        .alf-item.active{background:linear-gradient(90deg,oklch(.8 .13 205/.16),oklch(.72 .16 290/.08));border-color:var(--line);}
        .alf-ic{width:22px;text-align:center;font-size:15px;color:var(--ink-dim);flex:none;}
        .alf-label{flex:1;font-size:13.5px;color:var(--ink);}
        .alf-note{font-size:10.5px;color:var(--ink-faint);}
      `}</style>
    </div>
  );
}

Object.assign(window, { AlfredOrb, AlfredPalette });
