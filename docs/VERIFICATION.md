# Verification

## Local checks

The implementation was exercised with Node 24.14.0 using `npm test`,
`node --check main.js`, `node --check worker.js`, and `npm run build`.
All 31 tests passed on 27 September 2026. The suite uses Node's built-in runner and actual parser/worker code, not mocked conversion output. Integration regressions evaluate production main.js with minimal DOM/WebGL surfaces and real buffer transfer semantics. These cover state changes, not GPU pixels; browser/GPU verification is a separate step.

The original source was inspected at
`ba182b51b7c2ad5738cdd6741cd63336d27470fb`. Direct execution reproduced its
same-count scene replacement producing only one texture update for two scenes,
and an absent Content-Length producing a zero-byte download allocation.
The revised worker requires a UI activation acknowledgement, so a stale import
followed by an invalid one cannot silently replace the active render scene.

The tests cover known XYZ/RGB and Gaussian PLY conversion, LF and CRLF headers,
UTF-8 comments, log-scale/opacity/color conversion, unsupported ASCII,
truncated rows, oversized or zero vertex counts, nonfinite coordinates,
partial .splat rows, scale limits, camera dimensions and rotation,
invalid saved-view matrices, unknown download lengths, byte limits,
same-count replacement, failed replacement, half-float underflow and normalized
quaternion covariance. Same-count texture content is checked numerically.

An independent code review reproduced three integration defects in an earlier
LumaField draft: out-of-order camera JSON completion, stale focal lengths after
Reset view, and worker/UI divergence after stale accepted import plus newer
failed import. Generation guards, restoring the fitted camera, and explicit
worker activation address those cases. The independent reviewer reran all three production integration scenarios and confirmed the fixes. A fourth regression verifies that a saved local-scene view survives the initial demo load and is restored when the matching file is reopened. Keyboard V and the Save view button share the same path.

The current integration checks also cover continuous auto orbit from the active view, frame-cadence independence, camera navigation beyond ten views, numbered keyboard shortcuts, Free view after an external view hash, invalid camera JSON preserving the active scene and camera set, a selectable view-link fallback without clipboard access, remote-versus-local save wording, and failed or stale bundled scene requests leaving the scene selector truthful.

## Browser workspace check

The local app was served over HTTP from source and opened in Chrome at desktop and 390×844 widths. Both bundled scenes rendered with the correct selection and Houseplant attribution. On the narrow layout, a real 12-view camera JSON loaded through the visible camera action; direct entry of `12` selected Camera 12 of 12, and starting Orbit changed the camera label to Free view. The mobile toolbar kept readable action labels. This browser pass verifies the observed render and controls on this machine, not other GPUs or devices. Clipboard writing was not exercised in the browser; the no-clipboard selectable-link path passed in the integration harness.

## Reproducible data

`npm run demo` deterministically generates 51,372 splats (1,643,904 bytes).
The scene contains original procedural geometry and no external media. A regeneration produced the same SHA-256, `34b3d4cf561b72e50f662772249a26400860dabba08e58976eb07d517f118e72`. The CLI converter was also exercised on a known one-vertex PLY; a second attempt refused the existing output and preserved its bytes. The upstream LICENSE remains byte-identical.
The app's default load resolves `assets/meridian.splat` relative to its module,
not an external model server. The build preserves the same relative layout,
including worker imports and provenance documents.

## Limits

This project views existing splat/PLY scenes. It does not train or reconstruct
photographs. The synthetic pavilion demonstrates rendering and navigation,
not photogrammetric accuracy. Node tests do not establish frame rates or visual
correctness on every GPU. Extremely large files may still exceed a device's
available memory despite the explicit import limits. Higher-order spherical
harmonics are not retained by the compact output format. GitHub Actions and
Pages configuration are provided; a local build is not a remote deployment.

## Bundled real capture

Houseplant by Marcel Padilla is bundled unchanged under CC BY 4.0 as an optional
scene. The 3,636,736-byte file contains 113,648 splats, and its SHA-256 matches
publisher metadata: `ce9d490b18f16d6730d832227bf541431b8b1a5d167c5a3fe89af4f324c0d8fd`.
The actual parser and worker accepted every record, produced a 2048×111 texture,
sorted all splats and emitted no nonfinite covariance values.

The production integration regression loads the real bundled files, selects
Houseplant, checks the displayed count and attribution, reloads its URL into a
new application context, then returns to Pavilion and verifies the default URL
and credit state. These are state and data checks; root browser/GPU review is
separate. Pavilion remains the default when no scene is specified.
