import { fail } from "./errors";

const USERNAME_RE = /^[A-Za-z0-9_]{3,32}$/;
const PROJECT_NAME_RE = /^[A-Za-z0-9-]{3,32}$/;
const DOMAIN_RE = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;

export function validateUsername(username: unknown): string {
  if (typeof username !== "string" || !USERNAME_RE.test(username)) {
    fail("Usernames must be 3-32 characters using letters, numbers and underscores", 400, "invalid_username");
  }
  return username;
}

export function validateProjectName(name: unknown): string {
  if (typeof name !== "string" || !PROJECT_NAME_RE.test(name)) {
    fail("Project names must be 3-32 characters using letters, numbers and hyphens", 400, "invalid_project_name");
  }
  return name;
}

export function validatePassword(password: unknown): string {
  if (typeof password !== "string" || password.length < 8) {
    fail("Passwords must be at least 8 characters", 400, "invalid_password");
  }
  if (password.length > 200) fail("Passwords must be at most 200 characters", 400, "invalid_password");
  return password;
}

export function validateVisitorUsername(username: unknown): string {
  if (typeof username !== "string" || !/^[A-Za-z0-9_.@+-]{3,64}$/.test(username)) {
    fail("Visitor usernames must be 3-64 characters", 400, "invalid_username");
  }
  return username;
}

export function validateEmail(email: unknown): string | undefined {
  if (email === undefined || email === null || email === "") return undefined;
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fail("Enter a valid email address", 400, "invalid_email");
  }
  return email;
}

export function validateDomain(domain: unknown): string {
  if (typeof domain !== "string") fail("Domain is required", 400, "invalid_domain");
  const value = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!DOMAIN_RE.test(value)) fail("Enter a valid domain name, for example myapp.com", 400, "invalid_domain");
  return value;
}

export function validateTableName(name: unknown): string {
  if (typeof name !== "string" || !/^[A-Za-z0-9_-]{1,48}$/.test(name)) {
    fail("Table names must be 1-48 characters using letters, numbers, hyphens and underscores", 400, "invalid_table");
  }
  return name;
}

export function validateRoleName(name: unknown): string {
  if (typeof name !== "string" || !/^[A-Za-z0-9 _-]{2,32}$/.test(name)) {
    fail("Role names must be 2-32 characters", 400, "invalid_role");
  }
  return name.trim();
}

export function validateUrl(url: unknown, allowedProtocols = ["https:", "http:"]): string {
  if (typeof url !== "string" || !url.trim()) fail("A URL is required", 400, "invalid_url");
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    fail("Enter a valid absolute URL including the scheme", 400, "invalid_url");
  }
  if (!allowedProtocols.includes(parsed.protocol)) {
    fail(`Only ${allowedProtocols.join(", ")} URLs are supported`, 400, "invalid_url");
  }
  return parsed.toString();
}

/** Normalises a route path definition to a leading-slash path. */
export function validateRoutePath(path: unknown): string {
  if (typeof path !== "string" || !path.trim()) fail("A route path is required", 400, "invalid_path");
  const trimmed = path.trim();
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (/[\s?#]/.test(withSlash)) fail("Route paths may not contain spaces, query strings or fragments", 400, "invalid_path");
  if (withSlash.includes("..")) fail("Path traversal is not allowed", 400, "invalid_path");
  const cleaned = withSlash.replace(/\/{2,}/g, "/");
  if (cleaned.length > 128) fail("Route paths must be 128 characters or fewer", 400, "invalid_path");
  return cleaned.length > 1 && cleaned.endsWith("/") ? cleaned.slice(0, -1) : cleaned;
}
