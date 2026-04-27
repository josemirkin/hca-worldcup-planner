# HCA World Cup Planner MVP

React/Vite MVP for planning World Cup matches at HCA.

## What this MVP does

- Filters matches by country, stage, status, and search.
- Lets you mark matches as `unplanned`, `hosting`, `maybe`, or `ignore`.
- Lets you edit expected attendance per match.
- Fan split auto-adjusts to 100%.
- Lets you edit dynamic consumption rules per guest:
  - signature country drink per guest
  - beer per guest
  - signature country food per guest
  - generic food per guest
- Calculates units, revenue, cost, profit, and margin live.
- Shows missing pricing warnings while still displaying estimated units.
- Lets you edit menu item cost and sell price.
- Persists match plans, pricing, and consumption rules in localStorage.
- Displays all kickoff times in Miami time (`America/New_York`).

## Important MVP note

The included `matches.json` is generated from the group list for MVP planning. Kickoff times are currently `null` and display as TBD. Replace `src/data/matches.json` with official FIFA kickoff timestamps in UTC when you are ready.

## LocalStorage keys

The MVP stores dynamic planning edits in these browser localStorage keys:

- `hca_wc_matchPlans_v1`
- `hca_wc_menuItems_v1`
- `hca_wc_consumptionRules_v1`

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in your terminal.
