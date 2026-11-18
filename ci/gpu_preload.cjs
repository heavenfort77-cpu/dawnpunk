// Loaded with NODE_OPTIONS=--require on GitHub macOS runners (workflow checksmac.yml): every check's chromium.launch() gets the real Apple GPU
// (ANGLE on Metal) in place of the software GPU (SwiftShader) the checks ask for on Linux. No check file changes.
const Module = require('module');
const orig = Module.prototype.require;
const SOFT = /^--(use-gl=swiftshader|enable-unsafe-swiftshader|use-angle=swiftshader)/;
const GPU = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
let done = false;
Module.prototype.require = function (id) {
  const m = orig.apply(this, arguments);
  if (!done && id === 'playwright' && m && m.chromium && m.chromium.launch) {
    done = true;
    const launch = m.chromium.launch.bind(m.chromium);
    m.chromium.launch = (opts = {}) => launch({ ...opts, args: (opts.args || []).filter((a) => !SOFT.test(a)).concat(GPU) });
  }
  return m;
};
