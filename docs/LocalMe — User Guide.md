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
- 5MB storage per user account.
- 100 free visits per project per month.
- A built-in database (JSON-based, no migrations).
- Authentication for your visitors.
- Custom domains (SSL included).
- Scheduled tasks (cron jobs).
- Webhooks for external integrations.

---

## 2. Getting Started

### 2.1 Create Your Account

1. Visit [https://localme.com](https://localme.com).
2. Click **"Sign Up"**.
3. Choose a **username** (unique, 3-32 characters, alphanumeric with underscores).
4. Enter a **password** (minimum 8 characters).
5. Solve the simple math CAPTCHA.
6. Click **"Create Account"**.

You now have a LocalMe account with 5MB of storage.

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

### 3.2 Storage: Uploading Files

**Upload a file:**
1. Go to **Storage** → **Files**.
2. Click **"Upload"**.
3. Select a file from your computer.
4. The file will appear in the list.

**Create a file:**
1. Click **"New File"**.
2. Enter a filename (e.g., `about.html`).
3. Write your code in the built-in editor.
4. Click **"Save"**.

**Organize files:**
- Use folders to keep things tidy.
- Drag and drop to move files.
- Right-click for options (rename, delete, move to library).

**Maximum file size:** 10MB per file.

### 3.3 Routing: Defining URLs

Routing connects URL paths to your HTML files.

**Default routes:**
- `/` → `index.html` (your homepage)
- `/404` → `404.html` (custom error page, if uploaded)

**Add a custom route:**
1. Go to **Routing**.
2. Click **"Add Route"**.
3. Enter a **path** (e.g., `/about`, `/dashboard`, `/products`).
4. Select the **target file** (e.g., `about.html`).
5. Choose **authorization rules**:
   - **Public** — anyone can view.
   - **Logged In** — only authenticated visitors.
   - **Role: X** — visitors with a specific role (e.g., Admin).
6. Click **"Save"**.

Your route is now live at `https://localme.com/[username]/[project]/[path]`.

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

**Query data:**
1. Go to **"Query"**.
2. Enter a filter (MongoDB-style):
```json
{
  "age": { "$gt": 18 },
  "active": true
}
```
3. Click **"Run"**.
4. Results appear below.

**Supported operators:**
- `$eq` — equal
- `$ne` — not equal
- `$gt` — greater than
- `$gte` — greater or equal
- `$lt` — less than
- `$lte` — less or equal
- `$in` — in array
- `$nin` — not in array
- `$regex` — regular expression
- `$exists` — field exists
- `$and`, `$or`, `$not` — logical operators

### 3.5 Library: Shared Assets

The Library is a special storage area for assets you want to use across all your projects. You get 5MB of free library storage.

**Move a file to the Library:**
1. Go to **Storage**.
2. Find the file you want to share.
3. Click **"Move to Library"**.
4. The file moves to your library.

**Use a library file in a project:**
- Reference it using `/library/[filename]`:
```html
<link rel="stylesheet" href="/library/bootstrap.css">
<script src="/library/app.js"></script>
```

**Library rules:**
- HTML files cannot be stored in the library.
- All other file types are allowed (CSS, JS, fonts, images).
- Files are accessible across all your projects.

### 3.6 Authentication: Managing Visitors

Control who can access your project and what they can do.

**Enable visitor login:**
1. Go to **Auth**.
2. Toggle **"Enable Visitor Login"**.
3. Visitors can now sign up and log in.

**Define roles:**
1. Go to **Auth** → **Roles**.
2. Click **"Add Role"**.
3. Enter a role name (e.g., `Editor`, `Viewer`, `Manager`).
4. Set permissions:
   - `db_read` — can read database data.
   - `db_write` — can insert/update/delete data.
   - `storage_read` — can download files.
   - `storage_write` — can upload/delete files.
   - `lib_read` — can read library assets.
   - `lib_write` — can upload to library.
5. Click **"Save"**.

**Assign roles to visitors:**
1. Go to **Auth** → **Visitors**.
2. Find a visitor.
3. Select a role from the dropdown.
4. Click **"Update"**.

**Custom login page:**
1. Upload a `login.html` file to your project root.
2. It will automatically replace the default login page.
3. Use the provided instructions (in the Auth section) for building a custom login page.

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

**Export your project:**
1. Go to **Import/Export**.
2. Select what to export:
   - **Routes** — routing configuration.
   - **API Endpoints** — API settings.
   - **Roles** — role definitions.
   - **Secrets** — environment variables (names only).
   - **Cron** — cron job configurations.
   - **Webhooks** — webhook configurations.
   - **DNS** — domain settings.
   - **Auth** — authentication settings.
   - **All** — everything (ZIP file with files + configs).
3. Click **"Export"**.
4. The file downloads automatically.

**Import a configuration:**
1. Go to **Import/Export**.
2. Click **"Import"**.
3. Select a file (JSON or ZIP).
4. Choose **import mode**:
   - **Merge** — adds new items, updates existing.
   - **Replace** — overwrites everything.
5. Click **"Upload"**.

**What's included in "All" export:**
- `lib/` — all your library files.
- `storage/` — all your project files.
- `config/secrets.json` — secrets in clear text.
- `config/config.json` — all other configurations.

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
- **Storage**: 5MB total (across all projects + library).
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
- Move assets to the Library (5MB bonus storage).
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
| **API Key** | A key for automated access (used by AI agents). |

---

## 9. Quick Reference

### 9.1 Common URLs
```
Dashboard:        https://localme.com/dashboard
Your Project:     https://localme.com/[username]/[projectname]/
Login:            https://localme.com/auth/login
Logout:           https://localme.com/auth/logout
```

### 9.2 API Endpoints
```
Database:         /api/db/find, /api/db/insert, /api/db/update, /api/db/delete
Storage:          /api/storage/list, /api/storage/upload, /api/storage/download, /api/storage/delete
Library:          /api/lib/list, /api/lib/upload, /api/lib/delete
Secrets:          /api/secrets/get
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

*Document generated on 2026-07-23.*