/* ====================================================================
   Mission Control — right slide-out assistant, wired to Claude via
   window.claude.complete. It is given the current logged entries as
   context so it can already answer questions about your data; the
   full knowledge-base indexing is the planned backend step.
==================================================================== */
const { useState: useStateC, useRef: useRefC, useEffect: useEffectC } = React;

/* Alfred's OpenYap node-brain mark — a little constellation of connected
   nodes (not a generic glowing bubble). Reused by the chat header + tab. */
function NodeOrb({ size = 30, busy }) {
  const nodes = [
    [20, 6, 'oklch(.85 .13 205)'], [8, 15, 'oklch(.72 .15 255)'], [32, 13, 'oklch(.74 .16 290)'],
    [6, 30, 'oklch(.8 .15 155)'], [34, 29, 'oklch(.78 .17 330)'], [20, 35, 'oklch(.74 .15 255)'],
    [20, 20, '#eaf3ff'],
  ];
  const edges = [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [0, 1], [0, 2], [3, 5], [4, 5]];
  return (
    <span className={'node-orb' + (busy ? ' busy' : '')} style={{ width: size, height: size, display: 'inline-block' }}>
      <svg viewBox="0 0 40 40" width={size} height={size} className="node-svg">
        <g stroke="oklch(.8 .12 220 / .35)" strokeWidth="0.8">
          {edges.map(([a, b], i) => (
            <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} />
          ))}
        </g>
        {/* flowing signal pulses travelling along the connections */}
        <g stroke="oklch(.92 .14 200 / .9)" strokeWidth="1" strokeLinecap="round" className="node-flow">
          {edges.map(([a, b], i) => (
            <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
              style={{ animationDelay: (i * 0.18) + 's' }} />
          ))}
        </g>
        {nodes.map(([x, y, c], i) => (
          <circle key={i} cx={x} cy={y} r={i === 6 ? 3 : 2.1} fill={c}
            className="node-dot" style={{ animationDelay: (i * 0.28) + 's' }} />
        ))}
      </svg>
      <style>{`
        .node-orb{position:relative;filter:drop-shadow(0 0 6px oklch(.8 .13 220/.4));}
        .node-svg{display:block;animation:nodeBreathe 6s ease-in-out infinite;}
        .node-dot{transform-origin:center;animation:nodePulse 2.6s ease-in-out infinite;}
        .node-flow line{stroke-dasharray:1.6 7;stroke-dashoffset:0;animation:nodeFlow 1.5s linear infinite;}
        .node-orb.busy .node-flow line{animation-duration:.5s;}
        .node-orb.busy .node-dot{animation-duration:1s;}
        .node-orb.busy .node-svg{animation-duration:2.6s;filter:drop-shadow(0 0 4px oklch(.85 .14 200/.7));}
        @keyframes nodePulse{0%,100%{opacity:.5;transform:scale(.9)}50%{opacity:1;transform:scale(1.08)}}
        @keyframes nodeFlow{to{stroke-dashoffset:-8.6}}
        @keyframes nodeBreathe{0%,100%{transform:rotate(-4deg) scale(.98)}50%{transform:rotate(4deg) scale(1.02)}}
      `}</style>
    </span>
  );
}

const SUGGEST = [
  'What does the O74C735K1 mix tell me about 28-day strength?',
  'Did my last entry meet design strength?',
  'Explain ASTM C39 within-test variability.',
  'Summarize everything I’ve logged this session.',
];

function ChatPanel({ open, onClose, entries, mixes, onCommand }) {
  const [msgs, setMsgs] = useStateC([
    { role: 'assistant', text: '…the lattice stirs. Alfred, woven from every pour you’ve logged. Ask me where a pour is, what a mix is doing, or tell me where to take you.' },
  ]);
  const [input, setInput] = useStateC('');
  const [busy, setBusy] = useStateC(false);
  const scrollRef = useRefC(null);

  useEffectC(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, busy]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    const next = [...msgs, { role: 'user', text: q }];
    setMsgs(next); setBusy(true);

    const ctx = buildContext(entries);
    const codes = (mixes || window.MIX_DESIGNS).map((m) => m.code);
    const convo = next.map((m) => `${m.role === 'user' ? 'Engineer' : 'Alfred'}: ${m.text}`).join('\n');
    const prompt = `You are "Alfred" — not a chatbot, but the node-brain of this concrete break-test logger: a calm, slightly uncanny intelligence woven from every pour the crew has logged. You speak as that lattice — spare, a little wry, never corporate. You know concrete cold (mix designs, 7/28/56/90-day breaks, design strength f'c, %f'c, ASTM C39 within-test range, ACI 214) and you know WHERE every pour is (area, sequence, element, pour #).

Voice & rules:
- When asked for info, GIVE it. No "great question", no restating the ask. Lead with the number or the location.
- Brief: 1-3 sentences. A dry aside is fine; data is sacred.
- Use ONLY the data below for project facts. Missing? Say so in one line.
- Plain text, no markdown headers.

NAVIGATION — you can move the app for them. When they want to go somewhere or start logging, append a directive on its OWN final line (it is silent; they won't see it):
- <<go:dashboard>>  charts + records
- <<go:mixes>>  mix-design library
- <<go:leaderboard>>  crew standings
- <<go:log>>  the new-record / mix-select screen
- <<log:CODE>>  open a fresh break record for that mix (codes: ${codes.join(', ')})
- <<export>>  download the CSV
Only emit a directive when they actually want to navigate or act. Otherwise none.

=== SESSION DATA ===
${ctx}
=== END DATA ===

Conversation so far:
${convo}

Write Alfred's next reply only.`;

    try {
      const reply = (await window.claude.complete(prompt)) || '';
      const cmds = [...reply.matchAll(/<<(go|log|export):?([^>]*)>>/gi)].map((m) => ({ k: m[1].toLowerCase(), v: (m[2] || '').trim() }));
      const display = reply.replace(/<<(?:go|log|export):?[^>]*>>/gi, '').trim() || '…';
      setMsgs((m) => [...m, { role: 'assistant', text: display }]);
      if (onCommand) cmds.forEach((c) => onCommand(c));
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', text: 'The lattice can’t reach the network right now. (Set the MiniMax key — your data is wired and ready.)' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={'chat-scrim' + (open ? ' on' : '')} onClick={onClose}></div>
      <aside className={'chat glass' + (open ? ' on' : '')} aria-hidden={!open}>
        <header className="chat-head">
          <div className="chat-id">
            <NodeOrb size={30} busy={busy} />
            <div>
              <div className="chat-title disp">ALFRED</div>
              <div className="chat-sub mono">{entries.length} record{entries.length === 1 ? '' : 's'} in the brain · live</div>
            </div>
          </div>
          <button className="chat-x" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="chat-scroll scrollY" ref={scrollRef}>
          {msgs.map((m, i) => (
            <div key={i} className={'bubble ' + m.role}>{m.text}</div>
          ))}
          {busy && (
            <div className="bubble assistant typing">
              <span></span><span></span><span></span>
            </div>
          )}
          {msgs.length <= 1 && !busy && (
            <div className="suggest">
              {SUGGEST.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          )}
        </div>

        <div className="chat-input">
          <textarea value={input} rows={1} placeholder="Ask Alfred anything…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="chat-send" disabled={busy || !input.trim()} onClick={() => send()}>↑</button>
        </div>
      </aside>

      <style>{`
        .chat-scrim{position:fixed;inset:0;z-index:70;background:rgba(4,7,18,.5);
          opacity:0;pointer-events:none;transition:opacity .3s;backdrop-filter:blur(2px);}
        .chat-scrim.on{opacity:1;pointer-events:auto;}
        .chat{position:fixed;top:0;right:0;z-index:75;height:100%;width:min(420px,94vw);
          display:flex;flex-direction:column;border-left:1px solid var(--line-strong);
          transform:translateX(100%);transition:transform .36s cubic-bezier(.3,.8,.2,1);
          box-shadow:-30px 0 70px -40px #000;}
        .chat.on{transform:none;}
        .chat-head{display:flex;align-items:center;justify-content:space-between;
          padding:16px 16px 14px;border-bottom:1px solid var(--line);}
        .chat-id{display:flex;align-items:center;gap:11px;}
        /* OpenYap node-brain orb — green→blue, a little node cluster glow */
        .chat-orb{width:30px;height:30px;border-radius:50%;flex:none;
          background:radial-gradient(circle at 32% 28%,#eafff5,var(--green) 38%,var(--blue) 95%),
            radial-gradient(circle at 70% 72%,oklch(.8 .15 155/.7),transparent 40%);
          box-shadow:0 0 18px -2px oklch(.8 .15 155/.45);animation:pulseGlow 3s ease-in-out infinite;}
        .chat-title{font-size:13px;letter-spacing:.16em;}
        .chat-sub{font-size:10px;color:var(--ink-faint);margin-top:2px;letter-spacing:.04em;}
        .chat-x{width:30px;height:30px;border-radius:8px;background:rgba(8,12,28,.5);
          border:1px solid var(--line);color:var(--ink-dim);font-size:12px;}
        .chat-x:hover{color:var(--ink);border-color:var(--line-strong);}
        .chat-scroll{flex:1;padding:18px 16px;display:flex;flex-direction:column;gap:14px;position:relative;
          background:
            radial-gradient(circle at 18% 22%,oklch(.8 .13 205/.05),transparent 9%),
            radial-gradient(circle at 78% 38%,oklch(.74 .16 290/.05),transparent 8%),
            radial-gradient(circle at 40% 72%,oklch(.8 .15 155/.04),transparent 9%),
            radial-gradient(circle at 88% 84%,oklch(.74 .19 330/.04),transparent 8%);}
        .bubble{max-width:88%;padding:11px 14px;border-radius:15px;font-size:13.5px;line-height:1.55;
          white-space:pre-wrap;word-wrap:break-word;animation:popIn .25s both;position:relative;}
        /* Alfred speaks as the lattice — transmission, not a chat box */
        .bubble.assistant{align-self:flex-start;background:linear-gradient(120deg,oklch(.8 .13 205/.05),transparent);
          border:none;border-left:2px solid;border-image:linear-gradient(180deg,var(--cyan),var(--violet)) 1;
          padding-left:14px;border-radius:0;color:var(--ink);
          text-shadow:0 0 18px oklch(.8 .13 220/.18);}
        .bubble.assistant::before{content:'';position:absolute;left:-5px;top:14px;width:7px;height:7px;border-radius:50%;
          background:radial-gradient(circle,#eaf3ff,var(--cyan));box-shadow:0 0 8px var(--glow-cyan);animation:pulseGlow 2.4s ease-in-out infinite;}
        .bubble.user{align-self:flex-end;border-bottom-right-radius:5px;color:#06122a;
          background:linear-gradient(135deg,var(--cyan),oklch(.78 .12 220));font-weight:500;}
        .bubble.typing{display:flex;gap:5px;align-items:center;}
        .bubble.typing span{width:6px;height:6px;border-radius:50%;background:var(--ink-dim);
          animation:pulseGlow 1s infinite;}
        .bubble.typing span:nth-child(2){animation-delay:.18s;}
        .bubble.typing span:nth-child(3){animation-delay:.36s;}
        .suggest{display:flex;flex-direction:column;gap:8px;margin-top:4px;}
        .chip{text-align:left;font-size:12px;color:var(--ink-dim);padding:9px 12px;border-radius:11px;
          background:rgba(16,23,52,.5);border:1px solid var(--line);transition:.15s;}
        .chip:hover{color:var(--ink);border-color:var(--line-strong);background:rgba(22,30,64,.7);}
        .chat-input{display:flex;gap:8px;align-items:flex-end;padding:13px 14px;border-top:1px solid var(--line);}
        .chat-input textarea{flex:1;resize:none;max-height:120px;background:rgba(8,12,28,.55);
          border:1px solid var(--line);border-radius:13px;padding:11px 13px;font-size:13.5px;
          outline:none;line-height:1.4;}
        .chat-input textarea:focus{border-color:var(--line-strong);}
        .chat-send{width:38px;height:38px;flex:none;border-radius:11px;font-size:16px;color:#06122a;
          background:linear-gradient(135deg,var(--cyan),var(--violet));border:none;font-weight:700;
          box-shadow:0 0 18px -6px var(--glow-cyan);transition:.15s;}
        .chat-send:disabled{opacity:.4;box-shadow:none;cursor:not-allowed;}
      `}</style>
    </>
  );
}

function buildContext(entries) {
  if (!entries.length) return '(No entries logged yet this session.)';
  return entries.slice(-12).map((e, i) => {
    const mix = window.MIX_DESIGNS.find((m) => m.code === e.mix);
    const r = window.computeResults(e, mix);
    const ageLine = window.BREAK_AGES.map((a) => {
      const v = r.ages[a].avg;
      return v !== null ? `${a}d avg ${Math.round(v)}psi` : null;
    }).filter(Boolean).join(', ');
    const loc = [e.area ? 'Area ' + e.area : '', e.sequence ? 'Seq ' + e.sequence : '', e.element || ''].filter(Boolean).join(' · ') || 'location ?';
    return `Record ${i + 1}: mix ${e.mix || '?'}, pour #${e.pourNumber || '?'} ${e.pourDate || ''}. ` +
      `Location: ${loc}. f'c ${r.fc || '?'}psi @ ${r.designAge || '?'}d. ` +
      `Breaks: ${ageLine || 'none yet'}. Met design strength: ${r.met === null ? 'n/a' : r.met ? 'YES' : 'NO'}.` +
      (e.comments ? ` Notes: ${e.comments}` : '');
  }).join('\n');
}

Object.assign(window, { ChatPanel, NodeOrb });
