import { Resend } from "resend";

/*
 * 메일 발송 (Resend). RESEND_API_KEY 가 없으면 보내지 않고 서버 콘솔에 내용을 찍는다 (개발용).
 * 보내는 주소(EMAIL_FROM)는 Resend 에서 인증한 도메인이어야 한다.
 * 도메인 인증 전에는 onboarding@resend.dev 로, Resend 가입 이메일로만 보낼 수 있다.
 */

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "N-vel <onboarding@resend.dev>";

export async function sendEmail(p: { to: string; subject: string; html: string; text: string }) {
  if (!resend) {
    console.log(`\n[메일 - 개발 모드, 실제로 보내지 않음]\n받는 사람: ${p.to}\n제목: ${p.subject}\n${p.text}\n`);
    return;
  }
  const { error } = await resend.emails.send({ from: FROM, to: p.to, subject: p.subject, html: p.html, text: p.text });
  if (error) {
    console.error("[메일] 발송 실패", error);
    throw new Error("인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요");
  }
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function verificationEmail(name: string, url: string, bonus: number) {
  const safeName = escape(name);
  return {
    subject: "[N-vel] 이메일 인증을 완료해 주세요",
    text: `${name}님, N-vel 에 가입해 주셔서 감사합니다.\n아래 링크를 눌러 이메일 인증을 완료하면 ${bonus} 크레딧을 드려요. (24시간 동안 유효)\n\n${url}\n\n본인이 가입하지 않았다면 이 메일을 무시하세요.`,
    html: `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:22px;font-weight:700;color:#18181b">N-vel</td></tr>
<tr><td style="padding-top:20px;font-size:16px;color:#18181b;line-height:1.6">${safeName}님, 가입해 주셔서 감사합니다.<br>아래 버튼을 눌러 이메일 인증을 완료하면 <b>💎 ${bonus} 크레딧</b>을 드려요.</td></tr>
<tr><td style="padding:28px 0"><a href="${escape(url)}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:12px">이메일 인증하기</a></td></tr>
<tr><td style="font-size:13px;color:#71717a;line-height:1.6">버튼이 눌리지 않으면 아래 주소를 브라우저에 붙여넣으세요. 링크는 24시간 동안 유효해요.<br><span style="word-break:break-all">${escape(url)}</span><br><br>본인이 가입하지 않았다면 이 메일을 무시하세요.</td></tr>
</table></td></tr></table></body></html>`,
  };
}

/** 일회용(임시) 메일 도메인. 가입 보너스를 노린 대량 가입을 줄이기 위해 막는다 */
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "10minutemail.com", "10minutemail.net",
  "tempmail.com", "temp-mail.org", "tempmail.net", "throwawaymail.com", "yopmail.com", "yopmail.net", "getnada.com",
  "dispostable.com", "maildrop.cc", "trashmail.com", "fakeinbox.com", "mintemail.com", "mohmal.com", "emailondeck.com",
  "tempail.com", "burnermail.io", "moakt.com", "mailnesia.com", "spamgourmet.com", "inboxkitten.com", "tempr.email",
]);

export function isDisposableEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return DISPOSABLE.has(domain) || [...DISPOSABLE].some((d) => domain.endsWith(`.${d}`));
}
