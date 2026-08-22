import { createClient } from "@nhost/nhost-js";

const authUrl = import.meta.env.VITE_NHOST_AUTH_URL;
const graphqlUrl = import.meta.env.VITE_HASURA_GRAPHQL_ENDPOINT;

if (!authUrl || !graphqlUrl) {
	throw new Error(
		"VITE_NHOST_AUTH_URL and VITE_HASURA_GRAPHQL_ENDPOINT must be configured",
	);
}

for (const [name, value] of Object.entries({ authUrl, graphqlUrl })) {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`${name} must be a valid URL`);
	}
	if (
		!(["http:", "https:"] as const).includes(url.protocol as "http:" | "https:")
	) {
		throw new Error(`${name} must use HTTP or HTTPS`);
	}
}

export const nhost = createClient({ authUrl, graphqlUrl });
