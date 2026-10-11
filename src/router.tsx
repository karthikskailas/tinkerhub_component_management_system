import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
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
const PlaceholderPage = lazy(() =>
  import("./features/admin/PlaceholderPage").then((m) => ({ default: m.PlaceholderPage })),
);
const ReviewPage = lazy(() =>
  import("./features/admin/review/ReviewPage").then((m) => ({ default: m.ReviewPage })),
);
const RequireStaff = lazy(() =>
  import("./features/admin/RequireStaff").then((m) => ({ default: m.RequireStaff })),
);

function PageFallback() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <SkeletonLines count={5} />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Wizard />} />
        <Route path="/request/:id" element={<RequestPage />} />
        <Route path="/r/:token" element={<TokenPage />} />

        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
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
                <PlaceholderPage title="Inventory" />
              </RequireStaff>
            }
          />
          <Route
            path="returns"
            element={
              <RequireStaff roles={["admin", "inventory_manager"]}>
                <PlaceholderPage title="Returns" />
              </RequireStaff>
            }
          />
          <Route
            path="history"
            element={
              <RequireStaff roles={["admin", "inventory_manager"]}>
                <PlaceholderPage title="History" />
              </RequireStaff>
            }
          />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
