# Blue Archive Viewer

An unofficial browser viewer for the extracted Blue Archive Spine archive, with English controls and original Japanese voice/dialogue.

**Website:** https://Minta1234.github.io/blueArchive-Viewer/

## Use

Search for a character, select a scene and wait for its intro to finish. Click the character to talk, hold and drag the head to pat, or drag another original hit region. Space talks; H toggles head pat; Escape releases the interaction. Original animation clips and hit-region overlays are available below the scene.

The catalog contains 294 lobby skeletons and 931 readable models in total. Models outside the lobby category do not necessarily include interactions. Assets load only for the selected scene.

**Export Wallpaper Engine** builds a ZIP entirely in the browser. Extract it into its own folder and drag `index.html` into **Create Wallpaper** in Wallpaper Engine. The ZIP includes the model, textures, selected voice clips, original Japanese dialogue, font, speech-bubble images and interaction code. The exported wallpaper works offline without this website or Node.js.

## Deployment

The `main` branch contains source code and the small static site. The `assets` branch holds the original model/texture/audio archive, approximately 5.1 GB. The published Pages artifact is approximately 21 MB and fetches assets from `raw.githubusercontent.com` on demand; no image resolution reduction is applied.

GitHub Pages is configured to use **GitHub Actions**. Every push to `main` runs `.github/workflows/deploy.yml`: install pinned dependencies, build the static site, run portable tests, upload `dist`, and deploy it to Pages. The `assets` branch does not trigger site builds.

To build locally without downloading the archive into Git history:

```sh
git clone --single-branch --branch main https://github.com/Minta1234/blueArchive-Viewer.git
cd blueArchive-Viewer
npm ci --ignore-scripts
npm run build
npm test
npm run preview
```

Open `http://127.0.0.1:4318/`. This previews the production static site and loads published assets. `scripts/build.mjs` contains the asset-branch URLs. The same relative frontend paths work under the repository's Pages subdirectory.

For local development against the original extracted archive, place this repository next to `Live2D_Export`, copy or link original voice files into the ignored `audio/` folder, and run `npm start`. This serves the original local Node export API at port 4317. `npm run test:local` runs the full archive checks and requires those local files. These files are not needed to build/deploy the website.

To publish an updated extracted archive in bounded pushes:

```sh
python scripts/upload-assets.py --models ../Live2D_Export --audio audio --dry-run
python scripts/upload-assets.py --models ../Live2D_Export --audio audio
```

The upload script creates a separate sibling checkout on the `assets` branch, validates the file inventory, preserves the original files, and pushes batches up to 600 MiB. It does not force-push. The final `asset-manifest.json` records the complete inventory.

## Fidelity and validation

- Original Spine 4.2 skeletons, atlas textures, animation settings, tracks, mixing, sync clips and colliders.
- Recovered UIRoot reference size 2960×1440, native camera constraints, idle gates, drag smoothing and release blocking.
- Japanese dialogue joined from the original MemoryLobby/CharacterDialog tables; 280 model records match a prefab, with matching animations in 274 records. Unmatched records remain unfilled.
- Original speech-bubble images and Japanese font. Original event payloads select voice clips; ambiguous voice mappings are left out.
- Arona work scenes now keep the original background track, idle actor combinations, touch colliders and return-state gates. See [the evidence and remaining gaps](docs/arona-reconstruction.md); work-scene dialogue, effects and the separate Stand portrait remain incomplete.
- Portable tests cover deployed paths, English controls, the complete readable catalog and browser-only ZIP contents. Full local checks cover 294 lobby skeletons, 5,504 clip configs and 576 drag controls.

This is not verified as a 100% reproduction. Unity timelines, post-processing, gyro, all random-idle behavior, account/season conditions, overlapping-collider ordering and full NGUI text/tween behavior are incomplete. The exported wallpaper has been checked as a standalone browser project; Wallpaper Engine native-host verification remains pending.

## Third-party components

Spine WebGL runtime 4.2.120 and its license are preserved in `vendor/`. Browser ZIP generation uses fflate 0.8.2; its MIT license is also included in `vendor/`. Blue Archive game content remains the work of its respective creators. This viewer is not affiliated with the game publisher.
