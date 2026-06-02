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
  const [admixtures, setAdmixtures] = useStateApp(window.DEFAULT_ADMIXTURES);

  // all mixes live in Firebase (seeded from the built-ins) so they're editable + shared
  const mixes = useMemoApp(() => customMixes.length ? customMixes : window.MIX_DESIGNS, [customMixes]);

  /* ---- Firebase subscriptions (shared, real-time) ---- */
  useEffectApp(() => {
    fb.listen('entries', (v) => setEntries(sortByCreated(v)));
    fb.listen('mixDesigns', (v) => {
      if (!v) { const seed = {}; window.MIX_DESIGNS.forEach((m) => { seed[m.code] = m; }); fb.set('mixDesigns', seed); return; } // seed once
      setCustomMixes(Object.values(v));
    });
    fb.listen('users', (v) => {
      const list = sortByCreated(v);
      if (!list.length) { fb.set('users/u_danzel', SEED_MANAGER); return; } // seed manager once
      setUsers(list);
    });
    fb.listen('admixtures', (v) => {
      if (!v) { fb.set('admixtures', window.DEFAULT_ADMIXTURES); return; } // seed once
      setAdmixtures(Array.isArray(v) ? v : Object.values(v));
    });
  }, []);
  const saveAdmixtures = useCbApp((list) => { setAdmixtures(list); fb.set('admixtures', list); }, []);

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
      const promoted = after !== before;
      const r = window.computeResults(record, mixes.find((m) => m.code === record.mix));
      if (window.celebrate) window.celebrate(r.met ? { count: 36, rings: 3, word: "MEETS f'c", sub: '+1 point' } : { count: 26, rings: 2, word: promoted ? after.toUpperCase() + '!' : 'LOGGED', sub: '+1 point' });
      flash(promoted ? `+1 · ${currentUser.name} promoted to ${after}!` : `+1 point · ${currentUser?.name}`);
    } else {
      flash('Record updated · ' + (entry.mix || 'mix'));
    }
    setView('records');
  }, [flash, currentId, currentUser, entries, mixes]);
  const addMix = useCbApp((m) => { fb.set('mixDesigns/' + m.code, m); flash('Mix ' + m.code + ' added'); }, [flash]);
  const saveMix = useCbApp((code, patch) => { fb.update('mixDesigns/' + code, patch); flash('Mix ' + code + ' updated'); }, [flash]);
  const deleteMix = useCbApp((code) => { fb.remove('mixDesigns/' + code); flash('Mix ' + code + ' removed'); }, [flash]);
  const editEntry = useCbApp((e) => {
    setActiveMix(mixes.find((m) => m.code === e.mix) || null); setCurrent(e); setView('entry');
  }, [mixes]);
  const deleteEntry = useCbApp((id) => fb.remove('entries/' + id), []);
  const patchEntry = useCbApp((id, patch) => fb.update('entries/' + id, patch), []); // grid inline edits

  /* ---- crew / auth ---- */
  const signIn = useCbApp((id) => { setCurrentId(id); setView('mix'); }, []);
  const signOut = useCbApp(() => { setCurrentId(null); setView('mix'); }, []);
  const addUser = useCbApp((name) => {
    const id = 'u_' + Math.random().toString(36).slice(2, 8);
    fb.set('users/' + id, { name, role: 'intern', points: 0, goat: false, joined: Date.now() });
    setCurrentId(id); setView('mix');
  }, []);
  /* manager-only: add/remove crew members without signing in as them */
  const addMember = useCbApp((name) => {
    const id = 'u_' + Math.random().toString(36).slice(2, 8);
    fb.set('users/' + id, { name, role: 'intern', points: 0, goat: false, joined: Date.now() });
    flash(name + ' added to the crew');
  }, [flash]);
  const removeMember = useCbApp((id) => { if (id !== currentId) fb.remove('users/' + id); }, [currentId]);

  /* ---- export ---- */
  const exportCSV = useCbApp(() => {
    if (!entries.length) { flash('No records to export yet'); return; }
    const csv = window.entriesToCSV(entries, admixtures);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `break-records-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    flash(`Exported ${entries.length} record${entries.length === 1 ? '' : 's'} → CSV`);
  }, [entries, flash, admixtures]);

  const copyTSV = useCbApp(async () => {
    if (!entries.length) { flash('No records to copy'); return; }
    const tsv = window.entriesToCSV(entries, admixtures).split('\n')
      .map((line) => line.replace(/","/g, '\t').replace(/^"|"$/g, '').replace(/,/g, '\t')).join('\n');
    try { await navigator.clipboard.writeText(tsv); flash('Copied — paste into the matrix sheet'); }
    catch { flash('Copy blocked by browser'); }
  }, [entries, flash, admixtures]);

  /* ---- Alfred can drive the app (navigation directives from chat) ---- */
  const alfredCommand = useCbApp((c) => {
    if (c.k === 'go') {
      const map = { dashboard: 'records', records: 'records', mixes: 'mixes', reports: 'reports', leaderboard: 'leaderboard', mix: 'mix', log: 'mix', new: 'mix' };
      const v = map[(c.v || '').toLowerCase()] || c.v;
      if (['mix', 'records', 'mixes', 'reports', 'leaderboard'].includes(v)) { setView(v); flash('Alfred → ' + (v === 'records' ? 'Dashboard' : v === 'mix' ? 'New record' : v.charAt(0).toUpperCase() + v.slice(1))); }
    } else if (c.k === 'log') {
      const m = mixes.find((x) => x.code.toLowerCase() === (c.v || '').toLowerCase());
      if (m) { startEntry(m); flash('Alfred opened a record · ' + m.code); }
    } else if (c.k === 'export') { exportCSV(); }
  }, [mixes, flash, exportCSV, startEntry]);

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
          <RailBtn active={view === 'records'} icon="▤" label="Dashboard" badge={entries.length} onClick={() => setView('records')} />
          <RailBtn active={view === 'mixes'} icon="◆" label="Mix designs" onClick={() => setView('mixes')} />
          <RailBtn active={view === 'reports'} icon="⭳" label="Reports" onClick={() => setView('reports')} />
          <RailBtn active={view === 'leaderboard'} icon="★" label="Leaderboard" onClick={() => setView('leaderboard')} />
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
          <window.EntryForm entry={current} mix={activeMix} onSave={saveEntry} onCancel={gotoMix} onChangeMix={gotoMix}
            admixtures={admixtures} onAdmixtures={saveAdmixtures} />
        )}
        {view === 'records' && (
          <RecordsView entries={entries} mixes={mixes} onNew={gotoMix} onEdit={editEntry}
            onDelete={deleteEntry} onExport={exportCSV} onCopy={copyTSV} onPatch={patchEntry} />
        )}
        {view === 'mixes' && (
          <MixManager mixes={mixes} counts={counts} onSave={saveMix} onDelete={deleteMix} onAdd={addMix} />
        )}
        {view === 'reports' && (
          <window.ReportsView mixes={mixes} entries={entries} />
        )}
        {view === 'leaderboard' && (
          <window.Leaderboard users={users} entries={entries} currentId={currentId} onLog={gotoMix}
            isManager={currentUser.role === 'manager'} onAddMember={addMember} onRemoveMember={removeMember} />
        )}
      </main>

      {/* ---------- CHAT TAB ---------- */}
      {!chatOpen && (
        <button className="chat-tab" onClick={() => setChatOpen(true)}>
          <window.NodeOrb size={20} />
          <span className="chat-tab-lab">ALFRED</span>
        </button>
      )}

      <window.ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} entries={entries} mixes={mixes} onCommand={alfredCommand} />
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

/* ---- dashboard charts: per-mix age averages + cross-mix comparison ---- */
function ageAvg(entries, code, age) {
  const v = [];
  entries.forEach((e) => { if (e.mix !== code) return; const a = window.avg(Array.isArray(e['d' + age]) ? e['d' + age] : []); if (a != null) v.push(a); });
  return v.length ? Math.round(v.reduce((x, y) => x + y, 0) / v.length) : null;
}
function DashCharts({ entries, mixes }) {
  const all = mixes.map((m) => m.code);
  const logged = [...new Set(entries.map((e) => e.mix).filter(Boolean))];
  const [sel, setSel] = React.useState(logged[0] || all[0] || '');
  const [cmp, setCmp] = React.useState(logged.length ? logged : all.slice(0, 4));
  React.useEffect(() => { if (!all.includes(sel) && all[0]) setSel(all[0]); }, [all.join()]);
  React.useEffect(() => { setCmp((p) => { const f = p.filter((c) => all.includes(c)); return f.length ? f : (logged.length ? logged : all.slice(0, 4)); }); }, [all.join()]);
  if (!entries.length) return null;
  const ages = (() => { const s = new Set(); entries.forEach((e) => window.entryAges(e).forEach((a) => s.add(a))); window.BREAK_AGES.forEach((a) => s.add(a)); return [...s].sort((x, y) => x - y); })();
  const labels = ages.map((a) => a + '-day');
  const selMix = mixes.find((m) => m.code === sel);
  const fc = selMix && selMix.fc;
  const single = ages.map((a) => ageAvg(entries, sel, a));
  const gridY = { y: { title: { display: true, text: 'psi', color: '#6b75a8' }, ticks: { callback: (v) => v.toLocaleString() }, grid: { color: 'rgba(120,140,230,.07)' } }, x: { grid: { display: false } } };
  // headroom so the design f'c reference line is never clipped above the axis
  const vals = single.filter((v) => v != null);
  const maxV = Math.max(fc || 0, ...(vals.length ? vals : [0]));
  const barScales = { ...gridY, y: { ...gridY.y, beginAtZero: true, suggestedMax: maxV ? Math.ceil(maxV * 1.14 / 500) * 500 : undefined } };
  const barData = { labels, datasets: [{ label: 'Avg strength', data: single, backgroundColor: window.strengthBarColor(single, fc), borderRadius: 8, maxBarThickness: 72 }] };
  const barOpts = {
    plugins: { legend: { display: false }, fcLine: { value: fc || 0 },
      tooltip: { callbacks: { label: (c) => ` ${(c.parsed.y || 0).toLocaleString()} psi` + (fc ? `  ·  ${Math.round(c.parsed.y / fc * 100)}% f'c` : '') } } },
    scales: barScales,
  };
  // distinct colour per mix (by position) so two same-strength mixes never share a colour
  const CMP_PALETTE = ['oklch(.82 .15 200)', 'oklch(.74 .2 330)', 'oklch(.74 .17 285)', 'oklch(.8 .16 150)', 'oklch(.84 .15 75)', 'oklch(.72 .16 255)', 'oklch(.78 .19 350)', 'oklch(.82 .13 180)'];
  const colorFor = (code) => CMP_PALETTE[Math.max(0, mixes.findIndex((m) => m.code === code)) % CMP_PALETTE.length];
  const toggle = (code) => setCmp((p) => p.includes(code) ? (p.length > 1 ? p.filter((c) => c !== code) : p) : [...p, code]);
  const cmpData = {
    labels,
    datasets: cmp.map((code) => { const col = colorFor(code);
      return { label: code, data: ages.map((a) => ageAvg(entries, code, a)), borderColor: col, backgroundColor: window.lineAreaGrad(col), pointBackgroundColor: col, pointBorderColor: '#0a0f22', pointBorderWidth: 1.5, tension: 0.4, spanGaps: true, pointRadius: 4, pointHoverRadius: 7, borderWidth: 3, fill: true }; }),
  };
  const cmpOpts = {
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${(c.parsed.y || 0).toLocaleString()} psi` } } },
    scales: gridY, interaction: { mode: 'index', intersect: false },
  };
  return (
    <div className="dash-charts fadeUp">
      <div className="dash-chart glass">
        <div className="dash-chart-head">
          <div><div className="dash-eyebrow mono">◇ STRENGTH BY AGE</div><h3 className="disp">{sel || '—'}{fc ? <span className="dash-fc mono"> · f'c {fc.toLocaleString()}</span> : ''}</h3></div>
          <select className="dash-sel mono" value={sel} onChange={(e) => setSel(e.target.value)}>
            {all.map((c) => <option key={c} value={c}>{c}{logged.includes(c) ? '' : ' (no data)'}</option>)}
          </select>
        </div>
        <window.ChartCanvas type="bar" data={barData} options={barOpts} height={360} />
        <div className="dash-legend mono"><span className="dl ok">≥100% f'c</span><span className="dl mid">85–99%</span><span className="dl low">below 85%</span></div>
      </div>

      <div className="dash-chart glass">
        <div className="dash-chart-head">
          <div><div className="dash-eyebrow mono">◇ COMPARE</div><h3 className="disp">Mix comparison</h3></div>
          <span className="dash-sub mono">avg strength by age</span>
        </div>
        <div className="cmp-chips">
          <span className="cmp-label mono">compare:</span>
          {all.map((code) => { const on = cmp.includes(code);
            return (
              <button key={code} className={'cmp-chip' + (on ? ' on' : '') + (logged.includes(code) ? '' : ' nodata')} style={{ '--c': colorFor(code) }} onClick={() => toggle(code)}>
                <span className="cmp-dot"></span>{code}
              </button>
            ); })}
        </div>
        <window.ChartCanvas type="line" data={cmpData} options={cmpOpts} height={360} />
      </div>
    </div>
  );
}

/* ---- editable grid (mass edit) ---- */
function EntryGridRow({ entry, codes, onPatch, onDelete, onEdit }) {
  const [d, setD] = React.useState(entry);
  React.useEffect(() => setD(entry), [entry.id]);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const setNow = (k, v) => { setD((x) => ({ ...x, [k]: v })); onPatch(entry.id, { [k]: v }); };
  const NUMK = { fc: 1, age: 1 };
  const blur = (k) => { let v = d[k]; if (NUMK[k]) v = k === 'age' ? (parseInt(v) || '') : window.num(v); if (JSON.stringify(v) !== JSON.stringify(entry[k])) onPatch(entry.id, { [k]: v }); };
  const cyl = (a) => Array.isArray(d['d' + a]) ? d['d' + a] : ['', '', ''];
  const setCyl = (a, i, v) => { const arr = cyl(a).slice(); arr[i] = v; set('d' + a, arr); };
  const blurCyl = (a) => { if (JSON.stringify(cyl(a)) !== JSON.stringify(entry['d' + a])) onPatch(entry.id, { ['d' + a]: cyl(a) }); };
  const opt = (list) => [<option key="_" value=""></option>, ...list.map((o) => <option key={o} value={o}>{o}</option>)];
  return (
    <tr>
      <td className="eg-sticky"><select className="eg-in mono" value={d.mix || ''} onChange={(e) => setNow('mix', e.target.value)}>{codes.map((c) => <option key={c} value={c}>{c}</option>)}</select></td>
      <td><input className="eg-in" value={d.pourNumber || ''} onChange={(e) => set('pourNumber', e.target.value)} onBlur={() => blur('pourNumber')} /></td>
      <td><input className="eg-in mono" type="date" value={d.pourDate || ''} onChange={(e) => setNow('pourDate', e.target.value)} /></td>
      <td><select className="eg-in" value={d.area || ''} onChange={(e) => setNow('area', e.target.value)}>{opt(window.AREAS)}</select></td>
      <td><select className="eg-in" value={d.sequence || ''} onChange={(e) => setNow('sequence', e.target.value)}>{opt(window.SEQUENCES)}</select></td>
      <td><select className="eg-in" value={d.element || ''} onChange={(e) => setNow('element', e.target.value)}>{opt(window.ELEMENTS)}</select></td>
      <td><input className="eg-in mono eg-num" type="number" value={d.fc ?? ''} onChange={(e) => set('fc', e.target.value)} onBlur={() => blur('fc')} /></td>
      <td><input className="eg-in mono eg-num eg-sm" type="number" value={d.age ?? ''} onChange={(e) => set('age', e.target.value)} onBlur={() => blur('age')} /></td>
      {window.BREAK_AGES.map((a) => [0, 1, 2].map((i) => (
        <td key={a + '_' + i} className={i === 0 ? 'eg-agecell' : ''}><input className="eg-in mono eg-num eg-cyl" type="number" value={cyl(a)[i] ?? ''} onChange={(e) => setCyl(a, i, e.target.value)} onBlur={() => blurCyl(a)} placeholder="—" /></td>
      )))}
      <td className="eg-act"><button className="eg-open" title="open full form" onClick={() => onEdit(entry)}>⤢</button><button className="eg-del" title="delete record" onClick={() => { if (confirm('Delete this record?')) onDelete(entry.id); }}>×</button></td>
    </tr>
  );
}
function EntryGrid({ entries, mixes, onPatch, onDelete, onEdit }) {
  const rows = [...entries].reverse();
  const codes = mixes.map((m) => m.code);
  return (
    <div className="egrid-wrap fadeUp">
      <div className="egrid-hint mono">Inline edit — cells save on blur · {rows.length} record{rows.length === 1 ? '' : 's'}. Cylinders shown for standard ages; ⤢ opens the full form for custom breaks.</div>
      <div className="egrid-scroll">
        <table className="egrid">
          <thead>
            <tr>
              <th className="eg-sticky">Mix</th><th>Pour #</th><th>Pour date</th><th>Area</th><th>Seq</th><th>Element</th><th>f'c</th><th>Age</th>
              {window.BREAK_AGES.map((a) => <th key={a} colSpan={3} className="eg-agehead">{a}-day cylinders</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => <EntryGridRow key={e.id} entry={e} codes={codes} onPatch={onPatch} onDelete={onDelete} onEdit={onEdit} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---- records view ---- */
function RecordsView({ entries, mixes, onNew, onEdit, onDelete, onExport, onCopy, onPatch }) {
  const [grid, setGrid] = React.useState(() => localStorage.getItem('orbital_grid') === '1');
  const toggleGrid = () => setGrid((g) => { localStorage.setItem('orbital_grid', g ? '0' : '1'); return !g; });
  return (
    <div className="rec scrollY">
      <div className="rec-inner">
        <header className="rec-head fadeUp">
          <div>
            <div className="ms-eyebrow mono">◇ SESSION LOG</div>
            <h1 className="ms-h1 disp">Dashboard</h1>
          </div>
          <div className="rec-actions">
            <button className={'btn-ghost grid-tog' + (grid ? ' on' : '')} onClick={toggleGrid} title="Toggle editable grid">{grid ? '▤ Cards' : '▦ Grid'}</button>
            <button className="btn-ghost" onClick={onCopy} disabled={!entries.length}>⎘ Copy for sheet</button>
            <button className="btn-ghost" onClick={onExport} disabled={!entries.length}>⭳ CSV</button>
            <button className="btn-primary" onClick={onNew}><span>✦ New record</span></button>
          </div>
        </header>

        <DashCharts entries={entries} mixes={mixes} />

        {grid && entries.length ? (
          <EntryGrid entries={entries} mixes={mixes} onPatch={onPatch} onDelete={onDelete} onEdit={onEdit} />
        ) : !entries.length ? (
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

/* ---- mix designs manager: edit / delete / add mixes ---- */
function MixEditRow({ mix, count, onSave, onDelete }) {
  const [m, setM] = React.useState(mix);
  React.useEffect(() => setM(mix), [mix.code]);
  const dirty = JSON.stringify(m) !== JSON.stringify(mix);
  const h = window.accentForStrength(window.num(m.fc));
  const upd = (k, v) => setM((x) => ({ ...x, [k]: v }));
  const save = () => onSave(mix.code, { fc: window.num(m.fc), age: parseInt(m.age) || 28, use: m.use || '', agg: m.agg || '', accent: window.accentForStrength(window.num(m.fc)) });
  return (
    <div className="mm-row glass" style={{ '--h': h }}>
      <div className="mm-row-code">
        <span className="mm-dot"></span>
        <span className="mm-code disp">{mix.code}</span>
        <span className="mm-tier mono">{window.strengthTier(window.num(m.fc))}</span>
      </div>
      <div className="mm-fields">
        <label className="mm-f">f'c<span className="mm-unit">psi</span><input className="mm-in mono" type="number" value={m.fc ?? ''} onChange={(e) => upd('fc', e.target.value)} placeholder="slurry" /></label>
        <label className="mm-f">Age<span className="mm-unit">d</span><input className="mm-in mono" type="number" value={m.age ?? ''} onChange={(e) => upd('age', e.target.value)} /></label>
        <label className="mm-f">Agg<input className="mm-in mono" value={m.agg || ''} onChange={(e) => upd('agg', e.target.value)} placeholder='1"' /></label>
        <label className="mm-f wide">Use<input className="mm-in" value={m.use || ''} onChange={(e) => upd('use', e.target.value)} /></label>
      </div>
      <div className="mm-row-act">
        <span className="mm-count mono">{count || 0} logged</span>
        <button className="btn-primary mm-save" disabled={!dirty} onClick={save}><span>Save</span></button>
        <button className="mm-del" title="delete mix" onClick={() => { if (confirm('Delete mix ' + mix.code + '?')) onDelete(mix.code); }}>×</button>
      </div>
    </div>
  );
}
function MixManager({ mixes, counts, onSave, onDelete, onAdd }) {
  const [add, setAdd] = React.useState(false);
  const [f, setF] = React.useState({ code: '', fc: '', age: '28', use: '', agg: '' });
  const submit = () => {
    if (!f.code.trim()) return;
    const fc = window.num(f.fc);
    onAdd({ code: f.code.trim().toUpperCase(), fc, age: parseInt(f.age) || 28, use: f.use.trim() || 'Custom mix', agg: f.agg.trim(), area: '', accent: window.accentForStrength(fc), tests: 0 });
    setF({ code: '', fc: '', age: '28', use: '', agg: '' }); setAdd(false);
  };
  return (
    <div className="mm scrollY">
      <div className="mm-inner">
        <header className="rec-head fadeUp">
          <div>
            <div className="ms-eyebrow mono">◇ MIX LIBRARY</div>
            <h1 className="ms-h1 disp">Mix designs</h1>
            <p className="lb-lead" style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--ink-dim)' }}>Edit strengths, ages and uses — colour tracks the strength tier. Shared across the crew.</p>
          </div>
          <button className="btn-primary" onClick={() => setAdd((a) => !a)}><span>✦ Add mix</span></button>
        </header>
        {add && (
          <div className="mm-add glass fadeUp">
            <input className="mm-in mono" style={{ flex: 1, minWidth: 150 }} autoFocus placeholder="MIX CODE  e.g. O90C735K1" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <input className="mm-in mono" style={{ width: 100 }} type="number" placeholder="f'c psi" value={f.fc} onChange={(e) => setF({ ...f, fc: e.target.value })} />
            <input className="mm-in mono" style={{ width: 72 }} type="number" placeholder="age" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} />
            <input className="mm-in mono" style={{ width: 70 }} placeholder="agg" value={f.agg} onChange={(e) => setF({ ...f, agg: e.target.value })} />
            <input className="mm-in" style={{ flex: 1, minWidth: 120 }} placeholder="use" value={f.use} onChange={(e) => setF({ ...f, use: e.target.value })} />
            <button className="btn-primary" onClick={submit}><span>Add</span></button>
          </div>
        )}
        <div className="mm-list">
          {mixes.map((m) => <MixEditRow key={m.code} mix={m} count={counts[m.code]} onSave={onSave} onDelete={onDelete} />)}
        </div>
      </div>
      <MixManagerStyles />
    </div>
  );
}
function MixManagerStyles() {
  return <style>{`
    .mm{height:100%;}
    .mm-inner{max-width:1000px;margin:0 auto;padding:48px 40px 60px;}
    .mm-add{display:flex;gap:9px;flex-wrap:wrap;align-items:center;padding:14px;border-radius:var(--r-md);
      border-color:var(--line-strong);margin-bottom:18px;}
    .mm-in{background:rgba(8,12,28,.6);border:1px solid var(--line);border-radius:9px;padding:9px 11px;
      font-size:13px;color:var(--ink);outline:none;}
    .mm-in:focus{border-color:var(--cyan);}
    .mm-list{display:flex;flex-direction:column;gap:10px;}
    .mm-row{display:grid;grid-template-columns:170px 1fr auto;gap:16px;align-items:center;
      padding:14px 18px;border-radius:var(--r-md);border-color:var(--line);transition:.15s;}
    .mm-row:hover{border-color:oklch(.8 .14 var(--h)/.45);}
    .mm-row-code{display:flex;flex-direction:column;gap:3px;position:relative;padding-left:14px;}
    .mm-dot{position:absolute;left:0;top:5px;width:8px;height:8px;border-radius:50%;
      background:oklch(.78 .15 var(--h));box-shadow:0 0 10px oklch(.78 .15 var(--h)/.8);}
    .mm-code{font-size:16px;color:var(--ink);text-shadow:0 0 14px oklch(.8 .14 var(--h)/.4);}
    .mm-tier{font-size:10px;color:oklch(.85 .12 var(--h));}
    .mm-fields{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;}
    .mm-f{display:flex;flex-direction:column;gap:4px;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-faint);position:relative;}
    .mm-f.wide{flex:1;min-width:150px;}
    .mm-f .mm-unit{position:absolute;right:8px;bottom:9px;font-size:9px;color:var(--ink-faint);text-transform:none;}
    .mm-f .mm-in{width:92px;}
    .mm-f.wide .mm-in{width:100%;}
    .mm-row-act{display:flex;align-items:center;gap:10px;}
    .mm-count{font-size:10px;color:var(--ink-faint);white-space:nowrap;}
    .mm-save{padding:8px 14px;font-size:12px;}
    .mm-save:disabled{opacity:.35;box-shadow:none;cursor:default;transform:none;}
    .mm-del{width:30px;height:30px;border-radius:8px;background:rgba(8,12,28,.5);border:1px solid var(--line);
      color:var(--ink-faint);font-size:16px;}
    .mm-del:hover{color:var(--red);border-color:var(--red);}
    @media (max-width:860px){.mm-row{grid-template-columns:1fr;}.mm-row-act{justify-content:flex-end;}}
  `}</style>;
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
      background:radial-gradient(circle at 35% 30%,#eafff5,var(--green) 45%,var(--blue));
      box-shadow:0 0 14px -2px oklch(.8 .15 155/.45);animation:pulseGlow 3s infinite;}
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
    .dash-charts{display:flex;flex-direction:column;gap:20px;margin-bottom:30px;}
    .dash-chart{border-radius:var(--r-lg);padding:22px 24px;border-color:var(--line-strong);
      box-shadow:var(--shadow),0 0 60px -36px var(--glow-cyan);}
    .dash-chart-head{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;gap:12px;}
    .dash-eyebrow{font-size:10px;letter-spacing:.2em;color:var(--cyan);margin-bottom:6px;}
    .dash-chart-head h3{font-size:20px;font-weight:600;margin:0;color:var(--ink);letter-spacing:-.01em;}
    .dash-fc{font-size:13px;color:var(--ink-faint);font-weight:400;}
    .dash-sub{font-size:11px;color:var(--ink-faint);margin-top:2px;}
    .dash-sel{background:rgba(8,12,28,.6);border:1px solid var(--line-strong);border-radius:9px;
      color:var(--cyan);font-size:13px;padding:8px 12px;outline:none;cursor:pointer;font-weight:600;}
    .dash-sel option{background:#0e1533;color:var(--ink);}
    .dash-legend{display:flex;gap:16px;justify-content:center;margin-top:12px;font-size:10.5px;}
    .dash-legend .dl{display:flex;align-items:center;gap:6px;color:var(--ink-faint);}
    .dash-legend .dl::before{content:'';width:9px;height:9px;border-radius:3px;}
    .dash-legend .ok::before{background:oklch(.78 .15 155);}
    .dash-legend .mid::before{background:oklch(.82 .14 70);}
    .dash-legend .low::before{background:oklch(.68 .19 18);}
    .cmp-chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center;}
    .cmp-label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint);margin-right:2px;}
    .cmp-chip{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--ink-faint);
      padding:7px 13px;border-radius:99px;background:rgba(8,12,28,.4);border:1px solid var(--line);
      font-family:var(--font-m);transition:.14s;}
    .cmp-chip .cmp-dot{width:9px;height:9px;border-radius:50%;background:var(--c);opacity:.4;transition:.14s;}
    .cmp-chip:hover{color:var(--ink-dim);border-color:var(--line-strong);}
    .cmp-chip.on{color:var(--ink);border-color:var(--c);background:color-mix(in oklch,var(--c) 12%,transparent);
      box-shadow:0 0 16px -8px var(--c);}
    .cmp-chip.on .cmp-dot{opacity:1;box-shadow:0 0 8px var(--c);}
    .cmp-chip.nodata{opacity:.5;}
    .cmp-chip.nodata.on{opacity:.8;}
    .grid-tog.on{color:var(--cyan);border-color:var(--cyan);background:oklch(.8 .13 205/.1);}
    /* editable grid */
    .egrid-wrap{margin-bottom:20px;}
    .egrid-hint{font-size:10.5px;color:var(--ink-faint);margin-bottom:10px;letter-spacing:.02em;}
    .egrid-scroll{overflow-x:auto;border:1px solid var(--line-strong);border-radius:var(--r-md);
      background:rgba(13,19,44,.4);}
    .egrid{border-collapse:separate;border-spacing:0;font-size:12px;width:max-content;min-width:100%;}
    .egrid th{position:sticky;top:0;z-index:2;background:#0d1430;color:var(--ink-faint);font-family:var(--font-m);
      font-size:9.5px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;text-align:left;
      padding:9px 8px;border-bottom:1px solid var(--line-strong);white-space:nowrap;}
    .egrid th.eg-agehead{text-align:center;color:var(--cyan);border-left:1px solid var(--line-strong);}
    .egrid td{padding:3px 5px;border-bottom:1px solid rgba(120,140,230,.08);vertical-align:middle;}
    .egrid td.eg-agecell{border-left:1px solid rgba(120,140,230,.14);}
    .egrid tbody tr:nth-child(even){background:rgba(255,255,255,.012);}
    .egrid tbody tr:hover{background:oklch(.8 .13 205/.04);}
    .eg-sticky{position:sticky;left:0;z-index:1;background:#0d1430;border-right:1px solid var(--line-strong);}
    .egrid tbody tr:hover .eg-sticky{background:#121a38;}
    .eg-in{background:rgba(8,12,28,.5);border:1px solid transparent;border-radius:6px;padding:6px 7px;
      color:var(--ink);font-size:12px;outline:none;width:120px;transition:.12s;}
    .eg-in:hover{border-color:var(--line);}
    .eg-in:focus{border-color:var(--cyan);background:rgba(8,12,28,.85);box-shadow:0 0 0 2px oklch(.8 .13 205/.14);}
    select.eg-in{appearance:none;cursor:pointer;width:90px;padding-right:7px;}
    select.eg-in option{background:#0e1533;}
    .eg-num{width:74px;text-align:right;}
    .eg-sm{width:54px;}
    .eg-cyl{width:62px;}
    .eg-act{display:flex;gap:4px;padding-left:8px;}
    .eg-open,.eg-del{width:26px;height:26px;border-radius:6px;background:rgba(8,12,28,.5);border:1px solid var(--line);
      color:var(--ink-faint);font-size:13px;}
    .eg-open:hover{color:var(--cyan);border-color:var(--cyan);}
    .eg-del:hover{color:var(--red);border-color:var(--red);}
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
