"use client";

import { useState } from "react";
import type { Draft } from "@/lib/types";
import styles from "./Composer.module.css";

// Note: intentionally no "sending as Person A/B" persona selector — removed per
// the design handoff. Send/Internal note/Insert draft only.
export function Composer({
  drafts,
  onSend,
  onAddNote,
}: {
  drafts: Draft[];
  onSend: (text: string) => void;
  onAddNote: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const pendingDraft = drafts.find((d) => d.status === "pending");

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  function handleNote() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAddNote(trimmed);
    setText("");
  }

  function handleInsertDraft() {
    if (!pendingDraft) return;
    setText(pendingDraft.text);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        <textarea
          className={styles.textarea}
          placeholder="Write a reply… (sends via SwiftScale SMS)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className={styles.toolbar}>
          <button className={styles.ghostBtn} onClick={handleNote}>
            Internal note
          </button>
          <button className={styles.ghostBtn} onClick={handleInsertDraft} disabled={!pendingDraft}>
            Insert draft
          </button>
          <div className={styles.spacer} />
          <button className={styles.sendBtn} onClick={handleSend}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
