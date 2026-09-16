# LocalMe — Internal Devs Document

**Version**: 1.0.0  
**Date**: 2026-07-23  
**Status**: Final — Development Guide

---

## 1. Purpose

This document is the internal development guide for the LocalMe platform engineering team. It provides coding standards, architectural patterns, development workflows, testing strategies, and operational runbooks. It assumes familiarity with the Blueprint and Technical Documentation.

---

## 2. Development Environment Setup

### 2.1 Prerequisites

| Component | Version | Installation |
| :--- | :--- | :--- |
| **.NET SDK** | 10.0.10 | `sudo apt install dotnet-sdk-10.0` |
| **Node.js** | 22.x LTS | `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -` |
| **PostgreSQL** | 18.4 | `sudo apt install postgresql-18` |
| **Git** | 2.43+ | `sudo apt install git` |
| **IDE** | Visual Studio Code / Rider | — |
| **Docker** | Latest (optional) | `sudo apt install docker.io docker-compose` |

### 2.2 Clone & Initial Setup

```bash
git clone https://github.com/localme/localme.git
cd localme

# Backend
cd backend
dotnet restore
dotnet build

# Frontend
cd ../frontend
npm install
npm run build

# Database
sudo -u postgres psql -c "CREATE DATABASE localme;"
sudo -u postgres psql -c "CREATE USER localme_user WITH PASSWORD 'localme';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE localme TO localme_user;"
```

### 2.3 Environment Variables (.env files)

**Backend (`backend/.env`):**
```
ASPNETCORE_ENVIRONMENT=Development
ASPNETCORE_URLS=http://localhost:5000
POSTGRES_CONNECTION_STRING=Host=localhost;Port=5432;Database=localme;Username=localme_user;Password=localme
JWT_SECRET=dev_super_secret_key_change_in_production
ENCRYPTION_KEY=dev_32_byte_key_1234567890123456
STORAGE_ROOT=./storage
SSL_EMAIL=dev@localme.com
```

**Frontend (`frontend/.env.local`):**
```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 2.4 Run Locally

```bash
# Terminal 1: Backend
cd backend
dotnet run --urls=http://localhost:5000

# Terminal 2: Frontend
cd frontend
npm run dev
```

---

## 3. Coding Standards

### 3.1 Backend (C# / .NET)

#### 3.1.1 Naming Conventions

| Element | Convention | Example |
| :--- | :--- | :--- |
| **Namespaces** | `LocalMe.Modules.{ModuleName}` | `LocalMe.Modules.Storage` |
| **Interfaces** | `I{PascalCase}` | `IStorageProvider` |
| **Classes** | `{PascalCase}` | `LocalDiskStorageProvider` |
| **Methods** | `{PascalCase}` | `WriteAsync` |
| **Properties** | `{PascalCase}` | `StorageRootPath` |
| **Private Fields** | `_{camelCase}` | `_storageRoot` |
| **Constants** | `{UPPER_SNAKE_CASE}` | `MAX_RETRY_COUNT` |
| **Async Methods** | `{PascalCase}Async` | `UploadFileAsync` |

#### 3.1.2 File Organization

- One class per file.
- File name matches class name (e.g., `StorageService.cs`).
- Interfaces in same file or separate `I{Name}.cs` (preferred separate).

#### 3.1.3 Async/Await

- Use `Async` suffix for all asynchronous methods.
- Avoid `.Result` and `.Wait()` (use `await`).
- Use `Task.FromResult` for synchronous returns.

#### 3.1.4 Error Handling

- Use `try-catch` only at boundaries (Middleware, Endpoints, Background Services).
- Log all exceptions with context.
- Throw custom exceptions (`LocalMeException`) with meaningful messages.

```csharp
public class LocalMeException : Exception
{
    public int StatusCode { get; }
    public LocalMeException(string message, int statusCode = 400) : base(message)
    {
        StatusCode = statusCode;
    }
}
```

#### 3.1.5 Dependency Injection

- Register all services in `Program.cs` using `AddScoped`, `AddSingleton`, or `AddTransient`.
- Use constructor injection.
- Avoid service locator pattern.

```csharp
public class StorageService : IStorageService
{
    private readonly IStorageProvider _storageProvider;
    private readonly ILogger<StorageService> _logger;

    public StorageService(IStorageProvider storageProvider, ILogger<StorageService> logger)
    {
        _storageProvider = storageProvider;
        _logger = logger;
    }
}
```

#### 3.1.6 Logging

- Use `ILogger<T>` injected via constructor.
- Use structured logging (pass objects as parameters).

```csharp
_logger.LogInformation("File {FileName} uploaded by user {UserId}", fileName, userId);
```

#### 3.1.7 JSON Serialization

- Use `System.Text.Json` with PascalCase naming policy for API contracts.
- Use `JsonNamingPolicy.CamelCase` for DTOs.

```csharp
var options = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    PropertyNameCaseInsensitive = true
};
```

### 3.2 Frontend (TypeScript / React)

#### 3.2.1 Naming Conventions

| Element | Convention | Example |
| :--- | :--- | :--- |
| **Files** | `{PascalCase}.tsx` (components), `{camelCase}.ts` (utilities) | `FileManager.tsx`, `api.ts` |
| **Components** | `{PascalCase}` | `DashboardLayout` |
| **Hooks** | `use{PascalCase}` | `useAuth` |
| **Types/Interfaces** | `{PascalCase}` | `UserProfile` |
| **Functions** | `{camelCase}` | `fetchProjects` |
| **Constants** | `{UPPER_SNAKE_CASE}` | `API_BASE_URL` |

#### 3.2.2 Component Structure

```typescript
// Imports
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

// Types
interface FileManagerProps {
  projectId: number;
}

// Component
export function FileManager({ projectId }: FileManagerProps) {
  // Hooks
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);

  // Effects
  useEffect(() => {
    fetchFiles();
  }, [projectId]);

  // Handlers
  const handleUpload = async (file: File) => {
    // ...
  };

  // Render
  return <div>...</div>;
}
```

#### 3.2.3 State Management (Zustand)

```typescript
import { create } from 'zustand';

interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  currentProject: null,
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (project) => set({ currentProject: project }),
}));
```

#### 3.2.4 API Calls

```typescript
// lib/api.ts
export async function apiClient<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}
```

#### 3.2.5 Tailwind CSS

- Use utility classes directly in JSX.
- Group related classes using `clsx` or `tailwind-merge`.
- Define custom theme extensions in `tailwind.config.ts`.

---

## 4. Architecture Patterns

### 4.1 Repository Pattern (Backend)

Each domain entity has a repository that handles database operations.

```csharp
public interface IProjectRepository
{
    Task<Project> GetByIdAsync(int id);
    Task<IEnumerable<Project>> GetByUserAsync(int userId);
    Task CreateAsync(Project project);
    Task UpdateAsync(Project project);
    Task DeleteAsync(int id);
}

public class ProjectRepository : IProjectRepository
{
    private readonly IDbConnection _connection;
    private readonly ILogger<ProjectRepository> _logger;

    public ProjectRepository(IDbConnection connection, ILogger<ProjectRepository> logger)
    {
        _connection = connection;
        _logger = logger;
    }

    public async Task<Project> GetByIdAsync(int id)
    {
        return await _connection.QueryFirstOrDefaultAsync<Project>(
            "SELECT * FROM projects WHERE id = @Id",
            new { Id = id }
        );
    }
    // ...
}
```

### 4.2 Service Layer

Services orchestrate multiple repositories and contain business logic.

```csharp
public interface IProjectService
{
    Task<Project> GetProjectAsync(int id);
    Task<Project> CreateProjectAsync(int userId, string name);
    Task DeleteProjectAsync(int id);
}

public class ProjectService : IProjectService
{
    private readonly IProjectRepository _projectRepository;
    private readonly IStorageService _storageService;
    private readonly IUnitOfWork _unitOfWork;

    public ProjectService(IProjectRepository projectRepository, IStorageService storageService, IUnitOfWork unitOfWork)
    {
        _projectRepository = projectRepository;
        _storageService = storageService;
        _unitOfWork = unitOfWork;
    }

    public async Task<Project> CreateProjectAsync(int userId, string name)
    {
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            var project = new Project { UserId = userId, Name = name };
            await _projectRepository.CreateAsync(project);
            await _storageService.CreateProjectDirectoryAsync(project.Id);
            await _unitOfWork.CommitAsync();
            return project;
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }
    }
}
```

### 4.3 Unit of Work Pattern

For operations spanning multiple repositories, use Unit of Work to ensure consistency.

```csharp
public interface IUnitOfWork : IDisposable
{
    Task BeginTransactionAsync();
    Task CommitAsync();
    Task RollbackAsync();
}

public class UnitOfWork : IUnitOfWork
{
    private readonly IDbConnection _connection;
    private IDbTransaction _transaction;

    public UnitOfWork(IDbConnection connection)
    {
        _connection = connection;
    }

    public async Task BeginTransactionAsync()
    {
        if (_connection.State != ConnectionState.Open)
            await _connection.OpenAsync();
        _transaction = await _connection.BeginTransactionAsync();
    }

    public async Task CommitAsync()
    {
        await _transaction.CommitAsync();
    }

    public async Task RollbackAsync()
    {
        await _transaction.RollbackAsync();
    }

    public void Dispose()
    {
        _transaction?.Dispose();
        _connection?.Close();
    }
}
```

### 4.4 Middleware Pipeline

Custom middleware for cross-cutting concerns:

```csharp
public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IRateLimiter _rateLimiter;

    public RateLimitingMiddleware(RequestDelegate next, IRateLimiter rateLimiter)
    {
        _next = next;
        _rateLimiter = rateLimiter;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var sessionId = context.Items["SessionId"]?.ToString();
        var ip = context.Connection.RemoteIpAddress?.ToString();
        var route = context.Request.Path.ToString();

        if (!await _rateLimiter.IsAllowedAsync(sessionId, ip, route))
        {
            context.Response.StatusCode = 429;
            await context.Response.WriteAsync("Too Many Requests");
            return;
        }

        await _next(context);
    }
}
```

---

## 5. Database Development

### 5.1 Migration Management

Use DbUp for schema migrations.

**Initial Migration** (`Migrations/001_Initial.sql`):
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(32) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    ...
);
```

**Apply Migrations**:
```bash
dotnet run -- migrate
```

### 5.2 Query Optimization Guidelines

1. **Use parameterized queries** (always).
2. **Limit result sets** (use `LIMIT` and `OFFSET`).
3. **Index foreign keys**: `project_id`, `user_id`, etc.
4. **Index frequently queried JSONB fields** using GIN.
5. **Partition large tables** (`visit_logs` by month).
6. **Use EXPLAIN ANALYZE** to debug slow queries.

**Example Index Creation**:
```sql
CREATE INDEX idx_project_data_gin ON project_data USING GIN (document);
CREATE INDEX idx_project_data_table ON project_data(project_id, table_name);
CREATE INDEX idx_visit_logs_project_date ON visit_logs(project_id, visited_at DESC);
```

### 5.3 Seed Data

**Seed Admin User**:
```sql
INSERT INTO users (username, password_hash, is_admin) 
VALUES ('admin', '{BCRYPT_HASH}', true);
```

**Seed System Configs**:
```sql
INSERT INTO system_configs (config_key, config_value, description) VALUES
('storage', '{"default_user_cap_bytes":5242880,"max_user_cap_bytes":1073741824,"library_bonus_bytes":5242880}', 'Storage limits'),
('rate_limits', '{"public_requests_per_minute":60,"authenticated_requests_per_minute":300,"admin_requests_per_minute":600}', 'Rate limits'),
-- etc.
```

---

## 6. Frontend Development

### 6.1 Directory Structure (Detailed)

```
/frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── admin/
│   │   │   ├── page.tsx
│   │   │   ├── users/
│   │   │   ├── projects/
│   │   │   └── config/
│   │   ├── user/
│   │   │   ├── page.tsx
│   │   │   └── [projectId]/
│   │   │       ├── page.tsx
│   │   │       ├── storage/
│   │   │       ├── routing/
│   │   │       ├── database/
│   │   │       ├── auth/
│   │   │       ├── cron/
│   │   │       ├── webhooks/
│   │   │       ├── domains/
│   │   │       └── import-export/
│   │   └── layout.tsx
│   ├── api/
│   │   └── (proxy routes)/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/ (shadcn components)
│   ├── forms/
│   │   ├── LoginForm.tsx
│   │   ├── ProjectForm.tsx
│   │   └── RouteForm.tsx
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   ├── storage/
│   │   ├── FileManager.tsx
│   │   ├── FileUploader.tsx
│   │   └── FileEditor.tsx
│   └── routing/
│       ├── RouteList.tsx
│       └── RouteEditor.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useProjects.ts
│   └── useWebSocket.ts
├── lib/
│   ├── api/
│   │   ├── client.ts
│   │   ├── projects.ts
│   │   └── auth.ts
│   ├── store/
│   │   ├── useProjectStore.ts
│   │   └── useAuthStore.ts
│   └── validations/
│       ├── project.schema.ts
│       └── route.schema.ts
├── styles/
│   └── globals.css
├── types/
│   ├── project.ts
│   ├── route.ts
│   └── api.ts
├── .env.local
├── tailwind.config.ts
├── next.config.js
└── package.json
```

### 6.2 Next.js Configuration

**`next.config.js`**:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@monaco-editor/react'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
      {
        source: '/auth/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/auth/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
```

### 6.3 Monaco Editor Integration

**`components/storage/FileEditor.tsx`**:
```typescript
'use client';

import { useState, useEffect } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { useTheme } from 'next-themes';

interface FileEditorProps {
  filePath: string;
  content: string;
  language: 'html' | 'css' | 'javascript' | 'json' | 'plaintext';
  onSave: (content: string) => Promise<void>;
}

export function FileEditor({ filePath, content, language, onSave }: FileEditorProps) {
  const { resolvedTheme } = useTheme();
  const [value, setValue] = useState(content);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [value]);

  return (
    <div className="h-full w-full relative">
      <MonacoEditor
        height="100%"
        language={language}
        value={value}
        onChange={(newValue) => setValue(newValue || '')}
        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light'}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          automaticLayout: true,
        }}
      />
      <div className="absolute bottom-4 right-4 flex gap-2">
        <div className="text-xs text-muted-foreground">
          {isSaving ? 'Saving...' : 'Ctrl+S to save'}
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          disabled={isSaving}
        >
          Save
        </button>
      </div>
    </div>
  );
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests (xUnit)

**Example: StorageServiceTests.cs**

```csharp
public class StorageServiceTests
{
    private readonly Mock<IStorageProvider> _mockStorage;
    private readonly StorageService _service;

    public StorageServiceTests()
    {
        _mockStorage = new Mock<IStorageProvider>();
        _service = new StorageService(_mockStorage.Object, Mock.Of<ILogger<StorageService>>());
    }

    [Fact]
    public async Task UploadFileAsync_ShouldWriteFileToStorage()
    {
        // Arrange
        var projectId = 1;
        var path = "/test.txt";
        var stream = new MemoryStream(Encoding.UTF8.GetBytes("test"));

        // Act
        await _service.UploadFileAsync(projectId, path, stream);

        // Assert
        _mockStorage.Verify(x => x.WriteAsync(It.IsAny<string>(), It.IsAny<Stream>()), Times.Once);
    }

    [Fact]
    public async Task UploadFileAsync_ShouldThrowWhenStorageCapExceeded()
    {
        // Arrange
        var projectId = 1;
        var path = "/test.txt";
        var stream = new MemoryStream(new byte[1024 * 1024 * 10]); // 10MB

        // Act & Assert
        await Assert.ThrowsAsync<LocalMeException>(() =>
            _service.UploadFileAsync(projectId, path, stream));
    }
}
```

### 7.2 Integration Tests (TestContainers)

```csharp
public class DatabaseIntegrationTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer;
    private IDbConnection _connection;

    public DatabaseIntegrationTests()
    {
        _dbContainer = new PostgreSqlBuilder()
            .WithImage("postgres:18-alpine")
            .Build();
    }

    public async Task InitializeAsync()
    {
        await _dbContainer.StartAsync();
        _connection = new NpgsqlConnection(_dbContainer.GetConnectionString());
        await _connection.OpenAsync();
        // Run migrations
    }

    public async Task DisposeAsync()
    {
        await _connection.DisposeAsync();
        await _dbContainer.DisposeAsync();
    }

    [Fact]
    public async Task ProjectRepository_CreateAsync_ShouldPersistProject()
    {
        var repo = new ProjectRepository(_connection, Mock.Of<ILogger<ProjectRepository>>());
        var project = new Project { UserId = 1, Name = "Test Project" };

        await repo.CreateAsync(project);

        var result = await repo.GetByIdAsync(project.Id);
        Assert.Equal("Test Project", result.Name);
    }
}
```

### 7.3 API Tests (Postman/Newman)

**Collection Structure**:
```
LocalMe API Tests/
├── Auth/
│   ├── Login (Admin)
│   ├── Login (User)
│   └── Logout
├── Projects/
│   ├── Create Project
│   ├── List Projects
│   ├── Update Project
│   └── Delete Project
├── Storage/
│   ├── Upload File
│   ├── Download File
│   ├── List Files
│   └── Delete File
└── Database/
    ├── Insert Document
    ├── Find Documents
    ├── Update Document
    └── Delete Document
```

### 7.4 Load Testing (k6)

**Example k6 Script**:
```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 10 },
    { duration: '1m', target: 0 },
  ],
};

export default function () {
  const res = http.get('http://localhost:5000/api/storage/status', {
    headers: {
      'X-API-Key': 'test_key',
    },
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
```

---

## 8. Git Workflow

### 8.1 Branch Strategy

```
main (production)
  └── develop (integration)
       ├── feature/feature-name
       ├── bugfix/bug-name
       └── release/v1.0.0
```

### 8.2 Commit Message Convention

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

**Examples**:
```
feat(storage): add file upload endpoint with progress tracking

Implements POST /api/storage/upload with multipart form data.
Includes progress tracking via Server-Sent Events.

Closes #123
```

### 8.3 Pull Request Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added
- [ ] Integration tests updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review performed
- [ ] Documentation updated
- [ ] No new warnings/linter errors
```

---

## 9. CI/CD Pipeline

### 9.1 GitHub Actions Workflow

**`.github/workflows/ci.yml`**:
```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: 10.0.x
      - name: Restore dependencies
        run: dotnet restore
      - name: Build
        run: dotnet build --no-restore
      - name: Test
        run: dotnet test --no-build --verbosity normal

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Build
        run: npm run build
      - name: Test
        run: npm test

  deploy:
    needs: [test-backend, test-frontend]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Server
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /opt/localme
            git pull
            ./scripts/deploy.sh
```

### 9.2 Deploy Script

**`scripts/deploy.sh`**:
```bash
#!/bin/bash
set -e

echo "Deploying LocalMe..."

# Build backend
cd /opt/localme/backend
dotnet publish -c Release -o ./publish

# Build frontend
cd /opt/localme/frontend
npm install
npm run build

# Run migrations
cd /opt/localme/backend
dotnet run -- migrate

# Restart services
sudo systemctl restart localme-backend
sudo systemctl restart localme-frontend
sudo systemctl reload nginx

echo "Deployment complete!"
```

---

## 10. Debugging & Troubleshooting

### 10.1 Backend Debugging

**Enable Debug Logging**:
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "Microsoft": "Warning"
    }
  }
}
```

**Attach Debugger** (Visual Studio Code):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": ".NET Core Launch (web)",
      "type": "coreclr",
      "request": "launch",
      "preLaunchTask": "build",
      "program": "${workspaceFolder}/backend/bin/Debug/net10.0/LocalMe.Backend.dll",
      "args": [],
      "cwd": "${workspaceFolder}/backend",
      "stopAtEntry": false,
      "env": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  ]
}
```

### 10.2 Frontend Debugging

**Enable Debug Logs**:
```typescript
// lib/logger.ts
export const logger = {
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(...args);
    }
  },
  error: (...args: any[]) => {
    console.error(...args);
  },
};
```

**React DevTools**: Install browser extension for component debugging.

### 10.3 Database Debugging

**Log All Queries**:
```csharp
// Program.cs
builder.Services.AddSingleton<NpgsqlDataSource>(sp =>
{
    var connectionString = builder.Configuration.GetConnectionString("Postgres");
    var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
    dataSourceBuilder.UseLoggerFactory(sp.GetRequiredService<ILoggerFactory>());
    return dataSourceBuilder.Build();
});
```

**Run EXPLAIN ANALYZE**:
```sql
EXPLAIN ANALYZE SELECT * FROM project_data WHERE project_id = 1 AND document @> '{"active":true}';
```

### 10.4 Common Issues & Solutions

| Issue | Solution |
| :--- | :--- |
| **Database connection timeout** | Increase `Timeout` in connection string, check PostgreSQL service. |
| **File permission errors** | Ensure `localme` user has write access to `/var/localme/storage`. |
| **Rate limit blocking all requests** | Check `system_configs` for incorrect limits; temporarily increase or disable for debugging. |
| **SSL certificate not renewing** | Check DNS TXT record; ensure port 80/443 are accessible from Let's Encrypt servers. |
| **Monaco Editor not loading** | Check network requests; ensure CDN assets are accessible. |
| **Cron jobs not executing** | Check Quartz.NET logs; ensure `cron_configs` table has entries and `is_enabled = true`. |

---

## 11. Performance Profiling

### 11.1 Backend Profiling (dotnet-trace)

```bash
dotnet tool install -g dotnet-trace
dotnet-trace collect -p <PID> --providers Microsoft-Windows-DotNETRuntime:4:5
```

### 11.2 Frontend Profiling (Chrome DevTools)

- **Performance Tab**: Record runtime performance.
- **Memory Tab**: Check for memory leaks.
- **Network Tab**: Analyze API call timings.

### 11.3 Database Profiling (pg_stat_statements)

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 10 slowest queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## 12. Security Checklist

### 12.1 Code Review Checklist

- [ ] No secrets in code (use environment variables).
- [ ] All inputs validated (Zod/JSON Schema).
- [ ] All SQL queries parameterized.
- [ ] Authentication required for protected endpoints.
- [ ] Authorization checks for all actions.
- [ ] File paths sanitized (no `..` traversal).
- [ ] Rate limiting applied.
- [ ] Logs do not contain sensitive data (passwords, tokens, secrets).
- [ ] CORS configured correctly.
- [ ] HTTP headers set (HSTS, X-Content-Type-Options, X-Frame-Options).

### 12.2 Security Scanning

**SonarQube**:
```bash
sonar-scanner \
  -Dsonar.projectKey=localme \
  -Dsonar.sources=. \
  -Dsonar.host.url=https://sonarcloud.io \
  -Dsonar.login=$SONAR_TOKEN
```

**Dependency Scanning**:
```bash
# Backend
dotnet list package --vulnerable

# Frontend
npm audit
```

---

## 13. Documentation Standards

### 13.1 XML Comments (Backend)

```csharp
/// <summary>
/// Uploads a file to the project storage.
/// </summary>
/// <param name="projectId">The project ID.</param>
/// <param name="path">The relative path within the project.</param>
/// <param name="stream">The file stream.</param>
/// <param name="overwrite">If true, overwrites existing file.</param>
/// <returns>The uploaded file metadata.</returns>
/// <exception cref="LocalMeException">Thrown when storage cap is exceeded.</exception>
public async Task<FileMetadata> UploadFileAsync(int projectId, string path, Stream stream, bool overwrite = true)
{
    // Implementation
}
```

### 13.2 JSDoc Comments (Frontend)

```typescript
/**
 * Fetches the list of files for a project.
 * @param projectId - The project ID.
 * @param path - The directory path to list.
 * @returns An array of file metadata.
 */
export async function fetchFiles(projectId: number, path: string): Promise<FileMetadata[]> {
    // Implementation
}
```

### 13.3 OpenAPI Documentation

The backend uses **Swashbuckle** to generate OpenAPI 3.1 documentation.

```csharp
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "LocalMe API",
        Version = "v1",
        Description = "The LocalMe Backend API",
        Contact = new OpenApiContact
        {
            Name = "LocalMe Team",
            Email = "support@localme.com"
        }
    });

    // Add JWT authentication to Swagger
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "Enter 'Bearer {token}'",
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
});
```

---

## 14. Development Timeline & Milestones (Internal Reference)

| Phase | Tasks | Duration |
| :--- | :--- | :--- |
| **Phase 1** | Database schema, Authentication, Basic Storage | 2 weeks |
| **Phase 2** | Routing Engine, Database Service, API Endpoints | 3 weeks |
| **Phase 3** | Library Service, Proxy Service, Secrets | 2 weeks |
| **Phase 4** | Cron Jobs, Webhooks, DNS Management | 2 weeks |
| **Phase 5** | Import/Export, Admin Panel, Monitoring | 2 weeks |
| **Phase 6** | Frontend: Dashboard, File Manager, Editor | 3 weeks |
| **Phase 7** | Integration Testing, Performance Tuning | 2 weeks |
| **Phase 8** | Security Audit, Documentation, Deployment | 2 weeks |

**Total**: ~18 weeks (4.5 months)

---

## 15. Contribution Guidelines

1. **Fork** the repository and create a feature branch.
2. **Write tests** for all new functionality.
3. **Update documentation** for API changes.
4. **Run linting** and **formatting** tools before committing.
5. **Create a pull request** with a clear description.
6. **Ensure CI passes** before merging.
7. **Squash commits** before merging to maintain a clean history.

---

**This document provides everything the development team needs to build, test, and maintain the LocalMe platform. It should be read alongside the Blueprint and Technical Documentation for complete context.**

*Document generated on 2026-07-23.*