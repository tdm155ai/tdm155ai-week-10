// THE FILE TO CHANGE: the shader on /launch/shader. Two parts:
//
// 1. `controls`: the sliders. Each one becomes a "uniform" in the shader with the same name (u_speed, u_scale, ...),
//    a number the shader can read for every pixel. `param` (optional) lets a stage control move the slider too:
//    a MIDI knob, the XY pad, or a hand on /track sends setParam(name, 0–1), and 0–1 is stretched to min–max.
//
// 2. `fragment`: the shader itself, in GLSL. The graphics card runs it once for every pixel, 60 times a second, and
//    all it has to do is answer: "what color is this pixel?" (gl_FragColor). It knows where the pixel is
//    (gl_FragCoord), the time (u_time), where the pointer is (u_mouse), how loud the mic is (u_level), and the sliders.
//
// Inputs → parameters → pixels: a slider, a knob, a hand, or the mic changes a number; the number changes the math;
// the math changes every pixel.

export const controls = [
  { name: "speed", label: "Speed", min: 0, max: 2, value: 1, param: "speed" },
  { name: "scale", label: "Scale (zoom)", min: 0.5, max: 8, value: 2.5 },
  { name: "warp", label: "Warp", min: 0, max: 1.5, value: 0.8, param: "filter" },
  { name: "hue", label: "Color", min: 0, max: 1, value: 0, param: "hue" },
  { name: "rings", label: "Rings", min: 0, max: 1, value: 0.35 },
  { name: "brightness", label: "Brightness", min: 0, max: 1.5, value: 1, param: "brightness" },
];

export const fragment = `precision highp float;

uniform vec2 u_resolution; // the size of the picture, in pixels
uniform float u_time;      // seconds (sped up or slowed down by the Speed slider)
uniform vec2 u_mouse;      // the pointer, 0–1 across and up
uniform float u_level;     // how loud the mic is, 0–1 (when Listen is on)
uniform float u_scale, u_warp, u_hue, u_rings, u_brightness; // the sliders

// Smooth random hills ("value noise"), then several sizes of them added together ("fractal noise").
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}

// A rainbow you can rotate: t picks the color, u_hue turns the wheel.
vec3 palette(float t) { return 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67) + u_hue)); }

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y; // (0, 0) in the middle, the height is 1
  vec2 p = uv * u_scale;
  float t = u_time;

  // Bend space with noise, then bend it again with the bent result ("domain warping"): smoke, marble, oil on water.
  vec2 q = vec2(fbm(p + t * 0.15), fbm(p + vec2(5.2, 1.3) - t * 0.12));
  vec2 r = vec2(fbm(p + 4.0 * u_warp * q + vec2(1.7, 9.2) + t * 0.1), fbm(p + 4.0 * u_warp * q + vec2(8.3, 2.8)));
  float f = fbm(p + 4.0 * u_warp * r);

  // Rings spreading out from the pointer; louder sound, brighter rings.
  vec2 m = (u_mouse - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  float rings = 0.5 + 0.5 * sin(length(uv - m) * 18.0 - t * 4.0);

  vec3 color = palette(f * 1.4 + length(q) * 0.6 + t * 0.03) * (0.5 + 0.9 * f);
  color += rings * (u_rings * 0.3 + u_level * 1.5) * palette(f + 0.5);
  gl_FragColor = vec4(color * u_brightness, 1.0);
}
`;
