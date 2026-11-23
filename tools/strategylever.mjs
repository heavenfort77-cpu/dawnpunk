// Strategy suite with kind overrides (measuring only). Usage: node tools/strategylever.mjs '{"walker+hauler+warden":{"turret":0.4}}' [skills]   env PREF = CONFIG.turretPrefer (m). Kinds: turret (share of turret damage taken), splash (m), seekPower (m); "*" = every kind.
import { CONFIG } from '../src/config.js'; import { suite, show } from './strategysuite.mjs';
const V = JSON.parse(process.argv[2]), K = { ...CONFIG.gloom.kinds }; for (const [k, o] of Object.entries(V)) for (const kk of (k === '*' ? Object.keys(K) : k.split('+'))) K[kk] = { ...K[kk], ...o };
show(suite({ ...CONFIG, turretPrefer: +(process.env.PREF || 0), gloom: { ...CONFIG.gloom, kinds: K } }, 6, (process.argv[3] || 'average').split(',')), process.argv[2]);
