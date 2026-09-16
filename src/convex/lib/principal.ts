import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { fail } from "./errors";
import { ALL_PERMISSIONS, type Permission } from "./permissions";

export const principalValidator = v.object({
  kind: v.union(
    v.literal("anonymous"),
    v.literal("visitor"),
    v.literal("api_key"),
    v.literal("owner"),
    v.literal("admin"),
  ),
  permissions: v.array(v.string()),
  roleName: v.optional(v.string()),
  username: v.optional(v.string()),
  visitorId: v.optional(v.id("visitors")),
  userId: v.optional(v.id("users")),
  sessionId: v.optional(v.string()),
  ip: v.optional(v.string()),
});

export type Principal = {
  kind: "anonymous" | "visitor" | "api_key" | "owner" | "admin";
  permissions: string[];
  roleName?: string;
  username?: string;
  visitorId?: Id<"visitors">;
  userId?: Id<"users">;
  sessionId?: string;
  ip?: string;
};

export const ANONYMOUS: Principal = { kind: "anonymous", permissions: [] };

export function ownerPrincipal(args: {
  userId?: Id<"users">;
  username?: string;
  kind?: "owner" | "admin";
}): Principal {
  return {
    kind: args.kind ?? "owner",
    permissions: [...ALL_PERMISSIONS],
    roleName: args.kind === "admin" ? "Admin" : "Owner",
    username: args.username,
    userId: args.userId,
  };
}

export function hasPermission(principal: Principal | null | undefined, permission: Permission): boolean {
  if (!principal) return false;
  if (principal.kind === "owner" || principal.kind === "admin") return true;
  return principal.permissions.includes(permission);
}

export function assertPermission(principal: Principal | null | undefined, permission: Permission): void {
  if (!hasPermission(principal, permission)) {
    if (!principal || principal.kind === "anonymous") {
      fail("Authentication required", 401, "unauthenticated");
    }
    fail(`Your role is missing the required permission: ${permission}`, 403, "forbidden");
  }
}

/** API keys are storage-only (P-12): every other capability is refused. */
export const API_KEY_PERMISSIONS: Permission[] = ["storage_read", "storage_write", "lib_read", "lib_write"];

export function isApiKeyAllowed(permission: Permission): boolean {
  return API_KEY_PERMISSIONS.includes(permission);
}
