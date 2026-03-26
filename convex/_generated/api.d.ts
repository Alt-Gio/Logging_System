/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminLogs from "../adminLogs.js";
import type * as admins from "../admins.js";
import type * as announcements from "../announcements.js";
import type * as backup from "../backup.js";
import type * as cameras from "../cameras.js";
import type * as certificates from "../certificates.js";
import type * as crons from "../crons.js";
import type * as gamification from "../gamification.js";
import type * as internAccounts from "../internAccounts.js";
import type * as internAttendance from "../internAttendance.js";
import type * as internDocuments from "../internDocuments.js";
import type * as internHabits from "../internHabits.js";
import type * as internSessions from "../internSessions.js";
import type * as internTasks from "../internTasks.js";
import type * as interns from "../interns.js";
import type * as logEntries from "../logEntries.js";
import type * as notifications from "../notifications.js";
import type * as otpVerifications from "../otpVerifications.js";
import type * as pcs from "../pcs.js";
import type * as settings from "../settings.js";
import type * as sheets from "../sheets.js";
import type * as supervisors from "../supervisors.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminLogs: typeof adminLogs;
  admins: typeof admins;
  announcements: typeof announcements;
  backup: typeof backup;
  cameras: typeof cameras;
  certificates: typeof certificates;
  crons: typeof crons;
  gamification: typeof gamification;
  internAccounts: typeof internAccounts;
  internAttendance: typeof internAttendance;
  internDocuments: typeof internDocuments;
  internHabits: typeof internHabits;
  internSessions: typeof internSessions;
  internTasks: typeof internTasks;
  interns: typeof interns;
  logEntries: typeof logEntries;
  notifications: typeof notifications;
  otpVerifications: typeof otpVerifications;
  pcs: typeof pcs;
  settings: typeof settings;
  sheets: typeof sheets;
  supervisors: typeof supervisors;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
