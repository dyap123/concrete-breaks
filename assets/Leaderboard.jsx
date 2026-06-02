/* ====================================================================
   Leaderboard — crew standings. Manager (Danzel) featured up top;
   interns ranked by points with a top-3 podium and a full list.
==================================================================== */
function Leaderboard({ users, entries, currentId, onLog }) {
  const Avatar = window.Avatar;
  const manager = users.find((u) => u.role === 'manager');
  const interns = users.filter((u) => u.role === 'intern')
    .map((u) => ({ ...u, logged: entries.filter((e) => e.loggedBy === u.id).length }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  const podium = interns.slice(0, 3);
  const rest = interns.slice(3);
  const order = [1, 0, 2]; // visual L-M-R so #1 sits centre

  return (
    <div className="lb scrollY">
      <div className="lb-inner">
        <header className="lb-head fadeUp">
          <div>
            <div className="ms-eyebrow mono">◇ CREW STANDINGS</div>
            <h1 className="ms-h1 disp">Leaderboard</h1>
            <p className="lb-lead">One point per pour logged. Climb the ranks from Cadet to Admiral.</p>
          </div>
          <button className="btn-primary" onClick={onLog}><span>✦ Log a pour</span></button>
        </header>

        {manager && (
          <div className="lb-mgr glass fadeUp">
            <Avatar name={manager.name} size={52} manager />
            <div className="lb-mgr-info">
              <div className="lb-mgr-name disp">{manager.name}</div>
              <div className="lb-mgr-role mono">◆ MISSION MANAGER · oversees all pours</div>
            </div>
            <div className="lb-mgr-stat">
              <div className="lb-mgr-num mono">{entries.length}</div>
              <div className="lb-mgr-lab mono">crew pours</div>
            </div>
          </div>
        )}

        {interns.length === 0 ? (
          <div className="lb-empty mono">No crew yet — sign in and log a pour to start the board.</div>
        ) : (
          <>
            <div className="podium">
              {order.map((idx) => {
                const u = podium[idx];
                if (!u) return <div key={idx} className="pod-slot empty"></div>;
                const place = interns.indexOf(u) + 1;
                const rank = window.rankFor(u.points);
                return (
                  <div key={u.id} className={`pod-slot p${place}` + (u.id === currentId ? ' me' : '')}>
                    <div className="pod-medal mono">{place === 1 ? '①' : place === 2 ? '②' : '③'}</div>
                    <Avatar name={u.name} size={place === 1 ? 60 : 50} />
                    <div className="pod-name">{u.name}{u.id === currentId && <span className="me-tag">you</span>}</div>
                    <div className="pod-rank mono">{rank.title}</div>
                    <div className="pod-pts mono">{u.points}<span> pts</span></div>
                    <div className="pod-bar" style={{ height: place === 1 ? 70 : place === 2 ? 50 : 36 }}></div>
                  </div>
                );
              })}
            </div>

            {rest.length > 0 && (
              <div className="lb-list">
                {rest.map((u, i) => {
                  const rank = window.rankFor(u.points);
                  const nx = window.nextRank(u.points);
                  return (
                    <div key={u.id} className={'lb-row' + (u.id === currentId ? ' me' : '')}>
                      <span className="lb-place mono">{i + 4}</span>
                      <Avatar name={u.name} size={34} />
                      <div className="lb-row-info">
                        <span className="lb-row-name">{u.name}{u.id === currentId && <span className="me-tag">you</span>}</span>
                        <span className="lb-row-rank mono">{rank.title}{nx ? ` · ${nx.need} to ${nx.title}` : ' · max rank'}</span>
                      </div>
                      <span className="lb-row-logged mono">{u.logged} logged</span>
                      <span className="lb-row-pts mono">{u.points}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .lb{height:100%;}
        .lb-inner{max-width:880px;margin:0 auto;padding:48px 40px 60px;}
        .lb-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:26px;}
        .lb-lead{margin:10px 0 0;font-size:14px;color:var(--ink-dim);}
        .lb-mgr{display:flex;align-items:center;gap:16px;padding:18px 20px;border-radius:var(--r-lg);
          margin-bottom:28px;border-color:oklch(.8 .14 60/.3);
          box-shadow:0 0 50px -30px oklch(.8 .14 60/.6);}
        .lb-mgr-info{flex:1;}
        .lb-mgr-name{font-size:19px;}
        .lb-mgr-role{font-size:10.5px;color:var(--amber);letter-spacing:.1em;margin-top:4px;}
        .lb-mgr-stat{text-align:right;}
        .lb-mgr-num{font-size:26px;color:var(--ink);}
        .lb-mgr-lab{font-size:9px;color:var(--ink-faint);letter-spacing:.1em;text-transform:uppercase;}
        .lb-empty{padding:40px;text-align:center;color:var(--ink-faint);font-size:13px;
          border:1px dashed var(--line);border-radius:var(--r-lg);}
        /* podium */
        .podium{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;align-items:end;margin-bottom:26px;}
        .pod-slot{display:flex;flex-direction:column;align-items:center;gap:7px;padding:18px 12px 0;
          border-radius:var(--r-lg) var(--r-lg) 0 0;background:linear-gradient(180deg,rgba(20,28,62,.55),rgba(11,16,40,.3));
          border:1px solid var(--line);border-bottom:none;animation:fadeUp .5s both;}
        .pod-slot.empty{background:none;border:none;}
        .pod-slot.p1{box-shadow:0 0 50px -24px var(--glow-cyan);border-color:var(--line-strong);}
        .pod-slot.me{outline:1px solid var(--cyan);outline-offset:-1px;}
        .pod-medal{font-size:18px;color:var(--ink-dim);}
        .pod-slot.p1 .pod-medal{color:var(--amber);}
        .pod-name{font-size:14px;font-weight:600;color:var(--ink);margin-top:3px;text-align:center;display:flex;align-items:center;gap:6px;}
        .pod-rank{font-size:10px;color:var(--ink-faint);}
        .pod-pts{font-size:18px;color:var(--cyan);}
        .pod-pts span{font-size:10px;color:var(--ink-faint);}
        .pod-bar{width:100%;margin-top:8px;border-radius:6px 6px 0 0;
          background:linear-gradient(180deg,oklch(.7 .13 250/.5),oklch(.5 .13 280/.2));}
        .pod-slot.p1 .pod-bar{background:linear-gradient(180deg,var(--cyan),oklch(.6 .14 260/.3));}
        .me-tag{font-size:8.5px;font-family:var(--font-m);color:#06122a;background:var(--cyan);
          border-radius:99px;padding:1px 6px;letter-spacing:.04em;}
        /* list */
        .lb-list{display:flex;flex-direction:column;gap:8px;}
        .lb-row{display:flex;align-items:center;gap:14px;padding:11px 16px;border-radius:var(--r-md);
          background:rgba(13,19,44,.45);border:1px solid var(--line);transition:.15s;}
        .lb-row:hover{border-color:var(--line-strong);}
        .lb-row.me{border-color:var(--cyan);background:oklch(.8 .13 205/.06);}
        .lb-place{width:20px;text-align:center;font-size:13px;color:var(--ink-faint);}
        .lb-row-info{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;}
        .lb-row-name{font-size:14px;color:var(--ink);font-weight:500;display:flex;align-items:center;gap:7px;}
        .lb-row-rank{font-size:10px;color:var(--ink-faint);}
        .lb-row-logged{font-size:11px;color:var(--ink-dim);}
        .lb-row-pts{font-size:17px;font-family:var(--font-m);color:var(--cyan);min-width:34px;text-align:right;}
        @media (max-width:720px){.lb-row-logged{display:none;}}
      `}</style>
    </div>
  );
}

Object.assign(window, { Leaderboard });
