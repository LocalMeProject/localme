# LocalMe — Usage Guide for LLMs & Developers

**Version**: 1.0.0  
**Date**: 2026-07-23  
**Status**: Final — Project Implementation Reference

---

## 1. Introduction

This guide is for **AI agents (LLMs)** and developers who want to build a complete, functional application on the LocalMe platform using **only frontend code** (HTML, CSS, JavaScript). LocalMe provides all backend services: a document database, file storage, authentication, routing, cron jobs, webhooks, and more.

**Your task**: generate the frontend assets and project configuration. LocalMe handles everything else.

**Key concept**: You produce static files (`.html`, `.css`, `.js`) and define routes and configurations via the dashboard (or import via JSON). The platform serves these files, runs your JavaScript in the browser, and exposes APIs for data operations.

---

## 2. Project Structure

A LocalMe project is a collection of files and folders in your project storage. You can organize them freely, but here is the recommended structure:

```
/my-project/
├── index.html                # Required – home page
├── 404.html                  # Optional – custom 404 page
├── login.html                # Optional – custom login page (see Auth section)
├── manifest.json             # Optional – PWA manifest
├── sw.js                     # Optional – Service Worker
├── static/                   # Recommended for assets
│   ├── style.css
│   ├── app.js
│   ├── images/
│   └── fonts/
├── api/                      # Your frontend API handlers (optional)
│   ├── users.js              # Can be included as scripts
│   └── products.js
└── ... (any other folders)
```

**Important**:
- `index.html` is required and is served at `/`.
- Any file can be served via a route you define in the Routing section.
- HTML files are the only files that can be routed. Non-HTML files are served as static assets (usually under `/static/` or any path you choose).

---

## 3. Database Service

LocalMe provides a JSON document store for each project. You can store, query, update, and delete documents via REST API calls from your frontend JavaScript.

### 3.1 Creating a Table (Collection)

In the dashboard, go to **Database** → **New Table**. Enter a name (e.g., `users`, `products`). No schema definition is needed.

### 3.2 Inserting Documents

**Endpoint**: `POST /api/db/insert`

**Request body**:
```json
{
  "table": "users",
  "document": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "age": 30,
    "active": true
  }
}
```

**Response**:
```json
{
  "success": true,
  "id": 1
}
```

**JavaScript Example**:
```javascript
async function insertUser(user) {
  const response = await fetch('/api/db/insert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      table: 'users',
      document: user
    })
  });
  return response.json();
}
```

### 3.3 Querying Documents

**Endpoint**: `POST /api/db/find`

**Request body**:
```json
{
  "table": "users",
  "filter": { "age": { "$gt": 18 } },
  "sort": { "name": 1 },
  "limit": 50,
  "offset": 0
}
```

**Supported operators**:
- `$eq` – equality
- `$ne` – not equal
- `$gt`, `$gte`, `$lt`, `$lte` – comparison
- `$in`, `$nin` – array membership
- `$regex` – regular expression (string match)
- `$exists` – field existence
- `$and`, `$or`, `$not` – logical operators

**Response**:
```json
{
  "data": [ /* documents */ ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

**Example**:
```javascript
async function getActiveUsers() {
  const response = await fetch('/api/db/find', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      table: 'users',
      filter: { active: true },
      sort: { name: 1 },
      limit: 100
    })
  });
  const result = await response.json();
  return result.data;
}
```

### 3.4 Updating Documents

**Endpoint**: `POST /api/db/update`

**Request body**:
```json
{
  "table": "users",
  "filter": { "id": 1 },
  "update": { "age": 31 }
}
```

**Response**:
```json
{
  "success": true,
  "modified": 1
}
```

### 3.5 Deleting Documents

**Endpoint**: `POST /api/db/delete`

**Request body**:
```json
{
  "table": "users",
  "filter": { "id": 1 }
}
```

**Response**:
```json
{
  "success": true,
  "deleted": 1
}
```

### 3.6 Best Practices

- Use a unique `id` field for each document (you can use `Date.now()` or a UUID).
- Index frequently queried fields by creating a partial index via the dashboard (Admin only).
- Keep documents small (under 1MB) for performance.
- Use `limit` and `offset` for pagination.

---

## 4. Authentication (Visitor Management)

LocalMe supports per‑project visitor authentication. You can enable login/signup, define roles, and set permissions.

### 4.1 Enabling Authentication

1. In the dashboard, go to **Auth** → **Settings**.
2. Toggle **"Enable Visitor Login"**.
3. Optionally, set the default role for new signups.

### 4.2 Visitor Signup

The built‑in login page includes a **Sign Up** link. When a visitor signs up, they are assigned the default role (e.g., `Member`).

**Custom Signup**: You can implement your own signup form using the same `/auth/token` endpoint (see below) with an `action: "signup"` parameter.

### 4.3 Visitor Login

**Endpoint**: `POST /auth/token`

**Request body** (for login):
```json
{
  "username": "jane",
  "password": "secret",
  "captcha": "12",
  "returnUrl": "/dashboard"
}
```

**Response**:
```json
{
  "success": true,
  "redirectUrl": "/dashboard",
  "projectId": 123,
  "token": "jwt_here"
}
```

**Setting the cookie**:
```javascript
document.cookie = `auth_${data.projectId}=${data.token}; path=/; secure; samesite=lax`;
window.location.href = data.redirectUrl;
```

### 4.4 Checking Authentication Status

You can check if the visitor is logged in by verifying the presence of the cookie `auth_{projectId}`. Alternatively, call a protected API endpoint and handle a `401` response.

### 4.5 Roles and Permissions

**Pre‑defined roles**:
- `Owner` – full control (the project creator)
- `Admin` – can manage other visitors and roles
- `Member` – default logged‑in user
- `Guest` – read‑only (if needed)

**Custom roles**: Create new roles with granular permissions (e.g., `db_read`, `db_write`, `storage_read`, etc.). Assign these roles to visitors via the dashboard.

**Checking permissions in your frontend**: You can embed the role in the HTML or use a helper function that calls `/api/auth/me` (not yet defined, but can be added) or decode the JWT. For simplicity, the server enforces permissions on API calls.

### 4.6 Custom Login Page

Upload a `login.html` file to your project root. It will replace the built‑in page. Use the following template:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login</title>
</head>
<body>
    <form id="loginForm">
        <input type="text" id="username" placeholder="Username" required>
        <input type="password" id="password" placeholder="Password" required>
        <div>
            <img id="captchaImage" src="/auth/captcha" alt="CAPTCHA">
            <input type="text" id="captchaInput" placeholder="Enter CAPTCHA" required>
        </div>
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
                    returnUrl: new URLSearchParams(window.location.search).get('returnUrl') || '/'
                })
            });
            if (response.ok) {
                const data = await response.json();
                document.cookie = `auth_${data.projectId}=${data.token}; path=/; secure; samesite=lax`;
                window.location.href = data.redirectUrl;
            } else {
                // refresh CAPTCHA
                document.getElementById('captchaImage').src = '/auth/captcha?' + Date.now();
                alert('Login failed. Check credentials and CAPTCHA.');
            }
        });
    </script>
</body>
</html>
```

---

## 5. File Storage

You can upload, download, list, and delete files in your project storage.

### 5.1 Uploading a File

**Endpoint**: `POST /api/storage/upload` (multipart/form-data)

**Form fields**:
- `file` – the binary file.
- `path` (optional) – relative directory (e.g., `/static/images/`). Default is root.

**Response**:
```json
{
  "success": true,
  "path": "/static/images/logo.png",
  "size": 12345
}
```

**JavaScript Example**:
```javascript
async function uploadFile(file, path = '/') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', path);
  const response = await fetch('/api/storage/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include'
  });
  return response.json();
}
```

### 5.2 Downloading a File

**Endpoint**: `GET /api/storage/download?path=/static/style.css`

The file is streamed directly. You can use it as a link or open it in a new tab.

**Example HTML**:
```html
<a href="/api/storage/download?path=/static/report.pdf" target="_blank">Download Report</a>
```

### 5.3 Listing Files

**Endpoint**: `GET /api/storage/list?path=/static/`

**Response**:
```json
[
  {
    "name": "style.css",
    "size": 1245,
    "modified": "2026-07-23T12:00:00Z",
    "type": "file"
  },
  {
    "name": "images",
    "size": 0,
    "modified": "...",
    "type": "directory"
  }
]
```

### 5.4 Deleting a File

**Endpoint**: `POST /api/storage/delete`

**Request**:
```json
{ "path": "/static/style.css" }
```

**Response**: `{ "success": true }`

### 5.5 Storage Status

**Endpoint**: `GET /api/storage/status`

**Response**:
```json
{
  "used": 1234567,
  "total": 5242880,
  "files": 42
}
```

---

## 6. Library Service

The Library is a shared storage area accessible across all your projects. You get a bonus 5MB.

### 6.1 Moving a File to Library

From the Storage file manager, click **"Move to Library"** on any file. The file is moved and the new path is returned (e.g., `/library/bootstrap.css`).

### 6.2 Using Library Assets

In your HTML, reference library assets via `/library/{filename}`:

```html
<link rel="stylesheet" href="/library/bootstrap.min.css">
<script src="/library/jquery.min.js"></script>
```

### 6.3 Library API Endpoints

Similar to Storage, but under `/api/lib/`. For example:
- `GET /api/lib/list`
- `POST /api/lib/upload`
- `POST /api/lib/delete`
- `GET /api/lib/status`

**Note**: HTML files are blocked from the Library.

---

## 7. Routing & URL Paths

Routes map URL paths to HTML files or proxy to external APIs.

### 7.1 Defining a Route

In the dashboard, go to **Routing** → **Add Route**.

**Fields**:
- **Path** – e.g., `/dashboard`, `/about`, `/products` (must start with `/`).
- **Target File** – the HTML file to serve (e.g., `dashboard.html`).
- **Requires Auth** – check if visitors must be logged in.
- **Required Role** – optional role restriction.
- **Proxy Mode** – if enabled, the route forwards to an external URL (see Proxy section).

### 7.2 Default Routes

- `/` → `index.html` (fixed).
- `/404` → `404.html` (if exists; otherwise platform's 404).

### 7.3 Reserved Paths

The following paths are reserved by the platform and cannot be overridden:
- `/api/*`
- `/auth/*`
- `/admin/*`
- `/dashboard/*`
- `/library/*`
- `/~public/*`

---

## 8. Proxy Service (External API Forwarding)

Proxy routes allow you to call external APIs without exposing secrets in client‑side code.

### 8.1 Configuring a Proxy Route

When adding/editing a route, enable **Proxy Mode** and fill:

- **Target URL**: The external endpoint (e.g., `https://api.stripe.com/v1/payment_intents`).
- **Method**: `GET`, `POST`, `PUT`, `DELETE`, etc.
- **Headers**: Key‑value pairs. You can reference secrets with `{{SECRET_KEY}}` syntax.
- **Timeout**: Default 30 seconds.

**Example**: Stripe payment proxy
```json
{
  "path": "/api/stripe/create-payment",
  "is_proxy": true,
  "proxy_config": {
    "target": "https://api.stripe.com/v1/payment_intents",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer {{STRIPE_SECRET_KEY}}",
      "Content-Type": "application/json"
    },
    "timeout_seconds": 30
  },
  "requires_auth": true,
  "required_role": "Admin"
}
```

### 8.2 Storing Secrets

In the **Secrets** section of your dashboard, add key‑value pairs (e.g., `STRIPE_SECRET_KEY`). The values are encrypted and never exposed.

### 8.3 Using the Proxy from Frontend

Simply call the route from your frontend JavaScript:

```javascript
const response = await fetch('/api/stripe/create-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: 1000, currency: 'usd' }),
  credentials: 'include'
});
const payment = await response.json();
```

### 8.4 Getting Secrets for Client‑Side Use

If you need a public key (like Stripe Publishable Key) in your frontend, you can store it as a secret and expose it via a dedicated endpoint:

**Endpoint**: `POST /api/secrets/get` (requires admin/owner role)
**Request**: `{ "key": "STRIPE_PUBLISHABLE_KEY" }`
**Response**: `{ "value": "pk_test_..." }`

Use this sparingly and only for non‑sensitive keys.

---

## 9. Built‑in Cron Tasks

LocalMe provides 5 pre‑defined cron jobs that you can enable and configure.

| Task | Description | Parameters |
| :--- | :--- | :--- |
| `CleanExpiredSessions` | Deletes old visitor sessions. | `retention_days` (default 7) |
| `CleanOldLogs` | Deletes visit logs older than retention. | None (uses project's subscription retention). |
| `GenerateDailyStats` | Aggregates daily visit statistics. | None |
| `SendDailySummaryWebhook` | Sends a summary via a selected webhook. | `webhook_id` (choose from configured webhooks). |
| `CleanOrphanedUploads` | Cleans temporary upload files. | None |

**Configuration**:
1. Go to **Cron** in your dashboard.
2. Toggle **Enable** for each job.
3. For `CleanExpiredSessions`, set `retention_days`.
4. For `SendDailySummaryWebhook`, select an existing webhook.
5. The job will run at the scheduled time (default: daily at the specified hour).

**Logs**: Each job's run history is visible in the dashboard.

---

## 10. Webhooks

Webhooks send HTTP POST requests to external URLs when events occur.

### 10.1 Creating a Webhook

1. Go to **Webhooks** → **Add Webhook**.
2. Enter the **URL** (e.g., `https://myapp.com/webhook`).
3. Optionally, set a **Secret** for HMAC signature verification.
4. Select events to trigger the webhook:
   - `project.created`
   - `project.updated`
   - `project.deleted`
   - `user.login`
   - `user.signup`
   - `storage.cap_exceeded`
   - `cron.started`, `cron.completed`, `cron.failed`
5. Click **Save**.

### 10.2 Webhook Payload

```json
{
  "event": "user.login",
  "timestamp": "2026-07-23T12:00:00Z",
  "project_id": 123,
  "data": {
    "username": "jane_doe",
    "role": "Member"
  }
}
```

### 10.3 Manual Testing

Click **"Test"** on any webhook to send a test payload. The response (status, body) is shown.

### 10.4 HMAC Signature

If a secret is provided, the webhook request includes a header `X-Webhook-Signature: HMAC-SHA256(secret, payload)`. Your server can verify this to ensure the request came from LocalMe.

---

## 11. Custom Domains & SSL

Connect your own domain to your project.

### 11.1 Adding a Domain

1. Go to **Domains** → **Add Domain**.
2. Enter your domain (e.g., `myapp.com`).
3. A verification token is generated (e.g., `mvp-verify=abc123`).

### 11.2 Verifying Domain

Add a TXT record to your DNS:
- **Name**: `_mvp-verify`
- **Value**: `abc123`

Then click **"Verify"** in the dashboard.

### 11.3 DNS Configuration

After verification, point your domain to LocalMe's server IP (provided in the Domains section). Use an **A record** for the root domain or **CNAME** for subdomains.

### 11.4 SSL Certificate

Once the domain is verified and DNS is correctly pointed, LocalMe provisions a Let's Encrypt SSL certificate automatically. This may take a few minutes.

Your project will then be accessible at `https://myapp.com`.

---

## 12. Import & Export

Backup or restore your project configurations.

### 12.1 Export

- **Single feature**: Download JSON for routes, roles, secrets (names only), cron, webhooks, DNS, auth.
- **All (ZIP)**: Download a full backup including:
  - `lib/` – all library files.
  - `storage/` – all project files.
  - `config/secrets.json` – clear‑text secrets.
  - `config/config.json` – all other configurations.

### 12.2 Import

Upload a JSON file or ZIP archive. You can choose to **merge** (add/update) or **replace** (overwrite all) existing configurations.

### 12.3 AI Integration

LocalMe provides a public GitHub repository with JSON schemas and example `config.json` files. This allows LLMs to generate valid configurations for projects.

---

## 13. PWA Support

LocalMe supports Progressive Web Apps. You can upload:

- `manifest.json` – PWA manifest.
- `sw.js` – Service Worker file.

They will be served at the root of your project. If you delete `sw.js`, PWA support is disabled.

**Default PWA files** are created automatically on project creation. You can modify them as needed.

---

## 14. Complete Example: A Simple Todo App

Let's build a minimal MVP: a todo list application with user authentication.

### 14.1 Project Structure

```
/todo-app/
├── index.html
├── 404.html
├── login.html
├── static/
│   ├── style.css
│   └── app.js
```

### 14.2 Configuration (via Dashboard)

1. **Enable Authentication** in Auth settings.
2. **Create a Table** named `todos` in Database.
3. **Add a Route** for `/` → `index.html`.
4. **Set up a Webhook** (optional) for `todo.created` event.

### 14.3 HTML (index.html)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Todo App</title>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <div id="app">
    <h1>My Todos</h1>
    <div id="auth-status"></div>
    <form id="todoForm">
      <input type="text" id="todoInput" placeholder="Add a todo...">
      <button type="submit">Add</button>
    </form>
    <ul id="todoList"></ul>
  </div>
  <script src="/static/app.js"></script>
</body>
</html>
```

### 14.4 JavaScript (static/app.js)

```javascript
// Utility function for API calls
async function apiCall(endpoint, data) {
  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return response.json();
}

// Check authentication status
async function checkAuth() {
  const hasAuthCookie = document.cookie.split(';').some(c => c.trim().startsWith('auth_'));
  if (!hasAuthCookie) {
    document.getElementById('auth-status').innerHTML = '<a href="/auth/login?returnUrl=/">Login</a>';
    return false;
  }
  document.getElementById('auth-status').innerHTML = 'Logged in. <a href="/auth/logout?returnUrl=/">Logout</a>';
  return true;
}

// Load todos
async function loadTodos() {
  const result = await apiCall('db/find', {
    table: 'todos',
    filter: { completed: false },
    sort: { created: -1 },
    limit: 100
  });
  const list = document.getElementById('todoList');
  list.innerHTML = '';
  result.data.forEach(todo => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${todo.text}</span>
      <button onclick="completeTodo(${todo.id})">Complete</button>
      <button onclick="deleteTodo(${todo.id})">Delete</button>
    `;
    list.appendChild(li);
  });
}

// Add todo
async function addTodo(text) {
  const result = await apiCall('db/insert', {
    table: 'todos',
    document: {
      id: Date.now(),
      text: text,
      completed: false,
      created: new Date().toISOString()
    }
  });
  if (result.success) {
    loadTodos();
  }
}

// Complete todo
async function completeTodo(id) {
  await apiCall('db/update', {
    table: 'todos',
    filter: { id: id },
    update: { completed: true }
  });
  loadTodos();
}

// Delete todo
async function deleteTodo(id) {
  await apiCall('db/delete', {
    table: 'todos',
    filter: { id: id }
  });
  loadTodos();
}

// Event listeners
document.getElementById('todoForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('todoInput');
  if (input.value.trim()) {
    addTodo(input.value.trim());
    input.value = '';
  }
});

// Init
checkAuth().then(loadTodos);
```

### 14.5 Custom Login Page (login.html)

Use the template from Section 4.6. You can also add a signup link.

### 14.6 Result

Visitors can sign up/log in, then add, complete, and delete todos. All data is stored in the project's database.

---

## 15. API Reference (Quick Summary)

| Endpoint | Method | Description | Auth |
| :--- | :--- | :--- | :--- |
| `/auth/token` | POST | Login/signup | No |
| `/auth/logout` | GET | Logout | No |
| `/auth/captcha` | GET | CAPTCHA image | No |
| `/api/db/find` | POST | Query documents | Yes (session or API key) |
| `/api/db/insert` | POST | Insert document | Yes |
| `/api/db/update` | POST | Update documents | Yes |
| `/api/db/delete` | POST | Delete documents | Yes |
| `/api/storage/list` | GET | List files | Yes |
| `/api/storage/upload` | POST | Upload file | Yes |
| `/api/storage/download` | GET | Download file | Yes |
| `/api/storage/delete` | POST | Delete file | Yes |
| `/api/storage/status` | GET | Storage usage | Yes |
| `/api/lib/list` | GET | List library files | Yes |
| `/api/lib/upload` | POST | Upload to library | Yes |
| `/api/lib/delete` | POST | Delete from library | Yes |
| `/api/lib/status` | GET | Library usage | Yes |
| `/api/secrets/get` | POST | Get a secret value | Owner/Admin only |
| `/{your-proxy-route}` | ANY | Proxy to external API | Per route config |

---

## 16. Best Practices for LLM-Generated Projects

1. **Use the Library** for common assets (Bootstrap, Font Awesome, etc.) to save storage.
2. **Minimize API calls** – batch operations where possible.
3. **Implement proper error handling** in your frontend.
4. **Use the proxy** for any external API calls that require secrets.
5. **Set appropriate roles** – don't give everyone admin privileges.
6. **Enable webhooks** for critical events (e.g., user signup) to integrate with external services.
7. **Schedule cleanup jobs** (e.g., `CleanExpiredSessions`) to keep your database tidy.
8. **Export backups regularly** – especially before major changes.

---

## 17. Frequently Asked Questions (for LLMs)

**Q: Can I run server-side code?**  
A: No. All logic must be in frontend JavaScript. The platform provides backend services via APIs.

**Q: How do I handle file uploads?**  
A: Use the Storage API endpoints with `multipart/form-data`.

**Q: How do I send emails?**  
A: Use a webhook or proxy to an external email service (e.g., SendGrid, Mailgun).

**Q: Can I integrate with payment providers?**  
A: Yes. Use the proxy service to call Stripe, PayPal, etc., with secrets stored securely.

**Q: Is there a way to run background tasks?**  
A: Yes, use the built-in cron jobs. For custom logic, trigger a webhook or call a proxy that executes the task externally.

**Q: Can I use WebSockets?**  
A: Not directly. You can use polling or Server-Sent Events (via a proxy) if needed.

**Q: How do I handle large files?**  
A: Use the Storage API with chunked uploads (the platform supports streaming, but chunking is client‑side).

---

## 18. Conclusion

With this guide, you have all the information needed to generate complete, functional applications on the LocalMe platform. Use the provided schemas, examples, and best practices to build secure, scalable MVPs.

For any additional questions, refer to the full documentation at [docs.localme.com](https://docs.localme.com) or the community forum.

---

**Document generated on 2026-07-23.**

*This concludes the five‑document set for LocalMe.*