// Basemaps shared by the activity detail route map and the calendar hover
// preview, both from Stadia Maps.
//
// CARTO is deliberately not used: it now stamps "API KEY REQUIRED" across
// keyless tiles, which still return HTTP 200 so the failure is silent.
//
// Stadia serves localhost unauthenticated, but any other origin gets a 401
// error tile. For deploys, either allowlist the domain on the Stadia account
// (no code change) or set VITE_STADIA_API_KEY, which is appended below.
const apiKey = import.meta.env.VITE_STADIA_API_KEY as string | undefined;
const suffix = apiKey ? `?api_key=${apiKey}` : "";

// `{r}` expands to "@2x" when Leaflet's detectRetina is on, which fetches the
// next zoom level's tiles and draws them at half size: same framing, twice the
// detail. Both styles serve @2x.

// Muted dark basemap; enough shape to place a route without competing with it.
export const STADIA_DARK_TILE_URL = `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png${suffix}`;

// Satellite imagery with peak names and elevations baked in.
export const STADIA_SATELLITE_TILE_URL = `https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg${suffix}`;

// Shaded-relief terrain, laid over the satellite to bring out slope and ridge
// lines that flat imagery hides. Opaque, so it is blended by CSS rather than
// opacity alone (see .route-map-terrain).
export const STADIA_TERRAIN_TILE_URL = `https://tiles.stadiamaps.com/tiles/stamen_terrain_background/{z}/{x}/{y}{r}.png${suffix}`;

export const STADIA_MAX_ZOOM = 20;

export const STADIA_ATTRIBUTION =
	'&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
