/**
 * Spokane, as much of it as a basemap needs.
 *
 * Coordinates, not an image. The original comps used a Google satellite
 * capture, which meant the map could not be themed, could not be zoomed, and
 * put photographic noise under every line of white text on the screen. What is
 * below is the same city as geometry: the river, the interstate, the arterial
 * grid, the parks and the district centres, in real lng/lat.
 *
 * Two things fall out of that. The fallback basemap can draw it in the app's
 * own tokens, so the map inverts with everything else — and every pin in
 * `data.ts` is positioned against the same coordinate space, so when a Mapbox
 * token arrives and the real tiles come up underneath, nothing moves.
 *
 * Accuracy is arterial-grade, not survey-grade: enough that the falls are
 * where the falls are and I-90 crosses under Division where it does. The
 * moment Mapbox is wired the geometry below stops being drawn at all.
 */

import type { LngLat } from "./projection";

export const SPOKANE: LngLat = { lng: -117.424, lat: 47.6555 };

/** Opening camera: downtown and the near valley, with the falls above centre. */
export const HOME = { center: SPOKANE, zoom: 11.6 };

export const ZOOM_LIMITS: [number, number] = [9.5, 16];

type Line = [number, number][]; // [lng, lat]

/**
 * The Spokane River, east to west — in from the Idaho line through the
 * valley, down over the falls at Riverfront, then out to the north-west.
 * It is the reason the city is shaped the way it is and it is the first thing
 * anyone uses to orient on this map, so it is drawn heaviest.
 */
export const RIVER: Line = [
  [-117.02, 47.703],
  [-117.062, 47.694],
  [-117.098, 47.678],
  [-117.142, 47.668],
  [-117.186, 47.672],
  [-117.229, 47.682],
  [-117.271, 47.689],
  [-117.312, 47.693],
  [-117.348, 47.691],
  [-117.375, 47.685],
  [-117.392, 47.677],
  [-117.401, 47.669],
  [-117.406, 47.664],
  [-117.413, 47.6615],
  [-117.4225, 47.6605],
  [-117.4335, 47.6625],
  [-117.4455, 47.666],
  [-117.4585, 47.6715],
  [-117.475, 47.6795],
  [-117.497, 47.6885],
  [-117.523, 47.6975],
];

/** Latah (Hangman) Creek, in from the south-west to meet the river. */
export const LATAH: Line = [
  [-117.47, 47.582],
  [-117.458, 47.606],
  [-117.448, 47.627],
  [-117.442, 47.644],
  [-117.4375, 47.6555],
  [-117.4335, 47.6625],
];

/** Interstate 90 — the other axis, and the one the valley is strung along. */
export const I90: Line = [
  [-117.02, 47.706],
  [-117.062, 47.688],
  [-117.104, 47.672],
  [-117.15, 47.662],
  [-117.2, 47.659],
  [-117.26, 47.658],
  [-117.32, 47.6565],
  [-117.371, 47.6545],
  [-117.4, 47.6515],
  [-117.425, 47.6485],
  [-117.447, 47.6455],
  [-117.475, 47.6415],
  [-117.512, 47.634],
  [-117.556, 47.6275],
  [-117.61, 47.6255],
];

/** US-2 out to the west plains and the airport. */
export const US2: Line = [
  [-117.411, 47.735],
  [-117.44, 47.7225],
  [-117.474, 47.7055],
  [-117.51, 47.688],
  [-117.545, 47.669],
  [-117.575, 47.652],
  [-117.6, 47.638],
];

/** SR-290, Trent — the old road up the valley on the north bank. */
export const TRENT: Line = [
  [-117.415, 47.6645],
  [-117.39, 47.6685],
  [-117.352, 47.6725],
  [-117.31, 47.6755],
  [-117.265, 47.678],
  [-117.218, 47.6795],
  [-117.176, 47.6845],
  [-117.14, 47.6925],
];

export const HIGHWAYS: { id: string; name: string; path: Line }[] = [
  { id: "i90", name: "90", path: I90 },
  { id: "us2", name: "2", path: US2 },
  { id: "sr290", name: "290", path: TRENT },
];

/**
 * The arterial grid. Spokane's numbered avenues run east–west and its named
 * streets north–south, which is why two arrays of straight segments read as a
 * city rather than as a grid of nothing in particular — the named ones are the
 * ones people give directions by.
 */
export const AVENUES: {
  name: string;
  lat: number;
  from: number;
  to: number;
}[] = [
  { name: "Francis", lat: 47.7018, from: -117.46, to: -117.352 },
  { name: "Wellesley", lat: 47.6928, from: -117.46, to: -117.33 },
  { name: "Garland", lat: 47.6862, from: -117.452, to: -117.39 },
  { name: "Mission", lat: 47.6712, from: -117.44, to: -117.31 },
  { name: "Broadway", lat: 47.6612, from: -117.44, to: -117.19 },
  { name: "Sprague", lat: 47.6555, from: -117.462, to: -117.18 },
  { name: "2nd", lat: 47.652, from: -117.44, to: -117.372 },
  { name: "9th", lat: 47.6448, from: -117.448, to: -117.365 },
  { name: "29th", lat: 47.6282, from: -117.448, to: -117.355 },
  { name: "57th", lat: 47.6062, from: -117.43, to: -117.375 },
];

export const STREETS: {
  name: string;
  lng: number;
  from: number;
  to: number;
}[] = [
  { name: "Maple", lng: -117.4382, from: 47.628, to: 47.705 },
  { name: "Monroe", lng: -117.427, from: 47.62, to: 47.705 },
  { name: "Division", lng: -117.411, from: 47.6, to: 47.74 },
  { name: "Hamilton", lng: -117.4022, from: 47.652, to: 47.705 },
  { name: "Nevada", lng: -117.3958, from: 47.648, to: 47.725 },
  { name: "Market", lng: -117.3798, from: 47.66, to: 47.72 },
  { name: "Freya", lng: -117.3712, from: 47.615, to: 47.705 },
  { name: "Regal", lng: -117.3612, from: 47.6, to: 47.685 },
  { name: "Argonne", lng: -117.2648, from: 47.63, to: 47.695 },
  { name: "Pines", lng: -117.2402, from: 47.625, to: 47.695 },
  { name: "Sullivan", lng: -117.1875, from: 47.625, to: 47.695 },
];

/** Parks, as rough rectangles. Enough to green the map where it is green. */
export const PARKS: {
  name: string;
  w: number;
  s: number;
  e: number;
  n: number;
  label?: boolean;
}[] = [
  {
    name: "Riverfront",
    w: -117.426,
    s: 47.657,
    e: -117.408,
    n: 47.6665,
    label: true,
  },
  {
    name: "Manito",
    w: -117.414,
    s: 47.6265,
    e: -117.4,
    n: 47.637,
    label: true,
  },
  /* Riverside is drawn as three overlapping boxes rather than one. A single
     rectangle that size is the one thing on the map that looks drawn rather
     than surveyed, and the park genuinely does follow the river's bend. */
  {
    name: "Riverside State Park",
    w: -117.518,
    s: 47.692,
    e: -117.482,
    n: 47.716,
    label: true,
  },
  { name: "Riverside north", w: -117.535, s: 47.708, e: -117.5, n: 47.736 },
  { name: "Riverside south", w: -117.5, s: 47.682, e: -117.474, n: 47.7 },
  { name: "Bowl and Pitcher", w: -117.494, s: 47.674, e: -117.47, n: 47.69 },
  { name: "Finch Arboretum", w: -117.462, s: 47.648, e: -117.448, n: 47.657 },
  { name: "Mission", w: -117.396, s: 47.6685, e: -117.383, n: 47.675 },
  { name: "Comstock", w: -117.418, s: 47.6205, e: -117.405, n: 47.627 },
  { name: "Dwight Merkel", w: -117.462, s: 47.688, e: -117.446, n: 47.699 },
  { name: "Plante's Ferry", w: -117.288, s: 47.688, e: -117.268, n: 47.699 },
  { name: "Liberty Lake", w: -117.108, s: 47.648, e: -117.082, n: 47.664 },
  { name: "High Bridge", w: -117.448, s: 47.646, e: -117.434, n: 47.656 },
  { name: "Underhill", w: -117.378, s: 47.646, e: -117.366, n: 47.654 },
  { name: "Shadle", w: -117.452, s: 47.682, e: -117.44, n: 47.69 },
  { name: "Franklin", w: -117.416, s: 47.702, e: -117.402, n: 47.712 },
  { name: "Indian Trail", w: -117.472, s: 47.712, e: -117.452, n: 47.732 },
  { name: "Beacon Hill", w: -117.378, s: 47.676, e: -117.356, n: 47.694 },
  { name: "Esmeralda", w: -117.372, s: 47.686, e: -117.356, n: 47.696 },
  { name: "Valley Mission", w: -117.256, s: 47.664, e: -117.242, n: 47.674 },
];

/**
 * The urbanized envelope.
 *
 * Spokane is a grid, and drawing every street of it by name would be a
 * thousand segments most of which nobody reads. Instead the minor grid is
 * generated on the half-mile inside these boxes, which is what gives the map
 * texture where the city is and leaves it empty where the city is not — the
 * scablands north of Francis and the plains west of the airport really are
 * that empty, and a basemap that pretends otherwise is lying about the place.
 */
export const URBAN: { w: number; s: number; e: number; n: number }[] = [
  { w: -117.47, s: 47.6, e: -117.33, n: 47.74 }, // the city proper
  { w: -117.33, s: 47.63, e: -117.15, n: 47.7 }, // the valley
  { w: -117.15, s: 47.65, e: -117.06, n: 47.69 }, // liberty lake
  { w: -117.62, s: 47.62, e: -117.56, n: 47.66 }, // airway heights
  { w: -117.6, s: 47.47, e: -117.54, n: 47.51 }, // cheney
];

/** Half a mile, near enough, at this latitude. */
export const GRID_LAT = 0.0072;
export const GRID_LNG = 0.0107;

/**
 * Built-up blocks — the downtown core, the university district, the valley
 * commercial strips. Drawn a step darker than the land so the map has somewhere
 * dense for the pins to cluster over, which is most of what a basemap is for at
 * this zoom.
 */
export const BLOCKS: { w: number; s: number; e: number; n: number }[] = [
  { w: -117.434, s: 47.6485, e: -117.405, n: 47.6595 }, // downtown core
  { w: -117.408, s: 47.6515, e: -117.392, n: 47.661 }, // university district
  { w: -117.44, s: 47.6595, e: -117.428, n: 47.6675 }, // kendall yards
  { w: -117.42, s: 47.6645, e: -117.398, n: 47.6735 }, // logan / gonzaga
  { w: -117.418, s: 47.686, e: -117.396, n: 47.7 }, // north division
  { w: -117.462, s: 47.684, e: -117.438, n: 47.694 }, // shadle
  { w: -117.262, s: 47.652, e: -117.228, n: 47.664 }, // valley mall
  { w: -117.2, s: 47.65, e: -117.172, n: 47.662 }, // sullivan
  { w: -117.112, s: 47.666, e: -117.086, n: 47.68 }, // liberty lake
  { w: -117.6, s: 47.636, e: -117.578, n: 47.652 }, // airway heights
  { w: -117.396, s: 47.644, e: -117.378, n: 47.654 }, // east central
  { w: -117.398, s: 47.638, e: -117.383, n: 47.648 }, // perry
  { w: -117.418, s: 47.624, e: -117.398, n: 47.638 }, // south hill / grand
  { w: -117.446, s: 47.648, e: -117.43, n: 47.658 }, // browne's addition
  { w: -117.392, s: 47.694, e: -117.372, n: 47.708 }, // hillyard
  { w: -117.294, s: 47.676, e: -117.272, n: 47.688 }, // millwood
  { w: -117.586, s: 47.478, e: -117.562, n: 47.496 }, // cheney
  { w: -117.44, s: 47.664, e: -117.42, n: 47.676 }, // north monroe
];

/**
 * Districts. These are the labels on the map and the values in the district
 * filter — the same list, because a place you can see is a place you should be
 * able to filter by, and two lists would drift.
 */
export type DistrictId =
  | "downtown"
  | "kendall-yards"
  | "university"
  | "logan"
  | "browne"
  | "perry"
  | "south-hill"
  | "garland"
  | "north-monroe"
  | "shadle"
  | "hillyard"
  | "east-central"
  | "millwood"
  | "valley"
  | "liberty-lake"
  | "airway-heights"
  | "cheney";

export const DISTRICTS: {
  id: DistrictId;
  name: string;
  at: LngLat;
  /** Below this zoom the label is noise; above it, orientation. */
  minZoom: number;
}[] = [
  {
    id: "downtown",
    name: "Downtown",
    at: { lng: -117.4225, lat: 47.6555 },
    minZoom: 10.5,
  },
  {
    id: "kendall-yards",
    name: "Kendall Yards",
    at: { lng: -117.4344, lat: 47.6636 },
    minZoom: 12.6,
  },
  {
    id: "university",
    name: "University District",
    at: { lng: -117.4022, lat: 47.6562 },
    minZoom: 12.2,
  },
  {
    id: "logan",
    name: "Logan",
    at: { lng: -117.4028, lat: 47.6688 },
    minZoom: 12.8,
  },
  {
    id: "browne",
    name: "Browne's Addition",
    at: { lng: -117.4392, lat: 47.6528 },
    minZoom: 12.8,
  },
  {
    id: "perry",
    name: "Perry District",
    at: { lng: -117.3906, lat: 47.6452 },
    minZoom: 12.4,
  },
  {
    id: "south-hill",
    name: "South Hill",
    at: { lng: -117.4092, lat: 47.6322 },
    minZoom: 11.4,
  },
  {
    id: "garland",
    name: "Garland",
    at: { lng: -117.4265, lat: 47.6884 },
    minZoom: 12.4,
  },
  {
    id: "north-monroe",
    name: "North Monroe",
    at: { lng: -117.4272, lat: 47.6752 },
    minZoom: 12.8,
  },
  {
    id: "shadle",
    name: "Shadle",
    at: { lng: -117.4495, lat: 47.6888 },
    minZoom: 12.2,
  },
  {
    id: "hillyard",
    name: "Hillyard",
    at: { lng: -117.3838, lat: 47.7005 },
    minZoom: 12.2,
  },
  {
    id: "east-central",
    name: "East Central",
    at: { lng: -117.3835, lat: 47.6522 },
    minZoom: 12.6,
  },
  {
    id: "millwood",
    name: "Millwood",
    at: { lng: -117.2822, lat: 47.6812 },
    minZoom: 12.2,
  },
  {
    id: "valley",
    name: "Spokane Valley",
    at: { lng: -117.2395, lat: 47.6568 },
    minZoom: 10.5,
  },
  {
    id: "liberty-lake",
    name: "Liberty Lake",
    at: { lng: -117.1012, lat: 47.6742 },
    minZoom: 10.8,
  },
  {
    id: "airway-heights",
    name: "Airway Heights",
    at: { lng: -117.5932, lat: 47.6448 },
    minZoom: 10.8,
  },
  {
    id: "cheney",
    name: "Cheney",
    at: { lng: -117.5758, lat: 47.4875 },
    minZoom: 10.2,
  },
];

export const districtName = (id: DistrictId) =>
  DISTRICTS.find((d) => d.id === id)?.name ?? id;
