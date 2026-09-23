# Source and licenses

LumaField adapts Kevin Kwok's [antimatter15/splat](https://github.com/antimatter15/splat)
renderer, based on upstream commit `ba182b51b7c2ad5738cdd6741cd63336d27470fb`.
The original project is distributed under the MIT license. Its copyright notice
and permission terms are retained without modification in [LICENSE](LICENSE).

The WebGL shaders, Gaussian covariance construction, counting-sort worker,
camera matrix math, and mouse, touch, keyboard and gamepad navigation derive
from that implementation. LumaField adds a new interface, local scene workflow,
validated import boundaries, a modular worker, reliable loading, regression
checks, an original procedural scene, and static hosting support. This is a
viewer adaptation, not an independently invented splat rendering algorithm.

The original README, including its technical explanation and acknowledgements,
is preserved in [docs/UPSTREAM_README.md](docs/UPSTREAM_README.md). The original
Python converter is also retained as `convert.py`; the maintained dependency-free
converter is `node scripts/convert.mjs` and shares validation with the viewer.

## Bundled scene and interface

`assets/meridian.splat` is generated entirely by `scripts/generate-demo.mjs`
using deterministic seed 4309. It contains analytic architectural geometry,
procedural materials, and no photographs, scans, trained models or downloaded
media. The generator and generated scene are distributed under this repository's
MIT license. The sidebar thumbnail is CSS geometry, not a source photograph.
No third-party font, analytics script, CDN runtime, or hosted demo asset is used.

Upstream's external demonstration scenes are not bundled or required.

## Houseplant photographic capture

`assets/captures/houseplant.splat` is **Houseplant by Marcel Padilla**, from
[Gaussian Splat Objects Dataset (2026)](https://marcelpadilla.com/Gaussian_Splat_Object_Dataset/),
licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
The original scene bytes are redistributed without modification. This is an
independent author's real photographic capture, not a LumaField capture.

- [Pinned source and object metadata](https://github.com/marcelpadilla/splats/tree/c3e5ec0a8ddb3ab26f28a067a29d272fe1a23411/data/plant)
- [Bundled publisher metadata](assets/captures/houseplant.meta.json)
- [Full license, scope and warranty disclaimer](assets/captures/LICENSE-CC-BY-4.0.txt)
- 113,648 splats; 3,636,736 bytes; SHA-256 `ce9d490b18f16d6730d832227bf541431b8b1a5d167c5a3fe89af4f324c0d8fd`

The publisher explicitly lists `plant` among the photographic captures and
reconstructions covered by this license. The data uses reconstruction scale,
not measured units, and does not contain view-dependent spherical harmonics.
Its CC BY 4.0 license is separate from the application's MIT license.
