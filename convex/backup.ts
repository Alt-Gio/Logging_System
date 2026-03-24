import { internalMutation } from "./_generated/server"

// Stub — Convex has built-in backup via the dashboard.
// Implement custom snapshot logic here if needed.
export const createSnapshot = internalMutation({
  args: {},
  handler: async (_ctx) => {
    return { status: "stub", message: "Use Convex dashboard for backups" }
  },
})
