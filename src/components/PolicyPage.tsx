import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SITE } from "@/lib/site";

/** 이용약관·개인정보처리방침 공통 틀 */
export function PolicyPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          시행일 {SITE.policyDate} · v{SITE.version}
        </p>
        <div className="mt-6 space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {children}
        </div>
        <p className="mt-4 text-center text-xs text-zinc-500">
          <Link href="/terms" className="hover:text-zinc-800 dark:hover:text-zinc-200">
            이용약관
          </Link>
          {" · "}
          <Link href="/privacy" className="hover:text-zinc-800 dark:hover:text-zinc-200">
            개인정보처리방침
          </Link>
          {" · "}
          문의 <a href={`mailto:${SITE.contact}`} className="hover:text-zinc-800 dark:hover:text-zinc-200">{SITE.contact}</a>
        </p>
      </main>
    </>
  );
}

export function Article({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">
        제{n}조 ({title})
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function Items({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal space-y-1 pl-5">{children}</ol>;
}
