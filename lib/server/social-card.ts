/**
 * Dynamic Open Graph / Twitter social card SVG generator.
 * Standard 1200x630 dimension, dark theme with elegant gradients.
 */

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

export function generateSocialCardSvg(user: string, project: string): string {
  const safeUser = escapeXml(user);
  const safeProject = escapeXml(project);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b1020" />
      <stop offset="50%" stop-color="#141c38" />
      <stop offset="100%" stop-color="#0b1020" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="60" result="blur" />
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <circle cx="200" cy="150" r="180" fill="#3b82f6" opacity="0.15" filter="url(#glow)" />
  <circle cx="1000" cy="480" r="220" fill="#8b5cf6" opacity="0.15" filter="url(#glow)" />

  <g transform="translate(100, 120)">
    <rect width="140" height="36" rx="18" fill="#1e293b" stroke="#334155" stroke-width="1.5" />
    <text x="70" y="23" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" fill="#94a3b8" letter-spacing="1">LOCALME</text>

    <text x="0" y="160" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="800" fill="#f8fafc" letter-spacing="-1">
      ${safeProject}
    </text>

    <text x="0" y="230" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="400" fill="#94a3b8">
      Created by <tspan fill="#60a5fa" font-weight="600">@${safeUser}</tspan>
    </text>

    <line x1="0" y1="290" x2="1000" y2="290" stroke="#334155" stroke-width="1" />

    <text x="0" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="500" fill="#64748b">
      Hosted with fast edge delivery &bull; Isolated SQLite &bull; Zero external cloud
    </text>
  </g>
</svg>`;
}

export function injectSocialMeta(html: string, user: string, project: string): string {
  if (/<meta\s+property=["']og:/i.test(html)) return html;
  const safeUser = escapeXml(user);
  const safeProject = escapeXml(project);
  const imageUrl = `/${encodeURIComponent(user)}/${encodeURIComponent(project)}/~og-image`;

  const meta = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${safeProject}">`,
    `<meta property="og:description" content="Hosted on LocalMe">`,
    `<meta property="og:image" content="${imageUrl}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${safeProject}">`,
    `<meta name="twitter:description" content="Hosted on LocalMe">`,
    `<meta name="twitter:image" content="${imageUrl}">`,
  ].join("\n    ");

  const head = /<head[^>]*>/i.exec(html);
  if (head) {
    const at = head.index + head[0].length;
    return `${html.slice(0, at)}\n    ${meta}${html.slice(at)}`;
  }
  const htmlTag = /<html[^>]*>/i.exec(html);
  if (htmlTag) {
    const at = htmlTag.index + htmlTag[0].length;
    return `${html.slice(0, at)}<head>\n    ${meta}\n  </head>${html.slice(at)}`;
  }
  return `<head>\n    ${meta}\n  </head>${html}`;
}
