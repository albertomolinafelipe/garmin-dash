import { Card, Text } from "@mantine/core";
import { Polyline } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";

import type { LatLng } from "../api/types";
import { kanagawa } from "../theme";
import BaseMap from "./BaseMap";

export default function RouteMap({ track }: { track: LatLng[] }) {
	const positions: LatLngExpression[] = track.map((p) => [p.lat, p.lng]);
	const bounds = positions as LatLngBoundsExpression;

	return (
		<Card withBorder padding={0} style={{ overflow: "hidden" }}>
			<Text fw={600} p="sm" pb="xs">
				Route
			</Text>
			<BaseMap bounds={bounds}>
				<Polyline
					positions={positions}
					pathOptions={{ color: kanagawa.crystalBlue, weight: 4, opacity: 0.9 }}
				/>
			</BaseMap>
		</Card>
	);
}
