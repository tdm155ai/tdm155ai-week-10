// THE FILE TO CHANGE: the kaleidoscope on /launch/kaleidoscope. Same shape as lib/launch/shader.js:
// `controls` are the sliders (each one a u_ uniform in the shader), `fragment` is the GLSL that colors every pixel.
//
// How a kaleidoscope works in a shader: turn the pixel's position into an angle and a distance from the middle,
// fold the angle into one slice (and mirror it), so every slice shows the same thing. Then draw something busy
// in that slice: here, a fractal that bends space over and over (the "Kali set").
//
// `hand` says what your hand does when "Use my hand" is on: across = Symmetry, up = Scale, pinch = freeze time.
// Without a camera, hold the mouse button down to freeze.

export const title = "Kaleidoscope";
export const maxDpr = 1.5; // render no sharper than this, to keep the graphics card cool

export const controls = [
  { name: "speed", label: "Speed", min: 0, max: 2, value: 0.6, param: "speed" },
  { name: "symmetry", label: "Symmetry (slices)", min: 3, max: 16, value: 8 },
  { name: "scale", label: "Scale", min: 0.3, max: 3, value: 1.2 },
  { name: "twist", label: "Twist", min: 0, max: 4, value: 1.2, param: "filter" },
  { name: "hue", label: "Color", min: 0, max: 1, value: 0.55, param: "hue" },
  { name: "glow", label: "Glow", min: 0.2, max: 3, value: 1.2, param: "brightness" },
];

export const hand = { x: "symmetry", y: "scale", pinch: "freeze" };

export const fragment = `precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;   // the pointer, 0–1: moves the center of the kaleidoscope a little
uniform float u_symmetry, u_scale, u_twist, u_hue, u_glow;

vec3 palette(float t) { return 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67) + u_hue)); }

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
  uv -= (u_mouse - 0.5) * 0.25;                        // the pointer nudges the center
  float t = u_time;

  // 1. Polar coordinates: how far from the middle (r), and which direction (a).
  float r = length(uv);
  float a = atan(uv.y, uv.x) + t * 0.1;

  // 2. Fold every direction into one slice, and mirror it: that's the kaleidoscope.
  float slice = 6.28318 / floor(u_symmetry);
  a = mod(a, slice);
  a = abs(a - slice * 0.5);
  a += u_twist * r;                                     // twist the slices into a spiral

  // 3. Back to x, y inside the slice, then a fractal: fold and invert space again and again.
  vec2 z = vec2(cos(a), sin(a)) * r * u_scale;
  vec3 color = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    z = abs(z) / dot(z, z) - vec2(0.82 + 0.08 * sin(t * 0.21), 0.6 + 0.07 * cos(t * 0.17));
    float d = length(z);
    color += palette(d * 0.25 + float(i) * 0.07 + t * 0.04) * exp(-d * 3.0);
  }

  color = 1.0 - exp(-color * u_glow);                  // soft limit, so bright parts don't clip
  color = pow(color, vec3(1.7));                        // more contrast: darks darker, colors deeper
  color *= smoothstep(1.4, 0.15, r);                    // darker toward the edges
  gl_FragColor = vec4(color, 1.0);
}
`;
