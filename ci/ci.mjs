// CI helper for .github/workflows/checks.yml, driven by ci/checks.json.
// node ci/ci.mjs plan <all|logic|desktop|phone> [only]   (only: comma list of check names, overrides the group) prints GitHub step outputs: checks (matrix entries), logic (true/false), names
// node ci/ci.mjs run <name>                        runs one check with its args and timeout; log in ci-logs/<name>.log, result in ci-logs/<name>.json
// node ci/ci.mjs summary [names json]              prints one table of every result in ci-logs (and writes ci-logs/summary.txt)
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'ci/checks.json'), 'utf8')).checks;
const LOGS = path.join(ROOT, 'ci-logs');
const [cmd, arg] = process.argv.slice(2);

if (cmd === 'plan') {
  const g = arg || 'all';
  if (!['all', 'logic', 'desktop', 'phone'].includes(g)) { console.error('unknown group ' + g); process.exit(1); }
  const only = (process.argv[4] || '').split(',').map((x) => x.trim()).filter(Boolean);
  const bad = only.filter((n) => !LIST.some((c) => c.name === n));
  if (bad.length) { console.error('no check named ' + bad.join(', ') + ' in ci/checks.json'); process.exit(1); }
  const pick = only.length ? LIST.filter((c) => only.includes(c.name)) : LIST.filter((c) => g === 'all' || c.tier === g);
  // job timeout = the check's own limit plus setup time (artifact, npm, browser install)
  const matrix = pick.filter((c) => c.job !== 'logic').map((c) => ({ name: c.name, tier: c.tier, minutes: c.timeout + 20 }));
  console.log('checks=' + JSON.stringify(matrix));
  console.log('logic=' + (pick.some((c) => c.job === 'logic') ? 'true' : 'false'));
  console.log('names=' + JSON.stringify(pick.map((c) => c.name)));
} else if (cmd === 'run') {
  const c = LIST.find((x) => x.name === arg);
  if (!c) { console.error('no check named ' + arg + ' in ci/checks.json'); process.exit(1); }
  const out = path.join(ROOT, 'ci-out', c.name);
  fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(LOGS, { recursive: true });
  const args = (c.args || []).map((a) => a.split('{dist}').join(path.join(ROOT, 'dist')).split('{out}').join(out));
  const passRe = new RegExp(c.pass || '^\\s*PASS\\b'), failRe = new RegExp(c.fail || '^\\s*FAIL\\b');
  const logFile = path.join(LOGS, c.name + '.log'), log = fs.createWriteStream(logFile);
  const t0 = Date.now();
  console.log('== ' + c.name + ': node ' + c.script + ' ' + args.join(' ') + '  (limit ' + c.timeout + ' min)');
  log.write('$ node ' + c.script + ' ' + args.join(' ') + '\n');
  const child = spawn('node', [c.script, ...args], { cwd: ROOT, env: { ...process.env, ...(c.env || {}) }, detached: true });
  let buf = '', timedOut = false; const lines = [];
  const take = (d) => { process.stdout.write(d); log.write(d); buf += d; const parts = buf.split('\n'); buf = parts.pop(); lines.push(...parts); };
  child.stdout.on('data', take); child.stderr.on('data', take);
  // on timeout the whole process group goes (node and its browser)
  const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid, 'SIGKILL'); } catch (e) { child.kill('SIGKILL'); } }, c.timeout * 60000);
  child.on('close', (code, sig) => {
    clearTimeout(timer); if (buf) lines.push(buf);
    const pass = lines.filter((l) => passRe.test(l)).length, failing = lines.filter((l) => failRe.test(l));
    const res = { name: c.name, tier: c.tier, quality: c.quality, pass, fail: failing.length, failing, exit: code, signal: sig, timedOut, minutes: +((Date.now() - t0) / 60000).toFixed(1) };
    const problems = [];
    if (timedOut) problems.push('TIMED OUT after ' + c.timeout + ' min');
    else if (code !== 0) problems.push('exit code ' + code + (sig ? ' (' + sig + ')' : ''));
    if (!pass && !failing.length) problems.push('no PASS/FAIL line printed');
    res.problems = problems;
    // the last lines of output, for a check that died without a FAIL line
    if (problems.length) res.tail = lines.filter((l) => l.trim()).slice(-6);
    fs.writeFileSync(path.join(LOGS, c.name + '.json'), JSON.stringify(res, null, 1));
    log.end('\n== ' + JSON.stringify({ pass, fail: failing.length, exit: code, timedOut, minutes: res.minutes }) + '\n');
    console.log('\n== ' + c.name + ': ' + pass + ' PASS, ' + failing.length + ' FAIL' + (problems.length ? ', ' + problems.join(', ') : '') + ', ' + res.minutes + ' min');
    process.exit(failing.length || problems.length ? 1 : 0);
  });
} else if (cmd === 'summary') {
  const want = arg ? JSON.parse(arg) : null;
  const res = fs.existsSync(LOGS) ? fs.readdirSync(LOGS).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(LOGS, f), 'utf8'))) : [];
  const order = LIST.map((c) => c.name), byName = new Map(res.map((r) => [r.name, r]));
  const names = (want || order.filter((n) => byName.has(n))).slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const rows = names.map((n) => {
    const r = byName.get(n), c = LIST.find((x) => x.name === n) || {};
    if (!r) return [n, (c.tier || '?') + '/' + (c.quality || '?'), '-', '-', 'NO RESULT', '-'];
    const ok = !r.fail && !(r.problems || []).length;
    return [n, r.tier + '/' + r.quality, String(r.pass), String(r.fail), ok ? 'ok' : (r.problems && r.problems.length ? r.problems.join('; ') : 'FAIL'), String(r.minutes)];
  });
  const head = ['check', 'tier', 'PASS', 'FAIL', 'result', 'min'];
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const fmt = (r) => r.map((v, i) => v.padEnd(w[i])).join('  ');
  const txt = [fmt(head), w.map((x) => '-'.repeat(x)).join('  '), ...rows.map(fmt)];
  const bad = names.filter((n) => { const r = byName.get(n); return !r || r.fail || (r.problems || []).length; });
  txt.push('', bad.length ? bad.length + ' of ' + names.length + ' checks not clean' : 'ALL ' + names.length + ' CHECKS CLEAN');
  for (const n of bad) {
    const r = byName.get(n); txt.push('', '[' + n + ']');
    if (!r) { txt.push('  no result (the job did not get to run the check; see its job log)'); continue; }
    for (const l of r.failing) txt.push('  ' + l.trim().slice(0, 400));
    for (const p of r.problems || []) txt.push('  ' + p);
    if (r.tail && !r.failing.length) for (const l of r.tail) txt.push('  | ' + l.slice(0, 300));
  }
  const s = txt.join('\n');
  // the markers let tools/ci_run.sh cut the table out of the job log (artifact downloads are blocked from the dev machine)
  console.log('=== SUMMARY ===\n' + s + '\n=== END SUMMARY ==='); fs.mkdirSync(LOGS, { recursive: true }); fs.writeFileSync(path.join(LOGS, 'summary.txt'), s + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '```\n' + s + '\n```\n');
} else {
  console.error('usage: node ci/ci.mjs plan <group> | run <name> | summary [names json]'); process.exit(1);
}
