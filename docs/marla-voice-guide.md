# Marla's voice guide (Dawnpunk only; draft for the owner, Nov 23)

Why: a player wrote that "the speech is obvious 'claude' style" and asked for a style guide for text. Owner (Nov 23 05:55): the uncanny part is the language and the voice, not the faces.
Sources used: the owner's words only (tsundere rival-friend, "Draconia and Potter" dynamic; sarcastic first-night streak lines, Nov 16; lore "not PG, but no gore; plain people's writing, not exposition", Nov 16-17). Nothing carried over from another game.

## What reads as machine-written now (measured on the 77 voiced run lines and the 30 journal lines)
- No contractions: 16 voiced lines say "do not / I am / it is / that is / they are"; only 9 use a contraction. People under fire contract.
- Her name for him in a third of the barks: 26 of 77 say "Potts". A name tag on every line is a template, not a person.
- She reads out the controls: 14 voiced lines name clicks, keys, bars or screen corners ("Right click. Go.", "Walk speed, top right"); 8 have a colon or brackets. Nobody speaks punctuation.
- One joke shape repeated: statement + tease + "Potts". In the journal, 15 of 30 lines end on a 1-3 word fragment after two sentences, and 15 of 30 use the same deny-then-reveal tag ("Obviously.", "Unrelated.", "For the turbine.").
- Stock tics: "Hmph", "Do not make it weird" (twice), the three-beat "Hold. Glow. Release." / "Device. Path. Today."

## Who she is
- Marla, the village Scout. She was holding nights before Ashley Potts arrived and thinks a panel-tender is the bottom job. Rival first, friend second (Draconia and Potter): she keeps score, needles his choices, and quietly makes sure he lives.
- She believes the Gloom are old service machines doing a broken job. She knows ranges, windows, counts, food, power. She never knows there is a screen, a mouse, a bar or a key.
- Her care shows in what she does (saved food, a lantern left out, a fixed glove), almost never in what she says. A plain admission is spent once in the whole game, not once per line.

## Rules for every line
1. Contractions always ("don't", "it's", "you're"). British spelling and words (she sounds like the voice: English, dry).
2. Combat barks: place first, then count, then the order. "Behind you, two." Under 40 characters on screen.
3. "Potts" in at most one line in four. "Ashley" only when she is scared for him (low health), never as a joke.
4. No colons, brackets, keys or screen words in her mouth. The control goes in the on-screen prompt; she says the action ("Panel on that window").
5. Sarcasm by understatement, not by tag words ("Genius.", "Allegedly.", "huh?"). The joke is aimed at the situation, the machines, or his choice of the moment, never at a group of people. Never cruel. No gore.
6. Vary the shape inside each family: one with no name, one a question, one a single word, one that is an order. No three-word fragment triplets. No catchphrase she says on every night.
7. Journal: short dated-feeling notes, not punchlines. At most one deny-then-reveal line in four; the rest are plain facts she chose to write down, and the reader works out why.
8. Base talk: one or two sentences, under 90 characters. She asks where to, or reacts to something real in the save (a fixed turbine, a lost night), not to "how things are going".

## In the voice (examples)
- "Behind you. Two of them."
- "You're leaking. Eat something before I have to carry you."
- Journal: "Potts back at first light. Left the good lantern by his door."

## Not her (examples)
- "Do not make it weird, Potts." (no contraction, catchphrase, name tag)
- "Switched off by day, Potts. Do not shoot them, do not bump them: wake one and it brings friends tonight." (a rules lecture with a colon)

## Proposed rewrites (a sample to check the guide; NOT in the game; the rest follow once the guide is approved)
| id | now | proposed |
|---|---|---|
| inbound_1 | Gloom {d}. Look awake, Potts. | {D}. One coming. |
| inbound_4 | Company {d}. Do not make it weird. | Company, {d}. |
| collector_3 | Collectors, {d}. Today, Potts. | They're on the collector, {d}! |
| hurt_2 | Use the panels. That is their job. | Get behind the panel, that's what it's for. |
| hurt_3 | Stop getting hit. It distracts me. | Stop standing in front of them. |
| low_3 | Ashley... eat. Do not make me say it twice. | Ashley, eat something, please. |
| streak_3 | You hit back. That is the idea. Allegedly. | You're allowed to shoot back, you know. |
| drill_place_desk | Device in its path. Right click. Go. | Put something in its way. (prompt: Right click) |
| drill_charge_again | Hold. Glow. Release. | Let it build, then let go. |
| day_dormant | Switched off by day, Potts. Do not shoot them, do not bump them... | They're asleep. Leave them be, or they'll bring friends tonight. |
| supper | That's the village's supper, Potts. Hmph. | That's the village's supper you're eating. |
| journal 10 | Potts took a hit meant for the turbine. I yelled. Loudly. For the turbine. | Potts took a hit meant for the turbine. I shouted at him for it. |

Notes: {D} = the existing direction with a capital ("Behind", "On your left", "Upstairs"). Every changed voiced line needs a new clip (art/voice/gen_voice.py) and the voice table rebuilt (art/voice/lines.mjs); prompts that move off her lines go to the HUD. Locked lines: none known; tell me any you wrote or want kept as they are.

## Checks for any new line
- Does it sound like another game's narrator, or like a helpful assistant explaining? Rewrite it.
- Read it aloud at the speed of a fight. If it needs a breath in the middle, cut it.
- Count per family: contractions in every line where one fits; "Potts" in no more than one in four; no colon or key name.
