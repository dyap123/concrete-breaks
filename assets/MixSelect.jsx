/* ====================================================================
   MixSelect — the launch view. Pick a mix design (or add one) to begin
   a new break-test record. Each mix is keyed to an accent hue.
==================================================================== */
const { useState: useStateM } = React;

function MixCard({ mix, onPick, count }) {
  const h = mix.accent;
  return (
    <button className="mix-card fadeUp" style={{ '--h': h }} onClick={() => onPick(mix)}>
      <div className="mix-glow"></div>
      <div className="mix-top">
        <span className="mix-code disp">{mix.code}</span>
        <span className="mix-chip mono">{mix.fc != null ? mix.fc.toLocaleString() + ' psi' : 'slurry'}</span>
      </div>
      <div className="mix-use">{mix.use}</div>
      <div className="mix-meta mono">
        <span>{mix.age}-day design</span>
        <span className="dot">·</span>
        <span>{mix.area}</span>
        {mix.agg && <><span className="dot">·</span><span>{mix.agg} agg</span></>}
      </div>
      <div className="mix-foot">
        <span className="mix-count mono">{count > 0 ? `${count} logged this session` : `${mix.tests} historic tests`}</span>
        <span className="mix-go">Log break →</span>
      </div>
      <style>{`
        .mix-card{position:relative;text-align:left;padding:20px;border-radius:var(--r-lg);
          background:linear-gradient(160deg,rgba(20,28,62,.66),rgba(11,16,40,.6));
          border:1px solid var(--line);overflow:hidden;transition:transform .18s,border-color .2s,box-shadow .25s;
          min-height:172px;display:flex;flex-direction:column;}
        .mix-card:hover{transform:translateY(-3px);border-color:oklch(.8 .14 var(--h)/.5);
          box-shadow:0 22px 50px -28px #000,0 0 40px -16px oklch(.8 .14 var(--h)/.6);}
        .mix-glow{position:absolute;width:160px;height:160px;right:-50px;top:-60px;border-radius:50%;
          background:radial-gradient(circle,oklch(.75 .16 var(--h)/.5),transparent 65%);
          filter:blur(14px);opacity:.55;transition:opacity .25s;}
        .mix-card:hover .mix-glow{opacity:.9;}
        .mix-top{display:flex;align-items:center;justify-content:space-between;gap:10px;position:relative;}
        .mix-code{font-size:21px;letter-spacing:.02em;color:var(--ink);
          text-shadow:0 0 22px oklch(.8 .14 var(--h)/.45);}
        .mix-chip{font-size:11px;color:oklch(.85 .12 var(--h));border:1px solid oklch(.8 .14 var(--h)/.4);
          border-radius:99px;padding:4px 9px;background:oklch(.7 .14 var(--h)/.1);white-space:nowrap;}
        .mix-use{margin-top:11px;font-size:14px;color:var(--ink-dim);font-weight:500;position:relative;}
        .mix-meta{margin-top:6px;font-size:11px;color:var(--ink-faint);display:flex;gap:7px;position:relative;}
        .mix-meta .dot{opacity:.6;}
        .mix-foot{margin-top:auto;padding-top:16px;display:flex;align-items:center;
          justify-content:space-between;position:relative;}
        .mix-count{font-size:10.5px;color:var(--ink-faint);}
        .mix-go{font-size:12px;font-weight:600;color:oklch(.86 .12 var(--h));opacity:0;transform:translateX(-4px);transition:.2s;}
        .mix-card:hover .mix-go{opacity:1;transform:none;}
      `}</style>
    </button>
  );
}

function MixSelect({ mixes, counts, onPick, onAddMix }) {
  const [adding, setAdding] = useStateM(false);
  const [form, setForm] = useStateM({ code: '', fc: '6000', age: '28', use: '', area: 'Warehouse' });

  const submit = () => {
    if (!form.code.trim()) return;
    const fc = parseInt(form.fc) || 6000;
    onAddMix({
      code: form.code.trim().toUpperCase(),
      fc,
      age: parseInt(form.age) || 28,
      use: form.use.trim() || 'Custom mix',
      area: form.area, accent: window.accentForStrength(fc), tests: 0,
    });
    setForm({ code: '', fc: '6000', age: '28', use: '', area: 'Warehouse' });
    setAdding(false);
  };

  return (
    <div className="ms-wrap scrollY">
      <div className="ms-inner">
        <div className="ms-hero fadeUp">
          <div className="ms-eyebrow mono">◇ NEW BREAK RECORD</div>
          <h1 className="ms-h1 disp">Select a mix design</h1>
          <p className="ms-lead">Choose the concrete mix you're logging cylinder breaks for. Strength, design age and area pre-fill from the matrix — adjust anything per pour.</p>
        </div>

        <div className="ms-grid">
          {mixes.map((m) => (
            <MixCard key={m.code} mix={m} count={counts[m.code] || 0} onPick={onPick} />
          ))}

          {!adding ? (
            <button className="mix-add fadeUp" onClick={() => setAdding(true)}>
              <span className="add-plus">+</span>
              <span className="add-label">Add a mix design</span>
              <span className="add-sub mono">not in the matrix yet</span>
            </button>
          ) : (
            <div className="mix-add editing fadeUp">
              <input autoFocus placeholder="MIX CODE  e.g. W50C95Q1" className="add-input mono"
                value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && submit()} />
              <div className="add-row">
                <label>f'c psi<input type="number" value={form.fc} onChange={(e) => setForm({ ...form, fc: e.target.value })} /></label>
                <label>Age d<input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></label>
              </div>
              <input placeholder="Use / element" className="add-input"
                value={form.use} onChange={(e) => setForm({ ...form, use: e.target.value })} />
              <div className="add-actions">
                <button className="add-cancel" onClick={() => setAdding(false)}>Cancel</button>
                <button className="add-save" onClick={submit}>Add mix</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .ms-wrap{height:100%;}
        .ms-inner{max-width:1080px;margin:0 auto;padding:54px 40px 60px;}
        .ms-hero{margin-bottom:34px;}
        .ms-eyebrow{font-size:11px;letter-spacing:.22em;color:var(--cyan);margin-bottom:14px;}
        .ms-h1{font-size:38px;font-weight:600;letter-spacing:-.01em;margin:0;
          background:linear-gradient(120deg,#fff 20%,var(--cyan) 60%,var(--violet));
          -webkit-background-clip:text;background-clip:text;color:transparent;}
        .ms-lead{max-width:560px;margin:14px 0 0;font-size:15px;line-height:1.6;color:var(--ink-dim);text-wrap:pretty;}
        .ms-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(258px,1fr));gap:18px;}
        .mix-add{min-height:172px;border-radius:var(--r-lg);border:1.5px dashed var(--line-strong);
          background:rgba(12,18,42,.34);display:flex;flex-direction:column;align-items:center;
          justify-content:center;gap:5px;color:var(--ink-dim);transition:.2s;}
        .mix-add:hover{border-color:var(--cyan);background:rgba(16,23,52,.5);color:var(--ink);}
        .add-plus{font-size:30px;font-weight:300;line-height:1;color:var(--cyan);}
        .add-label{font-size:14px;font-weight:500;}
        .add-sub{font-size:10px;color:var(--ink-faint);}
        .mix-add.editing{cursor:default;align-items:stretch;justify-content:flex-start;
          padding:18px;gap:10px;border-style:solid;border-color:var(--line-strong);background:rgba(16,23,52,.6);}
        .add-input{background:rgba(8,12,28,.55);border:1px solid var(--line);border-radius:9px;
          padding:10px 12px;font-size:13px;outline:none;color:var(--ink);}
        .add-input:focus{border-color:var(--cyan);}
        .add-row{display:flex;gap:10px;}
        .add-row label{flex:1;display:flex;flex-direction:column;gap:4px;font-size:10px;
          color:var(--ink-faint);text-transform:uppercase;letter-spacing:.08em;}
        .add-row input{background:rgba(8,12,28,.55);border:1px solid var(--line);border-radius:9px;
          padding:8px 10px;font-size:13px;outline:none;color:var(--ink);font-family:var(--font-m);}
        .add-actions{display:flex;gap:8px;margin-top:auto;}
        .add-cancel{flex:1;padding:9px;border-radius:9px;background:none;border:1px solid var(--line);color:var(--ink-dim);font-size:12px;}
        .add-save{flex:1;padding:9px;border-radius:9px;border:none;font-size:12px;font-weight:600;color:#06122a;
          background:linear-gradient(135deg,var(--cyan),var(--violet));}
      `}</style>
    </div>
  );
}

Object.assign(window, { MixSelect });
