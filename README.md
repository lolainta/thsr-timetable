# THSR Transfer Planner

Compare direct and one-change routes on Taiwan High Speed Rail, for every station pair, every weekday, entirely in the browser.

**Live site:** https://thsr.lolainta.tw/

## Features

- All twelve stations, both directions, any date. Pick a travel date like the official booking site.
- Dates within the next four weeks use THSRC's official per-date timetable, refreshed daily by GitHub Actions, so holiday extra trains are included. Later dates fall back to the weekly regular timetable.
- Direct trains and single transfers, including turn-back routes that overshoot the destination (for example ride to Zuoying, then return north).
- Minimum connection time of five minutes, adjustable; optional cap on waiting time.
- Each transfer is benchmarked against the fastest direct train of the day and the next direct train leaving at or after it.
- Transfers that are at least fifteen minutes slower than the benchmark, or beaten by a later direct train, are collapsed into a separate section.
- Shareable query links, swap-stations button, and preset searches.

No build step, server, or third-party requests. Static HTML, CSS and JavaScript only.

## Layout

| Path | Purpose |
|---|---|
| `dist/` | Deployable site (HTML, CSS, JS, data, font, `CNAME`) |
| `data.json` | Canonical timetable dataset; `dist/data.js` is the same data wrapped for the browser |
| `verify.cjs` | Route and boundary checks run before every deploy |
| `scripts/collect.py` | Fetches the official per-date timetable from TDX (stdlib only) |
| `.github/workflows/pages.yml` | GitHub Pages deployment |

## Data

`trips` covers the 214 train numbers and 1,134 weekly services of the THSRC regular timetable effective 2026-02-02. Arrival variants are separated by operating weekday.

`daily` holds the official per-date timetable, each train's non-reserved car numbers, and the adult one-way fare table, for the fetch window (`from`/`to`, usually today plus 28 days, which is as far as TDX publishes). Trips with identical schedules are merged and carry the list of dates they run. `scripts/collect.py` collects it from TDX's THSR DailyTimetable API, one request per date, with every stop's arrival and departure.

Official query responses were collected for 2026-10-13 through 2026-10-19. Each stop's arrival was queried explicitly rather than estimated from dwell times. Terminal departure values are `null`. Times above 1440 minutes indicate next-day arrivals.

Sources:

- [THSRC timetable download](https://www.thsrc.com.tw/Attachment/Download?id=b5e78f70-fa6d-4f75-8f31-a13387d7ea88&pageID=a3b630bb-1066-4352-a1ef-58c7b4e8ef7c)
- [THSRC timetable page](https://www.thsrc.com.tw/ArticleContent/a3b630bb-1066-4352-a1ef-58c7b4e8ef7c)

The regular weekly timetable in `trips` is edited by hand when THSRC changes it. The `daily` window is refreshed automatically: the Pages workflow runs `scripts/collect.py` every day, commits the new `data.json` and `dist/data.js`, and redeploys. It needs the repository secrets `TDX_CLIENT_ID` and `TDX_CLIENT_SECRET` (free account at https://tdx.transportdata.tw/). Run it locally with the same two variables in the environment: `python3 scripts/collect.py`.

## Route comparison rules

- Identical train pairs reachable via several change stations are deduplicated, preferring Taichung, otherwise the larger connection buffer.
- The duration benchmark is the fastest direct train across the whole selected weekday.
- The "next direct" comparison is the direct train with the earliest arrival among those departing at or after the transfer route's departure.

## Development

```sh
node verify.cjs        # 938 checks across all station pairs and weekdays
npx serve dist         # or any static file server
```

## Deployment

Pushes to `main`, the daily schedule, and manual dispatch all run `.github/workflows/pages.yml`. Scheduled and manual runs first refetch the timetable and commit it; every run then performs the syntax and route checks and publishes `dist/` to GitHub Pages. The custom domain is set by `dist/CNAME`.

## Disclaimer

This is an independent project and is not affiliated with Taiwan High Speed Rail Corporation. Delays, seat availability and special-date timetables must be confirmed on the official site.
