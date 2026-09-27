import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { Layout } from "./components/Layout";
import { LoginPage } from "./features/auth/LoginPage";
import { OverviewPage } from "./features/overview/OverviewPage";
import { DealsListPage } from "./features/deals/DealsListPage";
import { DealDetailPage } from "./features/deals/DealDetailPage";
import { LearningsPage } from "./features/learnings/LearningsPage";
import { LearningDetailPage } from "./features/learnings/LearningDetailPage";
import { RecommendationsPage } from "./features/recommendations/RecommendationsPage";
import { AgentPage } from "./features/agent/AgentPage";
import { SettingsPage } from "./features/settings/SettingsPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400 dark:bg-slate-950">
        Loading...
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/deals" element={<DealsListPage />} />
        <Route path="/deals/:dealId" element={<DealDetailPage />} />
        <Route path="/learnings" element={<LearningsPage />} />
        <Route path="/learnings/:patternId" element={<LearningDetailPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
