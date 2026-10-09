# THSR Transfer Planner

Compare direct trains with one-change routes on Taiwan High Speed Rail, for any station pair and any date, entirely in the browser.

**Live site:** https://thsr.lolainta.tw/

## Features

- Pick a travel date like the official booking site. The next four weeks use THSRC's official per-date timetable from TDX, refreshed every morning, so holiday extra trains are included. Later dates fall back to the weekly regular timetable and the page says so.
- Direct trains and one-change routes with the change at any station, in either direction, including turn-backs that overshoot the destination and come back. Turn-back cards carry a ticket warning.
- Two time modes: 出發時間 (leave at or after) and 抵達時間 (arrive by, ranked by latest departure). 現在出發 sets today and the current minute.
- The list is a Pareto frontier over all options. A transfer is hidden by default when any direct train or other transfer leaves at the same time or later and arrives at the same time or earlier. A checkbox shows the hidden ones in place, each stating the exact difference, e.g. "直達 673 晚 10 分出發、同時抵達". Direct trains are always shown; the wording never says one choice is better.
- Each transfer shows how much earlier it arrives than the next direct train leaving at or after it.
- Each leg shows its non-reserved car numbers from TDX, or 未公布 when TDX has none, and the route subtitle shows the adult one-way fare.
- Shareable links (`after=` or `by=`), swap button, recent routes remembered in the browser, and a footer version stamp that links to the deployed commit.

No build step, server, or third-party requests at runtime. Static HTML, CSS and JavaScript only.

## Layout

| Path | Purpose |
|---|---|
| `dist/` | Deployable site (HTML, CSS, JS, data, font, `CNAME`) |
| `data.json` | Canonical dataset; `dist/data.js` is the same data wrapped for the browser |
| `scripts/collect.py` | Fetches the per-date timetable, non-reserved cars and fares from TDX (stdlib only) |
| `verify.cjs` | Route, boundary and frontier checks run before every deploy |
| `dev/devices.html` | Side-by-side preview at six phone and tablet widths |
| `.github/workflows/pages.yml` | Daily data refresh and GitHub Pages deployment |
| `.github/ISSUE_TEMPLATE/` | Feature-wish and bug-report forms |
| `LICENSE` | MIT, code only |

## Data

`daily` holds the official per-date timetable for the fetch window (`from`/`to`, today plus 28 days, which is as far as TDX publishes). Trips with identical schedules and car configurations are merged and carry the list of dates they run. Each trip has `cars` (non-reserved car numbers, empty when unpublished), and `daily.fares` holds adult one-way prices per station pair.

`trips` is the weekly regular timetable effective 2026-02-02, 214 train numbers and 1,134 weekly services, used only for dates beyond the window. It was compiled from THSRC's site with every stop's arrival queried explicitly and checked for 2026-10-13 through 2026-10-19. Terminal departures are `null`; times above 1440 are next-day arrivals.

The daily window refreshes itself: the Pages workflow runs `scripts/collect.py` at 06:00 Taipei time, commits the new `data.json` and `dist/data.js` when they changed, and redeploys. It needs the repository secrets `TDX_CLIENT_ID` and `TDX_CLIENT_SECRET` (free account at https://tdx.transportdata.tw/). Run it locally with the same two variables in the environment.

Sources: [THSRC timetable page](https://www.thsrc.com.tw/ArticleContent/a3b630bb-1066-4352-a1ef-58c7b4e8ef7c), [TDX THSR APIs](https://tdx.transportdata.tw/).

## Route comparison rules

- Minimum connection time 5 minutes, adjustable to 20. Waits over 60 minutes are not considered.
- One train pair reachable via several change stations is listed once, preferring Taichung, otherwise the larger connection buffer.
- "Next direct" is the direct train with the earliest arrival among those departing at or after the transfer's departure.
- Frontier: candidates are sorted by arrival, then latest departure; ties prefer direct, then a forward change, then the larger buffer. A transfer is hidden when an already accepted candidate departs at the same time or later.
- Marginal: a transfer at least 15 minutes slower than the day's fastest direct that arrives less than 5 minutes before the next direct is also hidden.

## Development

```sh
node verify.cjs        # route, boundary and frontier checks across all station pairs and weekdays
npx serve dist         # or any static file server
```

`dev/devices.html` shows the site side by side at six widths; open it in Safari for WebKit rendering, or paste the live URL into its address box. Native date and time inputs are sized by a wrapper, never directly, because iOS misplaces their value otherwise.

## Deployment

Pushes to `main`, the daily schedule, and manual dispatch all run `.github/workflows/pages.yml`. Scheduled and manual runs refetch the data first; every run then checks syntax and routes, stamps the commit hash into the footer and asset URLs (so a cached script can never mismatch the page), and publishes `dist/`. The custom domain is set by `dist/CNAME`.

## Feedback

Feature wishes and bug reports go to [GitHub Issues](https://github.com/lolainta/thsr-timetable/issues/new/choose); the forms ask for the query link and the page version shown in the footer.

## License

Code is released under the [MIT License](LICENSE). The timetable, fare and seating data in `data.json` and `dist/data.js` come from Taiwan High Speed Rail Corporation, via its website and the [TDX](https://tdx.transportdata.tw/) platform, and remain subject to their terms; TDX data is published under Taiwan's Open Government Data License.

## Disclaimer

This is an independent project and is not affiliated with Taiwan High Speed Rail Corporation. Delays, seat availability and same-day changes must be confirmed on the official site.
