"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./FilterDropdown.module.css";

export type FilterOption = {
  value: string;
  label: string;
  /** optional color swatch (used for the classification filter) */
  swatch?: string;
};

/** A ghost-button dropdown filter. Multi-select by default (checkboxes, stays
 * open so you can pick several — e.g. "all non-discarded classifications");
 * pass `multiple={false}` for single-select semantics (e.g. Sort), which picks
 * one and closes. `values` is always an array — [] means "all" (no filter).
 * Matches the Modernist popover style used by the stage selector. */
export function FilterDropdown({
  label,
  allLabel,
  options,
  values,
  onChange,
  multiple = true,
}: {
  label: string;
  allLabel?: string;
  options: FilterOption[];
  values: string[];
  onChange: (values: string[]) => void;
  multiple?: boolean;
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

  const count = values.length;
  const allText = allLabel ?? `All ${label.toLowerCase()}`;

  // Button text: no selection → the filter label; 1 → that option's label;
  // 2+ → "Label · N".
  let buttonText = label;
  if (count === 1) {
    buttonText = options.find((o) => o.value === values[0])?.label ?? label;
  } else if (count > 1) {
    buttonText = `${label} · ${count}`;
  }

  function toggle(value: string) {
    if (!multiple) {
      onChange([value]);
      setOpen(false);
      return;
    }
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.btn} ${count > 0 ? styles.btnActive : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{buttonText}</span>
        <span className={styles.caret}>▾</span>
      </button>

      {open ? (
        <div className={styles.popover}>
          <button
            type="button"
            className={`${styles.option} ${count === 0 ? styles.optionActive : ""}`}
            onClick={() => {
              onChange([]);
              if (!multiple) setOpen(false);
            }}
          >
            {multiple ? (
              <span className={`${styles.check} ${count === 0 ? styles.checkOn : ""}`} />
            ) : (
              <span className={styles.mark}>{count === 0 ? "✓" : ""}</span>
            )}
            {allText}
          </button>
          {options.map((o) => {
            const active = values.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                className={`${styles.option} ${active ? styles.optionActive : ""}`}
                onClick={() => toggle(o.value)}
              >
                {multiple ? (
                  <span className={`${styles.check} ${active ? styles.checkOn : ""}`} />
                ) : (
                  <span className={styles.mark}>{active ? "✓" : ""}</span>
                )}
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
