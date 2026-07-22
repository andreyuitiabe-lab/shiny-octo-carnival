import ConversationsClient from "@/components/conversations/ConversationsClient";
import { fetchLeads } from "@/lib/leads-query";

// Server component: reads the ?lead= deep-link param (a Kanban card click sends
// the user here with a specific conversation pre-selected) and hands it to the
// client. Reading it server-side avoids the useSearchParams CSR-bailout / Suspense
// requirement entirely.
export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string | string[] }>;
}) {
  const { lead } = await searchParams;
  const initialLeadId = Array.isArray(lead) ? lead[0] : lead;
  const leads = await fetchLeads();
  return <ConversationsClient initialLeads={leads} initialLeadId={initialLeadId} />;
}
