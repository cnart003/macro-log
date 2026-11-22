# Macro Log

A simple, offline nutrition and macro tracker that installs on an iPhone from Safari, with no App Store needed.

**Open it:** https://cnart003.github.io/macro-log/

## Install on iPhone
1. Open the link above in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen** (leave "Open as Web App" on), then **Add**.
3. Open **Macro Log** from the Home Screen. It runs full-screen and works offline.

## Features
- Daily log with day navigation, kcal/protein/carbs/fat totals vs. goals, and progress rings
- Second summary page (swipe) with remaining macros plus fiber, sugar, fats breakdown, salt
- Meals: rename, notes, duplicate / copy to another day, delete, mark complete; "Complete Day"
- Add Food: online search and barcode scanning (Open Food Facts), Recent foods, My Food
- Create custom foods with full nutrition (kcal, macros, fiber, sugar, polyols, poly/mono/saturated fat, salt)
- Goals, JSON backup export / restore, erase data

## Data
Everything is stored on the phone (localStorage). Nothing is sent anywhere except food search / barcode lookups to Open Food Facts. Deleting the Home Screen app deletes its data, so use **Settings → Export backup** occasionally.

## Development
Plain HTML/CSS/JS, no build step. Serve the folder over HTTPS (or `localhost`) and open `index.html`.
When you change files, bump `VERSION` in `sw.js` so installed copies pick up the update.

Food data © Open Food Facts contributors, [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Barcode scanning by [ZXing](https://github.com/zxing-js/browser) (Apache 2.0, see `vendor/ZXING-LICENSE`).
