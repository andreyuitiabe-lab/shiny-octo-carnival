"use client";

import type { Lead } from "@/lib/types";
import { badgeForBucket } from "@/lib/types";
import { Badge } from "@/components/Badge";
import { lastSenderLabel } from "@/lib/format";
import { agoLabel } from "@/lib/wait";
import styles from "./LeadsTable.module.css";

export type SortKey = "name" | "county" | "acres" | "stage" | "classification" | "last" | "updated";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "Lead" },
  { key: "county", label: "County" },
  { key: "acres", label: "Acres", align: "right" },
  { key: "stage", label: "Stage" },
  { key: "classification", label: "Classification" },
  { key: "last", label: "Last" },
  { key: "updated", label: "Updated" },
];

interface Props {
  leads: Lead[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  openLeadId: string | null;
  onOpenLead: (lead: Lead) => void;
}

export function LeadsTable({
  leads,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  sortKey,
  sortDir,
  onSort,
  openLeadId,
  onOpenLead,
}: Props) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.headerRow}>
            <th className={styles.checkCol}>
              <span
                className={`${styles.checkbox} ${allSelected ? styles.checkboxChecked : ""}`}
                role="checkbox"
                aria-checked={allSelected}
                aria-label="Select all leads"
                tabIndex={0}
                onClick={onToggleSelectAll}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleSelectAll();
                  }
                }}
              />
            </th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={styles.th}
                style={{ textAlign: col.align ?? "left" }}
                onClick={() => onSort(col.key)}
              >
                {col.label}{" "}
                {sortKey === col.key && (
                  <span className={styles.sortMark}>{sortDir === "asc" ? "▴" : "▾"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, i) => {
            const isOpen = lead.id === openLeadId;
            const isChecked = selectedIds.has(lead.id);
            const badgeKind = badgeForBucket(lead.triageBucket);
            const rowClass = [
              styles.row,
              i % 2 === 1 ? styles.rowAlt : "",
              isOpen ? styles.rowOpen : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <tr key={lead.id} className={rowClass} onClick={() => onOpenLead(lead)}>
                <td className={styles.checkCol} onClick={(e) => e.stopPropagation()}>
                  <span
                    className={`${styles.checkbox} ${isChecked ? styles.checkboxChecked : ""}`}
                    role="checkbox"
                    aria-checked={isChecked}
                    aria-label={`Select ${lead.name}`}
                    tabIndex={0}
                    onClick={() => onToggleSelect(lead.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggleSelect(lead.id);
                      }
                    }}
                  />
                </td>
                <td className={styles.td}>
                  <div className={styles.name}>{lead.name}</div>
                  <div className={`${styles.phone} tnum`}>{lead.phone}</div>
                </td>
                <td className={`${styles.td} tnum`}>{lead.county}</td>
                <td className={`${styles.td} tnum`} style={{ textAlign: "right" }}>
                  {lead.acreage}
                </td>
                <td className={styles.td}>
                  <span className={styles.stageChip}>{lead.stage}</span>
                </td>
                <td className={styles.td}>
                  {badgeKind ? <Badge kind={badgeKind} /> : <span className={styles.dash}>—</span>}
                </td>
                <td className={styles.td}>{lastSenderLabel(lead)}</td>
                <td className={`${styles.td} ${styles.updated} tnum`}>{agoLabel(lead.lastMessageAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {leads.length === 0 && <div className={styles.empty}>No leads match this view.</div>}
    </div>
  );
}
