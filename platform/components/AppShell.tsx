"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LEADS } from "@/lib/mock-data";
import styles from "./AppShell.module.css";

const NAV = [
  { href: "/kanban", label: "Kanban", mark: "▤" },
  { href: "/conversations", label: "Conversations", mark: "✉" },
  { href: "/leads", label: "Leads", mark: "▦" },
] as const;

const HEADS: Record<string, { title: string; sub: string }> = {
  "/kanban": {
    title: "Kanban",
    sub: "Our funnel — SwiftScale only sends & receives the SMS. Drag cards to change stage.",
  },
  "/conversations": {
    title: "Conversations",
    sub: "Inbox of live seller threads. System notes appear inline, distinct from messages.",
  },
  "/leads": {
    title: "Leads",
    sub: "Sortable, filterable master database. Click any row for the full record.",
  },
};

// "Needs reply" = last message inbound = the seller is waiting on us. This is the
// same definition used for the Conversations "Needs reply" tab and its nav badge.
function needsReplyCount() {
  return LEADS.filter((l) => l.lastMessageDirection === "inbound").length;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const head = HEADS[pathname] ?? HEADS["/kanban"];
  const replyCount = needsReplyCount();

  // /login has no sidebar/nav — it's the one page a logged-out request can
  // reach (proxy.ts gates everything else), and a sidebar full of links to
  // pages you can't access yet would be confusing there.
  if (pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <div className={styles.brandRow}>
            <div className={styles.brandMark}>P</div>
            <div className={styles.brandName}>
              PARCEL<span>CRM</span>
            </div>
          </div>
          <div className={styles.brandKicker}>Land acquisition · TN</div>
        </div>

        <nav className={styles.nav}>
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            const badge = n.href === "/conversations" ? replyCount : null;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
              >
                <span className={styles.navGlyph}>{n.mark}</span>
                <span className={styles.navLabel}>{n.label}</span>
                {badge ? <span className={`${styles.navBadge} tnum`}>{badge}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className={styles.operators}>
          <div className={styles.operatorsLabel}>Operators</div>
          <div className={styles.operatorRow}>
            <span className={styles.avatar} style={{ background: "#2f4a63", color: "#9ecbf0" }}>
              A
            </span>
            <span className={styles.operatorName}>Person A</span>
            <span className={styles.onlineDot} style={{ background: "#4faa6e" }} />
          </div>
          <div className={styles.operatorRow}>
            <span className={styles.avatar} style={{ background: "#4a3a2f", color: "#e6b877" }}>
              B
            </span>
            <span className={styles.operatorName}>Person B</span>
            <span className={styles.onlineDot} style={{ background: "#766e67" }} />
          </div>
          <div className={styles.themeNote}>
            <span className={styles.themeSwatch} />
            Dark theme · light supported
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div style={{ minWidth: 0 }}>
            <h1 className={styles.headerTitle}>{head.title}</h1>
            <div className={styles.headerSub}>{head.sub}</div>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.searchBox}>
              <span className={styles.searchGlyph}>⌕</span>
              <input className={styles.searchInput} placeholder="Search name, phone, county…" />
            </div>
            <button className={styles.primaryBtn}>
              <span style={{ fontSize: 15, lineHeight: 0 }}>+</span>
              <span>New lead</span>
            </button>
          </div>
        </header>

        <div className={`${styles.body} scry`}>{children}</div>
      </main>
    </div>
  );
}
