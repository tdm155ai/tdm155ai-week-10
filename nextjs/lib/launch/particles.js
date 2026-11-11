// THE FILE TO CHANGE: the particle vortex on /launch/particles. Same shape as lib/launch/shader.js, plus one thing:
// `feedback: true` gives the shader its own last frame as a picture (u_prev). Draw the old frame slightly faded and
// slightly turned around the attractor, add the particles on top, and you get trails that swirl like smoke.
//
// The particles aren't stored anywhere: each pixel works out where all of them are right now (from the time and
// the particle's number) and how close it is to each. Close = bright.
//
// `hand`: your palm moves the attractor (the center of the vortex), a pinch throws the particles outward (a burst).
// Without a camera: the pointer moves the attractor, a click is a burst.

export const title = "Particle vortex";
export const feedback = true;
export const maxDpr = 1; // every pixel visits every particle, so keep the pixel count down

export const controls = [
  { name: "speed", label: "Speed", min: 0, max: 2, value: 1, param: "speed" },
  { name: "count", label: "Particles", min: 5, max: 90, value: 60 },
  { name: "size", label: "Size", min: 0.2, max: 3, value: 1 },
  { name: "trail", label: "Trail", min: 0.8, max: 0.99, value: 0.95, param: "resonance" },
  { name: "swirl", label: "Swirl", min: 0, max: 3, value: 1.2, param: "filter" },
  { name: "hue", label: "Color", min: 0, max: 1, value: 0.1, param: "hue" },
];

export const hand = { point: true, pinch: "burst" };

export const fragment = `precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;      // the attractor: the pointer or your palm, 0–1
uniform float u_burst;     // jumps to 1 on a click or pinch, then fades back to 0
uniform sampler2D u_prev;  // the last frame (feedback)
uniform float u_count, u_size, u_trail, u_swirl, u_hue;

vec3 palette(float t) { return 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67) + u_hue)); }
float rand(float n) { return fract(sin(n * 12.9898) * 43758.5453); }

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;   // this pixel, (0, 0) in the middle
  vec2 m = (u_mouse - 0.5) * vec2(aspect, 1.0);                        // the attractor, same units
  float t = u_time;

  // 1. The trails: read the last frame from a spot turned a little around the attractor (closer = more turn).
  vec2 d = p - m;
  float turn = u_swirl * 0.03 / (length(d) + 0.15);
  d = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * d * (1.0 - 0.004 * u_swirl);
  vec2 back = (m + d) / vec2(aspect, 1.0) + 0.5;
  vec3 trail = texture2D(u_prev, back).rgb * u_trail - 0.004;          // fade (the - 0.004 lets it reach black)
  vec3 glow = vec3(0.0);

  // 2. The particles: each one circles the attractor at its own radius and speed; a burst flings them outward.
  for (int i = 0; i < 90; i++) {
    float fi = float(i);
    if (fi >= u_count) break;
    float radius = 0.08 + 0.45 * rand(fi) + u_burst * 0.9 * rand(fi + 7.0);
    float spin = (0.3 + rand(fi + 3.0)) * (mod(fi, 2.0) * 2.0 - 1.0);
    float angle = t * spin + fi * 2.399;
    vec2 pos = m + radius * vec2(cos(angle), sin(angle)) * (1.0 + 0.15 * sin(t * 0.7 + fi));
    float dist = length(p - pos);
    glow += palette(fi / u_count * 0.5 + t * 0.03) * (u_size * 0.00012) / (dist * dist + 0.0001);
  }

  // 3. This frame's glow, softly limited, over the fading trails (the brighter of the two, so trails never pile up).
  vec3 color = max(trail, 1.0 - exp(-glow));
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;
