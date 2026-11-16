# Sakura Clock

A live clock that pairs a neon analog-style readout with an animated
cherry-blossom (sakura) background rendered in WebGL, finished with a
bright-pass / directional-blur / bloom post-processing chain.

No build step, no runtime dependencies — plain HTML, CSS and JavaScript.

## Features

- **Real-time clock** — hours, minutes and seconds rings, AM/PM readout and
  ticking dots on each rim, updated once per second and aligned to the
  wall-clock second (no drift).
- **Reveal interaction** — hover, tap/click or keyboard (Tab to the clock, then
  Enter/Space) makes the time visible.
- **WebGL sakura background** — 1600 point-sprite petals with depth-of-field,
  fog and a two-pass bloom.
- **Responsive** — ring size and spacing scale down on narrow or short screens.
- **Performance conscious** — device-pixel-ratio capped at 2, particle buffer
  updated in place, debounced resize, delta clamping after tab switches.
- **Accessible** — `role="timer"`, a live-updated `aria-label`, visible focus
  ring, and `prefers-reduced-motion` support (renders a single static frame
  instead of animating).

## Run it

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

Serving over HTTP is recommended so the Google Font (`Poppins`) loads
consistently.

## Files

| File         | Purpose                                                            |
| ------------ | ------------------------------------------------------------------ |
| `index.html` | Markup, inline GLSL shaders, font/meta links                        |
| `style.css`  | Layout, neon ring theming, responsive rules, motion preferences     |
| `script.js`  | WebGL sakura background (point sprites + bloom post-processing)     |
| `clock.js`   | Clock logic: 12-hour conversion, ring offsets, dots, accessibility  |

## How it works

- `script.js` creates a WebGL context, compiles the shaders embedded in
  `index.html`, and renders the petal field into an offscreen target. A
  bright-pass extracts highlights, two directional blurs build the bloom, and
  a final pass composites scene + bloom with a vignette and gamma correction.
- `clock.js` reads the system time once per second, converts it to 12-hour
  format, then positions the rim dots (`360° / 12` per hour, `360° / 60` per
  minute/second) and fills each ring proportionally using
  `stroke-dashoffset = 440 − 440 × value / max` (440 ≈ 2π × 70 px, the ring
  circumference).

## Customisation

| What                        | Where                                            |
| --------------------------- | ------------------------------------------------ |
| Ring colours                | `--clr` inline style on each `.circle` / `.ap`   |
| Ring size and spacing       | `--ring` / `--gap` in `:root` (`style.css`)      |
| Petal density               | `pointFlower.numFlowers` in `script.js`          |
| Tick rate / alignment       | `scheduleTick()` in `clock.js`                   |
| DPR cap                     | `Math.min(..., 2)` in `resizeCanvas()`           |

## Browser support

Any modern browser with WebGL1 (Chrome, Edge, Firefox, Safari). The layout and
clock degrade gracefully without WebGL — the background is skipped and a
message is shown, while the time keeps updating.

## Credits

The sakura point-sprite effect is a common WebGL cherry-blossom demo pattern.
If you know the original source, add attribution here.
