import type { dropOff } from "@/lib/admin/stats";
import { Panel, Table, Td } from "./ui";

/** 비회원 프롤로그의 단계 이름 (프롤로그 가이드 순서). 가이드를 바꾸면 여기도 맞춘다 */
const GUEST_STEPS = [
  ["start", "시작"],
  ["find:C1", "선반 조사"],
  ["find:T1", "강도윤 심문"],
  ["find:C4", "사물함 열기"],
  ["submit", "추리 제출"],
  ["solved", "해결"],
  ["claim", "가입 (기록 옮김)"],
] as const;

export function DropOff({ rows, guest }: { rows: Awaited<ReturnType<typeof dropOff>>; guest: Map<string, number> }) {
  const start = guest.get("start") ?? 0;
  return (
    <Panel title="이탈 지점">
      <Table head={["비회원 프롤로그", ...GUEST_STEPS.map(([, label]) => label), "포기"]}>
        <tr>
          <Td>횟수 (시작 대비)</Td>
          {GUEST_STEPS.map(([k]) => (
            <Td key={k} num>
              {guest.get(k) ?? 0} {start > 0 && <span className="text-xs text-zinc-400">{Math.round((100 * (guest.get(k) ?? 0)) / start)}%</span>}
            </Td>
          ))}
          <Td num>{guest.get("giveup") ?? 0}</Td>
        </tr>
      </Table>
      <Table head={["사건 (회원, 첫 도전)", "시작", "끝냄", "행동 0회에서 멈춤", "1~5회", "6~15회", "16회 이상"]} empty={!rows.length}>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td>{r.title}</Td>
            <Td num>{r.started}</Td>
            <Td num>{r.finished}</Td>
            <Td num>{r.none}</Td>
            <Td num>{r.few}</Td>
            <Td num>{r.mid}</Td>
            <Td num>{r.late}</Td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}
