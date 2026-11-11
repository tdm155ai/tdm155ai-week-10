// Drawing what the model sees on a canvas laid over the video. Points arrive normalized (0–1 of the frame).
// `mirror` flips x so the drawing matches the mirrored (selfie) video.

export const HAND_CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
export const POSE_CONNECTIONS = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [0, 11], [0, 12]];

// Flip a list of points to match a mirrored video.
export function view(points, mirror) {
  return mirror ? points.map((p) => ({ ...p, x: 1 - p.x })) : points;
}

export function clear(canvas, video) {
  if (!canvas) return null;
  const w = video?.videoWidth || canvas.width;
  const h = video?.videoHeight || canvas.height;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

export function skeleton(ctx, points, connections, { color = "#ff6b57", dot = "#ecece6", width = 4, radius = 5 } = {}) {
  const { width: W, height: H } = ctx.canvas;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  for (const [a, b] of connections) {
    if (!points[a] || !points[b]) continue;
    ctx.beginPath();
    ctx.moveTo(points[a].x * W, points[a].y * H);
    ctx.lineTo(points[b].x * W, points[b].y * H);
    ctx.stroke();
  }
  ctx.fillStyle = dot;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x * W, p.y * H, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function dots(ctx, points, { color = "#ecece6", radius = 1.6, every = 1 } = {}) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = color;
  for (let i = 0; i < points.length; i += every) {
    ctx.beginPath();
    ctx.arc(points[i].x * W, points[i].y * H, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// A rectangle in normalized coordinates, with a label. `hot` fills it.
export function zone(ctx, { x, y, w, h, name }, hot) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = hot ? "rgba(255,107,87,.45)" : "rgba(255,255,255,.06)";
  ctx.fillRect(x * W, y * H, w * W, h * H);
  ctx.strokeStyle = hot ? "#ff6b57" : "rgba(236,236,230,.55)";
  ctx.lineWidth = 3;
  ctx.setLineDash(hot ? [] : [12, 10]);
  ctx.strokeRect(x * W, y * H, w * W, h * H);
  ctx.setLineDash([]);
  label(ctx, name, x * W + 12, y * H + 34);
}

export function label(ctx, text, x, y, { size = 26, color = "#ecece6" } = {}) {
  ctx.font = `700 ${size}px Inter, system-ui, sans-serif`;
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,.6)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
