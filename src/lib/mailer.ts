// src/lib/mailer.ts — storage.ts류 "저장 함수 하나 교체로 끝나도록 한 모듈에 가둔다" 원칙의
// 메일 버전. sendInvitationEmail이 유일한 export. 프로덕션 SMTP 전환은 이 함수 본문 교체만으로
// 끝나야 한다(호출부는 그대로). 신규 dep 없음(TRD §9는 프로덕션에서 nodemailer를 언급하지만
// 07-CONTEXT.md가 dev 콘솔로 이 phase 범위를 명시적으로 좁혔다).
export async function sendInvitationEmail(to: string, acceptLink: string): Promise<void> {
  // WR-04 (07-REVIEW.md): 유출 표면은 이 로그 한 곳뿐 — 토큰 원문이 등장하는 유일한 지점
  // (NFR-3.3). dev 콘솔 메일러라는 이 phase의 명시적 스코프(07-CONTEXT.md)이며 의도된 것이지만,
  // 프로덕션 SMTP 전환(이 함수 본문 교체) 전 필수 확인 항목: 이 로그 라인이 프로덕션 빌드에도
  // 그대로 남아 있으면 서버 로그·모니터링 서비스에 접근 가능한 누구나 미사용 초대 토큰을 획득할
  // 수 있는 표면이 된다 — 실제 SMTP로 교체하며 반드시 함께 제거할 것.
  console.log(`[mailer] invitation email → ${to}: ${acceptLink}`);
}
