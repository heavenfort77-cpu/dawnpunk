// Same-machine frame-rate A/B (Nov 23, owner 13:10: "check frame rate"): the Mac runners' frame rate for one commit swings by a third from job to job, so two
// commits measured in different jobs cannot be compared. Here ONE machine measures both: the old commit is built beside this one (git worktree), then
// tools/perfcheck.cjs (this commit's copy, GPU=1: real GPU, no vsync) runs the same spots on old, new, old, new ... ROUNDS times, alternating, so slow drift of
// the machine falls on both. Prints one ABFPS line per spot per run and a summary with the paired differences (new minus old, per round).
// Usage (on a macOS runner, workflow checksmac via ci/checks.json entry abfps): node tools/abfps.cjs <old sha> [spots, default combat+combat2,bosscombat+bosscombat2] [rounds, default 3]
const { execSync, spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..'), OLD = process.argv[2], SPOTS = (process.argv[3] || 'combat+combat2,bosscombat+bosscombat2').split(','), ROUNDS = +(process.argv[4] || 3);
if (!OLD) { console.log('FAIL abfps: no old commit given'); process.exit(1); }
const sh = (c, cwd) => execSync(c, { cwd: cwd || ROOT, stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 26 }).toString();
const OT = path.join(ROOT, '..', 'abfps_old');
try {
  if (!fs.existsSync(OT)) { sh('git fetch -q --depth 1 origin ' + OLD); sh('git worktree add -q --detach ' + JSON.stringify(OT) + ' ' + OLD); fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(OT, 'node_modules')); }
  sh('node build.mjs', OT);
  for (const f of ['perfcheck.cjs', 'audit_page.js']) fs.copyFileSync(path.join(__dirname, f), path.join(OT, 'tools', f));
  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) sh('node build.mjs');
} catch (e) { console.log('FAIL abfps: could not build the old commit: ' + String(e).slice(0, 200)); process.exit(1); }
const rows = [];
const run = (who, tree, spot, round) => {
  const r = spawnSync('node', [path.join(tree, 'tools', 'perfcheck.cjs'), 'medium'], { cwd: tree, env: { ...process.env, GPU: '1', SPOTS: spot, SECS: '8', SETTLE: '6', CSECS: '20', NOEXTRA: '1', NOBASEMB: '1', AUDIT: '0' }, maxBuffer: 1 << 28, timeout: 40 * 60000 });
  const out = String(r.stdout || '');
  for (const l of out.split('\n')) { const m = /^FPS medium (\w+): ([\d.]+) fps, avg ([\d.]+) ms, p95 ([\d.]+) ms, worst ([\d.]+) ms/.exec(l); if (!m) continue;
    const c = new RegExp('^PERF medium ' + m[1] + ': calls (\\d+)').exec(out.split('\n').find((q) => q.startsWith('PERF medium ' + m[1] + ':')) || '');
    const row = { round, who, spot: m[1], fps: +m[2], avg: +m[3], p95: +m[4], worst: +m[5], calls: c ? +c[1] : null }; rows.push(row); console.log('ABFPS ' + JSON.stringify(row)); }
  if (!/^FPS medium/m.test(out)) console.log('INFO abfps ' + who + ' ' + spot + ' round ' + round + ': no FPS line; tail: ' + out.split('\n').filter((q) => q.trim()).slice(-3).join(' | ').slice(0, 300));
};
for (let k = 1; k <= ROUNDS; k++) for (const spot of SPOTS) { const order = k % 2 ? [['old', OT], ['new', ROOT]] : [['new', ROOT], ['old', OT]]; for (const [who, tree] of order) run(who, tree, spot, k); }
const kinds = [...new Set(rows.map((r) => r.spot))]; let any = false;
for (const s of kinds) { const o = rows.filter((r) => r.spot === s && r.who === 'old'), n = rows.filter((r) => r.spot === s && r.who === 'new'); if (!o.length || !n.length) continue; any = true;
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };
  const pair = (k) => { const d = []; for (let i = 1; i <= ROUNDS; i++) { const a = o.find((r) => r.round === i), b = n.find((r) => r.round === i); if (a && b) d.push(+(b[k] - a[k]).toFixed(1)); } return d; };
  console.log('ABFPS SUMMARY ' + s + ': fps old ' + o.map((r) => r.fps).join('/') + ' (median ' + med(o.map((r) => r.fps)) + ') new ' + n.map((r) => r.fps).join('/') + ' (median ' + med(n.map((r) => r.fps)) + '); paired fps new-old ' + pair('fps').join(', ')
    + ' | p95 old median ' + med(o.map((r) => r.p95)) + ' new median ' + med(n.map((r) => r.p95)) + ', paired ' + pair('p95').join(', ') + ' | worst old ' + o.map((r) => r.worst).join('/') + ' new ' + n.map((r) => r.worst).join('/') + ' | calls old median ' + med(o.map((r) => r.calls || 0)) + ' new ' + med(n.map((r) => r.calls || 0))); }
console.log(any ? 'PASS abfps measured ' + rows.length + ' runs (report only: the numbers above are the result)' : 'FAIL abfps: no paired measurement');
