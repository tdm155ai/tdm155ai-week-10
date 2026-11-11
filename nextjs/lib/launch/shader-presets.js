// More looks for /launch/shader, picked from the "Look" menu. Each is a whole fragment shader that reads the same
// sliders as lib/launch/shader.js (u_speed is applied to u_time; u_scale, u_warp, u_hue, u_rings, u_brightness), the
// pointer (u_mouse) and the mic (u_level), so every control does something in every look. Only one runs at a time.
// To make your own: copy one, change it, and add it to the list at the bottom.

import { fragment as smoke } from "./shader.js";

const HEADER = `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_level, u_scale, u_warp, u_hue, u_rings, u_brightness;
vec3 palette(float t) { return 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67) + u_hue)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
`;

const plasma = HEADER + `
// Plasma: four sine waves added together; where they line up, bright bands. The pointer is the center of one wave.
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y * u_scale;
  vec2 m = (u_mouse - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0) * u_scale;
  float t = u_time;
  float v = sin(uv.x * 1.7 + t) + sin(uv.y * 1.3 - t * 1.1) + sin((uv.x + uv.y) * 1.1 + t * 0.7)
          + sin(length(uv - m) * 3.0 * (1.0 + u_warp) - t * 1.6);
  v += u_level * 3.0 * sin(length(uv) * 8.0 - t * 6.0);            // loud sound: ripples from the middle
  vec3 color = palette(v * 0.25 + t * 0.05);
  color *= 0.7 + 0.3 * sin(v * 3.14159 * (1.0 + u_rings * 3.0));  // Rings: finer contour lines
  gl_FragColor = vec4(color * u_brightness, 1.0);
}
`;

const aurora = HEADER + `
// Aurora: a night sky with twinkling stars and four glowing curtains, each a wavy line that glows upward.
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
  float t = u_time * 0.35;
  vec3 color = mix(vec3(0.005, 0.01, 0.04), vec3(0.02, 0.04, 0.10), uv.y);
  vec2 cell = floor(gl_FragCoord.xy * 0.5);
  color += step(0.997, hash(cell)) * (0.5 + 0.5 * sin(u_time * 3.0 + hash(cell + 7.0) * 40.0)) * 0.8;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float x = p.x * u_scale * 0.6 + fi * 0.7;
    float base = -0.1 + 0.22 * noise(vec2(x * 1.5 + t * (0.4 + fi * 0.1), fi * 3.0)) + fi * 0.07
               + u_warp * 0.08 * sin(x * 3.0 + t * 2.0) + (u_mouse.y - 0.5) * 0.3;
    float d = p.y - base;                                            // height above this curtain's lower edge
    float glow = exp(-max(d, 0.0) * (4.0 - u_rings * 2.5)) * smoothstep(-0.03, 0.0, d);
    glow *= 0.55 + 0.45 * noise(vec2(x * 9.0, t * 3.0));             // the rays
    vec3 tint = 0.5 + 0.5 * cos(6.2831 * (vec3(0.30, 0.45, 0.62) + fi * 0.07 + u_hue + d * 0.7));
    color += tint * glow * (0.9 + u_level * 1.5);
  }
  gl_FragColor = vec4(color * u_brightness, 1.0);
}
`;

const tunnel = HEADER + `
// Tunnel: turn each pixel's distance from the middle into depth (far = small), and its angle into a place on the wall.
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
  p -= (u_mouse - 0.5) * 0.3;                                       // the pointer steers
  float t = u_time;
  float r = length(p), a = atan(p.y, p.x);
  float z = 0.5 * u_scale / (r + 0.001) + t * 1.5;                   // depth: flying forward
  float around = a / 3.14159 + t * 0.1 + u_warp * 0.3 * sin(z * 0.5);
  float tiles = sin(z * 6.2831) * sin(around * 3.14159 * 6.0 * (1.0 + u_rings));
  vec3 color = palette(z * 0.05 + around * 0.5) * (0.55 + 0.45 * smoothstep(0.0, 0.12, abs(tiles)));
  color *= smoothstep(0.0, 0.35, r);                                // dark far away
  color += u_level * palette(z * 0.1) * 0.8 * smoothstep(0.2, 0.0, abs(fract(z) - 0.5));
  gl_FragColor = vec4(color * u_brightness, 1.0);
}
`;

const liquid = HEADER + `
// Liquid: eight blobs drifting about, plus one under the pointer; where their pull adds up past 1, it's liquid
// ("metaballs", the lava lamp). Warp makes the blobs bigger, Rings brightens the edge.
void main() {
  float k = u_scale * 0.5;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y * k;
  float t = u_time * 0.5;
  float f = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    vec2 c = vec2(sin(t * (0.6 + fi * 0.13) + fi * 1.7), cos(t * (0.5 + fi * 0.11) + fi * 2.3)) * (0.5 + 0.3 * sin(fi)) * k;
    f += 0.012 * k * k * (1.0 + u_warp + u_level * 2.0) / (dot(p - c, p - c) + 0.002 * k * k);
  }
  vec2 m = (u_mouse - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0) * k;
  f += 0.02 * k * k / (dot(p - m, p - m) + 0.002 * k * k);
  float inside = smoothstep(0.9, 1.0, f);
  vec3 color = mix(vec3(0.02, 0.02, 0.03), palette(min(f, 3.0) * 0.12 + t * 0.1) * (0.6 + 0.4 * min(f - 1.0, 1.0)), inside);
  color += (1.0 - smoothstep(0.0, 0.08, abs(f - 1.0))) * (0.4 + u_rings);   // the bright rim
  gl_FragColor = vec4(color * u_brightness, 1.0);
}
`;

export const presets = [
  { id: "smoke", title: "Smoke (lib/launch/shader.js)", fragment: smoke },
  { id: "plasma", title: "Plasma", fragment: plasma },
  { id: "aurora", title: "Aurora", fragment: aurora },
  { id: "tunnel", title: "Tunnel", fragment: tunnel },
  { id: "liquid", title: "Liquid (metaballs)", fragment: liquid },
];
