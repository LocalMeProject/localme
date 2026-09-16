/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as accounts from "../accounts.js";
import type * as authz from "../authz.js";
import type * as automation from "../automation.js";
import type * as crons from "../crons.js";
import type * as data from "../data.js";
import type * as domains from "../domains.js";
import type * as http from "../http.js";
import type * as insights from "../insights.js";
import type * as lib_config from "../lib/config.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_defaults from "../lib/defaults.js";
import type * as lib_dsl from "../lib/dsl.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_files from "../lib/files.js";
import type * as lib_minify from "../lib/minify.js";
import type * as lib_paths from "../lib/paths.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_principal from "../lib/principal.js";
import type * as lib_session from "../lib/session.js";
import type * as lib_validation from "../lib/validation.js";
import type * as lib_webhookBus from "../lib/webhookBus.js";
import type * as lib_zip from "../lib/zip.js";
import type * as maintenance from "../maintenance.js";
import type * as projects from "../projects.js";
import type * as routing from "../routing.js";
import type * as secrets from "../secrets.js";
import type * as settings from "../settings.js";
import type * as storage from "../storage.js";
import type * as transfer from "../transfer.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  accounts: typeof accounts;
  authz: typeof authz;
  automation: typeof automation;
  crons: typeof crons;
  data: typeof data;
  domains: typeof domains;
  http: typeof http;
  insights: typeof insights;
  "lib/config": typeof lib_config;
  "lib/crypto": typeof lib_crypto;
  "lib/defaults": typeof lib_defaults;
  "lib/dsl": typeof lib_dsl;
  "lib/errors": typeof lib_errors;
  "lib/files": typeof lib_files;
  "lib/minify": typeof lib_minify;
  "lib/paths": typeof lib_paths;
  "lib/permissions": typeof lib_permissions;
  "lib/principal": typeof lib_principal;
  "lib/session": typeof lib_session;
  "lib/validation": typeof lib_validation;
  "lib/webhookBus": typeof lib_webhookBus;
  "lib/zip": typeof lib_zip;
  maintenance: typeof maintenance;
  projects: typeof projects;
  routing: typeof routing;
  secrets: typeof secrets;
  settings: typeof settings;
  storage: typeof storage;
  transfer: typeof transfer;
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
