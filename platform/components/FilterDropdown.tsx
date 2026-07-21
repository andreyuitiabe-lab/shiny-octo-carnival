"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./FilterDropdown.module.css";

export type FilterOption = {
  value: string;
  label: string;
  /** optional color swatch (used for the classification filter) */
  swatch?: string;
};

/** A single-select ghost-button dropdown filter. `value === null` means "all"
 * (no filter). Matches the Modernist popover style used by the stage selector.
 * Shared by the Kanban, Conversations, and Leads filter rows. */
export function FilterDropdown({
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  allLabel?: string;
  options: FilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = value === null ? null : options.find((o) => o.value === value);
  const buttonText = selected ? selected.label : label;
  const allText = allLabel ?? `All ${label.toLowerCase()}`;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.btn} ${value !== null ? styles.btnActive : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {selected?.swatch ? <span className={styles.swatch} style={{ background: selected.swatch }} /> : null}
        <span>{buttonText}</span>
        <span className={styles.caret}>▾</span>
      </button>

      {open ? (
        <div className={styles.popover}>
          <button
            type="button"
            className={`${styles.option} ${value === null ? styles.optionActive : ""}`}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <span className={styles.mark}>{value === null ? "✓" : ""}</span>
            {allText}
          </button>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                className={`${styles.option} ${active ? styles.optionActive : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span className={styles.mark}>{active ? "✓" : ""}</span>
                {o.swatch ? <span className={styles.swatch} style={{ background: o.swatch }} /> : null}
                {o.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
