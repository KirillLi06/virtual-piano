# Виртуальное пианино (Virtual Piano)

Десктопное приложение виртуального пианино с полифоническим синтезом звука, записью и воспроизведением треков, разработанное на **Electron**, **TypeScript 7** и нативном **Web Audio API**.

## Возможности

- **Полифонический синтез звука (Web Audio API):** одновременное звучание нескольких клавиш (аккорды, интервалы), плавная огибающая ADSR (`tA = 12 мс`, `tR = 25 мс`) без щелчков, регулировка общей громкости.
- **Выбор тембра:** кастомный тембр `PeriodicWave` (3 гармоники `0.75 / 0.18 / 0.07`), а также `sine`, `square`, `sawtooth`, `triangle`.
- **Управление мышью и клавиатурой:** 7 клавиш первой октавы (`До`–`Си`, `C4`–`B4`) с подсветкой активных клавиш и защитой от автоповтора (`event.repeat`).
- **Полифоническая запись и воспроизведение треков:** фиксация времени старта (`startTimeMs`) и длительности (`durationMs`) каждой ноты через `performance.now()`, сохранение аккордов и наложений, экспорт/импорт в `.json` и `.txt` с валидацией через Type Guards и мгновенной остановкой через `AbortController`.
- **Журнал событий (`AirLogger`):** отображение логов в интерфейсе в реальном времени и дублирование в файл `app_log.txt`.

## Раскладка клавиш

| Нота | Код | Частота (Гц) | Клавиши на клавиатуре |
| :--- | :--- | ---: | :--- |
| До | `C4` | 261.63 | `A` / `1` |
| Ре | `D4` | 293.66 | `S` / `2` |
| Ми | `E4` | 329.63 | `D` / `3` |
| Фа | `F4` | 349.23 | `F` / `4` |
| Соль | `G4` | 392.00 | `G` / `5` |
| Ля | `A4` | 440.00 | `H` / `6` |
| Си | `B4` | 493.88 | `J` / `7` |

## Формат файлов треков

### JSON (`.json`)

Каждое событие ноты хранит `startTimeMs` (смещение от начала трека в миллисекундах) и `durationMs`, что позволяет точно воспроизводить аккорды и перекрывающиеся нажатия:

```json
{
  "name": "track_2026-11-22_20-40",
  "date": "2026-11-22T17:40:00.000Z",
  "events": [
    { "eventType": "note", "note": "C4", "freq": 261.63, "durationMs": 500, "startTimeMs": 0 },
    { "eventType": "note", "note": "E4", "freq": 329.63, "durationMs": 500, "startTimeMs": 0 },
    { "eventType": "note", "note": "G4", "freq": 392, "durationMs": 500, "startTimeMs": 0 }
  ]
}
```

### Текстовый формат (`.txt`)

```text
# Name: Аккорд До мажор
# Date: 2026-11-22T17:40:00.000Z
NOTE C4 261.63 500 0
NOTE E4 329.63 500 0
NOTE G4 392.00 500 0
```

> **Обратная совместимость:** файлы `.json` и `.txt` без поля `startTimeMs` (включая события `pause` / `PAUSE`) продолжают корректно открываться и воспроизводиться последовательно.

## Структура проекта

```text
src/
├── main/              # Electron Main Process (окно, IPC-обработчики ФС и логов)
├── preload/           # Preload-скрипт (preload.cts -> .cjs, contextBridge)
├── shared/            # Общие типы (NoteCode, TrackFile, TrackEvent, IPC)
└── renderer/
    ├── app/           # PianoController — фасад бизнес-логики
    ├── audio/         # SoundSynthesizer — полифонический Web Audio API синтез
    ├── recorder/      # TrackRecorder, TrackSerializer
    ├── player/        # TrackPlayer, TrackParser
    ├── logger/        # AirLogger
    └── ui/            # Toolbar, PianoKeyboard, PianoKey, KeyboardController, LogPanel, StatusBar
styles/
└── main.css           # Стили интерфейса
index.html             # Точка входа окна приложения
```

## Установка и запуск

Требуется Node.js 20+.

```bash
# Установка зависимостей
npm install

# Сборка TypeScript и запуск приложения
npm start
```

### Дополнительные скрипты

```bash
npm run build      # Компиляция TypeScript в dist/
npm run eslint     # Проверка кода и стилей (ESLint)
npm run prettier   # Форматирование исходников (Prettier)
```
