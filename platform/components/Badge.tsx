import type { BadgeKind } from "@/lib/types";
import styles from "./Badge.module.css";

// Classification badges — derived 1:1 from tools/triage_rules.py buckets via
// lib/types.ts::badgeForBucket. Never invent a new label/color here; if a new
// triage bucket is added, add it there first. Semantic color only — never brand red.
const LABEL: Record<Exclude<BadgeKind, null>, string> = {
  price: "Price signal",
  triage: "Needs triage",
  review: "Review first",
  discarded: "Auto-discarded",
  wrong: "Wrong number",
  dnc: "Do not contact",
};

export function Badge({ kind }: { kind: BadgeKind }) {
  if (!kind) return null;
  return (
    <span className={`${styles.badge} ${styles[kind]}`}>
      <span className={styles.dot} />
      {LABEL[kind]}
    </span>
  );
}
