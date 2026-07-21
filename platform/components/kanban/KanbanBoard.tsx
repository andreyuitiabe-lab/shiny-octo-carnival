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
import { LEADS } from "@/lib/mock-data";
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

export function KanbanBoard() {
  // Local-only state — no backend wired up yet. Dragging a card between lanes
  // reassigns its `stage` to the target lane's first stage and appends a
  // stage-history entry, same as a real stage-selector change would.
  const [leads, setLeads] = useState<Lead[]>(LEADS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const counties = countyOptions(LEADS);
  const visibleLeads = leads.filter((l) => matchesFilters(l, filters));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const targetLaneKey = String(over.id);

    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id !== leadId) return lead;
        if (laneForStage(lead.stage) === targetLaneKey) return lead;

        const lane = KANBAN_LANES.find((l) => l.key === targetLaneKey);
        if (!lane) return lead;

        const nextStage = lane.stages[0];
        return {
          ...lead,
          stage: nextStage,
          stageHistory: [...lead.stageHistory, { stage: nextStage, at: new Date().toISOString() }],
        };
      })
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>Filter</span>
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
        <FilterDropdown
          label="Waiting"
          allLabel="Any status"
          options={WAITING_OPTIONS}
          value={filters.waiting}
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
