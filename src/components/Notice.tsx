import Link from "next/link";

/** 화면 가운데 안내 (오류, 없는 화면) */
export function Notice({ icon, title, text, children }: { icon: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <main className="flex min-h-[70vh] flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-4xl" aria-hidden>
          {icon}
        </p>
        <h1 className="mt-3 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-zinc-500">{text}</p>
        <div className="mt-5 space-y-2">
          {children}
          <Link href="/" className="block w-full rounded-lg border border-zinc-300 py-2.5 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            사건 목록으로
          </Link>
        </div>
      </div>
    </main>
  );
}
