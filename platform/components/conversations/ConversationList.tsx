"use client";

import { useMemo, useState } from "react";
import type { Lead } from "@/lib/types";
import { badgeForBucket } from "@/lib/types";
import { waitInfo } from "@/lib/wait";
import { Badge } from "@/components/Badge";
import { SENDER_LABEL, SENDER_LABEL_COLOR } from "./senderMeta";
import styles from "./ConversationList.module.css";

type Tab = "needsReply" | "all" | "unread";

function timeLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.round(hr / 24)}d`;
}

export function ConversationList({
  leads,
  activeId,
  onSelect,
}: {
  leads: Lead[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("all");

  const needsReply = useMemo(() => leads.filter((l) => l.lastMessageDirection === "inbound"), [leads]);
  const unread = useMemo(() => leads.filter((l) => l.unreadCount > 0), [leads]);

  const visible = tab === "needsReply" ? needsReply : tab === "unread" ? unread : leads;

  return (
    <div className={`${styles.list} scry`}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "needsReply" ? styles.tabActiveReply : ""}`}
          onClick={() => setTab("needsReply")}
        >
          <span className={styles.tabDot} />
          Needs reply · <span className="tnum">{needsReply.length}</span>
        </button>
        <button className={`${styles.tab} ${tab === "all" ? styles.tabActive : ""}`} onClick={() => setTab("all")}>
          All · <span className="tnum">{leads.length}</span>
        </button>
        <button
          className={`${styles.tab} ${tab === "unread" ? styles.tabActive : ""}`}
          onClick={() => setTab("unread")}
        >
          Unread · <span className="tnum">{unread.length}</span>
        </button>
      </div>

      <div className={styles.filterRow}>
        <span className={styles.filterKicker}>Filter</span>
        <button className={styles.filterBtn}>County ▾</button>
        <button className={styles.filterBtn}>Classification ▾</button>
        <button className={styles.filterBtn}>Assigned ▾</button>
        <button className={styles.filterBtn}>Sort ▾</button>
      </div>

      {visible.map((lead) => {
        const wi = waitInfo(lead);
        const selected = lead.id === activeId;
        const badgeKind = badgeForBucket(lead.triageBucket);
        const sender = lead.messages[lead.messages.length - 1]?.sender ?? "automation";
        const leftBorder = selected ? "var(--brand)" : wi.owe === "you" ? "rgba(236,48,19,0.5)" : "transparent";

        return (
          <button
            key={lead.id}
            onClick={() => onSelect(lead.id)}
            className={`${styles.item} ${selected ? styles.itemSelected : ""}`}
            style={{ borderLeftColor: leftBorder }}
          >
            <div className={styles.row}>
              <span className={styles.name}>{lead.name}</span>
              <span className={`${styles.time} tnum`}>{timeLabel(lead.lastMessageAt)}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.senderLabel} style={{ color: SENDER_LABEL_COLOR[sender] }}>
                {SENDER_LABEL[sender]}
              </span>
              <span className={styles.dotSep}>·</span>
              <span className={`${styles.county} tnum`}>{lead.county}</span>
              {lead.unreadCount > 0 ? (
                <span className={`${styles.unreadChip} tnum`}>{lead.unreadCount}</span>
              ) : null}
            </div>
            <div className={styles.preview}>{lead.lastMessageBody}</div>
            <div className={styles.waitRow}>
              <span className={styles.waitDot} style={{ background: wi.dot }} />
              <span className={styles.waitLabel} style={{ color: wi.color }}>
                {wi.label}
              </span>
            </div>
            {badgeKind ? (
              <div className={styles.badgeRow}>
                <Badge kind={badgeKind} />
              </div>
            ) : null}
          </button>
        );
      })}

      {visible.length === 0 ? <div className={styles.empty}>No conversations in this view.</div> : null}
    </div>
  );
}
