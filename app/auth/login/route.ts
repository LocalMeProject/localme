/**
 * GET /auth/login — built-in visitor login page (Blueprint §5.5 login flow).
 * Serves the project's uploaded `login.html` when present ("built-in login
 * page or custom login.html"), else the built-in page. The form posts to
 * /auth/token with the projectId; the response's redirectUrl (returnUrl or
 * the project root) is where the browser lands next.
 */
import { NextResponse } from "next/server";
import { getFileBlob, getProjectById } from "@/lib/server/repos";
import { handler } from "@/lib/server/http";

export const GET = handler(async (request) => {
  const url = new URL(request.url);
  const projectIdRaw = url.searchParams.get("projectId");
  const returnUrlRaw = url.searchParams.get("returnUrl");
  if (!projectIdRaw || !/^\d+$/.test(projectIdRaw)) {
    return new NextResponse("Missing or invalid projectId.", { status: 400 });
  }
  const projectId = Number(projectIdRaw);

  const project = await getProjectById(projectId);
  if (!project) return new NextResponse("Project not found.", { status: 404 });

  // Custom login page wins over the built-in one (docs §5.5).
  const custom = await getFileBlob(projectId, "login.html");
  if (custom) {
    return new NextResponse(custom.content.toString("utf8"), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const safeReturn =
    returnUrlRaw && returnUrlRaw.startsWith("/") ? returnUrlRaw : `/${project.name}/`;
  const postBody = JSON.stringify({
    action: "login",
    projectId,
    returnUrl: safeReturn,
  });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in — ${escapeHtml(project.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #0f1115; color: #e8eaf0;
         display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; }
  .card { background: #171a21; border: 1px solid #2a2f3a; border-radius: 12px; padding: 2rem;
          width: min(24rem, 92vw); }
  h1 { font-size: 1.25rem; margin: 0 0 .25rem; }
  p.sub { color: #8b93a5; font-size: .875rem; margin: 0 0 1.5rem; }
  label { display: block; font-size: .8rem; color: #aab2c2; margin: .75rem 0 .25rem; }
  input { width: 100%; padding: .6rem .75rem; border-radius: 8px; border: 1px solid #2a2f3a;
          background: #0f1115; color: #e8eaf0; font-size: .95rem; }
  button { width: 100%; margin-top: 1.25rem; padding: .65rem; border: 0; border-radius: 8px;
           background: #4f7cff; color: #fff; font-size: .95rem; font-weight: 600; cursor: pointer; }
  button:hover { background: #3f6ae6; }
  .error { color: #ff7b7b; font-size: .85rem; margin-top: .75rem; min-height: 1.2em; }
  .toggle { margin-top: 1rem; font-size: .85rem; color: #8b93a5; }
  .toggle a { color: #7d9dff; cursor: pointer; text-decoration: underline; }
</style>
</head>
<body>
<div class="card">
  <h1>Sign in to ${escapeHtml(project.name)}</h1>
  <p class="sub">Project access is separate from your platform account.</p>
  <form id="form">
    <label for="username">Username</label>
    <input id="username" name="username" autocomplete="username" required>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <div class="error" id="error"></div>
    <button type="submit" id="submit">Sign in</button>
    <div class="toggle">New here? <a id="toggle">Create an account</a></div>
  </form>
</div>
<script>
  var action = "login";
  var defaultBody = ${JSON.stringify(postBody)};
  toggleEl = document.getElementById("toggle");
  toggleEl.addEventListener("click", function () {
    action = action === "login" ? "signup" : "login";
    document.getElementById("submit").textContent = action === "login" ? "Sign in" : "Create account";
    toggleEl.textContent = action === "login" ? "Create an account" : "I already have an account";
    document.getElementById("error").textContent = "";
  });
  document.getElementById("form").addEventListener("submit", function (event) {
    event.preventDefault();
    var errorEl = document.getElementById("error");
    errorEl.textContent = "";
    var username = document.getElementById("username").value;
    var password = document.getElementById("password").value;
    if (!username || !password) { errorEl.textContent = "Enter a username and password."; return; }
    var body = JSON.parse(defaultBody);
    body.action = action;
    body.username = username;
    body.password = password;
    fetch("/auth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.json().then(function (data) { return { status: response.status, data: data }; });
    }).then(function (result) {
      if (result.status === 200 && result.data && result.data.success) {
        window.location.href = result.data.redirectUrl || "/";
      } else {
        errorEl.textContent = result.data && result.data.error ? result.data.error : "Sign in failed.";
      }
    }).catch(function () { errorEl.textContent = "Sign in failed. Try again."; });
  });
</script>
</body>
</html>`;

  return new NextResponse(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
