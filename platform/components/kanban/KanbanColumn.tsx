"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Lead } from "@/lib/types";
import { KanbanCard } from "./KanbanCard";
import styles from "./KanbanColumn.module.css";

interface KanbanColumnProps {
  laneKey: string;
  label: string;
  highlight?: boolean;
  leads: Lead[];
}

/** A drop target lane. `laneKey` is used as the dnd-kit droppable id so
 * KanbanBoard's onDragEnd can look up which lane a card was released over. */
export function KanbanColumn({ laneKey, label, highlight, leads }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: laneKey });

  return (
    <section
      ref={setNodeRef}
      className={`${styles.column} ${highlight ? styles.highlight : ""} ${isOver ? styles.over : ""}`}
    >
      <div className={styles.head}>
        <div className={styles.headLabelGroup}>
          {highlight ? <span className={styles.star}>◆</span> : null}
          <span className={styles.label}>{label}</span>
        </div>
        <span className={`${styles.count} tnum`}>{leads.length}</span>
      </div>
      <div className={`${styles.body} scry`}>
        {leads.map((lead) => (
          <KanbanCard key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 ? <div className={styles.empty}>Empty</div> : null}
      </div>
    </section>
  );
}
