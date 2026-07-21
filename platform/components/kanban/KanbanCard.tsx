"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Lead } from "@/lib/types";
import { badgeForBucket } from "@/lib/types";
import { Badge } from "@/components/Badge";
import { colorForBadge } from "./kanban-helpers";
import styles from "./KanbanCard.module.css";

/** One draggable Kanban card. Drag identity is the lead id; KanbanBoard resolves
 * the drop target (a lane id) and updates the lead's stage. */
export function KanbanCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  const badgeKind = badgeForBucket(lead.triageBucket);
  const arrow = lead.lastMessageDirection === "inbound" ? "↩" : "↪"; // ↩ / ↪

  const style: React.CSSProperties = {
    "--card-accent": colorForBadge(badgeKind),
    transform: CSS.Translate.toString(transform),
  } as React.CSSProperties;

  return (
    <article
      ref={setNodeRef}
      className={`${styles.card} ${isDragging ? styles.dragging : ""}`}
      style={style}
      {...listeners}
      {...attributes}
    >
      <div className={styles.row1}>
        <span className={styles.name}>{lead.name}</span>
        {lead.unreadCount > 0 ? (
          <span className={`${styles.unread} tnum`}>{lead.unreadCount}</span>
        ) : null}
      </div>
      <div className={`${styles.phone} tnum`}>{lead.phone}</div>
      <div className={styles.preview}>
        <span className={styles.previewArrow}>{arrow}</span> {lead.lastMessageBody}
      </div>
      <div className={styles.meta}>
        <Badge kind={badgeKind} />
        <span className={styles.county}>{lead.county}</span>
      </div>
    </article>
  );
}
