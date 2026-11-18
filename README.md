# Dawnpunk

A first-person solarpunk night-defence game for the web. By day you bank sunlight and scout the ruined street; at night you hold whatever house you are in against the Gloom machines with bloom-tech devices and an archerfish cannon, then ride home to the base at dawn. It runs in the browser on desktop and phone (Three.js, one HTML file).

Made for Jamference and GitHub Game Off 2026.

## Build

Needs Node.js 22 and Python 3 (the build runs a small source check, `tools/commentcheck.py`).

```
npm ci
node build.mjs
```

This writes `dist/index.html` with its files beside it (`music/`, `tex/`, `models/`, `voice/`, `physics.js`), `dist/index_single.html` (everything inside one file) and `dist/solardg-itch.zip`. Open `dist/index_single.html` in a browser to play.

## Checks

- Game logic: `node test.js` (PASS / FAIL lines).
- Browser checks: `tools/*check*.cjs`, run with Playwright and Chromium's software renderer (`--use-gl=swiftshader`), each printing PASS / FAIL lines. The list, with each check's arguments, tier and time limit, is `ci/checks.json`.
- On GitHub: the **checks** workflow (Actions tab, "Run workflow") builds once, then runs every check in its own job side by side and ends with one summary table. Pick a group: `all`, `logic` (test.js and the logic checks, run once on the phone tier, since the game logic is the same on both), `desktop` (graphics checks on the desktop tier) or `phone` (phone screen fit). It never runs on push.

## Credits

- Design and direction: vendatta77
- Built with: Claude (Anthropic)
- Engine: three.js (MIT); desktop physics: cannon-es (MIT)
- Fonts: Caveat and Kalam (SIL Open Font License 1.1)
- Textures painted with klad (klad.studio)
- Music generated with Google Gemini
- Marla's voice (desktop): Chatterbox by Resemble AI (MIT), cloned from the Kokoro-82M voice bf_isabella (Apache 2.0)

## AI use

This game was made with AI assistance. Claude (Anthropic) wrote the code, built the 3D models by code in Blender, painted the textures, wrote the in-game text and ran the testing, under the developer's direction and review. The music was generated with Google Gemini. Marla's voice was generated with Chatterbox from a Kokoro voice.

## Licence

Code: MIT (`LICENSE`). Art, models, textures, music and voice clips: all rights reserved (`ASSETS-LICENSE.md`, which also lists the third-party parts).
