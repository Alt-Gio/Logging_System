import { internalMutation } from "./_generated/server"

// Stub — implement Google Sheets sync logic here
export const syncStaffSheet = internalMutation({
  args: {},
  handler: async (ctx) => {
    // TODO: call Google Sheets API via fetch inside a Convex action
    await ctx.db.insert("sheetSyncLog", {
      syncedAt:       Date.now(),
      recordsSynced:  0,
      recordsFlagged: 0,
      errorCount:     0,
      triggeredBy:    "cron",
    })
    return { status: "stub" }
  },
})
