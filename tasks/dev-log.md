# Weather Station Comparison — Dev Log

## 2026-04-04

### Full Redesign — Metric-first Comparison Layout
- Replaced 3 separate station cards with metric comparison rows (side-by-side values per metric)
- Dark scoreboard UI: navy canvas, gold champion highlights, station-colored identifiers (blue/green/purple)
- Champion detection: highest value wins per metric, handles ties (all tied = no champion)
- **Min Temp**: lowest value wins (important for winter)
- **Max Gust**: switched from `windgustmph` (instantaneous, often 0) to `maxdailygust` (daily peak) for accuracy
- **Donut rule**: lowest daily rainfall station gets a 🍩 emoji and red-tinted cell (loser buys donuts)
- Wind direction compasses with station-colored arrows and cardinal directions
- Win count tally section with gold highlight on overall leader
- Parallel API fetches via `Promise.all()` (~3x faster than sequential)

### Column Headers
- Replaced inline P/K/B letter tags with Philippe/Ken/Brian column headers at top
- Champion gold highlight alone identifies the winner — cleaner layout

### Compact Layout
- Tightened all padding, gaps, font sizes, and margins to fit all metrics without scrolling
- Mobile breakpoint compressed further for phone screens

### PWA / iOS Home Screen
- Deployed to Vercel: https://weather-station-comparison.vercel.app
- Added `manifest.json`, apple-touch-icon, meta tags for standalone web app
- Anemometer icon (gold on dark background)

### Live Refresh
- Countdown timer: shows `Updated [time] · next in Xs` with live countdown
- Pull-to-refresh on mobile touch devices
- Visibility change listener: instant refresh when returning from background

### Dew Point & Donut Rule Update
- Added dew point metric row (💧) between Min Temp and Wind Speed — reads `dewPoint` from API
- Moved donut rule from Daily Rain to Event Rain — lowest event rainfall station gets 🍩

### Layout Polish
- Compass row and win tally row aligned to same container width

## Deployment
- **Vercel**: weather-station-comparison.vercel.app (scope: philippes-projects-06decfdf)
- **GitHub Pages**: pdelobbe.github.io/weather-station-comparison
- **Backup tag**: `backup-original` (pre-redesign state)

## Architecture
- Vanilla HTML/CSS/JS, no build tools or dependencies
- Data: Ambient Weather public API via slug IDs
- 3 stations: Philippe, Ken, Brian
- Auto-refresh every 10 seconds
