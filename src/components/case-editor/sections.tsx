"use client";

import { SandboxedHtml } from "@/components/SandboxedHtml";
import { AddButton, inputClass, ItemCard, Label, Section, TextArea, TextInput } from "@/components/form/fields";
import { emptyClue, emptySuspect, nextCode, removeClue, removeLocation, removeSuspect, type Draft } from "./draft";

/** 에디터 각 탭. update 는 초안을 복사해 고친 뒤 반영한다 */
type Props = { d: Draft; update: (fn: (d: Draft) => void) => void };

function Select({ title, hint, value, onChange, options, placeholder }: { title: string; hint?: string; value: string | undefined; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <label className="block">
      <Label title={title} hint={hint} />
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberInput({ title, hint, value, onChange, min, max, allowEmpty }: { title: string; hint?: string; value: number | null | undefined; onChange: (v: number | null) => void; min?: number; max?: number; allowEmpty?: boolean }) {
  return (
    <label className="block">
      <Label title={title} hint={hint} />
      <input
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? (allowEmpty ? null : (min ?? 0)) : Number(e.target.value))}
        className={inputClass}
      />
    </label>
  );
}

function Toggle({ title, hint, checked, onChange }: { title: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{title}</div>
        {hint && <div className="text-xs text-zinc-500">{hint}</div>}
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-red-600" />
    </label>
  );
}


// ───────────────────────── 개요 ─────────────────────────
export function BasicTab({ d, update }: Props) {
  return (
    <>
      <Section title="사건 정보" description="사건 목록과 소개 페이지에 보이는 내용이에요">
        <TextInput title="제목" value={d.title} onChange={(v) => update((x) => void (x.title = v))} max={80} placeholder="예) 폭우 속의 저택" />
        <TextInput title="한줄 소개" value={d.tagline} onChange={(v) => update((x) => void (x.tagline = v))} max={200} />
        <div className="grid gap-4 sm:grid-cols-4">
          <Select
            title="등급"
            value={d.rating}
            onChange={(v) => update((x) => void (x.rating = v as Draft["rating"]))}
            options={[
              { value: "all", label: "전체" },
              { value: "15", label: "15세" },
              { value: "19", label: "19세 (비공개만)" },
            ]}
          />
          <NumberInput title="난이도 (1~5)" value={d.difficulty} min={1} max={5} onChange={(v) => update((x) => void (x.difficulty = Math.min(5, Math.max(1, v ?? 1))))} />
          <NumberInput title="예상 시간 (분)" value={d.estimatedMinutes} min={5} max={600} onChange={(v) => update((x) => void (x.estimatedMinutes = v ?? 30))} />
          <NumberInput title="행동 횟수 제한" hint="비우면 무제한" value={d.maxActions} min={5} max={500} allowEmpty onChange={(v) => update((x) => void (x.maxActions = v))} />
        </div>
        <TextInput
          title="경고 태그"
          hint="쉼표로 구분. 예) 살인, 시신 묘사, 공포"
          value={d.warningTags.join(", ")}
          onChange={(v) => update((x) => void (x.warningTags = v.split(",").map((t) => t.trimStart())))}
        />
        <TextInput title="표지 이미지 주소" hint="https:// 로 시작 (선택)" value={d.coverImage ?? ""} onChange={(v) => update((x) => void (x.coverImage = v))} placeholder="https://..." />
      </Section>

      <Section title="도입부" description="플레이어가 처음 읽는 사건 개요예요. 누가, 어디서, 무슨 일을 당했는지 알려 주세요">
        <TextArea title="사건 개요" value={d.briefing} onChange={(v) => update((x) => void (x.briefing = v))} max={4000} rows={8} />
        <TextArea title="피해자" value={d.victim} onChange={(v) => update((x) => void (x.victim = v))} max={2000} rows={2} placeholder="이름, 나이, 직업, 성격 등 공개 정보" />
      </Section>

      <Section title="꾸민 소개 화면 (선택)" description="사건 페이지 맨 위에 보이는 화면이에요. HTML/CSS 를 쓸 수 있어요 (스크립트는 실행되지 않아요)">
        <div className="grid gap-4 lg:grid-cols-2">
          <TextArea title="코드" value={d.introHtml} onChange={(v) => update((x) => void (x.introHtml = v))} rows={12} mono />
          <div>
            <Label title="미리보기" />
            <div className="h-72 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800">
              {d.introHtml ? <SandboxedHtml title="소개 미리보기" code={d.introHtml} className="h-full w-full border-0" /> : <p className="p-4 text-sm text-zinc-400">비워두면 기본 디자인으로 보여요</p>}
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

// ───────────────────────── 장소 ─────────────────────────
export function LocationsTab({ d, update }: Props) {
  return (
    <Section title="장소" description="플레이어가 이동하며 조사하는 곳이에요. '상세'는 나레이터 AI 만 보는 설명이라, 무엇이 어디에 있는지 구체적으로 적어 주세요">
      {d.locations.map((l, i) => (
        <ItemCard key={l.code} title={`${l.name || `장소 ${i + 1}`}`} onRemove={d.locations.length > 1 ? () => update((x) => removeLocation(x, l.code)) : undefined}>
          <TextInput title="이름" value={l.name} onChange={(v) => update((x) => void (x.locations[i].name = v))} max={50} placeholder="예) 서재" />
          <TextArea title="들어가면 보이는 모습 (공개)" value={l.description} onChange={(v) => update((x) => void (x.locations[i].description = v))} max={2000} rows={2} />
          <TextArea
            title="상세 (나레이터 전용, 비공개)"
            hint="이 장소의 단서가 어디에 어떤 모습으로 있는지, 그 밖에 무엇이 있는지"
            value={l.detail}
            onChange={(v) => update((x) => void (x.locations[i].detail = v))}
            max={4000}
            rows={3}
          />
          <p className="text-xs text-zinc-500">
            이 장소의 단서: {d.clues.filter((c) => c.location === l.code).map((c) => c.name || c.code).join(", ") || "없음 (단서 탭에서 추가)"}
          </p>
        </ItemCard>
      ))}
      <AddButton onClick={() => update((x) => void x.locations.push({ code: nextCode("L", x), name: "", description: "", detail: "" }))} disabled={d.locations.length >= 20}>
        장소 추가 ({d.locations.length}/20)
      </AddButton>
    </Section>
  );
}

// ───────────────────────── 용의자 ─────────────────────────
export function SuspectsTab({ d, update }: Props) {
  return (
    <Section title="용의자" description="AI 가 연기하는 인물이에요. 비공개 항목은 그 용의자를 연기하는 AI 에게만 전달돼요. 범인은 '진상·채점' 탭에서 고릅니다">
      {d.suspects.map((s, i) => {
        const set = (fn: (s: Draft["suspects"][number]) => void) => update((x) => fn(x.suspects[i]));
        const testimony = d.clues.filter((c) => c.holder === s.code);
        return (
          <ItemCard key={s.code} title={`${s.name || `용의자 ${i + 1}`}${d.culprit === s.code ? " 🔪 범인" : ""}`} onRemove={d.suspects.length > 2 ? () => update((x) => removeSuspect(x, s.code)) : undefined}>
            <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
              <TextInput title="이름" value={s.name} onChange={(v) => set((t) => void (t.name = v))} max={50} />
              <NumberInput title="나이" value={s.age} min={0} max={150} allowEmpty onChange={(v) => set((t) => void (t.age = v ?? undefined))} />
            </div>
            <TextInput title="관계·직업 (공개)" value={s.role} onChange={(v) => set((t) => void (t.role = v))} max={200} placeholder="예) 피해자의 딸, 출판사 부사장" />
            <TextArea title="첫인상 (공개)" value={s.profile} onChange={(v) => set((t) => void (t.profile = v))} max={2000} rows={2} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextArea title="성격" value={s.personality} onChange={(v) => set((t) => void (t.personality = v))} max={2000} rows={2} />
              <TextArea title="말투" value={s.speechStyle} onChange={(v) => set((t) => void (t.speechStyle = v))} max={1000} rows={2} />
            </div>
            <div className="space-y-3 rounded-lg bg-red-50/50 p-3 dark:bg-red-950/20">
              <p className="text-xs font-semibold text-red-700 dark:text-red-300">🔒 비공개 (이 용의자를 연기하는 AI 만 봄)</p>
              <TextArea title="주장하는 알리바이" value={s.alibi} onChange={(v) => set((t) => void (t.alibi = v))} max={2000} rows={2} />
              <TextArea title="실제 행적" hint="범인이면 범행 과정까지. 시간을 구체적으로" value={s.actual} onChange={(v) => set((t) => void (t.actual = v))} max={4000} rows={3} />
              <TextArea title="숨기는 것·거짓말 지침" value={s.secrets} onChange={(v) => set((t) => void (t.secrets = v))} max={4000} rows={3} />
              <TextArea title="알고 있는 것" hint="다른 사람·사건에 대해 아는 것. 어떤 질문에 무엇을 말하는지" value={s.knowledge} onChange={(v) => set((t) => void (t.knowledge = v))} max={4000} rows={3} />
            </div>

            <div>
              <Label title="무너지는 지점" hint="이 증거를 들이밀면 무엇을 인정하는지. 증언 단서를 함께 줄 수 있어요" />
              <div className="space-y-2">
                {s.breakpoints.map((b, bi) => (
                  <div key={bi} className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Select title="제시할 증거" value={b.clue} onChange={(v) => set((t) => void (t.breakpoints[bi].clue = v))} options={d.clues.filter((c) => c.holder !== s.code).map((c) => ({ value: c.code, label: c.name || c.code }))} placeholder="선택" />
                      <Select
                        title="인정하면서 주는 증언 (선택)"
                        value={b.reveals}
                        onChange={(v) => set((t) => void (t.breakpoints[bi].reveals = v || undefined))}
                        options={testimony.map((c) => ({ value: c.code, label: c.name || c.code }))}
                        placeholder="없음"
                      />
                    </div>
                    <TextArea title="인정하는 내용 (연기 지침)" value={b.admission} onChange={(v) => set((t) => void (t.breakpoints[bi].admission = v))} max={2000} rows={2} />
                    <button type="button" onClick={() => set((t) => void t.breakpoints.splice(bi, 1))} className="text-xs text-zinc-500 hover:text-red-600">
                      이 지점 삭제
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => set((t) => void t.breakpoints.push({ clue: "", admission: "" }))} disabled={!d.clues.length} className="text-sm font-medium text-red-600 hover:underline disabled:text-zinc-400">
                  + 무너지는 지점 추가 {d.clues.length ? "" : "(먼저 단서를 만드세요)"}
                </button>
              </div>
            </div>
            <p className="text-xs text-zinc-500">이 사람의 증언 단서: {testimony.map((c) => c.name || c.code).join(", ") || "없음 (단서 탭에서 추가)"}</p>
          </ItemCard>
        );
      })}
      <AddButton onClick={() => update((x) => void x.suspects.push(emptySuspect(nextCode("S", x))))} disabled={d.suspects.length >= 10}>
        용의자 추가 ({d.suspects.length}/10)
      </AddButton>
    </Section>
  );
}

// ───────────────────────── 단서 ─────────────────────────
export function CluesTab({ d, update }: Props) {
  const firstLoc = d.locations[0]?.code;
  return (
    <Section
      title="단서"
      description="장소 단서는 나레이터가 '찾는 법'에 맞는 행동을 하면 주고, 증언 단서는 용의자가 조건에 맞는 질문을 받으면 줘요. 잠금을 걸면 비밀번호를 입력해야만 얻을 수 있어요"
    >
      {d.clues.map((c, i) => {
        const set = (fn: (c: Draft["clues"][number]) => void) => update((x) => fn(x.clues[i]));
        const isTestimony = !!c.holder;
        return (
          <ItemCard key={c.code} title={`${isTestimony ? "🗣" : "🔍"} ${c.name || `단서 ${i + 1}`}${c.isKey ? " ⭐" : ""}`} onRemove={() => update((x) => removeClue(x, c.code))}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                title="종류"
                value={isTestimony ? "testimony" : "location"}
                onChange={(v) =>
                  set((t) => {
                    if (v === "testimony") {
                      t.location = undefined;
                      t.holder = d.suspects[0]?.code;
                      t.lock = undefined;
                    } else {
                      t.holder = undefined;
                      t.location = firstLoc;
                    }
                  })
                }
                options={[
                  { value: "location", label: "장소 단서 (조사로 발견)" },
                  { value: "testimony", label: "증언 단서 (심문으로 얻음)" },
                ]}
              />
              {isTestimony ? (
                <Select title="누가 말해 주나" value={c.holder} onChange={(v) => set((t) => void (t.holder = v))} options={d.suspects.map((s) => ({ value: s.code, label: s.name || s.code }))} />
              ) : (
                <Select title="어디에 있나" value={c.location} onChange={(v) => set((t) => void (t.location = v))} options={d.locations.map((l) => ({ value: l.code, label: l.name || l.code }))} placeholder="선택" />
              )}
            </div>
            <TextInput title="이름" value={c.name} onChange={(v) => set((t) => void (t.name = v))} max={60} placeholder={isTestimony ? "예) 가정부의 증언: 말다툼" : "예) 피해자의 수첩"} />
            <TextArea title="내용 (발견하면 수첩에 적힘)" value={c.description} onChange={(v) => set((t) => void (t.description = v))} max={2000} rows={3} />
            <TextInput
              title={isTestimony ? "말해 주는 조건" : "찾는 법"}
              hint={isTestimony ? "예) 그날 밤 들은 소리를 물으면 / 증거를 제시받아야만 말한다" : "예) 책상이나 서랍을 살펴보면"}
              value={c.discoverHint}
              onChange={(v) => set((t) => void (t.discoverHint = v))}
              max={1000}
            />

            <div>
              <Label title="선행 단서" hint="이 단서들을 먼저 찾아야 이 단서가 나와요 (선택)" />
              <div className="flex flex-wrap gap-1.5">
                {d.clues
                  .filter((o) => o.code !== c.code)
                  .map((o) => {
                    const on = c.requires.includes(o.code);
                    return (
                      <button
                        key={o.code}
                        type="button"
                        onClick={() => set((t) => void (t.requires = on ? t.requires.filter((r) => r !== o.code) : [...t.requires, o.code]))}
                        className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"}`}
                      >
                        {o.name || o.code}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <Toggle title="⭐ 결정적 증거" hint="추리 제출 때 이 단서를 고르면 점수를 받아요" checked={c.isKey} onChange={(v) => set((t) => void (t.isKey = v))} />
              {!isTestimony && (
                <>
                  <Toggle title="🔒 잠금" hint="금고·자물쇠 등. 비밀번호를 입력해야만 얻을 수 있어요" checked={!!c.lock} onChange={(v) => set((t) => void (t.lock = v ? { label: "잠긴 상자", passcode: "" } : undefined))} />
                  {c.lock && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextInput title="잠금 장치 이름 (화면에 보임)" value={c.lock.label} onChange={(v) => set((t) => void (t.lock!.label = v))} max={60} placeholder="예) 책상 뒤 금고 (숫자 4자리)" />
                      <TextInput title="비밀번호" hint="다른 단서나 증언으로 알아낼 수 있게 해 주세요" value={c.lock.passcode} onChange={(v) => set((t) => void (t.lock!.passcode = v))} max={30} />
                    </div>
                  )}
                </>
              )}
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-zinc-500">이미지·문서 추가 (선택)</summary>
              <div className="mt-3 space-y-3">
                <TextInput title="이미지 주소" value={c.image ?? ""} onChange={(v) => set((t) => void (t.image = v))} placeholder="https://..." />
                <TextArea title="문서 (편지·신문 등 HTML)" value={c.docHtml} onChange={(v) => set((t) => void (t.docHtml = v))} rows={6} mono />
              </div>
            </details>
          </ItemCard>
        );
      })}
      <div className="grid gap-2 sm:grid-cols-2">
        <AddButton onClick={() => update((x) => void x.clues.push(emptyClue(nextCode("C", x), { location: firstLoc })))} disabled={d.clues.length >= 60}>
          장소 단서 추가
        </AddButton>
        <AddButton onClick={() => update((x) => void x.clues.push(emptyClue(nextCode("T", x), { holder: x.suspects[0]?.code })))} disabled={d.clues.length >= 60}>
          증언 단서 추가
        </AddButton>
      </div>
    </Section>
  );
}

// ───────────────────────── 진상·채점 ─────────────────────────
export function TruthTab({ d, update }: Props) {
  return (
    <>
      <Section title="범인과 진상" description="플레이어에게는 추리를 제출한 뒤에만 공개돼요">
        <Select title="범인" value={d.culprit} onChange={(v) => update((x) => void (x.culprit = v))} options={d.suspects.map((s) => ({ value: s.code, label: s.name || s.code }))} />
        <TextArea title="실제로 일어난 일 (타임라인)" hint="시간순으로. 결과 화면에 그대로 보여요" value={d.truth} onChange={(v) => update((x) => void (x.truth = v))} max={8000} rows={10} />
      </Section>

      <Section title="객관식 질문" description="범인 외에 맞혀야 할 것 (흉기, 동기, 수법 등). 최대 5개, 합쳐서 30점">
        {d.quiz.map((q, qi) => (
          <ItemCard key={qi} title={`질문 ${qi + 1}`} onRemove={() => update((x) => void x.quiz.splice(qi, 1))}>
            <TextInput title="질문" value={q.question} onChange={(v) => update((x) => void (x.quiz[qi].question = v))} max={200} placeholder="예) 흉기는 무엇인가?" />
            <div>
              <Label title="보기" hint="정답에 체크하세요" />
              <div className="space-y-2">
                {q.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input type="radio" checked={q.answer === oi} onChange={() => update((x) => void (x.quiz[qi].answer = oi))} className="accent-red-600" aria-label="정답" />
                    <input value={o} onChange={(e) => update((x) => void (x.quiz[qi].options[oi] = e.target.value))} className={inputClass} maxLength={200} />
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          update((x) => {
                            x.quiz[qi].options.splice(oi, 1);
                            if (x.quiz[qi].answer >= x.quiz[qi].options.length) x.quiz[qi].answer = 0;
                          })
                        }
                        className="px-2 text-zinc-400 hover:text-red-600"
                        aria-label="보기 삭제"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {q.options.length < 6 && (
                  <button type="button" onClick={() => update((x) => void x.quiz[qi].options.push(""))} className="text-sm font-medium text-red-600 hover:underline">
                    + 보기 추가
                  </button>
                )}
              </div>
            </div>
          </ItemCard>
        ))}
        <AddButton onClick={() => update((x) => void x.quiz.push({ question: "", options: ["", ""], answer: 0 }))} disabled={d.quiz.length >= 5}>
          질문 추가 ({d.quiz.length}/5)
        </AddButton>
      </Section>

      <Section title="결정적 증거" description="단서 탭에서 ⭐ 를 켠 단서들이에요. 플레이어는 최대 3개를 골라 20점을 받아요">
        <p className="text-sm">{d.clues.filter((c) => c.isKey).map((c) => c.name || c.code).join(", ") || "아직 없어요. 단서 탭에서 ⭐ 결정적 증거를 켜 주세요"}</p>
      </Section>
    </>
  );
}

// ───────────────────────── 엔딩·힌트 ─────────────────────────
export function EndingsTab({ d, update }: Props) {
  return (
    <>
      <Section title="엔딩" description="범인을 맞히고 80점 이상이면 정답, 범인만 맞히면 부분 정답, 틀리면 오답, 수사를 포기하면 포기 엔딩이에요">
        <TextArea title="정답 엔딩" value={d.endingCorrect} onChange={(v) => update((x) => void (x.endingCorrect = v))} max={4000} rows={4} />
        <TextArea title="부분 정답 엔딩" value={d.endingPartial} onChange={(v) => update((x) => void (x.endingPartial = v))} max={4000} rows={3} />
        <TextArea title="오답 엔딩" value={d.endingWrong} onChange={(v) => update((x) => void (x.endingWrong = v))} max={4000} rows={3} />
        <TextArea
          title="포기 엔딩"
          hint="플레이어가 수사를 포기했을 때. 범인을 잡지 못해 어떻게 되었는지 써 주세요 (비우면 기본 문구)"
          value={d.endingGiveUp}
          onChange={(v) => update((x) => void (x.endingGiveUp = v))}
          max={4000}
          rows={3}
        />
      </Section>
      <Section title="힌트" description="플레이어가 순서대로 하나씩 열어 볼 수 있어요. 하나당 10점 감점. 최대 10개">
        {d.hints.map((h, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-2 text-sm text-zinc-400">{i + 1}.</span>
            <textarea value={h} onChange={(e) => update((x) => void (x.hints[i] = e.target.value))} rows={2} maxLength={500} className={`${inputClass} flex-1`} />
            <button type="button" onClick={() => update((x) => void x.hints.splice(i, 1))} className="mt-2 px-2 text-zinc-400 hover:text-red-600" aria-label="힌트 삭제">
              ✕
            </button>
          </div>
        ))}
        <AddButton onClick={() => update((x) => void x.hints.push(""))} disabled={d.hints.length >= 10}>
          힌트 추가 ({d.hints.length}/10)
        </AddButton>
      </Section>
    </>
  );
}

export { Toggle };
