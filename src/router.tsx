import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { SkeletonLines } from "./components/ui/Skeleton";

const Wizard = lazy(() =>
  import("./features/wizard/Wizard").then((m) => ({ default: m.Wizard })),
);
const RequestPage = lazy(() =>
  import("./features/requests/RequestPage").then((m) => ({ default: m.RequestPage })),
);
const TokenPage = lazy(() =>
  import("./features/requests/TokenPage").then((m) => ({ default: m.TokenPage })),
);
const NotFound = lazy(() => import("./components/NotFound"));

// Dev-only perf harness (see src/dev/PickerBench.tsx) — import.meta.env.DEV
// is statically replaced by Vite at build time, so this whole lazy() call
// and the route below are dead-code-eliminated from the production bundle.
const PickerBench = import.meta.env.DEV
  ? lazy(() => import("./dev/PickerBench").then((m) => ({ default: m.PickerBench })))
  : null;

// Everything admin-related is its own set of chunks, split from the client
// bundle at this single import boundary.
const AdminLoginPage = lazy(() =>
  import("./features/admin/AdminLoginPage").then((m) => ({ default: m.AdminLoginPage })),
);
const AdminLayout = lazy(() =>
  import("./features/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })),
);
const AdminHome = lazy(() =>
  import("./features/admin/AdminHome").then((m) => ({ default: m.AdminHome })),
);
const AdminNotFound = lazy(() =>
  import("./features/admin/AdminNotFound").then((m) => ({ default: m.AdminNotFound })),
);
const ReviewPage = lazy(() =>
  import("./features/admin/review/ReviewPage").then((m) => ({ default: m.ReviewPage })),
);
const InventoryPage = lazy(() =>
  import("./features/admin/inventory/InventoryPage").then((m) => ({ default: m.InventoryPage })),
);
const IssuePage = lazy(() =>
  import("./features/admin/issue/IssuePage").then((m) => ({ default: m.IssuePage })),
);
const ReturnsPage = lazy(() =>
  import("./features/admin/returns/ReturnsPage").then((m) => ({ default: m.ReturnsPage })),
);
const HistoryPage = lazy(() =>
  import("./features/admin/history/HistoryPage").then((m) => ({ default: m.HistoryPage })),
);
const RequireStaff = lazy(() =>
  import("./features/admin/RequireStaff").then((m) => ({ default: m.RequireStaff })),
);

function PageFallback() {
  return (
    <div>
      <SkeletonLines count={5} />
    </div>
  );
}

function ClientRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Wizard />} />
      <Route path="/request/:id" element={<RequestPage />} />
      <Route path="/r/:token" element={<TokenPage />} />
      {PickerBench && <Route path="/__dev/picker-bench" element={<PickerBench />} />}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Relative to the "/admin/*" prefix the parent <Route> already consumed —
// "login" here matches /admin/login, "review" matches /admin/review, etc.
function AdminRoutes() {
  return (
    <Routes>
      <Route path="login" element={<AdminLoginPage />} />
      <Route
        path="/"
        element={
          <RequireStaff>
            <AdminLayout />
          </RequireStaff>
        }
      >
        <Route index element={<AdminHome />} />
        <Route
          path="review"
          element={
            <RequireStaff roles={["admin"]}>
              <ReviewPage />
            </RequireStaff>
          }
        />
        <Route
          path="review/:id"
          element={
            <RequireStaff roles={["admin"]}>
              <ReviewPage />
            </RequireStaff>
          }
        />
        <Route
          path="inventory"
          element={
            <RequireStaff roles={["admin", "inventory_manager"]}>
              <InventoryPage />
            </RequireStaff>
          }
        />
        <Route
          path="issue"
          element={
            <RequireStaff roles={["admin", "inventory_manager"]}>
              <IssuePage />
            </RequireStaff>
          }
        />
        <Route
          path="issue/:id"
          element={
            <RequireStaff roles={["admin", "inventory_manager"]}>
              <IssuePage />
            </RequireStaff>
          }
        />
        <Route
          path="returns"
          element={
            <RequireStaff roles={["admin", "inventory_manager"]}>
              <ReturnsPage />
            </RequireStaff>
          }
        />
        <Route
          path="returns/:id"
          element={
            <RequireStaff roles={["admin", "inventory_manager"]}>
              <ReturnsPage />
            </RequireStaff>
          }
        />
        <Route
          path="history"
          element={
            <RequireStaff roles={["admin", "inventory_manager"]}>
              <HistoryPage />
            </RequireStaff>
          }
        />
        <Route
          path="history/:id"
          element={
            <RequireStaff roles={["admin", "inventory_manager"]}>
              <HistoryPage />
            </RequireStaff>
          }
        />
        <Route path="*" element={<AdminNotFound />} />
      </Route>
    </Routes>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <ErrorBoundary label="The staff dashboard">
              <AdminRoutes />
            </ErrorBoundary>
          }
        />
        <Route
          path="/*"
          element={
            <ErrorBoundary label="This page">
              <ClientRoutes />
            </ErrorBoundary>
          }
        />
      </Routes>
    </Suspense>
  );
}
