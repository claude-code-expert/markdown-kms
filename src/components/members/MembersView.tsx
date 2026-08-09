"use client";

// UI-SPEC Members Page Contract — section order: 제목 → 승인 대기 중(ADMIN+) → 멤버 목록(VIEWER+)
// → 회원 초대(ADMIN+). Non-ADMIN never renders the ADMIN-only sections at all (not disabled) —
// CLAUDE.md "UI 버튼 숨김은 보안이 아니다": the server still enforces requireRole ADMIN on every
// mutating route regardless of what this component renders.
import { InviteSearch } from "./InviteSearch";
import { MemberRow, type MemberRowData } from "./MemberRow";
import { PendingRequestRow, type PendingRequestRowData } from "./PendingRequestRow";
import styles from "./MembersView.module.css";

interface MembersViewProps {
  members: MemberRowData[];
  pending: PendingRequestRowData[];
  canManage: boolean;
  wsId: string;
}

export function MembersView({ members, pending, canManage, wsId }: MembersViewProps) {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>멤버</h1>

      {canManage && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>승인 대기 중</h2>
          {pending.length === 0 ? (
            <p className={styles.empty}>대기 중인 요청이 없어요</p>
          ) : (
            pending.map((request) => <PendingRequestRow key={request.reqId} request={request} wsId={wsId} />)
          )}
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>멤버 목록</h2>
        {members.map((member) => (
          <MemberRow key={member.userId} {...member} />
        ))}
      </section>

      {canManage && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>회원 초대</h2>
          <InviteSearch wsId={wsId} />
        </section>
      )}
    </div>
  );
}
