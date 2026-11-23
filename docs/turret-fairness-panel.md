# Dawnpunk: turret fairness panel (Nov 24, 2026)

Owner (00:17): "I want a fix where this wall bot is not the only solution. Run a panel of similar game developers and players."
A staged panel of roles, not real people. Nobody on it played a run; they argued from bot numbers (tools/strategysuite.mjs, tools/wallbot.mjs, tools/turretprobe.mjs). No human has played any of these settings.

## The panel
- **Trap-defence designer** (third-person trap defence, Orcs Must Die!-like).
- **FPS-tower designer** (first-person tower defence, Sanctum-like).
- **Action-defence designer** (co-op towers plus heroes, Dungeon Defenders-like).
- **Lane-defence designer** (plants against waves).
- **Turtle player** (found the wall build; finds rings 1-3 empty).
- **Phone player** (casual, slow aim).
- **Tower-defence veteran** (plays for builds and counters).
- **FPS player** (wants aim to matter).

## What they were shown
Six ways to hold a house (same nights for each), win % / hit on % of nights, rings 1-5 (ring 5 = boss), as released:
| aim | strategy | r1 | r2 | r3 | r4 | r5 |
|---|---|---|---|---|---|---|
| average | turtle (wall, 2 turbines, lances) | 100/0 | 100/0 | 100/0 | 100/0 | 100/0 |
| average | spread (lances at the openings) | 100/0 | 100/0 | 100/0 | 100/0 | 92/14 |
| average | traps (mines and shards at the openings) | 100/11 | 100/19 | 89/39 | 78/61 | 42/86 |
| average | panels (walks to panel each opening) | 100/36 | 94/47 | 72/58 | 61/72 | 28/89 |
| average | flask | 92/25 | 86/25 | 67/47 | 44/75 | 25/78 |
| average | gunner (two Sun makers, own aim only) | 100/19 | 100/25 | 89/42 | 78/78 | 58/89 |
Novice aim: turtle 100/0 on every ring; every other strategy falls by ring 3. Expert aim: everything wins; turtle and spread are never hit.
Cause (measured, docs/balance-fault-b.md s.10): turrets never miss at the cannon's Sun price; two turbines pay for more turret damage than the night's whole Gloom health; machines inside walk to the nearest device, i.e. into the turrets.

## Round 1: what each one would change
- **FPS-tower designer:** "In our genre some enemies shrug off towers, so the gun is never optional. Right now your cannon is optional."
- **Trap-defence designer:** "Our flyers skip the traps; the point is the same. One answer per enemy, not one answer per game."
- **Action-defence designer:** "We give towers target priorities and use enemies that punish towers bunched together. Your cluster is the problem, not the lance."
- **Lane-defence designer:** "Do not nerf the lance into uselessness. The other five strategies are fine; bring the two turret ones down into their band."
- **Turtle player:** "I don't want the lance gone. I want a night where I have to turn round and shoot something."
- **Phone player:** "If you nerf turrets I lose. Turrets are how I survive without aiming."
- **Veteran:** "Then the fix has to be per machine: some machines are turret food, some are yours."
- **FPS player:** "And I need to see which ones are mine before they reach me."

## Round 2: the levers, tested (average aim unless noted; same number of machines in all, so no frame-rate cost)
| lever | turtle r1-r5 | spread r1-r5 | other strategies |
|---|---|---|---|
| A. Walker, Hauler, Warden take 30% of turret damage | 100 89 69 31 0 | 100 92 81 31 8 | unchanged |
| B. Hauler and Walker blows splash devices within 1.6 m | 100 100 100 100 100 | 100 100 100 100 94 | panels slightly worse |
| C. machines seek Sun makers (4 m pull) | 100 100 100 100 100 | 100 100 100 100 89 | panels and flask worse |
| B + C | 100 100 100 100 100 | 100 100 100 100 89 | panels and flask worse |
| A at 40% on Walker, Hauler, Warden | 100 94 92 64 25 | 100 100 92 67 14 | unchanged |
| same + turrets shoot unarmoured first | 100 100 81 56 17 | 100 100 100 69 11 | unchanged |
- **Action-defence designer:** "B and C do nothing to your turtle because its turrets kill everything before a blow lands. Only A touches it."
- **Lane-defence designer:** "A at 40% puts turtle and spread into the band of traps and gunner. At expert aim the traps, panels and gunner now beat the turtle on rings 4 and 5 (traps 100/100, gunner 100/100, turtle 86/64). That is 'not the only solution'."
- **Phone player:** "Novice turtle with A at 40%: 100 94 86 53 14. It was 100 everywhere. It is still the best novice strategy on rings 1-3, so I'm not locked out."
- **Veteran:** "Turret priority makes armour bite harder on rings 3-5. Leave it off for now; it is a second dial."

## Round 3: what breaks
- **The stacker check in test.js.** The old bots (src/bots.js: slow build, panels, centre) rely on two lances. With A at 40%: 14-BP stacker ring 1 93 -> 32% (check wants 75-95%), ring curve 90/85/70/33/15 -> 30/12/5/0/0 (check wants ring 1 >= 60). The 4-BP novice check still passes (100 -> 89%, wants >= 85).
- **Trap-defence designer:** "That check describes the broken strategy as the reference player. Replace it, don't loosen it: check that no strategy is the only one."
- **FPS player:** "A has to be visible. Armoured machines need a look and a name on the night card, or the first Hauler that walks through my lances feels like a bug."
- **Veteran:** "The Walker's own text says 'Any device stops it'. Change it."

## What they agreed, in order
1. **Armour against turrets on Walker, Hauler and Warden: they take 40% of turret damage; the player's cannon does full damage.** No new machines, no new devices.
2. **Make it visible:** each armoured kind's journal text and the night card say the turrets barely scratch it and to shoot it yourself. Machine look unchanged until the owner asks.
3. **Replace the stacker checks with a strategy check** (owner's yes needed): at average aim on rings 1-3, at least three of the six strategies win >= 80%, and no strategy wins every night without a hit on all three rings.
4. **Leave B, C and turret priority in the code switched off** for later tuning.
5. **Re-measure the tougher machines (CONFIG.tough) with armour on** before keeping both.

## Limits
Bots only; reaction and aim numbers are assumptions. Armour changes no attack, so no new hit to time (the warning-time metric is unchanged). Not judged by a human, on a phone or by ear.

## BUILT (owner 00:3x: "Yes, build it")
- CONFIG.gloom.kinds walker / hauler / warden turret 0.4; their texts say turrets barely scratch them; the night card's second line names tonight's armoured kinds (CONFIG.gloom.armourLine, #lcs under "Night falls").
- CONFIG.tough re-tuned with armour on: hp [1.3, 1.2, 1.1, 1, 1] (was [1.5, 1.35, 1.2]: rings 1-3 became as hard as ring 4 at average aim).
- test.js: the stacker's ring-1 window and ring curve and the runBot expert tough window are replaced by four strategy-suite checks (local, 48 nights per ring per strategy): at average aim >= 80% wins on rings 1-3 by 3 / 4 / 3 of 6 strategies; no strategy unhit on rings 1-3; best-strategy ring curve 94/98/85/79/56; expert aim ring 1 hit on >= 10% of nights by 3 of 6 (panels 29%, flask 17%, gunner 19%).
- Average aim, rings 1-3 win %: turtle 77/85/73, spread 90/90/85, traps 94/96/83, panels 65/73/56, flask 67/60/44, gunner 90/98/83.

## Boss night after armour (open)
- test.js 'breaking the paws is worth it' (pawhunter vs expertNB, both 0-13% now) is ported to the strategy bots (traps, gunner; tools/wallbot.mjs BOSS=hunt). It FAILS at paw spill 18: average traps 54->38 / 21->25 / 17->25%, gunner 63->58 / 25->25 / 38->38% (no hunt -> hunt, houses 5/3/0); expert breaks 1.8-1.9 paws.
- Paw spill 40 makes it pass (traps 54->63 / 21->38 / 17->33%) but then the src/bots.js 'boss night is the hardest night' check fails (pawhunter on houses 3 and 0). Kept at 18.
- tools/bosshard.mjs: with the strategy bots the boss night is often not harder than a plain ring-5 night even without hunting (e.g. average turtle house 5 33 vs 29%, expert traps house 0 100 vs 96%). Needs a boss tuning pass on the strategy bots.

## Abuse list pass (owner Nov 24 07:35 "go on"; bots only, CONFIG.tough on, 36 nights per ring per strategy)
Win % / hit % on rings 1-5:
| strategy | novice | average | expert |
|---|---|---|---|
| prism turtle (lances + prisms), before | 100/0 100/0 100/0 97/3 75/25 | 100/0 x4, 89/11 | 100/0 x5 |
| prism turtle, after (prism: own shots only, x1.1) | 69 75 78 39 17 | 89 100 83 89 56 | 100 100 97 97 86 |
| prism gunner (2 Sun makers + prisms), x1.5 own shots only | 83 83 69 64 19 | 100 100 100 100 97 (hit 3-22%) | 100/0 x5 |
| prism gunner, after (x1.1) | 25 53 28 28 6 | 94 94 92 94 75 | 100 100 100 100 97 |
| kill box (panels everywhere, head shots over a panel as easy as open ones) | 47 50 36 11 8 | 94 94 94 89 56 (hit 8-19%) | 100/0-3 |
| press traps | 72 64 58 17 8 | 100 97 86 81 50 | 100 x5 (hit 6-14%) |
| mist + shard | 58 69 36 14 3 | 89 89 75 56 17 | 100 100 100 100 94 |
| upstairs fort (stair top panelled, lances) | 81 89 81 81 56 | 92 94 86 83 67 | 100 97 97 94 92 |
| fort with panels only / two Sun makers only | 28-31 / 17-33 on rings 1-2 | 69 69 42 31 17 / 83 89 69 72 53 | 94-100 |
- Fixed: Prism boosts the player's own shots only (CONFIG.devices.prism.turrets false) and by x1.1 (was x1.5 on every shot within 3 m, turrets included).
- Fixed: reload = left (src/base.js markPending / settlePending): a save loaded with a night still pending counts it as left (minimum payout, no ring, the day moves on); not on the first night.
- Watch, not changed: the upstairs fort is the strongest late strategy for weak aim (novice ring 4 81% vs the turtle's 53%) but is hit on 50-60% of nights; the kill box depends on the assumption that head shots over a panel are as easy as open ones.
- Not an exploit but open: at expert aim nearly every strategy wins rings 1-3 with hits on 0-17% of nights. The challenge for a strong player on rings 1-3 is still small.
- New check: test.js 'exploits: none of the known abuse strategies wins every night unhit on rings 1-3 at novice or average aim'.
