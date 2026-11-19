// Lag fix (owner Nov 19 06:43): at night inside a house only what can be seen is drawn. Inside a house the world is framed so the house stands at the origin
// (src/world.js frame), its walls hide everything outside except what shows through its openings (the sim's breaches: doors, windows, gaps, hatches). Each frame
// every drawable piece of the street (world.g, except the sleeping machines) is tested: it is drawn if it touches the house itself, or if a line from your eye through
// one of the openings (a rectangle CONFIG.openingHalf + pad wide, a storey high + pad) can reach it. Pieces that cannot be seen are moved to layer 1, which the camera
// does not draw but the sun's shadow cameras still do, so no shadow changes. The far plane already follows the fog (main.js fitFar). Day, the base and the street are
// untouched (everything goes back to layer 0 when the night ends). Gloom, devices, the boss and the room are not in world.g and are never touched. All tiers.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createNightCull() {
  let root = null, items = null, key = '', on = false;
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
      out.push({ o, c: bs.center.clone().applyMatrix4(o.matrixWorld), r: bs.radius * k, lo, hid: false }); });
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
      const g = world.g, k2 = g.uuid + g.position.x.toFixed(2) + g.position.z.toFixed(2) + g.rotation.y.toFixed(3) + ':' + g.children.length;
      if (g !== root || k2 !== key) { restore(); root = g; key = k2; items = collect(g, dorm); stats.items = items.length; }
      // the sun's shadow camera keeps drawing what is hidden from you (so no shadow changes)
      if (!on) { on = true; g.traverse((l) => { if (l.isLight && l.shadow && l.shadow.camera) l.shadow.camera.layers.enable(L1); }); }
      let hidden = 0;
      for (const it of items) {
        const vis = seen(it.c, it.r, sim, cam.position, it.lo);
        if (vis === it.hid) { it.hid = !vis; it.o.layers.set(vis ? 0 : L1); } if (it.hid) hidden++;
      }
      stats.hidden = hidden; return true;
    },
    reset() { restore(); on = false; items = null; root = null; key = ''; } };
}
