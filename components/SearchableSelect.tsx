"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export type ComboOption = { label: string; value: string };

type Props = {
  id: string;
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
};

/**
 * Searchable dropdown (combobox). Type to filter the list, tap or use the
 * keyboard to pick. Built for touch: 16px text (no iOS auto-zoom),
 * 48px option rows, and a clear button so a wrong pick is one tap to fix.
 */
export default function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  name,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );

  // The input shows the selected label when closed, and the search text
  // while the user is typing.
  const inputValue = open ? query : selected ? selected.label : "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  function pick(opt: ComboOption) {
    onChange(opt.value);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function clear() {
    onChange("");
    setQuery("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[highlight]) {
        e.preventDefault();
        pick(filtered[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div className="combo" ref={rootRef}>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && filtered[highlight] ? `${id}-opt-${highlight}` : undefined}
        value={inputValue}
        placeholder={placeholder || "Type to search…"}
        disabled={disabled}
        required={required && !value ? true : false}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          // Typing a new search clears the previous selection.
          if (value) onChange("");
        }}
        onKeyDown={onKeyDown}
      />
      {value && !disabled && (
        <button
          type="button"
          className="combo-clear"
          aria-label="Clear selection"
          onClick={clear}
        >
          ×
        </button>
      )}
      <span className="combo-count" aria-hidden="true">
        {open
          ? `${filtered.length} of ${options.length}`
          : `${options.length} options`}
      </span>
      {open && !disabled && (
        <ul
          className="combo-list"
          id={`${id}-list`}
          role="listbox"
          aria-label="Options"
        >
          {filtered.length === 0 && (
            <li className="combo-empty">No matches — try a different search.</li>
          )}
          {filtered.map((opt, i) => (
            <li
              key={opt.value}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={opt.value === value}
              className={
                "combo-option" +
                (i === highlight ? " highlighted" : "") +
                (opt.value === value ? " selected" : "")
              }
              onMouseDown={(e) => {
                e.preventDefault();
                pick(opt);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
