"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Lead } from "@/lib/types";
import { badgeForBucket } from "@/lib/types";
import { useHydrated } from "@/lib/use-hydrated";
import { Badge } from "@/components/Badge";
import { colorForBadge } from "./kanban-helpers";
import styles from "./KanbanCard.module.css";

/** One draggable Kanban card. Drag identity is the lead id; KanbanBoard resolves
 * the drop target (a lane id) and updates the lead's stage. A plain click (no
 * drag) deep-links to that lead's conversation. */
export function KanbanCard({ lead }: { lead: Lead }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  // dnd-kit adds client-generated attributes (e.g. a non-SSR-safe aria-describedby
  // id) that differ between the prerendered HTML and the client, causing a
  // hydration mismatch. Apply the drag attributes/listeners only after hydration,
  // so the server render and first client render are identical (a plain card),
  // then dnd-kit's props attach on the post-hydration re-render.
  const mounted = useHydrated();

  // Distinguish a click from a drag: capture the pointer-down position (in the
  // capture phase, so we only read it and don't interfere with dnd-kit's own
  // pointer handling), then on click compare how far the pointer moved. Under
  // the board's 4px drag-activation threshold → it's a real click → navigate.
  const downPos = useRef<{ x: number; y: number } | null>(null);

  const badgeKind = badgeForBucket(lead.triageBucket);
  const arrow = lead.lastMessageDirection === "inbound" ? "↩" : "↪"; // ↩ / ↪

  const style: React.CSSProperties = {
    "--card-accent": colorForBadge(badgeKind),
    transform: mounted ? CSS.Translate.toString(transform) : undefined,
  } as React.CSSProperties;

  return (
    <article
      ref={setNodeRef}
      className={`${styles.card} ${isDragging ? styles.dragging : ""}`}
      style={style}
      onPointerDownCapture={(e) => {
        downPos.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={(e) => {
        const start = downPos.current;
        if (!start) return;
        const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (moved < 5) router.push(`/conversations?lead=${lead.id}`);
      }}
      {...(mounted ? listeners : {})}
      {...(mounted ? attributes : {})}
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
