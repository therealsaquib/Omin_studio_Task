import { Suspense, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/AuthProvider";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";

import { OverviewPage } from "./pages/OverviewPage";
import { RequestsPage } from "./pages/RequestsPage";
import { RequestDetailPage } from "./pages/RequestDetailPage";
import { RequestFormPage } from "./pages/RequestFormPage";
import { WorkItemsPage } from "./pages/WorkItemsPage";
import { ActivityPage } from "./pages/ActivityPage";

export default function App() {
  useEffect(() => {
    document.title = "Omni Client System";
  }, []);

  return (
    <Suspense fallback={<div className="app-loading"><span className="spinner" />Loading page…</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<OverviewPage />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="requests/new" element={<RequestFormPage />} />
            <Route path="requests/:id/edit" element={<RequestFormPage />} />
            <Route path="requests/:id" element={<RequestDetailPage />} />
            <Route path="work-items" element={<WorkItemsPage />} />
            <Route path="activity" element={<ActivityPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
