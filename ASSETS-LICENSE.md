# Assets licence

**Art, models, textures, music and voice clips: All rights reserved, (c) 2026 vendatta77.**

This covers, in this repository:

- `art/` (3D models in `art/models_hi`, textures in `art/texhi`, music in `art/music`, Marla's voice clips in `art/voice/mp3`)
- the art carried inside source files as data: `src/modeldata.js`, `src/texdata.js`, `src/musicdata.js`, `src/handsdata.js`, `src/bookfonts.js` (the fonts in it stay under their own licence, below)
- the game's written lore and dialogue text

You may build and play the game from this repository for yourself. You may not reuse, redistribute or sell the art, music or voice clips outside this game without written permission. The source code is under the MIT licence (see `LICENSE`).

## Third-party parts and their licences

| Part | Used for | Licence |
|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) | 3D engine (npm package, bundled into the build) | MIT |
| [meshoptimizer](https://github.com/zeux/meshoptimizer) decoder by Arseny Kapoulkine (shipped with three.js as `meshopt_decoder.module.js`) | decodes the compressed 3D models at load (bundled into the build) | MIT |
| [cannon-es](https://github.com/pmndrs/cannon-es) | desktop physics (npm package, bundled into `dist/physics.js`) | MIT |
| [Caveat](https://github.com/googlefonts/caveat) font, (c) 2014 The Caveat Project Authors | journal handwriting (embedded in `src/bookfonts.js`) | SIL Open Font License 1.1, `licenses/OFL-Caveat.txt` |
| [Kalam](https://github.com/itfoundry/kalam) font, (c) 2014 Indian Type Foundry | journal handwriting (embedded in `src/bookfonts.js`) | SIL Open Font License 1.1, `licenses/OFL-Kalam.txt` |
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), voice bf_isabella | base voice that Marla's voice was cloned from | Apache 2.0 |
| [Chatterbox](https://github.com/resemble-ai/chatterbox) by Resemble AI | generated Marla's voice clips (each carries Resemble's inaudible Perth watermark) | MIT |
| Google Gemini | generated the music ("Where the Roots Breathe", "Ivy on the Glass", "The Green Perimeter") | Google's terms for generated output |
| [ICT-FaceKit](https://github.com/ICT-VGL/ICT-FaceKit), (c) 2020 USC Institute for Creative Technologies | the scanned face base fitted to the scan-face character heads (for example `art/models_hi/bram_scan_*.glb`) | MIT, `licenses/MIT-ICT-FaceKit.txt` |
| [MakeHuman](http://www.makehumancommunity.org/) shape targets | body base shapes for the people models | CC0 |

Textures were painted with klad (klad.studio). The 3D models were built by code in Blender. No pre-made art packs were used.
