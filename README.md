# michellegoodall.com

Michelle Goodall's portfolio site. It replaces the old Webflow build.

## Folders
- `site/`: the website that gets deployed
- `scrape_site.py`: makes a snapshot of the old Webflow site in `original-site/` for reference. That folder is git-ignored, so it stays on your machine and isn't in the repo.

## Running locally
```
python3 -m http.server 8765 --directory site
```
Then open http://127.0.0.1:8765/. Use a server rather than opening the file directly, so scripts and fonts load the same way they do online.

## Homepage
`site/index.html` is Homepage v2 from the Figma page "Homepage v2 — Scroll" (frames H01–H10): one continuous scroll in ten sections, styled by `css/home.css` and animated by `js/home.js`.

| Section | Figma | Motion |
|---|---|---|
| Hero | H01 | Just "GOODALL," / *Michelle* with the blurb, as on v1. On scroll away, the name slides left and the signature right |
| Manifesto | H02 | Pinned while you scroll; words appear one by one and the script words turn ink → cream |
| I do the lot | H03 | Red; the six disciplines rise in |
| The glance | "Glance — Explorations" G1–G4 (option A, the cloud) | Pinned; see below |
| Beloved Projects | H05 | The cloud's last screen (see below); there's no separate section |
| Bespoke, Downtown Design, 3daysofdesign ’26 | H06–H08 | Photo strip slides in from the left; card and details rise in |
| The index & the lab | H09 | Rise in |
| Contact | H10 | Red; rise in |

How it works:
- One rAF loop in `js/home.js` writes CSS variables on each section: `--q` (0 → 1 as it scrolls away), `--e` (0 → 1 as it scrolls in) and, for sticky `[data-scene]` sections, `--p` (0 → 1 across the scene). The CSS uses them for motion.
- Manifesto words light up when `--p` passes each word's `data-at`.
- `[data-reveal]` elements fade up once when they enter the screen.
- The right-edge rail follows the section in the middle of the screen (`data-rail`). Sections with `data-theme="red"` switch the rail to black.
- Each section has its "Open page" link in the markup. Only `/work/` exists so far, so the others are `hidden`; remove `hidden` when a route is built.
- Layout sizes are the Figma px at 1440 × 900, written as `calc(N * var(--u))`, so each section keeps its proportions at any window size. Phones (≤767px) get a stacked layout; there are no v2 mobile frames yet.

### The glance: the cloud
`js/cloud.js`, with the pieces listed in the `<template class="cloud__pieces">` inside `#glance`. Every card is a point in 3D, projected by hand each frame (no library), so the Figma states (G1–G4) blend into each other across the pinned scroll. Cards are a fixed 150 × 200 box and move with `transform` and `opacity` only (no blur filters, no resizing), which keeps scrolling smooth.

| Scroll | State | What happens |
|---|---|---|
| 0–10% | G1 at rest | All the work floats as one slowly turning cloud; drag to spin it. The six disciplines sit at the edges |
| 10–50% | G2 flying in | The camera moves into the cloud and cards near it fade away. The card under your cursor (the red blob) comes forward and is named in script, bottom-left; on touch it's the card in the middle |
| any time at rest | G3 sorting | Hover (or tap) a discipline: its pieces fan out and everything else falls back into faint dust. Esc, tapping empty space or scrolling on ends it |
| 50–76% | G4 gathering | The cloud gathers into a 10-card deck (the first copy of each piece, in template order, bottom → top) with "Beloved Projects" arriving behind it |
| 76–90% | Beloved Projects | The Pinky Ring photo opens out of the deck's top card (a `clip-path` inset) to fill the screen and the heading fades in. This *is* the Beloved Projects section (H05) |
| 90–100% | Hold | The finished Beloved Projects screen holds, then the page scrolls on to Bespoke |

The rail shows "04 Projects" once the photo has opened (`cloud.js` sets the section's `data-rail`), and `#projects` is an anchor on the cloud's last screen.

To add work, add an `<a>` to the template with `data-name`, `data-meta` and `data-d` (discipline keys: `cd es ev pr ux wd`). Each piece appears three times in the cloud; discipline counts are worked out from the template. The deck positions (`DECK` in `cloud.js`) are set for ten pieces, from the G4 frame.

Local CSS and JS links in `index.html` carry a `?v=` number. Bump it when you change those files, so browsers don't mix a cached old file with new markup.

For debugging, `glanceCloud.sort('es')` in the browser console sorts by a discipline (`null` clears it).

## Work page
`site/work/` is the work index from the Figma page "Work — Concept" (frames W01, W02 and MW01).
- Each row lists the disciplines it's filed under in `data-disciplines` (`cd` Creative Direction, `es` Exhibition & Spatial, `ev` Events, `pr` Print & Collateral, `ux` UI / UX, `wd` Web Development). Tags marked with `data-d` turn red when that filter is on. Update the filter counts in the buttons if you add or move a project.
- `data-preview` on a row is the image that follows the cursor on hover. Rows without one show no preview. On phones the same image shows as a small thumbnail.
- Figma uses stand-in fonts. Per the Foundations page they map to Ivyora Display (titles), Ivyora Text light italic (tags and filter), Altesse (script) and Soleil (meta).
- `css/shared.css` holds the password gate and blob-cursor styles used by every page. A new page needs that stylesheet and `js/gate.js` at the top of `<head>`, and `js/cursor.js` at the end of `<body>`.

## Known issues
- Adobe Fonts only serves this kit to the domains added to its web project, so fonts may fall back when running locally.
- `scrape_site.py` rewrites `url(#…)` fragment references as file paths. That breaks the cursor-blob filter in `original-site/`.

## Hosting
The site is hosted on GitHub Pages at https://michellegoodall.github.io/michellegoodall-com/. `.github/workflows/pages.yml` publishes the `site/` folder on every push to `main`, and deploys take a minute or two. Progress is in the repo's **Actions** tab.

Fonts only load on domains added to the Adobe Fonts web project, so add `michellegoodall.github.io` there (and michellegoodall.com at launch).

## Domain
The domain is registered at Wix (prepaid for 3 more years). DNS records in Wix will point to the host at launch.
