// Lag fix (owner Nov 19 06:43): at night inside a house only what can be seen is drawn. Inside a house the world is framed so the house stands at the origin
// (src/world.js frame), its walls hide everything outside except what shows through its openings (the sim's breaches: doors, windows, gaps, hatches). Each frame
// every drawable piece of the street (world.g, except the sleeping machines) is tested: it is drawn if it touches the house itself, or if a line from your eye through
// one of the openings (a rectangle CONFIG.openingHalf + pad wide, a storey high + pad) can reach it. Pieces that cannot be seen are moved to layer 1, which the camera
// does not draw but the sun's shadow cameras still do, so no shadow changes. The far plane already follows the fog (main.js fitFar). Day, the base and the street are
// untouched (everything goes back to layer 0 when the night ends). Gloom, devices, the boss and the room are not in world.g and are never touched. All tiers.
// OWNER DECISION Nov 19 09:20 (option A): at night the street scenery (grass, tufts, hedge, tree and wood cells) wholly farther than CONFIG.lag.nightCull.sceneryFar m
// from the house's walls is not drawn either (its shadows stay: hidden pieces are still in the sun's shadow pass).
import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createNightCull() {
  let root = null, items = null, on = false; const KY = { x: 0, z: 0, r: 0, n: -1, e: null };
  const L1 = 1, I = new THREE.Vector3(), BX = new THREE.Box3();
  const stats = { items: 0, hidden: 0 };
  try { window.__nightCull = stats; } catch (e) { /* no window */ }
  // every drawable leaf under world.g with its sphere in world space (the world stands still at night; rebuilt if it is moved)
  function collect(g, skip) {
    const out = []; g.updateMatrixWorld(true);
    g.traverse((o) => { if (skip && (o === skip)) return; for (let p = o; p && p !== g; p = p.parent) if (p === skip) return;
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.geometry) return; let bs = null;
      if (o.isInstancedMesh) { if (!o.boundingSphere) o.computeBoundingSphere(); bs = o.boundingSphere; } else { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); bs = o.geometry.boundingSphere; }
      if (!bs || !isFinite(bs.radius)) return; const e = o.matrixWorld.elements, k = Math.sqrt(Math.max(e[0] * e[0] + e[1] * e[1] + e[2] * e[2], e[4] * e[4] + e[5] * e[5] + e[6] * e[6], e[8] * e[8] + e[9] * e[9] + e[10] * e[10]));
      // lo: the lowest point of the piece (m), so a piece wholly above the top floor's ceiling (the roof of the house you are in) is not taken as part of the room
      let lo = -Infinity; try { if (o.isInstancedMesh) { if (!o.boundingBox) o.computeBoundingBox(); BX.copy(o.boundingBox); } else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); BX.copy(o.geometry.boundingBox); } lo = BX.applyMatrix4(o.matrixWorld).min.y; } catch (e) { lo = -Infinity; }
      // sc: street scenery (grass, tufts, hedge, tree and wood cells: scenehi's scenery / noAO pieces, the street's tuft and grass cards), for the night distance cut
      let sc = false; for (let p = o; p && p !== g; p = p.parent) if (p.userData.scenery || p.userData.noAO) { sc = true; break; }
      const mt = Array.isArray(o.material) ? o.material[0] : o.material, tx = mt && mt.map && mt.map.userData ? mt.map.userData.tex : ''; if (tx === 'tuft' || tx === 'grass') sc = true;
      out.push({ o, c: bs.center.clone().applyMatrix4(o.matrixWorld), r: bs.radius * k, lo, sc, hid: false }); });
    return out;
  }
  const restore = () => { if (items) for (const it of items) if (it.hid) { it.o.layers.set(0); it.hid = false; } stats.hidden = 0; };
  // can a sphere (centre c in the house's frame, radius r) be seen from the eye E? Inside the house (or its pad) always; outside only through an opening
  function seen(c, r, sim, E, lo) {
    const C = CONFIG.lag.nightCull, FH = CONFIG.floorH, H = sim.H + C.housePad, top = sim.L * FH + C.roof, hw = CONFIG.openingHalf + C.pad, hh = FH / 2 + C.pad, B = sim.breaches;
    if (Math.abs(c.x) - r < H && Math.abs(c.z) - r < H && c.y - r < top && !(C.roofCull && lo >= sim.L * FH - C.roofCull)) return true;
    for (let i = 0; i < B.length; i++) { const b = B[i], ox = b.x, oy = (b.floor || 0) * FH + FH / 2, oz = b.z, nx = b.nx, nz = b.nz;
      const de = (E.x - ox) * nx + (E.z - oz) * nz, dc = (c.x - ox) * nx + (c.z - oz) * nz; if (dc > r) continue;
      if (de < C.doorway) return true;
      let slack = r; if (dc >= 0) I.set(c.x - dc * nx, c.y, c.z - dc * nz); else { const t = de / (de - dc); I.set(E.x + (c.x - E.x) * t, E.y + (c.y - E.y) * t, E.z + (c.z - E.z) * t); slack = r * t; }
      const along = (I.x - ox) * -nz + (I.z - oz) * nx; if (Math.abs(along) <= hw + slack && Math.abs(I.y - oy) <= hh + slack) return true; }
    return false;
  }
  const P = new THREE.Vector3();
  return { stats,
    // LAG FIX Nov 19 (owner 07:10, night combat): a Gloom machine at (x, y, z) with radius r: false when it stands outside the house where no opening shows it
    // (main.js then neither draws nor animates it). Always true by day, outside a night in a house, or with the switch off.
    sees(x, y, z, r, sim, cam) { const C = CONFIG.lag.nightCull; if (!on || !C || !C.gloom || !sim || sim.phase !== 'night') return true; P.set(x, y, z); return seen(P, r, sim, cam.position); },
    // world: the built world (or null), sim: the house's sim, cam, dorm: the sleeping machines' group (left alone)
    tick(world, sim, cam, dorm) {
      const C = CONFIG.lag.nightCull, want = !!(C && C.on && world && sim && sim.phase === 'night' && !sim.done);
      if (!want) { if (on) { restore(); on = false; } return false; }
      // (LAG FIX Nov 19, owner 10:35) the world's place compared as numbers, not a string built every frame; the pieces are tested again only when the eye has moved
      // more than CONFIG.lag.nightCull.eyeMove m (the house and its openings do not move)
      const g = world.g;
      if (g !== root || g.position.x !== KY.x || g.position.z !== KY.z || g.rotation.y !== KY.r || g.children.length !== KY.n) { restore(); root = g; KY.x = g.position.x; KY.z = g.position.z; KY.r = g.rotation.y; KY.n = g.children.length; items = collect(g, dorm); stats.items = items.length; KY.e = null; }
      if (KY.e && on && cam.position.distanceToSquared(KY.e) < C.eyeMove * C.eyeMove) return true; (KY.e || (KY.e = new THREE.Vector3())).copy(cam.position);
      // the sun's shadow camera keeps drawing what is hidden from you (so no shadow changes)
      if (!on) { on = true; g.traverse((l) => { if (l.isLight && l.shadow && l.shadow.camera) l.shadow.camera.layers.enable(L1); }); }
      let hidden = 0;
      for (const it of items) {
        const far = Math.hypot(it.c.x, it.c.z) - it.r - sim.H, vis = !(it.sc && far > C.sceneryFar) && !(C.streetFar && far > C.streetFar) && seen(it.c, it.r, sim, cam.position, it.lo);
        if (vis === it.hid) { it.hid = !vis; it.o.layers.set(vis ? 0 : L1); } if (it.hid) hidden++;
      }
      stats.hidden = hidden; return true;
    },
    reset() { restore(); on = false; items = null; root = null; KY.n = -1; KY.e = null; },
    // test only: test every piece again on the next frame (after a CONFIG.lag.nightCull distance is changed while playing)
    retest() { KY.e = null; } };
}
