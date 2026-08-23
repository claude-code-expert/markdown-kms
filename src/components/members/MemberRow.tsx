// UI-SPEC Members Page Contract — 멤버 목록 (WS-04). Read-only row, no action buttons (role
// change/removal is Deferred — this phase's scope). Role badge is a neutral pill (Phase 6 chip
// exception reuse), never accent — "활성 표시는 색이 아니라 굵기/명도" (Phase 1 principle).
import { Avatar } from "@/components/ui/Avatar";
import styles from "./MembersView.module.css";

export interface MemberRowData {
  userId: string;
  name: string;
  email: string;
  // workspaceMember.role is a plain `text` column (DB CHECK enforces the enum, not the Drizzle
  // type) -- role stays `string` here rather than importing rbac.ts's `Role` type, keeping this
  // "use client" component fully decoupled from @/lib/rbac (TrashList.tsx precedent).
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: "소유자",
  ADMIN: "관리자",
  EDITOR: "편집자",
  VIEWER: "뷰어",
};

export function MemberRow({ name, email, role }: MemberRowData) {
  return (
    <div className={styles.row}>
      <Avatar name={name} />
      <div className={styles.identity}>
        <span className={styles.name}>{name}</span>
        <span className={styles.email}>{email}</span>
      </div>
      <span className={styles.badge}>{ROLE_LABEL[role] ?? role}</span>
    </div>
  );
}
