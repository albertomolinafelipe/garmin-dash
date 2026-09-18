import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";

import { cn } from "@/lib/utils";
import {
	routeColor,
	STADIA_DARK_TILE_URL,
	STADIA_MAX_ZOOM,
} from "@/lib/map-tiles";

// A static, non-interactive route thumbnail. Deliberately dumber than the
// detail page's RouteMap: no 2D/3D toggle, no hover marker, no zoom controls.
// A thumbnail often mounts before its grid cell has been laid out, and Leaflet
// measures the container once: without this the tiles never fill the box.
function Resize({ positions }: { positions: LatLngExpression[] }) {
	const map = useMap();
	useEffect(() => {
		map.invalidateSize();
		map.fitBounds(positions as LatLngBoundsExpression, { padding: [12, 12] });
	}, [map, positions]);
	return null;
}

export function RoutePreviewMap({
	track,
	className,
}: {
	track: { lat: number; lng: number }[];
	className?: string;
}) {
	const positions: LatLngExpression[] = track.map((p) => [p.lat, p.lng]);
	return (
		<div className={cn("isolate overflow-hidden", className)}>
			<MapContainer
				bounds={positions as LatLngBoundsExpression}
				boundsOptions={{ padding: [12, 12] }}
				zoomControl={false}
				dragging={false}
				scrollWheelZoom={false}
				doubleClickZoom={false}
				attributionControl={false}
				className="route-map h-full w-full"
			>
				<TileLayer
					url={STADIA_DARK_TILE_URL}
					detectRetina
					maxNativeZoom={STADIA_MAX_ZOOM}
				/>
				<Resize positions={positions} />
				<Polyline
					positions={positions}
					pathOptions={{ color: routeColor(), weight: 3, opacity: 0.95 }}
				/>
			</MapContainer>
		</div>
	);
}
