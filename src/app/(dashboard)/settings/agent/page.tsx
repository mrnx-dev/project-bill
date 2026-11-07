import { notFound } from "next/navigation";

// AI assistant is disabled in production — the settings page is a bare 404.
export default function AgentSettingsPage() {
  notFound();
}
