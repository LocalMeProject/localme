# LocalMe Platform Policy & Terms of Service

*Last Updated: October 2026*

Welcome to **LocalMe** (`localme.ir`). This policy document defines our Terms of Service, Privacy Policy, and Acceptable Use Guidelines for human developers, end users, and autonomous AI agents operating via the Model Context Protocol (MCP) and REST APIs.

---

## 1. Core Principles

LocalMe is built on two foundational principles:
1. **User Empowerment**: Non-technical and technical users alike have direct, effortless control over their projects, files, domains, and data without running complex server infrastructure.
2. **Agentic Autonomy & Human Governance**: Autonomous AI agents (such as Claude, Cursor, ChatGPT, Antigravity, and custom agentic frameworks) may orchestrate deployments, maintain files, manage databases, and query logs on behalf of users, provided that critical actions (such as credential issuance and destructive operations) are bounded by explicit human consent.

---

## 2. Account Tiers & Resource Quotas

Every user on LocalMe is subject to system-enforced resource quotas designed to ensure fair sharing and system stability. Subscription tiers, pricing, and quotas are centrally managed and updated by platform SuperAdmins in the management console:

### 2.1 Free Tier (Default)
- **Projects**: Maximum of 3 active projects per account.
- **Storage**: Up to 3 MB of file storage per project.
- **Shared Library**: Up to 3 MB of shared assets across all projects.
- **Requests & Rate Limits**: Generous sliding-window rate limits designed for micro-apps, forms, portfolios, and lightweight APIs.

### 2.2 Plus Tier
- **Projects**: Up to 50 active projects.
- **Storage**: Up to 50 MB per project.
- **Shared Library**: Up to 50 MB shared asset quota.
- Available via online subscription or operator grant.

### 2.3 Pro Tier
- **Projects**: High-capacity / unlimited project quotas for teams and advanced developers.
- **Storage**: High-capacity dedicated storage limits for extensive applications.
- Configured and tailored dynamically in Platform Settings.

---

## 3. Autonomous AI Agents, Skills & MCP Policy

LocalMe provides full agentic integration via our native **MCP Server** (`/api/mcp`) and official **Agent Skills** (`/skills/localme/SKILL.md`). The following rules govern agentic interactions:

### 3.1 Token Types & Lifecycles
1. **Personal Access Tokens (PAT)**:
   - Created manually by the account owner inside the LocalMe Console.
   - May be configured as permanent or with automatic rotation schedules (e.g., 4h, 1d, 7d, 30d).
   - During auto-rotation, a 1-hour grace period is granted to allow background jobs to migrate smoothly.
2. **Agent Access Tokens (AAT)**:
   - Requested programmatically by AI agents via `POST /api/agent/request-aat`.
   - **Mandatory Human Consent**: AAT tokens are never issued automatically without explicit human confirmation. The human user must review the agent's identity, scopes, and duration, and approve access via the browser consent screen.
   - Ephemeral duration (4 hours to 48 hours). Tokens must be cached locally in `localme-aat.txt` and not re-requested repeatedly while valid.

### 3.2 Agent Operational Boundaries
- Agents must never attempt to brute-force authentication, bypass rate limits, or tamper with system tables.
- Destructive operations (such as deleting an entire project or dropping tables) must be prompted to the user before execution.
- Automated API polling must respect HTTP `429 Too Many Requests` responses and honor the `Retry-After` header.

---

## 4. Privacy & Data Handling

### 4.1 Data Ownership
You retain 100% ownership of all HTML, CSS, JavaScript, media assets, documents, and database entries uploaded or created in your projects. LocalMe will never claim ownership or sell your data.

### 4.2 Data Storage & Backups
- Project documents and files are stored securely in isolated relational and document engines.
- Secrets and third-party API credentials stored in project settings are encrypted at rest using industry-standard **AES-256-GCM**. They are never transmitted back to visitor browsers and are only injected server-side during reverse proxy requests.
- Full project backups can be exported at any time in archive format and restored onto any compliant environment.

### 4.3 Log Retention
Operational logs (including rate-limiting metrics, visitor access statistics, and delivery logs) are maintained on a sliding window and automatically purged. We do not track or sell visitor identities across third-party networks.

---

## 5. Prohibited Activities & Fair Use

Users and autonomous agents are strictly prohibited from using LocalMe for:
1. Distributing malware, phishing schemes, ransomware, or deceptive credential-harvesting tools.
2. Launching denial-of-service (DoS) attacks or sending unsolicited spam communications.
3. Hosting or distributing content that infringes upon third-party copyrights, trademarks, or intellectual property rights.
4. Engaging in financial fraud or unauthorized cryptocurrency mining.

Accounts found in violation of these guidelines are subject to immediate suspension and resource deletion.

---

## 6. Service Availability & Disclaimers

LocalMe is provided on an "as-is" and "as-available" basis. While we strive for continuous availability, high-performance edge delivery, and reliable data integrity, we do not warrant that service will be uninterrupted or error-free. Users are encouraged to maintain periodic exports of mission-critical data.

---

## 7. Contact & Platform Credits

LocalMe was created and is actively maintained by **Sina Vali**.

For inquiries, support, vulnerability disclosures, or policy questions, please contact:
- **Email**: [sina1vali@gmail.com](mailto:sina1vali@gmail.com)
- **Website**: [https://localme.ir](https://localme.ir)
- **API Documentation**: [https://localme.ir/docs](https://localme.ir/docs)
