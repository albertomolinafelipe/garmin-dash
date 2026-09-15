import * as L from "leaflet";
import { GestureHandling } from "leaflet-gesture-handling";
import "leaflet-gesture-handling/dist/leaflet-gesture-handling.css";

// The plugin ships no option typing, so declare it: react-leaflet's
// MapContainerProps extends MapOptions, which surfaces the prop on the JSX.
declare module "leaflet" {
	interface MapOptions {
		gestureHandling?: boolean;
	}
}

// Register the handler once so any MapContainer can opt in with a
// `gestureHandling` prop. It dims the map and shows a "use ctrl + scroll to
// zoom" overlay when the user scrolls without the modifier, and requires two
// fingers to pan on touch.
L.Map.addInitHook("addHandler", "gestureHandling", GestureHandling);
