Greenbro branding source of truth
=================================

Use this as the single reference for logo artwork and colours.

Primary logo (master)
---------------------
- Wordmark: `GREENBR` with the green gear as the “O” + tagline `ENDORSED BY NATURE®`.
- Master SVG: `docs/branding/official/greenbro-logo-horizontal-gearO.svg`.
- Master PNG: `docs/branding/official/greenbro-logo-horizontal-gearO.png`.

App / product assets (exported from the master)
-----------------------------------------------
- `mobile/assets/greenbro/greenbro-logo-horizontal.png` — transparent, gear-as-O with tagline (login/header).
- `mobile/assets/greenbro/greenbro-splash.png` — white background, centered gear-as-O logo.
- `mobile/assets/greenbro/greenbro-icon-1024.png` — gear mark only for app/adaptive icon.

Palette (from `mobile/app/theme/colors.ts`)
-------------------------------------------
- brandGreen `#39B54A`; darker green `#2D9C3E` (gradient end)
- brandGrey `#414042`; textPrimary `#111111`; textSecondary/textMuted `#555555`
- background `#FFFFFF`; backgroundAlt `#F5F7F9`; brandSoft `#E9F7EC`; borderSubtle `#E1E5EA`
- error `#DC2626`; warning `#D97706`; success `#16A34A`
- gradients: brandPrimary `#39B54A -> #2D9C3E`; brandSoft `#E9F7EC -> #FFFFFF`

Do not
------
- No “GREEN BRO” split text.
- No plain “O” in “BRO”; the O is always the supplied gear.
- No auto-generated SVG/text substitutions or font swaps.
- No recolouring outside the approved palette.
- No inline pseudo-logos built from text plus a separate gear icon.

Notes
-----
- Keep transparent backgrounds for logos; white backgrounds for icon and splash.
- Legacy/incorrect assets live in `archive/branding-legacy/` only (do not use).
