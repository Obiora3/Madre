import { React, useApp } from "./_shared.js";
import { AIBrief } from "./AIBrief.jsx";
import { Benchmarking } from "./Benchmarking.jsx";
import { Clients } from "./Clients.jsx";
import { Dashboard } from "./Dashboard.jsx";
import { DeliveryScores } from "./DeliveryScores.jsx";
import { Departments } from "./Departments.jsx";
import { KPIs } from "./KPIs.jsx";
import { PitchPipeline } from "./PitchPipeline.jsx";
import { Profitability } from "./Profitability.jsx";
import { ProjectDetail } from "./ProjectDetail.jsx";
import { Projects } from "./Projects.jsx";
import { Reports } from "./Reports.jsx";
import { Tasks } from "./Tasks.jsx";
import { Team } from "./Team.jsx";
import { Timeline } from "./Timeline.jsx";
import { WhiteLabel } from "./WhiteLabel.jsx";
import { Profile } from "./Profile.jsx";

// ─── PAGE ROUTER ──────────────────────────────────────────────────────────────
export const PageRouter = React.memo(function PageRouter() {
  const { page } = useApp();
  switch (page) {
    case "dashboard":       return <Dashboard />;
    case "projects":        return <Projects />;
    case "project-detail":  return <ProjectDetail />;
    case "tasks":           return <Tasks />;
    case "team":            return <Team />;
    case "clients":         return <Clients />;
    case "kpis":            return <KPIs />;
    case "timeline":        return <Timeline />;
    case "reports":         return <Reports />;
    case "ai-brief":        return <AIBrief />;
    case "profitability":   return <Profitability />;
    case "pitches":         return <PitchPipeline />;
    case "benchmarking":    return <Benchmarking />;
    case "departments":     return <Departments />;
    case "delivery-scores": return <DeliveryScores />;
    case "settings":        return <WhiteLabel />;
    case "white-label":     return <WhiteLabel />;
    case "profile":         return <Profile />;
    default:                return <Dashboard />;
  }
})
