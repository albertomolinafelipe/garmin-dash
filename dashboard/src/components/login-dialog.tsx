import { type FormEvent, useState } from "react";

import { nhost } from "@/auth";
import { NhostLogo } from "@/components/nhost-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginDialog({
	open,
	onAuthenticated,
}: {
	open: boolean;
	onAuthenticated: () => void;
}) {
	const [email, setEmail] = useState("");
	const [otp, setOtp] = useState("");
	const [codeSent, setCodeSent] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!open) return null;

	let submitLabel = "Send code";
	if (codeSent) submitLabel = "Verify code";
	if (pending) submitLabel = "Please wait…";

	async function submit(event: FormEvent) {
		event.preventDefault();
		setPending(true);
		setError(null);
		try {
			if (!codeSent) {
				await nhost.auth.signInOTPEmail({ email: email.trim() });
				setCodeSent(true);
				return;
			}
			await nhost.auth.verifySignInOTPEmail({
				email: email.trim(),
				otp: otp.trim(),
			});
			onAuthenticated();
		} catch (reason) {
			setError(
				reason instanceof Error ? reason.message : "Authentication failed",
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-4">
			<div className="bg-card text-card-foreground relative w-full max-w-sm rounded-xl border p-6 shadow-xl">
				<div className="mb-4 text-center">
					<NhostLogo className="mx-auto mb-2 size-11" />
					<h2 className="text-xl font-semibold">Garmin Dashboard</h2>
					<p className="text-muted-foreground text-sm">
						{codeSent
							? "Enter the one-time code sent to your email."
							: "Sign in with your authorized email address."}
					</p>
				</div>
				<form onSubmit={submit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							autoComplete="email"
							value={email}
							disabled={codeSent || pending}
							onChange={(event) => setEmail(event.target.value)}
							required
							autoFocus
						/>
					</div>
					{codeSent ? (
						<div className="flex flex-col gap-2">
							<Label htmlFor="otp">One-time code</Label>
							<Input
								id="otp"
								inputMode="numeric"
								autoComplete="one-time-code"
								value={otp}
								disabled={pending}
								onChange={(event) => setOtp(event.target.value)}
								required
							/>
						</div>
					) : null}
					{error ? <p className="text-destructive text-sm">{error}</p> : null}
					<Button type="submit" className="w-full" disabled={pending}>
						{submitLabel}
					</Button>
					{codeSent ? (
						<Button
							type="button"
							variant="ghost"
							onClick={() => {
								setCodeSent(false);
								setOtp("");
								setError(null);
							}}
						>
							Use another email
						</Button>
					) : null}
				</form>
			</div>
		</div>
	);
}
