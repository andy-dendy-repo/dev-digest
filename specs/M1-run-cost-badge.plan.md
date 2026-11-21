# M1 — Run Cost Badge: план реалізації

Спек: [M1-run-cost-badge.md](M1-run-cost-badge.md)

## Context
Roadmap M1 повертає в стартер «Run cost badge». Мета: бачити вартість і токени кожного прогону агента-рев'юера (перша особиста метрика курсу, до неї повернемося на L08).

Що вже є в коді:
- Рушій **уже рахує вартість.** `reviewer-core/src/llm/openrouter.ts` бере реальний `usage.cost` від OpenRouter (`usage: { include: true }`), а якщо його немає, рахує через `PriceBook` (живі ціни `/models`, запасний варіант `server/src/adapters/llm/pricing.ts`). `reviewPullRequest` повертає `outcome.costUsd` (`reviewer-core/src/review/run.ts:110`). Він `null`, якщо хоч один виклик не має ціни.
- Вартість **ніде не зберігається.** Міграція `0009_complex_runaways.sql` видалила `agent_runs.cost_usd`, а `run-executor.ts` відкидає `outcome.costUsd`.

Отже, нових викликів моделі не потрібно. Треба зберегти вартість, передати її далі й показати.

## Рішення (погоджено)
- Колонка COST у списку PR показує **суму cost усіх завершених (`done`) прогонів** цього PR.
- Чотири місця показу: (1) список PR, (2) рядок прогону в timeline «Agent runs», (3) Stats у Run Trace drawer, (4) VerdictBanner у Review Runs.
- Немає даних (running / failed / cancelled / старі прогони / невідома модель) → «—», **ніколи** «$0.00». Старі прогони не заповнюємо заднім числом.

## Крок 0. Спек-файл
Спек: `specs/M1-run-cost-badge.md` (готовий). Після мержу Status → done.

## Server (`server/`, pnpm)
1. **Схема.** У `server/src/db/schema/runs.ts` додати до `agentRuns` поле `costUsd: doublePrecision('cost_usd')` (nullable). Тип `doublePrecision`, бо drizzle повертає `numeric` як рядок. Потім `pnpm db:generate`: з'явиться міграція `0010_*.sql`, яка додає колонку.
2. **Repo.** `server/src/modules/reviews/repository/run.repo.ts`:
   - `completeAgentRun` приймає `costUsd?: number | null` і записує `costUsd: values.costUsd ?? null`.
   - `listRunsForPull` віддає `cost_usd: run.costUsd`.
   - Новий хелпер `costByPull(db, prIds)`: `SELECT pr_id, SUM(cost_usd) … WHERE status='done' AND cost_usd IS NOT NULL GROUP BY pr_id`, повертає `Map<prId, number>`.
   - Перевірити `server/src/modules/reviews/repository.ts` (фасад): прокинути новий параметр і хелпер.
3. **Executor.** `server/src/modules/reviews/run-executor.ts`:
   - Успішний шлях: взяти `costUsd` з `outcome`, передати в `completeAgentRun`, додати `cost_usd` у `trace.stats`.
   - Дописати рядок у лог прогону: `runLog.info('Usage: N→M tokens · $X')`, а також `costUsd` у pino-лог «agent done». Це потрібно, щоб звірити число з логом.
   - `failAll`, catch-гілка й `traceFromBuffer`: `costUsd: null`, `cost_usd: null`.
4. **Список PR.** `server/src/modules/pulls/routes.ts` (`GET /repos/:id/pulls`): поруч із `latestReviewByPr` один запит `costByPull` для `prIds`, у відповідь `cost_usd: costMap.get(r.id) ?? null`.

## Контракти (обидві копії `vendor/shared`!)
Спершу `diff -r server/src/vendor/shared client/src/vendor/shared`, потім ті самі зміни в обох копіях:
- `contracts/trace.ts`: `RunStats.cost_usd: z.number().nullish()` (nullish, бо в старих трейсах поля немає); `RunSummary.cost_usd: z.number().nullable()`.
- `contracts/platform.ts`: `PrMeta.cost_usd: z.number().nullish()`, з коментарем «сума cost done-прогонів, лише для list endpoint».
- Додати кейс у `server/test/contracts.test.ts`.

## Client (`client/`, pnpm)
1. **Форматер** `client/src/lib/format-cost.ts` (+ `format-cost.test.ts`):
   - `formatCost(usd?: number | null)`:
     - `null`/`undefined` → `"—"`
     - `0` → `"$0"` (безкоштовна модель; це реальне значення, а не відсутність даних)
     - `≥ 1` → `$1.23`
     - `≥ 0.01` → 3 знаки після коми (`$0.014`)
     - `< 0.01` → 2 значущі цифри (`$0.0013`)

     Так виходить ≥ 3 знаки, як на дизайні: `$0.012`, а не `$0.01`.
   - `formatTokensCompact(in, out)` → `"8.2K→1.3K"`; `formatTokenTotal(n)` → `"9,119 tok"`.
2. **Компонент** `client/src/components/run-cost-badge/RunCostBadge.tsx` (+ `index.ts`, test). Props: `{ costUsd, tokensIn?, tokensOut?, variant }`, моноширинний шрифт, колір `--text-muted`:
   - `compact` → `$0.014` (список PR, Stat у drawer)
   - `total` → `9,119 tok · $0.0013` (рядок timeline, як на скріні)
   - `split` → `$0.014 · 8.2K→1.3K` (VerdictBanner)

   Якщо `costUsd == null`, показує «—» без токенів.
3. **Список PR**:
   - `client/src/app/repos/[repoId]/pulls/constants.ts`: у `GRID` додати колонку ~`72px` перед `updated`, у `COLUMN_KEYS` додати `"cost"`.
   - `_components/PRRow/PRRow.tsx`: нова комірка `<RunCostBadge variant="compact" costUsd={pr.cost_usd} />`.
   - i18n у `client/messages/en/prReview.json`: `list.columns.cost: "Cost"`.
4. **Timeline**: `[number]/_components/RunHistory/RunHistory.tsx:198`. У праву колонку під `ran_at` додати `<RunCostBadge variant="total" …/>`, лише для `status === "done"`.
5. **Run Trace drawer**: `RunTraceDrawer/_components/TraceBody/TraceBody.tsx:66`. Додати `<Stat label={t("trace.stat.cost")} val={formatCost(stats.cost_usd)} />` між Tokens і Findings. i18n у `client/messages/en/runs.json`: `trace.stat.cost: "COST"`. Перевірити, що `s.statsRow` вміщає 4 картки.
6. **VerdictBanner**:
   - `[number]/page.tsx`: викликати `usePrRuns(prId)` (React Query дедуплікує з RunHistory), зібрати `Map<run_id, RunSummary>`, передати `run={runsById.get(review.run_id)}` у `ReviewRunAccordion`.
   - Accordion передає `cost={{ costUsd, tokensIn, tokensOut }}` у `VerdictBanner`.
   - Banner показує `<RunCostBadge variant="split">` у `titleRow` поруч із badge findings. Якщо `cost` немає, нічого не показує.

## Acceptance criteria
- [ ] Кожен `done`-прогін показує cost у timeline, Trace Stats і VerdictBanner; список PR показує суму.
- [ ] running / failed / cancelled / старі прогони → «—», ніколи «$0.00».
- [ ] Формат ≥ 3 знаки: `$0.012`, `$0.0013`.
- [ ] Цифра для одного прогону збігається з рядком «Usage» у лозі прогону та з OpenRouter dashboard (Activity, сесія `owner/repo#N:Agent`).
- [ ] Нуль додаткових викликів моделі (лише запис уже наявного `outcome.costUsd`).

## Verification
- Тести:
  - `cd server && pnpm test`: contracts, а також unit для `costByPull`/`completeAgentRun`, якщо є `*.it.test.ts` з testcontainers. Перед іменуванням нових тестів прочитати `TESTING.md`.
  - `cd client && pnpm test`: format-cost, RunCostBadge, оновлені `RunHistory.test.tsx`, `RunTraceDrawer.test.tsx`, `VerdictBanner.test.tsx`.
- Вручну:
  1. `./scripts/dev.sh`, застосувати міграцію.
  2. Запустити Run Review агентом на `openrouter/deepseek/deepseek-v4-flash`.
  3. Перевірити всі 4 місця.
  4. Звірити `$` з рядком «Usage» у вкладці log і з OpenRouter Activity.
  5. Зламати ключ, щоб отримати failed-прогін, і переконатися, що там «—».
- e2e: за можливості додати перевірку заголовка колонки «Cost» у `e2e/specs/02-repo-pulls-detail.flow.json`.
- Наприкінці виконати `/engineering-insights wrap-up`. Кандидат в інсайти: «cost_usd навмисно видаляли в 0009, тож `numeric` у drizzle повертає string, тому використовуємо `doublePrecision`».
- Працювати в гілці `feat/m1-run-cost-badge`, не в `main`.
