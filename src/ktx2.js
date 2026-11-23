// KTX2 pictures (Nov 23, owner's list item 1; rule 37): the desktop street pictures (CONFIG.quality.high.hiTex) and the desktop models' pictures are stored as
// KTX2 (Basis UASTC, made once by tools/makektx2.mjs) and stay compressed on the graphics chip (BC7 / ASTC / ETC2, chosen by what the chip reads): about a
// quarter of the memory of the same picture as RGBA, uploaded without the chip making mipmaps. three.js's KTX2Loader (MIT) with its Basis transcoder; the
// transcoder files are dist/basis/ beside index.html (the single-file build carries them inside: build.mjs swaps the two names below for data addresses).
// Switch: CONFIG.lag.ktx2 (tex: street pictures, models: desktop models). Phones (low tier) never call this. Any failure: the picture as before (JPEG/PNG).
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { CONFIG } from './config.js';

const FILES = { js: 'basis/basis_transcoder.js', wasm: 'basis/basis_transcoder.wasm' };
let loader = null;
export const ktx2State = { on: false, ok: 0, failed: 0, format: null };
try { window.__ktx2 = ktx2State; } catch (e) { /* no window */ }
// once, after the renderer exists (the loader asks the chip which compressed formats it reads)
export function ktx2Init(renderer) {
  const K = CONFIG.lag.ktx2; if (loader || !K || !(K.tex || K.models)) return loader;
  try { const mgr = new THREE.LoadingManager(); mgr.setURLModifier((u) => (u.endsWith('basis_transcoder.js') ? FILES.js : u.endsWith('basis_transcoder.wasm') ? FILES.wasm : u));
    loader = new KTX2Loader(mgr).setWorkerLimit(K.workers || 2).detectSupport(renderer); ktx2State.on = true;
    const c = loader.workerConfig || {}; ktx2State.format = c.bptcSupported ? 'BC7' : c.astcSupported ? 'ASTC' : c.etc2Supported ? 'ETC2' : c.dxtSupported ? 'BC1/3' : 'RGBA (no compressed format)';
  } catch (e) { loader = null; ktx2State.on = false; }
  return loader;
}
export const ktx2Loader = () => loader;
// a GLTFLoader that reads KHR_texture_basisu pictures when the loader is on (the desktop models from tools/makektx2.mjs need it)
export function withKtx2(gl) { if (loader && CONFIG.lag.ktx2 && CONFIG.lag.ktx2.models) gl.setKTX2Loader(loader); return gl; }
// a KTX2 file as a CompressedTexture (rejects if the loader is off or the file fails)
export function ktx2Load(url) {
  if (!loader) return Promise.reject(new Error('ktx2 off'));
  return loader.loadAsync(url).then((t) => { ktx2State.ok++; return t; }, (e) => { ktx2State.failed++; throw e; });
}
// turn an existing texture (already on materials, maybe cloned) into the compressed picture k, keeping its own wrap, filters, anisotropy and colour space
export function takeCompressed(t, k) {
  t.dispose(); t.isCompressedTexture = true; t.source = k.source; t.mipmaps = k.mipmaps; t.format = k.format; t.type = k.type; t.flipY = false; t.generateMipmaps = false;
  if (k.mipmaps.length <= 1 && (t.minFilter === THREE.LinearMipmapLinearFilter || t.minFilter === THREE.LinearMipmapNearestFilter)) t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
}
