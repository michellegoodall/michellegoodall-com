# michellegoodall.com

Michelle Goodall's portfolio site. It replaces the old Webflow build.

## Folders
- `site/`: the website that gets deployed (for now, a working copy of the old page that will become the rebuild)
- `scrape_site.py`: makes a snapshot of the old Webflow site in `original-site/` for reference. That folder is git-ignored, so it stays on your machine and isn't in the repo.

## Running locally
```
python3 -m http.server 8765 --directory site
```
Then open http://127.0.0.1:8765/. Use a server rather than opening the file directly, so scripts and fonts load the same way they do online.

## Homepage scroll animation
`site/js/scroll-timeline.js` replaces Webflow's interaction engine (IX2). It reproduces the "Homepage Animation" interaction using the keyframes, easings and smoothing from the published Webflow bundle. jQuery and the Webflow scripts are no longer loaded.

How it works:
- `.section` is `1500vh` tall and everything inside it is `position: fixed`. Scrolling doesn't move content; it moves a 0–100% progress value (it tops out around 93%).
- Progress = how far the section has scrolled past the top of the viewport ÷ the section's height.
- The value is smoothed. Each frame closes 12% of the gap (Webflow's "smoothing: 88"), which gives the floaty lag.
- The `TRACKS` table at the top of the file maps progress to CSS. Each track has an element, a property (`x`, `y`, `scale`, `opacity`, `color`) and keyframes written as `[progress %, value, easing to next key]`. Edit the table to change the choreography.

Timeline:
| Progress | What happens |
|---|---|
| 0–39% | "GOODALL," slides off left, "Michelle" off right; [SCROLL] and the blurb fade out |
| 18–48% | "Good design starts…" rises through the screen; its words fade in one by one (24–31%) and the script words turn dark → cream |
| 34–56% | Red panel drops in, holds, then wipes up and away |
| 42–55% | Background photo and "Beloved Projects" rise in; the photo shrinks from 2× to 1.25× |
| 59–90% | Stellar Works card slides in from the right, holds while "Web Design / Web Development / UI/UX" scrolls past, then everything pans out to the left |

For debugging, `scrollTimeline.render(0.5)` in the browser console draws any point of the timeline.

## Work page
`site/work/` is the work index from the Figma page "Work — Concept" (frames W01, W02 and MW01).
- Each row lists the disciplines it's filed under in `data-disciplines` (`cd` Creative Direction, `es` Exhibition & Spatial, `ev` Events, `pr` Print & Collateral, `ux` UI / UX, `wd` Web Development). Tags marked with `data-d` turn red when that filter is on. Update the filter counts in the buttons if you add or move a project.
- `data-preview` on a row is the image that follows the cursor on hover. Rows without one show no preview. On phones the same image shows as a small thumbnail.
- Figma uses stand-in fonts. Per the Foundations page they map to Ivyora Display (titles), Ivyora Text light italic (tags and filter), Altesse (script) and Soleil (meta).
- `css/shared.css` holds the password gate and blob-cursor styles used by every page. A new page needs that stylesheet and `js/gate.js` at the top of `<head>`, and `js/cursor.js` at the end of `<body>`.

## Known issues
- The mobile menu button does nothing, because it relied on Webflow's script. The menu has a single placeholder "work" link.
- Adobe Fonts only serves this kit to the domains added to its web project, so fonts may fall back when running locally.
- `scrape_site.py` rewrites `url(#…)` fragment references as file paths. That breaks the cursor-blob filter in `original-site/`. It's already fixed by hand in `site/index.html`.

## Hosting
The site is hosted on GitHub Pages at https://michellegoodall.github.io/michellegoodall-com/. `.github/workflows/pages.yml` publishes the `site/` folder on every push to `main`, and deploys take a minute or two. Progress is in the repo's **Actions** tab.

Fonts only load on domains added to the Adobe Fonts web project, so add `michellegoodall.github.io` there (and michellegoodall.com at launch).

## Domain
The domain is registered at Wix (prepaid for 3 more years). DNS records in Wix will point to the host at launch.
