import { GraphQLClient } from "graphql-request";

import { nhost } from "../auth";

const configuredEndpoint = import.meta.env.VITE_HASURA_GRAPHQL_ENDPOINT;
if (!configuredEndpoint) {
	throw new Error("VITE_HASURA_GRAPHQL_ENDPOINT must be configured");
}

let endpoint: URL;
try {
	endpoint = new URL(configuredEndpoint);
} catch {
	throw new Error("VITE_HASURA_GRAPHQL_ENDPOINT must be a valid URL");
}
if (
	!(["http:", "https:"] as const).includes(
		endpoint.protocol as "http:" | "https:",
	)
) {
	throw new Error("VITE_HASURA_GRAPHQL_ENDPOINT must use HTTP or HTTPS");
}

const authenticatedFetch: typeof fetch = async (input, init) => {
	let requestUrl: URL;
	try {
		requestUrl = new URL(
			typeof input === "string" || input instanceof URL ? input : input.url,
		);
	} catch {
		throw new Error("Refusing GraphQL request with an invalid endpoint");
	}
	if (requestUrl.href !== endpoint.href) {
		throw new Error("Refusing GraphQL request to an unexpected endpoint");
	}

	const session = await nhost.refreshSession();
	if (!session) {
		nhost.clearSession();
		throw new Error("Authentication required");
	}

	const headers = new Headers(init?.headers);
	headers.set("authorization", `Bearer ${session.accessToken}`);
	return window.fetch(endpoint, { ...init, headers });
};

export const graphQLClient = new GraphQLClient(endpoint.href, {
	fetch: authenticatedFetch,
});
