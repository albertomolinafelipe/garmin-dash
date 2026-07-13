import { QueryClient } from "@tanstack/react-query";

// Shared instance so components (e.g. the Sync button) can invalidate queries.
export const queryClient = new QueryClient();
