// src/app/(auth)/invitations/accept/page.tsx — RSC 5-state result page. Pitfall 6: no
// GET /api/invitations/accept route exists — this page calls acceptInvitation() directly
// (same "RSC calls lib directly" convention as d/[docId]/page.tsx -> lib/documents.getDocument).
// UI-SPEC "로딩: 해당 없음" — token verification completes server-side before any HTML ships,
// so there is no client loading state and no auto-redirect on success (user clicks the button).
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { auth } from "@/auth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { acceptInvitation } from "@/lib/invitations";
import styles from "./page.module.css";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invitations/accept?token=${token ?? ""}`)}`);
  }

  // A missing token parses to invalid-signature inside acceptInvitation (empty payload has no
  // "." delimiter) — no separate "token 자체가 없음" branch needed here.
  const result = await acceptInvitation(token ?? "", session.user.id);

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        {result.status === "success" ? (
          <>
            <CheckCircle2 size={24} className={styles.iconAccent} />
            <h1 className={styles.title}>초대를 수락했어요</h1>
            <p className={styles.body}>{`'${result.workspaceName}'의 편집자로 합류했습니다.`}</p>
            <Link href={`/w/${result.workspaceId}`}>
              <Button variant="primary">워크스페이스로 이동</Button>
            </Link>
          </>
        ) : result.status === "expired" ? (
          <>
            <AlertCircle size={24} className={styles.iconDestructive} />
            <h1 className={styles.title}>초대가 만료됐어요</h1>
            <p className={styles.body}>이 초대 링크는 유효 기간이 지났어요. 워크스페이스 관리자에게 새 초대를 요청해 주세요.</p>
            <Link href="/dashboard">
              <Button variant="secondary">대시보드로 이동</Button>
            </Link>
          </>
        ) : result.status === "already-used" ? (
          <>
            <AlertCircle size={24} className={styles.iconDestructive} />
            <h1 className={styles.title}>이미 사용된 초대예요</h1>
            <p className={styles.body}>이 초대 링크는 이미 한 번 사용됐어요.</p>
            <Link href="/dashboard">
              <Button variant="secondary">대시보드로 이동</Button>
            </Link>
          </>
        ) : result.status === "wrong-user" ? (
          <>
            <AlertCircle size={24} className={styles.iconDestructive} />
            <h1 className={styles.title}>이 계정으로는 사용할 수 없어요</h1>
            <p className={styles.body}>초대받은 계정으로 로그인한 후 다시 시도해 주세요.</p>
            <Link href="/login">
              <Button variant="secondary">로그인</Button>
            </Link>
          </>
        ) : (
          <>
            <AlertCircle size={24} className={styles.iconDestructive} />
            <h1 className={styles.title}>유효하지 않은 링크예요</h1>
            <p className={styles.body}>링크가 손상됐거나 올바르지 않아요. 초대 이메일의 링크를 다시 확인해 주세요.</p>
            <Link href="/dashboard">
              <Button variant="secondary">대시보드로 이동</Button>
            </Link>
          </>
        )}
      </Card>
    </main>
  );
}
