// Validates the one open risk in wiki/decisions/0004-plataforma-pausada.md and the
// implementation plan's Fase 2 step 1: does Vercel's serverless `fetch` reach the
// GHL/LeadConnector API without being blocked by Cloudflare, the way `curl` does from
// a local machine (confirmed working) but Python's urllib/requests do NOT (confirmed
// blocked, see SELLER-DOSSIER-PLAYBOOK.md §0)?
//
// This route makes ONE read-only GET call (list contacts, limit 1) and reports whether
// the response is real JSON from the GHL API or an HTML Cloudflare challenge page.
// It never logs or returns the token. Delete or gate this route once the platform's
// real API routes exist — it's a one-time diagnostic, not a permanent surface.

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!token || !locationId) {
    return Response.json(
      {
        ok: false,
        stage: "config",
        message:
          "Faltam as env vars GHL_API_TOKEN e/ou GHL_LOCATION_ID no projeto da Vercel.",
      },
      { status: 500 }
    );
  }

  const url = `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=1`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: "2021-07-28",
      },
      cache: "no-store",
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        stage: "network",
        message: "A chamada nem saiu — erro de rede no fetch.",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }

  const contentType = res.headers.get("content-type") || "";
  const bodyText = await res.text();

  const looksLikeJson = contentType.includes("application/json");
  let parsed: unknown = null;
  if (looksLikeJson) {
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      // fall through — treat as blocked below
    }
  }

  const blockedByCloudflare =
    !looksLikeJson || parsed === null || bodyText.includes("Cloudflare") || bodyText.includes("cf-error");

  if (blockedByCloudflare) {
    return Response.json(
      {
        ok: false,
        stage: "cloudflare",
        message:
          "BLOQUEADO: a resposta não é JSON da API do GHL — parece um desafio do Cloudflare, " +
          "igual ao que acontece com python urllib/requests. Vercel fetch teria o mesmo problema " +
          "que os clientes HTTP do Python. Precisa do caminho alternativo (ver wiki/decisions/0004).",
        httpStatus: res.status,
        contentType,
        bodyPreview: bodyText.slice(0, 500),
      },
      { status: 200 }
    );
  }

  return Response.json({
    ok: true,
    stage: "success",
    message:
      "OK: a Vercel conseguiu falar com a API do GHL normalmente, resposta JSON válida recebida. " +
      "O risco do Cloudflare NÃO se aplica ao ambiente serverless — pode seguir com o resto da Fase 2.",
    httpStatus: res.status,
    contentType,
  });
}
