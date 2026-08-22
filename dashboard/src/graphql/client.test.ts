import { beforeEach, describe, expect, it, vi } from "vitest";

const { refreshSession, clearSession } = vi.hoisted(() => ({
	refreshSession: vi.fn(),
	clearSession: vi.fn(),
}));

vi.mock("../auth", () => ({
	nhost: { refreshSession, clearSession },
}));

import { graphQLClient } from "./client";

describe("authenticated GraphQL client", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		refreshSession.mockReset();
		clearSession.mockReset();
	});

	it("injects the current access token", async () => {
		refreshSession.mockResolvedValue({ accessToken: "test-access-token" });
		const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ data: { __typename: "query_root" } }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		await graphQLClient.request("query { __typename }");

		const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
		expect(headers.get("authorization")).toBe("Bearer test-access-token");
		expect(headers.has("x-hasura-admin-secret")).toBe(false);
	});

	it("rejects requests without a valid session", async () => {
		refreshSession.mockResolvedValue(null);
		const fetchMock = vi.spyOn(window, "fetch");

		await expect(graphQLClient.request("query { __typename }")).rejects.toThrow(
			"Authentication required",
		);

		expect(clearSession).toHaveBeenCalledOnce();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
