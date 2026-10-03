<div align="center">

<img src="logo.png" alt="Soundboard logo" width="140" />

# Soundboard

**A soundboard for the LilyGO T‑Embed CC1101 running [Bruce](https://github.com/BruceDevices/firmware) firmware.**

43 built‑in sounds · favorites · loop · color themes · auto‑detection of your own WAV files

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
![Device](https://img.shields.io/badge/device-T--Embed%20CC1101-7c3ad2)
![Runtime](https://img.shields.io/badge/runtime-Bruce%20JS-2a5ae6)

</div>

---

## Features

- **43 built‑in sounds** – beeps, alarms, animals, engines, screams, memes and more.
- **Favorites** – mark sounds as favorites; they appear in a highlighted section at the top. Favorites are saved and survive a restart.
- **Loop** – play a sound on repeat (see the note under *Limitations*).
- **Color themes** – `System` (uses your Bruce config colors), plus Red, Orange, Green, Blue, Yellow, Cyan, Magenta and White. Your choice is saved.
- **Add your own sounds** – just drop `.wav` files into the app folder; they are detected automatically.
- **Built‑in help** – an *About & Help* screen explains the controls right on the device.

## Controls

The T‑Embed has a rotary encoder and a top button:

| Input | Action |
| --- | --- |
| Rotate encoder | Scroll the list |
| Press encoder (SEL) | Play the selected sound |
| Top button (ESC) | Open options (Loop / Favorite) for the selected sound; go back elsewhere |
| Menu → **Exit** | Quit the app |

In the options popup: rotate to choose, press to confirm, top button to close.

## Installation

### From the Bruce App Store (recommended)
Search for **Soundboard** in the Bruce App Store and install it. All files are placed in `/BruceJS/Audio/` automatically.

### Manual install
1. Copy **`Soundboard.js`** to a scripts folder on your SD card (e.g. `SD:/scripts/` or `SD:/BruceJS/`).
2. Copy all the **`.wav`** files into the **same folder** as `Soundboard.js` (or into `SD:/sounds/` — the app falls back to that path).
3. On the device, open **Interpreter**, browse to `Soundboard.js` and run it.

## Adding your own sounds

Copy any `.wav` file into the app's folder (the folder that contains `Soundboard.js`, or `/sounds`). Then open **Settings → Rescan** in the app, or simply restart it. New sounds are picked up automatically and show up in the list.

**Format:** 16‑bit PCM WAV, mono, 22050 Hz works well. Keep clips short; very short or very low‑frequency sounds may be hard to hear on the small speaker.

## Limitations

These come from the Bruce JS interpreter / T‑Embed hardware, not the app:

- A playing sound **cannot be paused mid‑play** – there is no stop function in the interpreter.
- A **looping** sound can only be stopped by **rebooting the device**. The app shows a warning before you enable loop.
- There is **no volume control** from a script; set the volume in Bruce's own settings.

## Included sounds

Air Horn · Alarm · Alarm Beeps · Annoying Laughing · Beep · Blip · Burp · Buzzer · Cat Meow · Chime · Coin · Cricket · Ding · Double Beep · Engine Idling · Engine Start Fail · Error · Fart 1 · Fart 2 · Fart 3 · Growling Bear · High Pitched Laughing · Jump · Knocking · Laser · Machine Gun · Movie Theme · Notify · Phone Ring · Power Down · Power Up · Predators Talking · Ringtone 1 · Ringtone 2 · Scream 1 · Scream 2 · Shotgun · Siren · Sounds From Space · Success · Ufo · Wolf · Zap

## License

This project is licensed under **[Creative Commons Attribution‑NonCommercial 4.0 International (CC BY‑NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/)**.

All sounds and the app itself belong to **Benjamin Clark**. You may use, share, adapt and play them freely, **but not for commercial purposes**, and with appropriate credit. See [`LICENSE`](bruce-soundboard_repo/LICENSE) for details.

## Credits

- App & sounds by **Benjamin Clark** ([@MagicKanickel](https://github.com/MagicKanickel))
- Built for **[Bruce firmware](https://github.com/BruceDevices/firmware)** on the LilyGO T‑Embed CC1101
