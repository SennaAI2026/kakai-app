# Kakai v2 — CLAUDE.md (Updated 13 March 2026, 01:00 AM)

## Current State
- **Branch:** main
- **Last commit:** 27eb284 (fix: paywall routes to dashboard instead of double-registration)
- **Previous commits this session:** 6229d00 (fix P0 join.tsx + lang CHECK), 58f7b88 (disable DEBUG skip)

## What was accomplished (12-13 March night session):
1. Full project audit — code + DB schema analysis
2. **P0 FIX:** join.tsx now updates `families.child_id` + `status = 'active'` on child join (commit 6229d00)
3. **P0 FIX:** Paywall routes to `/(main)/dashboard` instead of `/(auth)/register` — prevents double anonymous registration (commit 27eb284)
4. **Migration 006** created: `lang CHECK` now includes 'en' (applied in Supabase)
5. **DEBUG skip line** commented out in parent/index.tsx (commit 58f7b88)
6. **Supabase Realtime** enabled for `families`, `screen_time`, `tasks` tables
7. **RLS duplicate policies** cleaned (14 policies dropped)
8. **DB cleaned** — all test data removed, fresh start
9. **Full Flow 3 test passed:**
   - Parent onboarding slides 1-13 ✅
   - Invite code generated and displayed ✅
   - Child joined via Expo Go on Android ✅
   - **Realtime worked** — slide 13 auto-advanced to 14 ✅
   - Slide 14 → 15 → quiz navigation works ✅
   - Quiz page renders at /quiz but **UI may be blank/broken in browser** — needs investigation

## Known Issues
| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Quiz screen appears blank in browser (/quiz loads but nothing visible) | HIGH | Investigate next session |
| 2 | avatar_index vs avatar_id column name mismatch | P2 | Verify live DB column |
| 3 | Onboarding uses local translations, not @kakai/i18n | P2 | Migrate later |
| 4 | No giraffe assets in child app | LOW | Add when doing child UI |
| 5 | Supabase anon key hardcoded as fallback | LOW | Fix before production |
| 6 | console.log in supabase.ts | LOW | Remove before production |

## DB State
- All tables clean (0 rows) — except test data from latest flow test
- Realtime publication: families, screen_time, tasks
- Migration 006 (lang CHECK 'en') applied
- RLS duplicates cleaned

## Real DB Schema (differs from docs)
- `users.family_id` exists (FK → families) — not in original docs
- `users.avatar_index` (not `avatar_id`) — mismatch with migration naming
- `users.pin_hash` exists — but `families.parent_pin` also exists
- `users.email/phone` NOT in public.users — lives in auth.users (correct for Anonymous Auth)
- `users.survey_source` NOT created yet
- `lang CHECK` now includes 'kz', 'ru', 'en'

## Next Session Priority
1. **Debug quiz screen** — why blank in browser? Check rendering, scroll, container height
2. **Complete quiz → paywall → dashboard flow** in browser
3. **Verify dashboard shows child data** after full flow
4. Then: UI improvements screen by screen (dashboard first per Senna's plan)

## Development Setup
- Parent: `cd apps/parent && npx expo start` (port 8081) → browser localhost:8081
- Child: `cd apps/child && npx expo start --port 8082` → Android Expo Go
- iPhone: blocked (Expo Go SDK 54 vs project SDK 52)
- Supabase: nhgcollyiqyexunvwywt, migrations 001-006 applied

## Проект
**Kakai.kz** — абсолютный аналог Kids360 для казахстанского рынка. Родительский контроль.
- 2 приложения: Kakai (Ата-ана) + Kakai Bala (Бала)
- Маскот: жираф 🦒 с зелёной банданой «K»
- GitHub: SennaAI2026/kakai-app

## Стек
- **Framework:** React Native 0.76.9 + Expo SDK 52 + Expo Router 4
- **Language:** TypeScript 5.3 (strict)
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Edge Functions + Storage)
- **Auth:** Supabase Anonymous Auth (signInAnonymously). Email/phone — ДОБРОВОЛЬНО в "Мой аккаунт"
- **Native:** Kotlin (Expo Modules API) — модуль `kakai-blocker` в `apps/child/modules/`
- **i18n:** i18n-js ^4.5.2 + expo-localization. Файлы: `packages/i18n/` (kz.json, ru.json, en.json)
- **Build:** EAS Build (development APK)
- **IDE:** Cursor + Claude Code

## Путь к проекту
"C:\Users\FPS SHOP\kakai-app"
⚠️ Пробел в пути! Всегда оборачивать в кавычки в PowerShell.

## Структура monorepo
kakai-app/
├── apps/
│   ├── parent/          ← Kakai — Ата-ана (чистый Expo)
│   └── child/           ← Kakai — Бала (Expo + Kotlin native)
│       └── modules/kakai-blocker/  ← 6 Kotlin файлов
├── packages/
│   ├── api/             ← Supabase client
│   ├── i18n/            ← kz.json + ru.json + en.json
│   └── shared/          ← types.ts, constants.ts
├── supabase/            ← migrations (001-006), functions
└── docs/

## Kotlin Native Module (kakai-blocker)
Путь: `apps/child/modules/kakai-blocker/android/src/main/java/kz/kakai/blocker/`
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
- Email/телефон — ДОБРОВОЛЬНО в табе "Ещё" → "Мой аккаунт"
- `join.tsx` — только invite code, без email+password (готово)

### База данных
- `families.parent_id` — НЕ owner_id
- `email` и `phone` в users — NULLABLE (lives in auth.users)
- Supabase URL: `nhgcollyiqyexunvwywt`
- Часовой пояс: UTC+5 (единый для всего KZ с 01.03.2024)
- Все таблицы с RLS
- `lang CHECK` includes 'kz', 'ru', 'en' (migration 006)

### Блокировка (offline-first)
- Правила блокировки хранятся в SharedPreferences
- AppBlockerService работает БЕЗ интернета
- Синхронизация через Supabase Realtime (не polling)

### i18n
- Все тексты через файлы переводов, никогда не хардкодить
- Переключатель языка на первом экране (KZ/RU/EN)
- expo-localization определяет системный язык при первом запуске

### Edu задания
- **НЕ НИШ prep.** Простые задания: логика, математика, visual memory
- 200-300 заданий в Phase 2
- 5 правильных = 5 мин screen time (макс 20 мин/день)

## Конвенции кода

### TypeScript
- Строгая типизация. `types.ts` в `packages/shared/` — source of truth
- Row/Insert/Update типы для Supabase generics
- Не использовать `any`

### React Native
- Expo Router file-based routing
- Файлы: `.tsx` (не `.js` — legacy файлы удалить)
- State management: пока Context, позже Zustand
- Хранение токенов: `expo-secure-store` (не AsyncStorage)

### Kotlin
- Expo Modules API для моста JS ↔ Kotlin
- Минимум логики в AccessibilityService — только проверка HashMap
- Никаких сетевых запросов внутри Service

### Supabase
- Все credentials через env переменные (`EXPO_PUBLIC_SUPABASE_URL`) — оба apps
- RLS обязателен для каждой таблицы
- Edge Functions для бизнес-логики (approve-task, sync-usage, block-command)

## Source of Truth
4 файла в Claude Project Knowledge:
1. `kakai_v2_architecture.html` — полная архитектура
2. `kakai_db_schema.md` — схема БД + RLS + Edge Functions
3. `kakai_onboarding_flows.md` — все экраны онбординга
4. `kakai_android_permissions.md` — 8 Android permissions

**Всегда проверять эти файлы перед кодированием.**

## Стратегия
- Абсолютный аналог Kids360 для KZ
- Android first (70%+ рынка KZ), iOS в Phase 3
- Freemium: бесплатно (статистика+задания+GPS) / платно (блокировка+расписание)
- Наши преимущества: переключатель языка, фото-доказательство заданий, offline-first, Realtime sync

## Key Rules (always)
- Mascot = Giraffe 🦒 (NOT fox, NOT panda)
- Auth = Anonymous first, email/phone voluntary later in "Мой аккаунт"
- families.parent_id (NOT owner_id)
- Always check Kids360 screenshots before implementing UI
- 4 source-of-truth files in Claude Project
- Design before code — discuss with Senna, get approval, then implement
- Don't ask Senna what you can check via terminal
- Frequent commits = good practice
