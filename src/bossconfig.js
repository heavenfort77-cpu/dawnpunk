// THE BECKONER: the final-night boss (owner, Nov 17 16:39; cat-like look 16:48; advisor review docs/advisor_boss_review.md). Read as CONFIG.boss (src/config.js).
// A giant ruined beckoning-cat machine on the street in front of the house you hold, on ring 5's nights. One paw SLAMS (telegraphed), the other BECKONS and summons Gloom.
// Hold the house until dawn (it powers down: POWER SAVER) or break both paws and then the coin-core in its chest. All distances in metres, times in seconds.
// The sim (src/boss.js) is deterministic and seeded; the picture is src/bosshi.js (desktop model and phone build); the falling pieces on desktop are src/physics.js.
export const BOSS_CONFIG = {
  // master switch; ring: the ring index (0-based) whose nights have the boss (4 = ring 5, the last ring of the demo)
  on: true,
  ring: 4,
  // name used in every text (hidden-cat safety: no text calls it a lucky cat)
  name: 'the Beckoner',
  // where it stands, in the held house's own frame: out = metres out from the front wall (across the road), side = metres along the street toward the nearer street end.
  // About 22-28 m from the house front (advisor). It never walks.
  place: { out: 11, side: 21 },
  // size: the model is built at quarter scale; scale = the game's size multiplier (about 8.8 m seated with ears)
  scale: 4,
  // the reveal at night start: it rises out of the street from 'at' seconds for 'dur' seconds (a scripted moment; it cannot act until risen); Marla shouts as it starts
  rise: { at: 1.0, dur: 5.0 },
  // summons take over from the normal ring-5 waves: normal spawns before keepFrac of the night stay (the first wave); of the later ones only waveKeep still come.
  // budgetCap: true = the summons may only bring as many Gloom as were removed (the night's total never above an ordinary ring-5 night); false (owner, Nov 17 17:16:
  // the boss night is the HARDEST night) = the summons keep coming until the beckoning paw is broken: breaking it is the way to win
  budgetCap: false,
  keepFrac: 0.15,
  // waveKeep: share of the later normal spawns that still come (spread evenly) beside the summons. 1 = every normal wave still comes and the summons come on top
  // (coordinator 22:40, owner 'rather it be the hardest night': with all waves kept the boss night is harder than an ordinary ring-5 night for every bot on every house)
  waveKeep: 1.0,
  // BECKONING PAW (summons). first: seconds after the rise; every: [min, max] seconds between summons (seeded); tele: the cold teal glow before the summon;
  // hold: the paw stays up after the summon with its core open; lower: time to lower it; start: Gloom in the first summon, add: more each summon, max: most in one summon;
  // cap: no summon while this many Gloom are alive (capPhone on the phone tier); noSlam: no slam starts this many seconds after a summon;
  // gap: seconds between the summoned Gloom stepping off; spread: how far apart (m) they start round its feet
  // feet: share of each summon that steps off at its feet and walks up the street (the rest come out of the dark round the house, at any opening)
  // (tuned 22:40 with the bots, 60 seeds a cell, against the same night without the boss: small summons on top of the full waves; see docs/handoff.md for the table)
  // base: openings of the smallest ring-5 house; a bigger house gets perOpen more Gloom per summon and capOpen more on the alive cap for each extra opening (bigger houses
  // were the ones where the boss night came out easier than an ordinary night)
  summon: { first: 14, every: [24, 28], tele: 2.0, hold: 2.5, lower: 0.8, start: 2, add: 0, max: 2, cap: 6, capPhone: 6, noSlam: 5, gap: 0.45, spread: 3.5, feet: 0.3, base: 15, perOpen: 0.8, capOpen: 1.5 },
  // SLAM PAW. first: seconds after the rise; every: [min, max] seconds between slams; tele: warning time of the 1st, 2nd, then every later slam;
  // stuck: the paw stays in the ground beside the house this long with its core open; recover: pulling the boom back; ring: radius of the warning ring and hit area;
  // out: the ring's centre is this far outside the opening it hits; devFrac: share of a device's FULL health a hit takes (0.5 = never one-hit from full);
  // playerFrac: share of the player's full health a hit takes (at most); openDelay: the hit opening is smashed wider, Gloom climb through it this much faster (x);
  // face: an opening is a target only if its outward side faces the boss at least this much (cosine); avoid: no target whose ring is within this of the player at the start
  slam: { first: 9, every: [16, 20], tele: [2.0, 2.0, 1.6], stuck: 1.5, recover: 1.0, ring: 3.0, out: 1.6, devFrac: 0.35, playerFrac: 0.25, openDelay: 0.5, face: 0.25, avoid: 0.5 },
  // camera shake on impact: time (s), deg = largest turn, phone = share of that on phones
  shake: { time: 0.3, deg: 1.5, phone: 0.5 },
  // last part of the night: after lateFrac of the night the rests between actions are lateMul as long (the finale)
  lateFrac: 0.85, lateMul: 0.75,
  // WEAK POINTS. pawR / coreR: hit radius (m; palm pads 0.9 m wide, chest coin 1.2 m); pawHits / coreHits: cannon hits to break one; charged: hits a charged shot counts;
  // range: longest shot at the boss (m, eye to weak point)
  weak: { pawR: 0.45, coreR: 0.6, pawHits: 6, coreHits: 12, charged: 2, range: 45 },
  // weak point positions in the boss's own frame [x right, y up, z (negative = toward the house)], m: the raised beckoning palm, the chest coin;
  // slamUp: height of the slam paw over its target while it rises (from, to); slamCore: height of the stuck slam paw's core over the ground
  pts: { beckon: [-2.2, 5.5, -2.4], chest: [0, 3.45, -1.2], slamUp: [3.0, 5.5], slamCore: 0.8 },
  // DAWN: it powers down ("POWER SAVER") and collapses; the end screen waits hold seconds. wreck: the collapse after the core is broken.
  // wreck.endNight (coordinator 22:40, owner: 'rather it be the hardest night'): false = the night goes on to dawn after the collapse (the remaining waves and every Gloom still
  // alive; the usual early dawn once all are gone); throe = Gloom it calls in one last time as it falls
  // endNight: breaking the core ends the night at once after the collapse (false: it lies in a heap and the night goes on to dawn, with its waves)
  dawn: { hold: 4.5 }, wreck: { hold: 4.5, endNight: false, throe: 4 },
  // SUN SPILL at once into the player's battery (capped by CONFIG.player.energyCap) when a paw or the coin-core breaks: breaking them costs about 7 and 13 cannon shots, so this makes the hunt worth doing (tuned with the pawhunter bot: src/bots.js)
  spill: { paw: 18, core: 20 },
  // BONUS on a won night (fits the economy: about one Workshop upgrade for the full break): per broken paw, for the broken coin-core
  bonus: { paw: { ess: 5, food: 2 }, core: { ess: 10, food: 4 } },
  // Marla, at most 44 characters each (test.js checks): rise, first slam warning, first summon, a paw broken, the core open, dawn
  marla: {
    rise: "That's not a cat. That's a landlord!",
    slam: 'Paw coming down! Off the red ring!',
    summon: "It's calling them in. Shoot the raised paw!",
    paw: 'One paw down, Potts! Keep going!',
    core: "Chest's open! Hit the coin!",
    dawn: 'Sun\'s up. Power saver. Hmph.',
  },
  // the field guide line (journal), in the style of docs/lore_notes.md
  before: 'Before: the mascot of the old Grid Co. shopfront. It waved people in to pay their power bills.',
  // the screen text when it powers down
  powerSaver: 'POWER SAVER',
  // ---- THE PICTURE (src/bosshi.js). model: the desktop GLB (art/models_hi/boss_beckoner_hi.glb, from tools/gloomglb/boss_model.py); glb: false draws the code-built (phone) cat on desktop too
  view: {
    glb: true,
    // the rise out of the street: how deep it starts (m), the dust it throws, how far the camera shakes meanwhile (deg)
    riseDepth: 9.5, riseShake: 0.6,
    // colours: teal = the summon glow (a colour nothing else in the game uses); open = a weak point that can be hit (pulsing white-amber); ring = the slam warning [amber, red];
    // eye = the live lamp eye; lamp = the small lamps; bell = the collar bell; coin = the coin-core
    // standby = the small red standby lights on its body
    teal: 0x38f0d8, open: 0xffe2a0, ring: [0xffb020, 0xff2a10], eye: 0xfff0c8, lamp: 0xffc070, bell: 0xffd27a, coin: 0xffe9a8, standby: 0xff2a1a,
    // night readability: its own lamps light the paint a little (emissive share of the texture at full night), and fog leaves it alone (fogOff) so the outline always reads
    // (lowered from 0.22 for the ivory paint, owner 20:44: it must read ivory at night, not glow)
    selfLit: 0.1, fogOff: true,
    // the slam boom's scissor: cells, longest link (m), bar width (m); it folds back into the telescope at rest
    scissor: { cells: 9, link: 3.2, bar: 0.16 },
    // poses: how fast the arms follow (1/s); flap = the beckoning wrist swing (radians) and its speed (1/s); look = how far the head turns to follow you (radians)
    follow: 5, flap: 0.35, flapSpeed: 6.5, look: 0.35,
    // the collapse: sag (s) before it falls apart, how far the body tilts (radians), how deep it sinks (m)
    sag: 0.9, tilt: 0.45, sink: 1.2,
    // the halo round the summoning palm (m) and the hit sparks (count, life s)
    halo: 4.5, sparks: 14, sparkLife: 0.5,
  },
  // ---- FALLING PIECES. Desktop: cannon-es (src/physics.js, loaded only on the desktop tier); phones: scripted, cheaper pieces with no collisions.
  // on: master switch; max: most pieces at once; life: seconds a piece is simulated, then it is frozen; fade: seconds after that before it sinks away;
  // g: gravity; friction, bounce: of the pieces on the ground; sleep: speed under which a piece rests
  // gloomScrap: desktop only, a few scrap pieces when an ordinary Gloom is destroyed (scrap = how many); devices: desktop only, a thrown device bounces and rolls to rest
  physics: { on: true, max: 28, life: 6, fade: 25, g: -9.8, friction: 0.6, bounce: 0.22, sleep: 0.2, gloomScrap: true, scrap: 4, scrapSize: 0.14, devices: true },
};
