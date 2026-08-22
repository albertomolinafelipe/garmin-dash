import { describe, expect, it } from "vitest";

import { isUnauthorizedEmailError } from "./login-dialog";

describe("isUnauthorizedEmailError", () => {
	it.each([
		new Error("Sign up is disabled"),
		new Error("user not found"),
	])("recognizes rejected email addresses", (error) => {
		expect(isUnauthorizedEmailError(error)).toBe(true);
	});

	it.each([
		new Error("Network request failed"),
		new Error("Invalid OTP"),
		"Sign up is disabled",
	])("does not redirect unrelated failures", (error) => {
		expect(isUnauthorizedEmailError(error)).toBe(false);
	});
});
