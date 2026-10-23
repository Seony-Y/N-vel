import type { Metadata } from "next";
import Link from "next/link";
import { Article, Items, PolicyPage } from "@/components/PolicyPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "개인정보처리방침 | N-vel" };

const th = "border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-left font-medium dark:border-zinc-700 dark:bg-zinc-800";
const td = "border border-zinc-200 px-2 py-1.5 align-top dark:border-zinc-700";

/** 개인정보를 맡기거나 국외로 옮기는 곳 (실제로 쓰는 외부 서비스와 맞출 것) */
const PROCESSORS = [
  { name: "Anthropic, PBC", country: "미국", what: "플레이 중 입력한 행동·질문·추리 서술, 사건 내용", why: "AI 나레이터·용의자 응답 생성, 서술 채점, 사건 검수" },
  { name: "Neon", country: "싱가포르 (AWS 아시아 태평양 리전)", what: "이 방침 1조의 모든 항목", why: "데이터베이스 보관" },
  { name: "Vercel Inc.", country: "미국 등 (전 세계 서버)", what: "접속 IP, 요청 기록", why: "웹사이트 호스팅" },
  { name: "Resend, Inc.", country: "미국", what: "이메일 주소, 이름", why: "인증 메일 발송 (이메일 가입 계정)" },
  { name: "Google LLC", country: "미국", what: "Google 로그인 시 이름, 이메일, 프로필 사진", why: "Google 계정으로 로그인" },
];

export default function PrivacyPage() {
  return (
    <PolicyPage title="개인정보처리방침">
      <p>
        {SITE.operator}(이하 &ldquo;운영자&rdquo;)는 {SITE.name} 서비스를 운영하면서 「개인정보 보호법」에 따라 이용자의 개인정보를 다음과 같이 처리합니다.
      </p>

      <Article n={1} title="처리하는 개인정보">
        <Items>
          <li>
            <b>가입·로그인</b>: 이름, 이메일 주소, 프로필 사진 주소(Google 계정 제공), 계정 식별자. 비밀번호는 Google 이 관리하며 서비스에 저장하지 않습니다 (운영용 이메일 계정은 암호화한
            비밀번호를 저장).
          </li>
          <li>
            <b>서비스 이용</b>: 플레이 기록(입력한 행동·질문, AI 응답, 찾은 단서, 메모, 제출한 추리와 점수), 만든 사건, 즐겨찾기, 크레딧 지급·차감 내역
          </li>
          <li>
            <b>자동으로 생기는 정보</b>: 로그인 세션의 접속 IP 와 브라우저 정보, 요청 횟수 제한을 위한 IP 기록, AI 사용량(토큰 수·비용), 오류 기록
          </li>
          <li>
            <b>브라우저에 저장되는 정보</b>: 로그인 유지를 위한 쿠키, 임시저장하지 않은 수첩 메모의 백업(이용자 기기에만 저장되며 운영자에게 전송되지 않음)
          </li>
        </Items>
      </Article>

      <Article n={2} title="처리 목적">
        <Items>
          <li>회원 식별, 로그인 유지, 부정 이용 방지</li>
          <li>게임 진행(AI 응답 생성, 단서 판정, 채점)과 진행 상황 저장</li>
          <li>크레딧 지급·차감 관리</li>
          <li>오류 확인, 서비스 품질 개선, 비용 관리</li>
          <li>문의 응대</li>
        </Items>
        <p>광고나 마케팅에는 쓰지 않으며, 개인정보를 판매하지 않습니다.</p>
      </Article>

      <Article n={3} title="보관 기간과 파기">
        <Items>
          <li>개인정보는 회원 탈퇴 때까지 보관합니다. 탈퇴하면 계정, 플레이 기록, 만든 사건, 크레딧 내역, 사용 기록을 지체 없이 함께 삭제합니다.</li>
          <li>이메일 인증 정보는 24시간, 로그인 세션은 만료 시까지만 보관합니다.</li>
          <li>법령에 따라 보관해야 하는 정보가 생기면(예: 유료 결제 도입 시 거래 기록) 그 기간 동안만 따로 보관합니다.</li>
          <li>전자적 파일은 복구할 수 없는 방법으로 삭제합니다.</li>
        </Items>
      </Article>

      <Article n={4} title="처리 위탁과 국외 이전">
        <p>서비스 운영을 위해 아래 업체에 개인정보 처리를 맡기며, 이 과정에서 개인정보가 국외로 전송됩니다. 정보는 서비스를 이용할 때 네트워크를 통해 전송되고, 탈퇴 또는 위탁 계약이 끝날 때까지 보관됩니다.</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={th}>받는 곳</th>
                <th className={th}>국가</th>
                <th className={th}>항목</th>
                <th className={th}>목적</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSORS.map((p) => (
                <tr key={p.name}>
                  <td className={td}>{p.name}</td>
                  <td className={td}>{p.country}</td>
                  <td className={td}>{p.what}</td>
                  <td className={td}>{p.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          AI 에 보내는 내용은 Anthropic 의 상용 API 약관에 따라 처리되며, 기본적으로 AI 모델 학습에 쓰이지 않습니다. 플레이 중에는 실명, 연락처 같은 개인정보를 입력하지 않도록 주의해 주세요.
        </p>
        <p>국외 이전을 원하지 않으면 회원 탈퇴로 거부할 수 있으나, 이 경우 서비스를 이용할 수 없습니다.</p>
      </Article>

      <Article n={5} title="제3자 제공">
        <p>운영자는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 따라 수사기관 등이 정해진 절차로 요구하는 경우는 예외입니다.</p>
      </Article>

      <Article n={6} title="공개되는 정보">
        <p>이용자가 공개한 사건은 다른 이용자에게 보입니다. 플레이 기록, 메모, 이메일 주소는 다른 이용자에게 공개되지 않습니다.</p>
      </Article>

      <Article n={7} title="이용자의 권리">
        <Items>
          <li>이용자는 자신의 개인정보를 열람, 정정, 삭제, 처리 정지하도록 요구할 수 있습니다.</li>
          <li>
            <Link href="/my/account" className="text-red-600 hover:underline">내 계정</Link>에서 직접 탈퇴(전체 삭제)할 수 있고, 그 밖의 요청은 아래 연락처로 보내 주시면 지체 없이 처리합니다.
          </li>
          <li>만 14세 미만은 가입할 수 없으며, 만 14세 미만의 개인정보가 수집된 사실을 알게 되면 바로 삭제합니다.</li>
        </Items>
      </Article>

      <Article n={8} title="안전성 확보 조치">
        <Items>
          <li>모든 통신은 HTTPS 로 암호화합니다.</li>
          <li>로그인 쿠키는 서명해 위조를 막고, 비밀번호는 암호화해 저장합니다.</li>
          <li>데이터베이스와 관리 기능은 운영자만 접근할 수 있습니다.</li>
        </Items>
      </Article>

      <Article n={9} title="쿠키">
        <p>로그인 상태를 유지하기 위해 쿠키를 사용합니다. 광고·추적용 쿠키는 쓰지 않습니다. 브라우저 설정에서 쿠키를 막을 수 있지만, 그러면 로그인이 필요한 기능을 쓸 수 없습니다.</p>
      </Article>

      <Article n={10} title="개인정보 보호책임자">
        <ul className="space-y-0.5">
          <li>책임자: {SITE.operator} (운영자)</li>
          <li>
            연락처: <a href={`mailto:${SITE.contact}`} className="text-red-600 hover:underline">{SITE.contact}</a>
          </li>
        </ul>
        <p>
          개인정보 침해에 대한 신고나 상담은 개인정보침해신고센터(privacy.kisa.or.kr, 국번 없이 118), 개인정보분쟁조정위원회(kopico.go.kr, 1833-6972)에도 할 수 있습니다.
        </p>
      </Article>

      <Article n={11} title="방침 변경">
        <p>이 방침을 바꾸면 시행 7일 전부터 사이트에 알립니다. 이 방침은 {SITE.policyDate}부터 시행합니다.</p>
      </Article>
    </PolicyPage>
  );
}
