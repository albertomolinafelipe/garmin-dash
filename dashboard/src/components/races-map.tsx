import { useQueries } from "@tanstack/react-query";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import {
	CircleMarker,
	MapContainer,
	Polyline,
	TileLayer,
	Tooltip,
	useMap,
} from "react-leaflet";

import { graphQLClient } from "@/graphql/client";
import {
	ActivityDetailDocument,
	type GeneratedActivityDetailQueryVariables,
} from "@/graphql/generated";
import type { ActivityDetail } from "@/lib/queries";
import {
	STADIA_ATTRIBUTION,
	STADIA_MAX_ZOOM,
	STADIA_SATELLITE_TILE_URL,
	routeColor,
} from "@/lib/map-tiles";

export interface RaceRoute {
	id: string;
	name: string;
	activityId: string;
}

// Every race that resolved to an activity, drawn on one satellite map. Tracks
// come from the stream payload rather than the full-resolution samples: this is
// an overview, and one request per race is already plenty.
// The map mounts as soon as the first race resolves, so refit whenever another
// one lands; MapContainer's `bounds` prop only applies on mount.
function FitBounds({
	bounds,
	count,
}: {
	bounds: LatLngBoundsExpression;
	count: number;
}) {
	const map = useMap();
	useEffect(() => {
		map.fitBounds(bounds, { padding: [24, 24] });
	}, [map, bounds, count]);
	return null;
}

export function RacesMap({ races }: { races: RaceRoute[] }) {
	const results = useQueries({
		queries: races.map((race) => ({
			queryKey: ["activity", race.activityId],
			queryFn: () =>
				graphQLClient.request(ActivityDetailDocument, {
					id: race.activityId,
				} as GeneratedActivityDetailQueryVariables),
			select: (data: { activities_by_pk: unknown }) =>
				data.activities_by_pk as ActivityDetail | null,
		})),
	});

	const routes = races.flatMap((race, i) => {
		const track = results[i].data?.activity_streams[0]?.payload?.track ?? [];
		if (track.length < 2) return [];
		return [
			{
				race,
				positions: track.map((p) => [p.lat, p.lng] as LatLngExpression),
			},
		];
	});
	const pending = results.some((r) => r.isPending);

	if (routes.length === 0) {
		return (
			<div className="text-muted-foreground flex h-full items-center justify-center text-sm">
				{pending ? "Loading races…" : "No race routes with GPS yet."}
			</div>
		);
	}

	const bounds = routes.flatMap((r) => r.positions) as LatLngBoundsExpression;
	const color = routeColor();
	return (
		<MapContainer
			bounds={bounds}
			boundsOptions={{ padding: [24, 24] }}
			className="route-map h-full w-full"
		>
			<FitBounds bounds={bounds} count={routes.length} />
			<TileLayer
				url={STADIA_SATELLITE_TILE_URL}
				detectRetina
				maxNativeZoom={STADIA_MAX_ZOOM}
				attribution={STADIA_ATTRIBUTION}
				zIndex={1}
			/>
			{routes.map(({ race, positions }) => (
				<Polyline
					key={race.id}
					positions={positions}
					pathOptions={{ color, weight: 3, opacity: 1 }}
				>
					<Tooltip sticky>{race.name}</Tooltip>
				</Polyline>
			))}
			{routes.map(({ race, positions }) => (
				<CircleMarker
					key={`${race.id}-start`}
					center={positions[0]}
					radius={5}
					pathOptions={{
						color: "#fff",
						weight: 2,
						fillColor: color,
						fillOpacity: 1,
					}}
				>
					<Tooltip>{race.name}</Tooltip>
				</CircleMarker>
			))}
		</MapContainer>
	);
}
