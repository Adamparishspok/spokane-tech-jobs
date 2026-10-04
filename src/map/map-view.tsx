import { cn } from "@kit/lib/cn";
import { Minus, Plus, Crosshair, Layers } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Monogram } from "../design/brand";
import { Basemap } from "./basemap";
import {
  hasMapbox,
  MapboxBasemap,
  mapboxProjector,
  type MapboxMap,
} from "./mapbox";
import {
  pan as panCamera,
  projector,
  toWorld,
  fromWorld,
  worldSize,
  viewportBounds,
  zoomAbout,
  type Camera,
  type LngLat,
  type Point,
  type Projector,
  type Size,
} from "./projection";
import { plural } from "../app/chrome";
import { HOME, ZOOM_LIMITS } from "./spokane";

/**
 * The map, and everything that sits on it.
 *
 * The centrepiece of the redesign is one idea: **the map and the list are the
 * same query**. Hovering a row lights its pin and hovering a pin lights its
 * row; filtering removes from both at once; panning offers to re-run the
 * search over what is now on screen. In the original comps the two were
 * unrelated — eleven results in the list, two pins on the map, and no way to
 * get from one to the other.
 *
 * Everything above the basemap is DOM rather than canvas. A marker carrying a
 * count is a button with text in it: it inherits the type ramp, it is
 * reachable by Tab, and a screen reader gets "Latah Systems, 3 open roles"
 * rather than nothing at all. At this scale — a few dozen pins — the cost of
 * that is zero and the alternative is a canvas that nobody can use without a
 * mouse.
 *
 * **The camera has two speeds, and that split is the performance model.**
 * While a gesture is live — a drag, a wheel, an arrow key, one of Mapbox's own
 * eases — the camera belongs to this component: it changes a local state per
 * animation frame and re-renders the map alone. Only when the gesture ends is
 * the camera *committed* upward through `onCamera`, so the rest of the app —
 * the list, the strip, the detail column — re-renders once per gesture rather
 * than once per frame. The first build committed every frame, and dragging the
 * map meant reconciling the entire screen at 60Hz; that was the clunk.
 */

export type Pin = {
  id: string;
  at: LngLat;
  label: string;
  /** The company's self-hosted logo, or null for its monogram. */
  logo?: string | null;
  /** The monogram's hue, used when there is no logo. */
  hue: number;
  /** What the mark counts on this tab. */
  count?: number;
  /**
   * The singular noun `count` is in — "open role" on Companies and Jobs,
   * "person" on People. A mark that reads "3" has to be able to say what
   * three of, and the answer changes with the tab.
   */
  unit: string;
  /**
   * Ember rather than grey. It means one thing — this company is hiring — so
   * it is false on the People tab, where the count is people and an orange
   * mark would be claiming something the number does not say.
   */
  hiring: boolean;
  /** A company that is no longer trading — drawn desaturated, on History. */
  ghost?: boolean;
};

/** Room the panels take out of the map, so `fit` never centres under one. */
export type Padding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type Cluster = {
  key: string;
  at: Point;
  pins: Pin[];
};

/* Two pins closer than this on screen are one mark. 52px is the marker's own
   width plus a gap: below it the labels collide and the map stops being
   readable, above it a genuinely separate company disappears into a cluster. */
const CLUSTER_PX = 52;

function cluster(
  pins: Pin[],
  p: Projector,
  size: Size,
  zoom: number,
): Cluster[] {
  /* Past this zoom every pin stands alone — the point of zooming in is to
     stop clustering. */
  const clustering = zoom < 14.2;
  const buckets = new Map<string, Cluster>();

  for (const pin of pins) {
    const at = p.project(pin.at);
    /* Off-screen pins still cost a projection but not a DOM node. The margin
       keeps a marker that is half out of frame from popping. */
    if (
      at.x < -80 ||
      at.y < -80 ||
      at.x > size.width + 80 ||
      at.y > size.height + 80
    )
      continue;

    /* Bucketed in world pixels at a whole zoom level, not screen pixels.
       Screen buckets slide under the pins as the map pans, so groups split
       and merge mid-drag and their markers are torn down and rebuilt — the
       flicker. World buckets only change when the zoom crosses a whole level. */
    const key = clustering ? bucketOf(pin.at, zoom) : pin.id;
    const found = buckets.get(key);
    if (found) {
      found.pins.push(pin);
      /* The cluster sits at the mean of its members, so it moves smoothly as
         the map pans rather than snapping to whichever pin arrived first. */
      const n = found.pins.length;
      found.at = {
        x: found.at.x + (at.x - found.at.x) / n,
        y: found.at.y + (at.y - found.at.y) / n,
      };
    } else {
      buckets.set(key, { key, at, pins: [pin] });
    }
  }

  const out = [...buckets.values()];
  if (!clustering) fan(out);

  /* A marker's identity is who is in it, not where it is. A lone pin keeps
     its company's id and a cluster the ids of its members, so React keeps
     the same node — and its loaded logo — for as long as that is true. */
  for (const c of out)
    c.key =
      c.pins.length === 1
        ? c.pins[0].id
        : `cluster:${c.pins
            .map((p) => p.id)
            .sort()
            .join("|")}`;

  /* Southernmost last, so a marker lower on the screen overlaps the one above
     it — the same depth cue a physical map gets for free. */
  return out.sort((a, b) => a.at.y - b.at.y);
}

/** The world-pixel cell a point falls in at the current whole zoom level. */
function bucketOf(at: LngLat, zoom: number) {
  const scale = 256 * Math.pow(2, Math.floor(zoom));
  const x = ((at.lng + 180) / 360) * scale;
  const s = Math.sin((at.lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return `${Math.floor(x / CLUSTER_PX)}:${Math.floor(y / CLUSTER_PX)}`;
}

/**
 * Spread marks that share one exact spot into a ring around it.
 *
 * A company that publishes only its city sits on the city's centroid, and
 * several do — so past the clustering zoom they would stack into what looks
 * like one pin, with no zoom level that separates them. The ring is a display
 * offset around the true point, never a coordinate: the detail column still
 * says "Spokane, WA" rather than inventing a street.
 */
function fan(marks: Cluster[]) {
  const spots = new Map<string, Cluster[]>();
  for (const m of marks) {
    const key = `${Math.round(m.at.x)}:${Math.round(m.at.y)}`;
    const list = spots.get(key);
    if (list) list.push(m);
    else spots.set(key, [m]);
  }
  for (const group of spots.values()) {
    if (group.length < 2) continue;
    const radius = 18 + group.length * 4;
    group.forEach((m, i) => {
      const angle = (i / group.length) * Math.PI * 2 - Math.PI / 2;
      m.at = {
        x: m.at.x + Math.cos(angle) * radius,
        y: m.at.y + Math.sin(angle) * radius,
      };
    });
  }
}

/* How far past the visible box the fallback basemap is drawn. A pan inside
   this margin is a CSS transform of a picture already painted; only a pan
   past it, or any change of zoom, redraws the streets. */
const OVERSCAN = 360;

const sameCamera = (a: Camera, b: Camera, eps = 1e-9) =>
  Math.abs(a.center.lng - b.center.lng) < eps &&
  Math.abs(a.center.lat - b.center.lat) < eps &&
  Math.abs(a.zoom - b.zoom) < eps * 1000;

/* The ease Mapbox uses for its own camera, so the fallback basemap moves with
   the same hand. */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const FLY_MS = 420;

export function MapView({
  pins,
  camera,
  onCamera,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  padding,
  theme,
  /** Set when the viewport filter is armed, so the map can offer to re-run it. */
  onSearchArea,
  areaSearched,
  topInset = 0,
  onSize,
  className,
}: {
  pins: Pin[];
  camera: Camera;
  onCamera: (camera: Camera) => void;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  padding: Padding;
  theme: "light" | "dark";
  onSearchArea?: () => void;
  areaSearched?: boolean;
  /**
   * Pixels already occupied at the top-centre of the map by something the app
   * floats there — the ecosystem strip. "Search this area" takes the same slot
   * and would otherwise land on top of it.
   */
  topInset?: number;
  /** The map's measured box, so the app can fit a camera against the truth. */
  onSize?: (size: Size) => void;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [mapbox, setMapbox] = useState<MapboxMap | null>(null);
  /* Mapbox moves its canvas every frame of a pan, a zoom or an `easeTo`, and
     it does all of that outside React. The markers are DOM on top of that
     canvas, so they have to be re-projected on the same frames or they hang
     behind the basemap and snap into place at the end of the move. Bumping a
     counter on Mapbox's own events is what puts the two back on one clock —
     and it re-renders this component alone, never the app above it. */
  const [frame, setFrame] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [moved, setMoved] = useState(false);

  /* The gesture-speed camera for the fallback basemap. `liveRef` is the truth
     between renders (pointer events arrive faster than React paints);  the
     state is what the basemap and markers draw. While Mapbox is mounted both
     are idle — Mapbox owns the live camera and `frame` reads it. */
  const liveRef = useRef<Camera>(camera);
  const [live, setLive] = useState<Camera>(camera);
  /* The camera this component last sent up or received — the echo detector.
     A prop change that matches it is our own commit coming back and must not
     start a tween; one that differs is the app moving the map (a selection,
     Home) and is animated. */
  const committed = useRef<Camera>(camera);

  const setLiveCamera = useCallback((next: Camera) => {
    liveRef.current = next;
    setLive(next);
  }, []);

  /* ---- tween ------------------------------------------------------------
     The fallback basemap's answer to Mapbox's `easeTo`: app-driven camera
     changes glide rather than teleport. Interpolated in world coordinates so
     a pan during a zoom tracks straight. */
  const tween = useRef<number | null>(null);

  const stopTween = useCallback(() => {
    if (tween.current !== null) cancelAnimationFrame(tween.current);
    tween.current = null;
  }, []);

  const tweenTo = useCallback(
    (to: Camera) => {
      stopTween();
      const from = liveRef.current;
      if (sameCamera(from, to)) return;
      const a = toWorld(from.center);
      const b = toWorld(to.center);
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / FLY_MS);
        const k = easeOutCubic(t);
        const next: Camera = {
          center: fromWorld({
            x: a.x + (b.x - a.x) * k,
            y: a.y + (b.y - a.y) * k,
          }),
          zoom: from.zoom + (to.zoom - from.zoom) * k,
        };
        liveRef.current = next;
        setLive(next);
        tween.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      tween.current = requestAnimationFrame(step);
    },
    [stopTween],
  );

  /* An app-driven change arrives as a new `camera` prop. Our own commits come
     back the same way, so only a camera we did not just send starts a tween. */
  useEffect(() => {
    if (sameCamera(camera, committed.current)) return;
    committed.current = camera;
    if (mapbox) return; // Mapbox eases itself from the prop, in MapboxBasemap.
    tweenTo(camera);
  }, [camera, mapbox, tweenTo]);

  /* Commit: the gesture is over, tell the app where the map is. One render of
     the whole screen per gesture, here and nowhere else. */
  const commit = useCallback(() => {
    const now = liveRef.current;
    if (sameCamera(now, committed.current)) return;
    committed.current = now;
    onCamera(now);
  }, [onCamera]);

  /* Wheel and keyboard are gestures without an end event; they commit when
     the input goes quiet for a beat. */
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitSoon = useCallback(() => {
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(commit, 180);
  }, [commit]);
  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  /* The app moving the camera on purpose: zoom buttons, Home, a cluster.
     Commit immediately — it is one event, not a stream — and glide there. */
  const flyTo = useCallback(
    (next: Camera) => {
      committed.current = next;
      onCamera(next);
      if (!mapbox) tweenTo(next);
    },
    [mapbox, onCamera, tweenTo],
  );

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      const next = { width: box.width, height: box.height };
      setSize(next);
      onSize?.(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
    /* `onSize` is a setter the app never re-creates; re-observing on every
       render would tear the observer down mid-resize. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* One projector, whichever basemap is under it. Mapbox's own is used the
     moment it is available, because its camera is authoritative once it has
     the wheel — matching it from the outside with our own Mercator would drift
     by a pixel or two at high zoom and the pins would sit slightly wrong. */
  useEffect(() => {
    if (!mapbox) return;
    const tick = () => setFrame((n) => n + 1);
    for (const event of ["move", "zoom", "resize"]) mapbox.on(event, tick);
    tick();
    /* Mapbox has no `off` in the surface this app types, and the map is torn
       down with the component, so the listeners go with it. */
  }, [mapbox]);

  const project: Projector = useMemo(
    () => (mapbox ? mapboxProjector(mapbox) : projector(live, size)),
    /* `frame` is the dependency that matters while Mapbox owns the camera: it
       is what re-reads the live transform. `live` and `size` drive the
       fallback basemap's own projector. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapbox, live, size, frame],
  );

  const clusters = useMemo(
    () =>
      size.width
        ? cluster(pins, project, size, mapbox ? mapbox.getZoom() : live.zoom)
        : [],
    [pins, project, size, live.zoom, mapbox],
  );

  /* ---- pointer ----------------------------------------------------------
     Deltas accumulate in a ref and land once per animation frame. Pointer
     events outrun the display — folding three of them into one pan keeps the
     drag glued to the cursor instead of three renders behind it. */

  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pending = useRef({ dx: 0, dy: 0, raf: 0 });

  const flushPan = useCallback(() => {
    pending.current.raf = 0;
    const { dx, dy } = pending.current;
    if (!dx && !dy) return;
    pending.current.dx = 0;
    pending.current.dy = 0;
    setLiveCamera(panCamera(liveRef.current, dx, dy));
  }, [setLiveCamera]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (mapbox) return; // Mapbox handles its own input.
    if (e.button !== 0) return;
    stopTween();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 3) return;
    d.moved = true;
    setMoved(true);
    d.x = e.clientX;
    d.y = e.clientY;
    pending.current.dx += dx;
    pending.current.dy += dy;
    if (!pending.current.raf)
      pending.current.raf = requestAnimationFrame(flushPan);
  };

  const endDrag = () => {
    if (!drag.current) return;
    const wasDrag = drag.current.moved;
    drag.current = null;
    setDragging(false);
    if (wasDrag) {
      flushPan();
      commit();
    }
  };

  useEffect(() => {
    const el = host.current;
    if (!el || mapbox) return;

    /* Registered natively rather than through React, because a passive wheel
       listener cannot preventDefault and the page would scroll under the map
       while it zoomed. Registered once — it reads the live camera from a ref,
       so it does not need re-attaching per move the way it would if it closed
       over state. */
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopTween();
      const box = el.getBoundingClientRect();
      const at = { x: e.clientX - box.left, y: e.clientY - box.top };
      /* Trackpads report pixels and mice report lines; normalising here keeps
         a two-finger swipe from crossing four zoom levels. */
      const step = (e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * -0.0022;
      setMoved(true);
      setLiveCamera(
        zoomAbout(
          liveRef.current,
          Math.max(-0.6, Math.min(0.6, step)),
          at,
          { width: box.width, height: box.height },
          ZOOM_LIMITS,
        ),
      );
      commitSoon();
    };

    /* Double-click zooms about the cursor — the gesture every map teaches.
       Markers are buttons above this layer; a double-click on one is a click
       on a company, not a zoom. */
    const onDblClick = (e: MouseEvent) => {
      if ((e.target as Element).closest("button")) return;
      const box = el.getBoundingClientRect();
      const at = { x: e.clientX - box.left, y: e.clientY - box.top };
      setMoved(true);
      flyToRef.current(
        zoomAbout(
          liveRef.current,
          1,
          at,
          { width: box.width, height: box.height },
          ZOOM_LIMITS,
        ),
      );
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dblclick", onDblClick);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDblClick);
    };
  }, [mapbox, commitSoon, setLiveCamera, stopTween]);

  /* `flyTo` changes identity with `onCamera`; the listeners above live on a
     ref so they register once. */
  const flyToRef = useRef(flyTo);
  flyToRef.current = flyTo;

  const nudgeZoom = (delta: number) => {
    const base = mapbox
      ? { center: mapbox.getCenter(), zoom: mapbox.getZoom() }
      : liveRef.current;
    setMoved(true);
    flyTo(
      zoomAbout(
        base,
        delta,
        { x: size.width / 2, y: size.height / 2 },
        size,
        ZOOM_LIMITS,
      ),
    );
  };

  const home = () => {
    setMoved(false);
    flyTo(HOME);
  };

  /* Keyboard: the map is focusable and pans with the arrows, which is the only
     way anybody not using a mouse gets to a pin that is currently off screen. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 240 : 80;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      if (mapbox) return;
      stopTween();
      const [dx, dy] = moves[e.key];
      setMoved(true);
      setLiveCamera(panCamera(liveRef.current, -dx, -dy));
      commitSoon();
      return;
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      nudgeZoom(0.6);
    }
    if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      nudgeZoom(-0.6);
    }
  };

  /* ---- basemap, drawn once per zoom ----------------------------------- */
  const anchorRef = useRef<Camera>(live);
  let shift = { x: 0, y: 0 };
  if (!mapbox) {
    const a = anchorRef.current;
    const scale = worldSize(live.zoom);
    const wa = toWorld(a.center);
    const wl = toWorld(live.center);
    shift = { x: (wa.x - wl.x) * scale, y: (wa.y - wl.y) * scale };
    if (
      a.zoom !== live.zoom ||
      Math.abs(shift.x) > OVERSCAN * 0.8 ||
      Math.abs(shift.y) > OVERSCAN * 0.8
    ) {
      anchorRef.current = live;
      shift = { x: 0, y: 0 };
    }
  }
  const anchor = anchorRef.current;
  const basemap = useMemo(
    () =>
      size.width > 0 ? (
        <Basemap
          camera={anchor}
          size={{
            width: size.width + OVERSCAN * 2,
            height: size.height + OVERSCAN * 2,
          }}
        />
      ) : null,
    [anchor, size],
  );

  const zoomNow = mapbox ? mapbox.getZoom() : live.zoom;
  const bounds = size.width ? viewportBounds(live, size) : null;
  const scale = useMemo(() => scaleBar(project.metersPerPixel()), [project]);

  return (
    <div
      ref={host}
      className={cn(
        /* `isolate` is load-bearing. The markers carry z-indexes so a southern
           pin overlaps a northern one; without a stacking context here those
           indexes escape into the root and the pins paint over the browse
           panel, which is a later sibling at z-auto. */
        "relative isolate overflow-hidden bg-map outline-none",
        !mapbox && (dragging ? "cursor-grabbing" : "cursor-grab"),
        className,
      )}
      tabIndex={0}
      role="application"
      aria-label={`Map of Spokane, ${pins.length} ${
        pins.length === 1 ? "result" : "results"
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      {hasMapbox ? (
        <MapboxBasemap
          camera={camera}
          size={size}
          theme={theme}
          /* A move the reader makes arms "Search this area" the moment it
             starts; the camera itself is committed once, when the move ends.
             An app-driven ease commits the same way, so the camera prop stays
             honest without a single mid-flight render above the map. */
          onUserMove={() => setMoved(true)}
          onMoveEnd={(next) => {
            /* An ease this app asked for lands where it was sent, give or
               take Mapbox's rounding. That is not a move to report back. */
            if (sameCamera(next, committed.current, 1e-6)) return;
            committed.current = next;
            onCamera(next);
          }}
          onReady={setMapbox}
        />
      ) : (
        <div
          className="absolute will-change-transform"
          style={{
            left: -OVERSCAN,
            top: -OVERSCAN,
            width: size.width + OVERSCAN * 2,
            height: size.height + OVERSCAN * 2,
            transform: `translate3d(${shift.x}px, ${shift.y}px, 0)`,
          }}
        >
          {basemap}
        </div>
      )}

      {/* Markers. Pointer events are on the buttons only, so a drag that
          starts on the empty map still pans. */}
      <div className="pointer-events-none absolute inset-0">
        {clusters.map((c) =>
          c.pins.length === 1 ? (
            <Marker
              key={c.key}
              pin={c.pins[0]}
              at={c.at}
              selected={c.pins[0].id === selectedId}
              hovered={c.pins[0].id === hoveredId}
              onSelect={onSelect}
              onHover={onHover}
            />
          ) : (
            <ClusterMarker
              key={c.key}
              cluster={c}
              active={c.pins.some(
                (pin) => pin.id === selectedId || pin.id === hoveredId,
              )}
              onZoom={() =>
                flyTo(
                  zoomAbout(
                    mapbox
                      ? { center: mapbox.getCenter(), zoom: mapbox.getZoom() }
                      : liveRef.current,
                    1.4,
                    c.at,
                    size,
                    ZOOM_LIMITS,
                  ),
                )
              }
            />
          ),
        )}
      </div>

      {/* Controls sit inside the map's own padding, so they never end up under
          the browse panel or the detail column. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          paddingTop: padding.top,
          paddingRight: padding.right,
          paddingBottom: padding.bottom,
          paddingLeft: padding.left,
        }}
      >
        <div className="relative h-full w-full">
          {onSearchArea && moved && !areaSearched && (
            <button
              type="button"
              onClick={() => {
                setMoved(false);
                onSearchArea();
              }}
              style={{ top: 16 + topInset }}
              className="glass pointer-events-auto absolute left-1/2 -translate-x-1/2 rounded-full border px-4 py-2 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-surface-2"
            >
              Search this area
            </button>
          )}

          <div className="pointer-events-auto absolute right-4 bottom-4 flex flex-col gap-2">
            <div className="glass flex flex-col overflow-hidden rounded-field border">
              <MapButton
                label="Zoom in"
                onClick={() => nudgeZoom(0.8)}
                disabled={zoomNow >= ZOOM_LIMITS[1] - 0.01}
              >
                <Plus />
              </MapButton>
              <div className="h-px bg-line" />
              <MapButton
                label="Zoom out"
                onClick={() => nudgeZoom(-0.8)}
                disabled={zoomNow <= ZOOM_LIMITS[0] + 0.01}
              >
                <Minus />
              </MapButton>
            </div>
            <div className="glass overflow-hidden rounded-field border">
              <MapButton label="Back to Spokane" onClick={home}>
                <Crosshair />
              </MapButton>
            </div>
          </div>

          {/* Scale bar and provenance. A map that does not say what it is
              measuring, or where it came from, is a picture. */}
          <div className="absolute bottom-4 left-4 flex items-end gap-3">
            <div className="text-[0.6875rem] text-map-ink">
              <div
                className="mb-1 h-1.5 border-x border-b border-map-ink/70"
                style={{ width: scale.px }}
              />
              <span className="num">{scale.label}</span>
            </div>
            <p className="flex items-center gap-1 text-[0.6875rem] text-map-ink">
              <Layers className="size-3" />
              {hasMapbox ? "Mapbox · OpenStreetMap" : "Spokane basemap"}
            </p>
          </div>
        </div>
      </div>

      {/* The viewport, for the list that filters to it. Rendered for screen
          readers rather than drawn — it is state, not decoration. */}
      {bounds && (
        <span className="sr-only" aria-live="polite">
          {pins.length} of the directory is in view.
        </span>
      )}
    </div>
  );
}

function MapButton({
  label,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-35 disabled:hover:bg-transparent [&_svg]:size-4"
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * One company on the map: its logo, in a circle.
 *
 * The comps drew a generic red teardrop carrying no information at all, and
 * the first build replaced it with the number of open roles. The mark is the
 * company itself now — you recognise Avista or Itron on the map the way you
 * recognise them on a building — and the number it was carrying moves to a
 * badge on the corner, where it still says which companies are hiring without
 * being the only thing a pin can say.
 *
 * A company with no logo gets its monogram at the same size, so a directory
 * that is mostly small companies does not read as a map of broken images.
 *
 * Positioned with a transform rather than `left`/`top`: a transform moves on
 * the compositor, while `left` re-runs layout — and this element moves every
 * frame of every pan. The hover scale lives on an inner element so its
 * transition never fights the positional transform above it.
 */
function Marker({
  pin,
  at,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  pin: Pin;
  at: Point;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const active = selected || hovered;

  return (
    <button
      type="button"
      className="pointer-events-auto absolute top-0 left-0 will-change-transform"
      style={{
        transform: `translate3d(${at.x}px, ${at.y}px, 0)`,
        zIndex: active ? 20 : pin.hiring ? 10 : 5,
      }}
      onClick={() => onSelect(pin.id)}
      onMouseEnter={() => onHover(pin.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(pin.id)}
      onBlur={() => onHover(null)}
      aria-label={
        pin.count
          ? `${pin.label}, ${pin.count} ${plural(pin.unit, pin.count)}`
          : pin.label
      }
    >
      <span
        className={cn(
          "relative block -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-150",
          active && "scale-110",
        )}
      >
        <span
          className={cn(
            /* The ring is the marker's edge against the map, and it is what
               changes when a pin is the selected one — not the logo, which is
               the company's and not ours to recolour. */
            "block rounded-full border-2 shadow-[var(--shadow-marker)] transition-colors",
            selected
              ? "border-ink"
              : pin.hiring
                ? "border-hiring"
                : pin.ghost
                  ? "border-dashed border-ink-4"
                  : "border-solid",
          )}
        >
          <Monogram
            name={pin.label}
            hue={pin.hue}
            logo={pin.logo}
            round
            className={cn(
              "size-8 bg-solid",
              !pin.hiring && !active && "opacity-90",
              pin.ghost && !active && "grayscale",
            )}
          />
        </span>

        {/* How many roles are open, on the corner. Only where there are any:
            a badge reading 0 is a label nobody needs and forty of them is
            noise over the city. */}
        {pin.hiring && pin.count ? (
          <span
            className={cn(
              "num absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 px-1 text-[0.6875rem] font-semibold tabular-nums",
              selected
                ? "border-solid bg-ink text-ground"
                : "border-solid bg-hiring text-white",
            )}
          >
            {pin.count}
          </span>
        ) : null}

        {/* The name arrives on hover and on focus, not permanently: forty
            labels at once is a map with no map left in it. */}
        <span
          className={cn(
            "pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 rounded-chip border border-line-2 bg-surface px-1.5 py-0.5 text-[0.75rem] font-medium whitespace-nowrap text-ink shadow-[var(--shadow-card)] transition-opacity duration-100",
            active ? "opacity-100" : "opacity-0",
          )}
        >
          {pin.label}
        </span>
      </span>
    </button>
  );
}

function ClusterMarker({
  cluster,
  active,
  onZoom,
}: {
  cluster: Cluster;
  active: boolean;
  onZoom: () => void;
}) {
  const total = cluster.pins.reduce((n, p) => n + (p.count ?? 0), 0);
  /* Coloured by what the pins are, not by what they add up to. On the People
     tab every member is a quiet mark and the cluster has to be one too — the
     sum being non-zero there means people, not roles. */
  const hiring = cluster.pins.some((p) => p.hiring);
  const unit = cluster.pins[0]?.unit ?? "result";
  /* A cluster grows with what is inside it, but slowly — a linear size makes
     downtown a disc that covers the river. */
  const size = 26 + Math.min(14, Math.log2(cluster.pins.length + 1) * 6);

  return (
    <button
      type="button"
      className="pointer-events-auto absolute top-0 left-0 will-change-transform"
      style={{
        transform: `translate3d(${cluster.at.x}px, ${cluster.at.y}px, 0)`,
        zIndex: 15,
      }}
      onClick={onZoom}
      aria-label={`${cluster.pins.length} companies here, ${total} ${plural(
        unit,
        total,
      )}. Zoom in.`}
    >
      <span
        className={cn(
          "grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-surface font-semibold shadow-[var(--shadow-marker)] transition-transform duration-150 hover:scale-110",
          hiring ? "bg-hiring text-white" : "bg-ink-3 text-ground",
          active && "scale-110 ring-2 ring-ink ring-offset-1",
        )}
        style={{ width: size, height: size }}
      >
        <span className="num text-[0.8125rem] leading-none">
          {cluster.pins.length}
        </span>
      </span>
    </button>
  );
}

/**
 * A scale bar that lands on a round number.
 *
 * Fixing the pixel width and printing whatever distance it works out to gives
 * "1.37 km", which nobody can use. Fixing the distance to 1/2/5 × 10ⁿ and
 * letting the bar be whatever width that is gives a ruler.
 */
function scaleBar(metersPerPixel: number) {
  const target = 96; // px, roughly
  const raw = metersPerPixel * target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const nice = [1, 2, 5, 10].find((m) => m * pow >= raw / 1.6) ?? 10;
  const meters = nice * pow;
  return {
    px: Math.round(meters / metersPerPixel),
    label: meters >= 1000 ? `${meters / 1000} km` : `${meters} m`,
  };
}
