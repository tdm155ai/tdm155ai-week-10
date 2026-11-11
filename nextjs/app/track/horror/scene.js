"use client";

// The picture for /track/horror, drawn with Three.js on one canvas (the canvas that gets recorded):
//   1. the backdrop: the ghost (React Bits' GhostCursor, copied in each frame), and you, cut out of the room by
//      MediaPipe's selfie segmenter, in cold, washed-out color;
//   2. the mask: the painted flat face (./paint.js) stretched over MediaPipe's 468 face points, shaded by your
//      real face so it looks lit by the room;
//   3. the voids: black holes over the eyes and the open mouth, and glowing pupils that follow your irises;
//   4. the film: grain, vignette, a failing light (flicker), and glitches (on a key, or when you scream).
// Everything is mirrored like a selfie camera, in the picture itself, so the recording is mirrored too.

import * as THREE from "three";
import { FACE_MESH_TRIANGLES, FACE_MESH_UVS, FACE_MESH_VERTEX_COUNT } from "../../../lib/cv/face-mesh-data.js";
import { LEFT_EYE, LIPS_INNER, RIGHT_EYE } from "./paint.js";

export const WIDTH = 1280;
export const HEIGHT = 720;
const RIGHT_IRIS = 468, LEFT_IRIS = 473;

const quadVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Where a point on the screen (0–1, y up) is in the camera picture: mirrored, and cropped to fill 16:9.
const videoUvGlsl = /* glsl */ `
  uniform vec2 uCover;
  vec2 videoUv(vec2 s) { return vec2(0.5 + ((1.0 - s.x) - 0.5) * uCover.x, 0.5 + (s.y - 0.5) * uCover.y); }
`;

const backdropFragment = /* glsl */ `
  uniform sampler2D uVideo;
  uniform sampler2D uMask;
  uniform sampler2D uGhost;
  uniform float uHasMask, uCutout, uRoom, uYou, uDesat, uContrast, uGhostOnYou, uFlare;
  uniform vec3 uTint;
  varying vec2 vUv;
  ${videoUvGlsl}
  void main() {
    vec2 vu = videoUv(vUv);
    vec3 cam = texture2D(uVideo, vu).rgb;
    float luma = dot(cam, vec3(0.299, 0.587, 0.114));
    vec3 graded = mix(cam, vec3(luma), uDesat);
    graded = clamp((graded - 0.5) * uContrast + 0.5, 0.0, 1.0) * uTint;
    float m = 1.0;
    if (uCutout > 0.5 && uHasMask > 0.5) m = smoothstep(0.25, 0.75, texture2D(uMask, vec2(vu.x, 1.0 - vu.y)).r);
    vec3 ghost = texture2D(uGhost, vUv).rgb * (1.0 + uFlare * 2.5);
    float onYou = uCutout > 0.5 ? uGhostOnYou : max(uGhostOnYou, 0.8);
    vec3 behind = graded * uRoom + ghost;
    vec3 you = graded * uYou + ghost * onYou;
    gl_FragColor = vec4(mix(behind, you, m), 1.0);
  }
`;

const faceVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const faceFragment = /* glsl */ `
  uniform sampler2D uPaint;
  uniform sampler2D uVideo;
  uniform vec2 uRes;
  uniform float uShade, uOpacity;
  varying vec2 vUv;
  ${videoUvGlsl}
  void main() {
    vec4 paint = texture2D(uPaint, vUv);
    float luma = dot(texture2D(uVideo, videoUv(gl_FragCoord.xy / uRes)).rgb, vec3(0.299, 0.587, 0.114));
    vec3 lit = paint.rgb * mix(1.0, 0.2 + luma * 1.5, uShade);
    gl_FragColor = vec4(lit, paint.a * uOpacity);
  }
`;

const voidVertex = /* glsl */ `
  attribute float rim;
  varying float vRim;
  void main() { vRim = rim; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const voidFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vRim;
  void main() { gl_FragColor = vec4(uColor, 1.0 - smoothstep(0.6, 1.0, vRim)); }
`;

const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPulse;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = exp(-d * d * 5.0) * 0.8 + exp(-d * d * 60.0);
    gl_FragColor = vec4(uColor * a * uPulse, a);
  }
`;

const spriteVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const filmFragment = /* glsl */ `
  uniform sampler2D uScene;
  uniform float uTime, uGrain, uVignette, uLight, uGlitch;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 uv = vUv;
    // Glitch: rows of the picture slide sideways, and the colors split.
    float row = floor(uv.y * 48.0);
    float tear = step(0.55, hash(vec2(row, floor(uTime * 24.0)))) * (hash(vec2(row + 3.0, floor(uTime * 30.0))) - 0.5);
    uv.x += tear * uGlitch * 0.12;
    vec2 fromCenter = uv - 0.5;
    float split = 0.0015 + length(fromCenter) * 0.004 + uGlitch * 0.02;
    vec3 col = vec3(texture2D(uScene, uv + vec2(split, 0.0)).r, texture2D(uScene, uv).g, texture2D(uScene, uv - vec2(split, 0.0)).b);
    col *= uLight;
    float vig = smoothstep(0.95, 0.2, length(fromCenter * vec2(1.0, 0.85)));
    col *= mix(1.0, vig, uVignette);
    col += (hash(uv * vec2(1280.0, 720.0) + fract(uTime * 7.13) * 100.0) - 0.5) * uGrain;
    col *= 0.94 + 0.06 * sin(uv.y * 720.0 * 1.4);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

function hexToVec3(hex) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

// A soft fan of triangles over a contour (an eye, the inside of the lips): one vertex in the middle, one per point.
function makeVoid(count, color) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((count + 1) * 3);
  const rim = new Float32Array(count + 1).fill(1);
  rim[0] = 0;
  const index = [];
  for (let i = 1; i <= count; i++) index.push(0, i, i === count ? 1 : i + 1);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("rim", new THREE.BufferAttribute(rim, 1));
  geometry.setIndex(index);
  const material = new THREE.ShaderMaterial({ uniforms: { uColor: { value: hexToVec3(color) } }, vertexShader: voidVertex, fragmentShader: voidFragment, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.visible = false;
  return { mesh, positions, geometry };
}

export function createScene(canvas, paintCanvas, ghostCanvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // our shaders work in the camera's own colors

  const target = new THREE.WebGLRenderTarget(WIDTH, HEIGHT);
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
  const scene = new THREE.Scene();

  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = WIDTH;
  frameCanvas.height = HEIGHT;
  const frameCtx = frameCanvas.getContext("2d", { willReadFrequently: false });
  // Smaller copies of the same frame for the trackers: their models look at small pictures anyway, and a small
  // picture is much quicker to hand to them. Their points are 0–1, so they line up with the full frame.
  const trackCanvas = document.createElement("canvas");
  const trackCtx = trackCanvas.getContext("2d");
  const segmentCanvas = document.createElement("canvas");
  const segmentCtx = segmentCanvas.getContext("2d");
  const videoTex = new THREE.CanvasTexture(frameCanvas);
  const ghostTex = new THREE.CanvasTexture(ghostCanvas);
  const paintTex = new THREE.CanvasTexture(paintCanvas);
  let maskTex = null;
  let maskData = null;
  const cover = new THREE.Vector2(1, 1);

  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: {
      uVideo: { value: videoTex }, uMask: { value: null }, uGhost: { value: ghostTex }, uCover: { value: cover },
      uHasMask: { value: 0 }, uCutout: { value: 1 }, uRoom: { value: 0 }, uYou: { value: 1 }, uDesat: { value: 0.8 },
      uContrast: { value: 1.3 }, uGhostOnYou: { value: 0.2 }, uFlare: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) },
    },
    vertexShader: quadVertex, fragmentShader: backdropFragment, depthTest: false, depthWrite: false,
  }));
  backdrop.frustumCulled = false;
  backdrop.renderOrder = 0;
  scene.add(backdrop);

  // The face: a fixed triangle mesh whose 468 corners move to the 468 points MediaPipe finds.
  const facePositions = new Float32Array(FACE_MESH_VERTEX_COUNT * 3);
  const faceGeometry = new THREE.BufferGeometry();
  faceGeometry.setAttribute("position", new THREE.BufferAttribute(facePositions, 3));
  faceGeometry.setAttribute("uv", new THREE.BufferAttribute(FACE_MESH_UVS, 2));
  faceGeometry.setIndex(new THREE.BufferAttribute(FACE_MESH_TRIANGLES, 1));
  const face = new THREE.Mesh(faceGeometry, new THREE.ShaderMaterial({
    uniforms: { uPaint: { value: paintTex }, uVideo: { value: videoTex }, uCover: { value: cover }, uRes: { value: new THREE.Vector2(WIDTH, HEIGHT) }, uShade: { value: 0.6 }, uOpacity: { value: 1 } },
    vertexShader: faceVertex, fragmentShader: faceFragment, transparent: true, side: THREE.DoubleSide,
  }));
  face.frustumCulled = false;
  face.renderOrder = 1;
  face.visible = false;
  scene.add(face);

  const voids = {
    right: { ...makeVoid(RIGHT_EYE.length, "#000000"), ids: RIGHT_EYE, grow: 1.45 },
    left: { ...makeVoid(LEFT_EYE.length, "#000000"), ids: LEFT_EYE, grow: 1.45 },
    mouth: { ...makeVoid(LIPS_INNER.length, "#000000"), ids: LIPS_INNER, grow: 1.12 },
  };
  Object.values(voids).forEach((v) => scene.add(v.mesh));

  const glowMaterial = new THREE.ShaderMaterial({ uniforms: { uColor: { value: hexToVec3("#ff2a1a") }, uPulse: { value: 1 } }, vertexShader: spriteVertex, fragmentShader: glowFragment, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
  const glows = [RIGHT_IRIS, LEFT_IRIS].map((id) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMaterial);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, id };
  });

  // The film pass: the scene above, drawn through grain, vignette, flicker, and glitch.
  const filmScene = new THREE.Scene();
  const film = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { uScene: { value: target.texture }, uTime: { value: 0 }, uGrain: { value: 0.08 }, uVignette: { value: 0.9 }, uLight: { value: 1 }, uGlitch: { value: 0 } },
    vertexShader: quadVertex, fragmentShader: filmFragment, depthTest: false, depthWrite: false,
  }));
  film.frustumCulled = false;
  filmScene.add(film);

  let eyesMode = "void";
  let mouthMode = "void";
  let videoAspect = 16 / 9;
  // The failing light and the glitches: short events that start at random (more often with higher settings).
  const events = { lightUntil: 0, lightLevel: 1, glitchUntil: 0, blackoutUntil: 0, flareUntil: 0 };

  // A face point (MediaPipe: 0–1 across the camera picture, y down) to a point on the screen (0–1, y up), mirrored.
  function toScreen(p) {
    return [1 - (0.5 + (p.x - 0.5) / cover.x), 1 - (0.5 + (p.y - 0.5) / cover.y)];
  }

  return {
    frameCanvas,
    trackCanvas,
    segmentCanvas,

    // A tracked point (hand, face) to where it is on the screen: { x, y }, 0–1, y down (what GhostCursor follows).
    screenPoint(p) {
      const [x, y] = toScreen(p);
      return { x, y: 1 - y };
    },

    // Copy the newest camera frame (tracking and picture use this same copy, so the mask never lags the face).
    takeFrame(video) {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return false;
      if (frameCanvas.width !== vw || frameCanvas.height !== vh) {
        frameCanvas.width = vw;
        frameCanvas.height = vh;
        trackCanvas.width = 640;
        trackCanvas.height = Math.round((640 * vh) / vw);
        segmentCanvas.width = 256;
        segmentCanvas.height = Math.round((256 * vh) / vw);
        videoTex.dispose();
      }
      videoAspect = vw / vh;
      const screenAspect = WIDTH / HEIGHT;
      if (videoAspect > screenAspect) cover.set(screenAspect / videoAspect, 1);
      else cover.set(1, videoAspect / screenAspect);
      frameCtx.drawImage(video, 0, 0, vw, vh);
      trackCtx.drawImage(frameCanvas, 0, 0, trackCanvas.width, trackCanvas.height);
      segmentCtx.drawImage(frameCanvas, 0, 0, segmentCanvas.width, segmentCanvas.height);
      videoTex.needsUpdate = true;
      return true;
    },

    // The person mask from the segmenter: one 0–1 value per point, `width` × `height`, top row first.
    setPersonMask(values, width, height, smoothing = 0.5) {
      if (!maskTex || maskTex.image.width !== width || maskTex.image.height !== height) {
        maskTex?.dispose();
        maskData = new Uint8Array(width * height);
        maskTex = new THREE.DataTexture(maskData, width, height, THREE.RedFormat, THREE.UnsignedByteType);
        maskTex.magFilter = maskTex.minFilter = THREE.LinearFilter;
        maskTex.unpackAlignment = 1;
        backdrop.material.uniforms.uMask.value = maskTex;
      }
      for (let i = 0; i < values.length; i++) maskData[i] = maskData[i] * smoothing + values[i] * 255 * (1 - smoothing);
      maskTex.needsUpdate = true;
      backdrop.material.uniforms.uHasMask.value = 1;
    },

    // 478 face points, or null when there's no face.
    setFace(points) {
      const found = Boolean(points);
      face.visible = found;
      if (found) {
        for (let i = 0; i < FACE_MESH_VERTEX_COUNT; i++) {
          const [x, y] = toScreen(points[i]);
          facePositions[i * 3] = x;
          facePositions[i * 3 + 1] = y;
          facePositions[i * 3 + 2] = -points[i].z;
        }
        faceGeometry.attributes.position.needsUpdate = true;
      }
      for (const [name, v] of Object.entries(voids)) {
        const on = found && (name === "mouth" ? mouthMode === "void" : eyesMode !== "mine");
        v.mesh.visible = on;
        if (!on) continue;
        const pts = v.ids.map((id) => toScreen(points[id]));
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        v.positions[0] = cx; v.positions[1] = cy; v.positions[2] = 1;
        pts.forEach(([x, y], k) => {
          v.positions[(k + 1) * 3] = cx + (x - cx) * v.grow;
          v.positions[(k + 1) * 3 + 1] = cy + (y - cy) * v.grow;
          v.positions[(k + 1) * 3 + 2] = 1;
        });
        v.geometry.attributes.position.needsUpdate = true;
      }
      const glowOn = found && eyesMode === "glow" && points.length > LEFT_IRIS;
      let eyePx = 0; // the width of an eye on the screen, in pixels
      if (glowOn) {
        const a = toScreen(points[33]), b = toScreen(points[133]);
        eyePx = Math.hypot((a[0] - b[0]) * WIDTH, (a[1] - b[1]) * HEIGHT);
      }
      for (const g of glows) {
        g.mesh.visible = glowOn;
        if (!glowOn) continue;
        const [x, y] = toScreen(points[g.id]);
        g.mesh.position.set(x, y, 2);
        g.mesh.scale.set((eyePx * 1.1) / WIDTH, (eyePx * 1.1) / HEIGHT, 1);
      }
    },

    paintChanged() { paintTex.needsUpdate = true; },
    ghostChanged() { ghostTex.needsUpdate = true; },

    setMaskStyle({ eyes = "void", mouth = "void", glow = "#ff2a1a" }) {
      eyesMode = eyes;
      mouthMode = mouth;
      glowMaterial.uniforms.uColor.value.copy(hexToVec3(glow));
    },

    setLook(look) {
      const u = backdrop.material.uniforms;
      u.uCutout.value = look.cutout ? 1 : 0;
      u.uRoom.value = look.room;
      u.uYou.value = look.you;
      u.uDesat.value = look.colorless;
      u.uContrast.value = look.contrast;
      u.uGhostOnYou.value = look.ghostOnYou;
      u.uTint.value.copy(hexToVec3(look.tint));
      face.material.uniforms.uShade.value = look.maskShading;
      film.material.uniforms.uGrain.value = look.grain;
      film.material.uniforms.uVignette.value = look.vignette;
    },

    // Things the operator (or a scream) can set off.
    blackout(ms = 900) { events.blackoutUntil = performance.now() + ms; },
    glitch(ms = 400) { events.glitchUntil = Math.max(events.glitchUntil, performance.now() + ms); },
    flare(ms = 500) { events.flareUntil = Math.max(events.flareUntil, performance.now() + ms); },

    render(timeSeconds, { flicker = 0.5, glitch = 0.25 } = {}) {
      const now = performance.now();
      if (now > events.lightUntil && Math.random() < flicker * 0.012) {
        events.lightUntil = now + 40 + Math.random() * 180;
        events.lightLevel = 0.15 + Math.random() * 0.5;
      }
      if (now > events.glitchUntil && Math.random() < glitch * 0.006) events.glitchUntil = now + 60 + Math.random() * 200;
      let light = now < events.lightUntil ? events.lightLevel : 1;
      if (now < events.blackoutUntil) light = Math.random() < 0.85 ? 0.02 : 0.5; // a dying bulb
      const fu = film.material.uniforms;
      fu.uTime.value = timeSeconds;
      fu.uLight.value = light;
      fu.uGlitch.value = now < events.glitchUntil ? 0.6 + Math.random() * 0.4 : 0;
      backdrop.material.uniforms.uFlare.value = now < events.flareUntil ? (events.flareUntil - now) / 500 : 0;
      glowMaterial.uniforms.uPulse.value = 0.85 + Math.sin(timeSeconds * 9) * 0.1 + Math.random() * 0.1;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(filmScene, camera);
    },

    dispose() {
      [videoTex, ghostTex, paintTex, maskTex].forEach((t) => t?.dispose());
      scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      film.geometry.dispose();
      film.material.dispose();
      target.dispose();
      renderer.dispose();
    },
  };
}
