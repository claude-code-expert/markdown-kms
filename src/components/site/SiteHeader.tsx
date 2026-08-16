import Link from "next/link";
import { auth, signOut } from "@/auth";
import buttonStyles from "@/components/ui/Button.module.css";
import styles from "./SiteHeader.module.css";

// 랜딩·로그인·사인업·대시보드·워크스페이스(w/[wsId] 전체, 3-pane 에디터 포함)에서
// 공유하는 상단 헤더. 로고는 로그인 상태면 대시보드로, 아니면 랜딩(/)으로 보낸다.
// 로그인 상태에서는 우측에 로그아웃(서버 액션, Auth.js v5 signOut)만 보인다.
export async function SiteHeader() {
  const session = await auth();
  const isAuthed = Boolean(session?.user?.id);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href={isAuthed ? "/dashboard" : "/"} className={styles.logo}>
          Markdown KMS
        </Link>
        {isAuthed ? (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button type="submit" className={`${buttonStyles.btn} ${buttonStyles.secondary}`}>
              로그아웃
            </button>
          </form>
        ) : (
          <nav className={styles.actions}>
            <Link href="/login" className={`${buttonStyles.btn} ${buttonStyles.secondary}`}>
              로그인
            </Link>
            <Link href="/signup" className={`${buttonStyles.btn} ${buttonStyles.primary}`}>
              회원가입
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
