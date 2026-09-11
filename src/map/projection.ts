/**
 * Web Mercator, the ~30 lines of it this app needs.
 *
 * This exists so the fallback basemap and Mapbox agree about where a pin goes.
 * Everything above `MapView` works in lng/lat and asks a `Projector` for
 * pixels; the projector is either Mapbox's own `map.project`, or the one
 * below. Swap the basemap and nothing that draws a marker, a cluster or a
 * label changes — which is the whole reason the token can arrive later
 * without a rewrite.
 *
 * Mercator here is the standard slippy-map form: the world is a square of
 * `256 * 2^zoom` pixels, x runs 0→1 west to east and y 0→1 north to south.
 */

export type LngLat = { lng: number; lat: number };
export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

/** Viewport: what is in the middle, and how far in. */
export type Camera = { center: LngLat; zoom: number };

const TILE = 256;
/* Mercator diverges at the poles; every slippy map clamps at the same place. */
const MAX_LAT = 85.05112878;

/** lng/lat → unit square, x east, y south. */
export function toWorld({ lng, lat }: LngLat): Point {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return {
    x: (lng + 180) / 360,
    y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
  };
}

/** The inverse, for turning a drag in pixels back into a centre. */
export function fromWorld({ x, y }: Point): LngLat {
  return {
    lng: x * 360 - 180,
    lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
  };
}

/** World pixels across at this zoom. */
export const worldSize = (zoom: number) => TILE * Math.pow(2, zoom);

/**
 * A projector is the only thing the rest of the app knows about a basemap: it
 * turns a coordinate into a pixel inside the map element, and back.
 */
export type Projector = {
  project: (at: LngLat) => Point;
  unproject: (at: Point) => LngLat;
  /** Metres per pixel at the camera's latitude — the scale bar reads this. */
  metersPerPixel: () => number;
};

export function projector(camera: Camera, size: Size): Projector {
  const scale = worldSize(camera.zoom);
  const origin = toWorld(camera.center);
  const halfW = size.width / 2;
  const halfH = size.height / 2;

  return {
    project: (at) => {
      const w = toWorld(at);
      return {
        x: (w.x - origin.x) * scale + halfW,
        y: (w.y - origin.y) * scale + halfH,
      };
    },
    unproject: ({ x, y }) =>
      fromWorld({
        x: (x - halfW) / scale + origin.x,
        y: (y - halfH) / scale + origin.y,
      }),
    metersPerPixel: () =>
      (156543.03392 * Math.cos((camera.center.lat * Math.PI) / 180)) /
      Math.pow(2, camera.zoom),
  };
}

/** Move the camera by a drag in screen pixels. */
export function pan(camera: Camera, dx: number, dy: number): Camera {
  const scale = worldSize(camera.zoom);
  const w = toWorld(camera.center);
  return {
    ...camera,
    center: fromWorld({ x: w.x - dx / scale, y: w.y - dy / scale }),
  };
}

/**
 * Zoom about a fixed screen point, so the place under the cursor stays under
 * the cursor. A zoom that recentres on the middle instead is the single most
 * disorienting thing a map can do.
 */
export function zoomAbout(
  camera: Camera,
  delta: number,
  at: Point,
  size: Size,
  limits: [number, number],
): Camera {
  const next = Math.max(limits[0], Math.min(limits[1], camera.zoom + delta));
  if (next === camera.zoom) return camera;

  const before = projector(camera, size).unproject(at);
  const after = projector({ ...camera, zoom: next }, size).project(before);
  return pan({ ...camera, zoom: next }, after.x - at.x, after.y - at.y);
}

/** A bounding box, west/south/east/north. */
export type Bounds = { w: number; s: number; e: number; n: number };

export function viewportBounds(camera: Camera, size: Size): Bounds {
  const p = projector(camera, size);
  const nw = p.unproject({ x: 0, y: 0 });
  const se = p.unproject({ x: size.width, y: size.height });
  return { w: nw.lng, s: se.lat, e: se.lng, n: nw.lat };
}

export const within = (b: Bounds, at: LngLat) =>
  at.lng >= b.w && at.lng <= b.e && at.lat >= b.s && at.lat <= b.n;

/** The camera that fits a set of points, with room left for the panels. */
export function fit(
  points: LngLat[],
  size: Size,
  padding: { top: number; right: number; bottom: number; left: number },
  limits: [number, number],
): Camera | null {
  if (points.length === 0) return null;

  const world = points.map(toWorld);
  const x0 = Math.min(...world.map((p) => p.x));
  const x1 = Math.max(...world.map((p) => p.x));
  const y0 = Math.min(...world.map((p) => p.y));
  const y1 = Math.max(...world.map((p) => p.y));

  const usableW = Math.max(64, size.width - padding.left - padding.right);
  const usableH = Math.max(64, size.height - padding.top - padding.bottom);

  /* A single point has no extent to fit, so it gets the top of the range
     rather than an infinite zoom. */
  const spanX = Math.max(x1 - x0, 1e-7);
  const spanY = Math.max(y1 - y0, 1e-7);
  const zoom = Math.min(
    Math.log2(usableW / (spanX * TILE)),
    Math.log2(usableH / (spanY * TILE)),
    limits[1],
  );
  const clamped = Math.max(limits[0], zoom);

  /* Centre the content in the *usable* box, then express that as a camera
     centre for the whole element — which is what shifts the map out from
     under the browse panel instead of hiding half the results beneath it. */
  const scale = worldSize(clamped);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const offsetX = (padding.left - padding.right) / 2 / scale;
  const offsetY = (padding.top - padding.bottom) / 2 / scale;

  return {
    center: fromWorld({ x: cx - offsetX, y: cy - offsetY }),
    zoom: clamped,
  };
}
