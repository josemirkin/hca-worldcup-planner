# HCA World Cup Planner — Project Context for Codex

## Purpose

We are building a React MVP for Hoy Como Ayer (HCA), a bar/nightclub, to plan FIFA World Cup 2026 match events.

The app is NOT just a World Cup schedule. It is a bar revenue/planning dashboard.

The app should answer:

- Which matches should HCA host?
- How many guests are expected?
- What is the fan split between the two countries?
- Based on each country’s food/drink culture, what will people likely buy?
- Based on HCA menu prices and costs, what revenue and profit should be expected?

The app must be dynamic and usable before, during, and after games.

---

## Critical Accuracy Rule

For time-sensitive information such as teams, matches, sports schedules, news, prices, laws, and current data:

- Always verify against the latest available information before making factual claims.
- Do not rely on memory.
- If something cannot be verified, say that clearly.
- Official sources should be prioritized when available.

For FIFA World Cup teams/schedule, use official FIFA sources when possible.

---

## User Context

The user is Jose.

Jose works as a bar/nightclub manager at HCA.

Jose wants practical business planning, not a toy app.

Jose strongly prefers:
- Clear structure
- No fake certainty
- No hardcoded business logic
- Dynamic inputs
- LocalStorage for MVP persistence
- Miami timezone display for all times
- English responses

Tone preference:
- Direct
- Practical
- Some dry humor is fine
- Do not over-explain obvious things once decisions are locked

---

## Current App Concept

The app has these main areas:

1. Matches
2. Match detail / revenue estimator
3. Country cards
4. Menu & pricing
5. Consumption settings

No prep list.
No stock suggestions.
No supplier module.

---

## Core MVP Rules

### Dynamic Data

The following must be editable in the UI and persisted:

- expectedAttendance
- fanSplit
- planningStatus
- notes
- consumption settings
- menu/pricing edits

The user should NOT need to edit JSON manually for planning work.

### Persistence

For MVP, use localStorage.

Persist at minimum:

- matchPlans
- menu/pricing edits
- global consumption settings

Later, multi-user/account support may be added, but not now.

### Fan Split

Each match has two teams.

Fan split must always total 100%.

If user changes one side, the other side auto-adjusts.

Example:
- Argentina set to 70
- Brazil auto-becomes 30

Default fan split: 50/50 unless changed.

### Timezone

All times displayed in the UI must be Miami time.

Use:
America/New_York

Store match kickoff times in UTC ISO format when known.

Example:
```json
"kickoffDateTime": "2026-06-11T00:00:00Z"
```

Display as:
Jun 10, 8:00 PM (Miami)

Do not use America/Miami. It does not exist.

---

## Data Architecture

Static JSON files:

```text
src/data/countries.json
src/data/drinks.json
src/data/foods.json
src/data/brands.json
src/data/menuItems.json
src/data/matches.json
src/data/consumptionRules.json
```

Dynamic localStorage data:

```text
hca_worldcup_matchPlans
hca_worldcup_menuItems
hca_worldcup_consumptionRules
```

Exact key names can be adjusted, but keep them consistent and documented.

---

## Important Data Modeling Principle

Country cards should NOT contain duplicated detailed definitions for every food/drink/brand.

Country cards reference IDs.

Definitions live separately:

- countries.json = cultural behavior + defaults
- drinks.json = drink definitions
- foods.json = food definitions
- brands.json = brand definitions
- menuItems.json = what HCA sells + cost/sell price
- matches.json = static schedule
- localStorage matchPlans = HCA planning decisions

---

## Country Cards

The user calls these “country cards”.

A country card includes:

### Drinks

- Locals drink
- Known for
- Beer type/brands
- Stadium drink
- Watching drink

### Food

- Stadium food
- Watch food

### Consumption Defaults

Each country also has defaults used by the revenue estimator:

```json
"consumptionDefaults": {
  "signatureCountryDrinkId": "fernet",
  "beerId": "beer",
  "signatureCountryFoodId": "choripan",
  "genericFoodId": "burger",
  "fallback": {
    "signatureCountryDrinkId": "beer",
    "signatureCountryFoodId": "burger"
  }
}
```

Important names:
- `signatureCountryDrinkId`
- `beerId`
- `signatureCountryFoodId`
- `genericFoodId`

The user explicitly chose `signatureCountryDrink` because it is descriptive and clear.

Use `signatureCountryFood` for the food equivalent.

---

## Why Consumption Defaults Exist

The app should not hardcode every match.

Example:

Global rule:
- 1 signature country drink per guest

Argentina vs Brazil
100 guests
50/50 split

Argentina guests = 50
Brazil guests = 50

Argentina:
50 × 1 signature country drink = 50 Fernet

Brazil:
50 × 1 signature country drink = 50 Caipirinha

The app determines this dynamically by reading each country’s `consumptionDefaults`.

---

## Global Consumption Rules

These should be editable in the UI.

Example:

```json
{
  "signatureCountryDrinkPerGuest": 1,
  "beerPerGuest": 2,
  "signatureCountryFoodPerGuest": 1,
  "genericFoodPerGuest": 0.5
}
```

These rules apply dynamically to any selected match.

Revenue formula:

```text
teamGuests = expectedAttendance * fanSplitPercentage
units = teamGuests * consumptionRule
revenue = units * sellPrice
cost = units * cost
profit = revenue - cost
```

---

## Menu / Pricing

No supplier field is needed.

Each menu item should include:

```json
{
  "id": "fernet_coca",
  "name": "Fernet con Coca",
  "category": "drink",
  "linkedDrinkId": "fernet",
  "brandId": "fernet_branca",
  "mixerBrandIds": ["coca_cola"],
  "unit": "cocktail",
  "cost": null,
  "sellPrice": null
}
```

Food item example:

```json
{
  "id": "choripan",
  "name": "Choripán",
  "category": "food",
  "linkedFoodId": "choripan",
  "unit": "each",
  "cost": null,
  "sellPrice": null
}
```

Costs and sell prices should be editable in the UI.

Use null as default if unknown.

---

## Matches

Do not use `homeCountryId` / `awayCountryId` for MVP.

Use a simple teams array.

### matches.json

Static schedule data only.

No attendance.
No fan split.
No planning status.

Example:

```json
{
  "matches": [
    {
      "id": "match_001",
      "teams": ["mexico", "south_africa"],
      "isResolved": true,
      "kickoffDateTime": "2026-06-11T00:00:00Z",
      "stage": "group",
      "group": "A",
      "venue": "estadio_azteca"
    }
  ]
}
```

### Unknown Teams

For matches where teams are not known yet:

```json
{
  "id": "match_049",
  "teams": ["winner_group_a", "runner_up_group_b"],
  "isResolved": false,
  "kickoffDateTime": "2026-07-01T00:00:00Z",
  "stage": "round_of_32",
  "venue": "miami"
}
```

UI behavior:
- show the match
- allow planningStatus
- allow expectedAttendance
- disable fanSplit
- disable revenue estimate
- show message: “Teams not confirmed yet — revenue estimate disabled.”

When teams are known, update:
```json
"teams": ["argentina", "mexico"],
"isResolved": true
```

---

## Match Plans

Match plans are dynamic and stored in localStorage.

One match = one plan.

No multiple scenarios/plans for now. It could be confusing.

Example:

```json
{
  "matchPlans": [
    {
      "matchId": "match_001",
      "planningStatus": "unplanned",
      "expectedAttendance": 0,
      "fanSplit": {
        "mexico": 50,
        "south_africa": 50
      },
      "notes": ""
    }
  ]
}
```

Planning statuses:

```text
unplanned
hosting
maybe
ignore
```

Defaults when no plan exists:

```json
{
  "planningStatus": "unplanned",
  "expectedAttendance": 0,
  "fanSplit": {
    "teamA": 50,
    "teamB": 50
  },
  "notes": ""
}
```

Use actual country IDs when match is resolved.

---

## Match Filters

Matches screen should allow filtering by:

- country
- planning status
- stage

Example use case:
Jose wants to filter all Argentina matches and mark which ones HCA is hosting.

Match status colors:
- hosting = green
- maybe = yellow
- ignore = gray
- unplanned = neutral

---

## MVP Screens

### 1. Matches screen

Should show:
- filters
- match cards
- match date/time in Miami
- teams
- stage/group
- planning status
- expected attendance
- estimated revenue/profit if resolved and priced

### 2. Match detail / estimator

Should show:
- selected match
- two country cards
- editable expectedAttendance
- editable fan split with auto-adjust
- editable global consumption settings
- live calculated units
- revenue
- cost
- profit
- margin

### 3. Menu & Pricing

Should allow editing:
- cost
- sellPrice
- active/inactive if implemented

No supplier field.

### 4. Settings

Useful MVP settings:
- global consumption rules
- reset localStorage
- export/import localStorage data if easy

---

## UI Behavior

Avoid typing IDs in the UI.

Use:
- dropdowns
- number inputs
- segmented buttons
- sliders or paired number inputs for fan split

No JSON-like editing in the UI.

Changes should update immediately.

No quick presets.

The user wants to manually update before, during, and after games.

---

## Revenue Estimator Logic

For a resolved match:

1. Get match teams.
2. Get matchPlan or default.
3. Calculate team guest counts from attendance and fan split.
4. For each team:
   - read country.consumptionDefaults
   - map signatureCountryDrinkId
   - map beerId
   - map signatureCountryFoodId
   - map genericFoodId
5. Apply global consumption rules:
   - signatureCountryDrinkPerGuest
   - beerPerGuest
   - signatureCountryFoodPerGuest
   - genericFoodPerGuest
6. Aggregate units by item ID.
7. Match item IDs to menuItems.
8. Calculate:
   - estimated units
   - revenue
   - cost
   - profit
   - margin

If price or cost is null:
- still show units
- revenue/profit should show incomplete or treat null as 0 with clear “missing price” indicator.
- Preferred: show missing price warning.

---

## Dataset Status

A previous dataset ZIP was generated with:

- 48 countries
- countries.json
- drinks.json
- foods.json
- brands.json
- menuItems.json
- validation_report.json
- README.md

Then a later updated ZIP added:

- consumptionDefaults
- consumptionRules.json

The app ZIP generated later included a React MVP, but the schedule may be MVP placeholder data until official kickoff times are added.

Codex should inspect the actual files in the repo and adjust to match this context.

---

## Important Implementation Notes

Use React MVP, likely Vite.

Suggested stack:
- React
- JavaScript
- localStorage
- plain CSS or Tailwind if already installed

Avoid overengineering:
- no backend
- no auth
- no database
- no supplier module
- no stock prep module
- no multiple match scenarios

Keep code simple and readable.

---

## Current User Environment

User is on Windows.

Project folder path example:

```text
C:\Users\Jose\Desktop\HCA\WC planner\hca-worldcup-planner
```

User attempted to run:
```bash
npm install
```

Error:
```text
'npm' is not recognized as an internal or external command
```

This means Node.js/npm is not installed or not on PATH.

Before running app, install Node.js LTS, then reopen terminal and run:

```bash
node -v
npm -v
cd "C:\Users\Jose\Desktop\HCA\WC planner\hca-worldcup-planner"
npm install
npm run dev
```

---

## Suggested First Codex Tasks

Ask Codex to:

1. Read this PROJECT_CONTEXT.md.
2. Inspect the existing React project.
3. Confirm which JSON files exist in `src/data`.
4. Confirm whether `consumptionDefaults` and `consumptionRules.json` are included.
5. If missing, add/update them.
6. Implement or verify:
   - localStorage persistence
   - fan split auto-adjust
   - Miami timezone display
   - dynamic revenue calculation
   - editable expectedAttendance
   - editable consumption rules
   - menu/pricing editor
7. Keep MVP scope only.

---

## Message to Paste into Codex

Use this:

“Read PROJECT_CONTEXT.md first. Then inspect the repo. Do not start rewriting everything. Tell me what files exist, what is missing compared to the context, and propose the smallest safe changes to align the app with the MVP requirements. After I approve, implement the changes.”

---

## Key Decisions Already Made

- Use `teams: []`, not home/away country IDs.
- Use `isResolved` for unknown knockout teams.
- Use localStorage for dynamic planning data.
- One match = one plan.
- Fan split auto-adjusts to 100%.
- Default fan split = 50/50.
- No quick presets.
- No supplier field.
- No prep list.
- No stock suggestions.
- Store times in UTC; display in Miami time.
- Use `signatureCountryDrinkId`.
- Use `signatureCountryFoodId`.
- Use `genericFoodId`.
- Use reusable food IDs like `pizza`, `fries`, `burger` instead of country-specific duplicates unless truly unique.
- Keep percentages rounded and defensible, not fake precise.

---

## Grammar / Typo Notes From User Conversation

The user sometimes typed:
- “donwloaded” → downloaded
- “no mater” → no matter
- “whole list” was previously typed as “hole list”

No need to be annoying about grammar unless it affects clarity.
