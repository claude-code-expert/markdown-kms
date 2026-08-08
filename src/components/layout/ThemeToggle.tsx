"use client";

// UI-SPEC "Theme Toggle Contract" (EDIT-12) — sidebar footer row, immediately
// below the Trash row (FolderTree.tsx). Client-owned, non-sensitive setting:
// toggling writes document.cookie directly and flips the DOM attribute right
// away (no API route — RESEARCH Pattern 6). The next RSC render reads the
// same cookie and stays in sync (src/app/layout.tsx).
import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import styles from "./ThemeToggle.module.css";

type Theme = "light" | "dark";

interface ThemeToggleProps {
  // Server (RSC) already knows the theme from the cookie and can pass it
  // down; if omitted (e.g. rendered inside a client-only tree like
  // FolderTree), read the value RSC already stamped onto <html> instead of
  // importing next/headers's cookies() here (server-only — RESEARCH Pitfall 8).
  initialTheme?: Theme;
}

function readDomTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle({ initialTheme }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme ?? readDomTheme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }

  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환";

  return (
    <button type="button" className={styles.themeToggle} onClick={toggle}>
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}
