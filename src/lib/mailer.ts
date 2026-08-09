// src/lib/mailer.ts — storage.ts류 "저장 함수 하나 교체로 끝나도록 한 모듈에 가둔다" 원칙의
// 메일 버전. sendInvitationEmail이 유일한 export. 프로덕션 SMTP 전환은 이 함수 본문 교체만으로
// 끝나야 한다(호출부는 그대로). 신규 dep 없음(TRD §9는 프로덕션에서 nodemailer를 언급하지만
// 07-CONTEXT.md가 dev 콘솔로 이 phase 범위를 명시적으로 좁혔다).
export async function sendInvitationEmail(to: string, acceptLink: string): Promise<void> {
  // 유출 표면은 이 로그 한 곳뿐 — 토큰 원문이 등장하는 유일한 지점(NFR-3.3).
  console.log(`[mailer] invitation email → ${to}: ${acceptLink}`);
}
