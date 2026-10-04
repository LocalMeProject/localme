# LocalMe — User Guide

**Version**: 1.0.0  
**Date**: 2026-07-23  
**Status**: Final — End-User Documentation

---

## 1. Welcome to LocalMe

LocalMe is a platform that lets you build and host complete web applications using only frontend files (HTML, CSS, JavaScript). We handle all the backend infrastructure: databases, file storage, authentication, routing, cron jobs, webhooks, and more.

**Who is this for?**
- Developers who want to build MVPs quickly.
- AI agents that generate complete applications.
- Teams who want to avoid backend development.

**What you get:**
- Dynamic subscription tiers (Free, Plus, and Pro) with quotas configured by SuperAdmin.
- Generous project storage plus dedicated shared Library storage.
- A built-in database (JSON-based document store, no migrations required).
- Full Model Context Protocol (MCP) support for autonomous AI coding agents.
- Authentication for your visitors (roles, permissions, rate limits).
- Custom domains with automated SSL provisioning.
- Scheduled tasks (cron jobs) and webhooks for external integrations.

---

## 2. Getting Started

### 2.1 Create Your Account

1. Visit [https://localme.com](https://localme.com).
2. Click **"Sign Up"**.
3. Choose a **username** (unique, 3-32 characters, alphanumeric with underscores).
4. Enter a **password** (minimum 8 characters).
5. Solve the simple math CAPTCHA.
6. Click **"Create Account"**.

You now have a LocalMe account with 2MB of project storage and a 3MB shared Library.

### 2.2 Your First Project

1. Log in to your dashboard at [https://localme.com/dashboard](https://localme.com/dashboard).
2. Click **"New Project"**.
3. Enter a **project name** (3-32 characters, alphanumeric with hyphens).
4. Click **"Create"**.

Your project is instantly created at:
```
https://localme.com/[your-username]/[project-name]/
```

You'll see a default welcome page. This is your project's homepage.

---

## 3. Managing Your Project

### 3.1 Project Dashboard

The dashboard is your command center. From here, you can manage every aspect of your project.

**Navigation:**
- **Storage** — Manage your files (HTML, CSS, JS, images, etc.).
- **Routing** — Define URL paths and what they serve.
- **Database** — Manage your project's data (JSON documents).
- **Auth** — Configure visitor login/signup.
- **Library** — Shared assets across all your projects.
- **Cron** — Schedule automated tasks.
- **Webhooks** — Send events to external services.
- **Domains** — Connect your own domain.
- **Import/Export** — Backup and restore your project.

### 3.2 Code: Your Files

Everything in your project lives under the **Code** tab.

**Upload one or many files:**
1. Open your project → **Code**.
2. Click **"Upload files"** and select as many as you like. Files land in the
   folder you are currently viewing.

**Create and edit a file:**
1. Click **"New file"** and type a project-relative path — `about.html`,
   `css/main.css`, `blog/2019/post.html`. Creating the file also opens it.
2. Edit in the built-in editor and click **Save** (or press the editor's save
   shortcut). The editor only opens text formats; a binary file shows a download
   and rename control instead.

**Organising:**
- The breadcrumb at the top navigates folders; click any segment to jump back.
- The **filter** box narrows the current folder, and **Sort** switches between
  name, size and last modified.
- Tick rows to select several at once — the toolbar then appears with
  **Delete *n***.
- The pencil icon on a row renames or moves it to another folder (typing a new
  folder creates it).
- Deleting a folder removes everything inside it, and the confirmation says so.

**Maximum file size:** 10MB per file (see the `storage.max_upload_size_bytes`
system config).

**Referencing your own files:** use paths **relative to your project root** —
`static/app.css`, not `/static/app.css`. The platform pins a `<base>` on every
page it serves, so a relative path resolves to
`/{you}/{project}/static/app.css` no matter which URL the page was opened at,
including routed paths. An absolute `/static/app.css` points at the platform
root and will 404.

### 3.3 Routing: Defining URLs

Routing connects URL paths to your HTML files.

**Default routes:**
- `/` → `index.html` (your homepage)
- `/404` → `404.html` (custom error page, if uploaded)

**Add a custom route:**
1. Go to **Routing**.
2. Enter a **path** (e.g., `/about`, `/dashboard`, `/products`).
3. Pick the **target file** from the suggestions. The field lists every file in
   the project and warns you if the one you typed does not exist — which is the
   usual reason a saved route returns 404.
4. Choose **authorization rules**:
   - **Public** — anyone can view.
   - **Requires visitor auth** — only signed-in visitors, optionally narrowed to
     a role or a single permission.
5. Click **"Save route"**. Saving an existing path updates it rather than
   creating a duplicate.
6. **"Test this path"** opens it in a new tab.

Proxy routes forward a path to an external service instead of a file; enter the
upstream URL and the platform forwards the request.

The table lists every route with a live **open** link, its auth requirements, and
a **missing** badge if its target file has been deleted. Tick rows to export,
copy from another project, or delete several at once.

### 3.4 Database: Storing Data

LocalMe provides a JSON-based database for your project. No schemas, no migrations — just store data as JSON documents.

**Create a table:**
1. Go to **Database**.
2. Click **"New Table"**.
3. Enter a table name (e.g., `users`, `products`, `orders`).
4. Click **"Create"**.

**Insert a document:**
1. Select your table.
2. Click **"Insert"**.
3. Enter JSON data:
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30
}
```
4. Click **"Save"**.

**Browse and search records:**
1. Open your project → **Database**. Your tables appear as tabs with row counts.
2. The search box matches text in **any** field, not just a named one.
3. **Sort** switches between created, updated and id; the arrow next to it flips
   ascending/descending. Sorting happens in the database, so it stays correct
   across pages.
4. Long tables are paged — change rows-per-page at the bottom.

**Read one record in full:**
Click any row's summary text to open it. Scalars are laid out as a readable
list (long strings wrap instead of being cut off) and nested objects and arrays
render as an indented tree with field counts, so a record is actually legible
rather than a wall of JSON. **Copy JSON** gives you the raw document; **Delete**
removes it.

**Supported operators** (for the API and the Query panel):
- `$eq` — equal
- `$ne` — not equal
- `$gt` — greater than
- `$gte` — greater or equal
- `$lt` — less than
- `$lte` — less or equal
- `$in` — in array
- `$nin` — not in array
- `$regex` — regular expression against one field
- `$text` — substring match anywhere in the document
- `$exists` — field exists
- `$and`, `$or`, `$not` — logical operators

Sorts accept `_localme.created` and `_localme.updated` (or `created_at` /
`updated_at`), which order by the real columns rather than a JSON path.

### 3.5 Library: Shared Assets

The Library is a CDN for the assets every one of your projects shares. Upload a file once and it gets one stable public URL under `/{you}/library/`; every project references that same URL. Nothing is copied between projects, and there is no "which project should hold this?" decision to make.

Every account gets 3MB for it, a separate ceiling from your 2MB of project files — publishing an asset there does not eat into your project budget, and vice versa.

**Publish an asset:**
1. Click **Library** in the top navigation.
2. **Choose files**, or **Upload a folder** to publish a directory tree with its
   structure intact.
3. Any file type works except `.html` and `.htm` — library files are served from
   the platform's own domain, so allowing HTML there would let an uploaded page
   run scripts inside your console session.
4. Click an asset's URL to copy it, or the copy icon beside the base URL to grab
   the prefix every asset shares.

**Referencing a library asset:**

```html
<!-- absolute: the public URL, works from anywhere -->
<link rel="stylesheet" href="/ada/library/bootstrap.css">
<script src="/ada/library/app.js"></script>

<!-- or, from inside a project: `library` is a reserved folder name, so this
     relative reference resolves to your library — and still works on a
     verified custom domain, where an absolute path would not -->
<link rel="stylesheet" href="library/bootstrap.css">
```

**Library rules:**
- HTML files cannot be stored in the library.
- All other file types are allowed (CSS, JS, fonts, images).
- One copy of each asset, reachable from every project you own.
- `library` is reserved: you cannot create a project with that name, nor a
  `library/` folder inside a project. It is where shared assets live.
- Library assets do not count against your project's visit quota.

### 3.6 Authentication: Managing Visitors

Control who can access your project and what they can do.

Everything about who can reach your project and what they can do lives under the
**Access** tab: visitors, roles, API keys and webhooks.

**Define roles:**
1. Open your project → **Access**. The role panel sits under the visitor list.
2. Type a name (e.g. `Editor`, `Viewer`, `Manager`) and click **Add role**. A new
   role starts with no permissions.
3. Click the **⋯** menu on the role's row → **Edit name & permissions** to rename
   it or toggle permissions. Each permission is a chip; click to add or remove.
   The catalogue includes `db_read`, `db_write`, `storage_read`, `storage_write`,
   `lib_read`, `lib_write`, `analytics_read`, `secrets_admin` and the rest.
4. The **Visitors** column shows how many accounts currently hold each role.

**Delete a role — and decide what happens to its visitors:**
1. **⋯** on the row → **Delete role…**
2. Choose one of three:
   - **Keep them, without a role** — they still sign in and still match routes
     that require no particular role. This is the default.
   - **Move them to another role** — pick the replacement; they inherit its
     permissions immediately.
   - **Delete those visitors** — removes the accounts and their password hashes.
     Cannot be undone.
3. Confirm. The toast reports exactly how many visitors were kept, moved or
   removed.

**Assign roles to visitors:**
1. When creating a visitor, pick the role in the form above the table.
2. To change an existing visitor's role, use the **role dropdown** on their row.
   It takes effect immediately — no need to delete and recreate the account.
3. Tick several visitors to export, import, copy from another project, or delete
   them in one action.

**Add visitors from another project:**
**Transfer controls → "Add from project…"** copies the visitors you have selected
into this project. Existing usernames are updated, and **any role the
destination does not have yet is created automatically** from the source
project's permissions — so copying a visitor whose role lives only in the other
project just works.

**Custom login page:**
1. Upload a `login.html` file to your project root.
2. It will automatically replace the default login page.
3. Use the provided instructions (in the Access section) for building a custom
   login page.

### 3.7 Cron Jobs: Scheduled Tasks

Cron jobs run automated tasks on a schedule. We provide 5 built-in tasks.

**Available jobs:**
| Job | Description |
| :--- | :--- |
| **Clean Expired Sessions** | Removes old visitor sessions. |
| **Clean Old Logs** | Deletes visit logs older than retention period. |
| **Generate Daily Stats** | Aggregates daily visit statistics. |
| **Send Daily Summary** | Sends a summary via webhook. |
| **Clean Orphaned Uploads** | Removes temporary upload files. |

**Configure a cron job:**
1. Go to **Cron**.
2. Find the job you want to configure.
3. Toggle **"Enable"**.
4. Set parameters (if any):
   - `retention_days` (for session cleanup): default 7 days.
   - `webhook_id` (for daily summary): select a webhook.
5. Click **"Save"**.

**View job history:**
- Each job shows its last run time and status.
- Click **"View Logs"** for detailed execution logs.

### 3.8 Webhooks: External Notifications

Webhooks send HTTP requests to external services when events occur in your project.

**Create a webhook:**
1. Go to **Webhooks**.
2. Click **"Add Webhook"**.
3. Enter a **URL** (e.g., `https://myapp.com/webhook`).
4. Optionally, add a **secret** for HMAC verification.
5. Select **events**:
   - `project.created`
   - `project.updated`
   - `project.deleted`
   - `user.login`
   - `user.signup`
   - `storage.cap_exceeded`
   - `cron.started`
   - `cron.completed`
   - `cron.failed`
6. Click **"Save"**.

**Test a webhook:**
1. Find your webhook in the list.
2. Click **"Test"**.
3. A test payload is sent to your URL.
4. The response is displayed (status, body).

**Webhook payload:**
```json
{
  "event": "user.login",
  "timestamp": "2026-07-23T12:00:00Z",
  "project_id": 123,
  "data": {
    "username": "john_doe",
    "role": "Member"
  }
}
```

### 3.9 Domains: Your Own URL

Connect your own domain (e.g., `mycoolapp.com`) to your LocalMe project.

**Add a domain:**
1. Go to **Domains**.
2. Click **"Add Domain"**.
3. Enter your domain (e.g., `mycoolapp.com`).
4. Click **"Add"**.
5. A verification token is generated: `mvp-verify=abc123def`.

**Verify your domain:**
1. Go to your DNS provider (Cloudflare, GoDaddy, Namecheap, etc.).
2. Add a TXT record:
   - **Name**: `_mvp-verify` (or the full hostname)
   - **Value**: `abc123def` (your token)
3. Wait a few minutes for DNS propagation.
4. Return to LocalMe and click **"Verify"**.

**Get SSL certificate:**
- Once verified, we automatically provision a Let's Encrypt SSL certificate for your domain.
- This may take a few minutes.
- Your domain will now serve your project with HTTPS.

**DNS requirements:**
- You must have a DNS provider (Cloudflare, GoDaddy, Namecheap, etc.).
- Add an A record pointing to our server IP (provided in the Domains section).
- Or use CNAME if you're using a subdomain.

### 3.10 Import/Export: Backup & Restore

Export and import live **on the tab they belong to**, not in a separate screen —
so what you are exporting is the thing you are looking at. The transfer controls
sit in the header of the **Routing**, **Access** (roles and visitors) and
**Secrets** tabs.

**Export:**
- With rows selected, **Export *n*** writes exactly those. With nothing selected
  it exports everything of that kind in the project.
- The file is JSON and downloads straight to your browser.

**Import:**
1. Click **Import**, paste the JSON, and choose a mode:
   - **Merge** — upserts the items sent, leaves everything else untouched.
   - **Replace** — deletes the existing rows first.
2. Click **Import**.

**"Add from project…"** copies rows straight out of another project you own, so
you do not have to export and re-import by hand. With rows selected it copies
only those; otherwise it copies the whole set. Anything the destination is
missing is created — including **roles**, which are auto-created from the source
project's permissions.

Password hashes and secret values are **never** transferred. An imported visitor
therefore arrives disabled until you set a new password, and an imported secret
name arrives empty. That is deliberate: a shared export file should not be a
working credential.

**Full project backup** is still available from **Settings → Backup**:
- `Files only (.zip)` — every file in the project.
- `Full export (.zip)` — files, library, configuration, and secrets **in clear
  text**. Treat that archive like a password.

---

## 4. Building Your Application

### 4.1 Your Frontend Code

Write your HTML, CSS, and JavaScript files and upload them to the Storage section.

**Example: Index page**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <div id="app">
    <h1>Welcome to My App</h1>
    <button onclick="fetchUsers()">Load Users</button>
    <div id="users"></div>
  </div>
  <script src="/static/app.js"></script>
</body>
</html>
```

**Example: JavaScript API calls**
```javascript
// api.js
async function callAPI(endpoint, data) {
  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include' // sends session cookies
  });
  return response.json();
}

// Fetch users
async function fetchUsers() {
  const users = await callAPI('db/find', {
    table: 'users',
    filter: { active: true }
  });
  document.getElementById('users').innerHTML = users.data.map(u =>
    `<div>${u.name} - ${u.email}</div>`
  ).join('');
}
```

### 4.2 Using the Database

**Insert a record:**
```javascript
const result = await callAPI('db/insert', {
  table: 'users',
  document: {
    id: Date.now(),
    name: 'Jane Doe',
    email: 'jane@example.com',
    created: new Date().toISOString()
  }
});
```

**Query records:**
```javascript
const result = await callAPI('db/find', {
  table: 'users',
  filter: { age: { '$gt': 18 } },
  sort: { name: 1 },
  limit: 50,
  offset: 0
});
```

**Update records:**
```javascript
const result = await callAPI('db/update', {
  table: 'users',
  filter: { id: 1 },
  update: { age: 31 }
});
```

**Delete records:**
```javascript
const result = await callAPI('db/delete', {
  table: 'users',
  filter: { id: 1 }
});
```

### 4.3 Authentication (Visitors)

**Login form:**
```html
<form id="loginForm">
  <input type="text" id="username" placeholder="Username" required>
  <input type="password" id="password" placeholder="Password" required>
  <button type="submit">Login</button>
</form>

<script>
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const response = await fetch('/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        captcha: document.getElementById('captchaInput').value,
        returnUrl: window.location.pathname
      })
    });
    if (response.ok) {
      const data = await response.json();
      document.cookie = `auth_${data.projectId}=${data.token}; path=/; secure`;
      window.location.reload();
    }
  });
</script>
```

**Check if visitor is logged in:**
```javascript
// Check if the auth cookie exists
const hasAuthCookie = document.cookie.split(';').some(c =>
  c.trim().startsWith('auth_')
);
if (!hasAuthCookie) {
  window.location.href = '/auth/login?returnUrl=' + window.location.pathname;
}
```

### 4.4 Using the Proxy Service

**Configure a proxy route:**
1. Go to **Routing**.
2. Add a route:
   - **Path**: `/api/stripe/create-payment`
   - **Target**: (leave empty)
   - **Proxy**: **Enabled**
3. Configure proxy:
   - **Target URL**: `https://api.stripe.com/v1/payment_intents`
   - **Method**: `POST`
   - **Headers**: `Authorization: Bearer {{SECRET_STRIPE_KEY}}`
4. Set authorization rules (recommended: Admin only).
5. Click **"Save"**.

**Store a secret:**
1. Go to **Secrets**.
2. Click **"Add Secret"**.
3. **Key**: `STRIPE_KEY`
4. **Value**: `sk_live_123456789`
5. Click **"Save"**.

**Call the proxy from frontend:**
```javascript
const response = await fetch('/api/stripe/create-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: 1000, currency: 'usd' })
});
const payment = await response.json();
```

### 4.5 Using API Keys (For AI Agents)

**Generate an API key:**
1. Go to **Auth** → **API Keys**.
2. Click **"Generate Key"**.
3. Select a role (e.g., `Admin`).
4. Click **"Generate"**.
5. Copy the key immediately (it won't be shown again).

**Use the API key:**
- Include it in the `X-API-Key` header:
```javascript
const response = await fetch('/api/storage/upload', {
  method: 'POST',
  headers: {
    'X-API-Key': 'sk_abc123def456'
  },
  body: formData
});
```

**API key capabilities:**
- Get storage status.
- List files.
- Upload files.
- Delete files.
- (No database or auth operations)

---

## 5. Billing & Usage

### 5.1 Free Tier
- **Storage**: 2MB across all your projects, plus 3MB for the shared Library.
- **Visits**: 100 free visits per project per month.
- **Features**: All features included (database, auth, cron, webhooks, domains).

### 5.2 Storage Overages
If you exceed your storage cap:
- You'll see a `402 Payment Required` warning when uploading files.
- Purchase additional storage blocks from the dashboard.
- Admin sets pricing for storage blocks.

### 5.3 Visit Counting
- **Counts**: Serving an HTML page via any route.
- **Doesn't count**: CSS, JS, images, 404s, 403s.
- **Deduplication**: Refresh within 5 minutes doesn't count as a new visit.
- **Reset**: Free visits reset on the 1st of each month.

### 5.4 Monitoring Usage
Go to **Dashboard** → **Usage**:
- Used storage.
- Used visits this month.
- Remaining free visits.
- Billing history.

---

## 6. Best Practices

### 6.1 Storage Management
- Move shared assets to the Library.
- Use CDN links for popular libraries (Bootstrap, React, etc.) instead of uploading them.
- Delete old files you no longer need.

### 6.2 Performance
- Minify your HTML, CSS, and JS files (we do it automatically when you save in the editor).
- Compress images before uploading.
- Use caching headers for static assets.

### 6.3 Security
- Use the proxy service for external API calls (don't expose secrets).
- Set appropriate roles and permissions for visitors.
- Use HTTPS (we handle SSL automatically).
- Regularly export backups of your project.

### 6.4 Development Workflow
1. Develop locally or use the built-in editor.
2. Test in your project's preview URL.
3. Use the Routing section to map paths.
4. Use the Database section to manage data.
5. Deploy to production (just publish your changes).

---

## 7. Troubleshooting

### 7.1 Common Issues

**"Storage cap exceeded"**
- Delete unnecessary files.
- Move assets to the Library (it has its own 3MB).
- Purchase additional storage.

**"402 Payment Required" on visits**
- Wait for the monthly reset (1st of the month).
- Purchase additional visits.

**"404 Not Found" on a route**
- Check that the target HTML file exists in storage.
- Verify the route path is correct.
- Ensure the file has the correct extension (.html).

**"403 Forbidden" on a page**
- Check the route's authorization rules.
- Ensure the visitor is logged in.
- Verify the visitor has the required role.

**"Rate limit exceeded" (429)**
- Slow down your API calls.
- Use the proxy service to reduce client-side API calls.

**Custom domain not working**
- Wait for DNS propagation (up to 48 hours).
- Verify the TXT record was added correctly.
- Check that an A record points to our server IP.

### 7.2 Getting Help

- **Documentation**: [https://docs.localme.com](https://docs.localme.com)
- **Community Forum**: [https://community.localme.com](https://community.localme.com)
- **Support**: [mailto:support@localme.com](mailto:support@localme.com)

---

## 8. Glossary

| Term | Definition |
| :--- | :--- |
| **Project** | A web application hosted on LocalMe. Has its own URL, storage, and configuration. |
| **Visitor** | Someone who visits your project (not a LocalMe account holder). |
| **Role** | A set of permissions that defines what a visitor can do. |
| **Route** | A URL path that serves a specific HTML file. |
| **Library** | Shared storage for assets across all your projects. |
| **Cron Job** | A scheduled task that runs automatically. |
| **Webhook** | An HTTP request sent to an external service when an event occurs. |
| **Proxy** | A route that forwards requests to an external API. |
| **Secret** | An encrypted environment variable (API key, token, etc.). |
| **API Key** | A key for automated access (Personal Access Token). |
| **AAT** | Agent Access Token — ephemeral token requested by AI agents with human consent. |
| **MCP** | Model Context Protocol — standardized protocol for AI agent integration. |

---

## 9. Quick Reference

### 9.1 Common URLs
```
Dashboard:        https://localme.ir/dashboard
Profile:          https://localme.ir/profile
Library:          https://localme.ir/dashboard/library
Admin console:    https://localme.ir/admin        (operators and admins)
API docs:         https://localme.ir/docs
Agent Skill:      https://localme.ir/skills/localme/SKILL.md
Your Project:     https://localme.ir/[username]/[projectname]/
Visitor login:    https://localme.ir/[username]/[projectname]/auth/login
Logout:           https://localme.ir/auth/logout
Health probe:     https://localme.ir/health
```

### 9.2 API Endpoints
```
MCP Server:       /api/mcp (JSON-RPC 2.0)
Agent Tokens:     /api/agent/request-aat, /api/agent/poll-aat, /api/agent/check
Database:         /api/db/find, /api/db/insert, /api/db/update, /api/db/delete
Storage:          /api/storage/list, /api/storage/upload, /api/storage/download,
                  /api/storage/delete, /api/storage/move, /api/storage/status
Library:          /api/library, /api/library/upload, /api/library/delete
Roles:            /api/roles, /api/roles/[roleId]
Secrets:          /api/secrets, /api/secrets/get
Transfer:         /api/transfer
Proxy:            /api/proxy/[your-route]
```

### 9.3 File Structure Tips
```
/project-root/
├── index.html          ← Your homepage
├── 404.html            ← Custom 404 page (optional)
├── login.html          ← Custom login page (optional)
├── manifest.json       ← PWA manifest (optional)
├── sw.js               ← Service worker (optional)
├── static/             ← All your assets
│   ├── style.css
│   ├── app.js
│   └── images/
└── ... (other files/folders)
```

---

**You're now ready to build your application on LocalMe!**

*Happy building!*

*Document generated on 2026-07-23; updated 2026-10-01 for the redesigned
Access, Code, Database and Routing tabs, the per-account Library, and the new
storage allowances (2 MB project files + 3 MB library).*