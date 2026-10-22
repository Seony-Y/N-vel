import Link from "next/link";
import type { recentEvents } from "@/lib/admin/stats";
import { dt, EVENT_LABEL, Panel, Table, Td } from "./ui";

export function EventsPanel({ events }: { events: Awaited<ReturnType<typeof recentEvents>> }) {
  return (
    <Panel title="최근 이벤트 (오류·거절·규칙 위반)">
      <Table head={["시각", "종류", "사용자", "사건", "위치", "내용"]} empty={!events.length}>
        {events.map((e) => (
          <tr key={e.id}>
            <Td className="text-zinc-500">{dt(e.createdAt)}</Td>
            <Td>
              {EVENT_LABEL[e.type].icon} {EVENT_LABEL[e.type].label}
            </Td>
            <Td>{e.userId ? <Link href={`/admin/users/${e.userId}`} className="hover:text-red-600">{e.email}</Link> : "-"}</Td>
            <Td>{e.sessionId ? <Link href={`/admin/sessions/${e.sessionId}`} className="hover:text-red-600">{e.caseTitle ?? "플레이"}</Link> : (e.caseTitle ?? "-")}</Td>
            <Td className="font-mono text-xs text-zinc-500">{e.where}</Td>
            <td className="max-w-md truncate px-4 py-2 text-zinc-600 dark:text-zinc-300" title={e.message}>
              {e.message}
            </td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}
