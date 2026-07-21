"use client";

import Link from "next/link";
import type { Lead } from "@/lib/types";
import { badgeForBucket } from "@/lib/types";
import { Badge } from "@/components/Badge";
import { assignedToLabel, formatDate, money } from "@/lib/format";
import { agoLabel } from "@/lib/wait";
import styles from "./DetailDrawer.module.css";

export function DetailDrawer({
  lead,
  onClose,
  onOpenDossier,
}: {
  lead: Lead;
  onClose: () => void;
  onOpenDossier: () => void;
}) {
  const badgeKind = badgeForBucket(lead.triageBucket);

  const lastInbound =
    [...lead.messages].reverse().find((m) => m.direction === "inbound")?.body ??
    (lead.lastMessageDirection === "inbound" ? lead.lastMessageBody : null);

  const rows: { k: string; v: string }[] = [
    { k: "Stage", v: lead.stage },
    { k: "County", v: `${lead.county}, TN` },
    { k: "Acreage", v: lead.acreage === "—" ? "—" : `${lead.acreage} ac` },
    { k: "Assessed value", v: lead.assessedValue != null ? money(lead.assessedValue) : "—" },
    { k: "Est. resale", v: lead.estResale != null ? money(lead.estResale) : "—" },
    { k: "Assigned to", v: assignedToLabel(lead) },
    { k: "Source list", v: lead.sourceList ?? "—" },
    { k: "First contact", v: formatDate(lead.firstContactAt) },
  ];

  return (
    <aside className={`${styles.drawer} scry`}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.kicker}>Lead detail</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close lead detail">
            ✕
          </button>
        </div>
        <div className={styles.name}>{lead.name}</div>
        <div className={`${styles.phone} tnum`}>
          {lead.phone} · <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}>call</a>
        </div>
        {badgeKind && (
          <div className={styles.badgeRow}>
            <Badge kind={badgeKind} />
          </div>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.defList}>
          {rows.map((r) => (
            <div className={styles.defRow} key={r.k}>
              <span className={styles.defKey}>{r.k}</span>
              <span className={`${styles.defValue} tnum`}>{r.v}</span>
            </div>
          ))}
        </div>

        <div className={styles.sectionTitle}>Last inbound</div>
        <div className={styles.quote}>
          {lastInbound ? `"${lastInbound}"` : "No inbound messages yet."}
        </div>

        <div className={styles.sectionTitle}>Notes</div>
        {lead.notes.length === 0 ? (
          <div className={styles.dash}>No notes yet.</div>
        ) : (
          <div className={styles.notesList}>
            {lead.notes.map((n) => (
              <div className={styles.note} key={n.id}>
                {n.body}
                <div className={styles.noteMeta}>
                  {n.author} · {agoLabel(n.at)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.actions}>
          <Link href="/conversations" className={styles.primaryBtn}>
            Open conversation
          </Link>
          <button className={styles.ghostBtn} onClick={onOpenDossier}>
            Dossier
          </button>
        </div>
      </div>
    </aside>
  );
}
