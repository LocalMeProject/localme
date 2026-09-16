import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { ProjectLayout } from "@/components/project-layout";
import { RequireAuth } from "@/components/require-auth";
import { LandingPage } from "@/pages/landing";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The landing page is the first thing most visitors see, so it ships in the
 * entry chunk. Everything behind auth (and the docs) loads on demand.
 */
const AuthPage = lazy(async () => ({ default: (await import("@/pages/auth")).AuthPage }));
const DocsPage = lazy(async () => ({ default: (await import("@/pages/docs")).DocsPage }));
const DashboardPage = lazy(async () => ({ default: (await import("@/pages/dashboard")).DashboardPage }));
const LibraryPage = lazy(async () => ({ default: (await import("@/pages/library")).LibraryPage }));
const AccountPage = lazy(async () => ({ default: (await import("@/pages/account")).AccountPage }));
const AdminPage = lazy(async () => ({ default: (await import("@/pages/admin")).AdminPage }));
const NotFoundPage = lazy(async () => ({ default: (await import("@/pages/not-found")).NotFoundPage }));

const ProjectOverview = lazy(async () => ({ default: (await import("@/pages/project/overview")).ProjectOverview }));
const ProjectStorage = lazy(async () => ({ default: (await import("@/pages/project/storage")).ProjectStorage }));
const ProjectDatabase = lazy(async () => ({ default: (await import("@/pages/project/database")).ProjectDatabase }));
const ProjectRouting = lazy(async () => ({ default: (await import("@/pages/project/routing")).ProjectRouting }));
const ProjectLibrary = lazy(async () => ({ default: (await import("@/pages/project/library")).ProjectLibrary }));
const ProjectAccess = lazy(async () => ({ default: (await import("@/pages/project/access")).ProjectAccess }));
const ProjectSecrets = lazy(async () => ({ default: (await import("@/pages/project/secrets")).ProjectSecrets }));
const ProjectCron = lazy(async () => ({ default: (await import("@/pages/project/cron")).ProjectCron }));
const ProjectWebhooks = lazy(async () => ({ default: (await import("@/pages/project/webhooks")).ProjectWebhooks }));
const ProjectDomains = lazy(async () => ({ default: (await import("@/pages/project/domains")).ProjectDomains }));
const ProjectBackup = lazy(async () => ({ default: (await import("@/pages/project/backup")).ProjectBackup }));
const ProjectUsage = lazy(async () => ({ default: (await import("@/pages/project/usage")).ProjectUsage }));
const ProjectSettings = lazy(async () => ({ default: (await import("@/pages/project/settings")).ProjectSettings }));

function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 px-1 py-10">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-2 w-24" />
      <Skeleton className="h-72 w-full" />
      <p className="mono-label">loading…</p>
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/docs" element={<DocsPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/projects/:projectId" element={<ProjectLayout />}>
              <Route index element={<ProjectOverview />} />
              <Route path="storage" element={<ProjectStorage />} />
              <Route path="database" element={<ProjectDatabase />} />
              <Route path="routing" element={<ProjectRouting />} />
              <Route path="library" element={<ProjectLibrary />} />
              <Route path="access" element={<ProjectAccess />} />
              <Route path="secrets" element={<ProjectSecrets />} />
              <Route path="cron" element={<ProjectCron />} />
              <Route path="webhooks" element={<ProjectWebhooks />} />
              <Route path="domains" element={<ProjectDomains />} />
              <Route path="backup" element={<ProjectBackup />} />
              <Route path="usage" element={<ProjectUsage />} />
              <Route path="settings" element={<ProjectSettings />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
