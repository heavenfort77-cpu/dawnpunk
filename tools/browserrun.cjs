// Runs one check from ci/checks.json in another browser engine (Nov 20, after the Retina map fault: every check ran in Chromium only).
// The checks ask playwright for `chromium`; here that name gives the engine named in BROWSER (webkit = Safari's engine, firefox), launched without Chromium's
// own switches. Usage: BROWSER=webkit node tools/browserrun.cjs <check name> [dist folder] [out folder]. The check's own PASS / FAIL lines are its output.
const path = require('path'), fs = require('fs');
const name = process.argv[2], dist = path.resolve(process.argv[3] || 'dist'), out = path.resolve(process.argv[4] || 'ci-out');
// a name ending in .cjs is a script under tools/ that is not in the list (a probe such as enginecheck), run with no arguments
const C = /\.cjs$/.test(name) ? { name, script: 'tools/' + name, args: [] } : JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ci', 'checks.json'), 'utf8')).checks.find((c) => c.name === name);
if (!C) { console.log('FAIL browserrun: no check named ' + name + ' in ci/checks.json'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const eng = process.env.BROWSER || 'chromium', pw = require('playwright');
if (!pw[eng]) { console.log('FAIL browserrun: playwright has no engine ' + eng); process.exit(1); }
if (eng !== 'chromium') { const E = pw[eng], launch = E.launch.bind(E); pw.chromium = new Proxy(E, { get: (t, k) => (k === 'launch' ? (o = {}) => launch({ ...o, args: [] }) : Reflect.get(t, k)) }); }
const args = C.args.map((a) => a.split('{dist}').join(dist).split('{out}').join(out));
process.argv = [process.argv[0], path.resolve(C.script), ...args];
console.log('browserrun: ' + name + ' in ' + eng + ' (' + C.script + ' ' + args.join(' ') + ')');
require(path.resolve(C.script));
