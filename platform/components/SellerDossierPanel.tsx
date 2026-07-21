import type { Lead } from "@/lib/types";
import styles from "./SellerDossierPanel.module.css";

// Contextual panel opened from Conversations or the Leads detail drawer — mirrors
// the /seller-dossier skill's output structure (situação → lote → números →
// diligência → pergunta seguinte). This is ALWAYS a manual pull (see
// wiki/architecture/conversation-flow.md) — never auto-opened by an automated flow.

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const VERDICT_BG: Record<string, string> = {
  PURSUE: "var(--sem-green)",
  NEGOTIATE: "var(--sem-amber)",
  WALK: "rgba(217, 42, 16, 0.85)",
};

const STATUS_CLASS: Record<string, string> = {
  ok: styles.statusOk,
  caution: styles.statusCaution,
  risk: styles.statusRisk,
};

export function SellerDossierPanel({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const d = lead.dossier;

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.kicker}>Seller Dossier</div>
          <div className={styles.headerName}>
            {lead.name} · {lead.acreage} ac
          </div>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close dossier">
          ✕
        </button>
      </div>

      {!d ? (
        <div className={styles.noDossier}>
          No dossier pulled yet for this lead. Run <code>/seller-dossier {lead.name}</code> in
          Claude Code when you need reference numbers — this is never automatic.
        </div>
      ) : (
        <>
          <div className={styles.section} style={{ borderBottom: "none", paddingBottom: 0 }}>
            <div className={styles.verdictPoster} style={{ background: VERDICT_BG[d.verdict] }}>
              <div className={styles.verdictWord}>{d.verdict}</div>
              <div className={styles.verdictGap}>GAP OVER MAO {d.gapOverMao}</div>
            </div>
            <div className={styles.verdictRationale}>{d.rationale}</div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Offer numbers</div>
            <div className={styles.offerGrid}>
              <div className={styles.offerCell}>
                <div className={styles.offerLabel} style={{ color: "var(--sem-green-lt)" }}>
                  ◆ Opening
                </div>
                <div className={`${styles.offerValue} tnum`}>{money(d.opening)}</div>
              </div>
              <div className={styles.offerCell}>
                <div className={styles.offerLabel} style={{ color: "var(--text-muted)" }}>
                  Target
                </div>
                <div className={`${styles.offerValue} tnum`}>{money(d.target)}</div>
              </div>
              <div className={styles.offerCell}>
                <div className={styles.offerLabel} style={{ color: "var(--sem-amber-lt)" }}>
                  Walk-away
                </div>
                <div className={`${styles.offerValue} tnum`}>{money(d.walkAway)}</div>
              </div>
            </div>
            <div className={styles.askFmvRow}>
              <div className={styles.askFmvCell}>
                <div className={styles.offerLabel}>Seller ask</div>
                <div className={`${styles.offerValue} tnum`}>{money(d.sellerAsk)}</div>
              </div>
              <div className={styles.askFmvCell}>
                <div className={styles.offerLabel}>FMV</div>
                <div className={`${styles.offerValue} tnum`}>{money(d.fmv)}</div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Satellite + boundary</div>
            <div className={styles.satPlaceholder}>
              Satellite + parcel boundary / Satellite Scout · EYEBALL {d.eyeballScore} / 100
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Parcel</div>
            <div className={styles.defList}>
              <div className={styles.defRow}>
                <span className={styles.defKey}>Parcel ID</span>
                <span className="tnum">{d.parcelId}</span>
              </div>
              <div className={styles.defRow}>
                <span className={styles.defKey}>Deed acres</span>
                <span className="tnum">{d.deedAcres}</span>
              </div>
              <div className={styles.defRow}>
                <span className={styles.defKey}>Zoning</span>
                <span>{d.zoning}</span>
              </div>
              <div className={styles.defRow}>
                <span className={styles.defKey}>Structures</span>
                <span>{d.structures}</span>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Diligence</div>
            {d.diligence.map((item) => (
              <div className={styles.diligenceRow} key={item.label}>
                <div>
                  <div className={styles.diligenceLabel}>{item.label}</div>
                  <div className={styles.diligenceSub}>{item.detail}</div>
                </div>
                <span className={`${styles.statusChip} ${STATUS_CLASS[item.status]}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>

          <div className={styles.section} style={{ borderBottom: "none" }}>
            <div className={styles.nextQKicker}>Next question</div>
            <div className={styles.nextQText}>{d.nextQuestion}</div>
            {d.dealKillers.length > 0 && (
              <>
                <div className={styles.sectionTitle} style={{ marginBottom: 4 }}>
                  Deal-killers to defuse
                </div>
                <ul className={styles.killerList}>
                  {d.dealKillers.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className={styles.actions}>
            <button className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}>
              Copy to notes
            </button>
            <button className={styles.actionBtn}>Export PDF</button>
          </div>
        </>
      )}
    </aside>
  );
}
