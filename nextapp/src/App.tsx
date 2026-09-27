import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { Layout } from "./components/Layout";
import { OverviewPage } from "./features/overview/OverviewPage";
import { DealsListPage } from "./features/deals/DealsListPage";
import { DealDetailPage } from "./features/deals/DealDetailPage";
import { LearningsPage } from "./features/learnings/LearningsPage";
import { LearningDetailPage } from "./features/learnings/LearningDetailPage";
import { RecommendationsPage } from "./features/recommendations/RecommendationsPage";
import { AgentPage } from "./features/agent/AgentPage";
import { SettingsPage } from "./features/settings/SettingsPage";

// Login has been removed: the backend treats every request as a single
// default demo user (see nextapp/lib/auth.ts), so this just waits for that
// user to resolve before rendering the app shell.
function WaitForUser({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400 dark:bg-slate-950">
        Loading...
      </div>
    );
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        element={
          <WaitForUser>
            <Layout />
          </WaitForUser>
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
