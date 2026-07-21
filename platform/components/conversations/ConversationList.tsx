"use client";

import { useMemo, useState } from "react";
import type { Lead } from "@/lib/types";
import { badgeForBucket } from "@/lib/types";
import { waitInfo } from "@/lib/wait";
import { REFERENCE_NOW } from "@/lib/now";
import { Badge } from "@/components/Badge";
import { FilterDropdown } from "@/components/FilterDropdown";
import {
  ASSIGNED_OPTIONS,
  CLASSIFICATION_OPTIONS,
  EMPTY_FILTERS,
  countyOptions,
  matchesFilters,
  type Filters,
} from "@/lib/filters";
import { SENDER_LABEL, SENDER_LABEL_COLOR } from "./senderMeta";
import styles from "./ConversationList.module.css";

type Tab = "needsReply" | "all" | "unread";
type SortKey = "recent" | "oldest" | "name";

const SORT_OPTIONS = [
  { value: "recent", label: "Most recent" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name (A–Z)" },
];

function timeLabel(iso: string): string {
  const ms = REFERENCE_NOW - new Date(iso).getTime();
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
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<string | null>(null);

  const counties = useMemo(() => countyOptions(leads), [leads]);

  const needsReply = useMemo(() => leads.filter((l) => l.lastMessageDirection === "inbound"), [leads]);
  const unread = useMemo(() => leads.filter((l) => l.unreadCount > 0), [leads]);

  const byTab = tab === "needsReply" ? needsReply : tab === "unread" ? unread : leads;

  const visible = useMemo(() => {
    const filtered = byTab.filter((l) => matchesFilters(l, filters));
    const key = (sort ?? "recent") as SortKey;
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (key === "name") return a.name.localeCompare(b.name);
      const at = new Date(a.lastMessageAt).getTime();
      const bt = new Date(b.lastMessageAt).getTime();
      return key === "oldest" ? at - bt : bt - at;
    });
    return sorted;
  }, [byTab, filters, sort]);

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
        <FilterDropdown
          label="County"
          options={counties}
          value={filters.county}
          onChange={(v) => setFilters((f) => ({ ...f, county: v }))}
        />
        <FilterDropdown
          label="Classification"
          allLabel="All classifications"
          options={CLASSIFICATION_OPTIONS}
          value={filters.classification}
          onChange={(v) => setFilters((f) => ({ ...f, classification: v }))}
        />
        <FilterDropdown
          label="Assigned"
          allLabel="Anyone"
          options={ASSIGNED_OPTIONS}
          value={filters.assigned}
          onChange={(v) => setFilters((f) => ({ ...f, assigned: v }))}
        />
        <FilterDropdown label="Sort" allLabel="Most recent" options={SORT_OPTIONS} value={sort} onChange={setSort} />
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
