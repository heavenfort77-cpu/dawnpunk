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
