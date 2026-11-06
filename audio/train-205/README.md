# Densha Driver 205 — audio files

Everything the game says or plays can be replaced with real recordings. Drop an mp3 at the exact path below and the game uses it; anything missing falls back to the iPad's voice (announcements) or the built-in synthesised sound (effects). No rebuild needed when the game is served over http (GitHub Pages).

## Voices (cloned announcements)

All lines, with their exact text and target file, are in `train_205_scripts.json` → `renders` (each has `text`, `lang`, `role`, `when`, `file`).

- 122 recordings in total: Japanese in `audio/train-205/ja/`, English in `audio/train-205/en/`.
- `common/` holds lines shared by every station; station folders (`ueno/`, `omiya/`, …) hold lines that say a station name.
- The game plays the Japanese file, then the English one.

| Voice (role) | Recordings | Style |
|---|---|---|
| `conductor` | 20 | Train conductor (車掌). Calm, nasal, sing-song JR PA voice. |
| `auto` | 54 | Automatic train announcement. Clear, bright female voice (JR East style). |
| `platform` | 4 | Station platform announcer. Echoey, polite female voice. |
| `driver` | 24 | The player's train driver callouts (指差喚呼). Short, crisp, enthusiastic. |
| `announcer` | 20 | Race announcer. Excited, cheerful, kid-friendly (like a sports-day MC). |

To change wording: edit `lines` in `train_205_scripts.json`, then run `node tools/build_train_205.mjs` (regenerates `renders` and the game file).

## Sound effects (optional real recordings)

| Name | File | What it is |
|---|---|---|
| `horn` | `audio/train-205/sfx/horn.mp3` | 205 horn (loops while the Horn button is held) |
| `doorOpen` | `audio/train-205/sfx/doorOpen.mp3` | doors opening (air + chime) |
| `doorChime` | `audio/train-205/sfx/doorChime.mp3` | door-closing chime |
| `doorThump` | `audio/train-205/sfx/doorThump.mp3` | doors shut |
| `air` | `audio/train-205/sfx/air.mp3` | brake air release when stopping |
| `squeal` | `audio/train-205/sfx/squeal.mp3` | brake squeal |
| `arrive` | `audio/train-205/sfx/arrive.mp3` | arrival jingle |
| `switch` | `audio/train-205/sfx/switch.mp3` | point machine clunk |
| `tram` | `audio/train-205/sfx/tram.mp3` | HU300 bell |
| `crossing_bell` | `audio/train-205/sfx/crossing_bell.mp3` | one "kan" of the level-crossing bell (repeats) |
| `click` | `audio/train-205/sfx/click.mp3` | button click |
| `wiper` | `audio/train-205/sfx/wiper.mp3` | wiper swish |
| `melody_tokyo` | `audio/train-205/sfx/melody_tokyo.mp3` | departure melody for Tokyo (plays before the doors close) |
| `melody_ueno` | `audio/train-205/sfx/melody_ueno.mp3` | departure melody for Ueno (plays before the doors close) |
| `melody_akabane` | `audio/train-205/sfx/melody_akabane.mp3` | departure melody for Akabane (plays before the doors close) |
| `melody_urawa` | `audio/train-205/sfx/melody_urawa.mp3` | departure melody for Urawa (plays before the doors close) |
| `melody_omiya` | `audio/train-205/sfx/melody_omiya.mp3` | departure melody for Omiya (plays before the doors close) |
| `melody_kuki` | `audio/train-205/sfx/melody_kuki.mp3` | departure melody for Kuki (plays before the doors close) |
| `melody_koga` | `audio/train-205/sfx/melody_koga.mp3` | departure melody for Koga (plays before the doors close) |
| `melody_oyama` | `audio/train-205/sfx/melody_oyama.mp3` | departure melody for Oyama (plays before the doors close) |
| `melody_ishibashi` | `audio/train-205/sfx/melody_ishibashi.mp3` | departure melody for Ishibashi (plays before the doors close) |
| `melody_utsunomiya` | `audio/train-205/sfx/melody_utsunomiya.mp3` | departure melody for Utsunomiya (plays before the doors close) |
