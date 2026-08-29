// src/lib/mailer.ts — storage.ts류 "저장 함수 하나 교체로 끝나도록 한 모듈에 가둔다" 원칙의
// 메일 버전(TRD §9.2). 제공자는 Resend. 호출부는 이 파일의 두 export만 안다.
import { Resend } from "resend";

// 절대 바뀌지 않을 값이면 상수로 두는 게 맞지만, Resend 도메인 검증이 끝나기 전에는
// onboarding@resend.dev 로 갈아끼워야 발송 자체가 가능하다. 그 한 가지 이유로 env를 둔다.
const FROM = process.env.MAIL_FROM ?? "markdown-kms <noreply@mingleup.net>";

// 회신 가능한 주소가 있으면 실어 보낸다. Gmail은 noreply 일변도보다 회신 가능한 발신자를
// 덜 의심한다. 없는 주소를 넣으면 바운스가 평판을 깎으므로, 실제 수신함이 있을 때만 설정한다.
const REPLY_TO = process.env.MAIL_REPLY_TO;

// 본문 푸터에 노출할 서비스 주소. AUTH_URL을 재사용해 초대 링크와 origin이 어긋나지 않게 한다.
const SITE_URL = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://mingleup.net").replace(
  /\/$/,
  "",
);

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
    ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
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

// 스팸 분류를 낮추기 위한 공통 푸터. 필터는 "누가 왜 보냈는지"가 본문에 있는 메일을 덜
// 의심하고, 사람도 그걸 보고 "스팸 아님"을 눌러준다(그 피드백이 도메인 평판을 올린다).
// 발신 도메인을 본문에 그대로 노출해 From과 대조 가능하게 하는 것도 같은 목적이다.
const FOOTER_TEXT = `\n\n---\nmarkdown-kms · ${SITE_URL}\n이 메일은 ${SITE_URL}에서 가입을 시작한 주소로만 발송됩니다.`;
const FOOTER_HTML = `<hr style="border:0;border-top:1px solid #e3e7ec;margin:24px 0">
<p style="color:#5c6672;font-size:12px;line-height:1.6">
  markdown-kms · <a href="${SITE_URL}" style="color:#5c6672">${SITE_URL}</a><br>
  이 메일은 ${SITE_URL}에서 가입을 시작한 주소로만 발송됩니다.
</p>`;

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  await send({
    to,
    // 대괄호 프리픽스는 대량 발송 템플릿의 지문이라 뺀다. 코드를 제목에 넣는 것 자체는
    // 알림창에서 바로 읽히는 이점이 커서 유지한다.
    subject: `markdown-kms 인증 코드 ${code}`,
    text: `markdown-kms 가입을 마치려면 아래 6자리 코드를 가입 화면에 입력해 주세요.

${code}

이 코드는 10분 뒤 만료됩니다. 누구에게도 알려주지 마세요.
본인이 요청하지 않았다면 이 메일을 무시하면 됩니다 — 계정은 만들어지지 않습니다.${FOOTER_TEXT}`,
    // React Email을 쓰지 않는다 — 코드 한 줄 담은 메일에 템플릿 엔진과 빌드 단계는 과하다.
    // 다만 본문이 너무 짧고 큰 숫자만 있으면 피싱 메일과 모양이 같아지므로, 맥락 문장을
    // 충분히 넣어 텍스트 비중을 확보한다.
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.7;color:#14171c;max-width:480px">
  <p>markdown-kms 가입을 마치려면 아래 6자리 코드를 가입 화면에 입력해 주세요.</p>
  <p style="font-size:28px;font-weight:700;letter-spacing:6px;font-family:ui-monospace,monospace;margin:24px 0">${code}</p>
  <p>이 코드는 10분 뒤 만료됩니다. 누구에게도 알려주지 마세요.</p>
  <p>본인이 요청하지 않았다면 이 메일을 무시하면 됩니다 — 계정은 만들어지지 않습니다.</p>
  ${FOOTER_HTML}
</div>`,
  });
}

export async function sendInvitationEmail(to: string, acceptLink: string): Promise<void> {
  await send({
    to,
    subject: "markdown-kms 워크스페이스 초대",
    text: `markdown-kms 워크스페이스에 초대되었습니다. 아래 주소를 열어 수락해 주세요.

${acceptLink}

이 링크는 7일 뒤 만료되며 한 번만 사용할 수 있습니다.${FOOTER_TEXT}`,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.7;color:#14171c;max-width:480px">
  <p>markdown-kms 워크스페이스에 초대되었습니다.</p>
  <p style="margin:24px 0"><a href="${acceptLink}" style="color:#2e5fe8;font-weight:600">초대 수락하기</a></p>
  <p>이 링크는 7일 뒤 만료되며 한 번만 사용할 수 있습니다.</p>
  ${FOOTER_HTML}
</div>`,
  });
}
