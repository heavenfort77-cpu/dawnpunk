// DESKTOP-ONLY falling pieces (owner, Nov 17: "desktop gets everything, phones are dialled down"). cannon-es 0.20.0 (MIT licence, (c) 2015 cannon.js Authors,
// from npm, bundled by esbuild into its OWN file dist/physics.js). The game bundle never imports this file: src/bosshi.js loads dist/physics.js with a script tag on the
// desktop tier only, so phones never download or run it. It knows nothing of three.js or the game rules: boxes on a ground plane, nothing else
// (no walls, no player, no Gloom: the pieces can never change the game).
import * as CANNON from 'cannon-es';

// o: { g: gravity (m/s2, negative), friction, bounce (restitution), sleep: the speed under which a body falls asleep }
function createWorld(o) {
  const w = new CANNON.World({ gravity: new CANNON.Vec3(0, o.g, 0) });
  w.broadphase = new CANNON.SAPBroadphase(w);
  w.allowSleep = true;
  const mat = new CANNON.Material('debris');
  w.addContactMaterial(new CANNON.ContactMaterial(mat, mat, { friction: o.friction, restitution: o.bounce }));
  const ground = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Plane() });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  ground.position.y = o.groundY || 0;
  w.addBody(ground);
  const bodies = new Map();
  let next = 1;
  return {
    // a box piece: half sizes, position [x, y, z], quaternion [x, y, z, w], velocity, spin, mass; returns its id
    add(hx, hy, hz, p, q, v, av, mass) {
      const b = new CANNON.Body({ mass: mass || 1, material: mat, shape: new CANNON.Box(new CANNON.Vec3(Math.max(0.02, hx), Math.max(0.02, hy), Math.max(0.02, hz))), linearDamping: 0.05, angularDamping: 0.12 });
      b.sleepSpeedLimit = o.sleep || 0.15; b.sleepTimeLimit = 0.4;
      b.position.set(p[0], p[1], p[2]); b.quaternion.set(q[0], q[1], q[2], q[3]);
      if (v) b.velocity.set(v[0], v[1], v[2]);
      if (av) b.angularVelocity.set(av[0], av[1], av[2]);
      w.addBody(b); const id = next++; bodies.set(id, b); return id;
    },
    step(dt) { w.step(1 / 60, dt, 4); },
    // where a piece is: { p: [x, y, z], q: [x, y, z, w], asleep }
    get(id) { const b = bodies.get(id); if (!b) return null; return { p: [b.position.x, b.position.y, b.position.z], q: [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w], asleep: b.sleepState === CANNON.Body.SLEEPING }; },
    remove(id) { const b = bodies.get(id); if (b) { w.removeBody(b); bodies.delete(id); } },
    count() { return bodies.size; },
    clear() { for (const b of bodies.values()) w.removeBody(b); bodies.clear(); },
  };
}
window.__bossPhysics = { createWorld, version: '0.20.0' };
