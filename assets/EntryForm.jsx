/* ====================================================================
   EntryForm — stepped break-test data entry with a live results
   readout. Left: grouped inputs. Right: derived values computed as
   you type (avg strength, %f'c, met/not-met, elapsed, C39 verdicts).
==================================================================== */
const { useState: useStateE, useMemo: useMemoE, useEffect: useEffectE } = React;

/* ---- small field primitives -------------------------------------- */
function Field({ label, unit, children, hint, wide }) {
  return (
    <label className={'fld' + (wide ? ' wide' : '')}>
      <span className="fld-lab">{label}{unit && <span className="fld-unit mono">{unit}</span>}</span>
      {children}
      {hint && <span className="fld-hint mono">{hint}</span>}
    </label>
  );
}
const T = (p) => <input className="inp" {...p} />;
const Sel = ({ options, ...p }) => (
  <select className="inp sel" {...p}>{options.map((o) => <option key={o} value={o}>{o === '' ? '—' : o}</option>)}</select>
);
const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* Custom themed calendar — replaces the native (ugly) date control. */
function DateField({ value, onChange, compact }) {
  const [open, setOpen] = useStateE(false);
  const [view, setView] = useStateE(() => { const d = value ? new Date(value + 'T00:00:00') : new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  useEffectE(() => { if (value) { const d = new Date(value + 'T00:00:00'); setView({ y: d.getFullYear(), m: d.getMonth() }); } }, [value]);
  const sel = value ? new Date(value + 'T00:00:00') : null;
  const todayISO = localISO(new Date());
  const label = sel ? sel.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select date';
  const first = new Date(view.y, view.m, 1);
  const startDow = (first.getDay() + 6) % 7;
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const monthName = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const iso = (d) => `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const shift = (n) => setView((v) => { let m = v.m + n, y = v.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } return { y, m }; });
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return (
    <div className={'df' + (compact ? ' compact' : '')}>
      <button type="button" className={'df-btn' + (sel ? '' : ' empty')} onClick={() => setOpen((o) => !o)}>
        <span className="df-ic">◷</span><span className="df-val mono">{label}</span>
      </button>
      {open && (
        <>
          <div className="df-backdrop" onClick={() => setOpen(false)}></div>
          <div className="df-pop glass">
            <div className="df-pop-head">
              <button type="button" className="df-nav" onClick={() => shift(-1)}>‹</button>
              <span className="df-month disp">{monthName}</span>
              <button type="button" className="df-nav" onClick={() => shift(1)}>›</button>
            </div>
            <div className="df-dow mono">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
            <div className="df-grid">
              {cells.map((d, i) => d === null
                ? <span key={i} className="df-cell empty"></span>
                : <button type="button" key={i} onClick={() => { onChange(iso(d)); setOpen(false); }}
                    className={'df-cell mono' + (value === iso(d) ? ' sel' : '') + (iso(d) === todayISO ? ' today' : '')}>{d}</button>)}
            </div>
            <div className="df-foot">
              <button type="button" className="df-act" onClick={() => { onChange(todayISO); setOpen(false); }}>Today</button>
              {sel && <button type="button" className="df-act clear" onClick={() => { onChange(''); setOpen(false); }}>Clear</button>}
              <button type="button" className="df-act" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---- cylinder break trio with live average ----------------------- */
function BreakRow({ age, entry, set, mix, fc, onRemoveAge }) {
  const cyl = Array.isArray(entry['d' + age]) ? entry['d' + age] : ['', '', ''];
  const a = window.avg(cyl);
  const verdict = window.c39Verdict(cyl);
  const pct = a !== null && fc ? (a / fc) * 100 : null;
  const isDesign = age === (window.num(entry.age) ?? mix?.age);
  const isCustom = !window.BREAK_AGES.includes(age);
  const setCyl = (i, v) => { const next = cyl.slice(); next[i] = v; set('d' + age, next); };
  const addCyl = () => set('d' + age, [...cyl, '']);
  const removeCyl = (i) => { if (cyl.length > 1) set('d' + age, cyl.filter((_, k) => k !== i)); };
  return (
    <div className={'brk' + (isDesign ? ' design' : '') + (isCustom ? ' custom' : '')}>
      <div className="brk-head">
        <span className="brk-age disp">{age}<span>day</span></span>
        {isDesign && <span className="brk-tag mono">DESIGN AGE</span>}
        {isCustom && <span className="brk-tag custom mono">EARLY</span>}
        <div className="brk-date"><DateField value={entry[`d${age}_date`] || ''} onChange={(v) => set(`d${age}_date`, v)} compact /></div>
        {isCustom && <button className="brk-rmage" title="remove this break age" onClick={() => onRemoveAge(age)}>×</button>}
      </div>
      <div className="brk-cyls">
        <div className="brk-cyl-grid">
          {cyl.map((v, i) => (
            <div className="brk-cylbox" key={i}>
              <input className="inp brk-cyl mono" type="number" inputMode="numeric"
                placeholder={`cyl ${i + 1}`} value={v} onChange={(e) => setCyl(i, e.target.value)} />
              {cyl.length > 1 && <button className="brk-cyl-x" title="remove cylinder" onClick={() => removeCyl(i)}>×</button>}
            </div>
          ))}
          <button className="brk-addcyl mono" onClick={addCyl} title="add a cylinder">+ cyl</button>
        </div>
        <div className="brk-out">
          <span className="brk-avg mono">{a !== null ? window.fmt(a) : '—'}</span>
          <span className="brk-avglab mono">avg psi</span>
        </div>
      </div>
      {(pct !== null || verdict) && (
        <div className="brk-foot">
          {pct !== null && (
            <span className={'brk-pct ' + (pct >= 100 ? 'ok' : pct >= 85 ? 'mid' : 'low')}>
              {window.fmt(pct, 0)}% of f'c
            </span>
          )}
          {verdict && <span className={'brk-v ' + verdict.tone}>{verdict.label} · {window.fmt(verdict.pct, 1)}% range</span>}
        </div>
      )}
    </div>
  );
}

/* ---- the live readout rail --------------------------------------- */
function Readout({ entry, mix, res }) {
  const designAvg = res.designAge && res.ages[res.designAge] ? res.ages[res.designAge].avg : null;
  const designCov = res.designAge && res.ages[res.designAge] ? res.ages[res.designAge].cov : null;
  return (
    <div className="ro">
      <div className="ro-card glass">
        <div className="ro-mixline">
          <span className="ro-code disp" style={{ '--h': mix?.accent ?? 240 }}>{entry.mix || '—'}</span>
          <span className="ro-fc mono">f'c {window.fmt(res.fc)} psi · {res.designAge || '—'}d</span>
        </div>

        <div className={'ro-status ' + (res.met === null ? 'na' : res.met ? 'met' : 'no')}>
          <span className="ro-status-dot"></span>
          <div>
            <div className="ro-status-main disp">
              {res.met === null ? 'AWAITING DESIGN-AGE BREAK' : res.met ? 'MEETS DESIGN STRENGTH' : 'BELOW DESIGN STRENGTH'}
            </div>
            <div className="ro-status-sub mono">
              {designAvg !== null
                ? `${window.fmt(designAvg)} psi @ ${res.designAge}d  ·  ${window.fmt(res.ages[res.designAge].pctFc, 0)}% f'c`
                : `enter ${res.designAge || ''}-day cylinders to confirm`}
            </div>
          </div>
        </div>

        <div className="ro-bars">
          {window.entryAges(entry).map((age) => {
            if (!res.ages[age]) return null;
            const v = res.ages[age].avg;
            const pct = res.ages[age].pctFc;
            const w = pct !== null ? Math.min(pct, 130) / 130 * 100 : 0;
            return (
              <div className="ro-bar" key={age}>
                <span className="ro-bar-lab mono">{age}d</span>
                <div className="ro-bar-track">
                  <div className="ro-bar-fill" style={{ width: w + '%',
                    background: v === null ? 'transparent'
                      : pct >= 100 ? 'linear-gradient(90deg,var(--green),var(--cyan))'
                      : 'linear-gradient(90deg,var(--blue),var(--violet))' }}></div>
                  <div className="ro-bar-fc" title="design strength"></div>
                </div>
                <span className="ro-bar-val mono">{v !== null ? window.fmt(v) : '—'}</span>
              </div>
            );
          })}
        </div>

        <div className="ro-stats">
          <Stat label="Design avg" value={designAvg !== null ? window.fmt(designAvg) + ' psi' : '—'} hint={res.designAge ? res.designAge + '-day' : ''} />
          <Stat label="Design COV" value={designCov != null ? window.fmt(designCov, 1) + '%' : '—'} hint="C39 within-test" />
          <Stat label="7→28d gain" value={res.gain7_28 !== null ? '+' + window.fmt(res.gain7_28) : '—'}
            hint={res.gain7_28pct !== null ? '+' + window.fmt(res.gain7_28pct, 0) + '%' : ''} />
          <Stat label="7→56d gain" value={res.gain7_56 !== null ? '+' + window.fmt(res.gain7_56) : '—'}
            hint={res.gain7_56pct !== null ? '+' + window.fmt(res.gain7_56pct, 0) + '%' : ''} />
        </div>
      </div>
      <style>{`
        .ro{position:sticky;top:0;}
        .ro-card{border-radius:var(--r-lg);padding:18px;display:flex;flex-direction:column;gap:16px;
          border-color:var(--line-strong);box-shadow:var(--shadow);}
        .ro-mixline{display:flex;align-items:baseline;justify-content:space-between;gap:8px;
          padding-bottom:14px;border-bottom:1px solid var(--line);}
        .ro-code{font-size:20px;color:var(--ink);text-shadow:0 0 20px oklch(.8 .14 var(--h)/.5);}
        .ro-fc{font-size:11px;color:var(--ink-dim);}
        .ro-status{display:flex;gap:11px;align-items:flex-start;padding:13px;border-radius:var(--r-md);
          border:1px solid var(--line);background:rgba(10,15,34,.5);}
        .ro-status.met{border-color:oklch(.8 .15 155/.4);background:oklch(.6 .15 155/.08);}
        .ro-status.no{border-color:oklch(.68 .19 18/.4);background:oklch(.6 .19 18/.08);}
        .ro-status-dot{width:10px;height:10px;border-radius:50%;margin-top:4px;flex:none;background:var(--ink-faint);}
        .ro-status.met .ro-status-dot{background:var(--green);box-shadow:0 0 12px var(--green);}
        .ro-status.no .ro-status-dot{background:var(--red);box-shadow:0 0 12px var(--red);}
        .ro-status.na .ro-status-dot{animation:pulseGlow 2s infinite;}
        .ro-status-main{font-size:12.5px;letter-spacing:.04em;}
        .ro-status-sub{font-size:10.5px;color:var(--ink-faint);margin-top:3px;}
        .ro-bars{display:flex;flex-direction:column;gap:9px;}
        .ro-bar{display:grid;grid-template-columns:30px 1fr 52px;align-items:center;gap:9px;}
        .ro-bar-lab{font-size:10.5px;color:var(--ink-faint);}
        .ro-bar-track{position:relative;height:8px;border-radius:5px;background:rgba(8,12,28,.7);overflow:hidden;border:1px solid var(--line);}
        .ro-bar-fill{height:100%;border-radius:5px;transition:width .5s cubic-bezier(.2,.7,.2,1);}
        .ro-bar-fc{position:absolute;top:-2px;bottom:-2px;left:76.9%;width:2px;background:var(--ink-dim);opacity:.6;}
        .ro-bar-val{font-size:10.5px;text-align:right;color:var(--ink-dim);}
        .ro-stats{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
      `}</style>
    </div>
  );
}
function Stat({ label, value, hint }) {
  return (
    <div className="stat">
      <div className="stat-lab mono">{label}</div>
      <div className="stat-val mono">{value}</div>
      {hint && <div className="stat-hint mono">{hint}</div>}
      <style>{`
        .stat{padding:10px 11px;border-radius:var(--r-sm);background:rgba(8,12,28,.45);border:1px solid var(--line);}
        .stat-lab{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint);}
        .stat-val{font-size:15px;color:var(--ink);margin-top:4px;font-weight:500;}
        .stat-hint{font-size:9.5px;color:var(--ink-faint);margin-top:1px;}
      `}</style>
    </div>
  );
}

/* ---- the form ---------------------------------------------------- */
function EntryForm({ entry: initial, mix, onSave, onCancel, onChangeMix, admixtures, onAdmixtures }) {
  const [entry, setEntry] = useStateE(initial);
  useEffectE(() => setEntry(initial), [initial.id]);
  const set = (k, v) => setEntry((e) => ({ ...e, [k]: v }));
  const fc = window.num(entry.fc) ?? mix?.fc;
  const res = useMemoE(() => window.computeResults(entry, mix), [entry, mix]);
  const admx = admixtures || window.DEFAULT_ADMIXTURES;

  /* Auto-populate each break age's test date from the pour date (pour + age
     days), filling only empty fields so manual edits stick. So entering the
     pour date instantly gives you the 7 / 28 / 56 / 90-day test dates. */
  useEffectE(() => {
    if (!entry.pourDate) return;
    setEntry((e) => {
      let changed = false; const next = { ...e };
      window.entryAges(e).forEach((age) => {
        if (!e['d' + age + '_date']) { next['d' + age + '_date'] = window.addDays(e.pourDate, age); changed = true; }
      });
      return changed ? next : e;
    });
  }, [entry.pourDate]);

  /* dynamic break ages — add an earlier break (3-day, 14-day…) or remove a custom one */
  const addAge = () => {
    const v = prompt('Break age in days (e.g. 3, 14):');
    const n = parseInt(v, 10);
    if (!n || n <= 0) return;
    setEntry((e) => {
      const ages = [...new Set([...window.entryAges(e), n])].sort((a, b) => a - b);
      const next = { ...e, ages };
      if (!Array.isArray(next['d' + n])) next['d' + n] = ['', '', ''];
      if (!next['d' + n + '_date'] && e.pourDate) next['d' + n + '_date'] = window.addDays(e.pourDate, n);
      return next;
    });
  };
  const removeAge = (age) => setEntry((e) => ({ ...e, ages: window.entryAges(e).filter((a) => a !== age) }));

  /* per-entry admixture value */
  const setAdmx = (key, v) => setEntry((e) => ({ ...e, admx: { ...(e.admx || {}), [key]: v } }));
  /* shared admixture-list edits (rename / unit / add / remove) */
  const updateAdmix = (idx, field, v) => onAdmixtures(admx.map((a, i) => i === idx ? { ...a, [field]: v } : a));
  const removeAdmix = (idx) => onAdmixtures(admx.filter((_, i) => i !== idx));
  const addAdmix = () => onAdmixtures([...admx, { key: 'adm_' + Math.random().toString(36).slice(2, 7), label: 'New admixture', unit: 'oz' }]);

  return (
    <div className="ef scrollY">
      <div className="ef-inner">
        <header className="ef-head fadeUp">
          <button className="ef-back" onClick={onCancel}>← Mixes</button>
          <div className="ef-title-wrap">
            <h2 className="ef-title disp">New break record</h2>
            <button className="ef-mixbtn mono" onClick={onChangeMix} style={{ '--h': mix?.accent ?? 240 }}>
              {entry.mix || 'select mix'} <span>change</span>
            </button>
          </div>
        </header>

        <div className="ef-cols">
          <div className="ef-form">
            {/* ---- Identification ---- */}
            <Section n="01" title="Identification & pour" hint="from the batch ticket / inspection report">
              <div className="grid3">
                <Field label="Pour #"><T value={entry.pourNumber} onChange={(e) => set('pourNumber', e.target.value)} placeholder="e.g. FT 1.5.1" /></Field>
                <Field label="Pour date"><DateField value={entry.pourDate} onChange={(v) => set('pourDate', v)} /></Field>
                <Field label="IR #"><T value={entry.ir} onChange={(e) => set('ir', e.target.value)} placeholder="inspection rpt" /></Field>
                <Field label="Batch ticket #"><T value={entry.ticket} onChange={(e) => set('ticket', e.target.value)} placeholder="ticket no." /></Field>
                <Field label="Area"><Sel options={['', ...window.AREAS]} value={entry.area || ''} onChange={(e) => set('area', e.target.value)} /></Field>
                <Field label="Sequence"><Sel options={['', ...window.SEQUENCES]} value={entry.sequence || ''} onChange={(e) => set('sequence', e.target.value)} /></Field>
                <Field label="Element"><Sel options={['', ...window.ELEMENTS]} value={entry.element || ''} onChange={(e) => set('element', e.target.value)} /></Field>
                <Field label="Design strength" unit="psi"><T type="number" value={entry.fc} onChange={(e) => set('fc', e.target.value)} className="inp mono" /></Field>
                <Field label="Design age" unit="days"><T type="number" value={entry.age} onChange={(e) => set('age', e.target.value)} className="inp mono" /></Field>
              </div>
            </Section>

            {/* ---- Breaks ---- */}
            <Section n="02" title="Cylinder break strengths" hint="add as many cylinders per age as you took · psi">
              <div className="brk-list">
                {window.entryAges(entry).map((age) => (
                  <BreakRow key={age} age={age} entry={entry} set={set} mix={mix} fc={fc} onRemoveAge={removeAge} />
                ))}
              </div>
              <button className="brk-addage" onClick={addAge}>+ Add break age (earlier break)</button>
            </Section>

            {/* ---- Admixtures & notes ---- */}
            <Section n="03" title="Admixtures & notes" hint="editable — rename, set unit, add or remove">
              <div className="admx-list">
                <div className="admx-head mono"><span>Admixture</span><span>Unit</span><span>Per load</span><span></span></div>
                {admx.map((a, idx) => (
                  <div className="admx-row" key={a.key}>
                    <input className="inp admx-name" value={a.label} onChange={(e) => updateAdmix(idx, 'label', e.target.value)} placeholder="name" />
                    <input className="inp admx-unit mono" value={a.unit || ''} onChange={(e) => updateAdmix(idx, 'unit', e.target.value)} placeholder="oz" />
                    <input className="inp admx-val mono" type="number" value={(entry.admx && entry.admx[a.key]) || ''} onChange={(e) => setAdmx(a.key, e.target.value)} placeholder="0" />
                    <button className="admx-x" title="remove admixture" onClick={() => removeAdmix(idx)}>×</button>
                  </div>
                ))}
                <button className="admx-add" onClick={addAdmix}>+ Add admixture</button>
              </div>
              <Field label="Comments" wide>
                <textarea className="inp ta" rows={2} value={entry.comments} onChange={(e) => set('comments', e.target.value)} placeholder="anomalies, NCR detail, weather, finishing notes…" />
              </Field>
              <div className="ef-toggles">
                <Toggle on={entry.ncr} onClick={() => set('ncr', !entry.ncr)} label="NCR raised" tone="warn" />
              </div>
            </Section>

            <div className="ef-actions">
              <button className="btn-ghost" onClick={onCancel}>Discard</button>
              <button className="btn-primary" onClick={() => onSave(entry)}>
                <span>Save record</span> <span className="mono">⏎</span>
              </button>
            </div>
          </div>

          <aside className="ef-side">
            <Readout entry={entry} mix={mix} res={res} />
          </aside>
        </div>
      </div>
      <FormStyles />
    </div>
  );
}

function Section({ n, title, hint, children }) {
  return (
    <section className="sec fadeUp">
      <div className="sec-head">
        <span className="sec-n mono">{n}</span>
        <div>
          <h3 className="sec-title disp">{title}</h3>
          {hint && <span className="sec-hint mono">{hint}</span>}
        </div>
      </div>
      <div className="sec-body">{children}</div>
    </section>
  );
}
function Toggle({ on, onClick, label, tone }) {
  return (
    <button className={'tg ' + (on ? 'on ' + tone : '')} onClick={onClick}>
      <span className="tg-box">{on ? '✓' : ''}</span>{label}
    </button>
  );
}

function FormStyles() {
  return <style>{`
    .ef{height:100%;}
    .ef-inner{max-width:1180px;margin:0 auto;padding:32px 36px 60px;}
    .ef-head{display:flex;align-items:center;gap:18px;margin-bottom:26px;}
    .ef-back{font-size:12px;color:var(--ink-dim);background:rgba(16,23,52,.5);
      border:1px solid var(--line);border-radius:99px;padding:7px 14px;transition:.15s;}
    .ef-back:hover{color:var(--ink);border-color:var(--line-strong);}
    .ef-title-wrap{display:flex;align-items:center;gap:14px;}
    .ef-title{font-size:24px;font-weight:600;margin:0;}
    .ef-mixbtn{font-size:12px;color:oklch(.86 .12 var(--h));border:1px solid oklch(.8 .14 var(--h)/.4);
      background:oklch(.7 .14 var(--h)/.1);border-radius:99px;padding:6px 12px;letter-spacing:.04em;}
    .ef-mixbtn span{color:var(--ink-faint);margin-left:6px;font-size:10px;}
    .ef-mixbtn:hover{border-color:oklch(.8 .14 var(--h)/.7);}
    .ef-cols{display:grid;grid-template-columns:1fr 332px;gap:28px;align-items:start;}
    .ef-form{display:flex;flex-direction:column;gap:22px;min-width:0;}
    .sec{background:rgba(13,19,44,.4);border:1px solid var(--line);border-radius:var(--r-lg);padding:20px 22px;}
    .sec-head{display:flex;gap:13px;align-items:flex-start;margin-bottom:18px;}
    .sec-n{font-size:12px;color:var(--cyan);border:1px solid var(--line-strong);border-radius:8px;
      padding:5px 8px;background:oklch(.8 .13 205/.08);flex:none;}
    .sec-title{font-size:15px;font-weight:600;margin:0;letter-spacing:.01em;}
    .sec-hint{font-size:10.5px;color:var(--ink-faint);margin-top:2px;display:block;}
    .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;}
    .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;}
    .fld{display:flex;flex-direction:column;gap:6px;min-width:0;}
    .fld.wide{margin-top:14px;}
    .fld-lab{font-size:11px;color:var(--ink-dim);font-weight:500;display:flex;justify-content:space-between;align-items:baseline;gap:6px;}
    .fld-unit{font-size:9.5px;color:var(--ink-faint);}
    .fld-hint{font-size:9px;color:var(--ink-faint);}
    .inp{width:100%;background:rgba(8,12,28,.6);border:1px solid var(--line);border-radius:9px;
      padding:10px 11px;font-size:13px;color:var(--ink);outline:none;transition:border-color .15s,box-shadow .15s;}
    .inp:focus{border-color:var(--cyan);box-shadow:0 0 0 3px oklch(.8 .13 205/.12);}
    .inp::placeholder{color:var(--ink-faint);}
    .inp.sel{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b94c0' stroke-width='1.4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat:no-repeat;background-position:right 11px center;padding-right:28px;}
    .inp.sel option{background:#0e1533;}
    /* themed date / time pickers — dark popup, cyan accents, mono digits */
    input[type=date].inp,input[type=time].inp{color-scheme:dark;accent-color:var(--cyan);
      font-family:var(--font-m);letter-spacing:.02em;background-image:linear-gradient(0deg,oklch(.8 .13 205/.04),oklch(.8 .13 205/.04));}
    input[type=date].inp:hover,input[type=time].inp:hover{border-color:var(--line-strong);}
    input[type=date].inp::-webkit-calendar-picker-indicator,
    input[type=time].inp::-webkit-calendar-picker-indicator{
      cursor:pointer;opacity:.85;border-radius:4px;padding:2px;
      filter:invert(74%) sepia(46%) saturate(560%) hue-rotate(150deg) brightness(102%);}
    input[type=date].inp::-webkit-calendar-picker-indicator:hover,
    input[type=time].inp::-webkit-calendar-picker-indicator:hover{opacity:1;background:oklch(.8 .13 205/.15);}
    input[type=date].inp::-webkit-datetime-edit-fields-wrapper,
    input[type=time].inp::-webkit-datetime-edit{color:var(--ink);}
    input[type=date].inp::-webkit-datetime-edit-text{color:var(--ink-faint);padding:0 1px;}
    input[type=date].inp:focus::-webkit-datetime-edit,
    input[type=time].inp:focus::-webkit-datetime-edit{color:#fff;}
    .ta{resize:vertical;line-height:1.5;font-family:var(--font-b);}
    .ro-readonly{background:rgba(8,12,28,.35);color:var(--cyan);display:flex;align-items:center;}
    /* break rows */
    .brk-list{display:flex;flex-direction:column;gap:11px;}
    .brk{padding:14px;border-radius:var(--r-md);border:1px solid var(--line);background:rgba(8,12,28,.4);transition:.2s;}
    .brk.design{border-color:oklch(.8 .13 205/.35);background:oklch(.8 .13 205/.05);}
    .brk-head{display:flex;align-items:center;gap:11px;margin-bottom:11px;flex-wrap:wrap;}
    .brk-age{font-size:17px;color:var(--ink);display:flex;align-items:baseline;gap:4px;}
    .brk-age span{font-size:10px;color:var(--ink-faint);font-family:var(--font-m);}
    .brk-tag{font-size:8.5px;letter-spacing:.12em;color:var(--cyan);border:1px solid oklch(.8 .13 205/.4);
      border-radius:5px;padding:2px 6px;background:oklch(.8 .13 205/.1);}
    .brk-date{width:auto;flex:1;min-width:130px;max-width:180px;padding:7px 10px;font-size:12px;margin-left:auto;}
    .brk-sg{font-size:10px;color:var(--ink-dim);background:rgba(16,23,52,.6);border:1px solid var(--line);
      border-radius:7px;padding:5px 8px;}
    .brk-sg:hover{color:var(--cyan);border-color:var(--cyan);}
    .brk-cyls{display:flex;gap:9px;align-items:center;}
    .brk-cyl-grid{display:flex;flex-wrap:wrap;gap:8px;flex:1;align-items:center;}
    .brk-cylbox{position:relative;width:84px;}
    .brk-cyl{text-align:center;width:100%;}
    .brk-cyl-x{position:absolute;top:-6px;right:-5px;width:16px;height:16px;border-radius:50%;
      background:var(--space-700);border:1px solid var(--line-strong);color:var(--ink-faint);
      font-size:10px;line-height:1;display:grid;place-items:center;opacity:0;transition:.12s;}
    .brk-cylbox:hover .brk-cyl-x{opacity:1;}
    .brk-cyl-x:hover{color:var(--red);border-color:var(--red);}
    .brk-addcyl{font-size:11px;color:var(--cyan);background:oklch(.8 .13 205/.08);
      border:1px dashed oklch(.8 .13 205/.4);border-radius:9px;padding:9px 11px;transition:.15s;white-space:nowrap;}
    .brk-addcyl:hover{background:oklch(.8 .13 205/.16);border-style:solid;}
    .brk-out{display:flex;flex-direction:column;align-items:center;min-width:78px;padding:4px 12px;
      border-left:1px solid var(--line);}
    /* editable admixtures */
    .admx-list{display:flex;flex-direction:column;gap:7px;}
    .admx-head{display:grid;grid-template-columns:1fr 70px 90px 26px;gap:9px;font-size:9px;
      letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint);padding:0 2px;}
    .admx-row{display:grid;grid-template-columns:1fr 70px 90px 26px;gap:9px;align-items:center;}
    .admx-x{width:26px;height:26px;border-radius:7px;background:rgba(8,12,28,.5);border:1px solid var(--line);
      color:var(--ink-faint);font-size:13px;transition:.12s;}
    .admx-x:hover{color:var(--red);border-color:var(--red);}
    .admx-add{align-self:flex-start;margin-top:3px;font-size:12px;color:var(--cyan);
      background:oklch(.8 .13 205/.08);border:1px dashed oklch(.8 .13 205/.4);border-radius:9px;padding:8px 13px;transition:.15s;}
    .admx-add:hover{background:oklch(.8 .13 205/.16);border-style:solid;}
    /* add break age */
    .brk-addage{margin-top:11px;font-size:12px;color:var(--cyan);background:oklch(.8 .13 205/.08);
      border:1px dashed oklch(.8 .13 205/.4);border-radius:10px;padding:9px 14px;transition:.15s;}
    .brk-addage:hover{background:oklch(.8 .13 205/.16);border-style:solid;}
    .brk.custom{border-color:oklch(.74 .16 290/.4);background:oklch(.72 .16 290/.05);}
    .brk-tag.custom{color:var(--violet);border-color:oklch(.72 .16 290/.45);background:oklch(.72 .16 290/.12);}
    .brk-rmage{width:22px;height:22px;border-radius:6px;background:rgba(8,12,28,.5);border:1px solid var(--line);
      color:var(--ink-faint);font-size:12px;}
    .brk-rmage:hover{color:var(--red);border-color:var(--red);}
    /* custom date picker */
    .df{position:relative;}
    .df.compact .df-btn{padding:7px 10px;font-size:12px;}
    .df-btn{width:100%;display:flex;align-items:center;gap:8px;background:rgba(8,12,28,.6);
      border:1px solid var(--line);border-radius:9px;padding:10px 11px;color:var(--ink);font-size:13px;
      transition:border-color .15s,box-shadow .15s;text-align:left;}
    .df-btn:hover{border-color:var(--line-strong);}
    .df-btn:focus-visible{border-color:var(--cyan);box-shadow:0 0 0 3px oklch(.8 .13 205/.12);}
    .df-btn.empty .df-val{color:var(--ink-faint);}
    .df-ic{color:var(--cyan);font-size:13px;}
    .df-val{font-size:12.5px;}
    .df-backdrop{position:fixed;inset:0;z-index:60;}
    .df-pop{position:absolute;top:calc(100% + 6px);left:0;z-index:61;width:238px;border-radius:var(--r-md);
      padding:12px;border-color:var(--line-strong);box-shadow:var(--shadow);animation:popIn .16s both;}
    .df-pop-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;}
    .df-month{font-size:13px;color:var(--ink);}
    .df-nav{width:26px;height:26px;border-radius:7px;background:rgba(8,12,28,.5);border:1px solid var(--line);
      color:var(--ink-dim);font-size:15px;line-height:1;}
    .df-nav:hover{color:var(--ink);border-color:var(--cyan);}
    .df-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px;}
    .df-dow span{text-align:center;font-size:9px;color:var(--ink-faint);}
    .df-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}
    .df-cell{height:28px;border-radius:7px;background:none;border:1px solid transparent;color:var(--ink-dim);
      font-size:12px;transition:.1s;}
    .df-cell:hover{background:oklch(.8 .13 205/.12);color:var(--ink);}
    .df-cell.empty{background:none;cursor:default;}
    .df-cell.today{border-color:var(--line-strong);color:var(--ink);}
    .df-cell.sel{background:linear-gradient(135deg,var(--cyan),var(--violet));color:#06122a;font-weight:600;}
    .df-foot{display:flex;gap:7px;margin-top:9px;}
    .df-act{flex:1;font-size:11px;color:var(--ink-dim);background:rgba(8,12,28,.5);border:1px solid var(--line);
      border-radius:8px;padding:7px;transition:.12s;}
    .df-act:hover{color:var(--ink);border-color:var(--cyan);}
    .df-act.clear:hover{color:var(--red);border-color:var(--red);}
    .brk-avg{font-size:17px;color:var(--ink);font-weight:500;}
    .brk-avglab{font-size:8.5px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.08em;}
    .brk-foot{display:flex;gap:9px;margin-top:11px;flex-wrap:wrap;}
    .brk-pct,.brk-v{font-size:10px;font-family:var(--font-m);padding:3px 9px;border-radius:99px;border:1px solid var(--line);}
    .brk-pct.ok{color:var(--green);border-color:oklch(.8 .15 155/.4);background:oklch(.6 .15 155/.08);}
    .brk-pct.mid{color:var(--amber);border-color:oklch(.82 .14 70/.4);background:oklch(.6 .14 70/.08);}
    .brk-pct.low{color:var(--red);border-color:oklch(.68 .19 18/.4);background:oklch(.6 .19 18/.08);}
    .brk-v.good{color:var(--green);}.brk-v.warn{color:var(--amber);}.brk-v.bad{color:var(--red);}
    /* toggles & actions */
    .ef-toggles{display:flex;gap:11px;margin-top:14px;}
    .tg{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink-dim);
      padding:8px 14px;border-radius:99px;background:rgba(8,12,28,.5);border:1px solid var(--line);transition:.15s;}
    .tg-box{width:16px;height:16px;border-radius:5px;border:1px solid var(--line-strong);display:grid;
      place-items:center;font-size:10px;color:#06122a;}
    .tg.on{color:var(--ink);}
    .tg.on.warn{border-color:oklch(.82 .14 70/.5);background:oklch(.6 .14 70/.1);}
    .tg.on.warn .tg-box{background:var(--amber);border-color:var(--amber);}
    .tg.on.ok{border-color:oklch(.8 .15 155/.5);background:oklch(.6 .15 155/.1);}
    .tg.on.ok .tg-box{background:var(--green);border-color:var(--green);}
    .ef-actions{display:flex;justify-content:flex-end;gap:12px;margin-top:6px;}
    .btn-ghost{padding:11px 20px;border-radius:11px;background:none;border:1px solid var(--line);
      color:var(--ink-dim);font-size:13px;transition:.15s;}
    .btn-ghost:hover{color:var(--ink);border-color:var(--line-strong);}
    .btn-primary{display:flex;align-items:center;gap:10px;padding:11px 22px;border-radius:11px;border:none;
      font-size:13px;font-weight:600;color:#06122a;background:linear-gradient(135deg,var(--cyan),var(--violet));
      transition:transform .12s,filter .15s;}
    .btn-primary:hover{transform:translateY(-1px);filter:brightness(1.08);}
    .btn-primary .mono{font-size:11px;opacity:.7;}
    @media (max-width:980px){.ef-cols{grid-template-columns:1fr;}.ef-side{order:-1;}.ro{position:relative;}
      .grid3{grid-template-columns:1fr 1fr;}.grid4{grid-template-columns:1fr 1fr;}}
  `}</style>;
}

Object.assign(window, { EntryForm, DateField });
