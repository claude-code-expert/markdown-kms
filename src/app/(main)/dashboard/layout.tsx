import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";

// 대시보드 전용 — w/[wsId] 트리는 자체 100vh 그리드를 쓰므로 그룹 루트가 아니라
// 이 세그먼트에만 헤더를 건다.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
