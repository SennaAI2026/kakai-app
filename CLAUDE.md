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
- **i18n:** Custom zero-dep solution. Файлы: `packages/i18n/` (kz.json, ru.json). en.json — TODO
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
- `join.tsx` нужно переделать: убрать email+password, оставить только invite code

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
