// Offline art for the HUD2 interface (2026-11-16): bundled by tools/hud2art.cjs and run once in a headless page.
// 1. a small picture of each device (the game's own bloom-tech builders, desktop tier) on a clear background -> src/deviceicons.js
// 2. the seven Gloom machines, dormant, as dark shapes on a clear background, with their screens lit "POWER SAVER" / "WAKE AT DUSK"
//    and a red standby light -> src/titleart.js. The page draws them once; the game only shows the finished pictures.
import * as THREE from 'three';
import { CONFIG } from '../src/config.js';
import * as BT from '../src/bloomtech.js';
import * as PR from '../src/props.js';
import * as GK from '../src/gloomkit.js';

const A = CONFIG.hud2.art;
function lights(scene, k) { scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3428, 1.5 * k)); const d = new THREE.DirectionalLight(0xfff2dc, 2.2 * k); d.position.set(-2, 4, -3); scene.add(d); const r = new THREE.DirectionalLight(0xbfd8ff, 0.8 * k); r.position.set(3, 2, 3); scene.add(r); }
function fit(cam, o, dir) { const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()), r = Math.max(s.x, s.y, s.z) * 0.5 * A.iconPad;
  const d = r / Math.sin((cam.fov * Math.PI) / 360); cam.position.copy(c).add(dir.clone().normalize().multiplyScalar(d)); cam.lookAt(c); cam.near = d * 0.05; cam.far = d * 4; cam.updateProjectionMatrix(); }
function flask() { const g = new THREE.Group(); BT.lathe([[0.0, 0.0], [0.16, 0.02], [0.2, 0.12], [0.19, 0.26], [0.08, 0.36], [0.06, 0.5], [0.08, 0.53]], BT.BM.ceramic, g, 16); const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), BT.BM.glow(0xffb050)); glow.position.y = 0.16; g.add(glow); BT.stem([[0, 0.53, 0], [0.04, 0.62, 0.02], [0.1, 0.66, 0]], 0.012, BT.BM.copper, g); return g; }

export async function icons() {
  const S = A.iconPx, r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(S, S); r.setClearColor(0x000000, 0); r.outputColorSpace = THREE.SRGBColorSpace;
  const out = {}, kinds = [...Object.keys(CONFIG.devices), 'food'];
  // build every device first and give the packed textures time to load (an unloaded picture draws black)
  const built = kinds.map((k) => { const o = k === 'food' ? BT.crateV2('food') : k === 'flask' ? flask() : (BT.device(k, CONFIG) || PR.deviceMesh(k, CONFIG)); if (o.userData.tick) o.userData.tick(2, null); o.traverse((q) => { if (q.isSprite) q.visible = false; }); return o; });
  await new Promise((q) => setTimeout(q, 2500));
  for (const k of kinds) {
    const scene = new THREE.Scene(); lights(scene, 1); const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50), o = built[kinds.indexOf(k)];
    scene.add(o); r.render(scene, cam); const wall = !!(CONFIG.devices[k] && CONFIG.devices[k].wall); fit(cam, o, wall ? new THREE.Vector3(0.35, 0.25, -1) : new THREE.Vector3(0.7, 0.55, -1));
    r.render(scene, cam); out[k] = r.domElement.toDataURL('image/webp', A.iconQ);
    await new Promise((q) => setTimeout(q, 30));
  }
  r.dispose(); return out;
}

// the title band: machines placed in a row (x metres, depth z metres, turn) with a gap in the middle for the house
export async function titleBand() {
  const W = A.bandW, H = A.bandH, r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(W, H); r.setClearColor(0x000000, 0); r.outputColorSpace = THREE.SRGBColorSpace;
  const fov = 2 * Math.atan(A.bandHalfW / A.camDist / (W / H)) * 180 / Math.PI, scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(fov, W / H, 0.5, 200); cam.position.set(0, A.camY, -A.camDist); cam.lookAt(0, A.camY, 0); cam.updateMatrixWorld(true);
  const dark = new THREE.MeshBasicMaterial({ color: A.shape }), screens = [];
  for (const [kind, x, z, ry, say] of A.place) {
    const o = GK.gloomMachine(kind, { dormant: true }); o.position.set(x, 0, z); o.rotation.y = ry; o.userData.anim(0.01, null); scene.add(o); o.updateMatrixWorld(true);
    // the screen: the lit face material (MeshBasic with a picture) that dormancy darkened; its middle and size on the picture
    let best = null; o.traverse((q) => { if (!q.isMesh || !q.material || Array.isArray(q.material)) return; const m = q.material; if (m.isMeshBasicMaterial && m.map && m.map.image && m.map.image.getContext && m.color.r < 0.1) { const b = new THREE.Box3().setFromObject(q), s = b.getSize(new THREE.Vector3()), a = s.x * s.y + s.y * s.z + s.x * s.z; (window.__scr = window.__scr || []).push([kind, a.toFixed(3), b.getCenter(new THREE.Vector3()).y.toFixed(2)]); if (!best || a > best.a) best = { a, b }; } });
    o.traverse((q) => { if (q.isMesh) q.material = dark; if (q.isSprite) q.visible = false; if (q.isPoints || q.isLine) q.visible = false; });
    if (best && say) { const c = best.b.getCenter(new THREE.Vector3()), s = best.b.getSize(new THREE.Vector3()), p = c.clone().project(cam), e = c.clone().add(new THREE.Vector3(Math.max(s.x, s.z) / 2, s.y / 2, 0)).project(cam);
      screens.push({ x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, w: Math.abs(e.x - p.x) / 2 * W * 2, h: Math.abs(e.y - p.y) / 2 * H * 2, say }); }
  }
  r.render(scene, cam);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'); x.drawImage(r.domElement, 0, 0);
  // a lit screen on each sleeping machine: dark green panel, green text, a red standby light under it
  for (const s of screens) { const w = Math.max(A.scrMinW, s.w * A.scrGrow), h = Math.max(A.scrMinH, s.h * A.scrGrow), l = s.x - w / 2, t = s.y - h / 2;
    x.fillStyle = A.scrBg; x.strokeStyle = A.scrEdge; x.lineWidth = 2; x.fillRect(l, t, w, h); x.strokeRect(l, t, w, h);
    x.shadowColor = A.scrInk; x.shadowBlur = 6; x.fillStyle = A.scrInk; const lines = s.say.split('|'), fs = Math.min(h / (lines.length + 0.9), w / 7.2); x.font = 'bold ' + fs.toFixed(1) + 'px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach((ln, i) => x.fillText(ln, s.x, t + h * (i + 1) / (lines.length + 1)));
    x.shadowColor = A.redLed; x.shadowBlur = 10; x.fillStyle = A.redLed; x.beginPath(); x.arc(l + w - A.ledR * 2, t + h + A.ledR * 2.4, A.ledR, 0, 7); x.fill(); x.shadowBlur = 0; }
  // crop to what was drawn (keeps the feet line at the bottom edge)
  const d = x.getImageData(0, 0, W, H).data; let x0 = W, x1 = 0, y0 = H, y1 = 0; for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (d[(yy * W + xx) * 4 + 3] > 8) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = y1 - y0 + 1; c2.getContext('2d').drawImage(cv, 0, y0, W, c2.height, 0, 0, W, c2.height);
  r.dispose(); return { img: c2.toDataURL('image/png'), w: W, h: c2.height, crop: [x0, y0, x1, y1] };
}
window.__art = { icons, titleBand };
