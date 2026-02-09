/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analysis_analyzeTables from "../analysis/analyzeTables.js";
import type * as analysis_checkSyncIssues from "../analysis/checkSyncIssues.js";
import type * as apiKeys from "../apiKeys.js";
import type * as documents from "../documents.js";
import type * as polar from "../polar.js";
import type * as rateLimits from "../rateLimits.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "analysis/analyzeTables": typeof analysis_analyzeTables;
  "analysis/checkSyncIssues": typeof analysis_checkSyncIssues;
  apiKeys: typeof apiKeys;
  documents: typeof documents;
  polar: typeof polar;
  rateLimits: typeof rateLimits;
  usage: typeof usage;
  users: typeof users;
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
