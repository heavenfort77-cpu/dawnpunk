// Oko's work at the bench (owner Nov 17: "a real working loop with arms and hands": pick up a part, turn it, set it down, tap with a small tool).
// Layered ON TOP of the people motion (src/people.js is not changed): after the person's own drive() has posed the body for this frame, each arm bone gets an extra turn
// about the person's own axes (x = swing forward / back, z = roll), read from a keyframe loop in CONFIG.workshop.oko.loop and eased with smoothstep between keys, so the
// joints never snap. A weight eases the whole layer in and out (CONFIG.workshop.oko.ease seconds) when she starts or stops working (you come close to talk).
// Speeds: the loop's largest key change over its shortest key time stays far under tools/animcheck.cjs's 250 deg/s for a standing person.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const sstep = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
const ARM = ['upperarm_r', 'lowerarm_r', 'hand_r', 'upperarm_l', 'lowerarm_l', 'hand_l', 'spine_02'];
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qm = new THREE.Quaternion(), e = new THREE.Euler();

// the pose of the loop at time t: [uaR, laR, hxR, hzR, uaL, laL, hxL, lean] (rad), plus the tool taps on the left hand
export function loopPose(t) {
  const L = CONFIG.workshop.oko.loop, K = L.keys, T = K[K.length - 1][0], u = ((t % T) + T) % T; let i = 0; while (i < K.length - 2 && K[i + 1][0] <= u) i++;
  const a = K[i], b = K[i + 1], k = sstep((u - a[0]) / Math.max(1e-3, b[0] - a[0])), out = []; for (let j = 1; j < a.length; j++) out.push(a[j] + (b[j] - a[j]) * k);
  const [hz, amp, t0, t1] = L.tap; if (u > t0 && u < t1) { const fade = sstep((u - t0) / 0.4) * sstep((t1 - u) / 0.4); out[6] += Math.sin((u - t0) * 2 * Math.PI * hz) * amp * fade; }
  return out;
}

// state per person: { w (weight 0..1), t (loop time), bones }
export function okoWork(ch, st, dt, working) {
  if (!ch || !ch.ready || !ch.root) return;
  const E = CONFIG.workshop.oko.ease; st.w = Math.max(0, Math.min(1, (st.w || 0) + (working ? dt : -dt) / E)); st.t = (st.t || 0) + dt; const w = sstep(st.w);
  if (!st.bones) { st.bones = {}; for (const n of ARM) st.bones[n] = ch.root.getObjectByName(n) || null; }
  if (w <= 0) { if (st.props) { if (st.props.part) st.props.part.visible = false; if (st.props.tool) st.props.tool.visible = false; } return; }
  // a copper part in the right hand while she holds it, a small tool in the left while she taps (children of the hand bones)
  // (kept on the character, which outlives each base rebuild, so the props are made once)
  if (!st.props && ch.okoProps) st.props = ch.okoProps;
  if (!st.props) { st.props = ch.okoProps = {}; const L = CONFIG.workshop.oko.loop, cop = new THREE.MeshStandardMaterial({ color: 0xd8905a, metalness: 0.7, roughness: 0.35 }), dark = new THREE.MeshStandardMaterial({ color: 0x3a3a38, roughness: 0.5 }), red = new THREE.MeshStandardMaterial({ color: 0xb8342c, roughness: 0.6 });
    if (st.bones.hand_r) { const g = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 18), cop); g.add(ring); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10), cop); hub.rotation.x = Math.PI / 2; g.add(hub); g.position.set(0, 0.085, 0.02); st.bones.hand_r.add(g); st.props.part = g; }
    if (st.bones.hand_l) { const g = new THREE.Group(); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.08, 8), red); g.add(h); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.09, 6), dark); sh.position.y = 0.085; g.add(sh); g.position.set(0, 0.08, 0.02); st.bones.hand_l.add(g); st.props.tool = g; }
    st.props.L = L; }
  { const u = st.t % st.props.L.keys[st.props.L.keys.length - 1][0], inW = (w2) => w > 0.9 && u > w2[0] && u < w2[1]; if (st.props.part) st.props.part.visible = inW(st.props.L.part); if (st.props.tool) st.props.tool.visible = inW(st.props.L.tool); }
  const p = loopPose(st.t), turns = { upperarm_r: [p[0], 0], lowerarm_r: [p[1], 0], hand_r: [p[2], p[3]], upperarm_l: [p[4], 0], lowerarm_l: [p[5], 0], hand_l: [p[6], 0], spine_02: [p[7], 0] };
  ch.root.updateMatrixWorld(true); ch.root.getWorldQuaternion(qm);
  // parents first (spine, upper arm, forearm, hand), so each child turns about the person's axes as they now stand
  for (const n of ['spine_02', 'upperarm_r', 'upperarm_l', 'lowerarm_r', 'lowerarm_l', 'hand_r', 'hand_l']) { const b = st.bones[n]; if (!b || !b.parent) continue; const [x, z] = turns[n];
    e.set(x * w, 0, z * w, 'YXZ'); qa.setFromEuler(e); b.parent.getWorldQuaternion(qb); const conj = qb.clone().invert().multiply(qm).multiply(qa).multiply(qm.clone().invert()).multiply(qb); b.quaternion.premultiply(conj); b.updateMatrixWorld(true); }
}
