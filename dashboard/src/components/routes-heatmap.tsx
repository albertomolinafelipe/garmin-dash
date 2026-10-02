import { useMemo } from "react";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Polyline, TileLayer } from "react-leaflet";

import {
	STADIA_ATTRIBUTION,
	STADIA_DARK_TILE_URL,
	STADIA_MAX_ZOOM,
	routeColor,
} from "@/lib/map-tiles";
import { useRouteTracks } from "@/lib/queries";

// Every recorded track stacked on one dark basemap at low opacity, so ground
// covered repeatedly burns in brighter than a one-off outing. There is no real
// heat kernel here — the "heat" is just alpha accumulating where routes overlap.
const MAX_POINTS_PER_TRACK = 300;
const TRACK_OPACITY = 0.14;

function thin(track: { lat: number; lng: number }[]): LatLngExpression[] {
	const step = Math.max(1, Math.ceil(track.length / MAX_POINTS_PER_TRACK));
	const out: LatLngExpression[] = [];
	for (let i = 0; i < track.length; i += step) {
		out.push([track[i].lat, track[i].lng]);
	}
	return out;
}

export function RoutesHeatmap() {
	const { data, isPending } = useRouteTracks();

	const routes = useMemo(() => {
		const streams = data?.activity_streams ?? [];
		return streams.flatMap((stream) => {
			const track = stream.payload ?? [];
			if (track.length < 2) return [];
			return [{ id: String(stream.activity_id), positions: thin(track) }];
		});
	}, [data]);

	if (routes.length === 0) {
		return (
			<div className="text-muted-foreground flex h-full items-center justify-center text-sm">
				{isPending ? "Loading routes…" : "No recorded routes with GPS yet."}
			</div>
		);
	}

	const bounds = routes.flatMap((r) => r.positions) as LatLngBoundsExpression;
	const color = routeColor();
	return (
		// Hundreds of overlapping polylines as SVG elements stall the main thread;
		// the canvas renderer draws them as one batch.
		<MapContainer
			preferCanvas
			bounds={bounds}
			boundsOptions={{ padding: [24, 24] }}
			className="route-map h-full w-full"
		>
			<TileLayer
				url={STADIA_DARK_TILE_URL}
				detectRetina
				maxNativeZoom={STADIA_MAX_ZOOM}
				attribution={STADIA_ATTRIBUTION}
				zIndex={1}
			/>
			{routes.map((route) => (
				<Polyline
					key={route.id}
					positions={route.positions}
					pathOptions={{
						color,
						weight: 3,
						opacity: TRACK_OPACITY,
						lineCap: "round",
						lineJoin: "round",
					}}
				/>
			))}
		</MapContainer>
	);
}
