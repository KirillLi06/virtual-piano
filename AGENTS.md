# AGENTS.md

Инструкции для ИИ-агентов и разработчиков, работающих с репозиторием **Virtual Piano** (курсовая работа «Виртуальное пианино с возможностью записи и воспроизведения треков»).

## Стек и сборка

- **Среда выполнения:** Electron + TypeScript 7 (`@typescript/native`), чистый HTML/CSS без сборщиков и фреймворков (без Vite/React).
- **Модульная система:** `"type": "module"` в `package.json`, `module: "nodenext"`, `moduleResolution: "nodenext"`.
  - Все относительные импорты в `.ts`-файлах **обязательно** указываются с расширением `.js` (например, `import { TrackPlayer } from "../player/TrackPlayer.js"`).
  - `src/preload/preload.cts` компилируется в CommonJS (`dist/preload/preload.cjs`) для работы при `sandbox: true` в `BrowserWindow`.
- **Важно по зависимостям TypeScript:** в `package.json` намеренно установлены два алиаса рядом:
  - `@typescript/native` (TS 7) — используется для `tsc` (`npm run build`).
  - `typescript` (`npm:@typescript/typescript6@^6.0.2`) — нужен для совместимости с `typescript-eslint@8.73.0`. Не удаляй ни один из них.

### Основные команды

```bash
npm run build      # Компиляция TypeScript -> dist/
npm start          # Сборка и запуск Electron-приложения
npm run eslint     # Проверка TypeScript и CSS через ESLint
npm run prettier   # Форматирование исходников в src/
```

## Архитектура проекта

- `src/main/` — Electron Main Process:
  - `main.ts` — создание `BrowserWindow` (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`).
  - `ipcHandlers.ts` — обработка IPC-каналов (`save-track`, `load-track`, `append-log`, `clear-log`), диалоги сохранения/загрузки и запись в `app_log.txt`.
- `src/preload/preload.cts` — безопасный мост `contextBridge.exposeInMainWorld("electronAPI", ...)`.
- `src/shared/` — общие типы и константы:
  - `ipc.ts` — имена каналов и интерфейсы `ElectronAPI`.
  - `types/NoteCode.type.ts` — ноты первой октавы (`C4`–`B4`), частоты, биндинги клавиш (`A–J` / `1–7`).
  - `types/TrackEvent.type.ts` — `TrackNoteEvent` (с опциональным `startTimeMs` для полифонии) и `TrackPauseEvent`.
  - `types/TrackFile.type.ts` — структура файла трека `{ name, date, events }`.
- `src/renderer/` — Renderer Process:
  - `app/PianoController.ts` — единый фасад бизнес-логики и реактивный стор состояния для UI.
  - `audio/SoundSynthesizer.ts` — полифонический синтез на Web Audio API (`Map<NoteCode, ActiveVoice>`, `PeriodicWave` 3 гармоники `0.75 / 0.18 / 0.07`, ADSR `tA = 12 мс`, `tR = 25 мс`, Master `GainNode`).
  - `recorder/TrackRecorder.ts` — полифоническая запись через `performance.now()` с фиксацией `startTimeMs` (относительно первой ноты) и `durationMs`, сортировкой по `startTimeMs` при `stop()`.
  - `recorder/TrackSerializer.ts` — сериализация треков в `.json` и `.txt`.
  - `player/TrackPlayer.ts` — полифонический планировщик по таймлайну (`on`/`off`-события, учёт аккордов и перекрытий, подсчёт активных голосов, отмена через `AbortController`).
  - `player/TrackParser.ts` — парсинг и валидация `.json` и `.txt` через Type Guards (`TrackParseError`).
  - `logger/AirLogger.ts` — логирование в UI-панель и через IPC в `app_log.txt`.
  - `ui/` — `Toolbar`, `PianoKeyboard`, `PianoKey`, `KeyboardController`, `LogPanel`, `StatusBar`.

## Правила внесения изменений

1. **Полифония и обратная совместимость треков:**
   - Новые записи всегда сохраняют `startTimeMs` на каждом `TrackNoteEvent`.
   - `TrackParser` и `TrackPlayer` обязаны сохранять обратную совместимость со старыми последовательными файлами `.json` и `.txt` без `startTimeMs` (и с событиями `pause`).
   - При одновременном окончании и повторном старте одной и той же ноты в `TrackPlayer` событие `off` всегда должно выполняться раньше `on`.
2. **Типобезопасность:**
   - Не использовать `any`; входные данные из файлов валидировать через Type Guards в `TrackParser.ts`.
   - Проверять код через `npm run build` и `npm run eslint` перед завершением задачи.
3. **Безопасность Electron:**
   - Не включать `nodeIntegration` и не отключать `contextIsolation` / `sandbox`. Любой доступ к ФС — только через IPC в `src/main/ipcHandlers.ts` и `src/preload/preload.cts`.
4. **Язык интерфейса и логов:**
   - Пользовательские тексты, сообщения об ошибках, логи `AirLogger` и комментарии JSDoc пишутся на русском языке.
