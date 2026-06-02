/* ====================================================================
   Auth — sign-in gate + crew roster. Danzel is the fixed mission
   manager; interns sign in (or add themselves) and earn points by
   logging pours. Everything persists in localStorage.
==================================================================== */
const { useState: useStateAu } = React;

/* Reusable crew avatar — initials in a hue-keyed orb. */
function Avatar({ name, size = 38, manager }) {
  const h = window.hueFromName(name);
  return (
    <span className="avatar" style={{
      '--h': h, width: size, height: size,
      fontSize: size * 0.36,
      background: manager
        ? 'conic-gradient(from 210deg,var(--amber),var(--magenta),var(--violet),var(--amber))'
        : `radial-gradient(circle at 32% 28%,oklch(.82 .13 ${h}),oklch(.55 .15 ${(h + 40) % 360}))`,
    }}>
      {window.initials(name)}
      <style>{`
        .avatar{display:grid;place-items:center;border-radius:50%;flex:none;color:#06122a;
          font-family:var(--font-d);font-weight:600;letter-spacing:.02em;
          box-shadow:0 0 16px -4px oklch(.8 .14 var(--h)/.6);position:relative;}
      `}</style>
    </span>
  );
}

function AuthGate({ users, onSignIn, onAddUser }) {
  const [adding, setAdding] = useStateAu(false);
  const [name, setName] = useStateAu('');

  const manager = users.find((u) => u.role === 'manager');
  const interns = users.filter((u) => u.role === 'intern')
    .sort((a, b) => b.points - a.points);

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onAddUser(n); setName(''); setAdding(false);
  };

  return (
    <div className="auth scrollY">
      <div className="auth-inner fadeUp">
        <div className="auth-brand">
          <span className="brand-mark big"><span></span></span>
          <div>
            <div className="auth-title disp">ORBITAL</div>
            <div className="auth-tag mono">concrete break logger · crew sign-in</div>
          </div>
        </div>

        <h1 className="auth-h1 disp">Who's logging pours?</h1>
        <p className="auth-lead">Sign in so every break record you log earns you a point on the crew leaderboard.</p>

        {manager && (
          <div className="auth-mgr" onClick={() => onSignIn(manager.id)}>
            <Avatar name={manager.name} size={46} manager />
            <div className="mgr-info">
              <div className="mgr-name disp">{manager.name}</div>
              <div className="mgr-role mono">◆ MISSION MANAGER</div>
            </div>
            <span className="mgr-go mono">enter →</span>
          </div>
        )}

        <div className="auth-sub mono">CREW</div>
        <div className="auth-grid">
          {interns.map((u) => {
            const rank = window.rankFor(u.points);
            return (
              <button key={u.id} className="crew-card" onClick={() => onSignIn(u.id)}>
                <Avatar name={u.name} size={40} />
                <div className="crew-info">
                  <div className="crew-name">{u.name}</div>
                  <div className="crew-rank mono">{rank.title}</div>
                </div>
                <div className="crew-pts mono">{u.points}<span>pts</span></div>
              </button>
            );
          })}

          {adding ? (
            <div className="crew-card editing">
              <input autoFocus className="crew-input" placeholder="Your name"
                value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false); }} />
              <div className="crew-add-actions">
                <button className="ca-cancel" onClick={() => setAdding(false)}>✕</button>
                <button className="ca-go" onClick={submit}>Join →</button>
              </div>
            </div>
          ) : (
            <button className="crew-add" onClick={() => setAdding(true)}>
              <span className="ca-plus">+</span>
              <span>Add yourself</span>
            </button>
          )}
        </div>
      </div>

      <style>{`
        .auth{position:fixed;inset:0;z-index:50;display:flex;align-items:flex-start;justify-content:center;
          background:radial-gradient(circle at 50% 0%,rgba(20,28,62,.5),transparent 60%);}
        .auth-inner{width:min(640px,92vw);padding:8vh 28px 60px;}
        .auth-brand{display:flex;align-items:center;gap:14px;margin-bottom:42px;}
        .brand-mark.big{width:44px;height:44px;border-radius:13px;}
        .brand-mark{display:grid;place-items:center;
          background:radial-gradient(circle at 30% 25%,var(--cyan),var(--violet) 70%,var(--magenta));
          box-shadow:0 0 26px -4px var(--glow-cyan);}
        .brand-mark.big span{width:14px;height:14px;border-radius:50%;background:#06122a;}
        .auth-title{font-size:18px;letter-spacing:.22em;}
        .auth-tag{font-size:10px;color:var(--ink-faint);letter-spacing:.08em;margin-top:2px;}
        .auth-h1{font-size:34px;font-weight:600;margin:0;letter-spacing:-.01em;
          background:linear-gradient(120deg,#fff 20%,var(--cyan) 60%,var(--violet));
          -webkit-background-clip:text;background-clip:text;color:transparent;}
        .auth-lead{margin:12px 0 30px;font-size:15px;color:var(--ink-dim);line-height:1.6;max-width:480px;text-wrap:pretty;}
        .auth-mgr{display:flex;align-items:center;gap:15px;padding:16px 18px;border-radius:var(--r-lg);
          cursor:pointer;background:linear-gradient(120deg,oklch(.7 .14 60/.12),oklch(.7 .16 330/.08));
          border:1px solid oklch(.8 .14 60/.32);transition:.18s;margin-bottom:30px;}
        .auth-mgr:hover{border-color:oklch(.8 .14 60/.6);box-shadow:0 0 34px -14px oklch(.8 .14 60/.7);transform:translateY(-1px);}
        .mgr-info{flex:1;}
        .mgr-name{font-size:17px;color:var(--ink);}
        .mgr-role{font-size:10px;color:var(--amber);letter-spacing:.12em;margin-top:3px;}
        .mgr-go{font-size:12px;color:var(--ink-dim);}
        .auth-sub{font-size:10px;letter-spacing:.16em;color:var(--ink-faint);margin-bottom:13px;}
        .auth-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;}
        .crew-card{display:flex;align-items:center;gap:12px;padding:13px 15px;border-radius:var(--r-md);
          text-align:left;background:rgba(16,23,52,.55);border:1px solid var(--line);transition:.16s;}
        .crew-card:hover{border-color:var(--line-strong);background:rgba(22,30,64,.7);transform:translateY(-1px);
          box-shadow:0 0 26px -14px var(--glow-cyan);}
        .crew-info{flex:1;min-width:0;}
        .crew-name{font-size:14px;color:var(--ink);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .crew-rank{font-size:10px;color:var(--ink-faint);margin-top:2px;}
        .crew-pts{font-size:16px;color:var(--cyan);display:flex;flex-direction:column;align-items:flex-end;line-height:1;}
        .crew-pts span{font-size:8px;color:var(--ink-faint);margin-top:2px;}
        .crew-card.editing{flex-direction:column;align-items:stretch;gap:9px;border-style:solid;border-color:var(--line-strong);}
        .crew-input{background:rgba(8,12,28,.6);border:1px solid var(--line);border-radius:9px;
          padding:9px 11px;font-size:13px;color:var(--ink);outline:none;}
        .crew-input:focus{border-color:var(--cyan);}
        .crew-add-actions{display:flex;gap:8px;}
        .ca-cancel{width:34px;border-radius:8px;background:none;border:1px solid var(--line);color:var(--ink-faint);font-size:11px;}
        .ca-go{flex:1;border-radius:8px;border:none;font-size:12px;font-weight:600;color:#06122a;
          background:linear-gradient(135deg,var(--cyan),var(--violet));padding:9px;}
        .crew-add{display:flex;align-items:center;justify-content:center;gap:9px;padding:13px;border-radius:var(--r-md);
          border:1.5px dashed var(--line-strong);background:rgba(12,18,42,.35);color:var(--ink-dim);font-size:13px;transition:.16s;}
        .crew-add:hover{border-color:var(--cyan);color:var(--ink);}
        .ca-plus{font-size:18px;color:var(--cyan);line-height:1;}
      `}</style>
    </div>
  );
}

Object.assign(window, { AuthGate, Avatar });
