// Minimal server-only GHL / LeadConnector API client. Used for write-back:
// pushing our stage changes onto the matching SwiftScale opportunity. Never
// import from a Client Component — this reads GHL_API_TOKEN. Confirmed that
// Vercel's serverless fetch reaches this API (the /api/cloudflare-check probe
// returned ok:true) — unlike local Python urllib, which Cloudflare 1010-blocks.

const BASE = "https://services.leadconnectorhq.com";

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
  };
}

/** Find the (open) opportunity id for a contact, or null if none. */
export async function findOpportunityId(ghlContactId: string): Promise<string | null> {
  const loc = process.env.GHL_LOCATION_ID;
  const res = await fetch(
    `${BASE}/opportunities/search?location_id=${loc}&contact_id=${ghlContactId}`,
    { headers: headers(), cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { opportunities?: { id: string }[] };
  return data.opportunities?.[0]?.id ?? null;
}

/** Move an opportunity to a pipeline stage. Returns whether GHL accepted it. */
export async function updateOpportunityStage(
  opportunityId: string,
  pipelineId: string,
  pipelineStageId: string,
): Promise<boolean> {
  const res = await fetch(`${BASE}/opportunities/${opportunityId}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ pipelineId, pipelineStageId }),
  });
  return res.ok;
}
