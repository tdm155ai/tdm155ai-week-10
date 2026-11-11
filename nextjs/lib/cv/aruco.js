// Printed ArUco markers: the rock-solid way to mark a box when drawn lines are flaky under the lights.
// Print the sheet at /draw-a-box/markers, cut out the four markers, and lay them at the corners of the box:
// marker 0 top left, 1 top right, 2 bottom right, 3 bottom left (as the camera sees them).
// Uses the ArUco detector already inside OpenCV.js (lib/cv/opencv.js), so there's nothing extra to download.

export const CORNER_IDS = [0, 1, 2, 3]; // tl, tr, br, bl
export const CORNER_NAMES = ["top left", "top right", "bottom right", "bottom left"];

// Make a detector for the 4×4 dictionary (the biggest squares, easiest to see from far away).
// `mats` holds reusable OpenCV objects; free them with freeMats(mats) from opencv.js.
export function findMarkers(cv, source, mats) {
  mats.arucoDetector ??= new cv.aruco_ArucoDetector(
    cv.getPredefinedDictionary(cv.DICT_4X4_50),
    new cv.aruco_DetectorParameters(),
    new cv.aruco_RefineParameters(10, 3, true),
  );
  mats.markerSrc ??= new cv.Mat();
  mats.markerGray ??= new cv.Mat();
  const src = cv.imread(source);
  cv.cvtColor(src, mats.markerGray, cv.COLOR_RGBA2GRAY);
  src.delete();
  const corners = new cv.MatVector();
  const ids = new cv.Mat();
  const rejected = new cv.MatVector();
  mats.arucoDetector.detectMarkers(mats.markerGray, corners, ids, rejected);
  const found = [];
  for (let i = 0; i < ids.rows; i++) {
    const d = corners.get(i).data32F;
    found.push({ id: ids.data32S[i], corners: [0, 1, 2, 3].map((k) => ({ x: d[k * 2], y: d[k * 2 + 1] })) });
  }
  corners.delete();
  ids.delete();
  rejected.delete();
  return found;
}

const centre = (points) => ({ x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length });

// Turn the markers into a box [tl, tr, br, bl]. Each marker gives the corner that points into the box.
// If one marker is hidden (a hand over it), the fourth corner is guessed from the other three.
export function boxFromMarkers(markers) {
  const byId = new Map(markers.filter((m) => CORNER_IDS.includes(m.id)).map((m) => [m.id, m]));
  if (byId.size < 3) return null;
  const centres = CORNER_IDS.map((id) => (byId.has(id) ? centre(byId.get(id).corners) : null));
  const seen = centres.filter(Boolean);
  const middle = centre(seen);
  const quad = CORNER_IDS.map((id) => {
    const marker = byId.get(id);
    if (!marker) return null;
    return marker.corners.reduce((best, p) => (Math.hypot(p.x - middle.x, p.y - middle.y) < Math.hypot(best.x - middle.x, best.y - middle.y) ? p : best));
  });
  const missing = quad.indexOf(null);
  if (missing >= 0) {
    // A box's opposite corners: the missing one = its two neighbours added, minus the corner across from it.
    const a = quad[(missing + 1) % 4], b = quad[(missing + 3) % 4], across = quad[(missing + 2) % 4];
    quad[missing] = { x: a.x + b.x - across.x, y: a.y + b.y - across.y };
  }
  return { quad, seen: byId.size, guessed: missing >= 0 ? CORNER_NAMES[missing] : null };
}
