import { useEffect, useRef } from "react";
import * as maptilersdk from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";

import type { RouteSegment } from "@/lib/grade";
import { routeCasingColor, routeColor } from "@/lib/map-tiles";

const ROUTE_SOURCE = "route";
const ROUTE_LAYER = "route-line";
const CASING_LAYER = "route-casing";
const MAP_STYLE = "outdoor-v4";

const apiKey = import.meta.env.VITE_MAPTILER_KEY as string | undefined;

function boundsOf(track: { lat: number; lng: number }[]) {
	const bounds = new maptilersdk.LngLatBounds();
	for (const point of track) bounds.extend([point.lng, point.lat]);
	return bounds;
}

// One LineString per grade segment, each carrying its own colour; without
// segments the whole track is a single line in the route colour.
function routeData(
	track: { lat: number; lng: number }[],
	segments: RouteSegment[] | undefined,
): GeoJSON.FeatureCollection {
	const lines = segments?.length
		? segments
		: [{ color: routeColor(), positions: track }];
	return {
		type: "FeatureCollection",
		features: lines.map((line) => ({
			type: "Feature",
			properties: { color: line.color },
			geometry: {
				type: "LineString",
				coordinates: line.positions.map((point) => [point.lng, point.lat]),
			},
		})),
	};
}

export function TerrainRouteMap({
	track,
	segments,
	marker,
}: {
	track: { lat: number; lng: number }[];
	segments?: RouteSegment[];
	marker?: { lat: number; lng: number } | null;
}) {
	const container = useRef<HTMLDivElement>(null);
	const mapRef = useRef<maptilersdk.Map | null>(null);
	const markerRef = useRef<maptilersdk.Marker | null>(null);

	useEffect(() => {
		if (!container.current || !apiKey) return;
		maptilersdk.config.apiKey = apiKey;

		const map = new maptilersdk.Map({
			container: container.current,
			style: MAP_STYLE,
			terrain: true,
			terrainExaggeration: 1,
			pitch: 70,
			bounds: boundsOf(track),
			fitBoundsOptions: { padding: 40 },
		});
		mapRef.current = map;

		const addRoute = () => {
			if (map.getSource(ROUTE_SOURCE)) return;
			map.addSource(ROUTE_SOURCE, {
				type: "geojson",
				data: routeData(track, segments),
			});
			// Casing in the page background colour, so the route stands out on any terrain.
			map.addLayer({
				id: CASING_LAYER,
				type: "line",
				source: ROUTE_SOURCE,
				layout: { "line-cap": "round", "line-join": "round" },
				paint: {
					"line-color": routeCasingColor(),
					"line-width": 7,
					"line-opacity": 0.9,
				},
			});
			map.addLayer({
				id: ROUTE_LAYER,
				type: "line",
				source: ROUTE_SOURCE,
				layout: { "line-cap": "round", "line-join": "round" },
				paint: {
					"line-color": ["get", "color"],
					"line-width": 3.5,
					"line-opacity": 1,
				},
			});
		};

		// The style can already be loaded by the time we subscribe, in which case
		// "load" never fires and the route would never be added.
		if (map.isStyleLoaded()) addRoute();
		else map.on("load", addRoute);

		return () => {
			markerRef.current?.remove();
			markerRef.current = null;
			map.remove();
			mapRef.current = null;
		};
	}, [track, segments]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		if (!marker) {
			markerRef.current?.remove();
			markerRef.current = null;
			return;
		}
		if (!markerRef.current) {
			const element = document.createElement("div");
			element.style.cssText = `width:12px;height:12px;border-radius:9999px;background:${routeColor()};border:2px solid #fff;`;
			markerRef.current = new maptilersdk.Marker({ element });
		}
		markerRef.current.setLngLat([marker.lng, marker.lat]).addTo(map);
	}, [marker]);

	if (!apiKey) {
		return (
			<div className="text-muted-foreground flex h-full items-center justify-center text-sm">
				3D terrain unavailable: missing VITE_MAPTILER_KEY.
			</div>
		);
	}

	return <div ref={container} className="h-full w-full" />;
}
