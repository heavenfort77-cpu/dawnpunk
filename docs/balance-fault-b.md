# Balance Fault B: "the other nights were too easy once I knew how to build" (Nov 23, measured, no game value changed)

Bots only (logic sim, src/bots.js); no human has played these numbers. Fresh saves unless "campaign". Runs: `node tools/nightpressure.mjs` (env P, R, CM, G), `node tools/nightthreat.mjs 30 mix` (whole saves, env ATT).

## 1. What the game does now (nightpressure, 60 nights per ring per bot)
| bot (builds) | ring 2 win / hurt | ring 3 win / hurt | ring 4 win / hurt | nearest Gloom on won nights r2-r4 |
|---|---|---|---|---|
| novice | 80% / 43% | 60% / 58% | 28% / 97% | 4.8 / 2.8 / 0.9 m |
| average | 90% / 27% | 87% / 23% | 58% / 58% | 5.1 / 5.1 / 4.7 m |
| expert | 100% / 2% | 98% / 5% | 88% / 23% | 6.5 / 5.9 / 5.2 m |
- Matches the report for a good builder: rings 1-3 never reach you (expert hurt on 2-5% of nights, nearest Gloom 6-7 m).
- Nights are all-or-nothing: damage taken is mostly 0 or over 100 (quartiles per ring, 48 nights: e.g. average ring 4 0 / 64 / 176); "hurt but alive" stays at 0-27% of nights at every setting tried. Losses (average and novice, rings 2-4): battery first empty at 18-63 s, first hit mostly 85-145 s (the last two waves start at 98 and 130 s), dead 3-30 s after the first hit.
- Count is flat where the report says easy: ring.countMult 1, 1.04, 1.10, then 1.22 plus three floors on the big houses at ring 4, and the boss at ring 5 (campaign: expert 40-47% win on nights 5-6).

## 2. Levers measured (none adopted)
| change | novice r2 / r3 | average r2 / r3 | expert r2 / r3 |
|---|---|---|---|
| now | 80 / 60 | 90 / 87 | 100 / 98 |
| rings 2-3 count 1.10 / 1.16 | 68 / 35 | 88 / 80 | 100 / 97 |
| all rings count x1.3 | 47 / 13 | 53 / 40 | 92 / 73 |
| waves spread 20 s, no growth | 82 / 53 | 93 / 93 | 100 / 97 |
(win % per ring)
- Lurchers (and Ticks) going straight for you instead of devices (temporary src/sim.js patch, reverted): no change for average or expert; they die before they reach anyone.
- "Gloom attention" (nightthreat ATT=0.1,2: +10% Gloom per clean night, up to +20%; hurt -1; loss resets): campaign expert night 3 win 93 -> 77%, night 4 83 -> 67%; average night 3 83 -> 73%.
- Every lever takes wins from novice and average long before it touches expert: the gap between skill levels, not the overall level, is the fault. The bots cannot show the report's player, who is stronger than the expert bot on nights 2-4 (expert loses 17% at ring 4 and over half at the boss).

## 3. Open (owner)
- Which nights the player meant (rings 2-3 only, or 4 too) and whether they climbed a ring each night.
- Direction to test next, only with a yes: threat that scales with how strong the defence is (built devices or the last night's margin), checked so that novice and average win rates stay where they are now.

## 4. Owner 23:18: "2'5" (read as rings 2 to 5). Two more levers aimed at strong players only (none adopted)
- Signal check (60 nights per ring per bot): on clean nights the bots overlap. Median nearest Gloom 5.1 / 5.5 / 6.5 m (novice / average / expert, ring 2); killed before getting inside 48 / 51 / 61%; the battery reaches 0 after 30 s for all three. No single-night signal picks out the strong player.
- Surge (temporary src/sim.js patch, reverted): when the house is empty early and the next machine is over 6 s away, the next ones come at once plus 2 extra (up to +25% of the night). Ring 2 win: novice 80 -> 67%, average 90 -> 88%, expert 100 -> 100% (hurt 2 -> 2%). The early waves leave every bot a quiet gap, so it lands on the weak player first.
- So far no automatic lever is selective. What the numbers do support: extra machines bite a strong player at about x1.3 (expert ring 3: win 98 -> 73%, hurt 5 -> 38%), which would wreck novice (ring 3 win 60 -> 13%). That points to a choice the player makes (a harder night for more loot, like the lure cat), not a change for everyone. Owner's call.

## 5. Owner 23:23-23:25: "no challenge for ring 1 to 3"; no more machines (frame rate has no headroom, see the lag hand-overs)
Tougher machines, same number (fresh saves, 48 nights per ring per bot; win / hurt; most alive at once median / 90%):
| change | novice r1 / r2 / r3 | average r1 / r2 / r3 | expert r1 / r2 / r3 | sharp (97% aim) r1 / r2 / r3 | most alive r3 |
|---|---|---|---|---|---|
| now | 94/23, 81/42, 56/58 | 100/2, 88/31, 85/21 | 100/0, 100/2, 98/4 | 100/0, 100/2, 98/4 | 17-18 / 24-25 |
| damage x1.5 | 83/33, 58/58, 54/67 | 96/13, 75/48, 73/31 | 100/0, 100/2, 92/15 | 100/2, 100/2, 92/8 | 17-18 / 24-25 |
| damage x2 | 77/33, 52/56, 42/71 | 90/23, 58/56, 67/52 | 98/4, 98/6, 88/15 | 100/2, 98/4, 92/10 | 17-18 / 22-25 |
| health x1.3 | 50/56, 25/85, 17/92 | 73/42, 50/69, 35/90 | 94/6, 92/10, 67/50 | 94/13, 94/10, 63/54 | 16-19 / 19-25 |
- Most alive at once does not rise with tougher machines (frame-rate safe).
- Same pattern as every lever before: weak bots lose long before the strong ones are touched on rings 1-2.
