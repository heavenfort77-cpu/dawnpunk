// Surface relief for every klad-textured thing (2026-11-14, realistic pass). klad paints the colour; tools/maketex.py works a relief map out of each texture's light and dark,
// and this lays it on any material that uses that texture, so cracks, joints, grain and rust catch the light instead of looking printed on.
import * as THREE from 'three';
import { TEX } from './texdata.js';
import { texLoad, texTrack, reliefAniso } from './quality.js';
import { CONFIG } from './config.js';
const base = {}, byRepeat = {}, loader = new THREE.TextureLoader();
function reliefFor(map) { const name = map.userData.tex; if (!name || !TEX[name + '_n']) return null;
  if (!base[name]) { const t = texLoad(name + '_n'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = reliefAniso(); t.userData.shared = true; base[name] = t; }
  const key = name + '|' + map.repeat.x.toFixed(3) + ',' + map.repeat.y.toFixed(3) + '|' + map.offset.x.toFixed(3) + ',' + map.offset.y.toFixed(3) + '|' + map.rotation.toFixed(3);
  if (!byRepeat[key]) { const t = base[name].clone(); t.repeat.copy(map.repeat); t.offset.copy(map.offset); t.rotation = map.rotation; t.center.copy(map.center); t.userData.shared = true; t.needsUpdate = true; texTrack(t, name + '_n'); byRepeat[key] = t; } return byRepeat[key]; }
export function applyRelief(root) { const R = CONFIG.render; if (!R.relief || !root) return 0; let n = 0;
  root.traverse((o) => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (!m || m.userData.relief || !m.map || m.isMeshBasicMaterial || m.transparent || m.alphaTest > 0) continue; const t = reliefFor(m.map); m.userData.relief = true; if (!t) continue; m.normalMap = t; m.normalScale = new THREE.Vector2(R.reliefPower, R.reliefPower); m.needsUpdate = true; n++; } }); return n; }
