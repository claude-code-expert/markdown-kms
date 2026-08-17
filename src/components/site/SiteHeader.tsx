import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Avatar } from "@/components/ui/Avatar";
import buttonStyles from "@/components/ui/Button.module.css";
import styles from "./SiteHeader.module.css";

// 랜딩·로그인·사인업·대시보드·워크스페이스(w/[wsId] 전체, 3-pane 에디터 포함)에서
// 공유하는 상단 헤더. 로고는 로그인 상태면 대시보드로, 아니면 랜딩(/)으로 보낸다.
// 재검증(1a/2a~2h 목업 재대조) — 헤더는 accent 단색 밴드가 **아니라** 흰 배경(var(--bg))
// + border-bottom 한 줄이다(모든 화면에서 일관 확인). 로고 배지(22px 정사각형)만 accent를
// 쓰고, 워드마크는 "Markdown-KMS" Mono(대소문자 구분). 헤더가 더는 accent가 아니므로 회원가입
// 버튼도 반전 스타일(구 ctaOnAccent) 없이 그냥 buttonStyles.primary.
export async function SiteHeader() {
  const session = await auth();
  const isAuthed = Boolean(session?.user?.id);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href={isAuthed ? "/dashboard" : "/"} className={styles.logo}>
          <span className={styles.logoMark}>M</span>
          Markdown-KMS
        </Link>
        {isAuthed ? (
          <div className={styles.actions}>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className={`${buttonStyles.btn} ${buttonStyles.secondary} ${styles.headerOutline}`}>
                로그아웃
              </button>
            </form>
            <Avatar name={session?.user?.name ?? "?"} size={26} />
          </div>
        ) : (
          <nav className={styles.actions}>
            <Link href="/login" className={`${buttonStyles.btn} ${buttonStyles.secondary} ${styles.headerOutline}`}>
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
