/* ============================================================
   Sakura Clock — WebGL cherry-blossom background
   Point-sprite petals + bright-pass, directional blur and bloom.
   ============================================================ */

// ---------- small vector / matrix helpers ----------
var Vector3 = {};
Vector3.create = function (x, y, z) {
    return { x: x, y: y, z: z };
};
Vector3.cross = function (v, v0, v1) {
    v.x = v0.y * v1.z - v0.z * v1.y;
    v.y = v0.z * v1.x - v0.x * v1.z;
    v.z = v0.x * v1.y - v0.y * v1.x;
};
Vector3.normalize = function (v) {
    var l = v.x * v.x + v.y * v.y + v.z * v.z;
    if (l > 0.00001) {
        l = 1.0 / Math.sqrt(l);
        v.x *= l;
        v.y *= l;
        v.z *= l;
    }
};
Vector3.arrayForm = function (v) {
    if (!v.array) {
        v.array = new Float32Array([v.x, v.y, v.z]);
    } else {
        v.array[0] = v.x;
        v.array[1] = v.y;
        v.array[2] = v.z;
    }
    return v.array;
};

var Matrix44 = {};
Matrix44.createIdentity = function () {
    return new Float32Array([1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0]);
};
Matrix44.loadProjection = function (m, aspect, vdeg, near, far) {
    var h = near * Math.tan(vdeg * Math.PI / 180.0 * 0.5) * 2.0;
    var w = h * aspect;

    m[0] = 2.0 * near / w;
    m[1] = 0.0;
    m[2] = 0.0;
    m[3] = 0.0;

    m[4] = 0.0;
    m[5] = 2.0 * near / h;
    m[6] = 0.0;
    m[7] = 0.0;

    m[8] = 0.0;
    m[9] = 0.0;
    m[10] = -(far + near) / (far - near);
    m[11] = -1.0;

    m[12] = 0.0;
    m[13] = 0.0;
    m[14] = -2.0 * far * near / (far - near);
    m[15] = 0.0;
};
Matrix44.loadLookAt = function (m, vpos, vlook, vup) {
    var frontv = Vector3.create(vpos.x - vlook.x, vpos.y - vlook.y, vpos.z - vlook.z);
    Vector3.normalize(frontv);
    var sidev = Vector3.create(1.0, 0.0, 0.0);
    Vector3.cross(sidev, vup, frontv);
    Vector3.normalize(sidev);
    var topv = Vector3.create(1.0, 0.0, 0.0);
    Vector3.cross(topv, frontv, sidev);
    Vector3.normalize(topv);

    m[0] = sidev.x;
    m[1] = topv.x;
    m[2] = frontv.x;
    m[3] = 0.0;

    m[4] = sidev.y;
    m[5] = topv.y;
    m[6] = frontv.y;
    m[7] = 0.0;

    m[8] = sidev.z;
    m[9] = topv.z;
    m[10] = frontv.z;
    m[11] = 0.0;

    m[12] = -(vpos.x * m[0] + vpos.y * m[4] + vpos.z * m[8]);
    m[13] = -(vpos.x * m[1] + vpos.y * m[5] + vpos.z * m[9]);
    m[14] = -(vpos.x * m[2] + vpos.y * m[6] + vpos.z * m[10]);
    m[15] = 1.0;
};

// ---------- timing ----------
var timeInfo = {
    start: 0,
    prev: 0,      // Date
    delta: 0,     // Number (sec)
    elapsed: 0    // Number (sec)
};

// ---------- GL state ----------
var gl = null;
var canvas = null;

var renderSpec = {
    width: 0,
    height: 0,
    aspect: 1,
    array: new Float32Array(3),
    halfWidth: 0,
    halfHeight: 0
    // render targets are attached here by setViewports()
};
renderSpec.setSize = function (w, h) {
    renderSpec.width = w;
    renderSpec.height = h;
    renderSpec.aspect = renderSpec.width / renderSpec.height;
    renderSpec.array[0] = renderSpec.width;
    renderSpec.array[1] = renderSpec.height;
    renderSpec.array[2] = renderSpec.aspect;

    renderSpec.halfWidth = Math.floor(w / 2);
    renderSpec.halfHeight = Math.floor(h / 2);
};

// ---------- render targets ----------
function deleteRenderTarget(rt) {
    gl.deleteFramebuffer(rt.frameBuffer);
    gl.deleteRenderbuffer(rt.renderBuffer);
    gl.deleteTexture(rt.texture);
}

function createRenderTarget(w, h) {
    var ret = {
        width: w,
        height: h,
        dtxArray: new Float32Array([1.0 / w, 1.0 / h])
    };
    ret.frameBuffer = gl.createFramebuffer();
    ret.renderBuffer = gl.createRenderbuffer();
    ret.texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, ret.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    gl.bindFramebuffer(gl.FRAMEBUFFER, ret.frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ret.texture, 0);

    gl.bindRenderbuffer(gl.RENDERBUFFER, ret.renderBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, ret.renderBuffer);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return ret;
}

// ---------- shaders ----------
function compileShader(shtype, shsrc) {
    var retsh = gl.createShader(shtype);

    gl.shaderSource(retsh, shsrc);
    gl.compileShader(retsh);

    if (!gl.getShaderParameter(retsh, gl.COMPILE_STATUS)) {
        var errlog = gl.getShaderInfoLog(retsh);
        gl.deleteShader(retsh);
        console.error(errlog);
        showUnsupported('The WebGL shaders could not be compiled, so the animated background is disabled.');
        return null;
    }
    return retsh;
}

function createShader(vtxsrc, frgsrc, uniformlist, attrlist) {
    var vsh = compileShader(gl.VERTEX_SHADER, vtxsrc);
    var fsh = compileShader(gl.FRAGMENT_SHADER, frgsrc);

    if (vsh === null || fsh === null) {
        return null;
    }

    var prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);

    gl.deleteShader(vsh);
    gl.deleteShader(fsh);

    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        var errlog = gl.getProgramInfoLog(prog);
        console.error(errlog);
        showUnsupported('The WebGL shaders could not be linked, so the animated background is disabled.');
        return null;
    }

    if (uniformlist) {
        prog.uniforms = {};
        for (var i = 0; i < uniformlist.length; i++) {
            prog.uniforms[uniformlist[i]] = gl.getUniformLocation(prog, uniformlist[i]);
        }
    }

    if (attrlist) {
        prog.attributes = {};
        for (var j = 0; j < attrlist.length; j++) {
            var attr = attrlist[j];
            prog.attributes[attr] = gl.getAttribLocation(prog, attr);
        }
    }

    return prog;
}

function useShader(prog) {
    if (!prog) {
        return;
    }
    gl.useProgram(prog);
    for (var attr in prog.attributes) {
        gl.enableVertexAttribArray(prog.attributes[attr]);
    }
}

function unuseShader(prog) {
    if (!prog) {
        return;
    }
    for (var attr in prog.attributes) {
        gl.disableVertexAttribArray(prog.attributes[attr]);
    }
    gl.useProgram(null);
}

// ---------- scene description ----------
var projection = {
    angle: 60,
    nearfar: new Float32Array([0.1, 100.0]),
    matrix: Matrix44.createIdentity()
};
var camera = {
    position: Vector3.create(0, 0, 100),
    lookat: Vector3.create(0, 0, 0),
    up: Vector3.create(0, 1, 0),
    dof: Vector3.create(10.0, 4.0, 8.0),
    matrix: Matrix44.createIdentity()
};

var pointFlower = {};
var sceneStandBy = false;

var BlossomParticle = function () {
    this.velocity = new Array(3);
    this.rotation = new Array(3);
    this.position = new Array(3);
    this.euler = new Array(3);
    this.size = 1.0;
    this.alpha = 1.0;
    this.zkey = 0.0;
};

BlossomParticle.prototype.setVelocity = function (vx, vy, vz) {
    this.velocity[0] = vx;
    this.velocity[1] = vy;
    this.velocity[2] = vz;
};

BlossomParticle.prototype.setRotation = function (rx, ry, rz) {
    this.rotation[0] = rx;
    this.rotation[1] = ry;
    this.rotation[2] = rz;
};

BlossomParticle.prototype.setPosition = function (nx, ny, nz) {
    this.position[0] = nx;
    this.position[1] = ny;
    this.position[2] = nz;
};

BlossomParticle.prototype.setEulerAngles = function (rx, ry, rz) {
    this.euler[0] = rx;
    this.euler[1] = ry;
    this.euler[2] = rz;
};

BlossomParticle.prototype.setSize = function (s) {
    this.size = s;
};

BlossomParticle.prototype.update = function (dt, et) {
    this.position[0] += this.velocity[0] * dt;
    this.position[1] += this.velocity[1] * dt;
    this.position[2] += this.velocity[2] * dt;

    this.euler[0] += this.rotation[0] * dt;
    this.euler[1] += this.rotation[1] * dt;
    this.euler[2] += this.rotation[2] * dt;
};

function createPointFlowers() {
    var vtxsrc = document.getElementById('sakura_point_vsh').textContent;
    var frgsrc = document.getElementById('sakura_point_fsh').textContent;

    pointFlower.program = createShader(
        vtxsrc, frgsrc,
        ['uProjection', 'uModelview', 'uResolution', 'uOffset', 'uDOF', 'uFade'],
        ['aPosition', 'aEuler', 'aMisc']
    );

    useShader(pointFlower.program);
    pointFlower.offset = new Float32Array([0.0, 0.0, 0.0]);
    pointFlower.fader = Vector3.create(0.0, 10.0, 0.0);

    // parameters: velocity[3], rotate[3]
    pointFlower.numFlowers = 1600;
    pointFlower.particles = new Array(pointFlower.numFlowers);
    // vertex attributes {position[3], euler_xyz[3], size[1]}
    pointFlower.dataArray = new Float32Array(pointFlower.numFlowers * (3 + 3 + 2));
    pointFlower.positionArrayOffset = 0;
    pointFlower.eulerArrayOffset = pointFlower.numFlowers * 3;
    pointFlower.miscArrayOffset = pointFlower.numFlowers * 6;

    pointFlower.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointFlower.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, pointFlower.dataArray, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    unuseShader(pointFlower.program);

    for (var i = 0; i < pointFlower.numFlowers; i++) {
        pointFlower.particles[i] = new BlossomParticle();
    }
}

function initPointFlowers() {
    // area
    pointFlower.area = Vector3.create(20.0, 20.0, 20.0);
    pointFlower.area.x = pointFlower.area.y * renderSpec.aspect;

    pointFlower.fader.x = 10.0;            // env fade start
    pointFlower.fader.y = pointFlower.area.z; // env fade half
    pointFlower.fader.z = 0.1;             // near fade start

    // particles
    var PI2 = Math.PI * 2.0;
    var tmpv3 = Vector3.create(0, 0, 0);
    var tmpv = 0;
    var symmetryrand = function () { return (Math.random() * 2.0 - 1.0); };
    for (var i = 0; i < pointFlower.numFlowers; i++) {
        var tmpprtcl = pointFlower.particles[i];

        // velocity
        tmpv3.x = symmetryrand() * 0.3 + 0.8;
        tmpv3.y = symmetryrand() * 0.2 - 1.0;
        tmpv3.z = symmetryrand() * 0.3 + 0.5;
        Vector3.normalize(tmpv3);
        tmpv = 2.0 + Math.random() * 1.0;
        tmpprtcl.setVelocity(tmpv3.x * tmpv, tmpv3.y * tmpv, tmpv3.z * tmpv);

        // rotation
        tmpprtcl.setRotation(
            symmetryrand() * PI2 * 0.5,
            symmetryrand() * PI2 * 0.5,
            symmetryrand() * PI2 * 0.5
        );

        // position
        tmpprtcl.setPosition(
            symmetryrand() * pointFlower.area.x,
            symmetryrand() * pointFlower.area.y,
            symmetryrand() * pointFlower.area.z
        );

        // euler
        tmpprtcl.setEulerAngles(
            Math.random() * Math.PI * 2.0,
            Math.random() * Math.PI * 2.0,
            Math.random() * Math.PI * 2.0
        );

        // size
        tmpprtcl.setSize(0.9 + Math.random() * 0.1);
    }
}

function renderPointFlowers() {
    // update
    var PI2 = Math.PI * 2.0;
    var repeatPos = function (prt, cmp, limit) {
        if (Math.abs(prt.position[cmp]) - prt.size * 0.5 > limit) {
            // out of area
            if (prt.position[cmp] > 0) {
                prt.position[cmp] -= limit * 2.0;
            } else {
                prt.position[cmp] += limit * 2.0;
            }
        }
    };
    var repeatEuler = function (prt, cmp) {
        prt.euler[cmp] = prt.euler[cmp] % PI2;
        if (prt.euler[cmp] < 0.0) {
            prt.euler[cmp] += PI2;
        }
    };

    for (var i = 0; i < pointFlower.numFlowers; i++) {
        var prtcl = pointFlower.particles[i];
        prtcl.update(timeInfo.delta, timeInfo.elapsed);
        repeatPos(prtcl, 0, pointFlower.area.x);
        repeatPos(prtcl, 1, pointFlower.area.y);
        repeatPos(prtcl, 2, pointFlower.area.z);
        repeatEuler(prtcl, 0);
        repeatEuler(prtcl, 1);
        repeatEuler(prtcl, 2);

        prtcl.alpha = 1.0; // (pointFlower.area.z - prtcl.position[2]) * 0.5;

        prtcl.zkey = (camera.matrix[2] * prtcl.position[0] +
                      camera.matrix[6] * prtcl.position[1] +
                      camera.matrix[10] * prtcl.position[2] +
                      camera.matrix[14]);
    }

    // sort back to front
    pointFlower.particles.sort(function (p0, p1) { return p0.zkey - p1.zkey; });

    // pack into the interleaved buffer
    var ipos = pointFlower.positionArrayOffset;
    var ieuler = pointFlower.eulerArrayOffset;
    var imisc = pointFlower.miscArrayOffset;
    for (var j = 0; j < pointFlower.numFlowers; j++) {
        var prtcl2 = pointFlower.particles[j];
        pointFlower.dataArray[ipos] = prtcl2.position[0];
        pointFlower.dataArray[ipos + 1] = prtcl2.position[1];
        pointFlower.dataArray[ipos + 2] = prtcl2.position[2];
        ipos += 3;
        pointFlower.dataArray[ieuler] = prtcl2.euler[0];
        pointFlower.dataArray[ieuler + 1] = prtcl2.euler[1];
        pointFlower.dataArray[ieuler + 2] = prtcl2.euler[2];
        ieuler += 3;
        pointFlower.dataArray[imisc] = prtcl2.size;
        pointFlower.dataArray[imisc + 1] = prtcl2.alpha;
        imisc += 2;
    }

    // draw
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    var prog = pointFlower.program;
    useShader(prog);

    gl.uniformMatrix4fv(prog.uniforms.uProjection, false, projection.matrix);
    gl.uniformMatrix4fv(prog.uniforms.uModelview, false, camera.matrix);
    gl.uniform3fv(prog.uniforms.uResolution, renderSpec.array);
    gl.uniform3fv(prog.uniforms.uDOF, Vector3.arrayForm(camera.dof));
    gl.uniform3fv(prog.uniforms.uFade, Vector3.arrayForm(pointFlower.fader));

    gl.bindBuffer(gl.ARRAY_BUFFER, pointFlower.buffer);
    // Update in place instead of re-allocating the buffer every frame.
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pointFlower.dataArray);

    gl.vertexAttribPointer(prog.attributes.aPosition, 3, gl.FLOAT, false, 0, pointFlower.positionArrayOffset * Float32Array.BYTES_PER_ELEMENT);
    gl.vertexAttribPointer(prog.attributes.aEuler, 3, gl.FLOAT, false, 0, pointFlower.eulerArrayOffset * Float32Array.BYTES_PER_ELEMENT);
    gl.vertexAttribPointer(prog.attributes.aMisc, 2, gl.FLOAT, false, 0, pointFlower.miscArrayOffset * Float32Array.BYTES_PER_ELEMENT);

    // draw the same field shifted, so petals wrap seamlessly at the edges
    for (var k = 1; k < 2; k++) {
        var zpos = k * -2.0;
        pointFlower.offset[0] = pointFlower.area.x * -1.0;
        pointFlower.offset[1] = pointFlower.area.y * -1.0;
        pointFlower.offset[2] = pointFlower.area.z * zpos;
        gl.uniform3fv(prog.uniforms.uOffset, pointFlower.offset);
        gl.drawArrays(gl.POINTS, 0, pointFlower.numFlowers);

        pointFlower.offset[0] = pointFlower.area.x * -1.0;
        pointFlower.offset[1] = pointFlower.area.y * 1.0;
        pointFlower.offset[2] = pointFlower.area.z * zpos;
        gl.uniform3fv(prog.uniforms.uOffset, pointFlower.offset);
        gl.drawArrays(gl.POINTS, 0, pointFlower.numFlowers);

        pointFlower.offset[0] = pointFlower.area.x * 1.0;
        pointFlower.offset[1] = pointFlower.area.y * -1.0;
        pointFlower.offset[2] = pointFlower.area.z * zpos;
        gl.uniform3fv(prog.uniforms.uOffset, pointFlower.offset);
        gl.drawArrays(gl.POINTS, 0, pointFlower.numFlowers);

        pointFlower.offset[0] = pointFlower.area.x * 1.0;
        pointFlower.offset[1] = pointFlower.area.y * 1.0;
        pointFlower.offset[2] = pointFlower.area.z * zpos;
        gl.uniform3fv(prog.uniforms.uOffset, pointFlower.offset);
        gl.drawArrays(gl.POINTS, 0, pointFlower.numFlowers);
    }

    // main field
    pointFlower.offset[0] = 0.0;
    pointFlower.offset[1] = 0.0;
    pointFlower.offset[2] = 0.0;
    gl.uniform3fv(prog.uniforms.uOffset, pointFlower.offset);
    gl.drawArrays(gl.POINTS, 0, pointFlower.numFlowers);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    unuseShader(prog);

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
}

// ---------- post-processing ----------
function createEffectProgram(vtxsrc, frgsrc, exunifs, exattrs) {
    var ret = {};
    var unifs = ['uResolution', 'uSrc', 'uDelta'];
    if (exunifs) {
        unifs = unifs.concat(exunifs);
    }
    var attrs = ['aPosition'];
    if (exattrs) {
        attrs = attrs.concat(exattrs);
    }

    ret.program = createShader(vtxsrc, frgsrc, unifs, attrs);
    useShader(ret.program);

    ret.dataArray = new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
         1.0,  1.0
    ]);
    ret.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ret.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, ret.dataArray, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    unuseShader(ret.program);

    return ret;
}

// TEXTURE0 is the source texture
function useEffect(fxobj, srctex) {
    var prog = fxobj.program;
    useShader(prog);
    gl.uniform3fv(prog.uniforms.uResolution, renderSpec.array);

    if (srctex !== null) {
        gl.uniform2fv(prog.uniforms.uDelta, srctex.dtxArray);
        gl.uniform1i(prog.uniforms.uSrc, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, srctex.texture);
    }
}
function drawEffect(fxobj) {
    gl.bindBuffer(gl.ARRAY_BUFFER, fxobj.buffer);
    gl.vertexAttribPointer(fxobj.program.attributes.aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
function unuseEffect(fxobj) {
    unuseShader(fxobj.program);
}

var effectLib = {};
function createEffectLib() {
    var vtxsrc, frgsrc;
    // common
    var cmnvtxsrc = document.getElementById('fx_common_vsh').textContent;

    // background
    frgsrc = document.getElementById('bg_fsh').textContent;
    effectLib.sceneBg = createEffectProgram(cmnvtxsrc, frgsrc, ['uTimes'], null);

    // make bright-pixels buffer
    frgsrc = document.getElementById('fx_brightbuf_fsh').textContent;
    effectLib.mkBrightBuf = createEffectProgram(cmnvtxsrc, frgsrc, null, null);

    // direction blur
    frgsrc = document.getElementById('fx_dirblur_r4_fsh').textContent;
    effectLib.dirBlur = createEffectProgram(cmnvtxsrc, frgsrc, ['uBlurDir'], null);

    // final composite
    vtxsrc = document.getElementById('pp_final_vsh').textContent;
    frgsrc = document.getElementById('pp_final_fsh').textContent;
    effectLib.finalComp = createEffectProgram(vtxsrc, frgsrc, ['uBloom'], null);
}

// ---------- background ----------
function renderBackground() {
    gl.disable(gl.DEPTH_TEST);

    useEffect(effectLib.sceneBg, null);
    gl.uniform2f(effectLib.sceneBg.program.uniforms.uTimes, timeInfo.elapsed, timeInfo.delta);
    drawEffect(effectLib.sceneBg);
    unuseEffect(effectLib.sceneBg);

    gl.enable(gl.DEPTH_TEST);
}

// ---------- post process ----------
function renderPostProcess() {
    gl.disable(gl.DEPTH_TEST);
    var bindRT = function (rt, isclear) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, rt.frameBuffer);
        gl.viewport(0, 0, rt.width, rt.height);
        if (isclear) {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }
    };

    // make bright buffer
    bindRT(renderSpec.wHalfRT0, true);
    useEffect(effectLib.mkBrightBuf, renderSpec.mainRT);
    drawEffect(effectLib.mkBrightBuf);
    unuseEffect(effectLib.mkBrightBuf);

    // make bloom
    for (var i = 0; i < 2; i++) {
        var p = 1.5 + 1 * i;
        var s = 2.0 + 1 * i;
        bindRT(renderSpec.wHalfRT1, true);
        useEffect(effectLib.dirBlur, renderSpec.wHalfRT0);
        gl.uniform4f(effectLib.dirBlur.program.uniforms.uBlurDir, p, 0.0, s, 0.0);
        drawEffect(effectLib.dirBlur);
        unuseEffect(effectLib.dirBlur);

        bindRT(renderSpec.wHalfRT0, true);
        useEffect(effectLib.dirBlur, renderSpec.wHalfRT1);
        gl.uniform4f(effectLib.dirBlur.program.uniforms.uBlurDir, 0.0, p, 0.0, s);
        drawEffect(effectLib.dirBlur);
        unuseEffect(effectLib.dirBlur);
    }

    // display
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, renderSpec.width, renderSpec.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    useEffect(effectLib.finalComp, renderSpec.mainRT);
    gl.uniform1i(effectLib.finalComp.program.uniforms.uBloom, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, renderSpec.wHalfRT0.texture);
    drawEffect(effectLib.finalComp);
    unuseEffect(effectLib.finalComp);

    gl.enable(gl.DEPTH_TEST);
}

// ---------- scene ----------
function createScene() {
    createEffectLib();
    createPointFlowers();
    sceneStandBy = true;
}

function initScene() {
    initPointFlowers();

    camera.position.z = pointFlower.area.z + projection.nearfar[0];
    projection.angle = Math.atan2(pointFlower.area.y, camera.position.z + pointFlower.area.z) * 180.0 / Math.PI * 2.0;
    Matrix44.loadProjection(projection.matrix, renderSpec.aspect, projection.angle, projection.nearfar[0], projection.nearfar[1]);
}

function renderScene() {
    Matrix44.loadLookAt(camera.matrix, camera.position, camera.lookat, camera.up);

    gl.enable(gl.DEPTH_TEST);

    gl.bindFramebuffer(gl.FRAMEBUFFER, renderSpec.mainRT.frameBuffer);
    gl.viewport(0, 0, renderSpec.mainRT.width, renderSpec.mainRT.height);
    gl.clearColor(0.005, 0, 0.05, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    renderBackground();
    renderPointFlowers();
    renderPostProcess();
}

function render() {
    renderScene();
}

// ---------- sizing ----------
// Cap the device-pixel-ratio at 2: retina screens otherwise pay 4x the
// fill cost for very little visible gain.
function resizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
}

function setViewports() {
    resizeCanvas();
    renderSpec.setSize(canvas.width, canvas.height);

    gl.viewport(0, 0, renderSpec.width, renderSpec.height);

    var rtfunc = function (rtname, rtw, rth) {
        var rt = renderSpec[rtname];
        if (rt) {
            deleteRenderTarget(rt);
        }
        renderSpec[rtname] = createRenderTarget(rtw, rth);
    };
    rtfunc('mainRT', renderSpec.width, renderSpec.height);
    rtfunc('wHalfRT0', renderSpec.halfWidth, renderSpec.halfHeight);
    rtfunc('wHalfRT1', renderSpec.halfWidth, renderSpec.halfHeight);
}

var resizeTimer = null;
function onResize() {
    // Debounce: dragging a window edge fires this dozens of times per second.
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
        setViewports();
        if (sceneStandBy) {
            initScene();
        }
        if (reduceMotion) {
            renderOnce();
        }
    }, 150);
}

// ---------- animation ----------
var animating = false;
var reduceMotion = false;
if (window.matchMedia) {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function animate() {
    if (!animating) {
        return;
    }

    var curdate = new Date();
    timeInfo.elapsed = (curdate - timeInfo.start) / 1000.0;
    timeInfo.delta = (curdate - timeInfo.prev) / 1000.0;
    // Ignore huge deltas after a tab switch or sleep so petals don't jump.
    if (timeInfo.delta > 0.1) {
        timeInfo.delta = 0.1;
    }
    timeInfo.prev = curdate;

    render();
    requestAnimationFrame(animate);
}

// Reduced-motion users get a single static frame instead of a loop.
function renderOnce() {
    var curdate = new Date();
    timeInfo.elapsed = (curdate - timeInfo.start) / 1000.0;
    timeInfo.delta = 1.0 / 60.0;
    timeInfo.prev = curdate;
    render();
}

function startAnimation() {
    if (reduceMotion) {
        renderOnce();
        return;
    }
    if (animating) {
        return;
    }
    animating = true;
    requestAnimationFrame(animate);
}

// ---------- boot ----------
function getWebGLContext(cv) {
    var options = {
        alpha: false,
        antialias: false,
        depth: true,
        stencil: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false
    };
    var names = ['webgl', 'experimental-webgl'];
    for (var i = 0; i < names.length; i++) {
        try {
            var ctx = cv.getContext(names[i], options);
            if (ctx) {
                return ctx;
            }
        } catch (e) {
            // try the next name
        }
    }
    return null;
}

function showUnsupported(message) {
    var hint = document.getElementById('hint');
    if (hint) {
        hint.textContent = message;
        hint.classList.add('is-static');
    }
}

function init() {
    canvas = document.getElementById('sakura');
    gl = getWebGLContext(canvas);
    if (!gl) {
        showUnsupported('WebGL is not available in this browser, so the animated background cannot run.');
        return;
    }

    canvas.addEventListener('webglcontextlost', function (event) {
        event.preventDefault();
        animating = false;
    }, false);
    canvas.addEventListener('webglcontextrestored', function () {
        setViewports();
        createScene();
        initScene();
        startAnimation();
    }, false);

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    setViewports();
    createScene();
    initScene();

    timeInfo.start = new Date();
    timeInfo.prev = timeInfo.start;
    startAnimation();
}

window.addEventListener('load', init);

// requestAnimationFrame fallback for very old browsers
(function (w, r) {
    w['r' + r] = w['r' + r] || w['webkitR' + r] || w['mozR' + r] || w['msR' + r] || w['oR' + r] || function (c) { w.setTimeout(c, 1000 / 60); };
})(window, 'equestAnimationFrame');
