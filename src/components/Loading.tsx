/** 불러오는 동안 화면 가운데에 띄우는 회전 표시 + 문구 */
export function Loading({ text = "불러오는 중..." }: { text?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 px-4 text-sm text-zinc-500 dark:text-zinc-400">
      <span aria-hidden className="h-9 w-9 animate-spin rounded-full border-[3px] border-zinc-200 border-t-red-600 dark:border-zinc-700 dark:border-t-red-500" />
      {text}
    </div>
  );
}
