# CLAUDE.md — Kakai Project Rules

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
- **i18n:** i18n-js ^4.5.2 + expo-localization. Файлы: `packages/i18n/` (kz.json, ru.json). en.json — TODO
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
│   ├── i18n/            ← kz.json + ru.json
│   └── shared/          ← types.ts, constants.ts
├── supabase/            ← migrations, functions
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
- `email` и `phone` в users — NULLABLE
- Supabase URL: `nhgcollyiqyexunvwywt`
- Часовой пояс: UTC+5 (единый для всего KZ с 01.03.2024)
- Все таблицы с RLS

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
- Все credentials через env переменные (`EXPO_PUBLIC_SUPABASE_URL`)
- ⚠️ Child app: перенести из hardcode в .env
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

## Текущий статус

### Последний коммит
`5cff5e8` — feat: fix link/code flow + add waiting screen in parent onboarding (2026-03-10)

### Что готово
- **Монорепо:** полностью настроена (yarn workspaces, 2 apps + 3 packages)
- **Anonymous Auth:** внедрён для обоих приложений — `signInAnonymously()` без email/password
  - Parent `register.tsx` — только имя + название семьи → anonymous sign-in → create user + family
  - Child `join.tsx` — только invite code → anonymous sign-in → create child user
  - Parent `login.tsx` — оставлен для добровольного email-логина (кто привязал email в настройках)
- **Parent app onboarding:** 15 slides (SLIDE_COUNT=15) — feature slides, survey, rating, push, role select, stepper, send link (Share Sheet), invite code display, waiting screen с giraffe_waiting_setup.png + paywall. Realtime подписка на families в OnboardingIndex (slides 12-13 → auto go(14) при подключении ребёнка)
- **Parent app main:** dashboard, tasks, history, map, schedule, more, модал app-rules
- **Child app setup:** 10 экранов — welcome/avatar/name/age (index.tsx), usage-stats, accessibility, overlay, device-admin, battery, **gps** (expo-location foreground+background), **pin** (4-digit keypad → families.parent_pin), **schedule** (sleep 22:00-07:00 + school 08:00-16:00 Пн-Пт → upsert schedules), test-block
- **Child app main:** home (с Realtime blocking sync), settings, more
- **Blocking end-to-end sync:** home.tsx — Realtime на screen_time.is_blocked → setBlockingEnabled(), Realtime на app_rules → setBlockedApps(), initial sync при mount, isBlocked = DB is_blocked || local fallback
- **Kotlin kakai-blocker:** все 6 файлов (AppBlockerService, KakaiBlockerModule, KakaiDeviceAdmin, OverlayManager, PermissionChecker, UsageTracker). JS API: setBlockingEnabled, setBlockedApps, getBlockedApps, isBlockingEnabled + permissions + usage stats
- **Supabase:** миграция v2 (users, families, tasks, screen_time, app_rules, schedules, usage_logs, gps_locations, subscriptions + RLS), 4 Edge Functions (approve-task, sync-usage, block-command, reset-daily)
- **i18n:** ru.json + kz.json + en.json полные, автодетект locale, ключи setup.gps/pinCode/scheduleChild
- **Env:** .env файлы в обоих apps с Supabase credentials (child app hardcode убран)
- **Legacy cleanup:** .js файлы удалены, заменены на .tsx + Expo Router
- **Build:** EAS настроен, app.json v2.0.0, оба package name (kz.kakai.parent / kz.kakai.child)
- **Deps:** expo-location в child, expo-sharing в parent

### Что требует внимания
- `parent_pin` хранится plain text — TODO: хеширование (SHA256 или bcrypt)
- `.expo/` попала в git — добавить в .gitignore
- Onboarding использует локальные переводы (объект translations в index.tsx), а не @kakai/i18n — рассмотреть миграцию

### Следующие шаги
- Тестирование на реальном устройстве (EAS development build)
- Подключение Edge Functions к UI (approve-task, block-command)
- Экран "Мой аккаунт" — добровольная привязка email/телефона
- Миграция локальных переводов onboarding → @kakai/i18n
- Asset-файлы: проверить что все иконки/картинки оптимизированы и на месте
