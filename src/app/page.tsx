import Link from "next/link";
import { redirect } from "next/navigation";
import { Folder, FileText } from "lucide-react";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Card } from "@/components/ui/Card";
import buttonStyles from "@/components/ui/Button.module.css";
import styles from "./page.module.css";

const FEATURES = [
  {
    term: "실시간 미리보기",
    body: "굵게·기울임·표·코드블록 같은 서식을 툴바나 마크다운 문법으로 적용하면, 입력과 동시에 안전하게 렌더링된 미리보기로 확인합니다.",
  },
  {
    term: "폴더 트리",
    body: "문서를 워크스페이스 안의 폴더 계층으로 정리합니다. 폴더를 옮기거나 지우면 하위 문서까지 함께 움직입니다.",
  },
  {
    term: "자동 저장",
    body: "입력을 멈추면 저장됩니다. 브라우저가 닫혀도 임시 저장본이 남아 이어서 쓸 수 있습니다.",
  },
  {
    term: "태그와 검색",
    body: "문서마다 태그를 최대 3개까지 붙이고, 제목·본문·태그로 검색합니다. 한글 검색도 정확하게 동작합니다.",
  },
  {
    term: "내보내기",
    body: "문서는 .md로, 폴더는 .zip으로 원문 그대로 내려받습니다.",
  },
];

// 미인증 사용자만 마케팅 랜딩을 본다. 로그인 상태면 곧장 대시보드로 보낸다
// (기존 "/" 리다이렉트 계약 중 이 절반만 유지 — 나머지 절반은 아래 렌더로 대체).
export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <>
      <SiteHeader />
      <main>
        {/* 풀와이드 히어로 밴드 — accent-weak 배경(라이트/다크 자동 전환)으로 색감을 주고,
            내부 콘텐츠는 본문 컬럼과 같은 720px 폭으로 정렬한다. */}
        <section className={styles.heroBand}>
          <div className={styles.heroInner}>
            <div className={styles.heroText}>
              <h1 className={styles.headline}>마크다운 문서를, 워크스페이스 단위로 관리한다.</h1>
              <p className={styles.subcopy}>
                입력한 서식은 60ms 안에 미리보기로 반영되고, 입력을 멈추면 자동으로 저장됩니다.
                폴더로 문서를 정리하고, 팀원을 초대해 함께 씁니다.
              </p>
              <div className={styles.heroActions}>
                <Link href="/signup" className={`${buttonStyles.btn} ${buttonStyles.primary}`}>
                  가입하고 시작하기
                </Link>
                <Link href="/login" className={`${buttonStyles.btn} ${buttonStyles.secondary}`}>
                  로그인
                </Link>
              </div>
            </div>

            {/* 실제 화면을 요약한 미니 프리뷰 — 장식용 도형이 아니라 폴더/문서/서식 줄을
                그대로 축약한 그래픽. 새 이미지 자산 없이 기존 lucide 아이콘 + 토큰만 사용. */}
            <div className={styles.heroPreview} aria-hidden="true">
              <div className={styles.previewBar}>
                <Folder size={14} className={styles.previewIcon} />
                <span>워크스페이스 / 기획 문서</span>
              </div>
              <div className={styles.previewBody}>
                <FileText size={16} className={styles.previewFileIcon} />
                <div className={styles.previewLines}>
                  <span className={`${styles.previewLine} ${styles.previewLineAccent}`} style={{ width: "70%" }} />
                  <span className={styles.previewLine} style={{ width: "94%" }} />
                  <span className={styles.previewLine} style={{ width: "60%" }} />
                  <span className={styles.previewLine} style={{ width: "82%" }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 풀 사이즈 섹션 — 아래 두 섹션만 720px 컬럼을 벗어나 넓은 화면을 그대로 쓴다.
            "쓰는 법"은 짧은 순서 목록이라 좁은 컬럼이 그대로 낫다(아래 .page 참조). */}
        <section className={styles.fullBand}>
          <div className={styles.fullInner}>
            <h2 className={styles.sectionTitle}>무엇을 할 수 있나</h2>
            <div className={styles.featureGrid}>
              {FEATURES.map((feature) => (
                <Card key={feature.term} className={styles.featureCard}>
                  <span className={styles.featureTerm}>{feature.term}</span>
                  <p className={styles.featureBody}>{feature.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.fullBand}>
          <div className={styles.fullInner}>
            <h2 className={styles.sectionTitle}>워크스페이스, 만들거나 참여하거나</h2>
            <div className={styles.workspaceGrid}>
              <Card className={styles.workspaceCard}>
                <h3 className={styles.workspaceCardTitle}>새로 만들기</h3>
                <p className={styles.paragraph}>
                  로그인 후 대시보드에서 &ldquo;워크스페이스 만들기&rdquo;를 누르세요. 만든 사람이
                  오너가 됩니다.
                </p>
              </Card>
              <Card className={styles.workspaceCard}>
                <h3 className={styles.workspaceCardTitle}>참여하기</h3>
                <p className={styles.paragraph}>
                  워크스페이스 ID로 참여 신청을 보내고 관리자 승인을 기다리거나, 이메일로 받은
                  초대 링크를 열어 바로 편집자로 합류합니다.
                </p>
              </Card>
            </div>
          </div>
        </section>

        <div className={styles.page}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>쓰는 법</h2>
            <ol className={styles.steps}>
              <li>문서를 열고 툴바나 마크다운 문법으로 서식을 적용합니다.</li>
              <li>폴더에 정리하고 태그를 답니다.</li>
              <li>나중에 제목·본문·태그로 찾습니다.</li>
              <li>필요하면 .md나 .zip으로 내려받습니다.</li>
            </ol>
          </section>
        </div>

        <section className={styles.closingBand}>
          <div className={styles.closingInner}>
            <p className={styles.closingText}>지금 바로 첫 워크스페이스를 만들어 보세요.</p>
            <Link href="/signup" className={`${buttonStyles.btn} ${buttonStyles.primary}`}>
              가입하기
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
