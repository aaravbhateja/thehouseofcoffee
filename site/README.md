# The House of Coffee — website

Static site, no build step. Open `index.html` in Chrome/Edge/Safari, or upload the whole `site` folder to Netlify / Vercel / cPanel.

## Sections
1. **Hero** — the café's own "grinder → espresso → pour-over → milk → pour" reel, scrubbed frame-by-frame with scroll on a 3D card, with 5 chapter captions.
2. **Zigzag band** — pattern taken from the ochre brew-bar counter.
3. **Statement** — words light up as you read; 3 photo cards flip up in 3D.
4. **Menu** — Brews / Plates / Sweet fixes tabs. Desktop: a photo follows the cursor. Mobile: inline thumbnails.
5. **Kitchen** — second scroll-scrubbed reel (Eggs Benedict) inside a phone that turns in 3D.
6. **On ice** — three looping drink reels (play only when on screen).
7. **Inside** — CSS 3D walk-through of café photos that ends at the front door.
8. **Ratings & reviews**, **Visit** (both outlets, directions, call, reserve/order links), **Footer**.

## Files
- `index.html`, `css/style.css`, `js/main.js`
- `vendor/` — GSAP + ScrollTrigger + Lenis (local copies, no CDN needed)
- `fonts/` — Gloock, Instrument Sans, IBM Plex Mono (local)
- `assets/img` — photos from Instagram + Google Business, as WebP (`-sm` = mobile size)
- `assets/video` — reels re-encoded for smooth scrubbing (dense keyframes, no audio)

## Check before going live
- **Hours**: Instagram bio says 8:30 AM – 12 AM. Older posts say 8 AM – 11 PM, and Google shows 11 PM closing. Confirm with the owner.
- **Prices**: only the prices Google lists are shown. Items without a price show none.
- **Links**: the District / EazyDiner / Zomato / Swiggy links are best guesses at the listing URLs. Replace them with the exact URLs from the owner.
- **Reviews**: the quotes are short Google review snippets. Get the owner's OK before publishing.

## Editing
- Menu items: `<ul class="menu__list">` in `index.html`. Add `data-img="assets/img/…"` to show a photo.
- Hero captions: `.hero__chapters li` — `data-from` / `data-to` are scroll progress values (0–1).
- Corridor photos: `.plane` elements. `data-x`/`data-y` = offset in vw/vh, `data-z` = depth, `data-r` = turn, `data-w` = width in vw.
