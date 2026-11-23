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

## 6. BUILT (OWNER DECISION Nov 23 23:26 "Tougher + catch-up"), commit 3d5df92
- CONFIG.tough { hp: [1.5, 1.35, 1.2, 1, 1], ease: 0 }: machines on rings 1-3 have that much more health from the second night on; same number of machines. A lost night brings back the old health for the next try; a win restores the extra (save.lossRun).
- Calibration, fresh saves, 48 nights per ring: expert / sharp ring 1 x1.5 85 / 85% win, hurt 21 / 25%; ring 2 x1.3 92-94% and x1.4 75-79% (x1.35 picked between); ring 3 x1.2 83 / 77% win, hurt 27 / 29%. Most alive at once unchanged (ring 3 median 17-18, 90% 24-25).
- Whole saves (tools/nightthreat.mjs 40 mix; NOTOUGH=1 = before). Win % nights 1-6, ring reached in brackets:
| bot | before | after |
|---|---|---|
| novice | 95 80 63 45 28 23 (1 2 3 3 4 4) | 95 23 65 40 40 38 (1 2 2 3 3 4) |
| average | 100 100 83 63 48 20 (1 2 3 4 4 5) | 100 48 78 60 60 40 (1 2 2 3 4 4) |
| expert | 100 100 95 83 45 40 (1 2 3 4 5 5) | 100 85 85 85 48 40 (1 2 3 4 5 5) |
| sharp | 100 100 100 80 58 48 (1 2 3 4 5 5) | 100 90 90 83 60 50 (1 2 3 4 5 5) |
- Night 2 (first try at ring 2) is now a real wall for novice and average (23 / 48%); the catch-up puts them about one night behind on the climb. Strong bots now lose 10-15% of nights 2-4 instead of never; on nights they win they are still rarely hurt (median damage 0).
- test.js: 4 new checks (tough values and catch-up; same Gloom count with toughHp x health; most alive on ring 3 not above before + 1; expert ring 1 wins 70-96%, 85% now).
- Not done: real phone, human play; the boss night (ring 5) unchanged.

## 7. Owner 23:56: the weakest bot with the owner's plan (tools/wallbot.mjs, novice aim 55% and reactions, 48 nights per ring, as released)
Plan: back to a ground-floor wall, turbine beside, lance in front; with spare Sun the second turbine, then lances to the cap; shoots only Gloom within 6 m.
- All rings 1-5 (boss included): win 100%, hurt on 0% of nights. Same with CONFIG.tough (3d5df92) on.
- One traced night per ring: all 2 turbines + 3 lances are down by second 3 of the night (the starting Sun pays for them); lances fire 194-326 shots against 50-96 from the player; the nearest Gloom gets to 0.8-2.8 m and never lands a hit.
- What does the work (same bot): standing in the room's centre instead of at the wall: still 100% / 0% hurt. Only 1 turbine + 1 lance: ring 1 92%, ring 3 42%, ring 5 0%. Lance cap 3: still 100% everywhere; cap 2: rings 1-4 100%, boss night 92%. Lance damage 5 -> 3: rings 1-3 98-100%, ring 4 90%, ring 5 44%.
- So the cause is not the wall: it is two turbines plus several lances, all bought in the first seconds of the night. The earlier bots lost because they built slowly and spent Sun on panels, which keep the Gloom outside where the lances cannot see them.

## 8. Owner 23:59: the same wall bot, two turbines plus another device in the lance's place (DEV=..., 48 nights per ring, win % / hurt % of nights)
| device | ring 1 | ring 2 | ring 3 | ring 4 | ring 5 (boss) |
|---|---|---|---|---|---|
| lance (before) | 100/0 | 100/0 | 100/0 | 100/0 | 100/0 |
| sling | 100/0 | 100/0 | 100/0 | 100/0 | 100/0 |
| twin | 100/0 | 100/0 | 100/0 | 100/0 | 92/8 |
| mist | 100/0 | 100/0 | 100/0 | 96/4 | 60/42 |
| prism | 98/27 | 96/40 | 83/60 | 58/73 | 19/90 |
| chime | 98/21 | 98/33 | 75/69 | 50/90 | 21/96 |
| press | 92/40 | 85/46 | 65/75 | 40/81 | 6/100 |
| shard | 90/60 | 90/71 | 71/79 | 46/92 | 29/100 |
| mine | 85/65 | 83/81 | 50/90 | 19/100 | 0/100 |
| moon (2nd power maker, no weapon) | 79/85 | 77/94 | 42/96 | 13/100 | 4/100 |
- Every device that shoots by itself (lance, sling, twin, mist) carries the weakest bot through rings 1-3 untouched; the sling even through the boss. The others need the player's own aim and behave like a real game.
- Not placeable beside him, so not tested: panel, trellis (they go on an opening), flask (thrown).

## 9. Owner 00:02: two turbines plus Flask (thrown at the nearest Gloom inside within 4 m when the Sun covers it) or Panel (with Sun for one: walk to the nearest open ground-floor opening, panel it, walk back). Win % / hurt %
| device | ring 1 | ring 2 | ring 3 | ring 4 | ring 5 (boss) | used per night (median) |
|---|---|---|---|---|---|---|
| flask | 35/81 | 25/83 | 6/100 | 0/100 | 2/100 | 3-5 throws |
| panel | 46/79 | 42/88 | 6/96 | 2/100 | 4/100 | 9-18 panels |
- With either, the turbines are mostly gone by dawn (0-1 standing). Without a device that shoots by itself, the weakest bot loses most nights from ring 1.
