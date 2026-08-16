import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";

// login/signup/invitations 공용 — 헤더 하나만 얹는다. RBAC·auth 로직은 각 page.tsx가 그대로 가진다.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
