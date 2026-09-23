# LumaField

A browser workspace for exploring Gaussian splat scenes. Open a local `.splat`
or binary `.ply`, orbit the scene, load camera views, and export the result.
The default Meridian Pavilion is original procedural architecture. An optional
Houseplant scene is a real photographic capture by Marcel Padilla (CC BY 4.0).
Both are bundled locally, so exploring them needs no external model host or upload.

LumaField is a substantive adaptation of the MIT-licensed
[antimatter15/splat](https://github.com/antimatter15/splat) renderer by Kevin Kwok.
See [source provenance and retained credits](THIRD_PARTY.md). The WebGL renderer,
depth sorting and camera controls remain the foundation of this project.

## Run

No dependency installation is needed. Use Node 20+ for tests and builds, and any
static HTTP server for the browser. For example:

```bash
npm test
npm run build
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. Serve over HTTP or HTTPS; module workers do not
work reliably from `file://`. All runtime assets use relative URLs, including
the worker and demo, so `/LumaField/` project hosting works without rewriting.
The browser requires WebGL 2 and hardware acceleration. A readable error appears
when that capability is unavailable.

## Explore

Use the **Scene** selector above the viewport to switch between Meridian Pavilion
and Houseplant. The selected bundled scene is retained in the URL for reloads.
Houseplant is 3.47 MiB with 113,648 splats. Author and license links appear in the
viewport and under **Controls → Scene details**; full provenance is in
[THIRD_PARTY.md](THIRD_PARTY.md).

- **Open a scene** or drag a `.splat`/`.ply` file into the viewer. Files stay in the browser.
- **Reset view** fits the current scene. **Auto orbit** animates the viewpoint.
- **Save view** stores the camera matrix in the URL hash. For local files, reopen the same file before using the saved view; the URL never embeds your model.
- **Download splat** exports the current scene, including a converted PLY.
- Open **Controls → Load camera JSON** for an array of calibrated camera views.
- Drag to orbit, right-drag to move, scroll to orbit, or Ctrl-scroll to zoom. Touch, keyboard and standard gamepad controls are retained; the in-app help lists them.

A remote CORS-enabled scene can be opened with `?url=https://example.org/scene.splat`.
Remote requests omit credentials. Content-Length is optional; actual streamed
bytes are bounded before scene conversion. Local import cancels a pending fetch.
Invalid imports leave the previously loaded scene available.

## Supported formats and limits

| Input | Contract |
| --- | --- |
| `.splat` | Complete 32-byte records: float32 XYZ position, float32 XYZ scale, uint8 RGBA, uint8 WXYZ quaternion; little-endian |
| Gaussian `.ply` | Binary little-endian 1.0; vertex element first; scalar numeric properties; XYZ, scale_0–2, rot_0–3, opacity, and either f_dc_0–2 or RGB |
| Colored point `.ply` | Same binary/header restrictions; XYZ and RGB; rendered with a fixed 0.01 scale and opaque color |
| `cameras.json` | Nonempty array of position[3], orthonormal rotation[3][3], positive fx/fy; optional width/height for source intrinsics |

Imports are capped at 128 MiB and two million splats. PLY headers are capped at
64 KiB. Camera JSON is capped at 4 MiB and 10,000 cameras. Coordinates must be
finite and within ±10,000; positive scales must not exceed 64, keeping covariance
within the half-float texture range. Raw encoded quaternions are normalized.
Unsupported formats, missing properties, empty files, truncated rows and invalid
numbers fail explicitly. The viewer does not train models or reconstruct photos.
Higher-order spherical harmonics and view-dependent colors are not represented
in `.splat`; only the base color is retained during conversion.

For batch conversion using the same validated parser:

```bash
node scripts/convert.mjs input.ply output.splat
```

The converter refuses to overwrite an existing output. The retained upstream
Python converter is historical source; it is not the maintained import path.

## Reproduce the demo and checks

```bash
npm run demo   # regenerates assets/meridian.splat and assets/demo.json
npm test       # Node's built-in runner; no browser or third-party test libraries
npm run build  # copies the complete static app to dist/
```

The seeded pavilion contains 51,372 splats: tiled stone, copper archways,
planters and exhibition rings. It is an idealized geometric scene rather than a
photogrammetry reconstruction. The automated checks exercise real conversion,
malformed data, numeric limits, camera validation, streaming without size
headers, same-count scene replacement, and covariance packing. Browser rendering
and visual verification are separate checks; passing Node tests alone does not
prove GPU/browser compatibility. See [verification notes](docs/VERIFICATION.md).

CI verifies every push and pull request. GitHub Pages publication is a separate,
manual **Publish GitHub Pages** workflow, so verification does not publish a site.

## License

Application code and the procedural Pavilion use MIT; the original Kevin Kwok
copyright is retained in [LICENSE](LICENSE). The Houseplant capture is separately
licensed CC BY 4.0, with its author, source and full license retained in
[THIRD_PARTY.md](THIRD_PARTY.md).
