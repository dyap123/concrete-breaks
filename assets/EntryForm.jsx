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
  <select className="inp sel" {...p}>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
);

/* ---- cylinder break trio with live average ----------------------- */
function BreakRow({ age, entry, set, mix, fc }) {
  const cyl = [entry[`d${age}_1`], entry[`d${age}_2`], entry[`d${age}_3`]];
  const a = window.avg(cyl);
  const verdict = window.c39Verdict(cyl);
  const pct = a !== null && fc ? (a / fc) * 100 : null;
  const isDesign = age === (window.num(entry.age) ?? mix?.age);
  const suggest = entry.pourDate ? window.addDays(entry.pourDate, age) : '';
  return (
    <div className={'brk' + (isDesign ? ' design' : '')}>
      <div className="brk-head">
        <span className="brk-age disp">{age}<span>day</span></span>
        {isDesign && <span className="brk-tag mono">DESIGN AGE</span>}
        <input className="inp brk-date" type="date" value={entry[`d${age}_date`]}
          onChange={(e) => set(`d${age}_date`, e.target.value)} />
        {suggest && entry[`d${age}_date`] !== suggest && (
          <button className="brk-sg mono" title="Use pour date + age"
            onClick={() => set(`d${age}_date`, suggest)}>≈ {suggest.slice(5)}</button>
        )}
      </div>
      <div className="brk-cyls">
        {[1, 2, 3].map((n) => (
          <input key={n} className="inp brk-cyl mono" type="number" inputMode="numeric"
            placeholder={`cyl ${n}`} value={entry[`d${age}_${n}`]}
            onChange={(e) => set(`d${age}_${n}`, e.target.value)} />
        ))}
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
          {window.BREAK_AGES.map((age) => {
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
          <Stat label="Time elapsed" value={res.elapsed !== null ? window.fmt(res.elapsed, 2) + ' h' : '—'} hint="batch → sample" />
          <Stat label="7→28d gain" value={res.gain7_28 !== null ? '+' + window.fmt(res.gain7_28) : '—'}
            hint={res.gain7_28pct !== null ? '+' + window.fmt(res.gain7_28pct, 0) + '%' : ''} />
          <Stat label="7→56d gain" value={res.gain7_56 !== null ? '+' + window.fmt(res.gain7_56) : '—'}
            hint={res.gain7_56pct !== null ? '+' + window.fmt(res.gain7_56pct, 0) + '%' : ''} />
          <Stat label="Slump · Air" value={(entry.slump || '—') + '" · ' + (entry.air || '—')} hint="plastic" />
        </div>
      </div>
      <style>{`
        .ro{position:sticky;top:0;}
        .ro-card{border-radius:var(--r-lg);padding:18px;display:flex;flex-direction:column;gap:16px;
          border-color:var(--line-strong);box-shadow:0 0 50px -30px var(--glow-cyan);}
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
function EntryForm({ entry: initial, mix, onSave, onCancel, onChangeMix }) {
  const [entry, setEntry] = useStateE(initial);
  useEffectE(() => setEntry(initial), [initial.id]);
  const set = (k, v) => setEntry((e) => ({ ...e, [k]: v }));
  const fc = window.num(entry.fc) ?? mix?.fc;
  const res = useMemoE(() => window.computeResults(entry, mix), [entry, mix]);

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
                <Field label="Pour date"><T type="date" value={entry.pourDate} onChange={(e) => set('pourDate', e.target.value)} /></Field>
                <Field label="IR #"><T value={entry.ir} onChange={(e) => set('ir', e.target.value)} placeholder="inspection rpt" /></Field>
                <Field label="Batch ticket #"><T value={entry.ticket} onChange={(e) => set('ticket', e.target.value)} placeholder="ticket no." /></Field>
                <Field label="Area"><Sel options={window.AREAS} value={entry.area} onChange={(e) => set('area', e.target.value)} /></Field>
                <Field label="Element"><Sel options={window.ELEMENTS} value={entry.element || ''} onChange={(e) => set('element', e.target.value)} /></Field>
                <Field label="Design strength" unit="psi"><T type="number" value={entry.fc} onChange={(e) => set('fc', e.target.value)} className="inp mono" /></Field>
                <Field label="Design age" unit="days"><T type="number" value={entry.age} onChange={(e) => set('age', e.target.value)} className="inp mono" /></Field>
              </div>
            </Section>

            {/* ---- Fresh properties ---- */}
            <Section n="02" title="Fresh / plastic properties" hint="measured at sampling">
              <div className="grid3">
                <Field label="Batch time" hint="HH:MM"><T type="time" value={entry.batchTime} onChange={(e) => set('batchTime', e.target.value)} /></Field>
                <Field label="Sample time" hint="HH:MM"><T type="time" value={entry.sampleTime} onChange={(e) => set('sampleTime', e.target.value)} /></Field>
                <Field label="Elapsed" hint="auto">
                  <div className="inp ro-readonly mono">{res.elapsed !== null ? window.fmt(res.elapsed, 2) + ' h' : '—'}</div>
                </Field>
                <Field label="Ambient temp" unit="°F"><T type="number" value={entry.ambient} onChange={(e) => set('ambient', e.target.value)} className="inp mono" /></Field>
                <Field label="Concrete temp" unit="°F"><T type="number" value={entry.concreteTemp} onChange={(e) => set('concreteTemp', e.target.value)} className="inp mono" /></Field>
                <Field label="Actual slump" unit="in"><T type="number" step="0.25" value={entry.slump} onChange={(e) => set('slump', e.target.value)} className="inp mono" /></Field>
                <Field label="Air content" unit="%"><Sel options={window.AIR_OPTS} value={entry.air} onChange={(e) => set('air', e.target.value)} /></Field>
                <Field label="Actual W/C ratio"><T type="number" step="0.01" value={entry.actualWC} onChange={(e) => set('actualWC', e.target.value)} className="inp mono" placeholder="0.45" /></Field>
              </div>
            </Section>

            {/* ---- Breaks ---- */}
            <Section n="03" title="Cylinder break strengths" hint="three cylinders per age · psi">
              <div className="brk-list">
                {window.BREAK_AGES.map((age) => (
                  <BreakRow key={age} age={age} entry={entry} set={set} mix={mix} fc={fc} />
                ))}
              </div>
            </Section>

            {/* ---- Admixtures & notes ---- */}
            <Section n="04" title="Admixtures & notes" hint="oz / load">
              <div className="grid4">
                {window.ADMIXTURES.map((a) => (
                  <Field key={a.key} label={a.label} unit="oz">
                    <T type="number" value={entry[a.key]} onChange={(e) => set(a.key, e.target.value)} className="inp mono" placeholder="0" />
                  </Field>
                ))}
              </div>
              <Field label="Comments" wide>
                <textarea className="inp ta" rows={2} value={entry.comments} onChange={(e) => set('comments', e.target.value)} placeholder="anomalies, NCR detail, weather, finishing notes…" />
              </Field>
              <div className="ef-toggles">
                <Toggle on={entry.ncr} onClick={() => set('ncr', !entry.ncr)} label="NCR raised" tone="warn" />
                <Toggle on={entry.graphed} onClick={() => set('graphed', !entry.graphed)} label="Graphed" tone="ok" />
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
    input[type=date].inp,input[type=time].inp{color-scheme:dark;}
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
    .brk-cyls{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:9px;align-items:center;}
    .brk-cyl{text-align:center;}
    .brk-out{display:flex;flex-direction:column;align-items:center;min-width:78px;padding:4px 12px;
      border-left:1px solid var(--line);}
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
      box-shadow:0 0 26px -8px var(--glow-cyan);transition:transform .12s,box-shadow .2s;}
    .btn-primary:hover{transform:translateY(-1px);box-shadow:0 0 34px -6px var(--glow-cyan);}
    .btn-primary .mono{font-size:11px;opacity:.7;}
    @media (max-width:980px){.ef-cols{grid-template-columns:1fr;}.ef-side{order:-1;}.ro{position:relative;}
      .grid3{grid-template-columns:1fr 1fr;}.grid4{grid-template-columns:1fr 1fr;}}
  `}</style>;
}

Object.assign(window, { EntryForm });
