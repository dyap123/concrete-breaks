/* ====================================================================
   Concrete Break Result — data model & calculation helpers
   Derived from the "BREAK DATA (INPUT)" sheet of the HDH matrix.
   All values exported to window for the Babel component scripts.
==================================================================== */

/* ---- Mix designs -------------------------------------------------- */
/* Color-code a mix by its DESIGN STRENGTH tier → a stable accent hue, so
   every mix of the same f'c shares a colour (8000=magenta · 6000=violet ·
   5000=blue · 4000=cyan · 3000=green · slurry=amber). */
function accentForStrength(fc) {
  if (fc == null) return 70;     // slurry → amber
  if (fc >= 8000) return 330;    // magenta
  if (fc >= 6000) return 290;    // violet
  if (fc >= 5000) return 255;    // blue
  if (fc >= 4000) return 205;    // cyan
  if (fc >= 3000) return 155;    // green
  return 230;                    // other → blue-grey
}
function strengthTier(fc) { return fc == null ? 'SLURRY' : fc.toLocaleString() + ' PSI'; }

/* Mix designs from the project Drive folder (LA Convention Center).
   fc = design (specified) strength psi · age = design test age (days).
   accent hue derived from strength so colour == strength tier. Interns
   can override fc/age per pour; managers add more via the mix picker.   */
const MIX_DESIGNS = [
  { code: 'O80D739K1', fc: 8000, age: 28, use: 'Pile Caps · alt (LC3 + Recover)', area: 'Pile Caps', agg: '1/2"', tests: 0 },
  { code: 'O74C735K1', fc: 8000, age: 28, use: 'Pile Caps · alt (LC3)',           area: 'Pile Caps', agg: '1"',   tests: 0 },
  { code: 'V71C746T1', fc: 5000, age: 28, use: 'Mild Deck',                       area: 'Deck',      agg: '1"',   tests: 0 },
  { code: 'S80S662L2', fc: null, age: 28, use: '8-sack sand slurry',              area: 'Backfill',  agg: 'sand', tests: 0 },
  { code: 'S30S4AHL2', fc: null, age: 28, use: '3-sack sand slurry / backfill',   area: 'Backfill',  agg: 'sand', tests: 0 },
].map((m) => ({ ...m, accent: accentForStrength(m.fc) }));

/* ---- Reference option lists -------------------------------------- */
const AREAS = ['Pile Caps', 'Deck', 'Backfill', 'Warehouse', 'Area 3', 'Area 56', 'B1L', 'TPL', 'Other'];
const ELEMENTS = [
  'Pile Cap', 'Foundation', 'Wall', 'Slab', 'Footing', 'Mild Deck',
  'Horizontal Rat Slab', 'Protection Slab', 'Sump Pit Slab', 'Column', 'Backfill', 'Other',
];
const AIR_OPTS = ['N/I', '1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5', '6.0'];
/* admixtures captured per load (oz/load) */
const ADMIXTURES = [
  { key: 'pozzolith', label: 'Pozzolith' },
  { key: 'glenium',   label: 'Glenium' },
  { key: 'adva',      label: 'ADVA' },
  { key: 'delvo',     label: 'Delvo' },
];
/* break ages to capture — each holds a test date + three cylinder breaks */
const BREAK_AGES = [7, 28, 56, 90];

/* ---- Calculation helpers ----------------------------------------- */
const num = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const avg = (arr) => {
  const xs = arr.map(num).filter((x) => x !== null);
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
};

const range = (arr) => {
  const xs = arr.map(num).filter((x) => x !== null);
  if (xs.length < 2) return null;
  return Math.max(...xs) - Math.min(...xs);
};

/* sample standard deviation */
const stdev = (arr) => {
  const xs = arr.map(num).filter((x) => x !== null);
  if (xs.length < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
};

/* coefficient of variation as % */
const cov = (arr) => {
  const m = avg(arr);
  const s = stdev(arr);
  if (m === null || s === null || m === 0) return null;
  return (s / m) * 100;
};

/* ASTM C39 single-operator within-test range acceptability.
   Acceptable range for 3 cylinders ≈ 9.4% of average. */
const c39Verdict = (arr) => {
  const r = range(arr);
  const m = avg(arr);
  if (r === null || m === null || m === 0) return null;
  const pct = (r / m) * 100;
  if (pct <= 9.4) return { label: 'Acceptable', tone: 'good', pct };
  if (pct <= 14) return { label: 'Marginal', tone: 'warn', pct };
  return { label: 'Review', tone: 'bad', pct };
};

/* hours between two "HH:MM" strings (handles wrap past midnight) */
const elapsedHrs = (batch, sample) => {
  if (!batch || !sample) return null;
  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };
  const b = toMin(batch), s = toMin(sample);
  if (b === null || s === null) return null;
  let d = s - b;
  if (d < 0) d += 24 * 60;
  return d / 60;
};

/* add days to an ISO yyyy-mm-dd date → ISO */
const addDays = (iso, days) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/* ISO date → Excel serial (1900 date system) for paste-back */
const isoToSerial = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return '';
  const epoch = Date.UTC(1899, 11, 30);
  return Math.round((d.getTime() - epoch) / 86400000);
};

const fmt = (v, digits = 0) => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return Number(v).toLocaleString(undefined, {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });
};

/* Build the full derived-results object for one entry. */
function computeResults(entry, mix) {
  const fc = num(entry.fc) ?? mix?.fc ?? null;
  const ages = {};
  let designAvg = null;
  BREAK_AGES.forEach((age) => {
    const cyl = [entry[`d${age}_1`], entry[`d${age}_2`], entry[`d${age}_3`]];
    const a = avg(cyl);
    ages[age] = {
      cyl, avg: a,
      range: range(cyl),
      cov: cov(cyl),
      verdict: c39Verdict(cyl),
      pctFc: a !== null && fc ? (a / fc) * 100 : null,
    };
    if (mix && age === (num(entry.age) ?? mix.age)) designAvg = a;
  });
  const designAge = num(entry.age) ?? mix?.age ?? null;
  const da = designAge && ages[designAge] ? ages[designAge].avg : null;
  const met = da !== null && fc ? da >= fc : null;

  const gain7_28 = ages[7].avg !== null && ages[28].avg !== null ? ages[28].avg - ages[7].avg : null;
  const gain7_56 = ages[7].avg !== null && ages[56].avg !== null ? ages[56].avg - ages[7].avg : null;

  return {
    fc, designAge, ages, met,
    elapsed: elapsedHrs(entry.batchTime, entry.sampleTime),
    gain7_28, gain7_56,
    gain7_28pct: gain7_28 !== null && ages[7].avg ? (gain7_28 / ages[7].avg) * 100 : null,
    gain7_56pct: gain7_56 !== null && ages[7].avg ? (gain7_56 / ages[7].avg) * 100 : null,
  };
}

/* A blank entry record. */
function blankEntry(mix) {
  const e = {
    id: 'E' + Math.random().toString(36).slice(2, 9),
    created: Date.now(),
    mix: mix?.code || '',
    fc: mix?.fc || '',
    age: mix?.age || '',
    area: mix?.area || '',
    element: '',
    pourNumber: '',
    pourDate: '',
    ir: '',
    ticket: '',
    batchTime: '',
    sampleTime: '',
    ambient: '',
    concreteTemp: '',
    slump: '',
    air: 'N/I',
    actualWC: '',
    ncr: false,
    graphed: false,
    comments: '',
  };
  BREAK_AGES.forEach((age) => {
    e[`d${age}_date`] = '';
    e[`d${age}_1`] = '';
    e[`d${age}_2`] = '';
    e[`d${age}_3`] = '';
  });
  ADMIXTURES.forEach((a) => { e[a.key] = ''; });
  return e;
}

/* CSV column order mirrors the workbook's INPUT sheet ordering. */
const CSV_COLUMNS = [
  ['ncr', 'NCR?'], ['graphed', 'Graphed?'], ['pourNumber', 'Pour Number'],
  ['pourDate', 'Pour Date'], ['ir', 'IR#'], ['ticket', 'Batch Ticket #'],
  ['batchTime', 'Batch Time'], ['sampleTime', 'Sample Time'],
  ['area', 'Area'], ['element', 'Element'], ['age', 'Design Days'],
  ['mix', 'Mix Design'], ['ambient', 'Ambient Temp'], ['concreteTemp', 'Concrete Temp'],
  ['slump', 'Actual Slump'], ['air', 'Air Content'], ['fc', 'Design Strength'],
  ['d7_date', '7 Day Test Date'], ['d7_1', '7D Str 1'], ['d7_2', '7D Str 2'], ['d7_3', '7D Str 3'],
  ['d28_date', '28 Day Test Date'], ['d28_1', '28D Str 1'], ['d28_2', '28D Str 2'], ['d28_3', '28D Str 3'],
  ['d56_date', '56 Day Test Date'], ['d56_1', '56D Str 1'], ['d56_2', '56D Str 2'], ['d56_3', '56D Str 3'],
  ['d90_date', '90 Day Test Date'], ['d90_1', '90D Str 1'], ['d90_2', '90D Str 2'], ['d90_3', '90D Str 3'],
  ['actualWC', 'Actual W/C'],
  ['pozzolith', 'Pozzolith'], ['glenium', 'Glenium'], ['adva', 'ADVA'], ['delvo', 'Delvo'],
  ['comments', 'Comments'],
];

function entriesToCSV(entries) {
  const head = CSV_COLUMNS.map((c) => c[1]).join(',');
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rows = entries.map((e) =>
    CSV_COLUMNS.map(([k]) => {
      let v = e[k];
      if (typeof v === 'boolean') v = v ? 'YES' : '';
      return esc(v);
    }).join(','),
  );
  return [head, ...rows].join('\n');
}

/* ---- Crew / leaderboard helpers ---------------------------------- */
/* Rank ladder — title earned at a points threshold (space-themed). */
const RANKS = [
  { min: 0,  title: 'Cadet' },
  { min: 3,  title: 'Pilot' },
  { min: 8,  title: 'Navigator' },
  { min: 15, title: 'Commander' },
  { min: 28, title: 'Captain' },
  { min: 45, title: 'Admiral' },
];
function rankFor(points) {
  let r = RANKS[0];
  for (const x of RANKS) if (points >= x.min) r = x;
  return r;
}
/* points still needed for the next rank (null if maxed) */
function nextRank(points) {
  for (const x of RANKS) if (points < x.min) return { title: x.title, need: x.min - points, at: x.min };
  return null;
}
/* deterministic accent hue from a name */
function hueFromName(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}
function initials(name) {
  const p = (name || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
}

Object.assign(window, {
  MIX_DESIGNS, AREAS, ELEMENTS, AIR_OPTS, ADMIXTURES, BREAK_AGES,
  num, avg, range, stdev, cov, c39Verdict, elapsedHrs, addDays,
  isoToSerial, fmt, computeResults, blankEntry, CSV_COLUMNS, entriesToCSV,
  RANKS, rankFor, nextRank, hueFromName, initials,
  accentForStrength, strengthTier,
});
