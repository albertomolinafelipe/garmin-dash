import { Anchor, Card, Center, Group, Text } from "@mantine/core";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import { Link } from "react-router-dom";
import { Polyline } from "react-leaflet";

import type { ActivityRoute } from "../api/types";
import { kanagawa } from "../theme";
import BaseMap from "./BaseMap";

export default function LatestRunRoutesMap({
	routes,
}: {
	routes: ActivityRoute[];
}) {
	const route = routes[0];
	const positions: LatLngExpression[] =
		route?.track.map((point) => [point.lat, point.lng] as LatLngExpression) ??
		[];
	const bounds =
		positions.length > 0 ? (positions as LatLngBoundsExpression) : undefined;

	return (
		<Card
			withBorder
			padding={0}
			style={{
				overflow: "hidden",
				height: "100%",
				display: "flex",
				flexDirection: "column",
			}}
		>
			<Group justify="space-between" p="sm" pb="xs">
				<Text fw={600}>Latest run</Text>
				{route && (
					<Anchor
						component={Link}
						to={`/activities/${route.activity_id}`}
						size="sm"
					>
						{route.name ?? "Open activity"}
					</Anchor>
				)}
			</Group>
			<div style={{ flex: 1, minHeight: 0 }}>
			{!route ? (
				<Center h="100%">
					<Text c="dimmed" size="sm">
						No latest outdoor run route yet. Sync FIT files to populate this
						map.
					</Text>
				</Center>
			) : (
				<BaseMap bounds={bounds} height="100%">
					<Polyline
						positions={positions}
						pathOptions={{
							color: kanagawa.sakuraPink,
							opacity: 0.9,
							weight: 4,
						}}
					/>
				</BaseMap>
			)}
			</div>
		</Card>
	);
}
