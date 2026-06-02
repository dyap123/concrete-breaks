/* ====================================================================
   Reports — pick mixes + format, then export. Two outputs:
   1. PDF: a tidy dark report with a comparison chart, per-mix charts,
      stats and record tables.
   2. Excel: a workbook matching the LACC Concrete Break Tracker
      (Mix Master + Break Data + Standards tabs).
==================================================================== */
const { useState: useStateR, useEffect: useEffectR } = React;

/* ---- shared computations over the entry model ---- */
function cylOf(e, age) { const a = e['d' + age]; return Array.isArray(a) ? a : [e['d' + age + '_1'], e['d' + age + '_2'], e['d' + age + '_3']]; }
function recsFor(entries, code) { return entries.filter((e) => e.mix === code); }
function avgForAge(entries, code, age) {
  const v = []; recsFor(entries, code).forEach((e) => { const a = window.avg(cylOf(e, age)); if (a != null) v.push(a); });
  return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null;
}
function mixStats(mixes, entries, code) {
  const mix = mixes.find((m) => m.code === code); const fc = mix && mix.fc;
  const recs = recsFor(entries, code);
  const a28 = []; const covs = []; let pass = 0, n28 = 0;
  recs.forEach((e) => {
    const c = cylOf(e, 28); const av = window.avg(c);
    if (av != null) { a28.push(av); n28++; if (fc && av >= fc) pass++; const cv = window.cov(c); if (cv != null) covs.push(cv); }
  });
  return {
    mix, fc, n: recs.length, n28,
    avg28: a28.length ? Math.round(a28.reduce((x, y) => x + y, 0) / a28.length) : null,
    pass: n28 ? Math.round(pass / n28 * 100) : null,
    cov: covs.length ? (covs.reduce((x, y) => x + y, 0) / covs.length).toFixed(1) : null,
  };
}
function isoToday() { return new Date().toISOString().slice(0, 10); }

/* ---- render a Chart.js config to a PNG data-URL (offscreen) ---- */
function chartImage(cfg, w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ch = new window.Chart(cv.getContext('2d'), { type: cfg.type, data: cfg.data, options: { ...cfg.options, responsive: false, animation: false, devicePixelRatio: 1 } });
  const url = ch.toBase64Image('image/png', 1); ch.destroy(); return url;
}
const PDF_PALETTE = ['oklch(.82 .15 200)', 'oklch(.74 .2 330)', 'oklch(.74 .17 285)', 'oklch(.8 .16 150)', 'oklch(.84 .15 75)', 'oklch(.72 .16 255)', 'oklch(.78 .19 350)', 'oklch(.82 .13 180)'];

/* ================= PDF ================= */
function generatePDF(mixes, entries, codes) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40;
  const ages = window.BREAK_AGES;
  const paint = () => { doc.setFillColor(8, 11, 22); doc.rect(0, 0, W, H, 'F'); };
  const need = (h) => { if (y + h > H - 40) { doc.addPage(); paint(); y = 50; } };
  paint();
  doc.setTextColor(232, 236, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  doc.text('LACC Concrete Break Report', M, 54);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(150, 160, 205);
  doc.text('LA Convention Center · Webcor Concrete', M, 72);
  doc.text(isoToday(), W - M, 72, { align: 'right' });
  doc.setDrawColor(74, 142, 255); doc.setLineWidth(1.5); doc.line(M, 84, W - M, 84);
  let y = 104;

  // comparison chart
  const cmpCfg = {
    type: 'line',
    data: { labels: ages.map((a) => a + '-day'),
      datasets: codes.map((code, i) => ({ label: code, data: ages.map((a) => avgForAge(entries, code, a)), borderColor: PDF_PALETTE[i % PDF_PALETTE.length], backgroundColor: PDF_PALETTE[i % PDF_PALETTE.length], spanGaps: true, tension: 0.35, borderWidth: 2.5, pointRadius: 3 })) },
    options: { plugins: { legend: { display: true, position: 'bottom', labels: { color: '#c3ccd6' } } }, scales: { y: { ticks: { color: '#aab2dd', callback: (v) => v.toLocaleString() }, grid: { color: 'rgba(120,140,230,.12)' } }, x: { ticks: { color: '#aab2dd' }, grid: { display: false } } } },
  };
  doc.setFillColor(13, 20, 48); doc.roundedRect(M, y, W - 2 * M, 210, 8, 8, 'F');
  doc.setTextColor(120, 200, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('STRENGTH BY AGE — COMPARISON', M + 14, y + 20);
  try { doc.addImage(chartImage(cmpCfg, 1040, 420), 'PNG', M + 10, y + 28, W - 2 * M - 20, 170); } catch (e) {}
  y += 226;

  codes.forEach((code) => {
    const s = mixStats(mixes, entries, code); const recs = recsFor(entries, code); const fc = s.fc;
    need(60);
    doc.setTextColor(232, 236, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(code, M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(150, 160, 205);
    doc.text((s.mix && s.mix.use ? s.mix.use : '') + (fc ? `   ·   f'c ${fc.toLocaleString()} psi @ ${(s.mix && s.mix.age) || 28}d` : '   ·   slurry'), M + 18 + code.length * 8, y);
    y += 16;
    doc.setFontSize(9); doc.setTextColor(170, 178, 221);
    doc.text(`Records ${s.n}      Avg 28-day ${s.avg28 ? s.avg28.toLocaleString() + ' psi' : '—'}      Pass rate ${s.pass == null ? '—' : s.pass + '%'}      Avg COV ${s.cov == null ? '—' : s.cov + '%'}`, M, y + 12);
    y += 26;
    if (recs.length) {
      const data = ages.map((a) => avgForAge(entries, code, a));
      const barCfg = {
        type: 'bar',
        data: { labels: ages.map((a) => a + '-day'), datasets: [{ data, backgroundColor: window.strengthBarColor(data, fc), borderRadius: 6 }] },
        options: { plugins: { legend: { display: false }, fcLine: { value: fc || 0 } }, scales: { y: { beginAtZero: true, suggestedMax: Math.ceil(Math.max(fc || 0, ...data.filter((v) => v != null), 0) * 1.14 / 500) * 500 || undefined, ticks: { color: '#aab2dd', callback: (v) => v.toLocaleString() }, grid: { color: 'rgba(120,140,230,.12)' } }, x: { ticks: { color: '#aab2dd' }, grid: { display: false } } } },
      };
      const ph = 150; need(ph + 10);
      doc.setFillColor(13, 20, 48); doc.roundedRect(M, y, W - 2 * M, ph, 8, 8, 'F');
      try { doc.addImage(chartImage(barCfg, 1040, 360), 'PNG', M + 10, y + 8, W - 2 * M - 20, ph - 16); } catch (e) {}
      y += ph + 12;
      const body = recs.slice(0, 16).map((e) => {
        const a7 = window.avg(cylOf(e, 7)), a28 = window.avg(cylOf(e, 28));
        const pct = (a28 != null && fc) ? Math.round(a28 / fc * 100) + '%' : '—';
        const res = (a28 != null && fc) ? (a28 >= fc ? 'PASS' : 'FAIL') : '—';
        const loc = [e.area && 'Area ' + e.area, e.sequence && 'Seq ' + e.sequence].filter(Boolean).join(' · ') || '—';
        return [e.pourNumber || '—', e.pourDate || '—', loc, a7 != null ? Math.round(a7).toLocaleString() : '—', a28 != null ? Math.round(a28).toLocaleString() : '—', pct, res];
      });
      need(40 + body.length * 16);
      doc.autoTable({ head: [['Pour #', 'Date', 'Location', '7D avg', '28D avg', "%f'c", 'Result']], body, startY: y, margin: { left: M, right: M }, theme: 'grid',
        styles: { fontSize: 8, cellPadding: 4, textColor: [210, 216, 240], lineColor: [40, 50, 90], fillColor: [13, 18, 40] },
        headStyles: { fillColor: [20, 28, 62], textColor: [150, 200, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [16, 22, 48] },
        didParseCell: (d) => { if (d.section === 'body' && d.column.index === 6) { d.cell.styles.textColor = d.cell.raw === 'PASS' ? [120, 220, 160] : d.cell.raw === 'FAIL' ? [255, 130, 150] : [150, 160, 200]; } } });
      y = doc.lastAutoTable.finalY + 8;
      if (recs.length > 16) { doc.setFontSize(8); doc.setTextColor(120, 130, 170); doc.text(`+${recs.length - 16} more records — see the Excel export`, M, y); y += 14; }
    } else { doc.setFontSize(9); doc.setTextColor(120, 130, 170); doc.text('No break records logged for this mix yet.', M, y + 8); y += 26; }
    y += 14;
  });

  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) { doc.setPage(p); doc.setFontSize(8); doc.setTextColor(110, 120, 160); doc.text(`OpenBreak · LACC Concrete    ·    ${p} / ${pages}`, W / 2, H - 18, { align: 'center' }); }
  doc.save(`LACC_Break_Report_${isoToday()}.pdf`);
}

/* ================= Excel (LACC format) ================= */
function buildLACCWorkbook(mixes, entries, codes) {
  const XLSX = window.XLSX;
  const sel = new Set(codes);
  const numOrBlank = (v) => { const n = window.num(v); return n == null ? '' : n; };

  // Mix Master
  const mmHead = ['Mix #', 'Application', "Design f'c (psi)", 'Design Age (days)', 'Design Slump (in)', 'Slump Tol (±in)', 'Nominal Max Agg', 'W/C+P', 'Cementitious (sk/cy)', 'Cement Type', 'Supplier', "Req. Avg f'cr (psi)", 'Mix Design Date', 'Notes'];
  const mmRows = mixes.filter((m) => sel.has(m.code)).map((m) => [m.code, m.use || '', m.fc ?? '', m.age ?? '', m.slumpTarget ?? '', m.slumpTol ?? '', m.agg || '', m.wcRatio ?? '', m.cementitious ?? '', m.cementType || '', m.supplier || '', m.fcr ?? '', m.designDate || '', m.notes || '']);
  const wsMM = XLSX.utils.aoa_to_sheet([mmHead, ...mmRows]);
  wsMM['!cols'] = [12, 26, 14, 14, 14, 12, 14, 8, 16, 28, 18, 16, 16, 36].map((w) => ({ wch: w }));

  // Break Data
  const bdHead = ['Pour #', 'Pour Date', 'Element', 'Area / Location', 'Mix #', 'Batch Ticket #', 'Sample Time', 'Actual Slump (in)', "Design f'c", 'Design Slump', 'Slump Tol', 'Slump In-Spec?', '7-Day Test Date', '7D Cyl 1', '7D Cyl 2', '7D Cyl 3', '7D Avg', "7D %f'c", '28-Day Test Date', '28D Cyl 1', '28D Cyl 2', '28D Cyl 3', '28D Avg', "28D %f'c", 'Met Strength?', '28D Range', '28D COV%', 'Comments'];
  const rows = entries.filter((e) => sel.has(e.mix)).sort((a, b) => (a.mix || '').localeCompare(b.mix || '') || (a.pourDate || '').localeCompare(b.pourDate || ''));
  const bdRows = rows.map((e) => {
    const mix = mixes.find((m) => m.code === e.mix); const fc = (mix && mix.fc) || '';
    const c7 = cylOf(e, 7).map(numOrBlank); while (c7.length < 3) c7.push('');
    const c28 = cylOf(e, 28).map(numOrBlank); while (c28.length < 3) c28.push('');
    const a7 = window.avg(cylOf(e, 7)), a28 = window.avg(cylOf(e, 28));
    const rng = window.range(cylOf(e, 28)); const cvp = window.cov(cylOf(e, 28));
    const loc = [e.area, e.sequence && 'Seq ' + e.sequence].filter(Boolean).join(' / ');
    return [e.pourNumber || '', e.pourDate || '', e.element || '', loc, e.mix || '', e.ticket || '', '', '', fc, '', '', '', e['d7_date'] || '',
      c7[0], c7[1], c7[2], a7 != null ? Math.round(a7) : '', (a7 != null && fc) ? +(a7 / fc).toFixed(3) : '',
      e['d28_date'] || '', c28[0], c28[1], c28[2], a28 != null ? Math.round(a28) : '', (a28 != null && fc) ? +(a28 / fc).toFixed(3) : '',
      (a28 != null && fc) ? (a28 >= fc ? 'PASS' : 'FAIL') : '', rng == null ? '' : rng, cvp == null ? '' : +(cvp / 100).toFixed(4), e.comments || ''];
  });
  const wsBD = XLSX.utils.aoa_to_sheet([bdHead, ...bdRows]);
  wsBD['!cols'] = bdHead.map((h, i) => ({ wch: i === 3 ? 18 : i === 2 ? 14 : i === 27 ? 30 : 11 }));

  // Standards (ACI 214 within-test)
  const wsStd = XLSX.utils.aoa_to_sheet([
    ['ACI 214 within-test variation (single-batch COV%)'], ['Class', 'Max COV%'],
    ['Excellent', 0.03], ['Very Good', 0.04], ['Good', 0.05], ['Fair', 0.06], ['Poor', 1],
  ]);
  wsStd['!cols'] = [{ wch: 44 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsMM, 'Mix Master');
  XLSX.utils.book_append_sheet(wb, wsBD, 'Break Data');
  XLSX.utils.book_append_sheet(wb, wsStd, 'Standards');
  XLSX.writeFile(wb, `LACC_Concrete_Break_Tracker_${isoToday()}.xlsx`);
}

/* ================= UI ================= */
function ReportsView({ mixes, entries }) {
  const all = mixes.map((m) => m.code);
  const logged = new Set(entries.map((e) => e.mix));
  const [sel, setSel] = useStateR(all);
  const [fmt, setFmt] = useStateR('pdf');
  const [busy, setBusy] = useStateR(false);
  useEffectR(() => { setSel((p) => { const f = p.filter((c) => all.includes(c)); return f.length ? f : all; }); }, [all.join()]);
  const toggle = (c) => setSel((p) => p.includes(c) ? (p.length > 1 ? p.filter((x) => x !== c) : p) : [...p, c]);
  const run = () => {
    setBusy(true);
    setTimeout(() => {
      try { if (fmt === 'pdf') generatePDF(mixes, entries, sel); else buildLACCWorkbook(mixes, entries, sel); }
      catch (e) { alert('Export failed: ' + e.message); }
      setBusy(false);
    }, 30);
  };
  const recCount = entries.filter((e) => sel.includes(e.mix)).length;

  return (
    <div className="rep scrollY">
      <div className="rep-inner">
        <header className="rec-head fadeUp">
          <div>
            <div className="ms-eyebrow mono">◇ EXPORT</div>
            <h1 className="ms-h1 disp">Reports</h1>
            <p className="ms-lead">Pick the mixes and a format. PDF gives a charted summary; Excel matches the LACC Concrete Break Tracker workbook.</p>
          </div>
        </header>

        <div className="rep-card glass fadeUp">
          <div className="rep-card-head"><span className="rep-eyebrow mono">◇ MIX DESIGNS</span>
            <div className="rep-allnone">
              <button onClick={() => setSel(all)}>All</button><span>·</span><button onClick={() => setSel([all[0]])}>None</button>
            </div>
          </div>
          <div className="rep-chips">
            {all.map((code) => { const on = sel.includes(code); const has = logged.has(code);
              return (<button key={code} className={'rep-chip' + (on ? ' on' : '') + (has ? '' : ' nodata')} style={{ '--c': window.mixColor(mixes.find((m) => m.code === code)) }} onClick={() => toggle(code)}>
                <span className="rep-check">{on ? '✓' : ''}</span>{code}{has ? '' : ' ·'}
              </button>); })}
          </div>
        </div>

        <div className="rep-formats fadeUp">
          <button className={'rep-fmt glass' + (fmt === 'pdf' ? ' on' : '')} onClick={() => setFmt('pdf')}>
            <span className="rep-fmt-ic">▰</span>
            <div><div className="rep-fmt-t disp">PDF report</div><div className="rep-fmt-d">Charted summary — comparison + per-mix strength charts, stats and record tables. Dark, presentation-ready.</div></div>
          </button>
          <button className={'rep-fmt glass' + (fmt === 'excel' ? ' on' : '')} onClick={() => setFmt('excel')}>
            <span className="rep-fmt-ic">▦</span>
            <div><div className="rep-fmt-t disp">Excel workbook</div><div className="rep-fmt-d">LACC tracker format — Mix Master, Break Data (7D/28D cylinders, %f'c, COV) and Standards tabs.</div></div>
          </button>
        </div>

        <div className="rep-run fadeUp">
          <div className="rep-summary mono">{sel.length} mix{sel.length === 1 ? '' : 'es'} · {recCount} record{recCount === 1 ? '' : 's'} · {fmt === 'pdf' ? 'PDF' : '.xlsx'}</div>
          <button className="btn-primary rep-go" disabled={busy || !sel.length} onClick={run}><span>{busy ? 'Generating…' : (fmt === 'pdf' ? '⭳ Generate PDF' : '⭳ Generate Excel')}</span></button>
        </div>
      </div>

      <style>{`
        .rep{height:100%;}
        .rep-inner{max-width:920px;margin:0 auto;padding:48px 40px 60px;}
        .rep-card{border-radius:var(--r-lg);padding:20px 22px;margin-bottom:18px;border-color:var(--line-strong);}
        .rep-card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
        .rep-eyebrow{font-size:10px;letter-spacing:.2em;color:var(--cyan);}
        .rep-allnone{font-size:11px;color:var(--ink-faint);display:flex;gap:8px;align-items:center;}
        .rep-allnone button{color:var(--ink-dim);font-family:var(--font-m);font-size:11px;}
        .rep-allnone button:hover{color:var(--cyan);}
        .rep-chips{display:flex;gap:9px;flex-wrap:wrap;}
        .rep-chip{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--ink-faint);
          padding:9px 14px;border-radius:11px;background:rgba(8,12,28,.4);border:1px solid var(--line);
          font-family:var(--font-m);transition:.14s;}
        .rep-chip .rep-check{width:15px;height:15px;border-radius:5px;border:1px solid var(--line-strong);
          display:grid;place-items:center;font-size:10px;color:#06122a;}
        .rep-chip:hover{color:var(--ink-dim);border-color:var(--line-strong);}
        .rep-chip.on{color:var(--ink);border-color:var(--c);background:color-mix(in oklch,var(--c) 14%,transparent);}
        .rep-chip.on .rep-check{background:var(--c);border-color:var(--c);}
        .rep-chip.nodata{opacity:.55;}
        .rep-formats{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;}
        .rep-fmt{display:flex;gap:14px;align-items:flex-start;text-align:left;padding:18px 20px;border-radius:var(--r-lg);
          border-color:var(--line);transition:.15s;}
        .rep-fmt:hover{border-color:var(--line-strong);}
        .rep-fmt.on{border-color:var(--cyan);background:oklch(.8 .13 205/.08);}
        .rep-fmt-ic{font-size:22px;color:var(--cyan);line-height:1;margin-top:2px;}
        .rep-fmt-t{font-size:16px;color:var(--ink);}
        .rep-fmt-d{font-size:12px;color:var(--ink-dim);line-height:1.5;margin-top:5px;}
        .rep-run{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 20px;
          border-radius:var(--r-lg);background:rgba(13,19,44,.5);border:1px solid var(--line-strong);}
        .rep-summary{font-size:12px;color:var(--ink-dim);letter-spacing:.02em;}
        .rep-go{padding:12px 22px;font-size:14px;}
        @media (max-width:760px){.rep-formats{grid-template-columns:1fr;}.rep-run{flex-direction:column;align-items:stretch;}}
      `}</style>
    </div>
  );
}

Object.assign(window, { ReportsView });
