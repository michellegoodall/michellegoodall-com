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
`site/index.html` is Homepage v2 (Figma: "Homepage v2 — Scroll"), styled by `css/home.css`. It's an ordinary scroll of full-screen sections.

**Motion is deliberately minimal.** Elements fade up 16px once as they appear (`[data-reveal]`, added by `js/home.js`), plus hover states. The one ambient effect is the glance cloud, and it's kept clean: cards are a fixed size and only change `transform` and `opacity`, it turns slowly, and its loop runs only while it's on screen and moving. Nothing pins the page, follows the scroll position or uses blur. Keep it that way.

| Section | Figma | Motion |
|---|---|---|
| Hero | H01 | None. "GOODALL," / *Michelle* with the blurb, as on v1 |
| Manifesto | H02 | Fades in; the three script words then warm from ink to cream, one after another |
| I do the lot | H03 | Red; the disciplines fade up with a slight stagger |
| The glance | H04 / "Glance — Explorations" G1 + G3 | The cloud, kept calm (`js/glance.js`): every piece floats as one slowly turning 3D cloud; drag to spin. Hover a discipline (tap on phones) and its pieces fan out while the rest fade to dust; hover a piece and the cloud pauses, the piece comes to the front and its name appears. A normal full-screen section: no pinning, no blur, no scroll-linked camera |
| Beloved Projects | H05 | Full-bleed Pinky Ring photo; the heading fades up |
| Bespoke, Downtown Design, 3daysofdesign ’26 | H06–H08 | Card and details fade up |
| The index & the lab | H09 | Fade up |
| Contact | H10 | Red; fade up |

- The right-edge rail follows the section in the middle of the screen (`data-rail`). Sections with `data-theme="red"` switch it to black.
- Each section has its "Open page" link in the markup. Only `/work/` exists so far, so the others are `hidden`; remove `hidden` when a route is built.
- Glance pieces are listed in `<template class="glance__pieces">`, each an `<a>` with `data-name`, `data-meta` and `data-d` (discipline keys: `cd es ev pr ux wd`). Each piece appears three times in the cloud; discipline counts are worked out from the list.
- Layout sizes are the Figma px at 1440 × 900, written as `calc(N * var(--u))`, so each section keeps its proportions. Phones (≤767px) get a stacked layout.
- Local CSS and JS links in `index.html` carry a `?v=` number. Bump it when you change those files, so browsers don't mix a cached old file with new markup.

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
