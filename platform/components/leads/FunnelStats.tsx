import { KANBAN_LANES, laneForStage } from "@/lib/types";
import type { Lead } from "@/lib/types";
import styles from "./FunnelStats.module.css";

// One cell per macro Kanban lane (see lib/types.ts::KANBAN_LANES) + an "All
// leads" total, so the count always reconciles with the Kanban board's lanes.
export function FunnelStats({ leads }: { leads: Lead[] }) {
  const laneCounts = new Map<string, number>();
  for (const lead of leads) {
    const key = laneForStage(lead.stage);
    laneCounts.set(key, (laneCounts.get(key) ?? 0) + 1);
  }

  const cells = [
    { key: "all", label: "All leads", n: leads.length, highlight: false },
    ...KANBAN_LANES.map((lane) => ({
      key: lane.key,
      label: lane.label,
      n: laneCounts.get(lane.key) ?? 0,
      highlight: !!lane.highlight,
    })),
  ];

  return (
    <div className={styles.row}>
      {cells.map((c) => (
        <div key={c.key} className={`${styles.cell} ${c.highlight ? styles.highlight : ""}`}>
          <div className={`${styles.n} tnum`}>{c.n}</div>
          <div className={styles.label}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}
