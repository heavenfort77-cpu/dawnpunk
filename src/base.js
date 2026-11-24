// Base logic (no rendering): save data, personnel, quests, hidden cat, Scout. Headless-testable.
import { mulberry32 } from './sim.js';
import { CONFIG } from './config.js';
import { newFlock, fillFlock, flockDay } from './flock.js';
export { newFlock, fillFlock, flockDay, collectEggs, placeEgg, flockSize, sunquills, dailyYield, HATCHERY_TIP, hatcheryTip } from './flock.js';

export const STATIONS = {
  storage: { name: 'Storage', x: -9, z: -5, r: 2.6 },
  garden: { name: 'Garden', x: 9, z: -5, r: 2.6 },
  workshop: { name: 'Workshop', x: 9, z: 7, r: 2.6 },
  // the quest board stands beside the Workshop's door, on its garden side (left of it as you face the door from the plaza), its face turned to the plaza (owner Nov 17 15:59; it stood at -9, 7 before);
  //   clear of the door, the paths, the hatchery, the cats' spots and hideouts, the Scout's spots and Marla's house (test.js checks the distances)
  board: { name: 'Quest board', x: 10.95, z: 3.3, r: 1.8 },
};
// the quest board's facing (rad, rotation about y): its painted face (+z in its own frame) looks at the plaza's centre
export const boardYaw = () => Math.atan2(-STATIONS.board.x, -STATIONS.board.z);
// its footprint for bumping into: half length along the board, half depth (m)
export const BOARD_BOX = [1.15, 0.28];
// where the Scout may stand this dawn (you have to look for him); labels only show up close
export const SCOUT_SPOTS = [
  { x: -14, z: -12, hint: 'by the solar flowers' },
  { x: 13, z: -13, hint: 'under the big tree' },
  { x: -10.5, z: 11, hint: 'near the old water tank' },
  { x: -1, z: 13.5, hint: 'by the pond' },
  { x: 0, z: -6.85, hint: 'at your door' }, // the opening only (day 1): she stands just outside your doorway when you wake (owner review Nov 17: in the doorway, 2-3 m from the bed; was 1.7, -6.2)
];
// hidden lucky cat: one hideout per save, always behind something. chime gets louder when near
export const CAT_SPOTS = [
  { x: -13, z: 11, hint: 'near the water' },
  { x: 14, z: -11, hint: 'under the old tree' },
  { x: -16, z: -10, hint: 'among the solar flowers' },
  { x: 1, z: 15, hint: 'by the wind tower' },
  { x: 13, z: 1, hint: 'in the garden' },
];
// your home: a small house where the lucky cat you found is placed. Slots are shelf-left, shelf-right, table.
export const HOME = { x: 0, z: -9.5, slots: [[-1.9, 1.1, -11.0], [0, 1.1, -11.0], [1.9, 1.1, -11.0]], desk: [2.3, -8.6] };
// idle villagers; each has one posting at a time on the quest board in their name (owner Nov 17 15:59: quests come ONLY from the board; talking to them gives their lines and a pointer to the board)
export const NPCS = {
  bram: { id: 'bram', name: 'Bram', title: 'old gardener', x: 4.6, z: -1.2, quest: 'deliver', col: 0x4a9a6a, hair: 0xdddddd, lines: ['The beans do not care about the Gloom. Neither should you.', 'Sun, water, patience. Same as people.'] },
  oko: { id: 'oko', name: 'Oko', title: 'tinkerer', x: 6.5, z: 10.4, quest: 'collect', col: 0xb8688a, hair: 0x3a2a2a, lines: ['If it hums, I can fix it. If it screams, give me an hour.', 'Scrap is just a gift in a bad mood.'],
    greet: ['Mind the solder. What are we improving today?', 'Bench is warm. Bring essentials, leave with better toys.', 'You again! Good. The lance has been sulking.', 'Wipe your boots. Then tell me what broke.'] },
  pip: { id: 'pip', name: 'Pip', title: 'lookout kid', x: -5.2, z: 1.4, quest: 'hunt', col: 0xe0a83a, hair: 0x8a4a2a, lines: ['I counted the Gloom last night. Nineteen! Maybe twelve.', 'When I grow up I am going to hunt them. Or pet them.'] },
};
// the workshop you walk into (CONFIG.workshop.on): Oko works behind the bench inside it, so her spot moves there
if (CONFIG.workshop && CONFIG.workshop.on) { const W = CONFIG.workshop, ry = W.ry || 0, [lx, lz] = W.oko.at; NPCS.oko.x = STATIONS.workshop.x + lx * Math.cos(ry) + lz * Math.sin(ry); NPCS.oko.z = STATIONS.workshop.z - lx * Math.sin(ry) + lz * Math.cos(ry); NPCS.oko.inside = 'workshop'; }
const ROLES = ['hunter', 'gatherer', 'researcher']; // hunters thin the Gloom, gatherers bring food, researchers run the Workshop
const NAMES = ['Ines', 'Tomas', 'Wen', 'Aroha', 'Kofi', 'Mei', 'Sol', 'Dara', 'Jun', 'Pia', 'Rui', 'Lena'];

// an ODD number of lucky cats hide in the base (default 3), at least one of each kind. Which arm swings tells the kind:
// arm on your right = energy cat, arm on your left = lure cat (it draws the Gloom, but the loot is richer). The kind is only confirmed when you place it in your home.
function makeCats(cfg, rnd) {
  const n = cfg.cat.count, idx = CAT_SPOTS.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const types = []; for (let i = 0; i < n; i++) types.push(i < Math.ceil(n / 2) ? 'energy' : 'lure'); if (rnd() < 0.5) types.reverse();
  return idx.slice(0, n).map((spot, i) => ({ id: i + 1, spot, type: types[i], state: 'hidden', slot: -1 }));
}
export function newSave(cfg, seed = (Math.random() * 1e9) | 0) {
  const rnd = mulberry32(seed);
  const b = cfg.base;
  return {
    v: 4, seed, day: 1, food: b.start.food, essentials: b.start.essentials, coins: 0,
    personnel: b.start.personnel.map((p, i) => ({ id: i + 1, name: p.name, role: p.role })),
    cats: makeCats(cfg, rnd), revealed: { energy: false, lure: false }, noteSeen: false, up: Object.fromEntries(Object.keys(cfg.base.upgrades).map((k) => [k, 0])), loadout: cfg.loadout.first.slice(), project: null, helped: 0,
    scoutSpot: (rnd(), 3), // day 1: Marla waits by the pond, a few steps from where you wake, so the first ride-out is quick
    quests: [], nextId: 100, nights: 0, nightsMet: 0, lossRun: 0, attn: 0, attnStreak: 0, essTotal: 0, killsTotal: 0, trips: 0, mjRead: 0, avians: cfg.avians ? newFlock(cfg) : undefined,
  };
}

// newer fields get their defaults, so older saves keep working
function fill(cfg, s) { if (cfg.avians) fillFlock(cfg, s); for (const k of ['nights', 'killsTotal', 'essTotal', 'lossRun', 'attn', 'attnStreak']) if (typeof s[k] !== 'number' || !isFinite(s[k])) s[k] = 0; if (typeof s.nightsMet !== 'number' || !isFinite(s.nightsMet)) s.nightsMet = s.nights; if (Array.isArray(s.quests)) s.quests = s.quests.filter((q) => q && (!q.giver || NPCS[q.giver])); if (typeof s.trips !== 'number') s.trips = s.nights || 0; if (typeof s.mjRead !== 'number') s.mjRead = 0; if (!s.up) return true; for (const k of Object.keys(cfg.base.upgrades)) if (typeof s.up[k] !== 'number') s.up[k] = 0; if (!Array.isArray(s.loadout)) s.loadout = cfg.loadout.first.slice(); fixRanges(cfg, s); return true; }
// (bug probe Nov 21, tools/bugprobe_logic.mjs V0/V3/V5) a damaged save could hold an upgrade level outside 0..max or not whole (the level indexes the cost and
// days tables, so a night turned essentials into NaN), a research project naming no upgrade, a person, quest or cat entry of the wrong shape, or a cat whose spot is not a hiding place (the base crashed on
// open, every time, until the site data was cleared). Each such field gets its default (a new save's value); a save the game wrote itself is left exactly as it is
function fixRanges(cfg, s) {
  // every top-level field of a new save keeps its kind: a number stays a finite number, a yes/no stays one, a list stays a list, a record stays a record
  const T = newSave(cfg, s.seed | 0);
  for (const k of Object.keys(T)) { if (k === 'project' || k === 'avians') continue; const d = T[k], v = s[k], kind = (x) => (Array.isArray(x) ? 'list' : x === null ? 'null' : typeof x);
    if (typeof d === 'number' ? !(typeof v === 'number' && Number.isFinite(v)) : kind(v) !== kind(d)) s[k] = d; }
  const U = cfg.base.upgrades; for (const k of Object.keys(U)) { const v = s.up[k]; if (!Number.isInteger(v) || v < 0 || v > U[k].max) s.up[k] = Number.isFinite(v) ? Math.max(0, Math.min(U[k].max, Math.floor(v))) : 0; }
  const P = s.project; if (P !== null && P !== undefined && (typeof P !== 'object' || !U[P.key] || !Number.isFinite(P.left) || !Number.isFinite(P.total))) s.project = null;
  if (Array.isArray(s.personnel)) s.personnel = s.personnel.filter((q) => q && typeof q === 'object' && Number.isInteger(q.id) && typeof q.name === 'string' && ROLES.includes(q.role));
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  if (Array.isArray(s.quests)) s.quests = s.quests.filter((q) => q && typeof q === 'object' && Number.isInteger(q.id) && typeof q.type === 'string' && typeof q.text === 'string' && typeof q.state === 'string' && q.reward && typeof q.reward === 'object' && num(q.reward.food) && num(q.reward.essentials) && ((q.type !== 'hunt' && q.type !== 'collect') || (num(q.got) && num(q.target))) && (!('got' in q) || num(q.got)) && (!('target' in q) || num(q.target)));
  if (!Number.isInteger(s.nextId)) s.nextId = Math.max(100, ...(Array.isArray(s.quests) ? s.quests.map((q) => q.id + 1) : []));
  if (Array.isArray(s.cats)) { const t = makeCats(cfg, mulberry32(s.seed | 0)); s.cats = s.cats.map((c, i) => (c && typeof c === 'object' && Number.isInteger(c.spot) && CAT_SPOTS[c.spot] && (c.type === 'energy' || c.type === 'lure') && ['hidden', 'carried', 'placed'].includes(c.state) && Number.isInteger(c.slot) ? c : t[i])).filter(Boolean); }
}
// devices you know, and how many you can carry into the night
export const unlocked = (cfg, save) => Object.keys(cfg.devices).filter((k) => cfg.loadout.start.includes(k) || (save.up['dev_' + k] || 0) > 0);
export const slots = (cfg, save) => cfg.loadout.slots + (save.up.slots || 0);
export function loadout(cfg, save) { const ok = unlocked(cfg, save), n = slots(cfg, save), out = []; for (let i = 0; i < n; i++) { const k = save.loadout[i]; out.push(ok.includes(k) ? k : (ok.find((q) => !out.includes(q) && !save.loadout.includes(q)) || ok[i % ok.length])); } return out; }
export function setLoadout(cfg, save, i, kind) { if (!unlocked(cfg, save).includes(kind) || i < 0 || i >= slots(cfg, save)) return false; const cur = loadout(cfg, save), j = cur.indexOf(kind); if (j >= 0 && j !== i) cur[j] = cur[i]; cur[i] = kind; save.loadout = cur; return true; }
export function loadSave(cfg, storage) {
  try { const raw = storage && storage.getItem('solardg.save'); if (raw) { const s = JSON.parse(raw); if (s && s.v === 4 && fill(cfg, s) && Array.isArray(s.cats) && Array.isArray(s.personnel) && Array.isArray(s.quests) && s.up && typeof s.food === 'number' && typeof s.day === 'number') { settlePending(cfg, s); return s; } } } catch (e) { /* fall through to a new save */ }
  const s = newSave(cfg); makeQuests(cfg, s); return s;
}
// RELOAD = LEFT (Nov 24, abuse list: refreshing the page mid-night erased a losing night and let you re-roll it). Riding out marks the night pending (src/main.js startRun);
// banking it (applyNight) clears the mark; a save loaded with the mark still on counts that night as leaving it: minimum payout, no ring opened, the day moves on.
// Not on the very first night (save.nights 0): a new player whose page closed simply gets the first night again, lesson included.
export function markPending(save, ring) { save.pending = { ring: ring || 0, day: save.day }; }
export function settlePending(cfg, save) { const p = save.pending; if (!p) return null; delete save.pending; if (p.day !== save.day || !save.nights) return null; const r = applyNight(cfg, save, { win: false, left: true, ring: p.ring || 0, lasted: 0, food: cfg.loot.minPayoutFood, essentials: 0, coins: 0 }, 0); save.settledLeave = true; return r; }
export function writeSave(save, storage) { try { storage && storage.setItem('solardg.save', JSON.stringify(save)); return true; } catch (e) { return false; } }

export const count = (save, role) => save.personnel.filter((p) => p.role === role).length;
export const gloomMult = (cfg, save) => (1 - Math.min(cfg.base.passive.hunterCap, cfg.base.passive.hunterCut * count(save, 'hunter'))) * (1 + cfg.cat.lurePer * placedCats(save, 'lure'));
export const placedCats = (save, type) => save.cats.filter((c) => c.state === 'placed' && (!type || c.type === type)).length;
export const carriedCats = (save) => save.cats.filter((c) => c.state === 'carried').length;
// OWNER DECISION (lead 00:25, Card 50): the boss's night = the boss ring AND night >= CONFIG.boss.fromNight AND at least CONFIG.boss.minUpgrades upgrades finished
export const bossNight = (cfg, save, ring) => !!(cfg.boss && cfg.boss.on && ring === cfg.boss.ring && save && (save.nightsMet || 0) + 1 >= (cfg.boss.fromNight || 1) && Object.values(save.up || {}).reduce((a, v) => a + (+v || 0), 0) >= (cfg.boss.minUpgrades || 0));
// rings 1-3 tougher machines (CONFIG.tough): health x for tonight's Gloom on this ring; 1 on the first night ever, and eased after lost nights in a row
export const toughHp = (cfg, save, ring) => { const t = cfg.tough; if (!t || !save || !save.nights) return 1; const x = Math.max(0, ((t.hp && t.hp[ring]) || 1) - 1); return 1 + x * Math.pow(t.ease, save.lossRun || 0); };
// CONFIG.attention: tonight's health and damage factors from the save's level
export const attentionMul = (cfg, save) => { const A = cfg.attention, l = (save && save.attn) || 0; return A ? { hp: 1 + A.hp * l, dmg: 1 + A.dmg * l, level: l } : { hp: 1, dmg: 1, level: 0 }; };
export const nightEnergyBonus = (cfg, save) => placedCats(save, 'energy') * cfg.cat.energyBonus + save.up.energy * cfg.base.upgrades.energy.per; // only cats that sit in your home count
export const lootMult = (cfg, save) => 1 + placedCats(save, 'lure') * cfg.cat.lureLoot;
// the sim config for a night: research upgrades change panels and turbines
export function makeCfg(cfg, save) {
  const u = cfg.base.upgrades, d = cfg.devices;
  return { ...cfg, devices: { ...d, panel: { ...d.panel, hp: Math.round(d.panel.hp * (1 + u.panel.per * save.up.panel)) }, turbine: { ...d.turbine, energyPerSec: d.turbine.energyPerSec * (1 + u.turbine.per * save.up.turbine) } } };
}
// research: one project at a time. Essentials are spent to start it; researchers advance it each dawn, and you can help once a day
export function startResearch(cfg, save, key) {
  const u = cfg.base.upgrades[key], lv = save.up[key];
  if (save.project) return { ok: false, msg: 'The workshop is busy with ' + cfg.base.upgrades[save.project.key].name + '.' };
  if (lv >= u.max) return { ok: false, msg: u.name + ' is at its best.' };
  const cost = u.cost[lv]; if (save.essentials < cost) return { ok: false, msg: `Need ${cost} essentials (have ${save.essentials}).` };
  save.essentials -= cost; save.project = { key, left: u.days[lv], total: u.days[lv] };
  return { ok: true, msg: `Research started: ${u.name} level ${lv + 1}, ${u.days[lv]} days of work.` };
}
function advance(cfg, save, n) {
  const p = save.project; if (!p || n <= 0) return null; p.left -= n;
  if (p.left <= 0) { save.up[p.key]++; save.project = null; return cfg.base.upgrades[p.key].name + ' level ' + save.up[p.key]; } return null;
}
export function helpResearch(cfg, save) {
  if (!save.project) return { ok: false, msg: 'Nothing is being researched.' };
  if (save.helped === save.day) return { ok: false, msg: 'You already helped today.' };
  save.helped = save.day; const done = advance(cfg, save, 1); return { ok: true, msg: done ? 'Research finished: ' + done + '!' : 'You lent a hand: one day of work done.' };
}
export function cycleRole(save, id) { const p = save.personnel.find((x) => x.id === id); if (!p) return null; p.role = ROLES[(ROLES.indexOf(p.role) + 1) % ROLES.length]; return p; }
export function journalLines(cfg, save) {
  const rum = save.cats.filter((c) => c.state === 'hidden').map((c) => `Rumour: a golden paw waves ${CAT_SPOTS[c.spot].hint}.`);
  return [`Day ${save.day}. Nights survived or tried: ${save.nights}. Gloom downed: ${save.killsTotal}.`,
    `Lucky cats: ${save.cats.filter((c) => c.state !== 'hidden').length} found, ${placedCats(save)} at home.` + (save.noteSeen ? ' An odd number of them hide in the base.' : ''),
    save.revealed.energy ? 'Arm on your right swings: it gives Sun.' : 'Which arm swings might matter. Place a cat to learn.',
    save.revealed.lure ? 'Arm on your left swings: it lures Gloom, but the loot is richer.' : '', ...rum].filter(Boolean);
}

// Marla the Scout: sharp-tongued rival and friend. The player is Ashley Potts, the village panel-tender (surname address is her habit). Tiers by nights survived: wary, sparring, grudging respect, trusted. Every line keeps "Potts" and a tease paired with care; T-rated, never cruel.
export function scoutLine(save) {
  const l = (a) => a[save.nights % a.length];
  const n = save.nights;
  if (n === 0) return l(['Potts. You are on time, which worries me. Pick a ring and try not to embarrass us both.', 'Well, well, Potts. The panel-tender wakes up. Pick where we are going, and keep your polish rag off my scarf.']);
  if (save.lastWin === false) return l(['Back already, Potts? I had a bet that the Gloom had finally got you. I lost. Annoying.', 'You look terrible, Potts. Good. It means you tried. Sit, drink, then pick a ring.', 'Next time stand behind the panels, Potts. I am not carrying you home twice.']);
  if (placedCats(save) > 0 && save.day % 2 === 0) return l(['Lucky cats on the shelf now? That is cheating, Potts. I approve. Where to?', 'I heard a cat waves at you at night, Potts. Do not let it go to your head.']);
  if (n < 3) return l(['Do not let it go to your head, Potts, but that was a decent night. Where to?', 'Ring, house, and keep your pride out of the pack, Potts. Go on.', 'Ready when you are, Potts. Someone has to keep an eye on you.']);
  if (n < 6) return l(['Your panels held, Potts. Do not make it weird. Where to?', 'Fine, Potts, you are not hopeless. Say that to anyone and I will deny it.', 'I saved you a spot on the ridge, Potts. Do not make me regret it.']);
  return l(['Same as always, Potts. You light it, I watch it, we both pretend that is not teamwork.', 'The village sleeps because of you, Potts. Hand me the map before I get sentimental.', 'After all these dawns, Potts, I would trust you with the good lantern. Almost.']);
}
export const npcQuestOf = (save, id) => save.quests.find((q) => q.giver === id && q.state !== 'done') || null;
// a villager's posting, once done (crate delivered, Gloom hunted, essentials brought), waits to be handed in at the board ('ready'); the board's own quests pay at once
const complete = (save, q) => { if (q.giver) { q.state = 'ready'; } else { q.state = 'done'; pay(save, q.reward); } };
// ---- the quest board: every quest is taken and handed in here (the board's own and the villagers' postings in their names)
export const BOARD_HINT = 'Check the board by the Workshop.';
export const BOARD_HAND_IN = 'Done? Hand it in at the board by the Workshop.';
// what the board lists, in order: the board's own quests, then each villager's posting (done ones stay listed as done for the day)
export const boardPostings = (save) => save.quests.filter((q) => !q.giver).concat(save.quests.filter((q) => q.giver));
// take a posting: the board's own ('open') or a villager's ('offered'); returns the quest, or null. A villager's delivery hands you its crate here (the caller sets the carry)
export function takePosting(save, id) { const q = save.quests.find((x) => x.id === +id); if (!q || q.state !== (q.giver ? 'offered' : 'open')) return null; q.state = 'active'; return q; }
// hand in a villager's finished posting at the board: paid now; returns the quest, or null
export function handIn(save, id) { const q = save.quests.find((x) => x.id === +id); if (!q || !q.giver || q.state !== 'ready') return null; q.state = 'done'; pay(save, q.reward); return q; }
// talking to a villager: their own line only (it never starts, takes or hands in a quest), plus a pointer to the board while they have a posting there
export function npcTalk(save, id) {
  const n = NPCS[id]; if (!n) return null; const q = npcQuestOf(save, id);
  return { line: n.lines[(save.day + n.name.length) % n.lines.length], greet: n.greet ? n.greet[save.day % n.greet.length] : null, hint: !q ? null : q.state === 'ready' ? BOARD_HAND_IN : BOARD_HINT };
}
function makeNpcQuests(cfg, save) {
  const rnd = mulberry32(save.seed + save.day * 104729), keys = ['storage', 'garden', 'workshop'], q = cfg.base.quests;
  for (const n of Object.values(NPCS)) {
    if (npcQuestOf(save, n.id)) continue;
    if (n.quest === 'deliver') { const to = keys[Math.floor(rnd() * 3)]; save.quests.push({ id: save.nextId++, giver: n.id, type: 'deliver', to, text: `${n.name}: take a crate of seedlings from the board to ${STATIONS[to].name}`, reward: { food: q.deliverFood + 2, essentials: 0 }, state: 'offered' }); }
    else if (n.quest === 'hunt') save.quests.push({ id: save.nextId++, giver: n.id, type: 'hunt', target: q.huntBase + 2 + save.day, got: 0, text: '', reward: { food: q.huntFood + 2, essentials: 1 }, state: 'offered' });
    else save.quests.push({ id: save.nextId++, giver: n.id, type: 'collect', target: q.collectBase + 1 + Math.floor(save.day / 2), got: 0, text: '', reward: { food: 2, essentials: q.collectEss }, state: 'offered' });
  }
  q_text(save);
}
// three quests per dawn: a delivery inside the base, a hunt, a collection
export function makeQuests(cfg, save) {
  const giver = (save.quests || []).filter((x) => x.giver && x.state !== 'done');
  const rnd = mulberry32(save.seed + save.day * 7919), keys = ['storage', 'garden', 'workshop'];
  const from = keys[Math.floor(rnd() * 3)], to = keys.filter((k) => k !== from)[Math.floor(rnd() * 2)];
  const q = cfg.base.quests;
  save.quests = [
    { id: save.nextId++, type: 'deliver', from, to, text: `Carry a crate of seedlings from ${STATIONS[from].name} to ${STATIONS[to].name}`, reward: { food: q.deliverFood, essentials: 0 }, state: 'open' },
    { id: save.nextId++, type: 'hunt', target: q.huntBase + save.day, got: 0, text: '', reward: { food: q.huntFood, essentials: 0 }, state: 'open' },
    { id: save.nextId++, type: 'collect', target: q.collectBase + Math.floor(save.day / 2), got: 0, text: '', reward: { food: 0, essentials: q.collectEss }, state: 'open' },
  ];
  save.quests.push(...giver); makeNpcQuests(cfg, save);
  q_text(save);
}
function q_text(save) {
  for (const q of save.quests) {
    const who = q.giver ? NPCS[q.giver].name + ': ' : '', tail = '';
    if (q.type === 'hunt') q.text = `${who}Hunt down ${q.target} Gloom on your next nights (${q.got}/${q.target})${tail}`;
    if (q.type === 'collect') q.text = `${who}Bring home ${q.target} essentials from collection runs (${q.got}/${q.target})${tail}`;
  }
}
const pay = (save, r) => { save.food += r.food; save.essentials += r.essentials; };
export function acceptNext(save) { const q = save.quests.find((x) => x.state === 'open'); if (q) q.state = 'active'; return q || null; }

// delivery: the board's own crates are picked up at their source station; a villager's crate comes with their posting at the board. Hand over at the destination.
export function interactStation(save, key, carry) {
  if (carry) {
    const q = save.quests.find((x) => x.id === carry.questId && x.state === 'active');
    if (q && key === q.to) { complete(save, q); return { carry: null, msg: q.giver ? `Delivered! Hand in ${NPCS[q.giver].name}'s posting at the board.` : `Delivered! +${q.reward.food} food`, done: true }; }
    return { carry, msg: null };
  }
  const q = save.quests.find((x) => x.type === 'deliver' && !x.giver && x.state === 'active' && x.from === key);
  if (q) return { carry: { questId: q.id, to: q.to }, msg: `Picked up the crate. Take it to ${STATIONS[q.to].name}.` };
  return { carry: null, msg: null };
}

// recruit one more person at the Garden: costs food; role goes to the thinnest group
export function recruit(cfg, save) {
  if (save.food < cfg.base.recruitFood) return { ok: false, msg: `Need ${cfg.base.recruitFood} food to welcome someone (have ${save.food}).` };
  if (save.personnel.length >= cfg.base.maxPersonnel) return { ok: false, msg: 'The base is full for now.' };
  save.food -= cfg.base.recruitFood;
  const role = ROLES.slice().sort((a, b) => count(save, a) - count(save, b))[0];
  const p = { id: save.nextId++, name: NAMES[save.personnel.length % NAMES.length], role };
  save.personnel.push(p); return { ok: true, msg: `${p.name} joins as a ${role}.`, p };
}

// after a night: payout, passive work of the personnel, quest progress, new day and new quests
export function applyNight(cfg, save, result, kills) {
  delete save.pending; // the night is banked (RELOAD = LEFT above)
  const win = !!result.win; save.coins = (save.coins || 0) + (result.coins || 0);
  if (win) save.ringOpen = Math.max(save.ringOpen || 1, Math.min(cfg.ring.mult.length, (result.ring || 0) + 2)); // winning ring N opens ring N+1
  const lm = lootMult(cfg, save); result = { ...result, food: Math.round(result.food * lm), essentials: Math.round(result.essentials * lm) };
  save.food += result.food; save.essentials += win ? result.essentials : 0;
  const pa = cfg.base.passive, gat = count(save, 'gatherer'), hun = count(save, 'hunter');
  const left = !!result.left || (!win && (result.lasted || 0) < cfg.base.tryTime); // walking out, or dying almost at once, earns nothing at home: no passive income, no research day
  const passive = left ? { essentials: 0, food: 0 } : { essentials: hun * pa.hunterEss, food: gat * pa.gatherFood };
  const research = left ? null : advance(cfg, save, count(save, 'researcher') * pa.researchPerDay);
  save.essentials += passive.essentials; save.food += passive.food;
  save.nights++; save.trips = (save.trips || 0) + 1; if (win || (result.lasted || 0) > 0) save.nightsMet = (save.nightsMet || 0) + 1; save.killsTotal += kills; save.essTotal += win ? result.essentials : 0;
  for (const q of save.quests) {
    if (q.state !== 'active') continue;
    if (q.type === 'hunt') { q.got = Math.min(q.target, q.got + kills); if (q.got >= q.target) complete(save, q); }
    if (q.type === 'collect') { q.got = Math.min(q.target, q.got + (win ? result.essentials : 0)); if (q.got >= q.target) complete(save, q); }
  }
  save.day++; const flock = cfg.avians && cfg.avians.on ? flockDay(cfg, save, !left) : null; save.scoutSpot = (save.scoutSpot + 1 + Math.floor(mulberry32(save.seed + save.day)() * 3)) % 4;
  save.lastWin = win; save.lossRun = win ? 0 : (save.lossRun || 0) + 1; // lost nights in a row (CONFIG.tough.ease)
  { const A = cfg.attention; if (A) { let l = save.attn || 0, st = save.attnStreak || 0; // CONFIG.attention: the level for the next night
    if (win && (result.dmgTaken || 0) < A.clean) { if (++st >= A.streak) { l = Math.min(A.max, l + 1); st = 0; } } else if (win) { st = 0; l = Math.max(0, l - A.hitDown); } else { st = 0; l = Math.max(0, l - A.down); }
    save.attn = l; save.attnStreak = st; } }
  const keep = save.quests.filter((q) => !q.giver && q.state === 'active'); const old = save.quests; makeQuests(cfg, save);
  for (const q of keep) { const i = save.quests.findIndex((n) => !n.giver && n.type === q.type); if (i >= 0) save.quests[i] = q; }
  q_text(save); void old;
  return { passive, research, flock };
}

export function foundCat(save, id) { const c = save.cats.find((x) => x.id === id); if (!c || c.state !== 'hidden') return null; c.state = 'carried'; return c; }
// slot k: place a carried cat there (its kind is revealed) or take back the cat that sits there
export function useSlot(save, k) {
  const here = save.cats.find((c) => c.state === 'placed' && c.slot === k);
  if (here) { here.state = 'carried'; here.slot = -1; return { act: 'took', cat: here }; }
  const c = save.cats.find((x) => x.state === 'carried'); if (!c) return { act: 'none' };
  c.state = 'placed'; c.slot = k; const first = !save.revealed[c.type]; save.revealed[c.type] = true; const note = !save.noteSeen; save.noteSeen = true;
  return { act: 'placed', cat: c, first, note };
}
export const catPos = (c) => CAT_SPOTS[c.spot];
export const scoutPos = (save) => SCOUT_SPOTS[save.scoutSpot];

// Marla's night barks (HUD line, about 40 characters max; {d} direction, {f} floor, {u} up/down)
export const MARLA_LINES = {
  // food eaten at night is the village's food (owner Nov 17 23:58): the first meal of a run, and the low-health line once you have already eaten CONFIG.village.ateLow or more tonight
  supper: ["That's the village's supper, Potts. Hmph."],
  lowAte: ['Eat. Better we go hungry than you dying.'],
  inbound: ['Gloom {d}. Look awake, Potts.', 'Shadows {d}. Your problem, Potts.', 'More of them {d}. Lucky you.', 'Company {d}. Do not make it weird.'],
  upper: ['Floor {f}, {d}! Move, Potts!', 'Floor {f}, {d}. Hold the window!', 'They want floor {f}, {d}. Rude.'],
  stair: ['One on the stairs, coming {u}! Shoot!', 'Stairs, Potts! It is climbing {u}!', 'Stair-crawler heading {u}. Yours!'],
  collector: ['Collectors {d}, Potts. Mind them.', 'They are at the solar, {d}.', 'Collectors, {d}. Today, Potts.'],
  hurt: ['That one was free. Duck, Potts.', 'Use the panels. That is their job.', 'Stop getting hit. It distracts me.', 'I am not carrying you home twice.'],
  // streak: the player keeps taking hits on the first night (owner Nov 16: sarcastic tone); hintsH: the hold-H keys reminder, first night, desktop only (teaching review fix 7: H only shows the keys while held; these lines have no voice clip)
  streak: ['Three hits. Are you collecting them, Potts?', 'Bold plan: stand in front of it. Genius.', 'You hit back. That is the idea. Allegedly.', 'Keep bleeding and I am renting your room.', 'Really committing to being a doorstop, huh?'],
  hintsH: ['Forgot a key, Potts? Hold H to read them.', 'Lost the keys? Hold H. Aim, though.'],
  low: ['Eat something, Potts. That is an order.', 'Fall back. I am not hauling you home.', 'Ashley... eat. Do not make me say it twice.']
};

// ---- the workshop you walk into: Marla tells you where it is ONCE, on the first base visit after a night (owner Nov 16 23:32). {w} = where it is from where you stand.
export const WORKSHOP_TIP = "Workshop's {w}. Oko upgrades devices. Bring scrap.";
export const workshopTip = (save) => !!save && (save.nights || 0) >= 1 && !save.toldWorkshop;
export function markWorkshopTip(save) { if (!workshopTip(save)) return false; save.toldWorkshop = save.day; return true; }

// ---- Marla's journal (owner Nov 16 23:35): private, on the desk in her house. Line 1 is there from the first base visit; every trip (a night run back to base) unlocks ONE more;
// after the 30th every further trip adds the closing line once. Wording from docs/marla_journal.md, approved by the owner: do not rewrite.
export const MARLA_JOURNAL = [
  'New panel-tender. Potts. Loud boots. Won\'t last a week.',
  'Potts survived. Barely. I only watched because someone has to count losses.',
  'He waved from the panels. I didn\'t wave back. My hand was cold, that\'s all.',
  'Mended my scarf. Not for anyone. It kept getting in my eyes.',
  'He came back with scrap and a dent in his helmet. Idiot. I checked the dent twice.',
  'Told Oko the panel-tender is replaceable. Oko laughed. Oko is wrong about lots of things.',
  'Saved him a pear from the garden. It was going soft anyway. Obviously.',
  'His first name is Ashley. Ashley. I say it in my head when he\'s being stupid. Often.',
  'Stood on the wall till dawn. For the view. The view is very good from there.',
  'Potts took a hit meant for the turbine. I yelled. Loudly. For the turbine.',
  'Stitched his glove while he slept by the stove. Bad stitching costs us power. Strategy.',
  'Bram asked if I like Potts. I threw a bean at him. At Bram. Not Potts.',
  'Stopped writing about Potts in the scouting log. Started this journal instead. Unrelated.',
  'He laughed at something I said. It wasn\'t a joke. Still counts.',
  'Long night. He came back. That\'s the entry.',
  'Pip drew Potts and me holding hands. Confiscated it. Evidence. It\'s in my drawer.',
  'He fell asleep on the bench. Put a blanket on him so he\'d stop shivering. The noise, you know.',
  'If he gets hurt out there, who do I complain to? Exactly. Keep him alive, Marla.',
  'He calls me "Scout" like it\'s a compliment. It isn\'t. I\'m not smiling. Shut up, journal.',
  'Made two cups of tea by mistake. Left the second by his door. Also a mistake.',
  'Counted the Gloom tonight. Counted Potts too. Both came back. I\'m glad about one of them.',
  'I\'m not waiting at the gate. I\'m guarding it. Very closely. Every dawn.',
  'He left a note: "thanks, M." Keeping it. Recycling matters.',
  'Potts asked what I\'m writing. "Gloom counts." He believed me. Good. Idiot.',
  'The turbine hummed all night because he fixed it. Good job. I said it to the turbine.',
  'If anyone reads this: none of it means anything. Especially the Potts pages.',
  'Dreamt the dawn didn\'t come. He was there anyway, fixing panels. Woke up annoyed.',
  'Fine. He\'s brave. Stupidly brave. I can admit that here, where nobody looks.',
  'I\'d follow that idiot into the dark. I mean lead. Obviously I\'d lead.',
  'Dawn again. He\'s alive. I\'m... fine with that. Very fine. Shut up.',
];
export const MARLA_JOURNAL_END = 'Same as always. He came back. Good.';
// the unlocked lines in order: trips + 1 of them, the closing line after the 30th
// capped at 5000 entries: a damaged save's trips (bugprobe_logic: 1e12) must not build a 1e12-line journal; real saves never reach it (one trip a night)
export function marlaJournal(save) { const t = save && Number.isFinite(save.trips) ? Math.max(0, save.trips) : 0, n = Math.min(t + 1, 5000), out = []; for (let i = 0; i < n; i++) out.push(i < MARLA_JOURNAL.length ? MARLA_JOURNAL[i] : MARLA_JOURNAL_END); return out; }
export const marlaJournalUnread = (save) => marlaJournal(save).length > ((save && save.mjRead) || 0);
export function readMarlaJournal(save) { const L = marlaJournal(save); save.mjRead = L.length; return L; }
// the margin label of entry i (owner Nov 17 13:22): the first entry is there before any trip, so it is "First day."; entry i after it is "Trip i."
export const marlaLabel = (i) => (i === 0 ? 'First day.' : 'Trip ' + i + '.');

// ---- food for the village (owner Nov 17 23:58; CONFIG.village): what the EAT button, the results and the base line say
// the EAT label: food still to bring home (phones get the short form on a second line)
export const eatLabel = (food, phone) => (phone ? 'EAT<br>' + food + ' home' : 'EAT · ' + food + ' to bring home');
// "Next recruit: 22/30 food" from the base's food (ready once it reaches the price)
export const recruitLine = (cfg, food) => 'Next recruit: ' + (food >= cfg.base.recruitFood ? 'ready (' + food + ' food)' : food + '/' + cfg.base.recruitFood + ' food');
// the night results line: the recruit line plus what was eaten (left out when nothing was)
export const nightFoodLine = (cfg, food, eaten) => recruitLine(cfg, food) + '.' + (eaten > 0 ? ' You ate ' + eaten + '.' : '');
// which low-health line Marla uses: the hungry one once you have eaten enough tonight
export const lowKey = (cfg, eaten) => (eaten >= cfg.village.ateLow ? 'lowAte' : 'low');
