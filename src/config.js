// ALL tuning numbers live here. Edit by hand. Also exposed as window.CONFIG in the build.
// Numbers marked (guess) are starting values to be tuned by the balance test.
import { BOSS_CONFIG } from './bossconfig.js';
import { IMPACT_SFX } from './impactsfx.js';
export const CONFIG = {
  // THE BECKONER, the final-night boss on ring 5 (owner, Nov 17): every number is in src/bossconfig.js, each with its comment
  boss: BOSS_CONFIG,
  night: { duration: 150, dt: 0.1 },            // seconds of night, sim step
  // Daytime at the house before the night: scavenge crates, set solar collectors in the sunlight, find the cat, then dusk
  // The settlement by day: the ring's six houses on one street. You defend the house you are in at dusk
  town: { cars: 7, gapX: 48, rowZ: 15, boundX: 62, boundZ: 30, speed: 4, doorRadius: 1.0, leaveRadius: 2.0, infoRange: 26, faceAngle: 0.6 },
  day: { duration: 120, bell: 20, carrySlow: 0.55, carryMin: 0.4, lootSpread: [0.4, 2.2], lootSizePow: 0.25, handCharge: 0.2, botStay: 40, startEnergy: 10, cratesPerBP: 0.5, packFood: 2, sunReach: 2.5, collectorBonus: 0.5, collectorGap: 1.2, crateRadius: 0.9 }, // carrySlow: carrying the whole settlement's loot slows your daytime walk by this share (less loot, less slow), never below carryMin of normal speed; lootSpread and lootSizePow: a house's share of the settlement's loot = (openings ^ lootSizePow) x a random factor in lootSpread, so a bigger house is richer only on average and a small house can be the jackpot (pow 1 = strictly by size, 0 = size does not matter); the settlement total stays the same; duration: seconds of daylight for the whole settlement; bell: the dusk bell rings this many seconds before dark; handCharge: energy/s your hand banks anywhere in daylight; botStay: seconds the test bots spend beside their collectors; startEnergy: battery on arrival; packFood: food you carry in; sunReach: a collector must stand this close to a door/window; collectorBonus: if every collector survives to dawn you get this share of the house's essentials again (fewer survivors, less); collectorGap: m between a collector and any other device
  room: { base: 4.8, perBP: 0.45 },                // house half-size in m = base + perBP x breach points / floors
  floorH: 3.2, ladderTime: 1.2, ladderCd: 6, // ladderCd: seconds before the ladder can be used again (an escape, not a merry-go-round)
    // ladder = a timed climb; no shooting, placing, eating or moving on it
 
  levelAt: [9, 20],                                // 9+ breach points: 2 floors, 20+: 3 floors (ring 4+; 18 BP stays at 2 floors to keep the ring curve smooth)
  floorPenalty: 12, zoneRadius: 0.7,               // Gloom prefer targets on their own floor; stair/ladder marker radius
  player: { hp: 100, speed: 4, startEnergy: 40, energyCap: 100, stairCd: 1.2 }, // stairCd: seconds before the player can use stairs again (stops stair-dancing)
  // falling through an open stair or ladder gap in an upper floor (owner Nov 18): dmg = health lost by the fall (0 = none),
  // edge = how far past the gap's rim (m) you must step before you drop, so brushing the rim does not drop you,
  // keepTop = extra room (m) around the stair-top and ladder markers where you take the stairs or ladder instead of falling
  fall: { dmg: 0, edge: 0.15, keepTop: 0.3 },
  cannon: { dmg: 10, rate: 3, cost: 1, range: 14, rayWidth: 0.6,
    eye: 1.6, gloomH: 2.4, headZone: 1.8, panelH: 1.8, // heights in m: a panel covers 3/4 of a Gloom (1.8 of 2.4), so only the head shows over it
    headMult: 2, coverHit: 0.3,
    // shapes (owner Nov 18, "on phone I can't hit Ticks"): what the aimed shot can hit, per kind, measured from the drawn models on both tiers (tools/gloomhitcheck.cjs MEASURE=1; the union of both tiers' boxes,
    // each oval grown until it holds 95% of the drawn points; the Warden's head node is its whole turning torso, so its head is its top 0.65 m):
    // [cx, cz, rx, rz, top] its body as an upright oval tube in the machine's own frame, turned with it (centre, radii across and along, height from its feet; m), then [cx, cz, rx, rz, from, to] its drawn head the same way: a shot through it is a head shot.
    // A Gloom of a kind not listed here uses rayWidth, gloomH and headZone above. Bots shoot with their own hit chance, so this does not change bot results. Per graphics tier (owner Nov 18 12:11: desktop exact, phones lenient):
    shapes: {
      // low: phones, bots and tests: the union of both tiers' drawn models (lenient: a little larger than the phone's own models)
      low: { walker: [-0.02, -0.04, 0.7, 0.54, 2.52, 0.04, 0.1, 0.4, 0.35, 1.8, 2.52], lurcher: [0.04, -0.3, 0.53, 1.03, 2.14, -0.02, -0.87, 0.37, 0.5, 0.88, 2.14], ticks: [0.03, -0.04, 0.92, 0.69, 0.65, 0, -0.46, 0.19, 0.21, 0.22, 0.5], hauler: [-0.33, 0.23, 1.26, 0.89, 2.63, -0.04, -0.01, 0.43, 0.41, 1.78, 2.44], stilt: [0.72, 0.47, 1.34, 1.14, 3.62, 0.03, 0.01, 0.55, 0.4, 2.77, 3.57], lantern: [0.07, -0.36, 0.47, 0.65, 2.51, 0.09, -0.6, 0.5, 0.46, 1.52, 2.33], warden: [0.07, -0.08, 1.15, 1.92, 2.99, 0.07, -0.08, 0.45, 0.45, 2.34, 2.99] },
      // high: desktop, from the desktop models only; used for the charged shot and until a machine's model is drawn (otherwise the live parts below)
      high: { walker: [-0.03, -0.03, 0.69, 0.53, 2.52, 0.04, 0.1, 0.4, 0.35, 1.81, 2.52], lurcher: [0.04, -0.3, 0.53, 1.03, 2.14, -0.02, -0.87, 0.37, 0.5, 0.88, 2.14], ticks: [0.03, -0.04, 0.91, 0.69, 0.65, 0, -0.46, 0.19, 0.21, 0.22, 0.5], hauler: [-0.07, 0.23, 0.88, 0.87, 2.63, -0.08, -0.01, 0.39, 0.41, 1.88, 2.44], stilt: [0.03, 0.47, 0.51, 1.02, 3.62, 0.03, 0.01, 0.51, 0.37, 2.77, 3.57], lantern: [-0.03, -0.36, 0.38, 0.65, 2.51, -0.02, -0.67, 0.35, 0.38, 1.52, 2.33], warden: [0.07, 0.02, 1.15, 1.83, 2.99, 0.07, 0.02, 0.45, 0.45, 2.34, 2.99] } },
    // live (both tiers; desktop: alone, phones: for head shots and as extra body): the plain shot is ray-cast against each machine's triangles as drawn this frame (src/main.js drawnHit). on: switch;
    // minOpacity: see-through parts fainter than this are left out; headShare: head nodes holding more than this share of the machine (by part box volume) are its turning torso (the Warden):
    // then a hit in its top headTop m is a head shot; headR: m round that top band (used by tools/gloomhitcheck.cjs to aim at it)
    // near / cos: only machines within near m, or within the angle of cos from the aim, are measured when you fire (it keeps the cost down)
    live: { on: true, minOpacity: 0.15, headShare: 0.5, headTop: 0.65, headR: 0.45, near: 3, cos: 0.8 },
    // shapePad: m added round each shape (sides and top, not the bottom) because the parts sway as the machines move
    shapePad: 0.05,
    charge: { time: 0.8, dmg: 3, cost: 3, width: 1.4 } }, // hold FIRE this long (s), then let go: damage x, battery x, and the jet is this much wider; it goes through every Gloom on its line                 // headshot damage x2; bots hit covered Gloom this fraction as often (they cannot aim over cover)
  devices: {
    collector: { text: 'fills your Sun while the sun is up. Daylight only.', name: 'Solar collector', cost: 0, hp: 30, chargePerSec: 0.15, max: 3 },  // daytime only: free, charges the battery while the sun is up; dead at night but Gloom still smash it
    turbine: { text: 'makes Sun all night; place it first. At most 2 Sun makers.', name: 'Turbine', cost: 12, hp: 30, energyPerSec: 0.9, max: 2, group: 'power' },
    lance: { text: 'shoots the nearest Gloom it can see through an opening or inside.', name: 'Lance', cost: 8, hp: 30, shooter: true, dmg: 5, rate: 1.2, range: 9, shotCost: 0.5, max: 6 },
    panel: { text: 'a shield across an opening; Gloom must break it to get in. Shoot heads over it.', name: 'Panel', cost: 6, hp: 50, wall: true },
    // the rest of the approved roster (dawnfront-roster-proposal.md). mine is a starting device; the others are Workshop unlocks
    mine: { text: 'floor trap: bursts when a Gloom steps near, hurting all around it.', name: 'Mine', cost: 5, hp: 10, noTarget: true, arm: 1.5, trigger: 1.0, radius: 2.2, dmg: 30, max: 4 },
    twin: { text: 'a Lance with two shots at once; costs more per shot.', name: 'Twin', cost: 20, hp: 30, shooter: true, shots: 2, dmg: 5, rate: 1.2, range: 9, shotCost: 0.9, max: 4 },
    mist: { text: 'weak shots that chill a Gloom and slow it for a while.', name: 'Mist', cost: 12, hp: 30, shooter: true, dmg: 3, rate: 1.2, range: 9, shotCost: 0.5, slow: 0.5, slowTime: 2.5, max: 4 },
    trellis: { text: 'a tall, tough shield; nothing shoots over it, not you and not your Lances.', name: 'Trellis', cost: 10, hp: 95, wall: true, tall: true },
    flask: { text: 'thrown where you aim: one big burst, then it is gone.', name: 'Flask', cost: 20, instant: true, radius: 4, dmg: 40, reach: 3 },
    press: { text: 'kills one Gloom that comes next to it, then needs time to reset.', name: 'Press', cost: 14, hp: 40, reach: 1.5, reset: 8, max: 2 },
    shard: { text: 'floor plate that hurts every Gloom walking over it.', name: 'Shard', cost: 6, hp: 60, noTarget: true, radius: 1.3, dps: 6, max: 4 },
    sling: { text: 'lobs slow, heavy shots over walls and shields.', name: 'Sling', cost: 12, hp: 30, shooter: true, lob: true, dmg: 12, rate: 0.5, range: 12, shotCost: 1.0, max: 3 },
    prism: { text: 'shots fired near it hit harder.', name: 'Prism', cost: 12, hp: 25, radius: 3, boost: 1.5, max: 2 },
    chime: { text: 'calls the Gloom toward it, away from you.', name: 'Chime', cost: 6, hp: 70, pull: 10, max: 2 },
    moon: { text: 'strong Sun at night; counts toward the limit of 2 Sun makers.', name: 'Moon', cost: 22, hp: 30, energyPerSec: 1.1, max: 2, group: 'power' },
  },
  // what you carry into the night: the cannon plus this many device slots; start = devices known from the first day
  groupMax: { power: 2 }, // devices that share a limit: at most two energy makers (turbines and moon panels together)
  loadout: { slots: 3, start: ['turbine', 'lance', 'panel', 'mine'], first: ['turbine', 'lance', 'panel'] },
  ring: {
    bpBase: [14, 12, 10, 9, 8, 7],   // ring 1 houses
    bpPerRing: 2,                      // each further ring adds 2
    mult: [1, 1.5, 2, 3, 4],           // loot multiplier per ring
    km: 10,                            // km per ring step
    gloomStrength: 1.0,              // hp and damage x per ring (flat on purpose; difficulty comes from count and floors)
    countMult: [1, 1.04, 1.1, 1.22, 1.36],   // must rise with the ring
  },
  gloom: {
    hp: 20, speed: 1.4, dmg: 8, cooldown: 1.0, reach: 1.0,
    // maxAlive (OWNER DECISION Nov 20 14:51): most Gloom alive at once on any night, spawns and boss summons wait above it (src/sim.js); set from the Mac fps runs
    maxAlive: 0,
    stairTime: 0.8,                   // seconds a Gloom spends on the stairs between floors (visible and shootable from both floors)
    gloomPerBP: 4.4, tallMult: 0.84, // tallMult: fewer Gloom on 3-floor houses (they are much harder to hold)
    //                 // tuned by bots (see test.js) for the two-floor 14-BP house
    spawnStart: 4, spawnEnd: 130, fullWaveAt: 60, waveMinFrac: 0.4, // a ONE-FLOOR house with fewer than fullWaveAt Gloom packs its waves into a shorter window (never under waveMinFrac of it), so a small house is busy, not empty. Two-floor houses keep the full window (bots: squeezing them made ring 2 a wall)
        // first wave starts, last wave starts
    waves: 5, waveSpread: 8, waveGrowth: 0.8, hpVariance: 0.25, // bursts, later waves bigger
    explodeRadius: 2.0, explodeDmg: 8, // hurts Gloom only
    // The seven machines. share: how often it comes (any numbers). hp, speed, dmg (to you), wall (to panels and devices), reach: each x the base values above.
    // over: a Stilt held at a panel hits a player standing within this many m behind it. hurry / hurryR: a Lantern makes every other Gloom within hurryR m this much faster. minRing: first ring (0 = ring 1) it appears on.
    // kindHp: one factor on all of them, set so the average Gloom is as tough as before the kinds (bots).
    kindHp: 1.03,
    kinds: {
      walker: { name: 'Walker', text: 'the common one. Any device stops it.', share: 38, hp: 1, speed: 1, dmg: 1, wall: 1, reach: 1 },
      lurcher: { name: 'Lurcher', text: 'fast and light. It reaches you first; slow it or block it.', share: 16, hp: 0.7, speed: 1.35, dmg: 1, wall: 0.8, reach: 1 },
      hauler: { name: 'Hauler', text: 'slow and tough. It breaks shields and devices quickly.', share: 10, hp: 1.6, speed: 0.7, dmg: 1.2, wall: 1.5, reach: 1 },
      stilt: { name: 'Stilt', text: 'long reach. Held at a shield, it hits you if you stand close behind it.', share: 10, hp: 0.9, speed: 1, dmg: 1, wall: 0.8, reach: 1.5, over: 1.6 },
      lantern: { name: 'Lantern', text: 'waits outside and makes the others near it faster. Shoot it first.', share: 6, hp: 0.8, speed: 0.85, dmg: 0.6, wall: 0.6, reach: 1, hurry: 1.2, hurryR: 6, hang: 4.5 }, // hang: it stops this many m outside its opening and waits there while other Gloom are still coming
      ticks: { name: 'Ticks', text: 'weak, quick and low to the ground.', share: 15, hp: 0.45, speed: 1.25, dmg: 0.6, wall: 0.6, reach: 1 },
      warden: { name: 'Warden', text: 'rare and very tough, from ring 3 on. Put everything on it.', share: 2, hp: 2.2, speed: 0.6, dmg: 1.3, wall: 1.5, reach: 1.2, minRing: 2 },
    },
  },
  breachDelay: { door: 0, window: 2, gap: 0.5, hatch: 3, upper: 2.5 }, // + upper = extra seconds per floor to climb up // seconds to get through
  loot: { perBP: 1, foodShare: 0.7, minPayoutFood: 1 },
  food: { heal: 20, eatCd: 1 },     // one bite heals 20 HP; eaten food is not brought home
  panelReach: 4.5,
  openingHalf: 1.1,   // shots at a Gloom outside the wall must pass within this many m of a breach opening (no shooting through walls)
  // Hidden lucky cat (jam restriction). Tucked in the far corner behind the crate.
  furniture: { perFloor: 3 }, // upright furniture per floor in the run's houses (sim.furn): the player and the Gloom walk around it
  // BASE PEOPLE (src/people.js; owner Nov 16 "base people movement and face"): Bram, Oko, Pip and the recruits. Motion numbers from docs/muybridge-motion-reference.md. Marla keeps CONFIG.marla.
  // kinds: which build each model walks as (man / woman / child; recruits' genders from their builder seeds). own: per person changes to their gait (stoop = forward bend of an old back, rad).
  // gait.<kind>: cycle = seconds for one full stride (left step + right step; Muybridge: woman 1.0, child 0.65); speed = walking speed (m/s; the leg swing is worked out from it so a planted foot does not slide);
  //   stance = share of the stride a foot is on the ground; knee = knee bend while the foot swings (rad, at a full stride); kneeStance = small knee bend while the foot takes the weight (rad);
  //   arm = arm swing from the shoulder, as a share of the leg swing (men fuller, women small, child almost none); elbow = resting elbow bend (rad); elbowSwing = extra bend when the arm swings forward;
  //   armOut = arms held out from the body (rad; the child's are a little out); track = legs turned in (+, narrow track: woman) or out (-, wide stance: child) (rad);
  //   sway = hips moving over the standing foot (m); roll = the free side's hip drop (rad); twist = pelvis turn with the stride (rad); drop = share of the stance leg's pendulum dip the body makes;
  //   lean = forward lean when walking (rad, below 0 = belly forward); step = time of one pivot step when turning on the spot (s); vary = random change of each step's time (share, a few per cent);
  //   waddle = side-to-side body roll in step (rad, child); headBob = head nod in step (rad, child); headHz / headDamp = the child's own looser head spring (bobs more, settles after the stop)
  // turn: lead = seconds between the head starting, the chest starting and the hips starting (the feet come after); follow = smoothing time of head, chest, hips (s);
  //   stepStart = how far the hips lead the feet before a pivot step starts (rad); predict = share of the hips' coming turn a step takes in advance;
  //   minStep = smallest turn worth a pivot step once the hips have stopped (rad); maxStep = most one pivot step turns the feet (rad); twist / chestTwist / headMax = most the hips turn past the feet, the chest past the hips, the head past the chest (rad);
  //   stepLift = how high a pivot step lifts the foot (thigh rad); stepSway = the hips moving onto the other foot during a pivot step (m); near / far = a villager turns to the player within near m and back after far m;
  //   back = seconds after the player leaves before a villager turns back to their own spot; maxSpeed = fastest turn of head, chest, hips (rad/s)
  // idle: shift = [shortest, longest] seconds between weight shifts; move = seconds a shift takes; hip = sideways hip move (m); roll = hip drop (rad); knee = the free knee's bend (rad);
  //   breath = seconds per breath; chest = breathing chest lift (rad); look = how far the head drifts on its own (rad); slow = seconds of a slow continuous sway, slowShare = its share of the weight shift
  // settle: loose parts as springs, frequency (Hz) and damping (0..1, lower = more swing before they settle): arm (upper arm), fore (forearm), hand, head, lean (the body's forward lean);
  //   inertia = how strongly the forearm and hand are thrown when the upper arm speeds up or slows down
  // walk: blend = seconds to ease between standing and full pace; stopCos = cosine of the bend at which a walker stops and turns on the spot instead; corner = most the feet turn per second while walking (rad/s);
  //   follow = how fast (1/s) the walking body turns after the hips; carrySpeed = pace share while carrying a crate
  // pose: how far the arms come down from the build pose (rad), as Marla's
  // scanFaces: false = the approved faces; true = scan-kit faces for the people listed in scan (owner must approve each one first). scan.<key>: hi = desktop model file, lo = phone model file (art/models_hi, beside index.html)
  // hiMat: desktop scan-face materials and light (src/peoplehi.js, Marla's approach): bump = skin relief strength, skinRough = gloss map multiplier, skinSpec = skin specular, skinTint = colour multiplied on the skin (grey only dims),
  //   (Bram sample 3: skinTint a little less blue than grey, the owner found the desktop skin a little pink; the shared key casts one 512 shadow so nose and brow shade the face in daylight; it sits at eye height, below the hat brim: from above, the brim threw a hard band over the forehead and the hat top burnt white)
  //   sheen = soft skin sheen, env = sky reflection, wrap = how far light wraps past the shadow edge, scatter / scatterCol = the warm band at that edge, eyeRough = eye roughness, cut = hair cut-out edge, hairRough / hairSheen = hair gloss,
  //   ao = how strongly the baked soft shading (tools/people_ao.py) darkens skin, hair, clothes, inside of the mouth; amb / ambHair = share of the sky's soft fill on skin and clothes / on hair; keepOut = stencil number that keeps the contact shading off hair and lashes (same as CONFIG.quality.high.fx.keepOut);
  //   key = ONE warm light shared by all scan-face people, riding with whoever is nearest the player: col, power, reach (m), cone (rad), at = where [their left, up, their front] (m), headY = height it aims at (m),
  //   shadow = shadow map size (0 = no shadow), swap = how much nearer (m) another person must be to take the light over
  //   talk / faceCos (owner Nov 17, Oko and Pip light): the light only moves to a person within talk (m) whom the camera faces (cos of the angle above faceCos); it also lights Oko and Pip (CONFIG.peopleHi)
  people: {
    kinds: { bram: 'man', oko: 'woman', pip: 'child', gen2: 'man', gen3: 'woman', gen5: 'woman', gen6: 'man', gen7: 'woman', gen8: 'woman', gen9: 'man', gen11: 'woman', gen12: 'man' },
    own: { bram: { stoop: 0.07, speed: 1.1 }, gen5: { stoop: 0.05, speed: 1.05 }, gen7: { stoop: 0.05, speed: 1.05 }, gen8: { stoop: 0.05, speed: 1.05 }, gen12: { stoop: 0.06, speed: 1.1 } },
    // (OWNER Nov 20 14:08: walk arms, feet, body unnatural) man / woman: swing knee 0.85 / 0.8 -> 0.62 / 0.6, lean 0.04 / 0.02 -> 0.07 / 0.05, sway, roll, twist up,
    // woman arm 0.32 -> 0.4; motion.heelRise 0.16 -> 0.1, walkCrouch 0.09 -> 0.04; settle.armHz 1.7 -> 3.6 (the arm spring sat near the stride rate and lagged the legs)
    gait: {
      man: { cycle: 1.05, speed: 1.25, stance: 0.6, knee: 0.62, kneeStance: 0.12, arm: 0.75, elbow: 0.22, elbowSwing: 0.25, armOut: 0.05, track: 0.0, sway: 0.026, roll: 0.06, twist: 0.08, drop: 0.55, lean: 0.07, step: 0.5, vary: 0.04 },
      woman: { cycle: 1.0, speed: 1.15, stance: 0.6, knee: 0.6, kneeStance: 0.1, arm: 0.4, elbow: 0.3, elbowSwing: 0.12, armOut: 0.04, track: 0.035, sway: 0.035, roll: 0.075, twist: 0.07, drop: 0.5, lean: 0.05, step: 0.48, vary: 0.04 },
      child: { cycle: 0.65, speed: 0.95, stance: 0.58, knee: 0.9, kneeStance: 0.12, arm: 0.1, elbow: 0.35, elbowSwing: 0.05, armOut: 0.22, track: -0.07, sway: 0.035, roll: 0.06, twist: 0.05, drop: 0.6, lean: -0.03, step: 0.36, stepLift: 0.41, vary: 0.05, waddle: 0.07, headBob: 0.04, headHz: 2.6, headDamp: 0.25 },
    },
    // (gait.child.stepLift: a child lifts its foot higher in a pivot step than turn.stepLift, its legs being short)
    turn: { lead: 0.15, follow: [0.16, 0.2, 0.26], stepStart: 0.4, predict: 0.8, minStep: 0.14, maxStep: 1.15, twist: 0.6, chestTwist: 0.45, headMax: 1.1, stepLift: 0.34, stepSway: 0.02, near: 6, far: 7, back: 2.5, maxSpeed: [5.5, 5.5, 4.5] },
    idle: { shift: [3.5, 6.5], move: 1.4, slow: 7.5, slowShare: 0.35, hip: 0.025, roll: 0.03, knee: 0.14, breath: 4.2, chest: 0.012, look: 0.07 },
    settle: { armHz: 3.6, armDamp: 0.5, foreHz: 3.2, foreDamp: 0.35, handHz: 2.6, handDamp: 0.3, inertia: 0.35, headHz: 2.0, headDamp: 0.5, leanHz: 1.3, leanDamp: 0.55 },
    walk: { blend: 0.25, stopCos: 0.25, corner: 2.2, follow: 5, carrySpeed: 0.85 },
    // motion (tools/humanmotioncheck.cjs measures it):
    // slice: the motion runs in fixed steps of this many seconds (1/120: a 30 or 60 fps frame is a whole number of them, so the motion is the same at both); maxSlices: at most this many per frame (a longer gap is skipped)
    // turnAcc: walking, the body's turn rate changes by at most this many rad/s each second (30 = 1720 deg/s2; no snapped turns at a corner)
    // stepAcc: a pivot step turns the body with at most this angular acceleration (rad/s2; 80 = 4580 deg/s2, under the ~100 rad/s2 legs can give a turn); stepRate: and at most this turn speed
    // (rad/s; 7 = 400 deg/s; marlaRate for Marla, whose head also turns to you meanwhile: 5.5 = 315 deg/s); bigger turns take more steps
    // swingRamp: the swing foot speeds up and slows down over this share of its swing each (0.15: its top speed is 1.18 x its mean; 0.5 would be 2 x)
    // lockRelease: a foot that lifts is let go of its spot over this many seconds; lockSlip: a foot more than this many m from where the leg puts it is let go the same way
    // plantV: above this ground speed (m/s) the feet stand by the walk's own stance phases (below it, standing: both feet, or the one not stepping)
    // heelOff: walking at full stride, the knee bends this many rad as the heel lifts over the last heelOffAt share of a foot's time on the ground (then the swing starts from it)
    // swingLift: walking at full stride, a foot is carried this many m above the ground at mid-swing (from where it left the ground to where it will land); liftMin: share of that a short step still lifts
    // walkLock: true = walking feet are held where they land too (false = they follow the gait's own leg swing, which slides them a little)
    // landAhead: a walking foot lands this share of the ground the body covers during its stance ahead of the hip (the rest is behind it at toe-off)
    // heelRise: at full stride the heel lifts this many m over the end of a foot's stance (heel off, so the leg leaves the ground bent); walkCrouch: m the pelvis is lowered walking,
    // eased in and out over about crouchTime s
    // reachMax: a held foot further from the hip than this share of the leg's length is let go like a lifted one (the knee never snaps from straight)
    // haltV / haltTime: a walk slowing to a stop below haltV m/s with both feet down stops there (the gait does not shuffle on) and loses the rest of its speed in about haltTime s
    // cornerDist: a patrol slows over its last cornerDist m before a waypoint, as much as the coming corner needs (cornerCos: no slowing for a bend gentler than this cos, about 45 deg); wpReach: m from a waypoint at which the next one is taken
    // reseat / reseatLift: standing, a foot let go of its spot moves to where the leg puts it over reseat s, lifted reseatLift m on the way
    // slopeTime: on a footbridge deck the pelvis follows the lower of the ground half a stride ahead and behind over about this many s (smooths the ramps' kinks)
    // deckRise: on a ramp a patrol slows so its body climbs or sinks at most this many m/s; deckLook: it looks this many m ahead for a ramp (its speed takes a moment to come down)
    // deckEase: a walker without a model stepping onto or off a footbridge deck (src/baselife.js) rises or sinks to it at this rate (1/s)
    // stepThigh: a pivot step lifts its foot mostly by bending the knee (turn.stepLift x 2) and brings the thigh forward only this share of turn.stepLift (a knee thrown forward snapped)
    // decideEvery: a pivot step may start only every this many slices (1 = any slice; 4 = only every 1/30 s of game time; 4 measured worse at 30 vs 60 fps in the browser)
    // stepTurn: Marla (src/marla.js) steps round once the way she should face is more than this many rad from where she faces (the base people use turn.stepStart)
    // stepLead: a pivot step's foot lifts for this share of the step before the body turns, and sets down for the same share after; recenter: after pivoting on one foot the body settles back over its middle in about this many s (while stepping or walking)
    motion: { slice: 1 / 120, maxSlices: 30, turnAcc: 30, stepAcc: 80, stepRate: 7, marlaRate: 5.5, swingRamp: 0.15, lockRelease: 0.12, lockSlip: 0.3, plantV: 0.05, stepLead: 0.15, recenter: 0.8, heelOff: 0.35, heelOffAt: 0.3, swingLift: 0.07, liftMin: 0.8, walkLock: true, landAhead: 0.42, heelRise: 0.1, walkCrouch: 0.04, crouchTime: 0.31, reachMax: 1.08, stepTurn: 0.35, decideEvery: 1, stepThigh: 1, deckEase: 10, deckRise: 0.25, deckLook: 1.2, slopeTime: 0.12, reseat: 0.35, reseatLift: 0.06, haltV: 0.45, haltTime: 0.12, cornerDist: 2.0, cornerCos: 0.7, wpReach: 0.6 },
    pose: { armDown: 0.62, elbow: 0.10, elbowFwd: 0.18 },
    // Bram scan face sample 4, approved by the owner 2026-11-17 (scan lists Bram only, so every other person keeps their face; the models carry no face controls, so none is driven in the game)
    scanFaces: true, scan: { bram: { hi: 'models/bram_scan_hi.glb', lo: 'models/bram_scan_lo.glb' } },
    hiMat: { bump: 1.0, skinRough: 0.95, skinSpec: 0.5, skinTint: 0xe6e3d8, sheen: 0.06, env: 0.3, wrap: 0.35, scatter: 0.06, scatterCol: 0xff8068, eyeRough: 0.3, cut: 0.42, hairRough: 0.62, hairSheen: 0.15,
      ao: { skin: 0.6, hair: 0.35, cloth: 0.6, mouth: 0.8 }, amb: 0.55, ambHair: 0.9, keepOut: 1, key: { col: 0xfff0e0, power: 6, reach: 4, cone: 0.4, at: [-0.6, 1.6, 1.3], headY: 1.5, shadow: 512, swap: 0.5, talk: 4, faceCos: 0.8 } },
  },
  // expressions: false = her face stays neutral on every device (owner, Nov 16: neutral only for now; the smile / grin / puzzled shapes were made for her old face and do not move the desktop scan face)
  // marla.lookHz: how fast her head turns to you (a critically damped spring, turns per second of its natural swing)
  marla: { lookHz: 0.6, expressions: false, walk: { stride: 0.42, stance: 0.6, knee: 0.9, arm: 0.7, elbow: 0.25, bob: 0.025 }, // how people walk: stride = leg swing each way in radians, stance = share of the step with the foot on the ground, knee = bend while the foot is in the air, arm = arm swing against the legs, bob = body dip in m
    guide: { x: 2.8, z: 2.4, open: 1.3, rearm: 2.6, wait: 0.6, hintAt: 3, clearDoor: 2.6 }, // wait: you must stand still this long beside her before the swap opens (walking past does not open it); hintAt: her prompt shows only this close; clearDoor: she never stands within this many m (sideways) of a house's door path // by day she stands at this spot on the street; walking within `open` m opens the device swap, and it can open again after you step `rearm` m away
    // lowLamps (R4 worker 11, owner: Marla flat on LOW): low has no key/rim light; her own materials get the medium key spot and rim lamp worked out in their shader
    // (no real light, no shadow). key: [colour, strength, reach m, cone rad, penumbra]; keyAt / rimAt: [x, y, z] in her frame; headY: the key's aim height (m); rim: [colour, strength, reach m]
    lowLamps: { on: true, key: [0xfff2e6, 12, 7, 0.22, 0.6], keyAt: [-0.6, 1.9, 1.6], headY: 1.5, rim: [0xdfe8ff, 1.6, 6], rimAt: [0.8, 2.0, -1.2] },
    pose: { armDown: 0.62, elbow: 0.10, elbowFwd: 0.18 } }, // Marla's model in the base (src/marla.js): how far the arms come down from the build pose, in radians
  // The Gloom's look (src/gloomkit.js has each machine's own numbers in GLOOMKIT). machines: false brings back the hooded Gloom. 
  // dormant: how many stand switched off in the settlement by day.
  // marlaTalk (first night only): streakHits hits within streakWindow seconds make Marla say a sarcastic 'streak' line, at most once per streakCd seconds;
  // on desktop with hints on she reminds that holding H shows the keys, up to hintTimes times, the first hintDelay seconds into the first night (then every hintDelay)
  // rotate: the rotate screen shows on touch devices when the visible height is more than ratio times the width; pollMs: how often that is rechecked (ms)
  rotate: { ratio: 1.05, pollMs: 500 },
  marlaTalk: { streakHits: 3, streakWindow: 8, streakCd: 20, hintDelay: 25, hintTimes: 2 },
  music: { on: true, volume: 0.35, pausedVolume: 0.2, fade: 2.5 }, // which track plays where is set in tools/makemusic.py (base, day, night)
  depth: { wallOut: 0.2, wallLen: 1.3, wallW: 4.6, car: [4.2, 6.6], baseHouse: [8.6, 7.6], basePost: 1.3, baseTree: 3.2, shade: 0.5, shadeNight: 0.34, furn: 2.7, device: 1.5, gloom: 1.9, crate: 1.25, pool: 0.55, poolNight: 0.26, poolSun: 0xffe2a8, poolMoon: 0x7f9cff, poolW: 2.3, poolL: 3.6, doorW: 2.0, doorL: 4.4 }, // light and depth inside houses: soft contact shadows (klad 'shade') under things, light pools (klad 'pool') on the floor at every opening; sizes in metres (shadow sizes are times the thing's radius)
  // shot: the hand cannon's old shot sound (plays only when impact.on is false): pitch drop (Hz), length (s), loudness
  sfx: { shot: { from: 620, to: 150, len: 0.11, vol: 0.1 },
    // impact sounds (owner approved round 2, Nov 18): every value is IMPACT_SFX in src/impactsfx.js, each with its comment line there (docs/sample_impact_sfx.md has the measurements)
    // on: the switch; false turns the impact sounds off and brings back the old shot sound
    impact: { on: true, ...IMPACT_SFX } },
  // every abandoned car is in a different state. rust / dmg are [min, max] (0..1); wheels: 'all' = none missing, 'none' = all four gone, 'one' = one gone, 'some' = random
  carCond: [
    { name: 'parked and dusty', rust: [0.08, 0.2], dmg: [0, 0.12], wheels: 'all' },
    { name: 'sunk on flat tyres', rust: [0.4, 0.55], dmg: [0.2, 0.35], wheels: 'all', flat: true },
    { name: 'stripped, up on blocks', rust: [0.45, 0.6], dmg: [0.6, 0.8], wheels: 'none', blocks: true },
    { name: 'burnt out', rust: [0.2, 0.35], dmg: [0.9, 1], wheels: 'none', sink: 0.2 },
    { name: 'crashed', rust: [0.3, 0.5], dmg: [0.7, 0.84], wheels: 'one', crush: 1.9, skew: 0.5 },
    { name: 'overgrown', rust: [0.85, 1], dmg: [0.3, 0.5], wheels: 'some', sink: 0.1, green: true },
    { name: 'rolled on its side', rust: [0.5, 0.7], dmg: [0.5, 0.8], wheels: 'some', tipped: true },
  ],
  sleepers: { on: true, pace: 0.9, wake: 3.2, chase: 7, speed: 2.3, reach: 1.15, dmg: 15, maxHurt: 45 }, // light sleepers by day: a dormant machine wakes when you pass within 'wake' metres carrying enough to slow you to 'pace' or less; it lurches after you for 'chase' seconds at 'speed' m/s, can hit once ('dmg' health off tonight), then powers down
  // opening cutscene (SAMPLE, played from the title screen button). Times in seconds. town = length of the night street part; base = length of the base part; wake = length of waking up.
  intro: { town: 17, lightsFrom: 1.2, lightsEvery: 0.9, botsAt: 7.5, botSpeed: 0.9, base: 15, wake: 7, fade: 1.1,
    lines: [[0.8, 7.5, 'The grid ran short.'], [8.6, 16.2, 'The machines built to ration power decided who deserved it.'], [18, 24.6, 'The ones who got out built with the sun.'], [25.4, 31.4, 'Small, green, ours.'], [34.6, 38.6, 'MARLA: Up, Potts. Sun is wasting.']] },
  // ---- OPENING CUTSCENE (owner Nov 17 16:25: rebuilt from the game's own 3D world, models and night look, not drawn pictures; src/main.js "opening cutscene").
  //   It plays from the title's "Watch the opening". Any key, click or tap, or the Skip button, ends it at once, and you wake in the base with Marla exactly as after the whole film.
  //   Four parts: grid (the street, the night the grid failed), turning (inside a house: the machines pass the window), dawn (the base at sunrise), wake (your bed, Marla at the door).
  //   Times are seconds from the start. A camera path is a list of keys [t, x, y, z, lookX, lookY, lookZ], eased (smoothstep) from key to key.
  //   Parts 1 and 2 are placed against the TARGET WINDOW (a ground-floor window facing the street, of the house nearest the street's middle with room inside):
  //   there x = metres along the wall (to your right as you face the house from the street), y = height, z = metres out from the wall (negative = inside the house).
  //   Parts 3 and 4 use the base's own metres (x, y, z).
  opening: {
    // on: the new opening (false = the old sample, CONFIG.intro, kept until the owner approves this one)
    on: true,
    // seed: the street it is filmed in (the run's seed, ring 1)
    seed: 4242,
    // parts: start of each part [grid, turning, dawn, wake] and the end of the film (s); owner 17:00: about 45-75 s as first briefed (the advisor's 40 s cap is not used)
    parts: [0, 17, 31, 47, 58],
    // fade: seconds of fade from / to black at each part's start and end
    fade: 1.2,
    // grace: seconds after the start in which a key, click or tap does not skip (the click on the title button itself)
    grace: 0.6,
    // lines: captions [from s, to s, text]; a line starting "MARLA:" is drawn as her speech (her first line, as in the sample)
    //   (owner 16:55, "The panel-tender" in docs/gdd.md: a panel-tender always works in a pair with a guide; Ashley's guide is Marla: the line before she speaks)
    lines: [[1.5, 7.6, 'The night the grid failed, the machines came looking for power.'], [21.0, 27.5, 'They found us.'],
      [33.0, 38.6, 'We left the grid to them, and grew our own light.'], [39.6, 45.4, 'By day they sleep. We let them.'], [47.4, 51.2, 'Every panel-tender gets a guide. You got Marla.'],
      [51.6, 56.8, 'MARLA: Up, Potts. Sun is wasting.']],
    // GRID (part 1). cam: camera keys (window frame)
    grid: { cam: [[0, -17, 2.8, 8.6, -6, 2.0, 6.0], [8.5, -8.5, 2.3, 8.6, 0, 1.7, 4.2], [17, -1.8, 1.75, 6.9, 0.9, 1.5, 2.6]],
      // night: the sky (0 day .. 1 full night: the game's own night look)
      night: 1,
      // winOff: lit windows going dark [first at s, one more every s, seconds of flicker before each]; warm: their light colour; glow: size (m) of the glow outside a window
      winOff: [2.6, 0.2, 0.7], warm: 0xffd08a, glow: 3.0,
      // targetOff: when the target window's warm light dies (s); device: then the green glow of a device behind it [colour, glow size m]
      targetOff: 12.4, device: [0x7fffb0, 1.6],
      // lamps: street lamps [per side, spacing m, distance from the street's middle m, height m]; lampOff: [first dies at s, one more every s, seconds of flicker]; lampColor: their light
      lamps: [4, 14, 5.4, 4.3], lampOff: [4.2, 0.55, 0.9], lampColor: 0xffc27a,
      // lampLight: a real light under each of the nearest lamps on desktop [strength, reach m] (phones: glow only)
      lampLight: [9, 13],
      // lampClear: no lamp stands within this many metres of the camera's last spot (a pole filled the frame)
      lampClear: 3.5,
      // machine: the Gloom that wakes [kind, x, z (window frame), turn at the start (rad; 0 = facing the window, 3.14 = its back to it)]
      machine: ['walker', 1.5, 3.7, 2.7],
      // wakeAt: its screen starts to flicker (s); flick: seconds of flicker before it is awake; turn: [start s, seconds, jerks] it turns to the window in
      wakeAt: 9.2, flick: 1.1, turn: [12.6, 3.6, 5],
      // rim: a cold back light on the waking machine so its outline reads in the dark, both tiers [colour, strength, reach m, x, y, z from the machine (window frame)]; on from wakeAt
      rim: [0xa8c8ff, 7, 6, 0.6, 2.7, -1.3],
      // screenGlow: a soft glow sprite on every awake machine's screen in the film [size m, opacity] (phones have no screen lights)
      screenGlow: [0.9, 0.55] },
    // TURNING (part 2). cam: camera keys (window frame, inside: z negative); sway: handheld drift [metres, cycles per second]
    //   crouched low under the window, so the desktop blind (it hangs half down) does not cover the machines' screens (owner review Nov 17)
    turning: { cam: [[17, 0.45, 0.98, -1.35, 0.0, 1.6, 3.0], [31, 0.2, 1.02, -1.15, -0.2, 1.65, 3.0]], sway: [0.02, 0.33],
      // walkers: machines passing the window [kind, start s, speed m/s, z (m out from the wall), from x, to x, stop at x (null = no stop), stop s, phones too (1 / 0)]
      walkers: [['ticks', 17.4, 1.2, 2.4, -4.5, 9, null, 0, 0], ['walker', 18.0, 0.85, 1.8, 5.5, -8, 0.1, 2.6, 1], ['stilt', 21.5, 0.85, 2.8, -6, 9, null, 0, 1], ['lantern', 24.0, 1.0, 3.6, 6, -9, null, 0, 1]],
      // device: the glowing device on the floor [kind, x, z (window frame), turn rad]; light: its glow on desktop [colour, strength, reach m] (phones: the glowing parts only)
      device: ['collector', -1.35, -0.75, 0.6], light: [0x7fffb0, 3, 4],
      // hands: your hands in view, the ring glowing at this share of a full Sun (0 = hidden)
      hands: 0.5 },
    // DAWN (part 3). cam: camera keys (base metres): from the waterwheel, up over the roofs, across the plaza toward the hatchery
    dawn: { cam: [[31, 3.2, 1.6, -23.2, 8, 1.4, -17.7], [37.5, 2.4, 7.2, -15.5, 6, 0.6, -6.5], [43, -3.5, 11.5, -6.5, 3.5, 0, 6.0], [47, -5.5, 12.5, -1.5, 5, 0, 11]],
      // sun: [colour at the start, colour at the end, strength share at the start, at the end] of the base's sun; hemi: share of the base's sky light [start, end]
      sun: [0xff9a5a, 0xffe6c0, 0.55, 1.0], hemi: [0.4, 1.0],
      // hemiCol: colour of the sky light [start, end] (warm at sunrise, the base's own at the end)
      hemiCol: [0xffb47e, 0xfff4e2],
      // sky / fog: background and fog colour [start, end]; fogNear / fogFar: m; exposure: share of the base's picture brightness [start, end]
      sky: [0xf2b08c, 0xcde6ee], fog: [0xf0c0a0, 0xf6e8c8], fogNear: 30, fogFar: 95, exposure: [0.72, 1.0] },
    // WAKE (part 4). bed: lying in bed [x, y, z, pitch, yaw, roll]; stand: where you stand at the end [x, y, z] (looking at Marla); rise: [after s, over s] you sit up and stand
    //   (owner review Nov 17: Marla in the doorway 2-3 m from the bed, from about the waist up, facing you; no labels; no plant in front of the camera)
    //   stand: where you stand at the end [x, y, z]; look: the height you look at on Marla (m, her chest); fov: the camera's view angle there (degrees; 75 in play, narrower frames her from the waist up)
    //   hide: [x, z, radius m] phone-tier pieces near the line of sight that are hidden for the shot (the potted plant just inside the door, right of the doorway since Nov 18)
    //   (second review: the camera stands back on the door's line so the door frame shows on both sides of her; was [-1.0, 1.7, -9.3] at 32 degrees)
    //   waitModels: up to this many seconds the wake waits, eyes still shut, for the people in the base to swap their plain stand-in figures for their models; any still on a stand-in is hidden for the film
    wake: { bed: [-2.3, 0.95, -9.7, 1.15, 0.4, 0.5], stand: [0.0, 1.7, -10.6], look: 1.42, fov: 30, hide: [0.9, -7.95, 0.6], waitModels: 6, rise: [2.2, 3.2],
      // lids: eyelid keys [s after the part's start, how closed 0..1]: a slow first open, two blinks
      lids: [[0, 1], [0.8, 1], [1.6, 0.45], [1.9, 0.95], [2.3, 0.9], [2.9, 0.25], [3.15, 0.7], [3.6, 0.04], [6.5, 0], [6.7, 0.9], [6.95, 0]],
      // blur: [px of blur on waking, gone after s] (desktop only)
      blur: [5, 3.6] },
    // phones (low tier): cheaper versions of the same shots: lit windows at most, street lamps per side, no lamp or device lights, only the walkers marked for phones
    low: { windows: 14, lamps: 3, lights: false }, high: { windows: 40, lamps: 4, lights: true },
  },
  render: { relief: true, reliefPower: 1.0, tone: true, exposure: 1.55, exposureNight: 1.05 }, // relief: surface relief maps on klad-textured things (turn off if a phone is slow); tone: film-like light response, exposure = overall brightness // edge smoothing, sharpness cap, shadow size, texture size and the other detail settings are per graphics tier: see quality below
  // GRAPHICS TIERS (2026-11-15; user: "it is reasonable for mobile to be less detail but on desktop and laptop details and texture cannot skim"). One tier is picked at start (src/quality.js):
  // phones (primary pointer coarse) get `low`, which is exactly the phone settings from before tiers; desktops and laptops (primary pointer fine, touch laptops included) get `high`.
  // Override: ?quality=high or ?quality=low in the address, or the Graphics link on the title screen and in the pause menu (kept in localStorage, applied by reloading).
  // pixelRatio: sharpness cap (screen pixels per page pixel); smooth: edge smoothing (anti-aliasing); shadowMap / baseShadowMap: sun shadow map size in the settlement / in the base;
  // shadowSoft: blur of shadow edges in shadow-map texels (1 = the plain filter); aniso / reliefAniso: sharpness of the colour / relief textures on surfaces seen at a slant (the GPU's own limit caps it);
  // hiTex: load the 1024 px painted surfaces, full-size relief maps and sharper decals and plant cards from tex/ beside index.html (the 512 px set inside the page is used until they arrive, and if they fail);
  // lights: machine screens that throw real light at night (shed one by one when frames stay slow); grassMore: extra grass tufts on top of world.tufts; leafMore: extra leaf cards per leaf spray (3 each before);
  // skyDetail: cloud noise layers to start with (2 to 6, lowered by the game when frames are slow); round: segment multiplier for round parts (wheels, machine joints and drums, pipes, rings), capped at roundMax; machineTris: triangle budget per machine (checked by tools/gloomcheck.cjs)
  // DESKTOP MARLA (src/marlahi.js; high tier only). files: her desktop model per character key (beside index.html). Skin: bump = strength of the pore and lip relief, skinRough = gloss map multiplier (lower = shinier),
  // skinSpec / skinEnv = how strongly skin reflects lights / the sky, sheen = soft glancing highlight, wrap = how far light wraps past the shadow edge (0 = hard edge), scatter + scatterCol = the warm red band at that edge.
  // TARGET (owner's pick 18): the render /home/claude/marla/out_scan/e_neutral_face_v3_fast.png, cheek red/green 1.21, blue/green 0.92 (tools/cheekmeasure.py). Tints stay NEUTRAL GREY (they only dim): a warm skin tint pushed her to 1.36 / 0.84 (orange). Key: soft, slightly cool, from her front-left; rim from behind her right.
  // browCards: show the brow hair cards over the brow painted in her skin picture (off: some hairs sat under the scan skin and the rest read as dark specks; the painted brow alone is clean).
  // crinkle: show the grin's eye-crinkle lines mesh (dark specks at the outer brow ends when the face is neutral; off while expressions are off).
  // skinTint / hairTint / clothTint: colour multiplied onto skin / hair / clothes and leather (white = as painted; the desktop surfaces take more sky light, so untinted she came out pale and washed). browCut: cut-out threshold of the brow hairs (lower = thicker hairs), browLift: brow hairs moved forward off the skin (m). hairEnv: sky light on hair. metalRough: roughness of her bare metal by material name (earrings, buckles). enamelRough / enamelEnv: teeth gloss and sky reflection.
  // Eyes: corneaRough (0 = mirror), eyeEnv = sky reflection in the cornea, eyeRough = the eyeball under it. Hair: cut = cut-out threshold, hairRough, hairSheen. key / rim: [colour, strength, reach m] of the two lights that ride with her; keyAt / rimAt: where (her right, up, her front) in metres.
  // peopleHi (owner Nov 17: Oko and Pip get the desktop light and material treatment that fixed Marla's flat look, no new faces; high tier only, phones unchanged): src/peoplehi.js with these numbers.
  //   on = switch; files = desktop copies of their approved models with baked soft shading (tools/marla_ao.py, 64 rays, skin ignores the hair); ao = how strongly that shading darkens skin, hair, clothes,
  //   inside of the mouth; amb / ambHair = share of the sky's soft fill on skin and clothes / on hair; skinTint = colour multiplied on the skin; sheen = soft skin sheen; wrap = how far light wraps past the
  //   shadow edge, scatter / scatterCol = the warm band there; skinRough / skinSpec / env = skin gloss, specular and sky reflection; bump = relief strength (their models have no relief map);
  //   eyeRough = eyeball roughness; corneaScale / corneaRough / eyeEnv = the additive cornea shell (size against the eyeball, gloss, sky reflection); cut = hair and lash cut-out edge;
  //   hairRough / hairSheen = hair gloss; hairShadow = hair casts shadows (false: no self-shadow on the hair); keepOut = stencil number keeping the desktop contact shading off hair (= fx.keepOut).
  //   The warm key is the one shared with Bram: CONFIG.people.hiMat.key, shadow bias CONFIG.marlaHi.keyBias.
  //   First pictures (Nov 17 10:42): Marla's hair sheen 0.18 and full hair specular turned Oko's black hair grey and Pip's red hair pale, the skin sheen drew a pale rim along the jaw,
  //   and the cornea at Marla's sky reflection 1.8 laid a grey film over the whole iris; hairSpec = hair specular strength (1 = default), so those are cut here.
  //   Second pictures (10:54): the irises still read silver: the eyeball's own clear coat mirrored the sky under the cornea, so eyeCoat = the eyeball's clear coat (the cornea gives the highlight).
  //   Third pictures (11:09): still a bright sky band across the irises, so eyeballEnv = the eyeball's own sky reflection, and the cornea's sky reflection (eyeEnv) is cut to a trace: its highlight comes from the lights.
  //   Main-session review (11:15): Oko's eyes still read as silver discs and her hair greyish: corneaSpec = the cornea highlight strength (halved), ambHair cut toward Marla's, own.<who> = values for one person
  //   only (Oko's hairTint darkens her hair back to dark brown).
  peopleHi: { on: true, files: { oko: 'models/oko_hi.glb', pip: 'models/pip_hi.glb' }, ao: { skin: 0.6, hair: 0.35, cloth: 0.6, mouth: 0.8 }, amb: 0.5, ambHair: 0.6, skinTint: 0xe6e3dc, sheen: 0.02,
    wrap: 0.35, scatter: 0.06, scatterCol: 0xff8068, skinRough: 0.95, skinSpec: 0.5, env: 0.3, bump: 1.0, eyeRough: 0.45, eyeballEnv: 0.08, corneaScale: 1.03, corneaRough: 0.03, eyeEnv: 0.1, corneaSpec: 0.5, cut: 0.42, hairRough: 0.62,
    hairSheen: 0.03, hairSpec: 0.25, eyeCoat: 0, hairShadow: false, keepOut: 1, own: { oko: { hairTint: 0x9a8c84 } } },
  // marlaHi.ao: how strongly the baked shading (tools/marla_ao.py, vertex colours in marla_hi.glb) darkens skin, hair, clothes and the inside of the mouth (0 = off, 1 = full)
  // marlaHi.amb: how much of the sky's soft fill light reaches her skin and clothes (1 = all, as everything else); ambHair: the same for her hair (the top of her head faces the sky; cut to half it read dark and dirty); key: [colour, strength, reach m] of the light that rides with her
  // marlaHi.hairUnder: the darker hair layer behind her strands (src/marlahi.js hiHair): cut = how loosely its cards are cut (lower = fuller), shade = its colour times this, shrink = how far it is pulled toward her head, ao = its baked shading, tint = its colour cast (warm, like the darker inner hair in the pick-18 render), top = share of the hair's height from the crown down with no under-layer; hairShadow: whether her hair takes cast shadows (off: the cards shadowing each other striped the top of her head dark); hairA2C: soft see-through strand edges by multisampling (true) or solid cut strands (false; the soft edges let the scene show through her side hair)
  marlaHi: { ao: { skin: 0.6, hair: 0.35, cloth: 0.6, mouth: 0.8 }, amb: 0.5, ambHair: 0.9, hairUnder: { cut: 0.08, shade: 0.85, tint: 0xf0e2c8, shrink: 0.012, ao: 0.3, top: 0.2 }, hairA2C: false, hairShadow: false, keepOut: 1, files: { marla: 'models/marla_hi.glb' }, bump: 1.0, skinRough: 0.95, skinSpec: 0.5, skinEnv: 0.3, skinTint: 0xe4e4e4, sheen: 0.06, sheenRough: 0.45, sheenCol: 0xffffff, wrap: 0.35, scatter: 0.06, scatterCol: 0xff8068,
    corneaRough: 0.03, eyeEnv: 1.8, eyeRough: 0.3, cut: 0.32, browCut: 0.22, browLift: 0.003, browCards: false, crinkle: false, hairRough: 0.62, hairSheen: 0.18, hairSheenCol: 0xfff0d8, hairEnv: 0.12, hairTint: 0xfff2dc, clothTint: 0xeaeaea, metalRough: { metal: 0.22, pewter: 0.42 }, enamelRough: 0.3, enamelEnv: 0.5,
    // smile (owner approved Nov 16 23:29; Nov 17 test in the game's light: no strength read as a warm smile, so it is OFF and only the new neutral shows): the closed-mouth smile (morphs expr_smileClosed / expr_smileClosedSym in marla_hi.glb) while she talks to you, desktop only; phones keep CONFIG.marla.expressions
    smile: {
      // on: drive the closed smile on the high tier (off: neutral face on desktop)
      on: false,
      // strength: morph weight at the full smile (1 = the approved 100% render; 0.4 = the least smirk-like in the game test)
      strength: 0.4,
      // easeIn: seconds to ease into the smile
      easeIn: 0.3,
      // easeOut: seconds to ease out of it
      easeOut: 0.3,
      // sym: 0 = her left side about 9% stronger (expr_smileClosed), 1 = both sides equal (expr_smileClosedSym), between = a blend
      sym: 1 },
    key: [0xfff2e6, 16, 7], keyShadow: [1024, 0.35, 3], keyBias: [-0.0015, 0.012], headY: 1.5, keyAt: [-0.6, 1.9, 1.6], rim: [0xdfe8ff, 1.6, 6], rimAt: [0.8, 2.0, -1.2] },
  // desktop mouse look. sens: how far the view turns per pixel the mouse moves (radians).
  // fakeLockWhenAutomated (memfix Nov 18): in a browser driven by a test tool (navigator.webdriver) the game pretends to hold the pointer instead of asking the browser,
  // because the headless test browser grows by 1-3.5 GB while it really holds the pointer and is killed (measured: blank page +1.1 GB; game on high +3.4 GB; headed browser +0.3 GB).
  mouse: { sens: 0.0022, fakeLockWhenAutomated: true },
  // CLOCK IN HOURS (owner, Nov 16: "game time is second but use hour for player, same as time till dawn"). The game still counts seconds (day.duration, night.duration); the player sees in-world hours.
  // dayHours: in-world hours the whole day stands for (12 = 06:00 to 18:00), shown as "Daylight left"; the bell (day.bell seconds before dark) then reads 2h.
  // nightHours: in-world hours the whole night stands for (12 = 18:00 to 06:00), shown as "Dawn in".
  // step: minutes the shown time moves in (10: it changes every 10 in-world minutes, about every 1.7 s by day and 2.1 s by night, so the text does not flicker); always rounded up, so it reads 0m only at the very end.
  clock: { dayHours: 12, nightHours: 12, step: 10 },
  // WAKING A DORMANT MACHINE BY DAY (owner, Nov 16: "night time to have more gloom"). Shooting one, bumping into one, or passing one with a heavy pack (CONFIG.sleepers) wakes it, and it remembers you tonight.
  // wakeExtra: Gloom added to tonight's night for each machine woken (each machine counts once); wakeMax: the most Gloom waking can add to one night in all.
  // when: [from, to] share of the night's spawn window (gloom.spawnStart to gloom.spawnEnd) in which the extra ones arrive, spread at random.
  // stir: seconds a shot or bumped machine stirs (it does not attack by day); shake: how far it shakes (radians); shakeHz: shakes per second; flick: screen flashes per second while it stirs; lit: screen brightness of a flash (0 dark to 1 full).
  // touch: metres beyond its body radius that count as bumping into it; shotReach: farthest a day shot wakes one (metres); shotCos: how straight you must aim at it (cosine of the angle off the crosshair).
  dormant: { wakeExtra: 2, wakeMax: 8, when: [0.25, 0.9], stir: 1.4, shake: 0.06, shakeHz: 7, flick: 14, lit: 0.6, touch: 0.08, shotReach: 18, shotCos: 0.985 },
  // DESKTOP INTERFACE 2 (owner approved the mock-up docs/sample_title_hud_mockup.png on Nov 16). Only with a mouse or trackpad (pointer: fine); phones keep their layout. main.js puts these on the page as CSS variables (--h2-...) at load.
  // day: frames by day (brass): line = frame edge, ring = thin outer ring, bg / bg2 = frame fill top / bottom (with alpha), label = small uppercase labels, text = main text, dim = second lines, big = clock digits, sel = the picked slot's edge and glow.
  // night: the same at night (cold steel blue). tag: the green "dormant" tag (edge, label, text). warn: red (the dusk bell, the off-screen arc).
  // hp / sun / bat: bar fills [top, bottom] for health, sun charge (day) and battery (night); barBg: empty bar.
  // px: gap = frames' distance from the screen edge; vitW = width of the health / charge frame; slot = device slot width, slotH = its height; ic = device picture size in a slot; phoneIc = picture size on a phone button;
  //     face = Marla's portrait size; marlaW = widest Marla frame; big = clock digit size; lab = label size; vig = night edge darkening blur, vigS = its spread.
  // vigA: night edge darkness (0 none to 1 black). phoneIcA: how strongly the picture shows behind a phone button's words (0 to 1).
  // arc: red arc round the crosshair toward the nearest awake machine that is off screen (desktop only): r = radius px, w = line px, span = arc length (degrees), off = how far off the crosshair (cosine) before it shows.
  hud2: {
    day: { line: '#b08a4a', ring: '#5d4a26', bg: '#141a17e6', bg2: '#0c110fe6', label: '#b9a06a', text: '#e9dcb4', dim: '#8a7a52', big: '#ffe9a8', sel: '#ffd978' },
    night: { line: '#7a8ea0', ring: '#2c3a46', bg: '#10171ce6', bg2: '#0a0f13e6', label: '#8fd0ff', text: '#dfe9f1', dim: '#7d8fa0', big: '#dff1ff', sel: '#9fdcff' },
    tag: { line: '#39d98a', label: '#39d98a', text: '#cfeee0' }, warn: '#e2573c',
    hp: ['#e2573c', '#9c2a1c'], sun: ['#ffd978', '#c98a1e'], bat: ['#8fd0ff', '#2f6f9c'], barBg: '#201a12',
    // panel fix (Nov 17): slot 64 -> 76 and slotH 78 -> 90 (name, cost line and count badge at 13 px), lab 11 -> 13 (the smallest desktop text)
    px: { gap: 22, vitW: 250, slot: 76, slotH: 90, ic: 40, phoneIc: 52, face: 56, marlaW: 380, big: 26, lab: 13, vig: 220, vigS: 60 }, vigA: 0.8, phoneIcA: 0.75,
    arc: { on: true, r: 75, w: 2, span: 70, off: 0.6 },
    // offline pictures (tools/hud2art.cjs, run once; the game only shows the finished pictures in src/deviceicons.js and src/titleart.js):
    // iconPx = device picture size, iconQ = its WebP quality, iconPad = room round the device (1 = touching the edge);
    // bandW / bandH = the title machines picture before cropping, bandHalfW = metres seen either side of the middle at depth 0, camDist / camY = camera distance and height (m);
    // shape = machine colour (near black), scrBg / scrEdge / scrInk = sleeping screen fill, edge and text, scrGrow = lit screen size against the real screen, scrMinW / scrMinH = smallest lit screen (px), redLed / ledR = standby light colour and radius (px);
    // place = [kind, x m, depth m, turn rad, screen text ('|' breaks the line, '' none)]
    art: { iconPx: 128, iconQ: 0.85, iconPad: 1.12, bandW: 1600, bandH: 700, bandHalfW: 6.6, camDist: 16, camY: 1.4, shape: 0x060807, scrBg: '#06140d', scrEdge: '#1f6a45', scrInk: '#39d98a', scrGrow: 1.3, scrMinW: 58, scrMinH: 34, redLed: '#e2452f', ledR: 3.5,
      place: [['walker', -5.2, 0, 0.25, 'POWER|SAVER'], ['stilt', -3.7, 3.5, 0.1, 'WAKE AT|DUSK'], ['ticks', -2.6, -1.5, -0.3, ''], ['hauler', 2.9, 1.5, -0.2, 'POWER|SAVER'], ['lantern', 4.5, 3.2, -0.15, 'WAKE AT|DUSK'], ['lurcher', -1.9, 0, 0.5, ''], ['warden', 5.4, 1.6, -0.35, 'POWER|SAVER']] },
  },
  // TITLE SCREEN (owner lore, Nov 16: the grid died, the machines came for us, they sleep by day to save power). Drawn as one picture (main.js titleSvg) in a 1280 x 720 frame that is cut to the screen from the bottom up.
  // sky: dusk colours top to bottom with their stops (0 top, 1 horizon line); glow: the last sun behind the house (colour, strength 0-1); ground / house: dark shapes; win: the two lit windows;
  // feetY: where the machines stand in the 1280 x 720 frame; houseX / houseW / houseY: house middle, width and wall top; hill: ground line heights left to right (frame px, 8 points evenly across).
  // word: title letters (colour, glow colour, size px desktop, size vw on narrow screens); line: the lines above and below it (colour).
  title: { sky: ['#06090b', '#0d1a1c', '#3a2a18', '#c4722a', '#f0b25a'], stops: [0, 0.45, 0.78, 0.92, 1], glow: ['#ffd27a', 0.55], ground: '#070a09', house: '#050706', win: ['#ffc65c', '#ffb347'],
    feetY: 652, houseX: 640, houseW: 160, houseY: 486, hill: [640, 604, 626, 598, 618, 592, 620, 600],
    word: ['#f0c66a', '#c4722a88', 104, 11], line: ['#cdbb8c', '#b9a06a', '#8a7a52'] },
  quality: {
    // LAG FIX Nov 19 (owner approved): pixelRatio 2 -> 1.25 (the automatic step-down, CONFIG.lag.step, can take it to 1); sun shadow maps 4096 -> 2048 with shadowSoft 2.5 -> 1.25,
    // the same blur width in metres as before; lights (machine screens that throw real light) 6 -> 3, the three nearest machines, always in the scene so no shader is rebuilt at night;
    // aniso / reliefAniso 16 -> 4 (owner's rule Nov 19: anisotropy 4 at most; the hard-coded 8s in the builders are 4 too)
    high: { pixelRatio: 1.25, smooth: true, shadowMap: 2048, baseShadowMap: 2048, shadowSoft: 1.25, aniso: 4, reliefAniso: 4, hiTex: true, lights: 3, grassMore: 420, leafMore: 2, skyDetail: 6, round: 2, roundMax: 64, machineTris: 60000,
      // fx: the desktop picture pass (src/fx.js). ao: strength of the contact shading, aoRadius: how far it reaches (m), aoSamples: quality (LAG FIX Nov 19: 16 -> 8, at half size)
      // keepOut: stencil number of pixels the contact shading leaves alone (Marla's hair, CONFIG.marlaHi.keepOut; keep both the same; 0 = off)
      // aoScale: size of the contact shading pass as a share of the screen (0.5 = half width and height, a quarter of the pixels; the shading is soft, so it is scaled up smoothly);
      // aoFar: things whose nearest point is farther than this (m) are left out of the shading pass (at that distance the 0.6 m shading is a few pixels wide and the fog is on it)
      fx: { ao: 0.8, aoRadius: 0.6, aoSamples: 8, keepOut: 1, aoScale: 0.5, aoFar: 45 },
      // car: the master build of the abandoned cars (src/carhi.js). paint: [roughness, metalness, clear coat, clear coat roughness] (the clear coat thins with rust), chrome: [roughness, metalness], glass: [roughness, opacity, sky reflection],
      // holes: rust-through holes [fewest, most] by how rusty the car is, holeSize: their size in cut-out-picture pixels [min, max], holeBand: how high up the body they sit [from, to] as a share of the paint picture's height, ajar: chance a door hangs open, shards: glass shards left in a broken window, treadBlocks: blocks round each tyre (3 rows), leaves: dead leaves on it,
      // tint: colour multiplied onto the paint picture (the desktop surfaces take more sky light; untinted the cars came out paler and greyer than on the phone), nose: how far the shell's rounded nose and tail stand past the car's nominal length (m; lamps, grille and bumpers sit on it).
      // bodyBevel / bodyCurve: smoothness of the shell's edges and arches. detail: what exists at this tier (a phone setting is this block dialled down): doors (separate door and bonnet skins), holes, seals (rubber round the glass), interior, tread, underside.
      car: { paint: [0.6, 0.2, 0.4, 0.35], tint: 0xd2c8bc, nose: 0.09, chrome: [0.25, 1], glass: [0.06, 0.55, 2.2], holes: [3, 10], holeSize: [4, 11], holeBand: [0.3, 0.42], ajar: 0.12, shards: 5, treadBlocks: 36, leaves: 30, bodyBevel: 5, bodyCurve: 20, detail: { doors: true, holes: true, seals: true, interior: true, tread: true, underside: true } },
      // gloom: the desktop builds of the seven machines (src/gloomhi.js). plate: thickness of a casing plate (m), seam: open gap between plates (m), bevel: edge bevel of blocks (m), bolt: bolt head radius (m), boltLost: chance a bolt is gone,
      // missing / bent: chance that a casing plate is gone (a wire hangs out) / hangs bent, bend: how far (rad). recess: how deep a display sits behind its glass (m). round: segments of round parts. links: track links per Warden track. bristles: per Tick brush skirt.
      // Surfaces as [roughness, metalness]: paint, chip (bare steel where paint is chipped or scratched), steel, chrome (ram rods), rubber, under (the dark core under the plates); glass: [roughness, opacity, sky reflection].
      // mapSize / chips / scratches / grime: the painted gloss-and-metal picture (pixels, counts). cables: cables per run, hang: loose hanging wires [min, max], moss: moss clumps [min, max], mossLumps: lumps per clump, leaves: dead leaves times the phone count.
      // markTries / markFace: painted dirt, rust and soot marks go on a plate face of at least markFace (twice its area, m2), found in at most markTries tries.
      // detail: what the master machine builder makes at this tier (DESKTOP PRIORITY: a phone setting is this block dialled down): bolts, cables, plates (off = each casing one block), rams (hydraulic rams on limbs), fittings (vents, handles, lamps), growth (moss, leaves), bellows: rings per joint boot, tread: bars per sole.
      // cavity: space between the plates and the core (m), seen through seams and where a plate is gone (ribs and wiring stand in it). boltGap: spacing of the rivets along plate edges (m; 0 = corner bolts only). dent: [chance a plate is dented, depth m].
      // edgeWear: share of plates whose bevelled rim is worn to bare steel, edgeTint: that steel's colour. mudTint: dried mud lumps. chromeTint / chromeEnv: colour of polished rods and how much sky they mirror (pure mirror read as white tubes).
      // ram: [cylinder, rod] length as a share of the ram's length at rest (the rod slides in the cylinder as the joint bends). bulb: glow of a lamp's element. lens: lamp glass [roughness, opacity, sky reflection]. marks: painted dirt count times the CONFIG.desolate grime counts.
      // paintLift: the service paint colour times this on desktop (the sky light and the darker steel, rubber and core parts around the plates made the colours read duller than on the phone).
      // tris: triangle budget of one desktop machine (machineTris above is the same number, read by tools/gloomcheck.cjs). detail also has interiors (ribs and wiring under missing plates), dents, marks (painted dirt and mud lumps), glass (display panes and lamp lenses).
      // halo: the glow in front of a lit display [size in screen widths, strength]. machineTris above is the triangle budget tools/gloomcheck.cjs holds these to.
      // models: kinds drawn from their Blender model (src/gloomglb.js, art/models_hi/gloom_<kind>_hi.glb; false = drawn by this builder, which also stands in while the model loads);
      // models.tint: how strongly each machine's own paint shade (desolate.walker.paints hue / sat / light spread) colours the model's painted parts (1 = the builder machines' spread).
      // models.walker: the Walker from its Blender model, v2 (dirty), APPROVED by the owner on Nov 16 (20:22).
      // models.lurcher: the Lurcher from its Blender model (curved, dirty), APPROVED by the owner on Nov 16 (20:22).
      // models.hauler: the Hauler from its Blender model (v2: industrial, olive drab), approved by the coordinator on the owner's standard, 2026-11-17.
      // models.stilt: the Stilt from its Blender model (v2: industrial, off-white enamel), approved by the coordinator on the owner's standard, 2026-11-17.
      // models.lantern: the Lantern from its Blender model (v2: industrial legs, teal), approved by the coordinator on the owner's standard, 2026-11-17.
      // models.ticks: the Ticks from their Blender model (one unit copied three times), approved by the coordinator on the owner's standard, 2026-11-17.
      // models.warden: the Warden from its Blender model (v2: industrial arms, off-white enamel, live and dead screens), approved by the coordinator on the owner's standard, 2026-11-17.
      // A page opened with ?gloomglb=<kinds> (or =all) turns models on for that page only (samples, checks); build.mjs embeds only the GLBs of kinds switched on here.
      gloom: { models: { walker: true, lurcher: true, hauler: true, stilt: true, lantern: true, ticks: true, warden: true, tint: 1 }, plate: 0.012, seam: 0.011, bevel: 0.006, bolt: 0.009, boltLost: 0.08, missing: 0.05, bent: 0.07, bend: 0.2, recess: 0.018, round: 18, links: 44, bristles: 30, paint: [0.62, 0.12], chip: [0.3, 1], steel: [0.36, 0.85], chrome: [0.2, 1], rubber: [0.92, 0], under: [0.75, 0.4], glass: [0.05, 0.22, 2.5],
        cavity: 0.022, boltGap: 0.12, dent: [0.1, 0.016], edgeWear: 0.7, edgeTint: 0xb8b4aa, mudTint: 0x6e5c46, chromeTint: 0x666a6e, chromeEnv: 0.6, ram: [0.6, 0.66], bulb: 0.9, lens: [0.05, 0.3, 2], marks: 1, paintLift: 1.15, tris: 60000,
        markTries: 8, markFace: 0.004, mapSize: 512, chips: 150, scratches: 160, grime: 30, cables: 3, hang: [2, 4], moss: [2, 5], mossLumps: 5, leaves: 3, halo: [2.6, 0.16],
        detail: { bolts: true, cables: true, plates: true, rams: true, fittings: true, growth: true, interiors: true, dents: true, marks: true, glass: true, bellows: 8, tread: 7 } },
      // house: the master build of the street houses (src/househi.js; high tier). tile: one roof tile [width, gauge = exposed length up the slope, length, thickness] (m); lap: extra tilt so each tile's lower edge stands proud (rad); tileVar: brightness spread between tiles;
      // ridge: half-round ridge tile [radius, length]; sheet: corrugated sheet on the felt-coloured roofs [width, waves, depth, length]; batten: [width, height] under the tiles; brick: [length, height, depth, mortar joint] (chimney, soldier lintels, torn edges);
      // gutter: [radius, bracket spacing]; pipe: downpipe radius; fascia: [height, thickness] (also barge boards); sill: stone window sill [how far it stands out, thickness]; frame: window frame [width, depth]; trim: architrave and skirting [width, thickness]; skirt: skirting height;
      // plinth: [height, how far proud] of the stone plinth course; band: string course between floors [height, proud]; quoin: corner stones on plastered houses [long, short, height, proud]; step: stone step at a ground-floor door [height, depth]; coping: parapet stones [length, height, depth];
      // ivy: [patches on a desolate house (1 otherwise), leaves per patch, leaf size m]; cracks: render cracks per wall; patches: spalled render patches per desolate house; module: solar module [width, height]; glass: panes [roughness, opacity, sky reflection];
      // desolate (with the approved look, CONFIG.desolate sag/fade): missing / slipped: share of roof tiles gone / slid down; hole: the hole torn in the roof [half width, half height up the slope] (m) at holeAt [across, up] as shares of the slope; broken: chance a window sash hangs off / is gone.
      // detail: what the master builder makes at this tier (DESKTOP PRIORITY: a phone setting is this block dialled down): tiles (single tiles or sheets; off = one flat roof surface), chimney (brick courses), gutters (with fascia, soffit, barge boards, downpipes),
      // sashes, shutters, doors (panelled leaves), interior (skirting, coving, architraves, window boards, switch plates), ivy, cracks (and spalled patches), plinth, quoins, porch, panels (solar modules), desolate (the approved desolate look on every house).
      house: { tile: [0.33, 0.31, 0.42, 0.016], lap: 0.07, tileVar: 0.22, ridge: [0.13, 0.42], sheet: [0.86, 8, 0.026, 2.0], batten: [0.05, 0.025], brick: [0.215, 0.065, 0.1, 0.01], gutter: [0.065, 0.9], pipe: 0.04, fascia: [0.22, 0.03],
        sill: [0.09, 0.05], frame: [0.07, 0.11], trim: [0.08, 0.02], skirt: 0.12, plinth: [0.5, 0.1], band: [0.14, 0.035], quoin: [0.42, 0.26, 0.26, 0.022], step: [0.16, 0.42], coping: [0.6, 0.06, 0.34],
        ivy: [3, 800, 0.15], cracks: 4, patches: 3, module: [1.0, 1.65], glass: [0.06, 0.4, 1.6], missing: 0.05, slipped: 0.03, hole: [1.0, 0.7], holeAt: [0.3, 0.3], broken: [0.45, 0.3],
        detail: { tiles: true, chimney: true, gutters: true, sashes: true, shutters: true, doors: true, interior: true, ivy: true, cracks: true, plinth: true, quoins: true, porch: true, panels: true, desolate: true } },
      // street: the master build of the street and its plants (src/streethi.js; high tier). kerb: kerb stone [length, height above the road, depth] (m); slab: footway slab [size, thickness]; footway: width of the slab footway behind each kerb (m);
      // drain: spacing of the drain grates (m); cracks: road fissures; potholes; lumps: loose asphalt lumps along each road edge; deadLeaves: dead leaves drifted along the kerbs; litter: small objects (cans, bottles, paper, bags, bricks, tyres);
      // meadow: long-grass tufts on verges and lawns; leaves: single leaves round each tree or bush leaf spray (bigger sprays get more); leafSize: leaf length (m); tuftBlades: curved blades per grass tuft (each phone card becomes one tuft).
      // A desolate street (the approved look, the default) gets every count in full; the old look gets fewer cracks, potholes, leaves, litter and meadow.
      // detail: street (kerbs, footway, drains, road damage, litter, meadow), leaves (single leaves on trees and bushes), litter, pole (the fallen utility pole and its wires), tufts (blade tufts in place of the grass cards).
      street: { kerb: [0.9, 0.13, 0.15], slab: [0.6, 0.05], footway: 1.2, drain: 16, cracks: 40, potholes: 10, lumps: 60, deadLeaves: 1600, litter: 160, meadow: 1700, leaves: 60, leafSize: 0.17, tuftBlades: 10,
        detail: { street: true, leaves: true, litter: true, pole: true, tufts: true } },
      // base: the master build of the base (src/basehi.js; high tier). cat: the modelled lucky cat in its painted wrap, glaze = ceramic [roughness, clear coat, clear coat roughness, sky reflection (more turned the black kuro blue)], gold = bell and coin [roughness, metalness, sky reflection], segments: roundness of body and head;
      // device: detail on every bloom-tech device, band = copper band and rim thickness (m), rivets = rivets per metre of shell radius (times 2 pi is per turn), cageRibs = copper ribs over a glass dome, petalEdge = frame and midrib of a solar petal (in petal units);
      // building: the vaulted stations and your home, ribGap = spacing of the ribs over the vault (m), rib = their radius, tile = glazed wall tile [width, height], ivy = [patches, leaves per patch, leaf size m].
      base: { cat: { glaze: [0.25, 1, 0.12, 0.35], gold: [0.25, 1, 1.4], segments: 40 }, device: { band: 0.008, rivets: 60, cageRibs: 4, petalEdge: 0.012 }, building: { ribGap: 0.9, rib: 0.03, tile: [0.2, 0.15], ivy: [3, 260, 0.16] } },
      // density: the DENSITY pass on the desktop master builders (src/density.js, househi.js, carhi.js, basehi.js; owner Nov 16: rich layered detail at play distance, no large plain surfaces). on: the switch (?density=0 / 1 overrides it for one visit).
      // cell: size (m) of the grid that weathering marks are cut into, so a mark never covers a door, window or hole (cells inside an opening are dropped).
      // house.wall: weathering marks per outside wall [damp band (1 = along the whole foot), mould blots, render repairs, drips under each window (1 = every window), rust runs under gutter brackets]; house.soot: chance one window has smoke marks above it; house.spray: chance of a sprayed search mark beside the front door; house.tag: chance of a sprayed loop on a side wall.
      // house.yard: [fence chance, wheelie bins max, rubbish bags max, pots max, debris heaps max]; house.gone: share of fence pickets missing [min, max]; house.flight: chance of things left in a hurry by the door path (suitcase, tricycle, mattress); house.curtain: chance a window has curtains inside (each side panel);
      // house.dish: chance of a satellite dish; house.wires: chance of a fallen service cable from the eaves; house.aerial: chance of a TV aerial on the roof; house.litter: leaf-litter drifts against the walls; house.clear: m kept clear around cars, sleeping machines and the door path.
      // car.holes: rust-through holes times the master build's count (holeSize times too); car.streaks: rust runs on the body sides; car.piles: leaf-and-dirt drifts (scuttle, roof, round the wheels); car.luggage: [min, max] bags and cases on the back seat (more on worse wrecks);
      // car.rack: chance of a roof rack (with a tied tarp bundle or cases); car.childSeat: chance of a child seat in the back; car.rubbish: bottles, cans and papers inside; car.crumple: how far the crashed corner folds (m at full damage); car.burn: [bead-wire rings per wheel, ash drifts].
      // house.more (pushed further after the 16:44 review): frontShare = share of extra yard items put in the front yard (the rest by the other walls), damp / peel = big damp patches / peeling paint or render left on brick per wall,
      //   soot = chance of smoke marks over each window, stencil = chance of a sprayed mark on each side wall, blind = chance a window has a venetian blind, ac = chance of an air-conditioning box, pipe / cables = chance per wall of a waste pipe / cable runs,
      //   items = extra yard items per house (bike, pram, toys, sofa, table and chair, boxes, bags, hose, plywood warning, second bin, barrow, in turn), tools = garden tools against the front wall, drifts = leaf and soil drifts across the yard.
      // car.paneLoss: the master build's chance that a pane is broken out is multiplied by this (glass stays in most frames; the cabin shows through it); car.seats: faded upholstery colours (one per car); car.dash: things left on the dashboard (a map, a bottle, a bag, in turn)
      // car.open: chance a front door stands open (cut out of the shell) at openAngle [min, max] rad; car.crack: chance the windscreen (if still in) is cracked from a stone strike; car.torn: chance per front seat cushion / back of torn upholstery showing foam;
      //   car.jacket / mapSeat / toy: chance of a jacket over the driver's seat / a road map open on the passenger seat / a teddy on the back seat; car.leavesIn: dead leaves blown into the cabin
      // car.sideGlass: side and rear panes [opacity, green-grey tint, sky reflection] (the windscreen keeps car.glass); car.pillar: A, B and C pillars [width times, depth times, edge rounding m];
      //   car.roof: roof skin [thickness m, edge rounding m, drip rail radius m] (density only; the master build's roof is 0.06 thick, square-edged)
      // car.glass: [opacity, sky reflection, dirt film opacity] of the glass still in the frames (clearer than the master build's 0.55 / 2.2, so seats, luggage and the child seat show through)
      // base: lived-in dressing on the vaulted buildings: planters (window boxes and pots by the door), tools, crates, lantern (glow strength), sign (hand-painted board), stained (stained glass in round windows), mosaic (tiles round the door arch), repairs (patches on walls and vault), line (washing line), stove (flue on the roof).
      density: { on: true, cell: 0.2,
        house: { wall: [1, 3, 2, 1, 1], soot: 0.5, spray: 0.7, tag: 0.4, yard: [0.9, 3, 7, 7, 3], gone: [0.15, 0.45], flight: 0.9, curtain: 0.7, dish: 0.7, wires: 0.7, aerial: 0.8, litter: 10, clear: 1.2,
          more: { frontShare: 0.7, damp: 2, peel: 2, soot: 0.6, stencil: 0.5, blind: 0.45, ac: 0.6, pipe: 0.5, cables: 0.6, items: 11, tools: 3, drifts: 12 } },
        car: { holes: 2.6, streaks: 14, piles: 12, luggage: [2, 5], rack: 0.6, childSeat: 0.5, rubbish: 6, crumple: 0.06, burn: [3, 4], glass: [0.5, 1.6, 0.8], paneLoss: 0.1,
          sideGlass: [0.66, 0x56645c, 1.5], pillar: [2.3, 1.7, 0.035], roof: [0.1, 0.035, 0.016],
          seats: [0xa08a6a, 0x8a3a30, 0x4a5a7a, 0x5a6a4a, 0xb8ac90], dash: 3,
          open: 0.45, openAngle: [0.8, 1.15], crack: 0.4, torn: 0.55, jacket: 0.45, mapSeat: 0.45, toy: 0.4, leavesIn: 22 },
        base: { planters: true, tools: true, crates: true, lantern: 0.9, sign: true, stained: true, mosaic: true, repairs: true, line: true, stove: true,
          more: { boxPlants: 4, hang: [[-2.2, 0.0], [-0.9, -1.2], [2.3, 0.85], [0.9, -1.2]], herbs: 10, bulbs: 16 } } },
      // base.more (owner 17:10, solarpunk inside and out): boxPlants = plants per window box (urns by the doors get one big plant each), hang = [x, z] of the hanging planters in your home (m from its centre),
      //   herbs = bundles drying from the beam, bulbs = warm solar bulbs strung under the vault
      // scenery: the desktop backgrounds (src/scenehi.js; owner Nov 16: reach the QUALITY BAR of his reference picture with our own content). on: master switch (?scenery=0 / ?scenery=1 override it for one visit).
      // sun: base sun [colour, strength]. grade: colour grade after AgX on desktop (src/fx.js): sat / satNight = saturation by day / at night (1 = unchanged), warm = warm shift by day (0 = none), contrast = S-curve by day (0 = none).
      // sky (base and street, day colours only): cover = cloud threshold (higher = fewer clouds), scale = cloud size (lower = bigger), soft = edge softness, zenith / horizon = sky colours, cloudLit / cloudCore = lit tops / shaded middles of the clouds.
      // grass: one clump = `blades` curved blades (bladesFar beyond `near` m; nothing beyond `far` m), width = blade width in clump units, root / mid / tip = blade colours (the root is the baked contact shade), dry = straw colour for dryShare of blades,
      //   patchCool / patchWarm = tints of large meadow patches, density = clumps per m2 at full cover, spread = clump width / height, chunk = chunk size (m; one LOD and culling unit), sway = wind sway at the top of a 1-tall clump (m), windSpeed = wind time scale.
      // flowers: height = [min, max] flower height in clump units (the grass is 0.5-1), size = petal radius in clump units, colours = per kind (sun = sunflower petals, eye = daisy centre), mixes = flowers in each flowering clump kind.
      // foliage: leaf = leaf length on trees (m), hedgeLeaf / shrubLeaf = on hedges and shrubs, cover = leaves per unit of surface (1 = just covered), width = leaf width / length, tilt = random leaf tilt, jitter = colour noise, coreDark = brightness of the core under the leaves.
      // tree.bark: trunk colour. palettes: [lit top, mid, shade] colours of leaf masses (tree: base trees and orchards, hedge, shrub, street: street crowns).
      // base: seed; plaza = paved radius kept clear (m); hedge = hedge ring radius, hedgeStep / hedgeH = clusters along it and their height; tall / tallOut = grass height inside / outside the hedge (m); outside = grass density factor outside;
      //   paved = radius of the paving left round the solar tree (the rest of the old plaza becomes lawn; 12 = keep the whole plaza), lawn = grass height there (m), lawnSpread = its clump width / height (low, wide clumps), lawnDensity = its density factor; flowersIn / flowersOut = share of flowering clumps; meadowR = how far the meadow, orchards and sunflowers reach (m); outTrees = orchard and wood trees outside the hedge; sunflowers / sunDrift = count and how patchy (higher = fewer, tighter drifts);
      //   collar = flower clumps round each plaza lantern (three times as many round the solar tree); ground = colour of the ground under the grass; fog = [colour, near, far]; cell = size of a baked leaf mesh cell (m); farR / farDepth / farH = hill ring radius, depth and [low, high] height (m); farTrees = round far trees; roofs / roofAt = old settlement roofs and their direction (rad); masts / mastAt = bloom-tech solar masts.
      // street: ground = ground colour under the grass; sprayR = leaf cluster radius per world.js leaf spray size; leaf = leaf length on street crowns (m); shrubs / shrubSize = extra shrubs (m); carClear = no grass this close to a car (m); edge / verge = grass density factor on the footway and kerb line / on verges and plots;
      //   tall = verge grass height (m); flowers = share of flowering clumps; crackFlowers = share of crack and slab-gap weeds in flower; chunk / near / far = as grass, for the street; cell = baked leaf mesh cell; farGap / farDepth / farH / farTrees / roofs / masts = the far ring round the town.
      // water: the base pond: colour, rough = roughness, ripple = ripple relief strength, env = sky reflection, opacity, radius (m), stones and reeds round its edge. horizon: near / far = hill colours, treeTop / treeShade = far tree colours,
      //   field = colour of the cropped fields on the near hills, woodsFrom = how far up the hill ring the far woods start (0 = its foot, 1 = its top), woodsSize = [min, max] far tree scale; walls / roofs = old house colours, roofSpread = how widely the old roofs spread (rad), mast = solar mast height (m), mastGap = angle between masts (rad), cell = solar petal colour.
      // (2026-11-16, second scenery pass) ground: the mottled ground plane under the grass (base and street): dark / light = tints of its large patches, dry = straw tint, scale = patch size (lower = larger),
      //   fine = finer mottle size, fineK = its strength, dryFrom = where dry patches start (0-1 noise), dryMax = their strongest tint, seg = vertices per metre.
      //   base.borderStep / borderOff / borderH / borderShrub = path-edge beds: spacing along a path (m), distance from the path's middle (m), clump height (m), share of spots that get a low shrub.
      //   street crowns are separate leaf clumps with sky between them: clumpsPer = clumps round each leaf spray, clumpR = clump radius per spray radius (loose clumps: this many metres, x0.25-0.55),
      //   looseClumps = extra loose clumps per spray between the sprays, clumpCover = leaf cover of a clump (x foliage.cover), branchShare = share of clumps with a bare twig back to their limb end, crownJoin = leaf clusters this close across the ground (m) count as one tree;
      //   street.woods = tall trees behind the plots, woodsEnd = across each road end, woodsLeaf = their leaf length (m), woodsHaze = baked haze per metre beyond the street's bounds (no fog on them), woodsHazeMax = its most, roadOpen = how far past the street's end (m) the road stays open before the woods.
      scenery: { on: true, sun: [0xffe3b8, 2.3], grade: { sat: 1.22, satNight: 1.0, warm: 0.045, contrast: 0.18 },
        sky: { cover: 0.47, scale: 0.5, soft: 0.13, zenith: 0x2a6fcf, horizon: 0xcfe0ea, cloudLit: 0xffffff, cloudCore: 0xb4c0d2 },
        grass: { blades: 14, bladesFar: 6, width: 0.045, root: 0x203a14, mid: 0x4f8f2a, tip: 0xb4d65a, dry: 0xc8b870, dryShare: 0.08, patchCool: 0xd8f0d0, patchWarm: 0xffffd0, density: 4.2, spread: 1.5, chunk: 14, near: 18, far: 55, sway: 0.07, windSpeed: 1 },
        flowers: { height: [0.85, 1.25], size: 0.11, colours: { poppy: 0xe0301e, daisy: 0xf6f3ea, lupine: 0x8a52d8, buttercup: 0xf6c824, sun: 0xf4b818, eye: 0xf0c020 },
          mixes: { warm: ['poppy', 'poppy', 'buttercup', 'buttercup', 'daisy'], cool: ['lupine', 'lupine', 'daisy', 'daisy', 'buttercup'], white: ['daisy', 'daisy', 'daisy', 'buttercup', 'poppy'] } },
        foliage: { leaf: 0.2, hedgeLeaf: 0.24, shrubLeaf: 0.19, cover: 1.5, width: 0.6, tilt: 0.7, jitter: 0.22, coreDark: 0.55 }, tree: { bark: 0x6e5844 },
        palettes: { tree: [[0xa8d44a, 0x4f8f2c, 0x1e4424], [0xbcd85a, 0x6a9a30, 0x2a4a22], [0x92cc5a, 0x3f8a3a, 0x163c28]], hedge: [0x8cc046, 0x3f7a2c, 0x173a1e], shrub: [[0x9ccf52, 0x4a8a30, 0x1c4022], [0x7fb84e, 0x37733a, 0x143628]],
          street: [[0xa4c84a, 0x5a8a2c, 0x203e1e], [0xb8c050, 0x6e8430, 0x2c3c1c], [0x8cc05a, 0x40803a, 0x173a26], [0xb4c45a, 0x768a34, 0x2e3c1e]] },
        // night: after dark the grass, flowers and leaf masses lose colour (grey = share turned grey at full night) and light (dark = share of brightness taken away), so they never glow green while the houses go dark
        night: { grey: 0.45, dark: 0.65 },
        ground: { dark: 0x8c9e7c, light: 0xf4f8e8, dry: 0xfff0c0, scale: 0.08, fine: 0.6, fineK: 0.25, dryFrom: 0.56, dryMax: 0.6, seg: 1 },
        base: { seed: 4711, plaza: 12.3, paved: 3.4, lawn: 0.3, lawnSpread: 1.7, lawnDensity: 2.2, borderStep: 0.75, borderOff: 1.15, borderH: 0.55, borderShrub: 0.18, hedge: 20.5, hedgeStep: 1.0, hedgeH: 1.25, tall: 0.42, tallOut: 0.75, outside: 0.7, flowersIn: 0.22, flowersOut: 0.3, meadowR: 46, outTrees: 34, sunflowers: 900, sunDrift: 0.55,
          ground: 0x86b04e, fog: [0xcfe0ea, 45, 240], cell: 20, farR: 56, farDepth: 100, farH: [6, 24], farTrees: 520, roofs: 14, roofAt: -2.2, masts: 3, mastAt: 0.9, collar: 9 },
        street: { ground: 0x8aa058, sprayR: 0.42, leaf: 0.22, shrubs: 70, shrubSize: 0.9, carClear: 2.6, edge: 0.18, verge: 0.75, tall: 0.75, flowers: 0.24, crackFlowers: 0.35, chunk: 12, near: 20, far: 60, cell: 24, farGap: 25, farDepth: 70, farH: [7, 24], farTrees: 600, roofs: 10, masts: 2, clumpsPer: 3, clumpR: 0.75, looseClumps: 1, clumpCover: 1.35, branchShare: 0.55, crownJoin: 3, woods: 56, woodsEnd: 18, woodsLeaf: 0.85, woodsHaze: 0.012, woodsHazeMax: 0.55, roadOpen: 14 },
        water: { colour: 0x2f7f96, rough: 0.06, ripple: 0.35, env: 1.2, opacity: 0.86, radius: 2.6, stones: 46, reeds: 26 },
        horizon: { near: 0x6a9a3e, far: 0x86a86a, field: 0xb8c060, woodsFrom: 0.28, woodsSize: [1.6, 3.4], treeTop: 0x8cbc4c, treeShade: 0x2c5a2c, walls: [0xd8cdb8, 0xc8b8a0, 0xb8a890, 0xa89a88], roofs: [0x8a4a34, 0x5a5a5e, 0x9a5a3a, 0x4a4a50], roofSpread: 0.7, mast: 22, mastGap: 0.35, cell: 0x3a54b0 } },
      // pbr: desktop surfaces (src/pbr.js). env: strength of the light and reflections from the sky; hemiKeep: share of the old flat sky light kept beside it (the two together should be about as bright as before); hemiDay: the sky light's daytime strength (the sky's share falls with it at night); sky: zenith, horizon, ground colours of that light; sun, sunPower: the bright patch in it;
      // every: frames between sweeps for new objects; rules: [roughness, metalness] by painted texture name (0 rough = mirror, 1 = matt; 1 metal = bare metal); glass: see-through panes; plain: anything else; shineFull: the old shine value that counts as fully glossy
      pbr: { env: 0.6, hemiKeep: 0.45, hemiDay: 1.6, sky: [0x5f8fd6, 0xcfe0f2, 0x6a6458], sun: 0xfff0d0, sunPower: 9, every: 20, shineFull: 110, glass: [0.06, 0], plain: [0.9, 0],
        rules: { metal: [0.38, 0.9], carrust: [0.5, 0.55], rust: [0.7, 0.45], glaze: [0.18, 0], gloom: [0.45, 0.6], tiles: [0.55, 0], roof: [0.8, 0], asphalt: [0.85, 0], wood: [0.75, 0], brick: [0.9, 0], plaster: [0.95, 0], render: [0.95, 0], interior: [0.9, 0], siding: [0.8, 0], block: [0.9, 0], fabric: [1, 0], cat: [0.15, 0] } } },
    // MEDIUM (owner's performance rules Nov 19): the DEFAULT tier on every device. The desktop builds and models with these settings laid over the high block (src/quality.js);
    // the budget is under 500 draw calls and 0.5 M triangles a frame in the heaviest scene. fx.ao 0: no contact shading pass (it drew the whole scene a second time; the colour
    // grade and the physically based surfaces stay); lights: machine screen lights at night; scenery: fewer grass blades and leaves, grass drawn to a shorter distance, fewer far trees
    // and sunflowers (high keeps the full counts)
    medium: { pixelRatio: 1.25, aniso: 4, reliefAniso: 4, lights: 2, fx: { ao: 0 },
      scenery: { grass: { blades: 10, bladesFar: 4, near: 12, far: 36, density: 3.0 }, foliage: { cover: 0.8 }, base: { sunflowers: 500, farTrees: 300, outTrees: 24 }, street: { farTrees: 300, near: 14, far: 40, shrubs: 50, cell: 12 } } },
    low: { pixelRatio: 1.5, smooth: true, shadowMap: 2048, baseShadowMap: 2048, shadowSoft: 1, aniso: 4, reliefAniso: 1, hiTex: false, lights: 3, grassMore: 0, leafMore: 0, skyDetail: 4, round: 1, roundMax: 64, machineTris: 9000, fx: null, pbr: null, gloom: null, car: null, house: null, street: null, base: null, density: null, scenery: null } }, // gloom: null = phones keep their own machine builders (no tested low setting of the master builder yet)
  // DESOLATE SAMPLE (2026-11-15; not approved, off by default): the old world left alone for years, on ONE house, ONE car, the Walker and the stretch of street in front of them.
  // ?look=desolate turns it on (restyle + place); ?desolate=place only moves the sample car and a sleeping Walker into the same spots in today's look (for the before pictures). src/desolate.js, gloomkit.js walkerDesolate.
  // house: which house (run.houses index) gets it (its roof is made a gable so the sag and the hole read); fade: how far the wall colour is sun-bleached toward fadeTo; sag: roof ridge drop at mid-span (m); hole: roof hole half-size [along ridge, up the slope] (m) at holeAt [x 0..1 along, t 0..1 up];
  // ivy / moss / streaks / tufts: counts; street: half-length of the treated stretch (m); cracks, meadow, litter, bricks: counts there; glassRefl: how much car glass and the Walker's display glass reflect the sky by day / at night;
  // car: real lengths [sedan, van] (m), angle off the road (rad), how far its middle stands past the road edge (m), lean from a flat tyre (rad), collision circles along it (r m);
  // walker: faded civic paint colour, unit stencil, display grid [w, h] in pixels, dead pixel row, burn-in strength, flicker chance per frame, display brightness by day; legDirt: how high dirt climbs the legs (m)
  desolate: { on: false, place: false, house: 0, fade: 0.42, fadeTo: 0xd8d2c4, sag: 0.32, hole: [0.75, 0.42], holeAt: [0.32, 0.45], ivy: 3, moss: 6, streaks: 2, tufts: 26, street: 13, cracks: 7, meadow: 9, litter: 9, bricks: 9, glassRefl: [0.42, 0.08],
    car: { len: [4.8, 5.2], width: 1.8, wheelbase: 2.75, wheelR: 0.32, tyreW: 0.2, belt: 0.9, roof: 1.44, angle: 0.32, verge: 0.9, lean: 0.045, circles: 3, r: 1.0, along: 5.5, leaves: 40, fadeSat: 0.55, fadeLight: 0.12 }, over: { len: 24, meadow: 1300, tall: [0.6, 1.5], meadowMats: 70, roadWeeds: 110, saplings: 5, ivyLayers: 9, ivyHang: 4, wash: 0.4, shards: 3, slipped: 10, holeY: 1.1, poleAt: -9, fogNear: 14, fogFar: 62, fogColor: 0xc9ccc2 },
    walker: { shape: { top: 2.15, hip: 0.98, hipW: 0.2, thigh: 0.46, shin: 0.44, chest: 0.36, torso: 0.5, arm: 0.36, headUp: 0.3, head: [0.46, 0.36, 0.3], stride: 0.26, knee: 0.55, limp: 0.65, limpLeg: 1, limpDrop: 0.06, sway: 0.05, dip: 0.03, lean: 0.1, twitch: 0.16 }, paints: { walker: 0xc4a23e, hauler: 0xc06a34, warden: 0xcfccc0, lurcher: 0x6c7c88, stilt: 0x9a4a3c, lantern: 0x4e8580, ticks: 0x8c8a6a, hue: 0.02, sat: 0.12, light: 0.08 }, grime: { mud: [6, 12], mudTries: 6, mudSize: [0.3, 0.6], rust: [6, 14], rustSize: [0.2, 0.45], soot: [3, 8], sootSize: [0.25, 0.5], moss: [5, 12], mossSize: [0.2, 0.45] }, paint: 0x8f9a6e, unit: 'SVC-07', grid: [40, 30], deadRow: 19, burn: 0.16, flicker: 0.03, dayDim: 0.55, at: [-6.5, 1.9] }, legDirt: 0.55 },
  // abandoned rooms are dirty. Per floor: floor = patches of grime and litter [min, max]; ceil = stains on the ceiling; wall = marks per wall (water runs, cracks, splash dirt); webs = cobwebs in the ceiling corners; power = how dark the marks are
  dirt: { floor: [16, 22], ceil: [4, 7], wall: [8, 12], webs: true, power: 1, dustTint: 0x8c877d },
  // the outside of the old houses: a footing course round the base and worn, chipped corners, so a house is not a clean box
  trim: { footH: 0.42, footOut: 0.06, footColor: 0x77726a, cornerW: 1.1, cornerPower: 0.9 },
  // the machines' voices: broken loudspeaker speech made in the browser (no recordings). vol = loudness, reach = how far you hear them (m), stutter / drop / slip = chance per sound of a repeat, a dropout, a pitch jump; crush = how coarse the sound is (lower = more broken)
  voice: { on: true, vol: 0.55, reach: 16, stutter: 0.13, drop: 0.08, slip: 0.12, crush: 5, kinds: { walker: [112, 1.0], lurcher: [165, 0.78], hauler: [72, 1.25], stilt: [205, 1.05], lantern: [140, 1.1], ticks: [330, 0.6], warden: [52, 1.45] }, // per kind: [pitch in Hz, slowness]
    // MARLA'S VOICE (owner Nov 18): her run lines spoken (street, house by day, night, night-1 drill); never in the base. Clips: art/voice (Chatterbox from Kokoro bf_isabella), table src/voicelines.js; player src/marlavoice.js
    marla: {
      // owner Nov 18 08:05: desktop only. true = never on a phone (phone controls, pointer: coarse): no clip plays and the pause menu has no Voice button
      desktopOnly: true,
      // on by default (the pause menu's Voice button turns it off; the choice is kept in localStorage)
      on: true,
      // the localStorage key of that choice ('on' / 'off')
      storeKey: 'solardg.voice',
      // her loudness (gain on the peak-normalised clips; the music plays at CONFIG.music.volume)
      vol: 0.9,
      // the music drops by this share while she talks
      duck: 0.4,
      // seconds for the music to duck when she starts
      duckIn: 0.25,
      // seconds for the music to come back after she stops
      duckOut: 0.8,
      // seconds between the text showing and her starting (lets the alert chime sound first)
      delay: 0.1,
      // decoded clips kept in memory at once (each is a few hundred KB decoded)
      cache: 16,
      // true = a line queued to be said (the street lessons queued when a run starts) has its clip decoded at once, so her first street line starts with the text, not a decode later
      warm: true,
    } },
  hud: { holdMs: 380 }, // hold a device button this long to read it instead of placing
  // UNCANNY GLOOM MOTION (owner Nov 16: "gloom to move uncanny"); src/gloommotion.js. Only the pose changes: where a machine is, how fast it goes and when it arrives stay the sim's.
  // on = master switch (false = the old motion back; ?gm=0 in the address does the same for one visit). range = metres from the player within which heads lock on and gestures play.
  // Each behaviour has its own switch (on) under its name:
  // stutter: the pose is held and updated only hz times a second (per kind below), while the machine glides smoothly along its path.
  // freeze: now and then the pose stops mid-step for freezeLen s, then snaps through all the motion it missed in snap s, dead stop, no settle; ground speed is not touched.
  // freezeHead: false = the head keeps tracking you while the body is frozen; true = the head freezes too.
  // lock: the head / display / lamp aims at you smoothly and exactly, its world angle held still while the body sways under it. lockMix = how much of that lock is used (0 = none, 1 = all; the Warden's head is its whole upper body). lockRate = how fast it follows (1/s), lockYaw / lockPitch = how far it may turn from the body (radians), steady = how much of the head's bob it cancels (0..1), steadyMax = the most it may move off its neck to do so (m).
  // joints: over = one knee (or elbow) bends this fraction further than the walk asks; hyper = that knee also bows backwards by this many radians when straight; lag = the partner leg runs this many held poses behind; tiltEvery = seconds between head tilts that are held too long, tiltHold = how long each is held, tilt = how far (radians, a roll).
  // mimic: while a machine's screen says its line, it copies a human gesture with perfectly even, linear timing. gestures = which ones a kind uses (tilt = curious head tilt, nod = nods or a bow, wave = a slow wave of one arm);
  //   tilt / nod (radians), nods = nods per line, wave = how high the arm lifts (radians), swing = the forearm's swing (radians), period = seconds per wave, ramp = seconds to lift or lower (linear).
  // kinds: per machine kind; [a, b] = each machine rolls its own value in that range from its seed, so a group never moves in unison. hz 0 = no hold (pose every frame: the Ticks skitter in bursts between short freezes).
  gloomMotion: {
    on: true, range: 26,
    stutter: { on: true }, freeze: { on: true, freezeHead: false }, lock: { on: true, steadyMax: 0.05 }, joints: { on: true }, mimic: { on: true, tilt: 0.34, nod: 0.24, nods: 3, wave: 1.5, swing: 0.4, period: 0.9, ramp: 0.4 },
    kinds: {
      walker: { lockMix: 1, hz: [9, 11], jitter: 0.3, freezeEvery: [5, 10], freezeLen: [0.5, 1.1], snap: 0.12, lockRate: [6, 8], lockYaw: 1.9, lockPitch: 0.5, steady: 0.7, over: 0.3, hyper: 0.1, lag: 1, tiltEvery: [7, 14], tiltHold: [2.2, 3.4], tilt: 0.26, gestures: ['tilt', 'nod'] },
      lurcher: { lockMix: 1, hz: [10, 12], jitter: 0.35, freezeEvery: [4, 8], freezeLen: [0.4, 0.9], snap: 0.1, lockRate: [9, 11], lockYaw: 1.6, lockPitch: 0.6, steady: 0.5, over: 0.25, hyper: 0.08, lag: 1, tiltEvery: [6, 12], tiltHold: [2.0, 3.0], tilt: 0.3, gestures: ['tilt'] },
      hauler: { lockMix: 1, hz: [8, 10], jitter: 0.3, freezeEvery: [6, 12], freezeLen: [0.5, 1.1], snap: 0.14, lockRate: [5, 6], lockYaw: 1.3, lockPitch: 0.4, steady: 0.6, over: 0.3, hyper: 0.08, lag: 1, tiltEvery: [9, 16], tiltHold: [2.0, 3.0], tilt: 0.22, gestures: ['nod', 'wave'] },
      stilt: { lockMix: 1, hz: [8, 10], jitter: 0.3, freezeEvery: [5, 10], freezeLen: [0.6, 1.2], snap: 0.14, lockRate: [5, 7], lockYaw: 2.2, lockPitch: 0.7, steady: 0.6, over: 0.2, hyper: 0.06, lag: 1, tiltEvery: [7, 13], tiltHold: [2.4, 3.6], tilt: 0.3, gestures: ['tilt', 'wave'] },
      lantern: { lockMix: 1, hz: [7, 9], jitter: 0.25, freezeEvery: [3, 7], freezeLen: [0.6, 1.2], snap: 0.1, lockRate: [9, 11], lockYaw: 3.1, lockPitch: 0.8, steady: 1, over: 0.35, hyper: 0.1, lag: 2, tiltEvery: [6, 11], tiltHold: [2.6, 4.0], tilt: 0.3, gestures: ['nod', 'tilt'] },
      ticks: { lockMix: 1, hz: 0, jitter: 0, freezeEvery: [0.6, 1.6], freezeLen: [0.25, 0.7], snap: 0.06, lockRate: [8, 10], lockYaw: 3.1, lockPitch: 0.6, steady: 0, over: 0, hyper: 0, lag: 0, tiltEvery: [5, 9], tiltHold: [1.6, 2.6], tilt: 0.35, gestures: ['tilt'] },
      warden: { lockMix: 1, hz: [7, 9], jitter: 0.25, freezeEvery: [4, 8], freezeLen: [0.6, 1.2], snap: 0.12, lockRate: [4, 5], lockYaw: 1.2, lockPitch: 0.25, steady: 1, over: 0.3, hyper: 0, lag: 0, tiltEvery: [8, 14], tiltHold: [2.4, 3.6], tilt: 0.12, gestures: ['nod', 'wave'] },
    },
  },
  gloomLook: { machines: true, dormant: 4, lightPower: 5, lightReach: 5, kindLineAfter: 14, aimCos: 0.985, aimReach: 16 }, // kindLineAfter: Marla only starts saying what each new machine does this many seconds into the night, after the how-to-fight hints // how many screens throw real light at night is per graphics tier (quality.*.lights). How often each machine comes is in gloom.kinds (share).
  // the soft light that fills the shade in the base: sky = from above (warm white, so white walls in shade stay white, not blue), ground = bounced up from the paving, power = its strength
  baseLight: { sky: 0xfff4e2, ground: 0xdcd6bc, power: 1.7 },
  // the sky dome (src/sky.js). cover: lower = more cloud (0.35 overcast, 0.6 few clouds). scale: cloud size (higher = smaller clouds). soft: cloud edge softness. wind: drift speed.
  // cloud noise layers to start with: quality.*.skyDetail, 2 to 6. The game lowers it by itself, one layer at a time, whenever the average frame over `watch` frames is slower than `slowMs` ms. disc: sun size (closer to 1 = smaller). stars: share of sky cells with a star. Colour triples are [day, dusk, night].
  sky: { slowMs: 40, watch: 90, cover: 0.5, scale: 0.85, soft: 0.26, wind: 1, disc: 0.9990, stars: 0.004, horizon: 0xc6d9e4, zenith: [0x2f6dbd, 0x41527f, 0x04060c], sun: [0xfff6dc, 0xff9a4a, 0xc4d2ee], cloudLit: [0xffffff, 0xffc49c, 0x2a3350], cloudCore: [0x8e99a8, 0x6e5868, 0x0b0f18] },
  // wearTint: how far the far rings pull the walls toward the grey-green extTintFar (0 = none). fill: the light bounced up from the ground onto walls in shadow, fillDay: its extra strength by day. lamp: brightness of the ceiling lamps, lampReach: their reach in house half-widths.
  world: { sun: 2.0, wallTile: 2.6, tufts: 520, trees: 16, bushes: 34, extTint: 0xf2ecde, extTintFar: 0xa8ad98, wearTint: 0.45, intTint: 0xe2dccc, floorTint: 0xd0b898, fill: 0xa8b090, fillDay: 1.3, lamp: 14, lampReach: 3.2 }, // the settlement's look (src/world.js): sun strength, texture size on walls in metres, how much overgrowth, wall and floor tints (far rings are darker and greener)
  // first day: the first solar collector must go up inside the first house before you can leave it or start the night; the day clock waits meanwhile (save.solarDone)
  // fresh-player review Nov 18: each line names the real control, D = desktop (key Q), P = phone (the SOLAR button). Her line has no voice clip (the old clip said "tap Solar")
  firstSolar: {
    // the flash when you try to leave the house or start the night before it is up
    blockD: 'Set up your first solar collector first: face a window or door and press Q.',
    blockP: 'Set up your first solar collector first: face a window or door and tap SOLAR.',
    // Marla's order
    marlaD: 'Potts. Collector first. Face a window and press Q. The clock waits for you, I do not.',
    marlaP: 'Potts. Collector first. Face a window and tap SOLAR. The clock waits for you, I do not.',
    // seconds her order stays up
    secs: 6,
    // seconds between repeats while the collector is still not up (it was every 4 s)
    repeat: 15,
    // the text line on the phone's collector button (it read "free", the cost, with no word Solar)
    btnP: 'SOLAR',
  },
  // STARTING THE NIGHT (fresh-player review Nov 18): one instruction everywhere, in the button's own words (#bDusk, desktop key N). D = desktop, P = phone. None has a voice clip
  nightStart: {
    // the button's text while it is not held
    btn: 'HOLD: start night',
    // Marla's line on it: once a run (runs 1-2), in the first house or on the street, whichever comes first. Sun is never full by dusk, so it does not ask for that
    lineD: 'Daylight fills your Sun. Done early? Hold N to start night.',
    lineP: 'Daylight fills your Sun. Done early? Hold "start night".',
    // game seconds after the dusk bell before her next line (the bell line stays up 5 s; dusk is CONFIG.day.bell s after the bell)
    afterBell: 6,
    // that line, in a house
    houseD: 'Staying here? Hold N to start night. At dark: Turbine first.',
    houseP: 'Staying here? Hold "start night". At dark: Turbine first.',
    // and on the street
    street: 'Get in a house, Potts. Dark takes you to the nearest one.',
  },
  // hands motion (tools/humanmotioncheck.cjs): recoilAttack = share of recoilTime the recoil kick takes to reach full (eased, then eased back); recoilKick = m the cannon hand goes back; restartFade = s a placing or pick-up
  // started again mid-way cross-fades from where the hand is; bobEase = how fast (1/s) the walking bob fades in and out when you start or stop walking
  hands: { fov: 60, bob: 0.008, throwTime: 0.75, throwShow: 0.26, throwRelease: 0.62, throwFly: 0.3, landGrow: 0.15, tokenAt: [0.02, 0.07, -0.06], throwKeys: [[0, 0, 0, 0, 0, 0, 0], [0.22, -0.05, -0.17, 0.13, 0.55, 0.1, 0.3], [0.44, 0.03, 0.04, 0.04, 0.2, 0.0, 0.0], [0.64, 0.10, 0.07, -0.13, -0.5, -0.2, -0.3], [0.8, 0.12, 0.03, -0.11, -0.62, -0.25, -0.25], [1, 0, 0, 0, 0, 0, 0]], grabTime: 0.35, recoilTime: 0.24, recoilAttack: 0.5, recoilKick: 0.04, restartFade: 0.3, bobEase: 6, crease: 0.9, left: { pos: [-0.21, -0.215, -0.52], rot: [0.80, -0.38, 0.42] }, right: { pos: [0.16, -0.20, -0.44], rot: [0.14, 0.10, 0.0] }, gunScale: 0.85, skin: 0xd9a88a, sleeve: 0x8a8468, leather: 0x5a4632, brass: 0xb08a3c, glass: 0x9fd8ff, glow: 0xffc24a }, // first-person hands (real meshes from src/handsdata.js): left open hand with the solar bracer (throws devices, picks up crates), right hand on the water cannon; pos/rot place each hand in front of the eye; the ring glows with the battery
  // PLAYER SHADOW (owner Nov 18 13:21; sample approved Nov 18 15:37, on by default since; src/playershadow.js): desktop (high) gets a real body shadow from the sun, phones (low) a soft blob under the feet.
  playerShadow: {
    // sampleOnly: while true it is drawn only on a page opened with ?pshadow=1 (the sample and its check); ?pshadow=0 always turns it off (for checks). False since the owner approved the sample (Nov 18 15:37).
    sampleOnly: false,
    high: {
      // body: an invisible body casts a real sun shadow into its own small shadow map round the player, redrawn every frame (the big sun maps stay static)
      body: true,
      // blob: also lay the soft blob under the feet
      blob: false,
      // map: size of the body's shadow map (pixels, square)
      map: 512,
      // box: half size of the shadow box round the body, across the sun's rays (m); it must hold the whole body with the cannon
      box: 1.25,
      // back: how far up the sun's rays from the body's middle the shadow box starts (m)
      back: 3,
      // reach: how far past the body (down the rays) the shadow can still land (m): long low-sun shadows, walls, the yard
      reach: 14,
      // darkness: share of the sunlight the body takes away (1 = as dark as a house's shadow)
      darkness: 1,
      // soft: blur of the shadow's edge (m; 0 = the map's own 1-pixel smoothing, about 5 mm)
      soft: 0.012,
      // bias: [depth bias, normal bias] of the body's shadow map, against stripes and gaps at the feet
      bias: [-0.0005, 0.02],
    },
    low: {
      // body: no real body shadow on phones
      body: false,
      // blob: the soft dark ellipse under the feet, by day and by night
      blob: true,
    },
    blob: {
      // size: [across, front to back] of the ellipse (m)
      size: [0.62, 0.5],
      // dark: opacity at its middle (0 = none, 1 = black)
      dark: 0.42,
      // soft: share of the radius that fades out to the edge
      soft: 0.75,
      // lift: height above the floor (m), over the road (0.03 m), house floors (0.05 m) and debris (0.08 m) that lie above the ground
      lift: 0.1,
      // settle: the blob shows only while the eye is within this much of its height over the floor (m): hidden while the view still rises or sinks after the stairs or a drop, and on the ladder
      settle: 0.35,
    },
    body: {
      // hip / shoulder / headY: heights of the hip joint, the shoulder joint and the middle of the head (m); the eye is at 1.6 m (the camera), the crown at about 1.75 m
      hip: 0.94,
      shoulder: 1.42,
      headY: 1.63,
      // thigh / shin / upper / fore: lengths of the leg and arm bones (m)
      thigh: 0.43,
      shin: 0.42,
      upper: 0.29,
      fore: 0.26,
      // centre: height of the shadow box's middle above the feet (m)
      centre: 0.9,
    },
    motion: {
      // eyeFwd: how far the eyes sit in front of the body's middle (m): the body stands this far behind the camera
      eyeFwd: 0.08,
      // ease: how fast the body's speed follows the real speed (per second); higher = snappier start and stop
      ease: 7,
      // turn: how fast the body turns after the view (per second)
      turn: 14,
      // full: walking speed at which the stride reaches its full walk size (m/s); above it the stride grows toward a run
      full: 1.6,
      // cadence: steps per second = [a, b]: a + b times the speed in m/s
      cadence: [1.3, 0.4],
      // legSwing: thigh swing each way [walking, running] (rad)
      legSwing: [0.42, 0.72],
      // knee: knee bend at mid-swing [walking, running] (rad)
      knee: [0.7, 1.3],
      // bob: how far the body dips between steps (m)
      bob: 0.03,
      // lean: forward lean when running (rad)
      lean: 0.12,
      // sway: idle sway of the chest when standing (rad)
      sway: 0.02,
      // twist: most the hips turn toward the direction of travel when you walk sideways or backward (rad)
      twist: 0.7,
      // armRest: left arm at rest [shoulder forward, elbow bend] (rad); it swings against the left leg when walking
      armRest: [0.1, 0.35],
      // gunArm: right arm holding the cannon [shoulder forward, elbow bend, inward] (rad)
      gunArm: [0.45, 1.0, -0.15],
      // aimFollow: share of the view's up and down tilt that the cannon arm follows
      aimFollow: 0.6,
      // jump: a move faster than this (m/s) is a jump of the game's (stairs, ladder ends, entering a house), not a walk: the stride does not react to it
      jump: 12,
    },
  },
  // lucky cat looks, one per cat id (1, 2, 3...): body and head wraps painted in klad (art/cats/paint_<name>.sh), packed by tools/maketex.py; cat id k uses entry (k - 1) mod the list; the cat found in a house during a run uses entry (house index) mod the list
  catStyles: [
    { name: 'calico', body: 'catcalico_b', head: 'catcalico_h', glaze: 0xf6f1e6, earL: 0xd9822b, earR: 0x2b2420 },
    { name: 'kuro', body: 'catkuro_b', head: 'catkuro_h', glaze: 0x1e1b1e, earL: 0x1e1b1e, earR: 0x1e1b1e, eye: 0xd6a93a },
    { name: 'kutani', body: 'catkutani_b', head: 'catkutani_h', glaze: 0xf3ead8, earL: 0xa3242a, earR: 0xa3242a },
  ],
  cat: { inset: 0.9, radius: 0.9, energy: 20, coins: 1, count: 3, energyBonus: 5, lurePer: 0.12, lureLoot: 0.5, baseRadius: 2.0, chimeRange: 7 }, // night-test cat (radius/energy/coins); in the base: count (odd) cats hide, energy cat +energyBonus start energy, lure cat +lurePer Gloom and +lureLoot loot
  // ---- WORKSHOP YOU WALK INTO (owner Nov 16 23:32: "player can enter and there an npc to talk to. interior to be as solarpunk and density follow"; src/rooms.js, baseview.js vaultRoom)
  // on: the switch (false = the old closed vault whose panel opens at its door). wall: wall thickness (m). door: [opening width, height where the round arch starts] (m).
  // floor: top of the plank floor inside (m; Oko stands on it). prompt: how near the doorway (m) 'Workshop: go inside' shows. tell: seconds after you arrive before Marla's one workshop line.
  // oko: Oko's place in the room [x, z] from the workshop centre (behind the bench, facing the door); near / far: she turns to you inside near m and back to the bench beyond far m;
  //   work: [seconds bent over the bench, seconds standing back]; turns: small turns (rad) toward the trays she works at, one per work spell; look: the bench point she watches [ahead m, height m].
  // light: one warm lamp in the room [colour, strength, reach m], high = desktop, low = phones (0 strength: no lamp; phones keep the light count of the rest of the base).
  // high (desktop dressing, src/rooms.js workshopHi): boards = planks lining the vault, jars = jars on the side shelves, cells = glass battery cells in the bank, bulbs = work lights over the bench,
  //   parts = loose parts in the bench trays, tools = tools on the pegboard, plants = trailing leaves per hanging pot, cyan = glow strength of the sea-green battery cells and charged glass. low (phones, workshopLow): jars, cells.
  // ry: turn of the workshop (rad; PI = its door faces the plaza, -z; owner Nov 17: 'door to face the plaza'; 0 = the old way round).
  workshop: { on: true, ry: Math.PI, wall: 0.3, door: [1.8, 1.7], floor: 0.06, prompt: 3.4, tell: 1.5,
    // oko.loop (Nov 17, src/okowork.js): her hands at the bench, layered on the people motion. keys = [time s, right upper arm, right forearm, right hand bend, right hand roll,
    //   left upper arm, left forearm, left hand bend, forward lean] (rad, added to her standing pose; negative arm = forward / bent up): reach a tray, grasp, lift to the chest, turn the
    //   part one way and back, set it down, the left hand takes a small tool and taps (tap = [taps per s, size rad, from s, to s]); ease = seconds the arms take to come up or drop
    oko: { at: [0, -1.25], near: 2.7, far: 3.2, work: [16.4, 3.0], turns: [-0.3, 0.1, 0.3, -0.1], look: [0.55, 0.95], ease: 1.4,
      loop: { keys: [[0, -0.45, -0.35, 0.1, 0, -0.4, -0.35, 0.1, 0.1], [1.0, -0.78, -0.15, 0.3, 0, -0.4, -0.35, 0.1, 0.14], [1.5, -0.78, -0.2, 0.5, 0, -0.4, -0.35, 0.1, 0.14], [2.6, -0.6, -0.95, -0.1, 0, -0.5, -0.6, 0, 0.06],
        [3.4, -0.6, -0.95, -0.1, 0.55, -0.5, -0.6, 0, 0.06], [4.4, -0.6, -0.95, -0.1, -0.4, -0.5, -0.6, 0, 0.06], [5.0, -0.6, -0.95, -0.1, 0, -0.5, -0.6, 0, 0.06], [6.0, -0.78, -0.2, 0.35, 0, -0.4, -0.35, 0.1, 0.12],
        [6.5, -0.45, -0.35, 0.1, 0, -0.68, -0.4, 0.15, 0.12], [7.8, -0.45, -0.35, 0.1, 0, -0.68, -0.4, 0.15, 0.12], [8.2, -0.45, -0.35, 0.1, 0, -0.4, -0.35, 0.1, 0.1]], tap: [2, 0.12, 6.6, 7.7],
        // part = [from s, to s] the right hand holds a copper part (picked up, turned, set down); tool = [from s, to s] the left hand holds a small tool for the taps
        part: [1.45, 6.0], tool: [6.4, 7.95] } },
    light: { high: [0xffd29a, 2.2, 7], low: [0xffd29a, 0, 0] },
    high: { boards: 22, jars: 16, cells: 8, bulbs: 3, parts: 26, tools: 9, plants: 3, cyan: 0.9 },
    low: { jars: 5, cells: 4 } },
  // ---- MARLA'S HOUSE (owner Nov 16 23:35: "marla need a house. in her house same density and a journal ... every trip to add a single line"; src/rooms.js, baseview.js vaultRoom)
  // on: the switch. at: [x, z] of its centre in the base; ry: turn (rad; PI/2 = the door faces the plaza, +x); w / d: outside size across the door / deep (m); h: wall height (m); k: vault height as a share of its width; wall: wall thickness (m);
  // door: [opening width, height where the arch starts] (m); floor: plank floor top (m); windows: round front windows [x offset, height, radius]; desk: [x, z] of the journal on the desk (room frame, m);
  // read: how near the journal (m) you can read it; ribbon: the unread mark [glow strength, glow size m]; light: warm lamp [colour, strength, reach m] per tier as in workshop.light.
  // high (desktop dressing, src/rooms.js marlaHi): pins = map pins, figures = carved figures on her shelf, boards = planks lining the vault, plants = trailing leaves per hanging pot,
  //   herbs = bundles drying from the beam, bulbs = warm solar bulbs strung under the front of the vault. low: nothing to count.
  marlaHouse: { on: true, at: [-12.5, 0.4], ry: Math.PI / 2, w: 4.4, d: 3.6, h: 2.7, k: 0.62, wall: 0.28, door: [1.5, 1.55], floor: 0.06, windows: [[-1.35, 1.8, 0.38], [1.35, 1.8, 0.38]],
    desk: [1.15, -1.12], read: 1.5, ribbon: [1.6, 0.42], light: { high: [0xffcf9a, 1.8, 6], low: [0xffcf9a, 0, 0] },
    high: { pins: 20, figures: 7, boards: 18, plants: 3, herbs: 7, bulbs: 10 } },
  // ---- JOURNAL BOOKS (owner Nov 17 11:04: "Marla's journal or any journal should display like pages of book in ink"; round 2 owner Nov 17 13:22; src/book.js, src/booksketches.js, the .bk rules in index.template.html)
  // Your journal (desk at home, with the field guide) and Marla's private journal open as a book written in ink; the workshop, board, crew and kit panels are unchanged.
  // Values given as [a, b, c] are per layout: [a = two-page spread (desktop, laptop), b = one page (phone held upright), c = one wide page on a short screen (phone held sideways)].
  book: {
    // spreadMinW / spreadMinH: the screen must be at least this wide and this tall (CSS px) for the two-page spread; spreadMinAspect: and at least this many times wider than tall;
    //   otherwise one page at a time; shortMaxH: a one-page screen lower than this (px) gets the wide short-screen layout c
    spreadMinW: 720, spreadMinH: 520, spreadMinAspect: 1.15, shortMaxH: 520,
    // gap: px kept free round the book; ribbonOut: px the Close ribbon sticks out above the book; nav: size (px) of the page-turn corner buttons
    gap: [14, 10, 8], ribbonOut: [34, 34, 26], nav: 46,
    // pageMaxW: widest a page gets (px); pageMinW: narrowest (px); cover: px of the cover board showing round the pages
    pageMaxW: [500, 500, 820], pageMinW: 250, cover: 7,
    // lines: ruled lines of text per page [fewest, most] (the page height follows the screen between them); head / foot: blank ruled lines above the text and below it (the page number and corner buttons sit in the foot)
    lines: [6, 22], head: 1, foot: 2,
    // rule: ruled-line spacing in px; padR: px kept free at the right edge of the text
    rule: [30, 29, 25], padR: 20,
    // lift: px the ruled line sits above the bottom of each line of text, so the ink rests on it (per hand: Kalam sits higher in its line than Caveat)
    lift: { player: 7, marla: 6 },
    // player / marla: font = handwriting (embedded, src/bookfonts.js); size = text px; title = heading px; small = px of sub-headings and margin labels; margin = left margin width px
    //   (Marla's "First day." / "Trip n." labels sit in it: "First day." is 79 px wide at 24 px Caveat, so her margin is at least 96); ink = ink colour; bleed = the soft ink-bleed shadow;
    //   fresh = a line not read before (wet ink: darker), freshBleed = its wetter bleed; cover = the book's cover board; ribbon = the Close ribbon.
    //   Caveat's small letters measure 0.65 of the menu font's at the same size (tools/bookcheck.cjs), so Caveat 24 px reads like 15.7 px of the menu font: keep marla.small and marla.size at 24 or more
    player: { font: 'Kalam', size: [18, 17, 16], title: [27, 27, 24], small: [17, 17, 15], margin: [74, 62, 70], ink: '#1c2546', bleed: '#1c254640', fresh: '#0b1230', freshBleed: '#0b1230a0', cover: '#2d4a43', ribbon: '#2f5a86' },
    marla: { font: 'Caveat', size: [26, 25, 24], title: [34, 34, 30], small: [24, 24, 24], margin: [96, 96, 96], ink: '#3b2516', bleed: '#3b251640', fresh: '#1a0b03', freshBleed: '#3a1a05b0', cover: '#5a2a22', ribbon: '#a3302a' },
    // pencil: graphite grey for pencilled notes ("(private)", "not met yet"); pencilSize: their px per hand and layout
    pencil: '#55524c', pencilSize: { player: [16, 16, 15], marla: [24, 24, 24] },
    // paper: page colour; gutter: the shade toward the spine; gutterW: share of the page width the shade covers; rule: ruled-line colour; marginLine: the margin line colour;
    //   grain: fine paper grain strength (0..1); fibre: long paper fibre strength (0..1); edge: the stacked page edges; desk: what shows behind the book
    paper: { base: '#f5eedb', gutter: '#d6c8a6', gutterW: 0.16, rule: '#a9bccd', marginLine: '#d8968c', grain: 0.10, fibre: 0.07, edge: '#e2d6b8', desk: '#120c08e6' },
    // jitter (seeded by the line's words, the same every time the book opens): rot = most a line tilts (degrees), dy = most it rides off the rule (px), dx = most it shifts sideways (px),
    //   rise = most px the far end of a line may rise or drop from its tilt (wide pages tilt less)
    jitter: { rot: 0.5, dy: 1.5, dx: 2, rise: 3 },
    // fresh ink on a line not read before: it shows wet (fresh colour, freshBleed, sheen highlight, a blot of blot px at the line start) once its page is on screen,
    //   stays wet for wet ms, then dries to the normal ink over dry ms (no flashing); blotDry = how much of the blot stays once dry (0..1)
    ink: { wet: 500, dry: 1700, sheen: '#fff8e2c0', blot: 8, blotDry: 0.35 },
    // turnMs: page-turn animation (ms); swipe: px a finger must slide sideways to turn a page;
    //   sketch: device ink sketch size in the field guide (px; at most two ruled lines tall, the name sits on the second); sketchStroke: its pen width (in the sketch's 64-unit box)
    turnMs: 260, swipe: 40, sketch: [58, 50, 44], sketchStroke: 2.3,
  },
  // ---- LORE PIECES (owner Nov 17 16:25; texts word for word from docs/lore_notes.md in src/lore.js; drawn by the "lore notes" block of src/main.js)
  lore: {
    // chance: share of street houses that hold a note (rolled once per house per run, while unfound notes are left; 1 = every house)
    chance: 0.5,
    // spots: furniture a note may lie on (sim furniture kinds); a house with none of them gets a small pinboard on a free wall instead
    spots: ['table', 'desk', 'dresser'],
    // onTop: [across, along] metres from the middle of each kind's top where the note lies (clear of the plates and books on it)
    onTop: { table: [0.28, -0.32], desk: [-0.3, 0.08], dresser: [0.05, -0.08] },
    // topY: [lowest, highest] height (m above its floor) a table top may be found at by the downward ray; outside it the pinboard is used
    topY: [0.55, 1.25],
    // board: the pinboard [width, height, thickness] (m), its height above the floor (m), its gap from the wall face (m); doorKeep: least distance (m) from a door on the same wall line
    board: [0.62, 0.46, 0.025], boardY: 1.45, boardGap: 0.01, doorKeep: 2.6,
    // stairKeep: least distance (m) from the ground floor's ladder foot or stair foot (sim zoneRadius 0.7 markers climb when stepped on); reading spots 1.1 m in front stay off them
    stairKeep: 2.0,
    // paper: the note's size [width, depth] (m); glint: [size m, least, most opacity, pulses per second]
    paper: [0.21, 0.15], glint: [0.16, 0.12, 0.55, 0.6],
    // reach: how close (m) you must be to read it; aimCos: how straight you must look at it (cosine; within 0.9 m you need only face it roughly, nearCos)
    reach: 1.9, aimCos: 0.8, nearCos: 0.3,
    // sayPrio: priority of the desktop "E: read note" line in the interface's centre queue (CONFIG.ui.centre): above Marla's lines 4, under one-time cards 5. It shows only while
    //   you stand at a note looking at it. At 2.5 a flash on entering a house hid it; at 3.5 Marla's first-run "place Solar" reminder (repeated every 4 s until you do) hid it all the first run
    sayPrio: 4.5,
    // day: readable by day only (the prop stays at night but has no prompt or glint, so it never gets in the way of the defence)
    day: true,
    // the note page in the ink book: hand = the writing (same fields as CONFIG.book.player), lift / pencil = its line lift and pencil sizes, page = its paper colours
    hand: { font: 'Caveat', size: [26, 25, 24], title: [30, 30, 27], small: [24, 24, 24], margin: [40, 34, 40], ink: '#20305e', bleed: '#20305e40', fresh: '#101a40', freshBleed: '#101a40a0', cover: '#3a3a30', ribbon: '#6a6a58' },
    lift: 6, pencil: [24, 24, 24],
    page: { base: '#efe5cc', gutter: '#d9caa6', gutterW: 0.0, rule: '#b9c4cc', marginLine: '#d8a69c', grain: 0.14, fibre: 0.1, edge: '#ddd0b0', desk: '#120c08e6' },
    // jobCardSecs: the one-time "Your job" card closes by itself after this many seconds (else on its button, a tap on it, Enter, E or Escape; moving and looking never close it)
    jobCardSecs: 15,
    // notices: old notices on the quest board: shown = how many at once, every = days before the next one comes round
    notices: { shown: 3, every: 2 },
  },
  // ---- AVIANS and the HATCHERY (owner Nov 17: living scenery AND a small loop; ordinary hens plus our own Sunquill, a moss-green hen with a copper sun-crest). src/flock.js (rules), src/hatchery.js (look and birds).
  // on: the switch. at: [x, z] centre of the hatchery corner (between the workshop's back and the pond path). start: a new game's flock [hens, Sunquills]; oldStart: hens an older save gets.
  // eggsPerHen: eggs each grown bird lays a day (into the coop), coopMax: most eggs the coop holds; slots: eggs the incubator warms at once; hatchDays: days an egg takes; growDays: days a chick takes to grow;
  // sunquillChance: share of hatches that are Sunquills (seeded per save, day and egg); maxFlock: grown birds + chicks + eggs in the incubator at most;
  // foodPerHen: food a day from each grown bird (Sunquills too); seedPerSunquill: seeds a day from each Sunquill (no pay on a night you walked out of, as with the crew's income).
  // tell: seconds after you arrive before Marla's one hatchery line. evening: seconds in the base before the birds go to roost (the light warms and dims over dusk seconds; 0 = never).
  // reach: how near (m) the nest boxes and the incubator answer E. walk / run: bird walking and fleeing speed (m/s); flee: how near (m) a running player sends them off; runSpeed: player speed (m/s) that counts as running.
  // peck / scratch / look / flutter: [shortest, longest] seconds of each behaviour; chick: [how far behind its hen (m), how many a hen leads at most].
  // high / low: birds drawn on desktop / phones at most (the rest are 'in the coop'), and their detail (seg = roundness, feathers = tail and wing feathers);
  //   chicks = chicks drawn at most, on top of the birds (a full phone flock left no room, so a new chick was never seen on a phone).
  avians: { on: true, at: [5.1, 12.0], start: [5, 1], oldStart: 3, eggsPerHen: 1, coopMax: 12, slots: 3, hatchDays: 2, growDays: 2, sunquillChance: 0.15, maxFlock: 10, foodPerHen: 1, seedPerSunquill: 1,
    // eveLight: at full dusk the sky light is [this share] of day, the picture exposure [this share] (main.js, base only)
    eveLight: [0.5, 0.7],
    tell: 2.0, evening: 420, dusk: 40, reach: 1.5, walk: 0.32, run: 1.6, flee: 2.6, runSpeed: 3.0, peck: [1.5, 3.5], scratch: [1.2, 2.5], look: [1.0, 2.5], flutter: [0.5, 0.8], chick: [0.45, 3],
    high: { birds: 10, chicks: 4, seg: 16, feathers: 7, crest: 9 }, low: { birds: 5, chicks: 2, seg: 8, feathers: 3, crest: 5 } },
  // ---- AMBIENT VILLAGE CATS (owner Nov 17 11:40: "cats strolling or lazing around"; living scenery only). src/catwalk.js (where they go), src/villagecats.js (how they look and move).
  // The jam's HIDDEN LUCKY CAT rule: no white coats, no collars / bells / coins, no raised-paw pose, no sound; never within keepAway m of a lucky-cat hideout (CAT_SPOTS) or your home's cat shelf.
  // on: the switch. count: cats on desktop / phones. walk / trot: strolling / moving-off speed (m/s); flee: how near (m) a running player (over runSpeed m/s) makes one move off; jump: seconds of a hop onto a perch.
  // stay: [shortest, longest] seconds at a spot; acts: how long each resting act lasts [shortest, longest] (s); flick: tail-flick strength (rad) and how often (per s); keepAway: (m) see above.
  // nodes: [x, z] points on the paths they stroll between; edges: which nodes join; spots: where they laze [x, z, height, facing (rad), tier ('both' / 'high' = desktop only, perch exists only there / 'low'), acts, node];
  //   acts: loaf (paws tucked), sleep (curled), groom, sit, watch (the hens or the pond), stretch. dusk: where they go at evening [x, z, height, facing, node, way in [[x, z], ...]] (under the coop, Marla's rug, the workshop).
  villageCats: { on: true, count: { high: 5, low: 3 }, walk: 0.42, trot: 1.5, flee: 2.6, runSpeed: 3.0, jump: 0.5, stay: [25, 60], acts: [5, 12], flick: [0.35, 0.25], keepAway: 3,
    // idle life (advisor round 2, Nov 17: a living cat never sits fully still, so a still dark cat cannot pass for a lucky-cat figurine): breathe = [breaths per s at rest, how much the chest swells (share)],
    //   asleep half as fast; blink = [seconds between blinks, shortest, longest; blink length s] (desktop: phones merge the eyes into the head; asleep the eyes stay shut);
    //   twitch = [seconds between ear flicks, shortest, longest; size rad; length s] (desktop: the ears flick; phones: the head gives a small shake of this size / 4 instead)
    breathe: [0.45, 0.03], blink: [2.5, 6, 0.14], twitch: [2.5, 7, 0.45, 0.28],
    nodes: [[2.6, 0], [0, 2.6], [-2.6, 0], [0, -2.6], [-6.0, -2.2], [-6.4, 5.0], [6.0, -2.4], [6.3, 4.3], [0, 6.5], [0, 9.8], [2.0, 9.0], [4.4, 8.6], [7.8, 10.0], [-9.4, 0.9], [0, -6.4], [9.0, 4.3]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [2, 5], [5, 1], [0, 6], [0, 7], [7, 15], [1, 8], [8, 9], [8, 10], [10, 11], [11, 12], [2, 13], [3, 14]],
    spots: [[2.15, 11.8, 0.47, 1.571, 'both', 'watch,loaf,groom', 10], [3.75, 9.72, 0, -1.2, 'both', 'sleep,loaf', 11], [1.9, -1.9, 0, 0.8, 'both', 'loaf,sleep,groom,stretch', 3], [-2.1, 2.2, 0, 2.4, 'both', 'loaf,groom,sit', 1],
      [-10.75, -2.66, 0.47, 1.571, 'high', 'sleep,loaf', 4], [-10.64, 1.75, 1.41, 1.571, 'high', 'loaf,watch', 13], [6.18, 7.95, 0.33, 3.142, 'high', 'loaf,sleep', 7], [6.1, 6.0, 0, 3.142, 'low', 'loaf,groom', 7],
      [-1.5, 9.5, 0, -1.2, 'both', 'watch,sit,loaf', 9], [5.3, 9.95, 0, 0, 'both', 'watch,sit', 11]],
    dusk: [[7.3, 12.3, 0, 3.142, 12, []], [-12.25, 0.25, 0.06, -1.571, 13, [[-10.4, 0.4], [-11.4, 0.4]]], [8.2, 5.8, 0.06, 0.4, 15, [[9.0, 4.6], [9.0, 5.6]]]] },
  // ---- BASE WATER (owner Nov 17 16:01: "add in waterwheel in solarpunk style in the base ... no water and quite bare for a base"); src/baselife.js (layout, walking), src/basewater.js (drawing).
  // on: the switch (false = no stream, wheel, bridges or flumes; walking as before).
  // stream: the stream's centre line [x, z] (m), from under the north hedge, down the wheel race, past the back of the garden, out under the east hedge.
  //   y: water surface height (m; the ground is 0, the bank tops too: the water lies 0.15 m below them); block: how far past the bank top walking stops (m); flow: how fast the water's ripples run (m/s).
  // bed: the channel sunk into the ground (round 2, owner 21:46): depth (m), floor = half width of its flat bed, top = half width at the bank tops (smooth slopes between), race = half width to the race walls' outer face (cut straight down there).
  // ramp: length (m) of the ramp at each end of a footbridge from the ground up to its deck; camEase: how fast your view rises and falls with a deck (per s; src/main.js).
  // under: while the base is shown, the scene's dark under-plane (src/main.js, normally 0.08 m below the ground) drops this far (m) so it never shows through the channel.
  // race: [i, j] = the straight run of the stream (points i to j) that is the wheel's stone-and-timber race; the wheel sits at its middle.
  // wheel: R = radius to the paddle tips (m), width = between the rims (m), paddles = curved paddles, spokes = per rim, speed = turning speed (rad/s, always turning), dip = paddle tips below the water (m).
  // gen: the bloom-tech generator housing beside the wheel: side (-1 = west bank, 1 = east), off = from the stream's centre (m), ry = its turn (rad; 0 = its window and gauge face +z, the north lane), size [w, h, d] (m); cable = poles [x, z] the cable runs over to your home.
  // bridges: timber footbridges [x, z, length, width] (m) where the north lane / the hunters' rounds (z -15) and the east lane / the hunters' rounds (x 15, on the deck's near half) cross; the deck runs across the stream.
  // flume: wooden channels from a sluice on the stream to the garden: main = points [x, z] from the sluice into the greenhouse and along its planters; beds = the branch to the raised beds.
  // high / low: desktop / phone detail. stones / reeds / ferns per metre of bank; seg = stream cross pieces per metre; wheelSeg = rim roundness; foam = foam flecks at the wheel; drops = splash drops; moss = moss lumps on the race.
  baseWater: { on: true,
    stream: [[8.9, -28.5], [8.7, -24.5], [8.4, -21.0], [8.0, -19.4], [8.0, -16.0], [8.2, -13.2], [8.8, -10.7], [10.2, -9.3], [12.4, -8.4], [14.8, -7.4], [17.5, -6.4], [20.5, -5.5], [23.5, -4.8], [28.5, -4.0]],
    y: -0.15, block: 0.0, flow: 0.45, race: [3, 4], ramp: 0.7, camEase: 8, under: 0.75,
    bed: { depth: 0.62, floor: 0.5, top: 1.45, race: 0.94 },
    wheel: { R: 1.8, width: 0.95, paddles: 16, spokes: 8, speed: 0.55, dip: 0.28 },
    gen: { side: -1, off: 2.5, ry: 0, size: [1.5, 1.35, 1.25], cable: [[5.0, -14.4], [4.0, -12.9], [3.2, -11.9]] },
    bridges: [[8.05, -15.0, 4.4, 1.45], [15.55, -7.15, 4.4, 1.45]],
    flume: { main: [[12.52, -7.25], [12.55, -6.3], [12.4, -5.95], [6.4, -5.95]], beds: [[12.55, -6.3], [13.0, -6.3], [13.0, -5.2]] },
    // sound (round 2, owner 21:46 / 21:48): a soft stream (filtered noise), trickle grains and a wheel creak, made in Web Audio (no files); ONLY in the base (0 on the street, title, opening, night, boss and in panels).
    //   vol: loudest level as a share of the music volume (follows the music switch); reach: how far (m) from the stream it fades out; wheel: extra near the wheel within wheelReach m;
    //   creak: [seconds per turn of the wheel, creak strength]; trickle: grains per second near the water; indoor: [level share, low-pass Hz] inside a room; fade: seconds to fade in and out.
    sound: { on: true, vol: 0.55, reach: 16, wheel: 0.5, wheelReach: 9, creak: [3.2, 0.5], trickle: 7, indoor: [0.35, 700], fade: 1.0 },
    high: { stones: 2.6, reeds: 3.2, ferns: 0.9, seg: 3, wheelSeg: 40, foam: 60, drops: 48, moss: 30 },
    low: { stones: 0.8, reeds: 0.8, ferns: 0, seg: 1, wheelSeg: 16, foam: 0, drops: 0, moss: 0 } },
  // ---- BASE LIFE (owner Nov 17 16:01 "quite bare", 16:02 "and only 2 house", 16:03 "additional house when recruit come in"); src/baselife.js (layout, plots), src/basevillage.js (drawing).
  // on: the switch (false = the base as before). bound: how far from the middle you can walk (m; CONFIG.base.bound when off); hedge: the hedge ring's radius (m), just outside bound.
  // houses: the villagers' own houses (closed; not entered): id, sign = the nameplate, at [x, z] (m; the door faces the plaza), w / d / h = width, depth, wall height (m), wall / accent colours,
  //   roof: 'garden' (green on both sides) / 'solar' (solar petals on the sunny side) / 'roofgarden' (planted boxes on a flat top), extra: 'porch' / 'leanto' / 'panels' / 'lookout', hobby: what stands outside.
  // pieces: the lived-in set pieces at [x, z] (m) and their turn (rad; null = face the plaza): fire = bench circle and fire pit [x, z, radius], stall = produce stall, hives = bee hives in a row,
  //   cold = cold frame and raised beds by the greenhouse, compost = compost bays, rack = solar herb drying rack, tower = water tower, wash = hand pump and washing trough (laundry lines between them and the houses).
  // lanes: trodden paths [[x, z], ...] to the houses and over the bridges (width m); lamps = lanterns along them (every m), planters = planter boxes along them (every m).
  // high / low: desktop / phone detail (leaves per window box, laundry pieces per line, flowers, round = roundness of curved parts).
  // rounds: the hunters' rounds go over the east footbridge on the way from (15, -15) to (15, 15): [x, z] points before and after its deck, past the ramps, on the deck's own line
  // (m; turning on a ramp took the walker off the deck's side, where its height drops at once; the north bridge already sits on their z -15 line).
  baseLife: { on: true, bound: 25, hedge: 26.2, rounds: [[16.82, -10.52], [14.28, -3.78]],
    houses: [
      { id: 'bram', sign: 'BRAM', at: [20.5, 1.0], w: 4.2, d: 3.4, h: 2.55, wall: 0xf0e4c8, accent: 0x3f8f6a, roof: 'garden', extra: 'porch', hobby: 'bram' },
      { id: 'pip', sign: 'PIP & FAMILY', at: [-21.0, 2.0], w: 4.4, d: 3.4, h: 2.6, wall: 0xf2dcc4, accent: 0xc8783a, roof: 'solar', extra: 'lookout', hobby: 'pip' },
      { id: 'wen', sign: 'WEN', at: [19.0, -12.0], w: 4.0, d: 3.2, h: 2.5, wall: 0xe4ead8, accent: 0x3a7ac0, roof: 'roofgarden', extra: 'panels', hobby: 'wen' },
      { id: 'crew', sign: 'INES & TOMAS', at: [0.0, -20.0], w: 4.6, d: 3.4, h: 2.6, wall: 0xeee0c0, accent: 0xb8584a, roof: 'solar', extra: 'leanto', hobby: 'crew' }],
    // recruitHouses: a house for each NEW recruit (the three you start with live in the villagers' houses above). plots: [x, z] (m) in the order they are given out (the door faces the plaza);
    //   w / d / h: the house size (m). The day a recruit joins, their plot shows a timber frame with scaffolding and their nameplate; from the next day (after a night) it is a finished house
    //   with a detail of their role (hunter: bow rack, gatherer: baskets, researcher: instruments). Free plots show cleared ground with marker stakes and string.
    //   More recruits than plots: the extra ones WAIT (no house) until there is a plot; with 6 plots and CONFIG.base.maxPersonnel 9 (3 start + 6 recruits) everyone gets one.
    recruitHouses: { on: true, plots: [[6.0, 19.5], [-6.0, 19.5], [19.0, 6.5], [-19.5, 8.0], [-21.5, -4.0], [-8.0, -20.5]], w: 3.8, d: 3.2, h: 2.45 },
    pieces: { fire: [-8.8, 6.6, 1.7], stall: [16.9, -3.0, null], hives: [-17.8, -5.6, null], cold: [13.35, -4.15, 0], compost: [11.5, 12.4, 0], rack: [-3.6, -16.6, 0], tower: [0, 21.6, 0], wash: [0, 18.9, 0] },
    lanes: { width: 1.1, lamps: 7, planters: 9,
      paths: [[[-8.0, -18.4], [-4.2, -17.6], [0.0, -17.7], [4.4, -16.3], [6.4, -15.1], [9.7, -15.0], [12.0, -14.6], [15.2, -13.9], [17.3, -11.3]],
        [[17.3, -11.3], [16.2, -10.0], [15.9, -9.0], [15.2, -5.4], [15.6, -4.6], [17.0, -1.6], [18.8, 0.9]], [[18.8, 0.9], [18.0, 3.6], [17.5, 5.9]],
        [[-19.4, -3.6], [-18.3, -1.4], [-18.2, 1.8], [-18.3, 5.0], [-17.9, 7.4]], [[-18.3, 5.0], [-15.0, 5.4], [-11.6, 5.6], [-10.4, 6.0]],
        [[-5.5, 17.9], [-2.6, 17.2], [0.0, 17.3], [2.6, 17.2], [5.5, 17.9]], [[0.0, 14.0], [-1.7, 15.7], [-0.6, 17.3]]] },
    // plants (round 2, owner 21:46): layered plants (src/baseplants.js: herbs, leafy greens, flowering shrubs, ferns, flowering perennials; one instanced mesh per kind) on DESKTOP; phones keep the leaf fans.
    //   on: the switch; rollout: false = only the sample bed (Bram's front bed) uses them, true = every bed, window box, pot, planter and the stream's ferns; size: scale per kind.
    plants: { on: true, rollout: true, size: { herb: 1, leafy: 1.25, shrub: 1, fern: 1.2, flower: 1 } },
    high: { boxLeaves: 14, laundry: 7, flowers: 10, round: 20, ivy: 40 },
    low: { boxLeaves: 0, laundry: 4, flowers: 0, round: 10, ivy: 0 } },
  // The base (dawn): explorable, personnel with roles, quests, the Scout who takes you out on a collection run
  // base HUD (declutter, user: the base HUD covered half the screen): labelD0 = distance (m) at which a name label shows full size, nearer it shrinks (never below labelMin); people's labels fade out beyond npcFar m;
  // questLines = quest lines shown while the box is closed (tap it or press Tab to open it all); questOpen = seconds it stays open; msgFade = seconds a base message stays
  baseHud: { labelD0: 9, labelMin: 0.35, npcFar: 10, questLines: 1, questOpen: 8, msgFade: 4 },
  // INTERFACE FIX PASS (simulated player panel docs/panel_interface_review.md; owner chose all fix groups, Nov 17 16:30). src/main.js, src/hud2.js and index.template.html read these.
  ui: {
    // ONE text at a time in the centre column and Marla's spot (coordinator, advisor round 2): the highest number with something to say shows, the others wait hidden (their text is kept).
    // boss = boss shouts and warnings, card = one-time cards (the lore "Your job" card), marla = Marla's lines, msg = short flashes, aim = machine line or dormant tag, mlook = "click to look", bprompt = objective / use prompt.
    // Other code adds its own lines with H2.say(kind, text, prio, secs) from src/hud2.js (or window.__hud.say); prio defaults to the number here for that kind, else sayPrio.
    centre: { boss: 6, card: 5, marla: 4, msg: 3, aim: 2, mlook: 1, bprompt: 0 },
    // default priority and seconds on screen for a line added with H2.say whose kind is not listed above
    sayPrio: 3.5, saySecs: 4,
    // the desktop key strip hides by itself once this many nights are done (H shows it again; the player's own choice is remembered)
    keysAfterNights: 1,
    // the one name for the charge resource, used on every label, cost and line
    sun: 'Sun',
    // colour of the small sun icon beside the Sun number and every cost
    sunIcon: '#ffd24a',
    // the solid dark backing behind text that sits over the 3D scene (prompts, flashes, machine line, Marla's line, count lines, key strip)
    backing: '#07120ee8',
    // smallest text: desktop and phone (px); the count lines, the base line, the quest box and the title menu use these or more
    minPx: [13, 14],
    // the count line under the clock: desktop px, phone px
    countPx: [14, 15],
    // smallest tap target on a phone (px, both sides)
    tap: 44,
    // phone device buttons: width, height (px) and picture size (px)
    devBtn: [72, 70, 42],
    // crosshair: size px, line px, its dark outline, and the colour for nothing under it / something to use or talk to / a machine (awake or asleep). Shape changes too: plain ring / ring with a dot / ring with four ticks.
    cross: { size: 18, line: 2, outline: '#000000', neutral: '#ffffff', use: '#5cf0a0', gloom: '#ff3a3a' },
    // the off-screen threat arc's colour (amber, so it never matches the red machine crosshair)
    arc: '#ffb02e',
    // thin bar under each clock: height px, fill by day (daylight left) and at night (night passed, dawn coming), empty part
    clockBar: { h: 4, day: '#ffd978', night: '#8fd0ff', bg: '#00000099' },
    // floating name labels in the base: backing colour, text outline colour and width (px on the 256 px label)
    label: { bg: 'rgba(6,16,12,0.94)', stroke: '#000000', strokeW: 6,
      // room left and right of the text on the label canvas (px of the 64 px tall canvas)
      pad: 14 },
    // hide a building's floating label within this many metres when its own painted sign is readable (desktop dressing has signs on these; phones only the hatchery)
    signHide: { near: 8, high: ['Storage', 'Your home', 'Workshop', "Marla's place", 'Hatchery'], low: ['Hatchery'] },
    // Oko in the workshop: "Talk to Oko" shows when you are this close (m) and she is the target
    okoTalk: 3.2,
    // the gold "+N Sun" pop by the Sun bar when the boss spills Sun: seconds on screen, colour
    sunPop: { secs: 1.5, color: '#ffd24a' },
  },
  // NIGHT-1 DRILL (owner, Nov 17 18:28): the first night teaches one action per step on a real, single Gloom; the night clock waits until the drill is done or skipped. src/main.js drill*.
  drill: {
    // master switch
    on: true,
    // seconds into the first night before the drill starts (the clock is then held there)
    startAt: 2,
    // seconds without the step's action before Marla repeats it once, shorter
    idle: 20,
    // and at least this many seconds of game time: a slow machine whose frames take longer than idle (a new machine's first draw) still shows the full order for a few frames before the repeat
    idleGame: 3,
    // seconds a Marla drill line stays up; 0 = until the step changes (a slow machine took longer than 30 s to show it)
    lineSecs: 0,
    // the key that skips the rest of the drill (desktop); phones get a Skip button
    skipKey: 'KeyK',
    // localStorage key where done steps (or a skip) are kept
    store: 'dawnpunk.drill',
    // the device picked when the drill starts (it can be placed anywhere, so the place step cannot dead-end; if it is not carried, the cheapest one is picked)
    device: 'lance',
    // the eat step: if health is above this share of full, a scratch takes it down to it so eating means something
    eatHp: 0.6,
    // TAMED LESSON MACHINE (fresh-player review Nov 18: every unaided first-timer died inside the lesson). Until the shoot step is done the machine walks at this share of its speed
    shootSpeed: 0.5,
    // and halts this far (m) from you, facing you, without striking (arm's length is CONFIG.gloom.reach 1 m): it looms, it does not hit
    shootStop: 2.6,
    // the later lesson steps (place, switch, charge, eat): the machine's speed share
    laterSpeed: 0.8,
    // and its damage to you as a share of normal (a Walker then hits for 8 x this about once a second), so it still hurts
    laterDmg: 0.4,
    // while the lesson runs your health never falls under this (it is never raised by it), so the lesson cannot kill you; under eatHp x 100, so the eat step still means something
    hpFloor: 25,
    // steps in order: id (the action that ends it), the Gloom kind that comes for it, Marla's line on desktop and on a phone (44 characters or fewer, Potts),
    // her shorter repeat, the desktop key chip, and the phone button that pulses (sel = the picked device, switch = the switch tab)
    // fresh-player fix (owner Nov 18): subD / subP = the plain second line under her order (desktop names the key, phone names the button); mark = the drill machine gets the pulsing ring (or an edge arrow) during this step
    steps: [
      { id: 'shoot', kind: 'walker', desk: "One machine. Shoot it, Potts. Left click.", phone: "One machine. Tap FIRE, Potts.", again: "Shoot. It. Now.", chip: 'Left click', btn: 'bFire', mark: true,
        subD: 'Aim at the ringed machine and left click to fire.', subP: 'Aim at the ringed machine and tap FIRE.' },
      { id: 'place', kind: 'walker', desk: "Device in its path. Right click. Go.", phone: "Device in its path. Tap the device.", again: "Device. Path. Today, Potts.", chip: 'Right click', btn: 'sel', mark: true,
        subD: 'Right click to place it where they walk in.', subP: 'Tap the glowing device to place it where they walk in.' },
      { id: 'switch', kind: 'walker', desk: "Swap devices. 1 to 5, or the wheel.", phone: "Swap devices. Tap the switch tab.", again: "Swap it. Not hard.", chip: '1-5 / wheel', btn: 'bSwitch', mark: false,
        subD: 'Press another number (1 to 5) or roll the mouse wheel.', subP: 'Tap the switch tab, then tap another device.' },
      { id: 'charge', kind: 'walker', desk: "Hold left click till it glows. Let go.", phone: "Hold FIRE till it glows. Let go.", again: "Hold. Glow. Release.", chip: 'Hold left click', btn: 'bFire', mark: true,
        subD: 'Hold the left button until the ring turns gold, then let go.', subP: 'Hold FIRE until the ring turns gold, then let go.' },
      { id: 'eat', kind: 'ticks', desk: "It nicked you. Eat. F. Don't argue.", phone: "It nicked you. Tap EAT. Don't argue.", again: "Eat, Potts. I mean it.", chip: 'F', btn: 'bEat', mark: false,
        subD: 'Press F to eat. Food heals you.', subP: 'Tap EAT. Food heals you.' },
    ],
    // fresh-player fix (owner Nov 18): the drill machine starts this far (m) outside its opening, so it walks in where you can see it
    spawnOut: 5,
    // the opening it comes through is picked within this many degrees of where you look (the nearest such one); if none is, the one closest to your view
    viewDeg: 25,
    // the pulsing marker: ring size (px), its colour, how far from the screen edge the edge arrow sits (px), and the height on the machine it rings (m above its feet)
    // clear: on phones, the gap (px) kept between the ring and a touch button it would cover (it is lifted above the button; owner Nov 18)
    mark: { px: 58, color: '#ffd76a', edge: 34, y: 1.2, clear: 6 },
    // the plain second line under Marla's drill order: font size (px) on desktop and on a phone
    subPx: [13, 13],
    // said when the last step is done, and when the drill is skipped
    done: "Drill's over. Hold till dawn, Potts.", skipped: "Fine. Skip it. Don't die.",
  },
  // DEVICE BAR (owner, Nov 17 18:28: "the device bar show only selected device"): seconds the full bar stays open after a switch (1-5 or the wheel); holding H also opens it
  // FRESH-PLAYER FIXES (owner Nov 18, desktop player test): the waking prompt, Marla's first talk, the Keys card, the big map, N in the base
  fresh: {
    // master switch for the waking prompt (desktop text, phone USE pulse) until the mouse has been taken and Marla talked to once
    wake: true,
    // the waking prompt on desktop: both steps still to do, only the click left, only the talk left (teaching review fix 5: the last two also teach moving and looking, since Marla's prompt hides the base walk line)
    wakeBoth: 'Click to start · E to talk', wakeClick: 'Click to start · W A S D to move · mouse to look', wakeTalk: 'W A S D to move · mouse to look · E to talk to Marla',
    // its priority in the centre queue (msg is 3: the dawn line waits behind it; the job card, 5, stays above it)
    wakePrio: 3.5,
    // Marla's first talk (day 1): the one line that says what "Ride out" does
    rideLine: 'Ride out: go loot the old street, then hold a house tonight.',
    // the first-talk buttons: stay in the base, and open the ring and device pickers
    lookBtn: 'Look around first', stayBtn: 'Stay at the base', setupBtn: 'Set up the run', setupHide: 'Hide the setup',
    // holding N in the base: the line shown while it is held (the night starts only in a house on a run)
    nBase: 'Ride out with Marla first',
    // its priority in the centre queue
    nBasePrio: 3,
    // the Keys card (pause menu "Keys", or hold H): [key, what it does]; desktop lists only desktop keys, phones only the touch controls
    keysDesk: [['W A S D', 'move'],['Mouse', 'look (click the game first; Esc frees the mouse)'], ['Left click', 'fire; hold it to charge, let go for a charged shot'], ['Right click', 'place: the solar collector by day, the picked device at night'],
      ['1 to 5 / wheel', 'pick a device'], ['Q', 'solar collector (by day)'], ['F', 'eat (heals)'], ['E', 'use, talk, leave a house at its door'], ['Hold N', 'start the night (in a house)'], ['Tab', 'quests (in the base)'], ['M', 'music on or off'], ['Hold H', 'keys: this card and the key strip, while held'], ['Esc / P', 'pause; Esc also closes a panel']],
    keysPhone: [['Left thumb', 'walk'], ['Right thumb', 'look; a quick tap fires (uses things in the base)'], ['FIRE', 'shoot; hold it till the ring glows gold, then let go'], ['Device button', 'one tap places it'], ['Switch tab', 'opens all devices; tap one to pick it'],
      ['SOLAR', 'solar collector (by day)'], ['EAT', 'eat (heals)'], ['LEAVE', 'leave a house at its door'], ['HOLD', 'start the night (in a house)'], ['Quest box', 'tap to see every quest'], ['||', 'pause']],
    // the big map from the pause menu (base only): its size as a share of the shorter screen side, the metres from you to its rim, its glyph size (px) at most, and its key line
    bigMap: { share: 0.78, radius: 36, glyphMax: 26, key: 'You are the arrow, facing up · red dot: Marla · W workshop · B quest board · H hatchery · house: your home · wheel: the waterwheel' },
    // the click that takes the mouse does nothing else: a left button press this soon (ms) after the game asked for the mouse is not a shot or a use
    lockClickMs: 500,
  },
  devBar: { openSecs: 1.5,
    // phones: seconds the full bar stays open after a tap on the switch tab (a tap on a device picks it and closes it sooner)
    tabSecs: 5 },
  // CONTEXT CHIPS from night 2 on (desktop): F eat below this share of health at night
  chips: { eatBelow: 0.5 },
  // BASE MINIMAP (owner Nov 17 19:43: "in base have a circular map to tell where Marla is instead of by words. use the same corner"): a round map in the quest corner, player-centred, turning with the view.
  miniMap: {
    // master switch
    on: true,
    // size on screen (px): desktop, phone
    px: [150, 96],
    // metres from the player to the map's rim
    radius: 22,
    // how often it is redrawn (times a second)
    hz: 10,
    // the map's opacity (0-1)
    alpha: 0.92,
    // colours: disc fill, rim, ground grid, landmark glyphs, the player arrow, Marla, the north tick
    col: { bg: '#0a1410', rim: '#b08a4a', grid: '#1f3329', glyph: '#9fb8a6', player: '#ffffff', marla: '#ff5a4a', north: '#ffd978' },
    // Marla's dot radius (px at the desktop size; phones scale it) and how fast it pulses while "find Marla" is the goal (pulses a second)
    dot: 8, pulse: 1.4,
    // landmark mark size as a share of the map size (W workshop, B board, H hatchery, a house for your home, a wheel for the waterwheel)
    glyph: 0.13,
  },
  // START FLOW (owner Nov 17 23:33 and 23:36; the title page is gone): V logo, then the DAWNPUNK title card, then the loading page with REAL progress, then the begin button (#enter).
  // Asset loading starts at once behind the logo. ?quality= in the address (the scripted checks) skips the logo and title time unless &splash=1 asks for them.
  splash: {
    // seconds the V logo shows (fades and grows in, the sun glows up)
    logoSecs: 2,
    // seconds the title card shows (it plays out its time even when loading is already done)
    titleSecs: 2.5,
    // seconds of each cross-fade between the phases
    fade: 0.6,
    // background: centre colour and edge colour of the radial gradient
    bg: ['#12261c', '#030806'],
    // the title wordmark: letter colour top and bottom, glow colour behind, tagline colour
    word: ['#ffe9a8', '#c8913f'], glow: '#ffb84a', tagline: '#cdbb8c',
    // the tagline under the title
    tag: 'Hold the house. Wait for the sun.',
    // the progress bar: fill top and bottom, empty part, frame line
    bar: ['#ffd978', '#c98a1e', '#1a1408', '#b08a4a'],
    // seconds each lore line stays on the loading page before the next one
    loreSecs: 4,
    // weight of each loading stage in the bar (scripts, models and textures, fonts, music, first scene compile); they are added and scaled to 100%
    weights: { scripts: 1, assets: 6, fonts: 1, music: 1.5, warm: 1.5, base: 1.5 },
    // seconds after which a stage that never reports (a blocked music file, say) counts as done, so the bar cannot stall forever
    stageCap: 25,
    // soft particles drifting up behind the logo and title (desktop only; phones get none)
    particles: 18,
  },
  // FOOD FOR THE VILLAGE (owner Nov 17 23:58): food eaten at night is food the village does not get (base food buys recruits, base.recruitFood)
  village: {
    // Marla's low-health line turns to "better we go hungry" once you have eaten this many times tonight
    ateLow: 3,
    // seconds her "village's supper" line stays up the first time you eat in a run
    supperSecs: 4,
  },
  // DARKER NIGHT (panel review fix 10). At full night, per graphics tier: exposure = the night exposure multiplied by this; fill = the sky / ground fill light multiplied by this;
  // (exposure kept near 1 so the machines' own screens and lamps, which no light reaches, stay as bright as before while the room and sky go dark: a first try at 0.8 dimmed the screens too)
  // sky = night sky colour; lamp = house ceiling lamps multiplied by this (they stay on all day too, so night uses the same factor ramp); vig = night edge darkness (0-1, both tiers)
  nightLook: {
    // desktop and laptop (high tier)
    high: { exposure: 0.95, fill: 0.4, sky: 0x04060c, lamp: 0.5, vig: 0.85 },
    // phones (low tier). Owner approved a lighter phone night on Nov 18 (docs/sample_phone_night_lighter.jpg): was exposure 0.95, fill 0.45, lamp 0.55, vig 0.7
    low: { exposure: 1.0, fill: 0.75, sky: 0x05070e, lamp: 0.85, vig: 0.45 },
  },
  base: {
    growth: { max: 5, r: 8.8, clear: 2.6, height: 2.0, leaf: 1.9, leaves: 5, flowers: 14 }, // the base grows: one solar sapling + flower bed per ring opened (+1 when the last ring is held), on a circle of radius r

    start: { food: 10, essentials: 0, personnel: [{ name: 'Ines', role: 'hunter' }, { name: 'Tomas', role: 'gatherer' }, { name: 'Wen', role: 'researcher' }] },
    recruitFood: 30, tryTime: 60, // tryTime: a lost night only earns the home income and a research day if you lasted this many seconds (no farming by dying at once)
    maxPersonnel: 9, recruitModels: 9, recruitOrder: [3, 2, 11, 5, 6, 7, 9, 8, 12], // recruitOrder: which recruit model (art/models/genN) the 1st, 2nd, ... person gets, chosen so the model suits the name: Ines, Tomas, Wen, Aroha, Kofi, Mei, Sol, Dara, Jun. All nine are adults.
    // recruitModels: how many different recruit models ship (art/models/gen1..gen9); keep it at or above maxPersonnel so no two people look the same
    speed: 4, bound: 19.5,
    passive: { hunterCut: 0.04, hunterCap: 0.2, hunterEss: 1, gatherFood: 2, researchPerDay: 1 }, // each dawn: hunters thin the next night's Gloom and bring scrap (essentials), gatherers bring food, researchers advance the Workshop project
    quests: { deliverFood: 2, huntBase: 4, huntFood: 4, collectBase: 3, collectEss: 3 },
    labelRange: 7,
    upgrades: { panel: { name: 'Sturdy panels', max: 3, cost: [8, 14, 20], days: [2, 2, 2], per: 0.25, text: '+25% panel strength per level' }, turbine: { name: 'Efficient turbines', max: 3, cost: [10, 16, 24], days: [2, 2, 2], per: 0.10, text: '+10% turbine Sun per level' }, energy: { name: 'Sun cells', max: 3, cost: [8, 12, 18], days: [2, 2, 2], per: 5, text: '+5 start Sun per level' }, slots: { name: 'Carry frame', max: 2, cost: [16, 28], days: [2, 2], per: 1, text: '+1 device slot per level' }, dev_twin: { name: 'Unlock: Twin Lance', max: 1, cost: [12], days: [2], text: 'two pellets per shot' }, dev_mist: { name: 'Unlock: Mist Coil', max: 1, cost: [12], days: [2], text: 'pellets chill and slow a Gloom' }, dev_trellis: { name: 'Unlock: Tall Trellis', max: 1, cost: [10], days: [2], text: 'a tall, tough panel; nothing shoots over it' }, dev_flask: { name: 'Unlock: Biogas Flask', max: 1, cost: [16], days: [2], text: 'one-shot area burst where you aim' }, dev_press: { name: 'Unlock: Mulch Press', max: 1, cost: [14], days: [2], text: 'grinds one Gloom, then resets' }, dev_shard: { name: 'Unlock: Shard Plate', max: 1, cost: [8], days: [2], text: 'floor plate that hurts Gloom walking over it' }, dev_sling: { name: 'Unlock: Sling Press', max: 1, cost: [14], days: [2], text: 'lobs shots over walls' }, dev_prism: { name: 'Unlock: Prism Lens', max: 1, cost: [14], days: [2], text: 'shots fired near it hit harder' }, dev_chime: { name: 'Unlock: Chime Pole', max: 1, cost: [8], days: [2], text: 'a sound that pulls Gloom toward it' }, dev_moon: { name: 'Unlock: Moon Panel', max: 1, cost: [36], days: [2], text: 'strong night Sun; shares the limit of 2 Sun makers with turbines' } }, 
  },
  // LAG FIX (lag report Nov 18, owner approved Nov 19: fix the cost, keep the desktop look). Desktop (high tier) only unless a line says otherwise; phones keep every setting they had.
  lag: {
    // cull: skinned characters are culled again (src/lod.js cullSkinned); their bounding sphere, taken in the bind pose, is grown: radius times grow, plus pad metres
    cull: { grow: 1.35, pad: 0.35 },
    // glSlowAfter: ?proglog=1 pages time every WebGL call while a card or the film's black is up and this many s after (the slowest call of a long frame is logged)
    glSlowAfter: 3,
    // keepPrograms (R4 worker 5): every shader program built is kept for the visit (never freed and built again by a later card); max: at most this many kept
    keepPrograms: { on: true, max: 1200 },
    // nightNoMarla (R4 worker 5): the ride card builds the night's shaders with Marla off the scene (she is never in a house at night)
    nightNoMarla: true,
    // marlaOwnLight (OWNER DECISION Nov 19 23:24, "Marla's street light to light only her"): in play her key SpotLight and rim light live on this layer with her
    //   pieces only, and she is drawn in a second pass after the street (src/main.js marlaPass); the street draws with the night's light set, day and night alike
    marlaOwnLight: { on: true, layer: 6, lightsEvery: 30 },
    // nightBg (R4 worker 6): the night's shaders (night lights, each lamp count) are built in the background on the day street (compileAsync, at most ms of its
    // own JS a frame, KHR_parallel_shader_compile present on the Mac), not under the ride card; the night card builds what is left
    // OFF (worker 6): its programs are built on the day street, outside a card, so the warm-up gate counts them; on only with the lead's decision on that gate
    nightBg: { on: false, ms: 6 },
    // crossWarm (R4 worker 6, Card 40): the crosshair's Gloom state is drawn first under each loading card (its drop-shadow filters cost 226 ms of GPU raster the first time)
    crossWarm: true,
    // hudWarm (Nov 20): during each loading card the interface sits above the card at opacity 0.002 with Marla's line, the aim label, the message, the threat arc,
    // the drill arrow and the crosshair's Gloom state shown, so the page draws them the first time there, not in a fight's first seconds (src/main.js sceneCard)
    hudWarm: true,
    // glbDefer (R4 worker 6): a model that finishes loading while the film or play is shown gets its pictures and shaders prepared at the next held time (card, film black, title)
    // (R4 worker 8, Card 46 then Card 48) ON: with it off (f7258a2, plain medium 44567127417) 3 programs were built in play, one each at page 99219 / 99235 / 99244 ms
    // (models of the run finishing their load in play: glbReady's compileAsync); the 15 'intro' ones were Card 45's, not glbDefer's
    glbDefer: true,
    // baseFar (OWNER DECISION Nov 20 13:40): in the base a piece under r m across is not drawn past far m from the eye; tested every `every` frames, list made again every `list` s
    // streetFar: the same on the street by day, past this many m
    baseFar: { on: true, r: 0.6, far: 14, every: 6, list: 3, streetFar: 24 },
    // shaderLamps (OWNER DECISION Nov 20 14:15): Marla's key and rim and the people's key are worked out in their materials, not real lights (src/shaderlamps.js)
    shaderLamps: true,
    // shadowSets (Nov 20): under the ride and night cards the shadow maps are also drawn once under the light counts Marla's own pass leaves (src/main.js shadowSets)
    shadowSets: true,
    // warmFresh (R4 worker 11): the night card also draws one not-yet-merged machine of each kind and one breach mark (src/main.js warmNight)
    warmFresh: false,
    // logoWarm (R4 worker 11, OWNER DECISION lead 03:33): after the logo and every load, the scene's shaders built in the background and the scene drawn once under the
    // loading page before the begin button (src/main.js SPLASH); ms: the most it may wait
    logoWarm: { on: false, ms: 4000 },
    // bossFreeze (R4 worker 5): the desktop boss model's still parts leave the per-frame matrix pass (src/bosshi.js buildGlb)
    bossFreeze: true,
    // skipCard (R4 worker 5): the film skipped before its base part shows the home card while the base's first frames are made
    skipCard: true,
    // lod: a reduced copy of big meshes for far away (src/lod.js; meshoptimizer simplifier). on: the switch; minTris: meshes with fewer triangles than this keep only their full mesh;
    // kinds: per kind of model, near = metres from the camera within which the full mesh is drawn, ratio = share of triangles the far copy aims for, error = largest change of shape
    // allowed as a share of that mesh part's size (the simplifier stops there even if the ratio is not reached, so the far copy keeps the silhouette)
    lod: { on: true, minTris: 1500,
      kinds: { people: { near: 7, ratio: 0.3, error: 0.005 }, gloom: { near: 9, ratio: 0.35, error: 0.01 }, boss: { near: 14, ratio: 0.5, error: 0.006 } },
      // medium: the default tier's own values laid over kinds (owner 07:10, night combat fps first; owner's rule: characters full mesh only within a few metres):
      // a Gloom machine is drawn in full within 4.5 m, the boss within 5 m (owner decision Nov 19 09:20, option E; was 10 m) with its 35 % far copy beyond
      medium: { gloom: { near: 4.5, ratio: 0.25 }, boss: { near: 5, ratio: 0.35, error: 0.01 } } },
    // step: automatic step-down while playing (src/perfstep.js; never in the scripted checks, which run with window.__dtMax or a webdriver browser, unless ?autostep=1).
    // on: the switch (?autostep=0 / 1 overrides it for one visit); slowMs: a frame slower than this on average is too slow; watch: seconds averaged per reading;
    // hold: readings in a row that must be too slow before one step is taken; settle: seconds after a step (or the start of a scene) before measuring again;
    // ignoreMs: single frames longer than this (a tab switch, a load) are left out of the average
    step: { on: true, slowMs: 20, watch: 2, hold: 2, settle: 4, ignoreMs: 400,
      // order: the steps, one at a time, cheapest look loss first: ratio = sharpness cap down to `ratio`, ao = contact shading off, shadow = sun shadow maps down to `shadow` px, lights = machine screen lights down to `lights`
      order: ['ratio', 'ao', 'shadow', 'lights'], ratio: 1, shadow: 1024, lights: 1 },
    // card: the loading card at scene changes (owner Nov 19 05:49; src/main.js sceneCard): ride = base to the day street, night = day to night (short), home = night or dawn to the base.
    // While it shows the game is held still (no game time passes) and the heavy work is done: the night card waits for the night's Gloom and boss models (at most maxWait s), their maps
    // uploaded, every shader of the scene built, and the sun shadow map drawn once. on: the switch; min: shortest time each card shows (s); titles: the card's line per change
    // mergeCell: the street's static pieces are merged per material and per square cell of this size (m) on the desktop builds (src/world.js), so out-of-view cells are culled
    mergeCell: 16,
    // housePad: a street piece within a house's half size plus this (m) belongs to that house's own merged meshes (gutters, sills, steps), never to the street's
    housePad: 0.8,
    // houseMinVerts: a house's own mesh of one material with fewer vertices than this joins the street's mesh of that material instead (a few small pieces: one draw saved)
    houseMinVerts: 1500,
    // mergeSplitVerts: only a material with at least this many vertices in the whole street is split by cell; smaller ones stay one mesh
    mergeSplitVerts: 30000,
    // farPad: the camera's far plane follows the fog: fog end plus this (m), never past the camera's own 90 m. Beyond the fog's end everything is pure fog colour, so
    // nothing visible is lost; at night (fog ends at 34 m) the far street, woods and hills are no longer drawn at all. The sky dome is scaled to fit inside it.
    farPad: 2,
    // plants: the base's garden plants (src/baseplants.js) per square cell of `cell` m, each drawn in full within `near` m of you and as the phone's lighter plant beyond
    plants: { cell: 8, near: 12 },
    // woodsSectors: the far trees round the base and the street are cut into this many slices round the ring (src/scenehi.js), so the slices behind you are not drawn
    woodsSectors: 12,
    // nightCull: at night inside a house only what can be seen is drawn (src/nightcull.js): on = the switch; housePad = metres round the house that always count as the house
    // (gutters, sills, the yard just outside); roof = metres above the top floor; pad = metres added round each opening; doorway = standing this close to an opening's
    // plane (m), everything beyond it counts as seen
    // gloom: the same test for the Gloom machines (src/main.js; owner 07:10 night combat): one outside that no opening shows is not drawn or animated. gloomY: height (m)
    // of the machine's test sphere above its feet, gloomR: its radius (m), generous so a tall Warden or a Stilt's head showing at a window always counts as seen
    // roofCull: a piece of the house you are in whose lowest point is above the top floor's ceiling less this (m) is taken as roof (behind the ceiling, seen only through an opening)
    // sceneryFar (owner decision Nov 19 09:20, option A): at night, street scenery (grass, tufts, hedge, tree and wood cells) wholly farther than this (m) from the house's walls is not drawn
    // eyeMove: the pieces are tested again only once the eye has moved more than this (m) since the last test
    nightCull: { eyeMove: 0.05, on: true, housePad: 1.2, roof: 4, pad: 0.4, doorway: 0.35, gloom: true, gloomY: 1.3, gloomR: 2.2, roofCull: 0.02, sceneryFar: 15 },
    // mergeGloom: phone tier, the still pieces of each Gloom machine drawn as one mesh per parent and material (src/mergestatic.js); on: the switch; probes: test poses
    // run to find the pieces that never move; perFrame: machines merged per frame at most (a burst of arrivals is spread over a few frames)
    // fxPool: short-lived effect objects (shot jets, splash drops, kill smoke, mine flashes, press marks) kept per kind for reuse (src/main.js opTake); most kept per kind
    fxPool: 80,
    // pbrWalk: the desktop surface pass (src/fx.js) upgrades what is added to the scene at once and walks the whole scene only every pbr.every x this many frames (was every pbr.every)
    pbrWalk: 15,
    // shadowSettle: on the street, Marla's shadow is drawn again once she has stood still this long (s) after turning (owner 10:50; was every 0.1 s while she turned)
    shadowSettle: 0.25,
    // bodyIdleHz: standing still, the body shadow's idle chest sway is redrawn this many times a second (src/playershadow.js; it redrew every frame)
    bodyIdleHz: 10,
    // farStep: a base villager out of view and farther than dist m (Oko: also while you are outside the workshop) steps her motion hz times a second, time added up
    // (Nov 19 12:45: OFF, null. tools/animcheck.cjs times the villagers' bones every frame wherever the player stands, and the summed steps showed as pose jumps.
    // 13:10 a pose blend between the stepped poses was tried and REVERTED (owner 14:20): foot lock and leg IK need per-frame solving, the blend lifted the feet and
    // broke the stride (animcheck 44468114928), and farStep never had a measured gain. Was { dist: 15, hz: 5 }.)
    farStep: null,
    // modelRetry: a light character model whose fetch fails is fetched again n more times, ms x (try number) apart, before its script twin (src/modeldata.js liteModel)
    modelRetry: { n: 2, ms: 600 },
    // keepBase: the base is built once and kept while you are out; a visit with nothing changed that the build reads from the save shows it again (src/baseview.js)
    keepBase: true,
    // endSnap: the run-end screen's blur is made once from the held picture instead of blurring live every frame (src/main.js endSnap)
    endSnap: true,
    // filmWarm: the film's black is painted first, and its street (and at the dawn shot its base) has its shaders built and every piece drawn once under the black
    // before the film's clock runs (src/main.js filmWarm)
    filmWarm: true,
    // OWNER DECISION Nov 19 12:35 (visible cuts approved): farAnim: a Gloom machine farther than dist m, or hidden by the night cull, is posed every 'every'-th frame
    // (was: every frame, i.e. every 1)
    farAnim: { dist: 10, every: 2 },
    // OWNER DECISION Nov 19 12:35: nightTuftBlades: the street's grass tufts have this many blades at night (src/main.js nightTufts); by day the original
    // CONFIG.quality.high.street.tuftBlades (10) as before
    nightTuftBlades: 5,
    // loadBase (Nov 20): the base is prepared on the loading page as its last stage, before the begin button (src/main.js SPLASH); ms: the most it may take there
    // OFF (Mac 44671218574): the title's worst-frame gate also times the loading page, so the gate line did not move (225 ms); kept off, as before this change
    loadBase: { on: false, ms: 9000 },
    // titleBase: a returning player's base is prepared this many seconds after the title is ready, while it idles (src/main.js titleBase)
    titleBase: 1.5,
    // slice: the base prepared at the title in time slices: ms of build parts a frame (a part is not cut), then draws pieces drawn off-screen a frame (src/main.js baseSlice)
    // film: the same for the film's start under its black (nothing shows, so a bigger share of each frame), ms of parts or piece draws a frame
    // slice.card (R3): the card's all-pieces pass (every piece shown and not culled, with the shadow maps) is drawn in parts of cardDraws pieces, at most card ms of
    // them a frame (src/main.js sceneCard), so no frame under the card holds the whole pass
    slice: { ms: 4, draws: 40, film: 40, card: 40, cardDraws: 40 },
    // filmCompileCap (R3): the film's black waits at most this many s for its shaders to finish building in the background before its pieces are drawn (it was the
    // card's maxWait, 12 s: on the Mac test GPU the build took longer, and the first draw then waited for the rest of it in one held frame of 19-22 s)
    filmCompileCap: 90,
    // lampsUsed (R4, card 22): the ride card builds the night's and the house-by-day shaders only for the lamp counts this run's houses have (false: every count
    // 0..most, as before; off until the coordinator approves the round)
    lampsUsed: false,
    // houseLamps (R4 item A, card 26): the house ceiling lamps (one a floor) are drawn as shader data (src/houselamps.js: the same light math as a three.js point
    // light), not as THREE lights, so the number of lamps is not part of any shader's key and one program per material serves every house; max: most lamps a house
    // can have (floors: levelAt gives at most 3; one spare). off: the lamps are THREE.PointLights again and the ride card builds a shader set per lamp count
    // (R4, lead area 2) also the night machines' screen lights (Q.lights of them, src/main.js glights) and the base's room lamps (src/baseview.js): max 7 = 3 house
    // floors + 1 spare + 3 machine lights (the base has 3 room lamps)
    // the film adds its 4 street lamps, the device light and the machine's rim light: max 10 (4 + 1 + 1 + up to 3 machine lights, + 1 spare)
    houseLamps: { on: true, max: 10 },
    // gpuPart (R4 items B/C, card 27): the film black's and the cards' parts wait for the GPU to finish the part before (a fence, src/main.js gpuDone) instead of
    // queueing all of them and then gl.finish(); cap: the most ms one wait lasts (a safety cap). (Sizing parts by the wait was dropped: diagnose 7)
    gpuPart: { on: true, cap: 10000 },
    // filmModelWait (R3): the film's black waits at most this many s for the film's desktop Gloom models and sharp textures, now asked for when the film starts
    // (not with the page), so the film shows the same machines and pictures as before
    filmModelWait: 60,
    // mergeBase: the base's still pieces drawn as one mesh per material and cell m of ground (src/baseview.js mergeStill); hidePad: extra m kept clear round the film's hidden plant
    mergeBase: { on: true, cell: 16, hidePad: 1.5 },
    // gloomPool: destroyed Gloom machines kept per kind for reuse at the next spawn (src/main.js gloomTake / gloomPut); most kept per kind
    // longFrame: with ?proglog=1 a frame starting more than this many ms after the one before is logged with what the frame before it did (src/main.js lfStart)
    longFrame: 80,
    // singlePassFlat: under each card, see-through two-sided merged meshes are drawn as back and front groups (src/mergestatic.js twoPassGroups); flat: also draw
    // the flat one-way lit ones in one pass too (OFF: the pixel test showed up to 109 changed pixels, max 98 of 255, on 3 of 8 views); the flat unlit ones
    // (MeshBasicMaterial, e.g. the openings' flash sheets) always go one pass: no normals, the same colour either side
    singlePassFlat: { on: true, flat: false },
    gloomPool: 10,
    // gloomPrefill: machines of each kind the ring sends, built and merged under the ride / night card to start the pool (src/main.js warmNight); at most gloomPool
    gloomPrefill: 3,
    // freezeWorld: the still street's matrices are worked out only when it is moved or added to, not every frame (src/main.js freezeWorld)
    freezeWorld: true,
    // sortByShader: solid things drawn grouped by the shader they need (src/main.js shaderKey; fewer shader switches, nothing changes on screen)
    sortByShader: true,
    // shaderLog: true = always read each shader's compile log (three.js checkShaderErrors; costs a wait on the driver per shader); false = only in the scripted checks
    shaderLog: false,
    // mergeDecals: the house's floor shades, door pools and dirt decals (static) drawn as one mesh per material (src/main.js buildDepth; all tiers)
    mergeDecals: true,
    // glbMerge: desktop Gloom models drawn as one skinned mesh per material, each part a bone of it (src/glbmerge.js); on: the switch
    // bossPad: extra metres on the boss's merged mesh culling sphere (its broken plates fly a few metres off and stay drawn by it)
    glbMerge: { on: true, bossPad: 6 },
    // glbFreeze (R4 item H, card 29): a merged desktop Gloom's parts that never move against the moving piece they hang from (probe poses) are skinned by that
    // piece and leave the per-frame matrix pass (src/glbmerge.js freezeStillBones); the picture is unchanged
    glbFreeze: { on: true },
    // transparent: see-through pieces (wear decals) of one material are merged too (only their drawing order among themselves can change)
    mergeGloom: { on: true, probes: 8, perFrame: 2, transparent: true },
    // smallCaster: a static piece smaller than this (bounding sphere radius, m) casts no sun shadow (owner's rule: small props castShadow off; their shadows were a few pixels)
    smallCaster: 0.12,
    // dtMax: longest game step one frame may take (s; was 0.1): after a long frame the game slows for a moment instead of jumping (all tiers; the checks set their own)
    dtMax: 0.05,
    // card.sfxWait: the night card waits at most this long (s) for the impact sound variants still being rendered
    // card.settle: before a card lifts, the real frame is drawn under it until settle.n frames in a row come in under settle.ms milliseconds (or settle.cap s pass), so the
    // first slow frames of a new scene (uploads, first draws) happen under the card, not in play
    card: { on: true, sfxWait: 1.5, min: { ride: 0.7, night: 0.3, home: 0.7 }, maxWait: 12, titles: { ride: 'Riding out', night: 'Night falls', home: 'Home' }, settle: { n: 3, ms: 25, cap: 1.5 } },
    // tuftChunk: the street's grass tufts are split into square chunks this many metres wide (one instanced draw each), so chunks out of view or past the night's
    // scenery distance are not drawn (they were one draw over the whole street, never culled); same tufts, same places
    tuftChunk: 12,
    // groundBake: the street's mottled grass sheet keeps its colours in a small texture (one texel per old grid point, filtered between them) on a 2-triangle sheet,
    // instead of a 1 m grid of coloured points (57k triangles); false: the old grid
    groundBake: true,
    // splitVariants: a material drawn by both instanced and plain pieces (or with and without instance colours, or skinned and not) gets one copy per kind of piece,
    // so its shader is not looked up again each time the kind changes in a frame (seen: about 60 lookups a frame on medium); colours and maps stay shared
    splitVariants: true,
    // OWNER DECISION Nov 19 11:45 ("cuts only if boss fails"): for v0.9.1 the triangle budget (0.5 M a frame) is reported, not a pass line; tools/perfcheck.cjs reads this
    trisReportOnly: true,
  },
};
