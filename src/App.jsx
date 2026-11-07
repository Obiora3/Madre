import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { useAuth } from "./auth/AuthProvider.jsx";
import { AppLayout } from "./layouts/AppLayout.jsx";
import { ErrorText, FullPageSpinner } from "./components/ui.jsx";
import { ResetPassword, SignIn } from "./pages/SignIn.jsx";
import { Onboarding } from "./pages/Onboarding.jsx";
import { Settings } from "./pages/Settings.jsx";
import { Clients, Home, NotFound, ProjectDetail, Projects } from "./pages/placeholders.jsx";

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "projects", element: <Projects /> },
      { path: "projects/:projectId", element: <ProjectDetail /> },
      { path: "clients", element: <Clients /> },
      { path: "settings/*", element: <Settings /> },
      { path: "signin", element: <Navigate to="/" replace /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

// Decides which top-level screen a visitor sees: sign-in, onboarding or the app.
export function App() {
  const { session, loading, error, workspace, recovering, finishRecovery } = useAuth();

  if (loading) return <FullPageSpinner />;
  if (recovering) return <ResetPassword onDone={finishRecovery} />;
  if (!session) return <SignIn />;
  if (error) return <div className="mx-auto max-w-md p-8"><ErrorText error={error} /></div>;
  if (!workspace) return <Onboarding />;
  return <RouterProvider router={router} />;
}
