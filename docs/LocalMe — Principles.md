# LocalMe — Principles

**Document Type**: Immutable Foundation  
**Date**: 2026-07-23  
**Version**: 1.0.0  
**Status**: Permanent — Never to be revised without explicit, formal governance review.

---

## 1. Purpose

This document defines the **non‑negotiable principles** upon which the LocalMe platform is built. These principles transcend individual versions, features, or implementation details. They are the architectural, security, and operational invariants that must be upheld in every release, every configuration, and every deployment. No other document — blueprint, technical spec, or user guide — may contradict or dilute these rules.

---

## 2. Core Philosophy

**P‑1. Frontend‑Only Applications**  
The platform executes **no user‑supplied server‑side code**. All application logic runs in the browser (HTML, CSS, JavaScript). The platform provides backend services exclusively through well‑defined REST APIs.

**P‑2. Platform as Opaque Backend**  
Users and AI agents interact only with the documented HTTP API and the dashboard. There is no direct filesystem access, no raw database connection, and no server‑side scripting.

**P‑3. Stateless Request Handling**  
Every API request is **self‑contained** and authenticated via session tokens or API keys. The backend does not rely on in‑memory state shared between requests, except for short‑lived caches that can be rebuilt at any time.

---

## 3. Architectural Invariants

**P‑4. Single‑Server Deployment**  
The platform runs on **one server**. Horizontal scaling is not a design goal. All components — web server, application, database — coexist on the same machine.

**P‑5. Modular Service Design**  
All backend capabilities are exposed through **decoupled service interfaces** (e.g., `IDatabaseService`, `IStorageProvider`). Each service has a single, well‑defined responsibility and is registered via dependency injection. Implementations may change, but the interfaces and their contracts remain stable.

**P‑6. Database as Single Source of Truth**  
All persistent state — user accounts, sessions, rate limits, project data, configurations, and secrets — is stored in **PostgreSQL**. No other data store is used.

**P‑7. JSON Document Store with Mandatory Identity**  
Every document stored in the database must contain a **non‑null, unique `id` field**. The schema is otherwise open, but the absence of an `id` is rejected. This guarantees reliable retrieval, updates, and referential integrity.

**P‑8. File Storage on Local Disk**  
User files are stored on the **local filesystem** under `/var/localme/storage/`. No external blob storage (S3, etc.) is used. All file operations are atomic (write‑to‑temp then rename).

---

## 4. Security Principles

**P‑9. CSRF Protection on All Mutating Requests**  
Every `POST`, `PUT`, `PATCH`, and `DELETE` request must include a **valid CSRF token** in the `X-XSRF-TOKEN` header. The token is tied to the session and validated on every mutating call. No exception.

**P‑10. Open Redirect Prevention**  
The `returnUrl` parameter — used in login, signup, and logout flows — is **strictly validated** to ensure it points to a relative path or a domain owned by the same project. Absolute external URLs are rejected.

**P‑11. Secrets Never Leave the Server**  
Secrets (API keys, tokens, passwords for external services) are encrypted at rest (AES‑256‑GCM) and are **never exposed** to the client, except for the full ZIP export where the user is explicitly warned and the export is treated as a high‑security artefact.

**P‑12. API Keys Are Storage‑Only**  
API keys grant access **exclusively to storage and library endpoints**. They cannot be used to query the database, manage authentication, or invoke any other service. This boundary is enforced by the authorization middleware.

**P‑13. Password Hashing**  
All passwords — platform users and project visitors — are hashed using **bcrypt** (work factor ≥ 12). No other hash algorithm is used.

**P‑14. Asset Hotlinking Protection**  
Requests to `/static/*` and `/library/*` are validated against a **referer allowlist** that includes `localme.com`, the project’s custom domains (if any), and an empty referer (direct requests). Unknown referers are blocked with `403 Forbidden`.

**P‑15. Path Traversal Prevention**  
All file paths provided by users are sanitised to reject `..`, absolute paths, and any attempt to escape the project’s storage root.

**P‑16. Rate Limiting Is Always On**  
Every endpoint is protected by a **sliding‑window rate limiter** backed by the database. Limits are defined per user type (anonymous, authenticated, admin, API key) and may never be disabled globally.

---

## 5. Authentication & Authorization

**P‑17. Visitor Authentication Is Per‑Project**  
Visitor accounts exist within the scope of a single project. Credentials are stored separately, and cookies are scoped to the project’s URL path (`/{username}/{projectname}/`).

**P‑18. Role‑Based Access Control**  
Access to all protected resources is governed by **roles and permissions**. Every visitor has exactly one role (pre‑defined or custom), and the server enforces permissions on every request.

**P‑19. Session Sliding Expiration**  
Authenticated sessions expire after **20 minutes of inactivity**. Any authenticated request extends the expiry.

---

## 6. Cron & Automation

**P‑20. Pre‑Defined Cron Tasks Only**  
The platform provides a **fixed set of built‑in cron jobs**. Users may enable, disable, or configure them, but they **cannot upload custom server‑side scheduled code**. The execution of user JavaScript (e.g., via headless browser) is explicitly forbidden.

**P‑21. Webhooks Are Fire‑and‑Forget**  
Webhook deliveries are attempted once. There is **no automatic retry**. Delivery status is logged for the user’s inspection.

---

## 7. Frontend & Static Assets

**P‑22. Only HTML Files Are Routable**  
Custom routes may only target **HTML files**. CSS, JavaScript, images, and other assets are served directly from the filesystem at their storage paths and do not participate in the routing engine.

**P‑23. Watermark Injection**  
A platform watermark is injected into every HTML response **unless** the route or project explicitly opts out (via configuration or query parameter). The watermark must be unobtrusive but visible.

**P‑24. Self‑Hosted Development Tools**  
All tools required for the in‑browser code editor (Monaco, Prettier, ESLint) are **self‑hosted** within the platform’s static assets. No dependency on external CDNs is allowed for core editor functionality.

**P‑25. Accept‑Encoding Respect**  
Compressed files (Brotli) are served only if the client’s `Accept‑Encoding` header includes `br`. A Gzip or uncompressed fallback **must** be available.

---

## 8. Data Limits & Performance

**P‑26. Maximum Upload Size**  
No single file upload may exceed **10 MB**. This limit is enforced at the API gateway and in the storage service.

**P‑27. Database Query Result Limit**  
The Database Service returns at most **500 documents** per query. Pagination parameters (`limit`/`offset`) must be used for larger datasets.

**P‑28. Storage Cap Enforcement**  
Every user has a defined storage quota (default 5 MB + 5 MB library bonus). Any operation that would exceed the cap is **rejected before any data is written**.

---

## 9. Operational & Compliance

**P‑29. All Configuration Is Database‑Backed**  
System configuration values are stored in the `system_configs` table. No critical behaviour is controlled by environment variables alone; environment variables are used only for bootstrapping (connection strings, master encryption key).

**P‑30. Backup Exports Contain Clear‑Text Secrets**  
The full ZIP export includes a `config/secrets.json` file with **unencrypted secrets**. The user must be warned, and the platform must never automatically send this file over an insecure channel.

**P‑31. No Silent Data Deletion**  
Project deletion removes all associated files and database records **recursively and permanently**. The operation is confirmed and logged, but there is no trash‑can recovery. This behaviour is made explicit to the user.

---

## 10. Documentation & Change Control

**P‑32. Blueprint Is the Master Specification**  
The Enterprise Blueprint is the **single source of truth** for the entire platform. Any feature addition, modification, or removal must be reflected in the Blueprint before any code is written.

**P‑33. API Backward Compatibility**  
Once an API endpoint is publicly documented and released, it **cannot be removed or have its request/response contract changed in a breaking way** without a formal deprecation period and versioning.

---

**These 33 principles are permanent, non‑negotiable, and override any conflicting statement in other LocalMe documents. They ensure the platform remains secure, predictable, and true to its core mission.**

*Document generated on 2026-07-23. This version is final and will not be updated unless a formal governance review explicitly approves a revision.*