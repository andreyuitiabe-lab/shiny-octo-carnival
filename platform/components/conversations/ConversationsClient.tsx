"use client";

import { useState } from "react";
import { LEADS } from "@/lib/mock-data";
import type { Lead, Message, Stage, SystemNote } from "@/lib/types";
import { ConversationList } from "@/components/conversations/ConversationList";
import { Thread } from "@/components/conversations/Thread";
import { SellerDossierPanel } from "@/components/SellerDossierPanel";
import styles from "@/app/conversations/page.module.css";

// Default active thread: l2 (Rhonda Beckett) has real back-and-forth engagement,
// per the design handoff, rather than a lead with only the opening blast.
const DEFAULT_LEAD_ID = LEADS.some((l) => l.id === "l2") ? "l2" : LEADS[0]?.id ?? null;

// `initialLeadId` comes from the ?lead= query param (e.g. a Kanban card click
// deep-links here). Falls back to the default engaged thread when absent/unknown.
export default function ConversationsClient({ initialLeadId }: { initialLeadId?: string }) {
  const startId =
    initialLeadId && LEADS.some((l) => l.id === initialLeadId) ? initialLeadId : DEFAULT_LEAD_ID;

  const [leads, setLeads] = useState<Lead[]>(LEADS);
  const [activeId, setActiveId] = useState<string | null>(startId);
  const [dossierOpen, setDossierOpen] = useState(false);

  const activeLead = leads.find((l) => l.id === activeId) ?? null;

  function updateLead(id: string, update: (lead: Lead) => Lead) {
    setLeads((prev) => prev.map((l) => (l.id === id ? update(l) : l)));
  }

  function handleStageChange(stage: Stage) {
    if (!activeLead) return;
    updateLead(activeLead.id, (l) => ({
      ...l,
      stage,
      stageHistory: [...l.stageHistory, { stage, at: new Date().toISOString() }],
    }));
  }

  function handleSend(text: string) {
    if (!activeLead) return;
    const now = new Date().toISOString();
    const msg: Message = { id: `local-${Date.now()}`, direction: "outbound", body: text, at: now, sender: "a" };
    updateLead(activeLead.id, (l) => ({
      ...l,
      messages: [...l.messages, msg],
      lastMessageBody: text,
      lastMessageDirection: "outbound",
      lastMessageAt: now,
    }));
  }

  function handleAddNote(text: string) {
    if (!activeLead) return;
    const note: SystemNote = { id: `local-note-${Date.now()}`, body: text, at: new Date().toISOString(), author: "manual" };
    updateLead(activeLead.id, (l) => ({ ...l, notes: [...l.notes, note] }));
  }

  return (
    <div className={styles.root}>
      <ConversationList leads={leads} activeId={activeId} onSelect={setActiveId} />

      {activeLead ? (
        <Thread
          lead={activeLead}
          dossierOpen={dossierOpen}
          onToggleDossier={() => setDossierOpen((v) => !v)}
          onStageChange={handleStageChange}
          onSend={handleSend}
          onAddNote={handleAddNote}
        />
      ) : (
        <div className={styles.emptyThread}>Select a conversation.</div>
      )}

      {dossierOpen && activeLead ? (
        <SellerDossierPanel lead={activeLead} onClose={() => setDossierOpen(false)} />
      ) : null}
    </div>
  );
}
