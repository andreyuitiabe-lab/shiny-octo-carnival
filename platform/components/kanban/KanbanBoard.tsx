"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { KANBAN_LANES, laneForStage, type Lead } from "@/lib/types";
import { FilterDropdown } from "@/components/FilterDropdown";
import {
  ASSIGNED_OPTIONS,
  CLASSIFICATION_OPTIONS,
  EMPTY_FILTERS,
  WAITING_OPTIONS,
  countyOptions,
  matchesFilters,
  type Filters,
} from "@/lib/filters";
import { KanbanColumn } from "./KanbanColumn";
import { LEGEND } from "./kanban-helpers";
import styles from "./KanbanBoard.module.css";

export function KanbanBoard({ initialLeads }: { initialLeads: Lead[] }) {
  // Seeded from the server (Supabase). Dragging a card between lanes reassigns
  // its `stage` to the target lane's first stage and appends a stage-history
  // entry locally; persisting the move back to Supabase is a later step.
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const counties = countyOptions(initialLeads);
  const visibleLeads = leads.filter((l) => matchesFilters(l, filters));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const targetLaneKey = String(over.id);

    const original = leads.find((l) => l.id === leadId);
    if (!original || laneForStage(original.stage) === targetLaneKey) return;

    const lane = KANBAN_LANES.find((l) => l.key === targetLaneKey);
    if (!lane) return;
    const nextStage = lane.stages[0];

    // Optimistic move — snap the card immediately, then persist. If the save
    // fails, revert to the original lead so the board never lies about state.
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              stage: nextStage,
              stageHistory: [
                ...lead.stageHistory,
                { stage: nextStage, at: new Date().toISOString() },
              ],
            }
          : lead
      )
    );

    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: nextStage }),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      // NOTE: the response body carries { ghlSynced, ghlNote } — if the
      // SwiftScale mirror failed but our save succeeded, we keep the move
      // silently for now (Supabase is source of truth). Follow-up: surface a
      // small "not synced to SwiftScale" indicator instead of ignoring it.
    } catch {
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? original : lead)));
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>Filter</span>
        <FilterDropdown
          label="County"
          options={counties}
          values={filters.county}
          onChange={(v) => setFilters((f) => ({ ...f, county: v }))}
        />
        <FilterDropdown
          label="Classification"
          allLabel="All classifications"
          options={CLASSIFICATION_OPTIONS}
          values={filters.classification}
          onChange={(v) => setFilters((f) => ({ ...f, classification: v }))}
        />
        <FilterDropdown
          label="Assigned"
          allLabel="Anyone"
          options={ASSIGNED_OPTIONS}
          values={filters.assigned}
          onChange={(v) => setFilters((f) => ({ ...f, assigned: v }))}
        />
        <FilterDropdown
          label="Waiting"
          allLabel="Any status"
          options={WAITING_OPTIONS}
          values={filters.waiting}
          onChange={(v) => setFilters((f) => ({ ...f, waiting: v }))}
        />
      </div>

      <div className={styles.legendRow}>
        <div className={styles.legend}>
          {LEGEND.map((l) => (
            <span key={l.label} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
        <div className={styles.legendNote}>Columns are configurable — map any funnel stage to a lane</div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className={styles.board}>
          {KANBAN_LANES.map((lane) => (
            <KanbanColumn
              key={lane.key}
              laneKey={lane.key}
              label={lane.label}
              highlight={lane.highlight}
              leads={visibleLeads.filter((lead) => laneForStage(lead.stage) === lane.key)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
