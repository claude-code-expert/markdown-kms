// src/lib/mailer.ts — storage.ts류 "저장 함수 하나 교체로 끝나도록 한 모듈에 가둔다" 원칙의
// 메일 버전(TRD §9.2). 제공자는 Resend. 호출부는 이 파일의 두 export만 안다.
import { Resend } from "resend";

// 절대 바뀌지 않을 값이면 상수로 두는 게 맞지만, Resend 도메인 검증이 끝나기 전에는
// onboarding@resend.dev 로 갈아끼워야 발송 자체가 가능하다. 그 한 가지 이유로 env를 둔다.
const FROM = process.env.MAIL_FROM ?? "markdown-kms <noreply@mingleup.net>";

interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * RESEND_API_KEY가 없으면 콘솔로 떨어진다. 로컬 개발과 테스트가 API 키 없이 돌아가야 하고,
 * 키를 안 넣었다고 가입이 실패해서도 안 된다.
 *
 * 옛 구현은 이 콘솔 경로가 유일한 발송 수단이라 초대 토큰 원문이 프로덕션 로그에 남는 유출
 * 표면이었다(07-REVIEW WR-04). 이제 프로덕션에는 키가 있으므로 그 경로를 타지 않는다.
 */
async function send(mail: Mail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[mailer] (dev) → ${mail.to} | ${mail.subject}\n${mail.text}`);
    return;
  }

  const { error } = await new Resend(apiKey).emails.send({
    from: FROM,
    to: [mail.to],
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });

  // SDK는 던지지 않고 { data, error }를 준다 — 확인하지 않으면 실패가 조용히 성공으로 보인다.
  if (error) {
    throw new Error(`resend send failed: ${error.name} ${error.message}`);
  }
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  await send({
    to,
    subject: `[markdown-kms] 인증 코드 ${code}`,
    text: `아래 6자리 코드를 가입 화면에 입력해 주세요.\n\n${code}\n\n10분 뒤 만료됩니다. 본인이 요청하지 않았다면 이 메일을 무시하세요.`,
    // React Email을 쓰지 않는다 — 코드 한 줄 담은 메일에 템플릿 엔진과 빌드 단계는 과하다.
    html: `<p>아래 6자리 코드를 가입 화면에 입력해 주세요.</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px;font-family:monospace">${code}</p>
<p>10분 뒤 만료됩니다. 본인이 요청하지 않았다면 이 메일을 무시하세요.</p>`,
  });
}

export async function sendInvitationEmail(to: string, acceptLink: string): Promise<void> {
  await send({
    to,
    subject: "[markdown-kms] 워크스페이스 초대",
    text: `워크스페이스에 초대되었습니다. 아래 링크로 수락해 주세요.\n\n${acceptLink}`,
    html: `<p>워크스페이스에 초대되었습니다.</p>
<p><a href="${acceptLink}">초대 수락하기</a></p>`,
  });
}
