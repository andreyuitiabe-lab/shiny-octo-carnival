import type { Message, SystemNote } from "@/lib/types";
import { SENDER_EDGE_COLOR, SENDER_LABEL, SENDER_LABEL_COLOR } from "./senderMeta";
import styles from "./MessageBubble.module.css";

// A single entry in the merged thread timeline — either a real SMS message or a
// SystemNote (automation hand-off / classification event). See README.md
// "Three message styles": inbound bubble, outbound bubble (3px sender-colored
// right border), and the system note, which is intentionally NOT a bubble.
export type TimelineItem =
  | ({ kind: "message" } & Message)
  | ({ kind: "note" } & SystemNote);

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MessageBubble({ item }: { item: TimelineItem }) {
  if (item.kind === "note") {
    return (
      <div className={styles.noteRow}>
        <div className={styles.notePill}>
          <span className={styles.notePillLabel}>⚙ System</span>
          <span className={`${styles.notePillTime} tnum`}>{formatTime(item.at)}</span>
        </div>
        <div className={styles.noteBody}>{item.body}</div>
      </div>
    );
  }

  const isInbound = item.direction === "inbound";
  const sender = item.sender ?? "automation";

  return (
    <div className={isInbound ? styles.rowIn : styles.rowOut}>
      <div
        className={isInbound ? styles.bubbleIn : styles.bubbleOut}
        style={isInbound ? undefined : { borderRightColor: SENDER_EDGE_COLOR[sender] }}
      >
        <div className={styles.meta}>
          <span
            className={styles.metaLabel}
            style={{ color: isInbound ? "var(--sem-blue-lt)" : SENDER_LABEL_COLOR[sender] }}
          >
            {isInbound ? "Seller · inbound" : `${SENDER_LABEL[sender]} · outbound`}
          </span>
          <span className={`${styles.metaTime} tnum`}>{formatTime(item.at)}</span>
        </div>
        <div className={styles.body}>{item.body}</div>
      </div>
    </div>
  );
}
