/* ====================================================================
   App — composes the rail (Alfred + nav + dino), the workspace
   (mix select / entry / records), the chat panel and the ⌘K palette.
   Entries & custom mixes persist in localStorage.
==================================================================== */
const { useState: useStateApp, useEffect: useEffectApp, useMemo: useMemoApp, useCallback: useCbApp } = React;

/* Shared backend via window.fb (Firebase RTDB, namespaced concrete-breaks/).
   Only the signed-in user id stays on the device; entries, custom mixes and
   the crew/points roster live in Firebase so the leaderboard is shared. */
const LS_CURRENT = 'orbital_current_v1';
const fb = window.fb;
/* Danzel is the fixed mission manager + GOAT; seeded once if the roster is empty. */
const SEED_MANAGER = { name: 'Danzel', role: 'manager', points: 0, goat: true, joined: 0 };
const sortByCreated = (o) => Object.entries(o || {}).map(([id, v]) => ({ ...v, id })).sort((a, b) => (a.created || a.joined || 0) - (b.created || b.joined || 0));

function App() {
  const [view, setView] = useStateApp('mix'); // mix | entry | records | leaderboard
  const [entries, setEntries] = useStateApp([]);
  const [customMixes, setCustomMixes] = useStateApp([]);
  const [users, setUsers] = useStateApp([]);
  const [currentId, setCurrentId] = useStateApp(() => localStorage.getItem(LS_CURRENT) || null);
  const [activeMix, setActiveMix] = useStateApp(null);
  const [current, setCurrent] = useStateApp(null);
  const [chatOpen, setChatOpen] = useStateApp(false);
  const [paletteOpen, setPaletteOpen] = useStateApp(false);
  const [toast, setToast] = useStateApp(null);

  const mixes = useMemoApp(() => [...window.MIX_DESIGNS, ...customMixes], [customMixes]);

  /* ---- Firebase subscriptions (shared, real-time) ---- */
  useEffectApp(() => {
    fb.listen('entries', (v) => setEntries(sortByCreated(v)));
    fb.listen('customMixes', (v) => setCustomMixes(Object.values(v || {})));
    fb.listen('users', (v) => {
      const list = sortByCreated(v);
      if (!list.length) { fb.set('users/u_danzel', SEED_MANAGER); return; } // seed manager once
      setUsers(list);
    });
  }, []);

  useEffectApp(() => {
    if (currentId) localStorage.setItem(LS_CURRENT, currentId);
    else localStorage.removeItem(LS_CURRENT);
  }, [currentId]);

  const currentUser = useMemoApp(() => users.find((u) => u.id === currentId) || null, [users, currentId]);

  const counts = useMemoApp(() => {
    const c = {}; entries.forEach((e) => { c[e.mix] = (c[e.mix] || 0) + 1; }); return c;
  }, [entries]);

  const flash = useCbApp((msg) => { setToast(msg); setTimeout(() => setToast(null), 2400); }, []);

  /* ---- navigation actions ---- */
  const startEntry = useCbApp((mix) => {
    setActiveMix(mix); setCurrent(window.blankEntry(mix)); setView('entry');
  }, []);
  const gotoMix = useCbApp(() => { setView('mix'); setCurrent(null); }, []);
  const saveEntry = useCbApp((entry) => {
    const isNew = !entries.some((e) => e.id === entry.id);
    const record = isNew
      ? { ...entry, loggedBy: currentId, loggedByName: currentUser?.name, created: entry.created || Date.now() }
      : { ...entry };
    fb.set('entries/' + entry.id, record);
    if (isNew && currentId) {
      fb.inc('users/' + currentId + '/points', 1); // atomic — shared leaderboard
      const before = currentUser ? window.rankFor(currentUser.points).title : '';
      const after = currentUser ? window.rankFor((currentUser.points || 0) + 1).title : '';
      flash(after !== before ? `+1 · ${currentUser.name} promoted to ${after}!` : `+1 point · ${currentUser?.name}`);
    } else {
      flash('Record updated · ' + (entry.mix || 'mix'));
    }
    setView('records');
  }, [flash, currentId, currentUser, entries]);
  const addMix = useCbApp((m) => { fb.set('customMixes/' + m.code, m); flash('Mix ' + m.code + ' added'); }, [flash]);
  const editEntry = useCbApp((e) => {
    setActiveMix(mixes.find((m) => m.code === e.mix) || null); setCurrent(e); setView('entry');
  }, [mixes]);
  const deleteEntry = useCbApp((id) => fb.remove('entries/' + id), []);

  /* ---- crew / auth ---- */
  const signIn = useCbApp((id) => { setCurrentId(id); setView('mix'); }, []);
  const signOut = useCbApp(() => { setCurrentId(null); setView('mix'); }, []);
  const addUser = useCbApp((name) => {
    const id = 'u_' + Math.random().toString(36).slice(2, 8);
    fb.set('users/' + id, { name, role: 'intern', points: 0, goat: false, joined: Date.now() });
    setCurrentId(id); setView('mix');
  }, []);

  /* ---- export ---- */
  const exportCSV = useCbApp(() => {
    if (!entries.length) { flash('No records to export yet'); return; }
    const csv = window.entriesToCSV(entries);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `break-records-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    flash(`Exported ${entries.length} record${entries.length === 1 ? '' : 's'} → CSV`);
  }, [entries, flash]);

  const copyTSV = useCbApp(async () => {
    if (!entries.length) { flash('No records to copy'); return; }
    const tsv = window.entriesToCSV(entries).split('\n')
      .map((line) => line.replace(/","/g, '\t').replace(/^"|"$/g, '').replace(/,/g, '\t')).join('\n');
    try { await navigator.clipboard.writeText(tsv); flash('Copied — paste into the matrix sheet'); }
    catch { flash('Copy blocked by browser'); }
  }, [entries, flash]);

  /* ---- ⌘K ---- */
  useEffectApp(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const commands = useMemoApp(() => {
    const cmds = [
      { id: 'new', group: 'Actions', icon: '✦', label: 'New break record', note: 'pick a mix', action: gotoMix },
      { id: 'records', group: 'Actions', icon: '▤', label: 'View records', note: `${entries.length}`, action: () => setView('records') },
      { id: 'leaderboard', group: 'Actions', icon: '★', label: 'Open leaderboard', action: () => setView('leaderboard') },
      { id: 'chat', group: 'Actions', icon: '◍', label: 'Open Mission Control chat', action: () => setChatOpen(true) },
      { id: 'export', group: 'Data', icon: '⭳', label: 'Export all records to CSV', action: exportCSV },
      { id: 'copy', group: 'Data', icon: '⎘', label: 'Copy records for the matrix sheet', action: copyTSV },
      { id: 'signout', group: 'Data', icon: '⏻', label: 'Sign out', note: currentUser?.name, action: signOut },
    ];
    mixes.forEach((m) => cmds.push({
      id: 'mix-' + m.code, group: 'Log a mix', icon: '◆', hue: m.accent,
      label: m.code, note: `${m.fc} psi · ${m.use}`, keywords: m.use, action: () => startEntry(m),
    }));
    return cmds;
  }, [mixes, entries.length, gotoMix, exportCSV, copyTSV, startEntry, currentUser, signOut]);

  /* ---- sign-in gate ---- */
  if (!currentUser) {
    return (
      <window.AuthGate users={users} onSignIn={signIn} onAddUser={addUser} />
    );
  }

  return (
    <div className="shell">
      {/* ---------- LEFT RAIL ---------- */}
      <nav className="rail glass">
        <div className="rail-brand">
          <span className="brand-mark"><span></span></span>
          <div>
            <div className="brand-name disp">ORBITAL</div>
            <div className="brand-sub mono">break logger</div>
          </div>
        </div>

        <window.AlfredOrb onOpen={() => setPaletteOpen(true)} hint={`${entries.length} records · ⌘K`} />

        <button className="crew-chip" onClick={() => setView('leaderboard')} title="View leaderboard">
          <window.Avatar name={currentUser.name} size={32} manager={currentUser.role === 'manager'} />
          <div className="chip-info">
            <span className="chip-name">{currentUser.name}</span>
            <span className="chip-rank mono">{window.rankFor(currentUser.points).title}</span>
          </div>
          <span className="chip-pts mono">{currentUser.points}<span>pt</span></span>
        </button>

        <div className="rail-nav">
          <RailBtn active={view === 'mix' || view === 'entry'} icon="✦" label="New record" onClick={gotoMix} />
          <RailBtn active={view === 'records'} icon="▤" label="Records" badge={entries.length} onClick={() => setView('records')} />
          <RailBtn active={view === 'leaderboard'} icon="★" label="Leaderboard" onClick={() => setView('leaderboard')} />
          <RailBtn active={false} icon="◍" label="Mission Control" onClick={() => setChatOpen(true)} />
        </div>

        <div className="rail-data">
          <button className="data-btn" onClick={exportCSV}><span>⭳</span> Export CSV</button>
          <button className="data-btn" onClick={copyTSV}><span>⎘</span> Copy for sheet</button>
        </div>

        <div className="rail-spacer"></div>

        <window.DinoGame compact />

        <div className="rail-foot mono">
          <button className="signout" onClick={signOut} title="Sign out">⏻ sign out</button>
          <span className="foot-spacer"></span>
          <span className="foot-dot"></span> ready
        </div>
      </nav>

      {/* ---------- WORKSPACE ---------- */}
      <main className="work">
        {view === 'mix' && (
          <window.MixSelect mixes={mixes} counts={counts} onPick={startEntry} onAddMix={addMix} />
        )}
        {view === 'entry' && current && (
          <window.EntryForm entry={current} mix={activeMix} onSave={saveEntry} onCancel={gotoMix} onChangeMix={gotoMix} />
        )}
        {view === 'records' && (
          <RecordsView entries={entries} mixes={mixes} onNew={gotoMix} onEdit={editEntry}
            onDelete={deleteEntry} onExport={exportCSV} onCopy={copyTSV} />
        )}
        {view === 'leaderboard' && (
          <window.Leaderboard users={users} entries={entries} currentId={currentId} onLog={gotoMix} />
        )}
      </main>

      {/* ---------- CHAT TAB ---------- */}
      {!chatOpen && (
        <button className="chat-tab" onClick={() => setChatOpen(true)}>
          <span className="chat-tab-orb"></span>
          <span className="chat-tab-lab">ALFRED</span>
        </button>
      )}

      <window.ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} entries={entries} />
      <window.AlfredPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />

      {toast && <div className="toast glass mono">{toast}</div>}

      <AppStyles />
    </div>
  );
}

function RailBtn({ active, icon, label, badge, onClick }) {
  return (
    <button className={'rbtn' + (active ? ' active' : '')} onClick={onClick}>
      <span className="rbtn-ic">{icon}</span>
      <span className="rbtn-lab">{label}</span>
      {badge != null && badge > 0 && <span className="rbtn-badge mono">{badge}</span>}
    </button>
  );
}

/* ---- records view ---- */
function RecordsView({ entries, mixes, onNew, onEdit, onDelete, onExport, onCopy }) {
  return (
    <div className="rec scrollY">
      <div className="rec-inner">
        <header className="rec-head fadeUp">
          <div>
            <div className="ms-eyebrow mono">◇ SESSION LOG</div>
            <h1 className="ms-h1 disp">Records</h1>
          </div>
          <div className="rec-actions">
            <button className="btn-ghost" onClick={onCopy} disabled={!entries.length}>⎘ Copy for sheet</button>
            <button className="btn-ghost" onClick={onExport} disabled={!entries.length}>⭳ CSV</button>
            <button className="btn-primary" onClick={onNew}><span>✦ New record</span></button>
          </div>
        </header>

        {!entries.length ? (
          <div className="rec-empty glass fadeUp">
            <div className="rec-empty-orb"></div>
            <div className="rec-empty-title disp">No records yet</div>
            <p>Pick a mix design and log your first set of cylinder breaks. Everything stays on this device until you export.</p>
            <button className="btn-primary" onClick={onNew}><span>Select a mix →</span></button>
          </div>
        ) : (
          <div className="rec-list">
            {[...entries].reverse().map((e) => {
              const mix = mixes.find((m) => m.code === e.mix);
              const r = window.computeResults(e, mix);
              const da = r.designAge && r.ages[r.designAge] ? r.ages[r.designAge].avg : null;
              return (
                <div key={e.id} className="rec-card fadeUp" style={{ '--h': mix?.accent ?? 240 }} onClick={() => onEdit(e)}>
                  <div className="rec-c-mix">
                    <span className="rec-c-code disp">{e.mix || '—'}</span>
                    <span className="rec-c-pour mono">pour {e.pourNumber || '?'}</span>
                  </div>
                  <div className="rec-c-meta">
                    <span>{e.element || 'element ?'}</span><span className="dot">·</span>
                    <span>{e.area || 'area ?'}</span><span className="dot">·</span>
                    <span className="mono">{e.pourDate || 'no date'}</span>
                  </div>
                  <div className="rec-c-ages">
                    {window.BREAK_AGES.map((age) => {
                      const v = r.ages[age].avg;
                      return (
                        <div key={age} className={'rec-age' + (age === r.designAge ? ' design' : '')}>
                          <span className="rec-age-l mono">{age}d</span>
                          <span className="rec-age-v mono">{v !== null ? window.fmt(v) : '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="rec-c-status">
                    <span className={'rec-pill ' + (r.met === null ? 'na' : r.met ? 'met' : 'no')}>
                      {r.met === null ? 'pending' : r.met ? 'met f\'c' : 'below f\'c'}
                    </span>
                    {da !== null && <span className="rec-da mono">{window.fmt(da)} psi @ {r.designAge}d</span>}
                    {e.ncr && <span className="rec-pill warn">NCR</span>}
                  </div>
                  <button className="rec-del" title="Delete" onClick={(ev) => { ev.stopPropagation(); onDelete(e.id); }}>✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AppStyles() {
  return <style>{`
    .shell{display:flex;height:100%;gap:0;}
    /* rail */
    .rail{width:268px;flex:none;height:100%;display:flex;flex-direction:column;gap:14px;
      padding:18px 16px;border-right:1px solid var(--line);border-top:none;border-bottom:none;border-left:none;}
    .rail-brand{display:flex;align-items:center;gap:11px;padding:2px 4px 4px;}
    .brand-mark{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:none;
      background:radial-gradient(circle at 30% 25%,var(--cyan),var(--violet) 70%,var(--magenta));
      box-shadow:0 0 22px -4px var(--glow-cyan);}
    .brand-mark span{width:11px;height:11px;border-radius:50%;background:#06122a;}
    .brand-name{font-size:16px;letter-spacing:.2em;color:var(--ink);}
    .brand-sub{font-size:9.5px;letter-spacing:.1em;color:var(--ink-faint);margin-top:1px;}
    /* crew chip */
    .crew-chip{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:var(--r-md);
      background:rgba(16,23,52,.5);border:1px solid var(--line);transition:.15s;text-align:left;}
    .crew-chip:hover{border-color:var(--line-strong);background:rgba(22,30,64,.65);}
    .chip-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}
    .chip-name{font-size:12.5px;color:var(--ink);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .chip-rank{font-size:9px;color:var(--ink-faint);letter-spacing:.04em;}
    .chip-pts{font-size:15px;color:var(--cyan);font-family:var(--font-m);display:flex;flex-direction:column;align-items:flex-end;line-height:1;}
    .chip-pts span{font-size:7.5px;color:var(--ink-faint);}
    .rail-nav{display:flex;flex-direction:column;gap:4px;}
    .rbtn{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--r-md);
      background:none;border:1px solid transparent;color:var(--ink-dim);text-align:left;transition:.15s;}
    .rbtn:hover{background:rgba(20,28,62,.5);color:var(--ink);}
    .rbtn.active{background:linear-gradient(90deg,oklch(.8 .13 205/.16),transparent);
      border-color:var(--line);color:var(--ink);}
    .rbtn.active .rbtn-ic{color:var(--cyan);}
    .rbtn-ic{width:18px;text-align:center;font-size:14px;color:var(--ink-faint);}
    .rbtn-lab{flex:1;font-size:13px;font-weight:500;}
    .rbtn-badge{font-size:10px;background:oklch(.8 .13 205/.18);color:var(--cyan);
      border-radius:99px;padding:2px 7px;min-width:20px;text-align:center;}
    .rail-data{display:flex;flex-direction:column;gap:6px;padding:2px;}
    .data-btn{display:flex;align-items:center;gap:9px;font-size:11.5px;color:var(--ink-dim);
      padding:8px 11px;border-radius:9px;background:rgba(8,12,28,.4);border:1px solid var(--line);transition:.15s;}
    .data-btn span{font-size:13px;}
    .data-btn:hover{color:var(--ink);border-color:var(--line-strong);}
    .rail-spacer{flex:1;min-height:8px;}
    .rail-foot{display:flex;align-items:center;gap:7px;font-size:9px;color:var(--ink-faint);
      letter-spacing:.04em;padding:2px 4px;}
    .foot-spacer{flex:1;}
    .signout{font-family:var(--font-m);font-size:9px;color:var(--ink-faint);background:none;border:none;
      padding:2px;letter-spacing:.04em;transition:.15s;}
    .signout:hover{color:var(--red);}
    .foot-dot{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);}
    /* workspace */
    .work{flex:1;min-width:0;height:100%;position:relative;}
    /* chat tab */
    .chat-tab{position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:60;
      display:flex;flex-direction:column;align-items:center;gap:9px;padding:14px 9px;
      background:var(--panel);backdrop-filter:blur(14px);border:1px solid var(--line-strong);border-right:none;
      border-radius:14px 0 0 14px;box-shadow:-14px 0 40px -24px #000;transition:padding .2s,box-shadow .2s;}
    .chat-tab:hover{padding-right:13px;box-shadow:-14px 0 44px -18px var(--glow-cyan);}
    .chat-tab-orb{width:16px;height:16px;border-radius:50%;
      background:radial-gradient(circle at 35% 30%,#fff,var(--cyan) 45%,var(--violet));
      box-shadow:0 0 14px -2px var(--glow-cyan);animation:pulseGlow 3s infinite;}
    .chat-tab-lab{writing-mode:vertical-rl;font-family:var(--font-d);font-size:11px;letter-spacing:.18em;color:var(--ink-dim);}
    /* toast */
    .toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%);z-index:95;
      padding:12px 20px;border-radius:99px;font-size:12.5px;color:var(--ink);border-color:var(--line-strong);
      box-shadow:var(--shadow),0 0 30px -14px var(--glow-cyan);animation:fadeUp .3s both;}
    /* records */
    .rec{height:100%;}
    .rec-inner{max-width:1000px;margin:0 auto;padding:48px 40px 60px;}
    .rec-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:28px;}
    .rec-actions{display:flex;gap:10px;align-items:center;}
    .rec-actions .btn-ghost{padding:9px 14px;font-size:12px;}
    .rec-actions .btn-ghost:disabled{opacity:.4;cursor:not-allowed;}
    .rec-empty{border-radius:var(--r-lg);padding:48px;text-align:center;display:flex;
      flex-direction:column;align-items:center;gap:14px;border-color:var(--line-strong);}
    .rec-empty-orb{width:56px;height:56px;border-radius:50%;
      background:radial-gradient(circle at 35% 30%,var(--cyan),var(--violet) 70%,transparent);
      box-shadow:0 0 40px -8px var(--glow-cyan);animation:pulseGlow 3s infinite;}
    .rec-empty-title{font-size:20px;}
    .rec-empty p{max-width:420px;margin:0;color:var(--ink-dim);font-size:14px;line-height:1.6;}
    .rec-empty .btn-primary{margin-top:6px;}
    .rec-list{display:flex;flex-direction:column;gap:12px;}
    .rec-card{position:relative;display:grid;
      grid-template-columns:160px 1fr auto auto;gap:18px;align-items:center;
      padding:16px 20px;border-radius:var(--r-md);cursor:pointer;
      background:linear-gradient(120deg,rgba(20,28,62,.5),rgba(11,16,40,.4));
      border:1px solid var(--line);transition:.16s;}
    .rec-card:hover{border-color:oklch(.8 .14 var(--h)/.5);transform:translateX(3px);
      box-shadow:0 0 32px -16px oklch(.8 .14 var(--h)/.7);}
    .rec-c-mix{display:flex;flex-direction:column;gap:3px;}
    .rec-c-code{font-size:16px;color:var(--ink);text-shadow:0 0 16px oklch(.8 .14 var(--h)/.4);}
    .rec-c-pour{font-size:10px;color:var(--ink-faint);}
    .rec-c-meta{display:flex;gap:8px;font-size:12px;color:var(--ink-dim);flex-wrap:wrap;align-items:center;}
    .rec-c-meta .dot{opacity:.5;}
    .rec-c-ages{display:flex;gap:8px;}
    .rec-age{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:48px;padding:6px 8px;
      border-radius:8px;background:rgba(8,12,28,.5);border:1px solid var(--line);}
    .rec-age.design{border-color:oklch(.8 .13 205/.4);background:oklch(.8 .13 205/.06);}
    .rec-age-l{font-size:9px;color:var(--ink-faint);}
    .rec-age-v{font-size:12px;color:var(--ink);}
    .rec-c-status{display:flex;flex-direction:column;align-items:flex-end;gap:5px;}
    .rec-pill{font-size:10px;font-family:var(--font-m);padding:3px 10px;border-radius:99px;border:1px solid var(--line);color:var(--ink-dim);}
    .rec-pill.met{color:var(--green);border-color:oklch(.8 .15 155/.4);background:oklch(.6 .15 155/.08);}
    .rec-pill.no{color:var(--red);border-color:oklch(.68 .19 18/.4);background:oklch(.6 .19 18/.08);}
    .rec-pill.warn{color:var(--amber);border-color:oklch(.82 .14 70/.4);background:oklch(.6 .14 70/.08);}
    .rec-da{font-size:10px;color:var(--ink-faint);}
    .rec-del{position:absolute;top:10px;right:12px;width:22px;height:22px;border-radius:6px;
      background:rgba(8,12,28,.5);border:1px solid var(--line);color:var(--ink-faint);font-size:10px;
      opacity:0;transition:.15s;}
    .rec-card:hover .rec-del{opacity:1;}
    .rec-del:hover{color:var(--red);border-color:var(--red);}
    @media (max-width:1080px){.rail{width:230px;}}
    @media (max-width:860px){.rec-card{grid-template-columns:1fr;gap:12px;}.rec-c-status{align-items:flex-start;flex-direction:row;flex-wrap:wrap;}}
  `}</style>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
