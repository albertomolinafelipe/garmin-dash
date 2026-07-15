import { Card, Text } from "@mantine/core";
import { MapContainer, Polyline, TileLayer } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

import type { LatLng } from "../api/types";
import { kanagawa } from "../theme";

export default function RouteMap({ track }: { track: LatLng[] }) {
	const positions: LatLngExpression[] = track.map((p) => [p.lat, p.lng]);
	const bounds = positions as LatLngBoundsExpression;

	return (
		<Card withBorder padding={0} style={{ overflow: "hidden" }}>
			<Text fw={600} p="sm" pb="xs">
				Route
			</Text>
			<MapContainer
				bounds={bounds}
				boundsOptions={{ padding: [20, 20] }}
				scrollWheelZoom={false}
				style={{ height: 340, width: "100%", background: kanagawa.sumiInk1 }}
				attributionControl={false}
			>
				{/* Dark basemap (CARTO) to sit with the Kanagawa theme. */}
				<TileLayer
					url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
					subdomains="abcd"
					zIndex={1}
				/>
				{/* Lightened hillshade overlay: keeps relief visible on the dark map. */}
				<TileLayer
					url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
					className="route-map-hillshade"
					opacity={0.28}
					zIndex={2}
				/>
				<Polyline
					positions={positions}
					pathOptions={{ color: kanagawa.crystalBlue, weight: 4, opacity: 0.9 }}
				/>
			</MapContainer>
		</Card>
	);
}
