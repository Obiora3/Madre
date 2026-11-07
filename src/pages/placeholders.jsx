// Temporary screens for the v2 build. Each is replaced as its build step lands.
import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider.jsx";
import { EmptyState, PageHeader } from "../components/ui.jsx";

export function Home() {
  const { me } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <>
      <PageHeader title={`${greeting}, ${me?.name?.split(" ")[0] ?? ""}`} subtitle="Here's what needs your attention." />
      <EmptyState title="Your tasks will appear here">Home is built in step 6, once projects and tasks exist.</EmptyState>
    </>
  );
}

export function Projects() {
  return (
    <>
      <PageHeader title="Projects" />
      <EmptyState title="Projects are coming next">The projects table and tasks are build step 2.</EmptyState>
    </>
  );
}

export function ProjectDetail() {
  return (
    <>
      <PageHeader title="Project" />
      <EmptyState title="Project page">Built in step 3.</EmptyState>
    </>
  );
}

export function Clients() {
  return (
    <>
      <PageHeader title="Clients" />
      <EmptyState title="Clients">Built in step 6.</EmptyState>
    </>
  );
}

export function NotFound() {
  return (
    <EmptyState title="Page not found" action={<Link to="/" className="font-medium text-accent">Go home</Link>}>
      That link doesn't point to anything in Madre.
    </EmptyState>
  );
}
