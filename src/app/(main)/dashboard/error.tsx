"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import styles from "./error.module.css";

// Next.js error.tsx convention — client boundary catching the dashboard RSC's fetch failure.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.page}>
      <p className={styles.message}>워크스페이스 목록을 불러오지 못했어요.</p>
      <Button variant="secondary" onClick={reset}>
        다시 시도
      </Button>
    </main>
  );
}
