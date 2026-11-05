# MTR station announcements

Production announcement audio for `mtr.html`.

- 49 stations, with Cantonese followed by English: 98 WAV files total
- Mono, 24 kHz, 16-bit PCM
- OmniVoice Studio 0.3.6, 32 diffusion steps, seed `20260907`
- Broadcast effect preset
- Cantonese reference transcript: `請勿靠近車門`
- English reference transcript: `Please stand back from the train doors`

Pronunciation-only script overrides preserve the official display names:

- Choi Hung displays `Choi Hung` but synthesizes `This station is Choi Hone.`
- Diamond Hill displays `鑽石山` but synthesizes `呢個站係轉石山`.
- LOHAS Park displays `LOHAS Park` but synthesizes `This station is Lo Haas Park.`
- Quarry Bay displays `鰂魚涌` but synthesizes `呢個站係則魚涌`.
- Sai Ying Pun displays `Sai Ying Pun` but synthesizes `This station is Sai Ying Poon.`
- Sheung Wan displays `Sheung Wan` but synthesizes `This station is Shearn Wan.`
- Tiu Keng Leng displays `Tiu Keng Leng` but synthesizes `This station is Tiu King Leng.`
- Tseung Kwan O displays `Tseung Kwan O` but synthesizes `This station is Cheung Kwan O.`
- Tsim Sha Tsui displays `Tsim Sha Tsui` but synthesizes `This station is Chim Sha Chui.`
- Tsuen Wan displays `Tsuen Wan` but synthesizes `This station is Chuen Wan.`
- HKU displays `HKU` but synthesizes `This station is Hong Kong University.`

The original reference recordings are kept in `references/`. The lossless generated
masters are in `stations/`, and their paths and scripts are listed in
`station_audio.json`.

For the game, all 98 masters are converted to 64 kbps mono MP3 files in
`stations-mp3/` and embedded directly into `mtr.html` as Base64 data URLs. The game
therefore remains a single portable HTML file and does not fetch the manifest or
audio folders at runtime. Choosing a station preloads its Cantonese and English
clips; opening the doors plays Cantonese followed by English.

The closing sequence uses the original Cantonese reference recording, a cloned
English announcement, and then `mtr-beep.mp3`:

1. `請勿靠近車門`
2. “Please stand clear from the platform screen doors.”
3. The clean warning beep

The generated English WAV master and its 64 kbps MP3 derivative are in `closing/`.
All three sounds are embedded in the same HTML, and the build script refreshes the
embedded sources on every run.

Regenerate the English WAV master with OmniVoice Studio's installed environment:

```sh
"/Users/william/Library/Application Support/com.debpalash.omnivoice-studio/project/.venv/bin/python" \
  tools/generate_mtr_closing_english.py
```

After replacing or regenerating any WAV master, rebuild the embedded audio from the
project root:

```sh
node tools/embed_mtr_audio.mjs
```

The build requires `ffmpeg` with the `libmp3lame` encoder.
