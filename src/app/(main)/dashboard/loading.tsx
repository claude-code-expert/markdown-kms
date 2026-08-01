import styles from "./loading.module.css";

// D-11: Next.js loading.tsx convention — Suspense skeleton while the dashboard RSC's server
// fetch (listMembershipsForUser) is pending. Flat fill, no shimmer/gradient (anti-ai-slop).
export default function DashboardLoading() {
  return (
    <main className={styles.page}>
      <div className={styles.titleSkeleton} />
      <div className={styles.grid}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.cardSkeleton} />
        ))}
      </div>
    </main>
  );
}
