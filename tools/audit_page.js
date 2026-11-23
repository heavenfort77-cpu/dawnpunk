// Performance audit (Nov 23, owner's list items 1-14): counts taken in the page at the moment it is called (tools/perfcheck.cjs AUDIT=1, combat spot).
// Report only, no gate. Counts do not depend on the GPU (SwiftShader gives the same numbers as the Mac runner); frame rates do.
// window.__auditStart() begins the timed part (sim and animation costs, shadow passes), window.__audit() returns everything as one object.
(() => {
  const T = { sim: 0, simN: 0, anim: 0, animN: 0, animOff: 0, frames: 0, shadowPasses: 0, on: false, wrapped: new WeakSet() };
  const camOf = () => window.__game.cam;
  const inView = (o, fr) => { if (!o.isMesh) return false; if (!o.frustumCulled) return true; const s = o.boundingSphere || (o.geometry && (o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere))); if (!s) return true; const w = s.clone().applyMatrix4(o.matrixWorld); return fr.intersectsSphere(w); };
  const nm = (o, m) => { const a = []; for (let q = o, k = 0; q && k < 4; q = q.parent, k++) if (q.name) { a.push(q.name); if (a.length === 2) break; } return (a.join(' < ') || (m && m.name) || o.type) + (m && m.name && !a.length ? '' : m && m.name ? ' {' + m.name + '}' : ''); };
  const shown = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  window.__auditStart = () => {
    const g = window.__game, s = g.sim, R = g.renderer; T.on = true;
    if (!T.wrapped.has(s)) { const st = s.step.bind(s); s.step = (dt) => { const t0 = performance.now(); try { return st(dt); } finally { if (T.on) { T.sim += performance.now() - t0; T.simN++; } } }; T.wrapped.add(s); }
    const sm = R.shadowMap; if (!T.wrapped.has(sm)) { const o = sm.render; sm.render = function (...a) { if (T.on && (sm.needsUpdate || sm.autoUpdate)) T.shadowPasses++; return o.apply(this, a); }; T.wrapped.add(sm); }
    const fr = () => { if (!T.on) return; T.frames++; requestAnimationFrame(fr); }; requestAnimationFrame(fr);
    // every Gloom machine's pose function: calls, cost, and calls for a machine not drawn this frame (night cull layer 1 or outside the view)
    for (const c of g.scene.children) { const a = c.userData && c.userData.anim; if (!a || T.wrapped.has(c)) continue; T.wrapped.add(c);
      c.userData.anim = function (...x) { const t0 = performance.now(); try { return a.apply(this, x); } finally { if (T.on && x[0] > 0) { T.anim += performance.now() - t0; T.animN++; if ((c.userData.cullL || 0) === 1) T.animOff++; } } }; }
  };
  window.__audit = () => {
    const g = window.__game, R = g.renderer, sc = g.scene, cam = camOf(), gl = R.getContext(), out = {};
    T.on = false;
    const fr = new g.T3.Frustum(); fr.setFromProjectionMatrix(new g.T3.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    // 6 the context
    out.context = { powerPreference: (gl.getContextAttributes() || {}).powerPreference, renderer: (() => { try { const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; } catch (e) { return '?'; } })() };
    // 3 programs
    out.programs = { live: R.info.programs.length, byType: {} }; for (const p of R.info.programs) { const k = (p.name || '?') + ''; out.programs.byType[k] = (out.programs.byType[k] || 0) + 1; }
    out.memory = { ...R.info.memory };
    // 1 textures: every texture on any material in the scene (shown or not)
    const tex = new Map(), mats = new Set(); sc.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { mats.add(m); for (const k in m) { const v = m[k]; if (v && v.isTexture) { const id = v.source ? v.source.uuid : v.uuid; if (!tex.has(id)) tex.set(id, v); } } if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (v && v.isTexture) { const id = v.source ? v.source.uuid : v.uuid; if (!tex.has(id)) tex.set(id, v); } } } });
    let bytes = 0, comp = 0, big = []; for (const t of tex.values()) { const im = t.image || (t.source && t.source.data) || {}; const w = im.width || (im.data && im.data.width) || 0, h = im.height || 0; if (t.isCompressedTexture) { comp++; continue; } if (t.isRenderTargetTexture || t.isDataTexture && w * h < 4096) continue; const b = w * h * 4 * (t.generateMipmaps !== false && t.minFilter !== 1006 && t.minFilter !== 1003 ? 1.333 : 1); bytes += b; const src = (im.currentSrc || im.src || ''); big.push([Math.round(b / 1048576 * 10) / 10, w + 'x' + h, t.name || (src.startsWith('data:') ? 'data:' + src.slice(5, 20) : src.split('/').pop()), t.isDataTexture ? 'data' : t.isCanvasTexture ? 'canvas' : 'image']); }
    big.sort((a, b) => b[0] - a[0]); out.textures = { count: tex.size, compressed: comp, uncompressedMB: Math.round(bytes / 1048576), top: big.slice(0, 12), byKind: big.reduce((a, x) => { a[x[3]] = (a[x[3]] || 0) + x[0]; return a; }, {}) };
    out.materials = { count: mats.size };
    // 2 / 5 Gloom machines: draws and triangles each, by kind and distance
    const gl0 = []; for (const c of sc.children) { if (!(c.userData && c.userData.kind && c.userData.anim)) continue; let d = 0, t = 0, dv = 0; const dist = Math.hypot(c.position.x - cam.position.x, c.position.z - cam.position.z);
      c.traverse((o) => { if (!o.isMesh || !shown(o) || !o.layers.test(cam.layers)) return; d++; const n = o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; t += o.isInstancedMesh ? n * o.count : n; if (inView(o, fr)) dv++; });
      gl0.push({ kind: c.userData.kind, dist: Math.round(dist * 10) / 10, draws: d, drawsInView: dv, tris: Math.round(t), culledL1: (c.userData.cullL || 0) === 1 }); }
    const byK = {}; for (const q of gl0) { const k = byK[q.kind] || (byK[q.kind] = { n: 0, draws: 0, tris: 0, trisNear: [], trisFar: [] }); k.n++; k.draws += q.draws; k.tris += q.tris; (q.dist < 8 ? k.trisNear : k.trisFar).push(q.tris); }
    for (const k in byK) { const v = byK[k]; v.drawsEach = +(v.draws / v.n).toFixed(1); v.trisEach = Math.round(v.tris / v.n); v.trisNear = v.trisNear.length ? Math.round(v.trisNear.reduce((a, b) => a + b, 0) / v.trisNear.length) : null; v.trisFar = v.trisFar.length ? Math.round(v.trisFar.reduce((a, b) => a + b, 0) / v.trisFar.length) : null; }
    out.gloom = { n: gl0.length, byKind: byK, lod: window.__lod ? { ...window.__lod } : null };
    // 4 frustumCulled = false on drawn meshes
    const nc = new Map(); sc.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && !o.frustumCulled && shown(o)) { const k = nm(o, o.material); nc.set(k, (nc.get(k) || 0) + 1); } });
    out.notCulled = { count: [...nc.values()].reduce((a, b) => a + b, 0), list: [...nc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20) };
    // 10 lights in the scene
    const L = {}; let lightsOn = 0, casting = []; sc.traverse((o) => { if (!o.isLight || !shown(o)) return; const k = o.type + (o.intensity > 0 ? '' : ' (0)'); L[k] = (L[k] || 0) + 1; if (o.intensity > 0 && !o.isAmbientLight && !o.isHemisphereLight) lightsOn++; if (o.castShadow) casting.push(o.type + ' ' + (o.name || '') + ' map ' + (o.shadow && o.shadow.mapSize.x)); });
    out.lights = { byType: L, realLit: lightsOn, casting, houseLamps: window.__houseLamps || null };
    // 9 shadow casters (shown meshes) and small ones
    let cast = 0, small = 0; const smallL = new Map(); sc.traverse((o) => { if (!o.isMesh || !o.castShadow || !shown(o)) return; cast++; const s = o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere); const sx = o.matrixWorld.getMaxScaleOnAxis(); if (!o.isInstancedMesh && s && s.radius * sx < 0.35) { small++; const k = nm(o, o.material); smallL.set(k, (smallL.get(k) || 0) + 1); } });
    out.shadows = { casters: cast, smallCasters: small, smallList: [...smallL.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10), passesPerSecond: T.frames ? +(T.shadowPasses / (T.frames / 60)).toFixed(2) : null, passes: T.shadowPasses, frames: T.frames, autoUpdate: R.shadowMap.autoUpdate };
    // 11 see-through things drawn (shown, on the camera's layers, in view)
    const tr = new Map(); let trN = 0, cut = 0; sc.traverse((o) => { if (!o.isMesh && !o.isSprite && !o.isPoints) return; if (!shown(o) || !o.layers.test(cam.layers)) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (!m) continue; if (m.alphaTest > 0) cut++; if (!m.transparent) continue; if (o.isMesh && !inView(o, fr)) continue; trN++; const k = nm(o, m) + ' ' + (o.geometry ? o.geometry.type : '') + ' ' + m.type + (m.map ? '+map' : '') + (m.color ? ' #' + m.color.getHexString() : '') + ' op ' + (+m.opacity).toFixed(2) + ' ud[' + Object.keys(o.userData).slice(0, 4).join(',') + '] [' + (m.blending === 2 ? 'add' : 'blend') + (m.depthWrite ? ', depth' : '') + ']'; tr.set(k, (tr.get(k) || 0) + 1); } });
    out.transparent = { drawnInView: trN, alphaTestMaterials: cut, top: [...tr.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15) };
    // 12 draw order
    out.order = { sortObjects: R.sortObjects };
    // 13 / 8 per-frame logic and posing
    out.cost = { frames: T.frames, simMsPerFrame: T.frames ? +(T.sim / T.frames).toFixed(3) : null, simCalls: T.simN, animMsPerFrame: T.frames ? +(T.anim / T.frames).toFixed(3) : null, animCallsPerFrame: T.frames ? +(T.animN / T.frames).toFixed(2) : null, animCallsHiddenPerFrame: T.frames ? +(T.animOff / T.frames).toFixed(2) : null, gloomAlive: g.sim ? g.sim.gloom.length : 0 };
    return out;
  };
})();
