"use client";

import { useMemo, useState } from "react";
import type { Lead, Stage } from "@/lib/types";
import { badgeForBucket, laneForStage } from "@/lib/types";
import { waitInfo } from "@/lib/wait";
import { ALL_STAGES } from "@/lib/stages";
import { Badge } from "@/components/Badge";
import { SENDER_LABEL, SENDER_LABEL_COLOR } from "./senderMeta";
import { MessageBubble, type TimelineItem } from "./MessageBubble";
import { Composer } from "./Composer";
import styles from "./Thread.module.css";

function ageLabel(iso: string | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.round(hr / 24)}d`;
}

export function Thread({
  lead,
  dossierOpen,
  onToggleDossier,
  onStageChange,
  onSend,
  onAddNote,
}: {
  lead: Lead;
  dossierOpen: boolean;
  onToggleDossier: () => void;
  onStageChange: (stage: Stage) => void;
  onSend: (text: string) => void;
  onAddNote: (text: string) => void;
}) {
  const [stageMenuOpen, setStageMenuOpen] = useState(false);

  const wi = waitInfo(lead);
  const badgeKind = badgeForBucket(lead.triageBucket);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...lead.messages.map((m) => ({ kind: "message" as const, ...m })),
      ...lead.notes.map((n) => ({ kind: "note" as const, ...n })),
    ];
    return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [lead.messages, lead.notes]);

  const lastInbound = useMemo(
    () => [...lead.messages].reverse().find((m) => m.direction === "inbound"),
    [lead.messages],
  );
  const lastOutbound = useMemo(
    () => [...lead.messages].reverse().find((m) => m.direction === "outbound"),
    [lead.messages],
  );
  const lastMessage = lead.messages[lead.messages.length - 1];
  const lastSender = lastMessage?.direction === "inbound" ? null : lastMessage?.sender ?? "automation";

  return (
    <div className={styles.thread}>
      <div className={styles.header}>
        <div>
          <div className={styles.name}>{lead.name}</div>
          <div className={`${styles.subline} tnum`}>
            {lead.phone} · {lead.county} · {lead.acreage} ac
          </div>
        </div>
        <div className={styles.headerRight}>
          {badgeKind ? <Badge kind={badgeKind} /> : null}
          <span className={styles.lastLabel}>Last:</span>
          <span className={styles.lastSender} style={{ color: lastSender ? SENDER_LABEL_COLOR[lastSender] : "var(--sem-blue-lt)" }}>
            {lastSender ? SENDER_LABEL[lastSender] : "Seller"}
          </span>
          <button
            className={`${styles.dossierBtn} ${dossierOpen ? styles.dossierBtnActive : ""}`}
            onClick={onToggleDossier}
          >
            ◧ Dossier
          </button>
        </div>
      </div>

      <div className={styles.waitBar}>
        <span className={styles.waitPill} style={{ color: wi.color }}>
          <span className={styles.waitDot} style={{ background: wi.dot }} />
          {wi.label}
        </span>
        <span className={`${styles.waitTimers} tnum`}>
          Seller replied {ageLabel(lastInbound?.at)} ago · you replied {ageLabel(lastOutbound?.at)} ago
        </span>
      </div>

      <div className={styles.stageBar}>
        <span className={styles.stageKicker}>Stage</span>
        <div className={styles.stageMenuWrap}>
          <button className={styles.stageBtn} onClick={() => setStageMenuOpen((v) => !v)}>
            <span className={styles.stageBtnLabel}>{lead.stage}</span>
            <span className={styles.stageBtnCaret}>▾</span>
          </button>
          {stageMenuOpen ? (
            <div className={styles.stagePopover}>
              {ALL_STAGES.map((s) => {
                const active = s === lead.stage;
                const highlighted = laneForStage(s) === "research";
                return (
                  <button
                    key={s}
                    className={styles.stageItem}
                    style={
                      active
                        ? {
                            background: "var(--nav-active-bg)",
                            borderLeft: `2px solid ${highlighted ? "var(--sem-green)" : "var(--brand)"}`,
                          }
                        : undefined
                    }
                    onClick={() => {
                      onStageChange(s);
                      setStageMenuOpen(false);
                    }}
                  >
                    <span className={styles.stageItemMark}>{active ? "✓" : ""}</span>
                    {s}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className={`${styles.messages} scry`}>
        {timeline.map((item) => (
          <MessageBubble key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </div>

      <Composer drafts={lead.drafts} onSend={onSend} onAddNote={onAddNote} />
    </div>
  );
}
