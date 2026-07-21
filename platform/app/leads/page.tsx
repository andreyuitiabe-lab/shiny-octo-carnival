"use client";

import { useMemo, useState } from "react";
import { LEADS } from "@/lib/mock-data";
import type { Lead, Stage } from "@/lib/types";
import { badgeForBucket } from "@/lib/types";
import { FunnelStats } from "@/components/leads/FunnelStats";
import { LeadsTable, type SortKey } from "@/components/leads/LeadsTable";
import { DetailDrawer } from "@/components/leads/DetailDrawer";
import { SellerDossierPanel } from "@/components/SellerDossierPanel";
import { lastSenderLabel } from "@/lib/format";
import { FilterDropdown } from "@/components/FilterDropdown";
import {
  CLASSIFICATION_OPTIONS,
  countyOptions,
  matchesFilters,
  EMPTY_FILTERS,
  type Filters,
} from "@/lib/filters";
import styles from "./page.module.css";

// Canonical funnel order (lib/types.ts::Stage doc comment) — used to sort the
// Stage column meaningfully instead of alphabetically.
const STAGE_ORDER: Stage[] = [
  "New",
  "Needs Triage",
  "Engaging",
  "Negotiating",
  "Qualifying",
  "Ready for Research",
  "Proposal Ready",
  "Proposal Sent",
  "Under Contract",
  "Closed",
  "Discarded",
  "Do Not Contact",
];

const BADGE_LABEL: Record<string, string> = {
  price: "Price signal",
  triage: "Needs triage",
  review: "Review first",
  discarded: "Auto-discarded",
  wrong: "Wrong number",
  dnc: "Do not contact",
};

function isDncStage(stage: Stage) {
  return stage === "Do Not Contact" || stage === "Discarded";
}

function acresValue(acreage: string): number {
  const n = parseFloat(acreage);
  return Number.isNaN(n) ? -1 : n;
}

function classificationLabel(lead: Lead): string {
  const kind = badgeForBucket(lead.triageBucket);
  return kind ? BADGE_LABEL[kind] : "";
}

function compareLeads(a: Lead, b: Lead, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "county":
      return a.county.localeCompare(b.county);
    case "acres":
      return acresValue(a.acreage) - acresValue(b.acreage);
    case "stage":
      return STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
    case "classification":
      return classificationLabel(a).localeCompare(classificationLabel(b));
    case "last":
      return lastSenderLabel(a).localeCompare(lastSenderLabel(b));
    case "updated":
      return new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime();
    default:
      return 0;
  }
}

function toCsv(leads: Lead[]): string {
  const header = ["Name", "Phone", "County", "Acres", "Stage", "Classification", "Updated"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = leads.map((l) =>
    [l.name, l.phone, l.county, l.acreage, l.stage, classificationLabel(l) || "—", l.lastMessageAt]
      .map((v) => escape(String(v)))
      .join(",")
  );
  return [header.map(escape).join(","), ...lines].join("\n");
}

export default function LeadsPage() {
  const [tab, setTab] = useState<"all" | "dnc">("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [dossierOpen, setDossierOpen] = useState(false);
  // Leads uses County + Stage + Classification; Stage lives outside the shared
  // Filters type (it's the funnel enum, not a triage axis), so it's its own state.
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [stageFilter, setStageFilter] = useState<string[]>([]);

  const allCount = useMemo(() => LEADS.filter((l) => !isDncStage(l.stage)).length, []);
  const dncCount = useMemo(() => LEADS.filter((l) => isDncStage(l.stage)).length, []);

  const counties = useMemo(() => countyOptions(LEADS), []);
  const stageOptions = useMemo(() => STAGE_ORDER.map((s) => ({ value: s, label: s })), []);

  const baseLeads = useMemo(
    () =>
      LEADS.filter((l) => (tab === "dnc" ? isDncStage(l.stage) : !isDncStage(l.stage)))
        .filter((l) => matchesFilters(l, filters))
        .filter((l) => (stageFilter.length ? stageFilter.includes(l.stage) : true)),
    [tab, filters, stageFilter]
  );

  const sortedLeads = useMemo(() => {
    const copy = [...baseLeads];
    copy.sort((a, b) => {
      const cmp = compareLeads(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [baseLeads, sortKey, sortDir]);

  const openLead = openLeadId ? (LEADS.find((l) => l.id === openLeadId) ?? null) : null;
  const allSelected = sortedLeads.length > 0 && sortedLeads.every((l) => selectedIds.has(l.id));

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const ids = sortedLeads.map((l) => l.id);
      const everySelected = ids.length > 0 && ids.every((id) => prev.has(id));
      return everySelected ? new Set() : new Set(ids);
    });
  }

  function openLeadRow(lead: Lead) {
    setOpenLeadId(lead.id);
    setDossierOpen(false);
  }

  function closeDrawer() {
    setOpenLeadId(null);
    setDossierOpen(false);
  }

  function exportCsv() {
    const rows = sortedLeads.filter((l) => selectedIds.has(l.id));
    const csv = toCsv(rows);
    console.log(csv);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function moveToDnc() {
    // No write layer yet — mock data is read-only for v1; this logs the intended
    // mutation so the affordance is real without faking persistence.
    console.log("Move to Do Not Contact:", [...selectedIds]);
  }

  return (
    <div className={styles.wrap}>
      <div className={`${styles.tableCol} scry`}>
        <FunnelStats leads={LEADS} />

        <div className={styles.tabsRow}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === "all" ? styles.tabActive : ""}`}
              onClick={() => setTab("all")}
            >
              All leads · <span className="tnum">{allCount}</span>
            </button>
            <button
              className={`${styles.tab} ${tab === "dnc" ? styles.tabActive : ""}`}
              onClick={() => setTab("dnc")}
            >
              Do Not Contact · <span className="tnum">{dncCount}</span>
            </button>
          </div>
          <div className={styles.filters}>
            <FilterDropdown
              label="County"
              options={counties}
              values={filters.county}
              onChange={(v) => setFilters((f) => ({ ...f, county: v }))}
            />
            <FilterDropdown
              label="Stage"
              allLabel="All stages"
              options={stageOptions}
              values={stageFilter}
              onChange={setStageFilter}
            />
            <FilterDropdown
              label="Classification"
              allLabel="All classifications"
              options={CLASSIFICATION_OPTIONS}
              values={filters.classification}
              onChange={(v) => setFilters((f) => ({ ...f, classification: v }))}
            />
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selectedIds.size} selected</span>
            <div className={styles.bulkActions}>
              <button className={styles.bulkBtn}>Move stage</button>
              <button className={styles.bulkBtn}>Assign</button>
              <button className={styles.bulkBtn}>Add tag</button>
              <button className={styles.bulkBtnDanger} onClick={moveToDnc}>
                → Do Not Contact
              </button>
            </div>
            <button className={styles.exportBtn} onClick={exportCsv}>
              Export CSV
            </button>
          </div>
        )}

        <LeadsTable
          leads={sortedLeads}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          allSelected={allSelected}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          openLeadId={openLeadId}
          onOpenLead={openLeadRow}
        />
      </div>

      {openLead && (
        <DetailDrawer lead={openLead} onClose={closeDrawer} onOpenDossier={() => setDossierOpen(true)} />
      )}

      {openLead && dossierOpen && (
        <SellerDossierPanel lead={openLead} onClose={() => setDossierOpen(false)} />
      )}
    </div>
  );
}
