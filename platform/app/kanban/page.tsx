import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { fetchLeads } from "@/lib/leads-query";

export default async function KanbanPage() {
  const leads = await fetchLeads();
  return <KanbanBoard initialLeads={leads} />;
}
