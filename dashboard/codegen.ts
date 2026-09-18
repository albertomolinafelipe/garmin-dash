import { readFileSync } from "node:fs";

import type { CodegenConfig } from "@graphql-codegen/cli";

// Vite loads dashboard/.env for the app, but codegen runs as a plain node
// script and the Hasura admin secret lives at the repo root, alongside the
// sync service. Read all of them; real environment variables still win.
const ENV_FILES = ["../.secrets", "../.env", ".env"];

function envFile(path: string): Record<string, string> {
	try {
		const entries = readFileSync(path, "utf8")
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line !== "" && !line.startsWith("#"))
			.map((line) => {
				const at = line.indexOf("=");
				return [
					line.slice(0, at).trim(),
					line
						.slice(at + 1)
						.trim()
						.replace(/^["']|["']$/g, ""),
				] as const;
			});
		return Object.fromEntries(entries);
	} catch {
		return {};
	}
}

const env = Object.assign({}, ...ENV_FILES.map(envFile), process.env) as Record<
	string,
	string | undefined
>;

const endpoint =
	env.HASURA_GRAPHQL_ENDPOINT ??
	env.HASURA_GRAPHQL_URL ??
	env.VITE_HASURA_GRAPHQL_ENDPOINT ??
	"http://localhost:8080/v1/graphql";
const adminSecret = env.HASURA_GRAPHQL_ADMIN_SECRET;

if (!adminSecret) {
	throw new Error(
		"HASURA_GRAPHQL_ADMIN_SECRET is required for schema introspection (env or .env)",
	);
}

const config: CodegenConfig = {
	overwrite: true,
	schema: [
		{ [endpoint]: { headers: { "x-hasura-admin-secret": adminSecret } } },
	],
	documents: "src/graphql/operations.graphql",
	generates: {
		"src/graphql/generated.ts": {
			plugins: [
				"typescript",
				{
					"typescript-operations": {
						preResolveTypes: false,
						typesPrefix: "Generated",
					},
				},
				{ "typed-document-node": { typesPrefix: "Generated" } },
			],
		},
	},
};

export default config;
