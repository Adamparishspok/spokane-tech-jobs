import { useMemo } from "react";
import {
  AVENUES,
  BLOCKS,
  DISTRICTS,
  GRID_LAT,
  GRID_LNG,
  HIGHWAYS,
  LATAH,
  PARKS,
  RIVER,
  STREETS,
  URBAN,
} from "./spokane";
import type { Camera, Size } from "./projection";
import { projector } from "./projection";

/**
 * The basemap the app draws when there is no Mapbox token.
 *
 * It is not a placeholder in the usual sense — it is the same city, in the
 * same coordinates, drawn in the app's own tokens. That has two consequences
 * worth the file:
 *
 * - It inverts. A raster basemap has one appearance; every fill here is a CSS
 *   variable, so the map goes dark with the rest of the product and the
 *   panels keep the depth relationship they were designed with.
 *
 * - It is deterministic. `bun run shots` produces byte-identical screenshots
 *   with no network, which is the only way a geometry regression is visible in
 *   a diff.
 *
 * Everything is drawn in one SVG in screen space: at these zooms Spokane is a
 * few hundred segments and re-projecting them per frame costs nothing next to
 * the layout it avoids.
 */

const path = (pts: [number, number][], p: ReturnType<typeof projector>) =>
  pts
    .map(([lng, lat], i) => {
      const { x, y } = p.project({ lng, lat });
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

const rect = (
  box: { w: number; s: number; e: number; n: number },
  p: ReturnType<typeof projector>,
) => {
  const a = p.project({ lng: box.w, lat: box.n });
  const b = p.project({ lng: box.e, lat: box.s });
  return {
    x: a.x,
    y: a.y,
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
};

export function Basemap({ camera, size }: { camera: Camera; size: Size }) {
  const p = useMemo(() => projector(camera, size), [camera, size]);
  const z = camera.zoom;

  /* Road weight tracks zoom rather than being fixed, because a 3px arterial at
     z10 is a city made of roads and at z15 it is a hairline nobody can see.
     One curve, three uses. */
  const w = (base: number) => Math.max(0.6, base * Math.pow(1.32, z - 11.5));

  /* Two grids at two thresholds. The generated half-mile grid is texture — it
     says "this is where the city is" and is unreadable as individual streets,
     so it arrives early and stays faint. The named arterials are information
     and arrive later, heavier, on top of it. */
  const minor = z >= 10.8;
  const arterials = z >= 11.4;
  const labels = z >= 10.4;

  /* The half-mile grid, generated inside the urban envelope rather than
     listed. Built once per camera; a few hundred short segments. */
  const minorGrid = useMemo(() => {
    if (!minor) return "";
    const out: string[] = [];
    for (const box of URBAN) {
      for (
        let lat = Math.ceil(box.s / GRID_LAT) * GRID_LAT;
        lat < box.n;
        lat += GRID_LAT
      ) {
        const a = p.project({ lng: box.w, lat });
        const b = p.project({ lng: box.e, lat });
        if (
          b.x < -40 ||
          a.x > size.width + 40 ||
          a.y < -40 ||
          a.y > size.height + 40
        )
          continue;
        out.push(
          `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`,
        );
      }
      for (
        let lng = Math.ceil(box.w / GRID_LNG) * GRID_LNG;
        lng < box.e;
        lng += GRID_LNG
      ) {
        const a = p.project({ lng, lat: box.n });
        const b = p.project({ lng, lat: box.s });
        if (
          a.x < -40 ||
          a.x > size.width + 40 ||
          b.y < -40 ||
          a.y > size.height + 40
        )
          continue;
        out.push(
          `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`,
        );
      }
    }
    return out.join(" ");
  }, [minor, p, size.width, size.height]);

  return (
    <svg
      width={size.width}
      height={size.height}
      className="absolute inset-0 select-none"
      aria-hidden="true"
    >
      <rect width={size.width} height={size.height} fill="var(--color-map)" />

      {BLOCKS.map((b, i) => {
        const r = rect(b, p);
        return <rect key={i} {...r} fill="var(--color-map-2)" rx={1.5} />;
      })}

      {PARKS.map((park) => {
        const r = rect(park, p);
        return (
          <rect key={park.name} {...r} fill="var(--color-map-park)" rx={3} />
        );
      })}

      {/* The half-mile grid, under everything that matters. */}
      {minor && (
        <path
          d={minorGrid}
          stroke="var(--color-map-road)"
          strokeWidth={w(0.85)}
          fill="none"
          opacity={0.75}
        />
      )}

      {/* The named arterials, a step heavier than the grid they sit on. */}
      {arterials && (
        <g
          stroke="var(--color-map-road)"
          strokeWidth={w(1.9)}
          strokeLinecap="round"
        >
          {AVENUES.map((a) => (
            <path
              key={`a-${a.name}`}
              d={path(
                [
                  [a.from, a.lat],
                  [a.to, a.lat],
                ],
                p,
              )}
            />
          ))}
          {STREETS.map((s) => (
            <path
              key={`s-${s.name}`}
              d={path(
                [
                  [s.lng, s.from],
                  [s.lng, s.to],
                ],
                p,
              )}
            />
          ))}
        </g>
      )}

      {/* Highways: a casing under a fill, which is the only reason a road
          reads as a road rather than as a line. */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {HIGHWAYS.map((h) => (
          <path
            key={`casing-${h.id}`}
            d={path(h.path, p)}
            stroke="var(--color-map-road-2)"
            strokeWidth={w(4.2)}
          />
        ))}
        {HIGHWAYS.map((h) => (
          <path
            key={`fill-${h.id}`}
            d={path(h.path, p)}
            stroke="var(--color-map-road)"
            strokeWidth={w(2.6)}
          />
        ))}
      </g>

      {/* The river last, and heaviest. It is what people orient on. */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          d={path(LATAH, p)}
          stroke="var(--color-map-water)"
          strokeWidth={w(2.4)}
        />
        <path
          d={path(RIVER, p)}
          stroke="var(--color-map-water)"
          strokeWidth={w(5.2)}
        />
      </g>

      {labels && (
        /* Painted stroke-under-fill rather than a drop shadow: a label on a
           map has to survive whatever is beneath it, and a halo the colour of
           the land is the only thing that works on both a park and a road. */
        <g
          fill="var(--color-map-ink)"
          stroke="var(--color-map)"
          strokeWidth={3}
          paintOrder="stroke"
          strokeLinejoin="round"
          fontSize={11}
          fontWeight={600}
          textAnchor="middle"
          letterSpacing="0.02em"
        >
          {DISTRICTS.filter((d) => z >= d.minZoom).map((d) => {
            const { x, y } = p.project(d.at);
            if (
              x < -60 ||
              y < -20 ||
              x > size.width + 60 ||
              y > size.height + 20
            )
              return null;
            return (
              <text key={d.id} x={x} y={y}>
                {d.name}
              </text>
            );
          })}
        </g>
      )}

      {/* The river's own label, set along it rather than across it.
          The path is reversed first: RIVER is stored east to west, which is
          right to left on screen, and a textPath laid on it comes out
          mirrored. A label has to run the way the reader does. */}
      {z >= 12 && (
        <g>
          <path
            id="river-label-path"
            d={path([...RIVER].reverse(), p)}
            fill="none"
          />
          <text
            fill="var(--color-map-water)"
            fontSize={10}
            fontWeight={600}
            letterSpacing="0.14em"
            style={{ filter: "brightness(0.72)" }}
          >
            <textPath href="#river-label-path" startOffset="46%">
              SPOKANE RIVER
            </textPath>
          </text>
        </g>
      )}
    </svg>
  );
}
