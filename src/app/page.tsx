import Link from "next/link";
import { redirect } from "next/navigation";
import { Columns2, Folder, RotateCcw, Users } from "lucide-react";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site/SiteHeader";
import buttonStyles from "@/components/ui/Button.module.css";
import { ClosingSubtext } from "./ClosingSubtext";
import { HeroPreview } from "./HeroPreview";
import styles from "./page.module.css";

// 재작업(docs/claude_design 2a 목업 1:1 대조) — 구성/카피/아이콘 전부 목업 원문 그대로.
const FEATURES = [
  { icon: Folder, title: "폴더 트리", body: "드래그앤드롭으로 문서를 자유롭게 조직" },
  { icon: Columns2, title: "듀얼 뷰 에디터", body: "쓰면서 바로 보는 에디터·미리보기 분할" },
  { icon: Users, title: "역할 기반 권한", body: "Owner부터 Viewer까지 4단계 협업" },
  { icon: RotateCcw, title: "휴지통 복원", body: "지운 문서도 언제든 되돌리기" },
];

const STEPS = [
  "회원가입하면 기본 워크스페이스가 바로 생겨요.",
  "사이드바에서 폴더를 만들고 새 문서를 시작하세요.",
  "마크다운으로 쓰면 오른쪽에서 바로 미리보기.",
  "팀원을 초대하고 역할을 정해 함께 쓰세요.",
];

// 미인증 사용자만 마케팅 랜딩을 본다. 로그인 상태면 곧장 대시보드로 보낸다.
export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <>
      <SiteHeader />
      <main>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <span className={styles.badge}>MARKDOWN KNOWLEDGE BASE</span>
            <h1 className={styles.headline}>
              팀의 지식을,
              <br />
              마크다운 그대로.
            </h1>
            <p className={styles.subcopy}>
              폴더 트리로 조직하고, 에디터·미리보기 듀얼 뷰로 쓰고, 역할 기반 권한으로 협업하는 문서 워크스페이스.
            </p>
            <div className={styles.heroActions}>
              <Link href="/signup" className={`${buttonStyles.btn} ${buttonStyles.primary} ${styles.heroButton}`}>
                무료로 시작하기
              </Link>
              <Link href="/login" className={`${buttonStyles.btn} ${buttonStyles.secondary} ${styles.heroButton}`}>
                로그인
              </Link>
            </div>
          </div>

          {/* 실제 3-pane 화면을 축약한 미니 프리뷰 — 마크다운 타이핑 애니메이션(HeroPreview.tsx,
              client 컴포넌트로 분리). */}
          <HeroPreview />
        </section>

        <section className={styles.features}>
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className={styles.featureCard}>
              <Icon size={18} className={styles.featureIcon} />
              <span className={styles.featureTitle}>{title}</span>
              <span className={styles.featureBody}>{body}</span>
            </div>
          ))}
        </section>

        <section className={styles.workspaceRow}>
          <div className={styles.workspaceBox}>
            <span className={styles.workspaceLabel}>OWNER</span>
            <span className={styles.workspaceTitle}>워크스페이스 개설하기</span>
            <span className={styles.workspaceBody}>팀 공간을 만들고 멤버를 초대하세요.</span>
          </div>
          <div className={styles.workspaceBox}>
            <span className={styles.workspaceLabel}>MEMBER</span>
            <span className={styles.workspaceTitle}>기존 팀에 가입하기</span>
            <span className={styles.workspaceBody}>검색해서 참여 신청하거나 초대 링크로 합류.</span>
          </div>
        </section>

        {/* 쓰는 법 + 클로징 CTA를 한 섹션으로 합쳐 hero와 같은 960px 폭을 쓴다 — 아래로
            내려갈수록 컬럼이 좁아지던(640px) 깔때기 모양을 없앴다. */}
        <section className={styles.finalSection}>
          <div className={styles.howTo}>
            <span className={styles.howToTitle}>사용 가이드</span>
            {STEPS.map((step, index) => (
              <div key={step} className={styles.step}>
                <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.stepText}>{step}</span>
              </div>
            ))}
          </div>
          <div className={styles.closing}>
            <span className={styles.closingText}>팀의 지식을 마크다운으로 기록하세요</span>
            <ClosingSubtext />
          </div>
        </section>
      </main>
    </>
  );
}
