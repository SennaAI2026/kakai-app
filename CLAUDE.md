# Kakai v2 — CLAUDE.md (Updated 14 March 2026)

## Current State
- **Branch:** main
- **Last commit:** 27eb284 (fix: paywall routes to dashboard instead of double-registration)
- **11 commits ahead of origin** — NOT PUSHED. Push before starting new work.

## Architecture v2.2 Audit (14 March 2026)
Full audit completed against `kakai_architecture_v2.2_final.md` (103 screens, 25 decisions).

### Summary
| Block | Total | ✅ | 🔄 | ❌ |
|---|---|---|---|---|
| Parent Onboarding (O-01..O-16 + O-02a/b) | 18 | 0 | 12 | 6 |
| Child Entry (CB-01) | 1 | 0 | 1 | 0 |
| Child Setup (CS-01..CS-24) | 24 | 1 | 14 | 9 |
| Post-Setup (PO-01..PO-19) | 19 | 0 | 0 | 19 |
| Parent Main (M-01..M-30 + sub) | 33 | 0 | 6 | 27 |
| Child Main (CH-01..CH-08) | 8 | 0 | 1 | 7 |
| **TOTAL** | **103** | **1** | **34** | **68** |

Infra: 0/10 edge functions, 0 realtime subscriptions in code, 0 deep links.

### Critical DB Gaps (Migration 007 needed)
- ❌ `family_members` table — required for multi-child, multi-adult, all RLS
- ❌ `onboarding_progress`, `user_goals`, `survey_answers`, `fun_facts` tables
- ❌ `screen_time` must split → `screen_time_limits` (per-day) + `screen_time_daily` (tracker)
- ❌ `families` needs: `invite_code_expires_at`, `invite_code_used`
- ❌ `users` needs: `name`, `stars`, `survey_source`
- ❌ `gps_locations` needs: `battery_level`, `sound_mode`
- ⚠️ All RLS must rewrite: `auth_family_id()` → `user_family_ids()` via family_members
- ⚠️ Existing RLS on app_rules, schedules, usage_logs, gps_locations, subscriptions — must DROP old + CREATE new

### Development Waves
```
WAVE 1 (foundation):     DB Migration 007 → i18n refactor → Auth + Role Selection
WAVE 2 (onboarding):     Carousel → Post-carousel → Edge Functions → Pairing + Realtime → Deep Links
WAVE 3 (child flow):     Child Setup refactor → Post-Setup Quiz Selling (PO-01..PO-19)
WAVE 4 (main app):       Parent Dashboard → Child Dashboard + Lock → Tasks
WAVE 5 (extras):         Map/GPS → More Hub → Paywall + Subscription
```

## Known Issues
| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Quiz screen appears blank in browser | HIGH | Investigate |
| 2 | avatar_index vs avatar_id — DB has `avatar_index`, arch says `avatar_id`. **Decision: keep `avatar_index`** | P2 | Resolved: keep as-is |
| 3 | Parent onboarding uses inline translations, not @kakai/i18n | P2 | Wave 1 |
| 4 | No giraffe assets in child app (fox mascot appears) | LOW | Wave 3 |
| 5 | Supabase anon key hardcoded as fallback in child app | LOW | Fix before production |
| 6 | console.log in supabase.ts | LOW | Remove before production |
| 7 | Parent onboarding is monolithic 15-slide index.tsx — Role Selection at slide 10, should be O-02 | P1 | Wave 1 |
| 8 | Activity Recognition permission missing in child setup (8th permission) | P2 | Wave 3 |
| 9 | No CS-24 Success screen in child setup | P2 | Wave 3 |
| 10 | families table old schema (parent_id, child_id) — need family_members | P0 | Migration 007 |
| 11 | `users.family_id` exists in current DB but NOT in arch v2.2 — deprecated after family_members | P1 | Migration 007 |
| 12 | `users.pin_hash` AND `families.parent_pin` both exist — arch v2.2 has only `families.pin` | P2 | Clarify in Migration 007 |

## Next Session Priority
1. **git push** — 11 commits unpushed
2. **Migration 007** — see `block_01_db_migration.md` in Project Knowledge
3. **i18n refactor** — parent onboarding inline → @kakai/i18n
4. **Auth + Role Selection** — refactor slide order per O-01..O-02

## DB State (pre-Migration 007)
- Migrations 001-006 applied
- Realtime publication: families, screen_time, tasks
- All tables clean (0 rows)

### Real DB Schema (current)
```
users: id, family_id(FK→families), role, lang, avatar_index, pin_hash, push_token, age, created_at
  -- email/phone in auth.users only
  -- MISSING: name, survey_source, stars
  -- DEPRECATED after 007: family_id (replaced by family_members)

families: id, parent_id(FK→users), child_id(FK→users), parent_pin, invite_code, status, created_at
  -- MISSING: invite_code_expires_at, invite_code_used, pin
  -- DEPRECATED after 007: parent_id, child_id (replaced by family_members)

screen_time: id, family_id, child_id, daily_limit, used_today, streak_days, is_blocked, updated_at
  -- DEPRECATED after 007: replaced by screen_time_limits + screen_time_daily

app_rules: id, family_id, child_id?, package_name, app_name, category?, per_app_limit_minutes?, created_at
schedules: id, family_id, child_id?, type?, start_time, end_time, days?, enabled?
usage_logs: id, child_id, package_name, app_name, minutes, date
gps_locations: id, child_id, lat, lng, accuracy, recorded_at  -- MISSING: battery_level, sound_mode
tasks: id, family_id, child_id, created_by, title, description, reward_minutes, status, proof_photo_url, requested_by_child, due_date, created_at, completed_at, approved_at
subscriptions: id, family_id, plan, price_tenge, kaspi_order_id?, google_play_token?, started_at, expires_at, auto_renew

RLS helpers: auth_user_role(), auth_family_id() — both use users.family_id (DEPRECATED after 007)
```

## Development Setup
- Parent: `cd apps/parent && npx expo start` (port 8081) → browser localhost:8081
- Child: `cd apps/child && npx expo start --port 8082` → Android Expo Go (192.168.10.3:8082)
- iPhone: blocked (Expo Go SDK 54 vs project SDK 52)
- Supabase project: nhgcollyiqyexunvwywt

## Проект
**Kakai.kz** — абсолютный аналог Kids360 для казахстанского рынка. Родительский контроль.
- 2 приложения: Kakai (Ата-ана) + Kakai Bala (Бала)
- Маскот: жираф 🦒 с зелёной банданой «K», зелёная кепка «K», синее небо + облака
- GitHub: SennaAI2026/kakai-app

## Стек
- **Framework:** React Native 0.76.9 + Expo SDK 52 + Expo Router 4
- **Language:** TypeScript 5.3 (strict)
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Edge Functions + Storage)
- **Auth:** Supabase Anonymous Auth (signInAnonymously). Email/phone — ДОБРОВОЛЬНО в "Мой аккаунт" (linkIdentity)
- **Native:** Kotlin (Expo Modules API) — модуль `kakai-blocker` в `apps/child/modules/`
- **i18n:** i18n-js ^4.5.2 + expo-localization. Файлы: `packages/i18n/` (kz.json, ru.json, en.json)
- **Build:** EAS Build (development APK, free tier ~1hr queue)
- **IDE:** Cursor + Claude Code (Opus, high effort)

## Путь к проекту
`"C:\Users\FPS SHOP\kakai-app"`
⚠️ Пробел в пути! Всегда оборачивать в кавычки.

## Структура monorepo
```
kakai-app/
├── apps/
│   ├── parent/          ← Kakai Ата-ана (green branding, чистый Expo)
│   │   └── app/
│   │       ├── (auth)/login.tsx, register.tsx
│   │       ├── (onboarding)/index.tsx (15 slides monolith), quiz.tsx, paywall.tsx
│   │       ├── (main)/dashboard, tasks, history, map, schedule, more
│   │       └── modals/app-rules.tsx
│   └── child/           ← Kakai Бала (yellow branding, Expo + Kotlin native)
│       ├── app/
│       │   ├── (auth)/join.tsx  ← Anonymous Auth + invite code
│       │   ├── (setup)/index, accessibility, battery, device-admin, gps, overlay, pin, schedule, test-block, usage-stats
│       │   └── (main)/home, more, settings
│       └── modules/kakai-blocker/  ← 6 Kotlin files ✅
├── packages/
│   ├── api/             ← Supabase client (src/supabase.ts)
│   ├── i18n/            ← kz.json + ru.json + en.json
│   └── shared/          ← types.ts, constants.ts
├── supabase/            ← migrations 001-006, functions/
└── CLAUDE.md
```

## Kotlin Native Module (kakai-blocker) — ALL 6 ✅
Path: `apps/child/modules/kakai-blocker/android/src/main/java/kz/kakai/blocker/`
- `AppBlockerService.kt` — AccessibilityService, TYPE_WINDOW_STATE_CHANGED
- `KakaiBlockerModule.kt` — Expo Module bridge
- `KakaiDeviceAdmin.kt` — DeviceAdminReceiver
- `OverlayManager.kt` — lock screen overlay
- `PermissionChecker.kt` — проверка permissions
- `UsageTracker.kt` — UsageStatsManager

## Ключевые правила

### Auth
- **НЕТ** обязательной регистрации при старте
- Anonymous Auth → UUID автоматически
- Email/телефон — ДОБРОВОЛЬНО в табе "Ещё" → "Мой аккаунт" → linkIdentity()
- `join.tsx` — Anonymous Auth + invite code, без email+password
- Parent: `register.tsx` calls signInAnonymously()
- Parent: `login.tsx` calls signInWithPassword() (returning users)

### База данных
- **v2.2 target:** family_members table replaces families.parent_id/child_id
- **Current:** families.parent_id + users.family_id (both deprecated after Migration 007)
- `email` и `phone` — ONLY in auth.users, NOT in public.users
- Supabase project ID: `nhgcollyiqyexunvwywt` (note the "v" — missing "v" caused errors before)
- Часовой пояс: UTC+5 (единый для всего KZ с 01.03.2024, no DST)
- RLS обязателен для каждой таблицы
- `lang CHECK` includes 'kz', 'ru', 'en'

### Блокировка (offline-first)
- Правила блокировки хранятся в SharedPreferences
- AppBlockerService работает БЕЗ интернета
- Синхронизация через Supabase Realtime (не polling)
- Blocking sync proven: parent toggle → Supabase DB → Realtime → SharedPreferences → AppBlockerService

### i18n
- Все тексты через @kakai/i18n, никогда не хардкодить
- ⚠️ Exception: parent onboarding currently has inline translations (needs refactor)
- Переключатель языка на первом экране (KZ/RU/EN)
- expo-localization определяет системный язык при первом запуске
- en.json exists but may be incomplete

### Edu задания (Phase 2)
- **НЕ НИШ prep.** Простые задания: логика, математика, visual memory
- 200-300 заданий, edu_questions + edu_progress tables
- 5 правильных = 5 мин screen time (макс 20 мин/день)

## Конвенции кода

### TypeScript
- Строгая типизация. `types.ts` в `packages/shared/` — source of truth
- Row/Insert/Update типы для Supabase generics
- Не использовать `any`

### React Native
- Expo Router file-based routing
- Файлы: `.tsx` only (delete legacy .js files)
- State management: пока Context, позже Zustand
- Хранение токенов: `expo-secure-store` (не AsyncStorage)
- Image rendering: use `StyleSheet.absoluteFill` (not flex containers with %)
- `Alert.alert()` doesn't work on RN Web — use platform check

### Kotlin
- Expo Modules API для моста JS ↔ Kotlin
- Минимум логики в AccessibilityService — только проверка HashMap
- Никаких сетевых запросов внутри Service

### Supabase
- Credentials через env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- .env files: apps/child/.env, apps/parent/.env
- Edge Functions для бизнес-логики (0/10 created yet)
- Invite code format: 6-digit numeric XXX-XXX, TTL 1 hour

## Source of Truth
**Primary:** `kakai_architecture_v2.2_final.md` in Claude Project Knowledge (103 screens, 25 decisions)

**Development blocks** in Project Knowledge:
- `block_01_db_migration.md` — Migration 007
- (blocks 02-10 to be added)

**Legacy reference** (may conflict with v2.2 — v2.2 wins):
1. `kakai_v2_architecture.html`
2. `kakai_db_schema.md`
3. `kakai_onboarding_flows.md`
4. `kakai_android_permissions.md`

## Стратегия
- Абсолютный аналог Kids360 для KZ рынка
- Android first (70%+ рынка KZ), iOS child app в Phase 3
- Freemium: бесплатно (статистика+задания+GPS) / платно (блокировка+расписание+per-app)
- Отличия от Kids360: казахский язык, Kaspi Pay, 2GIS maps, lower KZ pricing, photo proof, Realtime sync
- expo-notifications incompatible with Expo Go — defer push to EAS dev build

## Key Rules (always follow)
- Mascot = Giraffe 🦒 (NEVER fox, NEVER panda)
- Auth = Anonymous first, email/phone voluntary via linkIdentity()
- Architecture v2.2 = source of truth. Do not deviate.
- families.parent_id (NOT owner_id) — legacy field, will be replaced by family_members
- Always check Kids360 screenshots before implementing UI
- Design before code — discuss with Senna, get approval, then implement
- Don't ask Senna what you can check via terminal — run commands first
- Break large changes into analysis + implementation steps
- Never rewrite files blind — read actual code first
- Prefer fixing assets (regenerate via Grok) over code workarounds
- Never copy Kids360 text verbatim — write better Kakai-specific copy
- Frequent commits, update CLAUDE.md at end of every session
- Before suggesting npm packages — verify Expo Go compatibility

## Workflow Rules
- One block = one fresh Claude Code chat session
- Max 2-3 screens per sub-task command
- Always start with: read CLAUDE.md + read block_XX spec
- Always use Plan Mode first: show plan → wait for approval → then code
- Always create git branch before changes: git checkout -b feat/block-XX-subtask
- After every commit: git diff HEAD~1 to verify no unintended changes
- Never auto-accept. Review every diff.

## Design Rules
- NEVER change existing UI: colors, fonts, backgrounds, images, layout, styles
- Preserve ALL existing visual design exactly as-is
- Only add/change: logic, navigation, DB calls, i18n
- Any visual change requires Senna's explicit approval with screenshot review

## Platform Rules
- React Native, NOT React Web. No DOM APIs, no localStorage
- Expo SDK 52 + Expo Go for dev. Native modules = EAS dev build only
- Before installing any npm package: verify Expo Go compatibility
- StyleSheet.absoluteFill for full-screen backgrounds
- Alert.alert() doesn't work on Web — use Platform.select()
- 6 Kotlin modules: never touch without explicit request

## Supabase Rules
- Never apply migrations automatically. Generate SQL → show → apply manually via Dashboard
- Before any migration: read current policies via pg_policies query
- List of applied migrations: 001-007 (007 = architecture v2.2)

## Danger Zone
- families.parent_id — NOT owner_id (this caused bugs before)
- users.email, phone, name — all NULLABLE
- users.pin_hash does NOT exist (only families.parent_pin)
- screen_time has NO family_id column (use JOIN via families)
- Do not create new tables without Senna's approval
- Do not modify RLS policies without checking existing ones first

## Decisions Log
- 2026-03-15: Block 01 Migration 007 applied. 7 new tables, 46 RLS policies, 3 helpers.
- 2026-03-15: screen_time.family_id does not exist — use JOIN. users.pin_hash does not exist.
- 2026-03-15: users.name column already existed before 007.
- 2026-03-15: balance_minutes = (limit+balance)-used, reset daily.
- 2026-03-15: Design changes require Senna approval. Never change UI without explicit consent.
- 2026-03-15: Block 02 approach A — keep monolith index.tsx, reorder slides only. Split into files in Block 03.

## Block Status
- Block 01 (DB Migration 007): ✅ DONE
- Block 02 (Auth + Role Selection): ⏳ NEXT — approach A (keep monolith, reorder slides)
- Block 03-10: ❌ Not started

## Applied Migrations
001, 002, 003, 004, 005, 006, 007 (architecture v2.2)