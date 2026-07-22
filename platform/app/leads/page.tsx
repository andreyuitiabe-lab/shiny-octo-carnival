import LeadsClient from "@/components/leads/LeadsClient";
import { fetchLeads } from "@/lib/leads-query";

export default async function LeadsPage() {
  const leads = await fetchLeads();
  return <LeadsClient initialLeads={leads} />;
}
