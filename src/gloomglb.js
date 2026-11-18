// Desktop Gloom machines modelled and textured in Blender (tools/gloomglb/: walker_model.py, bake_data.py, paint_tex.py, export_glb.py, pack_glb.py).
// One GLB per kind in art/models_hi (the single-file build carries it inside). Loaded once, on the desktop tier only, when CONFIG.quality.high.gloom.models[kind] is on.
// Until a model has arrived (or if it fails) the desktop builder in src/gloomhi.js draws that kind itself, so nothing waits on it.
// Each machine is a copy of the loaded scene: geometry and textures are shared, the painted material is copied per machine for its own paint shade.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { QUALITY } from './quality.js';
import { lodPrepare, lodCopy } from './lod.js';
import { mergeGlb, rebindMerged } from './glbmerge.js';

const FILES = { walker: 'models/gloom_walker_hi.glb', lurcher: 'models/gloom_lurcher_hi.glb', ticks: 'models/gloom_ticks_hi.glb', hauler: 'models/gloom_hauler_hi.glb', stilt: 'models/gloom_stilt_hi.glb', lantern: 'models/gloom_lantern_hi.glb', warden: 'models/gloom_warden_hi.glb' };
const TPL = {};
// ?gloomglb=walker,lurcher (or =all) turns those models on for this page only (samples and checks before the owner approves a kind; the shipped switches stay as they are)
try { const q = new URLSearchParams(location.search).get('gloomglb'); const G = CONFIG.quality.high.gloom;
  if (q && G && G.models) for (const k of (q === 'all' ? Object.keys(FILES) : q.split(','))) if (FILES[k]) G.models[k] = true; } catch (e) { /* no location */ }
// loading state per kind ('loading', 'ready', 'failed'); the checks read it as window.__gloomGlb
export const glbState = {};
// glbHooks.ready(kind, scene): main.js uploads the model's maps and builds its shader while it loads (LAG FIX Nov 19), not when the first one of that kind walks in
export const glbHooks = { ready: null };
try { window.__gloomGlb = glbState; } catch (e) { /* no window */ }
const fxOff = () => { try { return new URLSearchParams(location.search).get('fx') === '0'; } catch (e) { return false; } };
const on = (kind) => { const G = CONFIG.quality.high.gloom; return QUALITY === 'high' && !fxOff() && !!(G && G.models && G.models[kind]) && !!FILES[kind]; };

function load(kind) {
  const url = FILES[kind]; glbState[kind] = 'loading';
  // a page opened from a folder (file://) cannot fetch the file beside it: the desktop builder stays (the single-file build has the model inside as a data address)
  if (!url.startsWith('data:') && location.protocol === 'file:') { glbState[kind] = 'failed'; return; }
  const fail = (e) => { glbState[kind] = 'failed'; console.warn('gloom model ' + kind + ' not loaded', e); };
  fetch(url).then((r) => { if (!r.ok) throw new Error('no file'); return r.arrayBuffer(); }).then((buf) => new GLTFLoader().parse(buf, '', (gltf) => {
    const sc = gltf.scene; sc.traverse((o) => { o.userData.keep = true; if (!o.isMesh) return; o.geometry.userData.shared = true; const m = o.material; m.userData.shared = true; m.userData.relief = true; m.userData.pbr = true;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (m[k]) { m[k].userData.shared = true; m[k].anisotropy = 4; } });
    // LAG FIX Nov 19: the parts drawn as one skinned mesh per material (src/glbmerge.js), before the far copies are made (the merged mesh gets one too)
    mergeGlb(sc); TPL[kind] = sc; glbState[kind] = 'ready'; lodPrepare(sc, 'gloom', false); if (glbHooks.ready) try { glbHooks.ready(kind, sc); } catch (e) { /* warm-up only */ } }, fail)).catch(fail);
}
// LAG FIX Nov 19 (lag report finding 9): no model is fetched at page start any more. main.js asks for the kinds a run can meet when the run starts (its day on the street
// comes first), and for the opening film's kinds on a first visit. The builder stands in for a kind that has not arrived, as before.
export function gloomPreload(kinds) { for (const k of kinds || Object.keys(FILES)) if (on(k) && !glbState[k]) load(k); }
// a page opened with ?gloomglb=<kinds> (samples and checks) loads those kinds at once, as every kind did before
try { const q = new URLSearchParams(location.search).get('gloomglb'); if (q) gloomPreload(q === 'all' ? null : q.split(',')); } catch (e) { /* no location */ }

// the loaded model for this kind, or null (not wanted, not here yet, or failed)
export function glbModel(kind) { return on(kind) && glbState[kind] === 'ready' ? TPL[kind] : null; }

// A copy of the model for one machine. tint: the machine's own paint shade as a colour the painted parts are multiplied by
// (the R channel of the metal-rough picture is a paint mask, so bare steel, rust, grime and rubber keep their colour).
export function glbCopy(kind, tint) {
  const sc = TPL[kind].clone(true), mats = new Map(), u = { value: tint.clone() }; rebindMerged(TPL[kind], sc);
  sc.traverse((o) => { if (!o.isMesh) return; const m0 = o.material; if (!m0.metalnessMap) return;
    if (!mats.has(m0)) { const m = m0.clone(); m.userData = { pbr: true, relief: true, tint: u }; m.onBeforeCompile = (s) => { s.uniforms.uTint = u;
        s.fragmentShader = 'uniform vec3 uTint;\n' + s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_METALNESSMAP\n\tdiffuseColor.rgb *= mix( vec3( 1.0 ), uTint, texture2D( metalnessMap, vMetalnessMapUv ).r );\n#endif'); };
      m.customProgramCacheKey = () => 'gloomGlbTint'; mats.set(m0, m); }
    o.material = mats.get(m0); });
  // LAG FIX Nov 19: its meshes draw the reduced copy past CONFIG.lag.lod.kinds.gloom.near metres (src/lod.js)
  lodCopy(sc, 'gloom');
  return sc;
}
