# THSR Transfer Planner

Compare direct and one-change routes on Taiwan High Speed Rail, for every station pair, every weekday, entirely in the browser.

**Live site:** https://thsr.lolainta.tw/

## Features

- All twelve stations, both directions, seven weekdays.
- Direct trains and single transfers (strictly toward the destination).
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
| `.github/workflows/pages.yml` | GitHub Pages deployment |

## Data

The dataset covers the 214 train numbers and 1,134 weekly services of the THSRC regular timetable effective 2026-02-02. Arrival variants are separated by operating weekday. Temporary extra services and holiday timetables are excluded.

Official query responses were collected for 2026-10-13 through 2026-10-19. Each stop's arrival was queried explicitly rather than estimated from dwell times. Terminal departure values are `null`. Times above 1440 minutes indicate next-day arrivals.

Sources:

- [THSRC timetable download](https://www.thsrc.com.tw/Attachment/Download?id=b5e78f70-fa6d-4f75-8f31-a13387d7ea88&pageID=a3b630bb-1066-4352-a1ef-58c7b4e8ef7c)
- [THSRC timetable page](https://www.thsrc.com.tw/ArticleContent/a3b630bb-1066-4352-a1ef-58c7b4e8ef7c)

Updating the timetable means editing both `data.json` and `dist/data.js`; the workflow does not fetch data automatically.

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

Pushes to `main` trigger `.github/workflows/pages.yml`, which runs the syntax and route checks and publishes `dist/` to GitHub Pages. The custom domain is set by `dist/CNAME`.

## Disclaimer

This is an independent project and is not affiliated with Taiwan High Speed Rail Corporation. Delays, seat availability and special-date timetables must be confirmed on the official site.
