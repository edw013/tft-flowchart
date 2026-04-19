# TFT Set 17 Flowchart Maker

A lightweight static web app for planning TFT Set 17 openers, pivots, and end-game boards.

## What it does

- Filters suggested paths by your starting units and item components
- Renders stage-by-stage flowcharts for seeded Set 17 compositions
- Lets you duplicate a template or create a blank custom path
- Saves edits to local storage
- Imports and exports path data as JSON
- Prefers locally cached Set 17 unit and item art, with CommunityDragon as a backup

## Run it

Open [index.html](/home/ethan/projects/tft-flowchart/index.html) in a browser.

If you prefer serving it locally, any static file server will work.

## Cache images locally

Run:

```powershell
./scripts/cache-tft-assets.ps1
```

That will download the current Set 17 unit art plus the component item icons into `assets/units` and `assets/items`.
