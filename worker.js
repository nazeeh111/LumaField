import { convertPly, validateSplat } from './core.js';

export function createWorker(self) {
    let buffer;
    let sceneId = 0;
    let pending = null;
    let vertexCount = 0;
    let viewProj;
    // 6*4 + 4 + 4 = 8*4
    // XYZ - Position (Float32)
    // XYZ - Scale (Float32)
    // RGBA - colors (uint8)
    // IJKL - quaternion/rot (uint8)
    const rowLength = 3 * 4 + 3 * 4 + 4 + 4;
    let lastProj = [];
    let depthIndex = new Uint32Array();
    let lastVertexCount = 0;

    var _floatView = new Float32Array(1);
    var _int32View = new Int32Array(_floatView.buffer);

    function floatToHalf(float) {
        _floatView[0] = float;
        var f = _int32View[0];

        var sign = (f >> 31) & 0x0001;
        var exp = (f >> 23) & 0x00ff;
        var frac = f & 0x007fffff;

        var newExp;
        // JavaScript masks bitshift counts modulo 32; guard values too small
        // for a half float before shifting the significand.
        if (exp < 103) {
            newExp = 0;
            frac = 0;
        } else if (exp < 113) {
            newExp = 0;
            frac |= 0x00800000;
            frac = frac >> (113 - exp);
            if (frac & 0x01000000) {
                newExp = 1;
                frac = 0;
            }
        } else if (exp < 142) {
            newExp = exp - 112;
        } else {
            newExp = 31;
            frac = 0;
        }

        return (sign << 15) | (newExp << 10) | (frac >> 13);
    }

    function packHalf2x16(x, y) {
        return (floatToHalf(x) | (floatToHalf(y) << 16)) >>> 0;
    }

    function generateTexture() {
        if (!buffer || !vertexCount) return;
        const f_buffer = new Float32Array(buffer);
        const u_buffer = new Uint8Array(buffer);

        var texwidth = 1024 * 2; // Set to your desired width
        var texheight = Math.ceil((2 * vertexCount) / texwidth); // Set to your desired height
        var texdata = new Uint32Array(texwidth * texheight * 4); // 4 components per pixel (RGBA)
        var texdata_c = new Uint8Array(texdata.buffer);
        var texdata_f = new Float32Array(texdata.buffer);

        // Here we convert from a .splat file buffer into a texture
        // With a little bit more foresight perhaps this texture file
        // should have been the native format as it'd be very easy to
        // load it into webgl.
        for (let i = 0; i < vertexCount; i++) {
            // x, y, z
            texdata_f[8 * i + 0] = f_buffer[8 * i + 0];
            texdata_f[8 * i + 1] = f_buffer[8 * i + 1];
            texdata_f[8 * i + 2] = f_buffer[8 * i + 2];

            // r, g, b, a
            texdata_c[4 * (8 * i + 7) + 0] = u_buffer[32 * i + 24 + 0];
            texdata_c[4 * (8 * i + 7) + 1] = u_buffer[32 * i + 24 + 1];
            texdata_c[4 * (8 * i + 7) + 2] = u_buffer[32 * i + 24 + 2];
            texdata_c[4 * (8 * i + 7) + 3] = u_buffer[32 * i + 24 + 3];

            // quaternions
            let scale = [
                f_buffer[8 * i + 3 + 0],
                f_buffer[8 * i + 3 + 1],
                f_buffer[8 * i + 3 + 2],
            ];
            let rot = [
                (u_buffer[32 * i + 28 + 0] - 128) / 128,
                (u_buffer[32 * i + 28 + 1] - 128) / 128,
                (u_buffer[32 * i + 28 + 2] - 128) / 128,
                (u_buffer[32 * i + 28 + 3] - 128) / 128,
            ];

            const norm = Math.hypot(...rot);
            rot = rot.map(v => v / norm);

            // Compute the matrix product of S and R (M = S * R)
            const M = [
                1.0 - 2.0 * (rot[2] * rot[2] + rot[3] * rot[3]),
                2.0 * (rot[1] * rot[2] + rot[0] * rot[3]),
                2.0 * (rot[1] * rot[3] - rot[0] * rot[2]),

                2.0 * (rot[1] * rot[2] - rot[0] * rot[3]),
                1.0 - 2.0 * (rot[1] * rot[1] + rot[3] * rot[3]),
                2.0 * (rot[2] * rot[3] + rot[0] * rot[1]),

                2.0 * (rot[1] * rot[3] + rot[0] * rot[2]),
                2.0 * (rot[2] * rot[3] - rot[0] * rot[1]),
                1.0 - 2.0 * (rot[1] * rot[1] + rot[2] * rot[2]),
            ].map((k, i) => k * scale[Math.floor(i / 3)]);

            const sigma = [
                M[0] * M[0] + M[3] * M[3] + M[6] * M[6],
                M[0] * M[1] + M[3] * M[4] + M[6] * M[7],
                M[0] * M[2] + M[3] * M[5] + M[6] * M[8],
                M[1] * M[1] + M[4] * M[4] + M[7] * M[7],
                M[1] * M[2] + M[4] * M[5] + M[7] * M[8],
                M[2] * M[2] + M[5] * M[5] + M[8] * M[8],
            ];

            texdata[8 * i + 4] = packHalf2x16(4 * sigma[0], 4 * sigma[1]);
            texdata[8 * i + 5] = packHalf2x16(4 * sigma[2], 4 * sigma[3]);
            texdata[8 * i + 6] = packHalf2x16(4 * sigma[4], 4 * sigma[5]);
        }

        self.postMessage({ texdata, texwidth, texheight, sceneId }, [texdata.buffer]);
    }

    function runSort(viewProj) {
        if (!buffer || !vertexCount || !viewProj) return;
        const f_buffer = new Float32Array(buffer);
        if (lastVertexCount == vertexCount) {
            let dot =
                lastProj[2] * viewProj[2] +
                lastProj[6] * viewProj[6] +
                lastProj[10] * viewProj[10];
            if (Math.abs(dot - 1) < 0.01) {
                return;
            }
        } else {
            generateTexture();
            lastVertexCount = vertexCount;
        }


        let maxDepth = -Infinity;
        let minDepth = Infinity;
        let sizeList = new Float64Array(vertexCount);
        for (let i = 0; i < vertexCount; i++) {
            let depth =
                ((viewProj[2] * f_buffer[8 * i + 0] +
                    viewProj[6] * f_buffer[8 * i + 1] +
                    viewProj[10] * f_buffer[8 * i + 2]) *
                    4096);
            sizeList[i] = depth;
            if (depth > maxDepth) maxDepth = depth;
            if (depth < minDepth) minDepth = depth;
        }

        // This is a 16 bit single-pass counting sort
        let depthInv = maxDepth === minDepth ? 0 : (256 * 256 - 1) / (maxDepth - minDepth);
        let counts0 = new Uint32Array(256 * 256);
        for (let i = 0; i < vertexCount; i++) {
            sizeList[i] = ((sizeList[i] - minDepth) * depthInv) | 0;
            counts0[sizeList[i]]++;
        }
        let starts0 = new Uint32Array(256 * 256);
        for (let i = 1; i < 256 * 256; i++)
            starts0[i] = starts0[i - 1] + counts0[i - 1];
        depthIndex = new Uint32Array(vertexCount);
        for (let i = 0; i < vertexCount; i++)
            depthIndex[starts0[sizeList[i]]++] = i;



        lastProj = viewProj;
        self.postMessage({ depthIndex, viewProj, vertexCount, sceneId }, [
            depthIndex.buffer,
        ]);
    }

    const throttledSort = () => {
        if (!sortRunning) {
            sortRunning = true;
            let lastView = viewProj;
            runSort(lastView);
            setTimeout(() => {
                sortRunning = false;
                if (lastView !== viewProj) {
                    throttledSort();
                }
            }, 0);
        }
    };

    let sortRunning;
    self.onmessage = (e) => {
        try {
            if (e.data.ply || e.data.buffer) {
                const candidate = e.data.ply ? convertPly(e.data.ply) : e.data.buffer;
                const count = validateSplat(candidate);
                // Conversion is only a proposal. The UI explicitly activates the
                // result if this request is still current, keeping stale imports
                // from replacing the worker scene while the old image stays visible.
                pending = { buffer: candidate, count, sceneId: e.data.sceneId };
                self.postMessage({ buffer: candidate, sceneId: e.data.sceneId, accepted: true });
            } else if (e.data.activate !== undefined) {
                if (!pending || pending.sceneId !== e.data.activate) return;
                buffer = pending.buffer;
                vertexCount = pending.count;
                sceneId = pending.sceneId;
                pending = null;
                lastVertexCount = -1;
                lastProj = [];
                runSort(viewProj);
            } else if (e.data.view) {
                if (!Array.isArray(e.data.view) || e.data.view.length !== 16 || !e.data.view.every(Number.isFinite)) throw new Error("Invalid view projection.");
                viewProj = e.data.view;
                throttledSort();
            }
        } catch (error) {
            self.postMessage({error: error.message, sceneId: e.data.sceneId});
        }
    };
}

if (typeof self !== 'undefined' && typeof document === 'undefined') createWorker(self);
