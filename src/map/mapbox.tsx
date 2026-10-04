import { useEffect, useRef } from "react";
import type { Camera, LngLat, Size } from "./projection";
import { ZOOM_LIMITS } from "./spokane";

/**
 * The real basemap.
 *
 * Mapbox is loaded dynamically and only when a token exists, so the app has no
 * hard dependency on it: without `VITE_MAPBOX_TOKEN` this module is never
 * imported, the chunk is never fetched, and `MapView` draws `Basemap` instead.
 * That is what lets the build be finished and screenshotted before anybody has
 * pasted a key in.
 *
 * The contract with `MapView` is small on purpose. Mapbox owns the camera
 * while it is mounted and reports it back on every move; the marker layer
 * above stays exactly as it is, because it was written against a `Projector`
 * rather than against a map library. Nothing that draws a pin knows which
 * basemap is underneath it.
 */

export const MAPBOX_TOKEN: string | undefined =
  import.meta.env.VITE_MAPBOX_TOKEN || undefined;

export const hasMapbox = Boolean(MAPBOX_TOKEN);

/**
 * Mapbox's own light and dark styles, retoned towards the palette.
 *
 * The overrides are read off the live CSS custom properties rather than
 * written as hex here, so the map and the UI cannot drift: change
 * `--color-map-water` in theme.css and the river changes in both basemaps.
 * Anything Mapbox draws that has no token equivalent is left alone — a
 * half-restyled map looks worse than an unstyled one.
 */
const PAINT: { layer: string; prop: string; token: string }[] = [
  { layer: "land", prop: "background-color", token: "--color-map" },
  { layer: "water", prop: "fill-color", token: "--color-map-water" },
  { layer: "waterway", prop: "line-color", token: "--color-map-water" },
  { layer: "landuse", prop: "fill-color", token: "--color-map-park" },
  { layer: "national-park", prop: "fill-color", token: "--color-map-park" },
  { layer: "road-primary", prop: "line-color", token: "--color-map-road" },
  {
    layer: "road-secondary-tertiary",
    prop: "line-color",
    token: "--color-map-road",
  },
  { layer: "road-street", prop: "line-color", token: "--color-map-road" },
  { layer: "road-minor", prop: "line-color", token: "--color-map-road" },
  {
    layer: "road-motorway-trunk",
    prop: "line-color",
    token: "--color-map-road-2",
  },
  { layer: "building", prop: "fill-color", token: "--color-map-2" },
  { layer: "settlement-label", prop: "text-color", token: "--color-map-ink" },
  {
    layer: "settlement-subdivision-label",
    prop: "text-color",
    token: "--color-map-ink",
  },
  { layer: "road-label", prop: "text-color", token: "--color-map-ink" },
  {
    layer: "water-point-label",
    prop: "text-color",
    token: "--color-map-water",
  },
  { layer: "water-line-label", prop: "text-color", token: "--color-map-water" },
];

export type MapboxMap = {
  /* Mapbox passes an event; `originalEvent` is set only when a person caused
     the move, which is how a drag is told apart from this app's own ease. */
  on: (event: string, fn: (e?: { originalEvent?: unknown }) => void) => void;
  remove: () => void;
  getCenter: () => { lng: number; lat: number };
  getZoom: () => number;
  jumpTo: (opts: { center: [number, number]; zoom: number }) => void;
  easeTo: (opts: {
    center: [number, number];
    zoom: number;
    duration: number;
  }) => void;
  resize: () => void;
  getStyle: () => { layers: { id: string }[] } | undefined;
  setStyle: (url: string) => void;
  setPaintProperty: (layer: string, prop: string, value: string) => void;
  project: (at: [number, number]) => { x: number; y: number };
  unproject: (at: [number, number]) => { lng: number; lat: number };
};

export function MapboxBasemap({
  camera,
  theme,
  onUserMove,
  onMoveEnd,
  onReady,
}: {
  camera: Camera;
  size: Size;
  theme: "light" | "dark";
  /** A person started moving the map — a drag, a wheel, a pinch. */
  onUserMove: () => void;
  /**
   * The camera once a move has settled. Deliberately not per frame: every
   * report re-renders the app above the map, and Mapbox moves at 60Hz. The
   * markers follow Mapbox frame by frame on their own, through its events.
   */
  onMoveEnd: (camera: Camera) => void;
  /** Hands back Mapbox's own projector, replacing the local Mercator one. */
  onReady: (map: MapboxMap | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  /* The listeners below are registered once, at mount; reading the callbacks
     through a ref keeps them from calling the first render's closures for the
     lifetime of the map. */
  const handlers = useRef({ onUserMove, onMoveEnd });
  handlers.current = { onUserMove, onMoveEnd };

  useEffect(() => {
    if (!host.current || !MAPBOX_TOKEN) return;
    let cancelled = false;
    let instance: MapboxMap | null = null;

    (async () => {
      const [mod] = await Promise.all([
        import("mapbox-gl"),
        import("mapbox-gl/dist/mapbox-gl.css"),
      ]);
      if (cancelled || !host.current) return;

      const mapboxgl = mod.default;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      instance = new mapboxgl.Map({
        container: host.current,
        style: `mapbox://styles/mapbox/${theme === "dark" ? "dark-v11" : "light-v11"}`,
        center: [camera.center.lng, camera.center.lat],
        zoom: camera.zoom,
        minZoom: ZOOM_LIMITS[0],
        maxZoom: ZOOM_LIMITS[1],
        attributionControl: true,
        /* The app draws its own markers in DOM above the canvas and never
           rotates them, so the two extra degrees of freedom would only ever
           put the labels at an angle. */
        pitchWithRotate: false,
        dragRotate: false,
        touchZoomRotate: false,
      }) as unknown as MapboxMap;

      map.current = instance;
      /* The end-to-end tests measure camera behaviour on the live map
         (tests/e2e/mapbox.spec.ts). Dev builds only. */
      if (import.meta.env.DEV) (window as { __map?: unknown }).__map = instance;

      instance.on("style.load", () => retone(instance!));
      instance.on("movestart", (e) => {
        if (e?.originalEvent) handlers.current.onUserMove();
      });
      /* The camera prop is echoed back from here, and the push-down effect
         below compares against the live map before easing — so the echo of a
         settled move is a no-op rather than the map fighting the mouse. */
      instance.on("moveend", () =>
        handlers.current.onMoveEnd({
          center: instance!.getCenter(),
          zoom: instance!.getZoom(),
        }),
      );

      /* Hand the projector over now rather than on `load`.
         `load` waits for the first tiles, and until it fires the marker layer
         projects with this app's own Mercator against the app's camera — which
         is the camera Mapbox is still easing *towards*. That is the opening
         drift: pins placed for the destination over a basemap that has not
         arrived. Mapbox's transform is set from the constructor options, so
         `project` is right from the first frame. */
      onReady(instance);
    })();

    return () => {
      cancelled = true;
      onReady(null);
      map.current?.remove();
      map.current = null;
    };
    /* Deliberately mounts once. The camera and theme are pushed in by the two
       effects below rather than by re-creating the map, which would throw away
       the tile cache on every pan. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Push the app's camera down only when it did not come from Mapbox. */
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const here = m.getCenter();
    const moved =
      Math.abs(here.lng - camera.center.lng) > 1e-6 ||
      Math.abs(here.lat - camera.center.lat) > 1e-6 ||
      Math.abs(m.getZoom() - camera.zoom) > 1e-3;
    if (!moved) return;
    m.easeTo({
      center: [camera.center.lng, camera.center.lat],
      zoom: camera.zoom,
      duration: 420,
    });
  }, [camera]);

  /* The style follows the theme. `style.load` fires again after the swap and
     `retone` re-applies the palette, so nothing else needs to know. */
  const styleTheme = useRef(theme);
  useEffect(() => {
    const m = map.current;
    if (!m || styleTheme.current === theme) return;
    styleTheme.current = theme;
    m.setStyle(
      `mapbox://styles/mapbox/${theme === "dark" ? "dark-v11" : "light-v11"}`,
    );
  }, [theme]);

  /* No resize effect: Mapbox watches its own container (`trackResize`), and a
     second resize from the panel's observer doubled the work on every drag of
     the window edge. */

  /* Two divs rather than one, because Mapbox turns whatever container it is
     given into `.mapboxgl-map`, and its stylesheet sets `position: relative`
     on that class. The stylesheet is imported dynamically, so it lands after
     the app's CSS and wins at equal specificity over an `absolute` utility on
     the same element — and `inset-0` does nothing to a relative box, which
     then collapses to its content height of zero and leaves Mapbox sizing its
     canvas to a 300px fallback.

     So the outer div does the positioning, where the late stylesheet cannot
     reach it, and the inner one is only ever asked to fill its parent. */
  return (
    <div className="absolute inset-0">
      <div ref={host} className="h-full w-full" />
    </div>
  );
}

/** Apply the token palette over whichever Mapbox style just loaded. */
function retone(map: MapboxMap) {
  const root = document.querySelector("[data-proto]");
  if (!root) return;
  const styles = getComputedStyle(root);
  const present = new Set(map.getStyle()?.layers.map((l) => l.id) ?? []);

  for (const { layer, prop, token } of PAINT) {
    if (!present.has(layer)) continue;
    const value = styles.getPropertyValue(token).trim();
    if (!value) continue;
    try {
      map.setPaintProperty(layer, prop, value);
    } catch {
      /* Mapbox renames layers between style versions. A layer that has moved
         is not worth an exception — the rest of the palette still lands. */
    }
  }
}

/** Mapbox's projector, in the shape the marker layer already expects. */
export function mapboxProjector(map: MapboxMap) {
  return {
    project: (at: LngLat) => map.project([at.lng, at.lat]),
    unproject: ({ x, y }: { x: number; y: number }) => map.unproject([x, y]),
    metersPerPixel: () =>
      (156543.03392 * Math.cos((map.getCenter().lat * Math.PI) / 180)) /
      Math.pow(2, map.getZoom()),
  };
}
