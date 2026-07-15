import type { ReactNode } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

import { kanagawa } from "../theme";

type BaseMapProps = {
	children: ReactNode;
	bounds?: LatLngBoundsExpression;
	center?: LatLngExpression;
	zoom?: number;
	height?: number;
	className?: string;
};

export default function BaseMap({
	children,
	bounds,
	center = [0, 0],
	zoom = 2,
	height = 340,
	className = "route-map",
}: BaseMapProps) {
	return (
		<MapContainer
			bounds={bounds}
			boundsOptions={{ padding: [20, 20] }}
			center={bounds ? undefined : center}
			zoom={bounds ? undefined : zoom}
			scrollWheelZoom={false}
			className={className}
			style={{ height, width: "100%", background: kanagawa.sumiInk1 }}
			attributionControl={false}
		>
			{/* Dark basemap (CARTO) to sit with the Kanagawa theme. */}
			<TileLayer
				url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
				subdomains="abcd"
				className="route-map-basemap"
				opacity={0.68}
				zIndex={1}
			/>
			{/* Lightened hillshade overlay: keeps relief visible on the dark map. */}
			<TileLayer
				url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
				className="route-map-hillshade"
				opacity={0.28}
				zIndex={2}
			/>
			{children}
		</MapContainer>
	);
}
