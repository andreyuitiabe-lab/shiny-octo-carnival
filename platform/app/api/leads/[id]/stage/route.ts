import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findOpportunityId, updateOpportunityStage } from "@/lib/ghl";
import { GHL_PIPELINE_ID, ghlStageId } from "@/lib/ghl-stages";
import { ALL_STAGES } from "@/lib/stages";
import type { Stage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Change a lead's stage: persist it to Supabase (our source of truth) AND mirror
// it onto the SwiftScale/GHL opportunity (one-way write-back, wiki ADR 0001).
// The GHL push is best-effort — if it fails, our change still sticks and the
// response says it didn't sync, so the UI can flag it rather than lie.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // This is a user action, not a webhook — require a logged-in operator.
  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { stage?: string } | null;
  const stage = body?.stage as Stage | undefined;
  if (!stage || !ALL_STAGES.includes(stage)) {
    return NextResponse.json({ ok: false, error: "invalid stage" }, { status: 400 });
  }

  const { data: contact, error: findErr } = await supa
    .from("contacts")
    .select("ghl_contact_id, our_stage")
    .eq("id", id)
    .single();
  if (findErr || !contact) {
    return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 });
  }

  // ── Persist to our system (source of truth) ────────────────────────────────
  const { error: updErr } = await supa.from("contacts").update({ our_stage: stage }).eq("id", id);
  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }
  await supa.from("stage_history").insert({
    contact_id: id,
    stage,
    reason: `movido na plataforma (${user.email ?? "operador"})`,
  });

  // ── Mirror onto SwiftScale (best-effort, one-way) ──────────────────────────
  let ghlSynced = false;
  let ghlNote: string | null = null;
  try {
    const oppId = await findOpportunityId(contact.ghl_contact_id as string);
    if (!oppId) {
      ghlNote = "sem opportunity no SwiftScale";
    } else {
      ghlSynced = await updateOpportunityStage(oppId, GHL_PIPELINE_ID, ghlStageId(stage));
      if (!ghlSynced) ghlNote = "SwiftScale recusou a atualização";
    }
  } catch (e) {
    ghlNote = e instanceof Error ? e.message : "falha ao falar com o SwiftScale";
  }

  return NextResponse.json({ ok: true, stage, ghlSynced, ghlNote });
}
