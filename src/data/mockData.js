// ─── MOCK DATA ────────────────────────────────────────────────────────────────
export const MOCK_USERS = [
  { id: "u1", name: "Adaeze Okoye", email: "adaeze@agency.io", role: "admin", department: "Creative", department_id: "d1", job_title: "Creative Director", skills: ["Branding", "Art Direction", "Strategy"], avatar_url: null },
  { id: "u2", name: "James Eriksson", email: "james@agency.io", role: "lead", department: "Strategy", department_id: "d2", job_title: "Head of Strategy", skills: ["Media Planning", "Analytics", "Client Services"], avatar_url: null },
  { id: "u3", name: "Priya Nair", email: "priya@agency.io", role: "user", department: "Creative", department_id: "d1", job_title: "Senior Designer", skills: ["UI/UX", "Motion", "Print"], avatar_url: null },
  { id: "u4", name: "Marcus Cole", email: "marcus@agency.io", role: "user", department: "Strategy", department_id: "d2", job_title: "Strategist", skills: ["SEO", "Analytics", "Copywriting"], avatar_url: null },
  { id: "u5", name: "Lena Hoffmann", email: "lena@agency.io", role: "user", department: "Production", department_id: "d3", job_title: "Producer", skills: ["Project Management", "Video", "Events"], avatar_url: null },
];

export const MOCK_CLIENTS = [
  { id: "c1", name: "NovaBrand", brand: "NovaBrand", industry: "Technology", primary_contact: { name: "Sam Lee", email: "sam@novabrand.com", phone: "+1 555 0101" }, status: "Active", health_score: 88, notes: "Long-term retainer client.", logo_url: null },
  { id: "c2", name: "Luxe Mode", brand: "Luxe Mode", industry: "Fashion", primary_contact: { name: "Claire Dubois", email: "claire@luxemode.fr", phone: "+33 1 5566 7788" }, status: "Active", health_score: 72, notes: "Brand campaign Q2.", logo_url: null },
  { id: "c3", name: "HealthFirst", brand: "HealthFirst", industry: "Healthcare", primary_contact: { name: "Dr. Amara Mensah", email: "amara@healthfirst.org", phone: "+233 20 000 0000" }, status: "Active", health_score: 95, notes: "Awareness campaign.", logo_url: null },
  { id: "c4", name: "RetailPro", brand: "RetailPro", industry: "Retail", primary_contact: { name: "Tony Kweku", email: "tony@retailpro.com", phone: "+1 555 0202" }, status: "On Hold", health_score: 55, notes: "Budget review pending.", logo_url: null },
];

export const MOCK_PROJECTS = [
  { id: "p1", title: "NovaBrand Q2 Campaign", client_id: "c1", description: "Full-funnel digital campaign for Q2 product launch.", stage: "Creative", priority: "Critical", assigned_to: { name: "Adaeze Okoye", email: "adaeze@agency.io" }, start_date: "2026-04-01", due_date: "2026-06-15", status: "Active", progress: 60, kpi_summary: "Target 2M impressions, 3.5% CTR" },
  { id: "p2", title: "Luxe Mode AW26 Lookbook", client_id: "c2", description: "Autumn/Winter 2026 editorial and digital lookbook.", stage: "Strategy", priority: "High", assigned_to: { name: "Priya Nair", email: "priya@agency.io" }, start_date: "2026-05-01", due_date: "2026-07-30", status: "Active", progress: 25, kpi_summary: "10K downloads, press coverage in 5 outlets" },
  { id: "p3", title: "HealthFirst Awareness", client_id: "c3", description: "Public awareness campaign across Lagos and Abuja.", stage: "Brief", priority: "Medium", assigned_to: { name: "James Eriksson", email: "james@agency.io" }, start_date: "2026-05-10", due_date: "2026-08-01", status: "Active", progress: 10, kpi_summary: "Reach 500K, brand recall +15%" },
  { id: "p4", title: "RetailPro In-Store Refresh", client_id: "c4", description: "Visual identity refresh for 20 retail locations.", stage: "Review", priority: "Low", assigned_to: { name: "Marcus Cole", email: "marcus@agency.io" }, start_date: "2026-03-01", due_date: "2026-05-20", status: "On Hold", progress: 80, kpi_summary: "Full rebrand rollout" },
  { id: "p5", title: "NovaBrand Social Series", client_id: "c1", description: "12-part social media content series.", stage: "Delivered", priority: "Medium", assigned_to: { name: "Lena Hoffmann", email: "lena@agency.io" }, start_date: "2026-02-01", due_date: "2026-04-30", status: "Completed", progress: 100, kpi_summary: "+40% engagement rate" },
];

export const MOCK_TASKS = [
  { id: "t1", title: "Design hero banner concepts", project_id: "p1", description: "3 concepts for the hero banner", assigned_to: { email: "priya@agency.io", name: "Priya Nair" }, status: "In Progress", priority: "High", due_date: "2026-05-14", estimated_hours: 8, actual_hours: 5, dependency_type: "None", depends_on: null },
  { id: "t2", title: "Strategy brief sign-off", project_id: "p1", description: "Get client sign-off on strategy", assigned_to: { email: "james@agency.io", name: "James Eriksson" }, status: "Done", priority: "Critical", due_date: "2026-05-09", estimated_hours: 2, actual_hours: 2, dependency_type: "None", depends_on: null },
  { id: "t3", title: "Media plan draft", project_id: "p2", description: "Draft Q3 media plan", assigned_to: { email: "marcus@agency.io", name: "Marcus Cole" }, status: "To Do", priority: "Medium", due_date: "2026-05-18", estimated_hours: 6, actual_hours: 0, dependency_type: "Finish-to-Start", depends_on: "t2" },
  { id: "t4", title: "Lookbook photography brief", project_id: "p2", description: "Prepare brief for photographer", assigned_to: { email: "priya@agency.io", name: "Priya Nair" }, status: "To Do", priority: "High", due_date: "2026-05-12", estimated_hours: 3, actual_hours: 0, dependency_type: "None", depends_on: null },
  { id: "t5", title: "Client onboarding call", project_id: "p3", description: "Initial briefing call with HealthFirst team", assigned_to: { email: "james@agency.io", name: "James Eriksson" }, status: "In Review", priority: "Medium", due_date: "2026-05-15", estimated_hours: 2, actual_hours: 2, dependency_type: "None", depends_on: null },
  { id: "t6", title: "Store layout renders", project_id: "p4", description: "Final renders for 5 store types", assigned_to: { email: "lena@agency.io", name: "Lena Hoffmann" }, status: "Done", priority: "Low", due_date: "2026-05-08", estimated_hours: 12, actual_hours: 14, dependency_type: "None", depends_on: null },
  { id: "t7", title: "Copy review pass", project_id: "p1", description: "Final copy review for campaign", assigned_to: { email: "marcus@agency.io", name: "Marcus Cole" }, status: "To Do", priority: "Medium", due_date: "2026-05-11", estimated_hours: 4, actual_hours: 0, dependency_type: "None", depends_on: null },
  { id: "t8", title: "Social assets upload", project_id: "p5", description: "Upload final deliverables to client portal", assigned_to: { email: "lena@agency.io", name: "Lena Hoffmann" }, status: "Done", priority: "Low", due_date: "2026-04-28", estimated_hours: 1, actual_hours: 1, dependency_type: "None", depends_on: null },
];

export const MOCK_KPIS = [
  { id: "k1", name: "Impressions", project_id: "p1", client_name: "NovaBrand", category: "Brand Awareness", target_value: 2000000, current_value: 1200000, unit: "Count", status: "On Track", notes: "Pacing well for Q2" },
  { id: "k2", name: "Click-Through Rate", project_id: "p1", client_name: "NovaBrand", category: "Engagement", target_value: 3.5, current_value: 2.9, unit: "%", status: "At Risk", notes: "Need to A/B test creatives" },
  { id: "k3", name: "Lookbook Downloads", project_id: "p2", client_name: "Luxe Mode", category: "Lead Generation", target_value: 10000, current_value: 0, unit: "Count", status: "Not Started", notes: "" },
  { id: "k4", name: "Brand Recall Uplift", project_id: "p3", client_name: "HealthFirst", category: "Brand Awareness", target_value: 15, current_value: 0, unit: "%", status: "Not Started", notes: "Baseline survey pending" },
  { id: "k5", name: "Social Engagement Rate", project_id: "p5", client_name: "NovaBrand", category: "Engagement", target_value: 40, current_value: 47, unit: "%", status: "Achieved", notes: "Exceeded target by 7%" },
];

export const MOCK_DEPARTMENTS = [
  { id: "d1", name: "Creative", colour: "#7C3AED", description: "Design, art direction, and brand identity", lead: "adaeze@agency.io", members: ["adaeze@agency.io", "priya@agency.io"] },
  { id: "d2", name: "Strategy", colour: "#0891B2", description: "Media planning, analytics, and client strategy", lead: "james@agency.io", members: ["james@agency.io", "marcus@agency.io"] },
  { id: "d3", name: "Production", colour: "#059669", description: "Events, video, and production management", lead: null, members: ["lena@agency.io"] },
];

export const MOCK_PITCHES = [
  { id: "pi1", title: "Apex Finance Brand Refresh", prospect_company: "Apex Finance", contact_name: "Rachel Osei", contact_email: "r.osei@apexfinance.com", industry: "Finance", stage: "Proposal Sent", estimated_value: 85000, currency: "USD", win_probability: 65, pitch_type: "Brand Campaign", owner: "adaeze@agency.io", decision_date: "2026-06-01", notes: "Follow up after bank holiday" },
  { id: "pi2", title: "FoodCo Social Retainer", prospect_company: "FoodCo Nigeria", contact_name: "Emeka Obi", contact_email: "emeka@foodco.ng", industry: "Food & Beverage", stage: "Negotiation", estimated_value: 48000, currency: "USD", win_probability: 80, pitch_type: "Retainer", owner: "james@agency.io", decision_date: "2026-05-25", notes: "Contract review with legal" },
  { id: "pi3", title: "AutoPride Campaign", prospect_company: "AutoPride", contact_name: "Ken Balogun", contact_email: "ken@autopride.ng", industry: "Automotive", stage: "Qualified", estimated_value: 120000, currency: "USD", win_probability: 40, pitch_type: "Brand Campaign", owner: "adaeze@agency.io", decision_date: "2026-07-15", notes: "Awaiting brief from client" },
  { id: "pi4", title: "LearnUp App Launch", prospect_company: "LearnUp", contact_name: "Tobi Adeyemi", contact_email: "tobi@learnup.io", industry: "Technology", stage: "Won", estimated_value: 60000, currency: "USD", win_probability: 100, pitch_type: "Project-based", owner: "marcus@agency.io", decision_date: "2026-05-01", notes: "Contracts signed" },
];

export const MOCK_ACTIVITIES = [
  { id: "a1", type: "project_created", description: "Project 'NovaBrand Q2 Campaign' created", user: "Adaeze Okoye", timestamp: "2026-05-11T09:30:00Z" },
  { id: "a2", type: "task_done", description: "Task 'Strategy brief sign-off' marked complete", user: "James Eriksson", timestamp: "2026-05-11T08:15:00Z" },
  { id: "a3", type: "kpi_updated", description: "KPI 'Click-Through Rate' updated to 2.9%", user: "Marcus Cole", timestamp: "2026-05-10T17:45:00Z" },
  { id: "a4", type: "client_added", description: "Client 'HealthFirst' added to platform", user: "Adaeze Okoye", timestamp: "2026-05-10T11:00:00Z" },
  { id: "a5", type: "task_assigned", description: "Task 'Media plan draft' assigned to Marcus Cole", user: "James Eriksson", timestamp: "2026-05-09T16:20:00Z" },
];
