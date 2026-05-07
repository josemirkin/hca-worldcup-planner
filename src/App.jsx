import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, DollarSign, Menu, Save, Search, SlidersHorizontal, User } from 'lucide-react';

import countriesData from './data/countries.json';
import drinksData from './data/drinks.json';
import foodsData from './data/foods.json';
import brandsData from './data/brands.json';
import menuItemsData from './data/menuItems.json';
import matchesData from './data/matches.json';
import defaultRules from './data/consumptionRules.json';

const COUNTRIES = countriesData.countries;
const DRINKS = drinksData.drinks;
const FOODS = foodsData.foods;
const BRANDS = brandsData.brands;
const MATCHES = matchesData.matches;
function normalizeMenuConfigItem(item) {
  return {
    id: item.id,
    category: item.category,
    linkedDrinkId: item.linkedDrinkId ?? null,
    linkedFoodId: item.linkedFoodId ?? null,
    cost: item.cost ?? null,
    sellPrice: item.sellPrice ?? null,
    sellingStatus: item.sellingStatus ?? (item.active === false ? 'not_selling' : 'selling'),
  };
}

const BASE_MENU_CONFIG = menuItemsData.menuItems.map(normalizeMenuConfigItem);

const STORAGE_KEYS = {
  matchPlans: 'hca_wc_matchPlans_v1',
  menuItems: 'hca_wc_menuItems_v1',
  consumptionRules: 'hca_wc_consumptionRules_v1',
};

const STATUS_OPTIONS = ['unplanned', 'hosting', 'maybe', 'ignore'];
const VIEW_OPTIONS = [
  { id: 'planner', label: 'Match planner' },
  { id: 'planned', label: 'Planned Matches' },
  { id: 'pricing', label: 'Menu & pricing' },
];
const CALENDAR_STATUS_ORDER = ['hosting', 'maybe', 'ignore', 'unplanned'];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage can fail in private browsing or locked-down browsers.
    }
  }, [key, value]);

  return [value, setValue];
}

function buildMap(items) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}

function percent(value) {
  if (!Number.isFinite(value)) return 'N/A';
  return `${Math.round(value)}%`;
}

function miamiDateTime(iso) {
  if (!iso) return 'TBD - Miami time';
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso)) + ' Miami'
  );
}

function getMiamiDateParts(iso) {
  if (!iso) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const lookup = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
  };
}

function dateKeyFromParts(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function dateKeyFromIso(iso) {
  const parts = getMiamiDateParts(iso);
  return parts ? dateKeyFromParts(parts) : null;
}

function monthStartFromIso(iso) {
  const parts = getMiamiDateParts(iso);
  return parts ? new Date(parts.year, parts.month - 1, 1) : null;
}

function monthLabel(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function buildCalendarDays(monthDate) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const lastOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const leadingDays = firstOfMonth.getDay();
  const trailingDays = 6 - lastOfMonth.getDay();
  const startDate = new Date(firstOfMonth);
  startDate.setDate(firstOfMonth.getDate() - leadingDays);
  const totalDays = leadingDays + lastOfMonth.getDate() + trailingDays;

  return Array.from({ length: totalDays }, (_, index) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + index);
    return day;
  });
}

function getDisplayName(id, map) {
  return map[id]?.name || id?.replaceAll?.('_', ' ') || id;
}

function formatItems(items, map) {
  return (
    (items || [])
      .map((item) => getDisplayName(item.id, map))
      .filter(Boolean)
      .join(' / ') || 'TBD'
  );
}

function formatMatchStage(match) {
  const stage = match.stage?.replaceAll?.('_', ' ') || 'stage TBD';
  return match.group ? `Group ${match.group}` : stage;
}

function getDefaultPlan(match) {
  const [teamA, teamB] = match.teams;
  return {
    matchId: match.id,
    planningStatus: 'unplanned',
    expectedAttendance: 0,
    fanSplit: match.isResolved ? { [teamA]: 50, [teamB]: 50 } : {},
    notes: '',
  };
}

function mergePlan(match, plan) {
  const base = getDefaultPlan(match);
  return {
    ...base,
    ...(plan || {}),
    fanSplit: { ...base.fanSplit, ...(plan?.fanSplit || {}) },
  };
}

function findMenuItemFor(kind, itemId, menuItems) {
  return menuItems.find((item) => (kind === 'drink' ? item.linkedDrinkId === itemId : item.linkedFoodId === itemId));
}

function addUnits(target, key, units, meta) {
  if (!target[key]) target[key] = { ...meta, units: 0, countries: new Set(), contextEntries: [], contextKeys: new Set() };
  target[key].units += units;
  if (meta.countryName) target[key].countries.add(meta.countryName);
  for (const contextEntry of meta.contextEntries || []) {
    const contextKey = `${meta.countryName || ''}:${contextEntry.label}:${contextEntry.percentage ?? ''}`;
    if (!target[key].contextKeys.has(contextKey)) {
      target[key].contextKeys.add(contextKey);
      target[key].contextEntries.push({
        countryName: meta.countryName,
        label: contextEntry.label,
        percentage: contextEntry.percentage ?? null,
      });
    }
  }
}

function getCountryDefaults(country) {
  return (
    country.consumptionDefaults || {
      signatureCountryDrinkId: country.drinks?.localsDrink?.[0]?.id || 'beer',
      beerId: 'beer',
      signatureCountryFoodId: country.food?.watch?.[0]?.id || country.food?.stadium?.[0]?.id || 'burger',
      genericFoodId: 'burger',
    }
  );
}

function getDrinkContextEntries(country, drinkId) {
  const contextEntries = [];
  const contextSources = [
    { label: 'Locals drink', items: country.drinks?.localsDrink || [] },
    { label: 'Known for', items: country.drinks?.knownFor || [] },
    { label: 'Stadium drink', items: country.drinks?.stadiumDrink || [] },
    { label: 'Watching drink', items: country.drinks?.watchingDrink || [] },
  ];

  for (const source of contextSources) {
    for (const item of source.items) {
      if (item.id === drinkId) {
        contextEntries.push({
          label: source.label,
          percentage: item.percentage ?? null,
        });
      }
    }
  }

  return contextEntries;
}

function getMenuConfigKey(item) {
  return item.category === 'drink' ? `drink:${item.linkedDrinkId}` : `food:${item.linkedFoodId}`;
}

function getCatalogItemConfig(category, catalogId, menuConfigItems) {
  return menuConfigItems.find((item) =>
    category === 'drink' ? item.linkedDrinkId === catalogId : item.linkedFoodId === catalogId,
  );
}

function getCountryRelevantItemIds(country) {
  const drinkIds = new Set();
  const foodIds = new Set();
  const defaults = getCountryDefaults(country);

  [defaults.signatureCountryDrinkId, defaults.beerId].filter(Boolean).forEach((id) => drinkIds.add(id));
  [defaults.signatureCountryFoodId, defaults.genericFoodId].filter(Boolean).forEach((id) => foodIds.add(id));

  [
    ...(country.drinks?.localsDrink || []),
    ...(country.drinks?.knownFor || []),
    ...(country.drinks?.stadiumDrink || []),
    ...(country.drinks?.watchingDrink || []),
  ]
    .map((item) => item.id)
    .filter(Boolean)
    .forEach((id) => drinkIds.add(id));

  [...(country.food?.stadium || []), ...(country.food?.watch || [])]
    .map((item) => item.id)
    .filter(Boolean)
    .forEach((id) => foodIds.add(id));

  return { drinkIds, foodIds };
}

function formatFilterLabel(value) {
  return value?.replaceAll?.('_', ' ') || value;
}

function calculateEstimate(match, plan, rules, countriesById, drinksById, foodsById, menuItems) {
  if (!match?.isResolved || !Number(plan?.expectedAttendance)) {
    return { rows: [], totals: { revenue: 0, cost: 0, profit: 0, margin: null, hasMissingPricing: false } };
  }

  const items = {};

  for (const countryId of match.teams) {
    const country = countriesById[countryId];
    if (!country) continue;

    const guests = Number(plan.expectedAttendance || 0) * ((plan.fanSplit?.[countryId] ?? 50) / 100);
    const defaults = getCountryDefaults(country);
    const entries = [
      {
        kind: 'drink',
        role: 'Signature country drink',
        id: defaults.signatureCountryDrinkId,
        units: guests * Number(rules.signatureCountryDrinkPerGuest || 0),
      },
      {
        kind: 'drink',
        role: 'Beer',
        id: defaults.beerId,
        units: guests * Number(rules.beerPerGuest || 0),
      },
    ];

    for (const entry of entries) {
      if (!entry.id || !entry.units) continue;
      const map = entry.kind === 'drink' ? drinksById : foodsById;
      const contextEntries = getDrinkContextEntries(country, entry.id);
      addUnits(items, `${entry.kind}:${entry.id}`, entry.units, {
        id: entry.id,
        kind: entry.kind,
        role: entry.role,
        name: getDisplayName(entry.id, map),
        countryName: country.name,
        contextEntries: contextEntries.length ? contextEntries : [{ label: entry.role, percentage: null }],
      });
    }

    const foodSources = [
      {
        label: 'Stadium food',
        items: country.food?.stadium || [],
        totalUnits: guests * Number(rules.signatureCountryFoodPerGuest || 0),
      },
      {
        label: 'Watch food',
        items: country.food?.watch || [],
        totalUnits: guests * Number(rules.genericFoodPerGuest || 0),
      },
    ];

    for (const source of foodSources) {
      if (!source.items.length || source.totalUnits <= 0) continue;
      for (const foodItem of source.items) {
        const percentage = Number(foodItem.percentage || 0);
        if (!foodItem.id || !percentage) continue;
        addUnits(items, `food:${foodItem.id}`, source.totalUnits * (percentage / 100), {
          id: foodItem.id,
          kind: 'food',
          role: source.label,
          name: getDisplayName(foodItem.id, foodsById),
          countryName: country.name,
          contextEntries: [{ label: source.label, percentage }],
        });
      }
    }
  }

  const rows = Object.values(items)
    .map((item) => {
      const menuItem = findMenuItemFor(item.kind, item.id, menuItems);
      const missingMenuItem = !menuItem;
      const missingCost = menuItem?.cost == null || menuItem?.cost === '';
      const missingSellPrice = menuItem?.sellPrice == null || menuItem?.sellPrice === '';
      const costEach = missingCost ? 0 : Number(menuItem.cost || 0);
      const sellPrice = missingSellPrice ? 0 : Number(menuItem.sellPrice || 0);
      const roundedUnits = Math.ceil(item.units);
      const hasMultipleCountries = item.countries.size > 1;
      const contextSummary = item.contextEntries
        .map((contextEntry) => {
          const prefix = hasMultipleCountries && contextEntry.countryName ? `${contextEntry.countryName}: ` : '';
          const suffix = contextEntry.percentage != null ? ` (${contextEntry.percentage}%)` : '';
          return `${prefix}${contextEntry.label}${suffix}`;
        })
        .join(', ');

      return {
        ...item,
        countries: Array.from(item.countries).join(', '),
        menuItem,
        missingMenuItem,
        missingCost,
        missingSellPrice,
        contextSummary,
        roundedUnits,
        costEach,
        sellPrice,
        totalCost: roundedUnits * costEach,
        revenue: roundedUnits * sellPrice,
        profit: roundedUnits * (sellPrice - costEach),
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.roundedUnits - a.roundedUnits);

  const totals = rows.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      cost: acc.cost + row.totalCost,
      profit: acc.profit + row.profit,
      hasMissingPricing: acc.hasMissingPricing || row.missingMenuItem || row.missingCost || row.missingSellPrice,
    }),
    { revenue: 0, cost: 0, profit: 0, hasMissingPricing: false },
  );
  totals.margin = totals.revenue ? (totals.profit / totals.revenue) * 100 : null;

  return { rows, totals };
}

function statusColor(status) {
  if (status === 'hosting') return 'bg-emerald-100 text-emerald-700';
  if (status === 'maybe') return 'bg-amber-100 text-amber-700';
  if (status === 'ignore') return 'bg-slate-100 text-slate-500';
  return 'bg-blue-50 text-blue-600';
}

function calendarBubbleClass(status) {
  if (status === 'hosting') return 'bg-emerald-500 text-white';
  if (status === 'maybe') return 'bg-amber-400 text-slate-900';
  if (status === 'ignore') return 'bg-rose-500 text-white';
  return 'border border-slate-300 bg-white text-slate-700';
}

function calendarBubbleDotClass(status) {
  if (status === 'hosting') return 'bg-emerald-500';
  if (status === 'maybe') return 'bg-amber-400';
  if (status === 'ignore') return 'bg-rose-500';
  return 'border border-slate-300 bg-white';
}

function compareMatchKickoff(a, b) {
  if (!a.kickoffDateTime && !b.kickoffDateTime) return a.id.localeCompare(b.id);
  if (!a.kickoffDateTime) return 1;
  if (!b.kickoffDateTime) return -1;
  return new Date(a.kickoffDateTime) - new Date(b.kickoffDateTime);
}

function Card({ children, className = '' }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function NumberInput({ label, helperText, value, onChange, suffix, min = 0, step = 0.25, disabled = false }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {helperText && <div className="mt-1 text-xs text-slate-400">{helperText}</div>}
      <div className={`mt-1 flex items-center rounded-xl border border-slate-200 px-3 py-2 ${disabled ? 'bg-slate-100 text-slate-400' : 'bg-white'}`}>
        <input
          className="number-input w-full bg-transparent text-sm outline-none"
          type="number"
          min={min}
          step={step}
          value={value ?? ''}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix && <span className="ml-2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </label>
  );
}

function FanSplitControl({ match, plan, countriesById, disabled, onChange }) {
  const [teamA, teamB] = match.teams;
  const teamALabel = countriesById[teamA]?.name || teamA;
  const teamBLabel = countriesById[teamB]?.name || teamB;
  const value = plan.fanSplit?.[teamA] ?? 50;

  return (
    <div className={`rounded-2xl border border-slate-200 p-4 ${disabled ? 'bg-slate-100' : 'bg-white'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-slate-500">Fan split</div>
          <div className="mt-1 text-xs text-slate-400">Adjust one side and the other updates automatically</div>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {value}% / {100 - value}%
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
          {teamALabel}: {value}%
        </div>
        <input
          className="fan-slider w-full accent-slate-900"
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(teamA, Number(event.target.value))}
        />
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 md:text-right">
          {teamBLabel}: {100 - value}%
        </div>
      </div>
    </div>
  );
}

function MatchCalendar({ matches, getPlan, selectedMatchId, selectedDayKey, onSelectMatch, onSelectDay, monthDate, onChangeMonth }) {
  const matchesByDateKey = useMemo(() => {
    const grouped = {};
    for (const match of matches) {
      const key = dateKeyFromIso(match.kickoffDateTime);
      if (!key) continue;
      const plan = getPlan(match);
      if (!grouped[key]) grouped[key] = { matches: [], counts: { hosting: 0, maybe: 0, ignore: 0, unplanned: 0 } };
      grouped[key].matches.push(match);
      grouped[key].counts[plan.planningStatus] += 1;
    }
    Object.values(grouped).forEach((group) => group.matches.sort(compareMatchKickoff));
    return grouped;
  }, [getPlan, matches]);

  const calendarDays = useMemo(() => buildCalendarDays(monthDate), [monthDate]);
  const hasKickoffDates = Object.keys(matchesByDateKey).length > 0;

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Calendar</div>
          <div className="text-sm font-semibold text-slate-900">{monthLabel(monthDate)}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChangeMonth(-1)}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => onChangeMonth(1)}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {!hasKickoffDates && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No kickoff dates are loaded yet, so day bubbles will appear after match times are added.
        </div>
      )}

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-500">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const dayKey = dateKeyFromParts({
            year: day.getFullYear(),
            month: day.getMonth() + 1,
            day: day.getDate(),
          });
          const data = matchesByDateKey[dayKey];
          const isCurrentMonth = day.getMonth() === monthDate.getMonth();
          const hasSelectedMatch = Boolean(data?.matches.some((match) => match.id === selectedMatchId));
          const isSelectedDay = selectedDayKey === dayKey;
          const firstMatch = data?.matches[0];

          return (
            <button
              key={dayKey}
              type="button"
              disabled={!firstMatch}
              onClick={() => firstMatch && onSelectDay(dayKey)}
              className={`min-h-[96px] rounded-xl border p-2 text-left transition ${
                hasSelectedMatch || isSelectedDay
                  ? 'border-2 border-slate-900 bg-slate-100 shadow-sm'
                  : 'border border-slate-200 bg-white'
              } ${firstMatch ? 'hover:border-slate-400 hover:bg-slate-50' : ''} ${isCurrentMonth ? '' : 'opacity-45'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">{day.getDate()}</span>
                {data && (
                  <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {data.matches.length}
                  </span>
                )}
              </div>
              <div className="mt-3 grid min-h-[42px] grid-cols-2 gap-1">
                {CALENDAR_STATUS_ORDER.map((status) => (
                  <div
                    key={`${dayKey}-${status}`}
                    className={`flex h-5 items-center justify-between rounded-full px-1.5 text-[10px] font-bold ${
                      data?.counts[status] ? calendarBubbleClass(status) : 'border border-dashed border-slate-200 bg-slate-50 text-slate-300'
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${data?.counts[status] ? calendarBubbleDotClass(status) : 'bg-transparent'}`} />
                    <span>{data?.counts[status] || 0}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                <span className="text-center">H</span>
                <span className="text-center">M</span>
                <span className="text-center">I</span>
                <span className="text-center">U</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CountryMiniCard({ country, drinksById, foodsById, brandsById }) {
  if (!country) return null;

  const defaults = getCountryDefaults(country);
  const beerBrands = country.drinks?.beer?.brands || [];
  const stadiumFood = formatItems(country.food?.stadium, foodsById);

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h3 className="text-lg font-bold text-slate-900">
          {country.flag} {country.name}
        </h3>
      </div>
      <div className="space-y-2 text-sm">
        <p>
          <b>Signature country drink:</b> {getDisplayName(defaults.signatureCountryDrinkId, drinksById)}
        </p>
        <p>
          <b>Locals drink:</b> {formatItems(country.drinks?.localsDrink, drinksById)}
        </p>
        <p>
          <b>Known for:</b> {formatItems(country.drinks?.knownFor, drinksById)}
        </p>
        <p>
          <b>Beer:</b> {country.drinks?.beer?.type?.replaceAll('_', ' ') || 'TBD'}
          {beerBrands.length ? ` | ${beerBrands.map((id) => brandsById[id]?.name || id).join(', ')}` : ''}
        </p>
        <p>
          <b>Signature country food:</b> {getDisplayName(defaults.signatureCountryFoodId, foodsById)}
        </p>
        <p>
          <b>Stadium drink:</b> {formatItems(country.drinks?.stadiumDrink, drinksById)}
        </p>
        <p>
          <b>Watching drink:</b> {formatItems(country.drinks?.watchingDrink, drinksById)}
        </p>
        <p>
          <b>Generic food:</b> {getDisplayName(defaults.genericFoodId, foodsById)}
        </p>
        <p>
          <b>Stadium food:</b> {stadiumFood}
        </p>
        <p>
          <b>Watch food:</b> {formatItems(country.food?.watch, foodsById)}
        </p>
      </div>
    </Card>
  );
}

function MatchCard({ match, plan, countriesById, selected, onSelect, onStatusChange }) {
  const [a, b] = match.teams.map((id) => countriesById[id]);
  const status = plan.planningStatus;

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition hover:border-slate-300 hover:bg-slate-50 ${
        selected ? 'border-2 border-slate-900 bg-slate-100' : 'border border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-slate-900">
            {a?.flag} {a?.name || match.teams[0]} <span className="text-slate-400">vs</span> {b?.flag} {b?.name || match.teams[1]}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {miamiDateTime(match.kickoffDateTime)} | {formatMatchStage(match)}
          </div>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColor(status)}`}>{status}</span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>Guests: {plan.expectedAttendance || 0}</span>
        <select
          className="rounded-lg border border-slate-200 bg-white px-2 py-1"
          value={status}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </button>
  );
}

function DaySchedulePanel({ dayKey, matches, countriesById, getPlan, selectedMatchId, onSelectMatch }) {
  if (!dayKey || !matches?.length) return null;

  const [year, month, day] = dayKey.split('-').map(Number);
  const headingDate = new Date(year, month - 1, day);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays size={18} />
        <h2 className="font-bold">
          {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(headingDate)}
        </h2>
      </div>
      <div className="space-y-3">
        {matches.map((match) => {
          const plan = getPlan(match);
          const [teamA, teamB] = match.teams;
          const selected = selectedMatchId === match.id;
          return (
            <button
              key={match.id}
              type="button"
              onClick={() => onSelectMatch(match.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                selected ? 'border-2 border-slate-900 bg-slate-100' : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{miamiDateTime(match.kickoffDateTime)}</div>
                  <div className="mt-1 text-base font-bold text-slate-900">
                    {countriesById[teamA]?.flag} {countriesById[teamA]?.name || teamA} <span className="text-slate-400">vs</span> {countriesById[teamB]?.flag} {countriesById[teamB]?.name || teamB}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{formatMatchStage(match)}</div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColor(plan.planningStatus)}`}>{plan.planningStatus}</span>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function PricingPanel({ menuItems, updateMenuItem, countries, countriesById, drinksById, foodsById, selectedMatch }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCountryIds, setSelectedCountryIds] = useState([]);
  const [useSelectedMatch, setUseSelectedMatch] = useState(false);

  const relevantCountryIds = useMemo(() => {
    const ids = new Set(selectedCountryIds);
    if (useSelectedMatch && selectedMatch) {
      selectedMatch.teams.forEach((teamId) => ids.add(teamId));
    }
    return ids;
  }, [selectedCountryIds, selectedMatch, useSelectedMatch]);

  const pricingItems = useMemo(() => {
    const drinkCatalogItems = Object.values(drinksById).map((drink) => {
      const config = getCatalogItemConfig('drink', drink.id, menuItems);
      const relevantCountries = countries
        .filter((country) => getCountryRelevantItemIds(country).drinkIds.has(drink.id))
        .map((country) => country.id);

      return {
        id: config?.id || `drink_${drink.id}`,
        catalogId: drink.id,
        name: drink.name,
        category: 'drink',
        derivedCategory: drink.category || drink.type || 'drink',
        notesText: drink.notes || '',
        contexts: drink.contexts || [],
        linkedDrinkId: drink.id,
        linkedFoodId: null,
        sellingStatus: config?.sellingStatus ?? 'not_selling',
        cost: config?.cost ?? null,
        sellPrice: config?.sellPrice ?? null,
        relevantCountries,
      };
    });

    const foodCatalogItems = Object.values(foodsById).map((food) => {
      const config = getCatalogItemConfig('food', food.id, menuItems);
      const relevantCountries = countries
        .filter((country) => getCountryRelevantItemIds(country).foodIds.has(food.id))
        .map((country) => country.id);

      return {
        id: config?.id || `food_${food.id}`,
        catalogId: food.id,
        name: food.name,
        category: 'food',
        derivedCategory: food.category || food.type || 'food',
        notesText: food.notes || '',
        contexts: food.contexts || [],
        linkedDrinkId: null,
        linkedFoodId: food.id,
        sellingStatus: config?.sellingStatus ?? 'not_selling',
        cost: config?.cost ?? null,
        sellPrice: config?.sellPrice ?? null,
        relevantCountries,
      };
    });

    return [...drinkCatalogItems, ...foodCatalogItems]
      .map((item) => ({
        ...item,
        isMissingPrice: item.cost == null || item.cost === '' || item.sellPrice == null || item.sellPrice === '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [countries, drinksById, foodsById, menuItems]);

  const categoryOptions = useMemo(
    () => [...new Set(pricingItems.map((item) => item.derivedCategory).filter(Boolean))].sort(),
    [pricingItems],
  );

  const filteredPricingItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return pricingItems.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        [item.name, item.id, item.catalogId, item.category, item.derivedCategory, item.notesText]
          .concat(item.contexts || [])
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);

      if (!matchesSearch) return false;
      if (typeFilter !== 'all' && item.category !== typeFilter) return false;
      if (categoryFilter !== 'all' && item.derivedCategory !== categoryFilter) return false;

      if (statusFilter !== 'all') {
        if (statusFilter === 'missing_price' && !item.isMissingPrice) return false;
        if (statusFilter !== 'missing_price' && item.sellingStatus !== statusFilter) return false;
      }

      if (relevantCountryIds.size > 0 && !item.relevantCountries.some((countryId) => relevantCountryIds.has(countryId))) {
        return false;
      }

      return true;
    });
  }, [categoryFilter, pricingItems, relevantCountryIds, search, statusFilter, typeFilter]);

  const toggleCountry = (countryId) => {
    setSelectedCountryIds((current) =>
      current.includes(countryId) ? current.filter((id) => id !== countryId) : [...current, countryId],
    );
  };

  const selectedCountryNames = selectedCountryIds.map((id) => countriesById[id]?.name || id);
  const selectedMatchLabel =
    selectedMatch?.teams?.map((id) => countriesById[id]?.name || id).join(' vs ') || 'No match selected';

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Save size={18} />
        <h2 className="font-bold">Menu & pricing</h2>
        <span className="text-xs text-slate-500">Stored locally and reused by every match estimate</span>
      </div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        This stays separate from the match planner so normal event work is cleaner. Update pricing here when the menu changes, then switch back to the planner.
      </p>

      <div className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <input
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
          placeholder="Search name, id, category, notes..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All types</option>
            <option value="drink">Drink</option>
            <option value="food">Food</option>
          </select>
          <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All categories</option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {formatFilterLabel(option)}
              </option>
            ))}
          </select>
          <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All status</option>
            <option value="selling">Selling</option>
            <option value="maybe">Maybe</option>
            <option value="not_selling">Not selling</option>
            <option value="missing_price">Missing price</option>
          </select>
          <button
            type="button"
            onClick={() => setUseSelectedMatch((current) => !current)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              useSelectedMatch ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'
            }`}
          >
            {useSelectedMatch ? `Selected match: ${selectedMatchLabel}` : 'Filter by selected match'}
          </button>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Country relevance</div>
            {selectedCountryIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCountryIds([])}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Clear countries
              </button>
            )}
          </div>
          <div className="max-h-40 overflow-auto rounded-xl border border-slate-200 bg-white p-2">
            <div className="flex flex-wrap gap-2">
              {countries.map((country) => {
                const selected = selectedCountryIds.includes(country.id);
                return (
                  <button
                    key={country.id}
                    type="button"
                    onClick={() => toggleCountry(country.id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      selected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {country.name}
                  </button>
                );
              })}
            </div>
          </div>
          {(selectedCountryNames.length > 0 || useSelectedMatch) && (
            <div className="mt-2 text-xs text-slate-500">
              Relevant countries: {[...selectedCountryNames, ...(useSelectedMatch && selectedMatch ? selectedMatch.teams.map((id) => countriesById[id]?.name || id) : [])]
                .filter((value, index, array) => array.indexOf(value) === index)
                .join(', ')}
            </div>
          )}
        </div>
      </div>

      <div className="mb-3 text-sm text-slate-500">{filteredPricingItems.length} items shown</div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredPricingItems.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
            <div className="mb-1 font-semibold">{item.name}</div>
            <div className="mb-3 text-xs text-slate-500">
              {item.catalogId} | {item.category} | {formatFilterLabel(item.derivedCategory)}
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-500">Status</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={item.sellingStatus}
                onChange={(event) =>
                  updateMenuItem(item.id, {
                    category: item.category,
                    linkedDrinkId: item.linkedDrinkId,
                    linkedFoodId: item.linkedFoodId,
                    sellingStatus: event.target.value,
                    cost: item.cost,
                    sellPrice: item.sellPrice,
                  })
                }
              >
                <option value="selling">Selling</option>
                <option value="maybe">Maybe</option>
                <option value="not_selling">Not selling</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberInput
                label="Cost"
                value={item.cost}
                onChange={(value) =>
                  updateMenuItem(item.id, {
                    category: item.category,
                    linkedDrinkId: item.linkedDrinkId,
                    linkedFoodId: item.linkedFoodId,
                    sellingStatus: item.sellingStatus,
                    cost: value,
                    sellPrice: item.sellPrice,
                  })
                }
                suffix="$"
              />
              <NumberInput
                label="Sell price"
                value={item.sellPrice}
                onChange={(value) =>
                  updateMenuItem(item.id, {
                    category: item.category,
                    linkedDrinkId: item.linkedDrinkId,
                    linkedFoodId: item.linkedFoodId,
                    sellingStatus: item.sellingStatus,
                    cost: item.cost,
                    sellPrice: value,
                  })
                }
                suffix="$"
              />
            </div>
            {item.relevantCountries.length > 0 && (
              <div className="mt-3 text-xs text-slate-500">
                Relevant to: {item.relevantCountries.map((countryId) => countriesById[countryId]?.name || countryId).join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function InsightCard({ title, tone = 'neutral', collapsedContent, expandedContent, isOpen, onToggle }) {
  const toneClass =
    tone === 'profit'
      ? 'border-emerald-200 bg-emerald-50/60'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50/70'
        : tone === 'danger'
          ? 'border-rose-200 bg-rose-50/70'
          : 'border-slate-200 bg-white';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full rounded-2xl border px-5 py-4 text-left transition hover:border-slate-300 ${toneClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
          <div className="mt-2">{collapsedContent}</div>
        </div>
        <div className="text-xs font-semibold text-slate-500">{isOpen ? 'Collapse' : 'Expand'}</div>
      </div>
      {isOpen && <div className="mt-4 border-t border-slate-200 pt-4">{expandedContent}</div>}
    </button>
  );
}

function DashboardSection({ summary, openCards, onToggleCard }) {
  const statusOrder = ['hosting', 'maybe', 'ignore', 'unplanned'];

  return (
    <section className="space-y-4">
      <InsightCard
        title="Revenue"
        tone="profit"
        isOpen={Boolean(openCards.revenue)}
        onToggle={() => onToggleCard('revenue')}
        collapsedContent={
          <div>
            <div className="text-2xl font-black text-slate-900">{money(summary.revenue.total)}</div>
            {summary.revenue.potentialTotal > 0 && <div className="mt-1 text-xs font-medium text-amber-700">Potential: {money(summary.revenue.potentialTotal)}</div>}
          </div>
        }
        expandedContent={
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-white p-3">
                <div className="text-xs text-slate-500">Confirmed revenue</div>
                <div className="font-bold text-slate-900">{money(summary.revenue.total)}</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs text-amber-700">Potential revenue</div>
                <div className="font-bold text-amber-900">{money(summary.revenue.potentialTotal)}</div>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Top revenue matches</div>
              <div className="space-y-2">
                {summary.revenue.topMatches.length ? summary.revenue.topMatches.map((match) => (
                  <div key={match.id} className="flex items-center justify-between gap-3">
                    <div className="text-slate-700">{match.label}</div>
                    <div className="font-semibold text-slate-900">{money(match.revenue)}</div>
                  </div>
                )) : <div className="text-slate-500">No hosting revenue yet.</div>}
              </div>
            </div>
            {summary.revenue.potentialMatches.length > 0 && (
              <div className="border-t border-slate-200 pt-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-700">Potential revenue matches</div>
                <div className="space-y-2">
                  {summary.revenue.potentialMatches.map((match) => (
                    <div key={match.id} className="flex items-center justify-between gap-3">
                      <div className="text-slate-700">{match.label}</div>
                      <div className="font-semibold text-amber-900">{money(match.revenue)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="border-t border-slate-200 pt-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Revenue by category</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white p-3">
                  <div className="text-xs text-slate-500">Food</div>
                  <div className="font-bold text-slate-900">{money(summary.revenue.byCategory.food)}</div>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <div className="text-xs text-slate-500">Drinks</div>
                  <div className="font-bold text-slate-900">{money(summary.revenue.byCategory.drink)}</div>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Top revenue items</div>
              <div className="space-y-2">
                {summary.revenue.topItems.length ? summary.revenue.topItems.map((item) => (
                  <div key={`${item.kind}:${item.id}`} className="flex items-center justify-between gap-3">
                    <div className="text-slate-700">{item.name}</div>
                    <div className="font-semibold text-slate-900">{money(item.revenue)}</div>
                  </div>
                )) : <div className="text-slate-500">No revenue items yet.</div>}
              </div>
            </div>
          </div>
        }
      />

      <InsightCard
        title="Profit"
        tone="profit"
        isOpen={Boolean(openCards.profit)}
        onToggle={() => onToggleCard('profit')}
        collapsedContent={
          <div>
            <div className="text-2xl font-black text-slate-900">{money(summary.profit.total)}</div>
            {summary.profit.potentialTotal > 0 && <div className="mt-1 text-xs font-medium text-amber-700">Potential: {money(summary.profit.potentialTotal)}</div>}
          </div>
        }
        expandedContent={
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Top profit matches</div>
              <div className="space-y-2">
                {summary.profit.topMatches.length ? summary.profit.topMatches.map((match) => (
                  <div key={match.id} className="flex items-center justify-between gap-3">
                    <div className="text-slate-700">{match.label}</div>
                    <div className="font-semibold text-emerald-700">{money(match.profit)}</div>
                  </div>
                )) : <div className="text-slate-500">No hosting profit yet.</div>}
              </div>
            </div>
            {summary.profit.lowMatches.length > 0 && (
              <div className="border-t border-slate-200 pt-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Low profit matches</div>
                <div className="space-y-2">
                  {summary.profit.lowMatches.map((match) => (
                    <div key={match.id} className="flex items-center justify-between gap-3">
                      <div className="text-slate-700">{match.label}</div>
                      <div className="font-semibold text-slate-900">{money(match.profit)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {summary.profit.potentialTotal > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs text-amber-700">Potential profit</div>
                <div className="font-bold text-amber-900">{money(summary.profit.potentialTotal)}</div>
              </div>
            )}
            <div className="rounded-xl bg-white p-3">
              <div className="text-xs text-slate-500">Overall margin</div>
              <div className="font-bold text-slate-900">{percent(summary.profit.margin)}</div>
            </div>
          </div>
        }
      />

      <InsightCard
        title="Matches"
        tone="neutral"
        isOpen={Boolean(openCards.matches)}
        onToggle={() => onToggleCard('matches')}
        collapsedContent={
          <div className="grid grid-cols-2 gap-2 text-sm">
            {statusOrder.map((status) => (
              <div key={status} className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">{formatFilterLabel(status)}</div>
                <div className={`mt-1 font-bold ${status === 'ignore' ? 'text-slate-500' : 'text-slate-900'}`}>{summary.matches.counts[status]}</div>
              </div>
            ))}
          </div>
        }
        expandedContent={
          <div className="space-y-4 text-sm">
            {['hosting', 'maybe'].map((status) => (
              <div key={status}>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{formatFilterLabel(status)}</div>
                <div className="space-y-2">
                  {summary.matches.byStatus[status].length ? summary.matches.byStatus[status].slice(0, 5).map((match) => (
                    <div key={match.id} className="rounded-xl bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-slate-900">{match.label}</div>
                        <div className="text-xs text-slate-500">Guests {match.attendance}</div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Revenue {money(match.revenue)} | Profit {money(match.profit)}</div>
                    </div>
                  )) : <div className="text-slate-500">No matches in this status.</div>}
                </div>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-4">
              <div className="grid gap-3 md:grid-cols-2">
                {['ignore', 'unplanned'].map((status) => (
                  <div key={status} className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{formatFilterLabel(status)}</div>
                    <div className="mt-1 text-sm text-slate-500">{summary.matches.byStatus[status].length} matches</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        }
      />

      <InsightCard
        title="Missing Pricing"
        tone={summary.missingPricing.count ? 'danger' : 'neutral'}
        isOpen={Boolean(openCards.missingPricing)}
        onToggle={() => onToggleCard('missingPricing')}
        collapsedContent={<div className="text-2xl font-black text-slate-900">{summary.missingPricing.count}</div>}
        expandedContent={
          <div className="space-y-3 text-sm">
            {summary.missingPricing.items.length ? summary.missingPricing.items.map((item) => (
              <div key={`${item.kind}:${item.id}`} className="rounded-xl bg-white p-3">
                <div className="font-semibold text-slate-900">{item.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Matches: {item.matches.slice(0, 3).join(', ')}
                  {item.matches.length > 3 ? ` +${item.matches.length - 3} more` : ''}
                </div>
                <div className="mt-1 text-xs text-rose-700">Complete this in Menu & pricing</div>
              </div>
            )) : <div className="text-slate-500">No missing pricing in current estimates.</div>}
            {summary.missingPricing.potentialCount > 0 && (
              <div className="border-t border-slate-200 pt-3">
                <div className="text-xs font-medium uppercase tracking-wide text-amber-700">Potential setup work</div>
                <div className="mt-1 text-xs text-amber-700">{summary.missingPricing.potentialCount} items are missing pricing in maybe matches.</div>
              </div>
            )}
          </div>
        }
      />
    </section>
  );
}

function PlannedMatchItem({ match, plan, estimate, countriesById, selected, onOpen }) {
  const [teamA, teamB] = match.teams;
  const showFinancials = plan.planningStatus === 'hosting' || plan.planningStatus === 'maybe';
  const isPotential = plan.planningStatus === 'maybe';
  const hasMissingPricing = showFinancials && estimate.totals.hasMissingPricing;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full rounded-2xl border p-4 text-left transition hover:border-slate-300 hover:bg-slate-50 ${
        selected ? 'border-2 border-slate-900 bg-slate-100' : 'border border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-bold text-slate-900">
            {countriesById[teamA]?.flag} {countriesById[teamA]?.name || teamA} <span className="text-slate-400">vs</span> {countriesById[teamB]?.flag}{' '}
            {countriesById[teamB]?.name || teamB}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {miamiDateTime(match.kickoffDateTime)} | {formatMatchStage(match)}
          </div>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColor(plan.planningStatus)}`}>{plan.planningStatus}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[auto_auto_1fr] md:items-start">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Attendance</div>
          <div className="text-sm font-semibold text-slate-900">{plan.expectedAttendance || 0}</div>
        </div>

        {showFinancials ? (
          <>
            <div className={`rounded-xl px-3 py-2 ${isPotential ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}>
              <div className="text-[11px] uppercase tracking-wide text-current/70">{isPotential ? 'Potential revenue' : 'Revenue'}</div>
              <div className="text-sm font-semibold">{money(estimate.totals.revenue)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className={`rounded-xl px-3 py-2 ${isPotential ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-900'}`}>
                <div className="text-[11px] uppercase tracking-wide text-current/70">{isPotential ? 'Potential profit' : 'Profit'}</div>
                <div className="text-sm font-semibold">{money(estimate.totals.profit)}</div>
              </div>
              {hasMissingPricing && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Missing pricing in estimate
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="md:col-span-2 flex items-center justify-end">
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Ignored match</div>
          </div>
        )}
      </div>
    </button>
  );
}

function PlannedMatchesView({ plannedMatches, ignoredMatches, countriesById, selectedMatchId, onOpenMatch }) {
  const [showIgnored, setShowIgnored] = useState(false);

  if (!plannedMatches.length && !ignoredMatches.length) {
    return (
      <Card className="p-6">
        <div className="text-sm text-slate-500">No planned matches yet.</div>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      {plannedMatches.length > 0 ? (
        <div className="space-y-3">
          {plannedMatches.map(({ match, plan, estimate }) => (
            <PlannedMatchItem
              key={match.id}
              match={match}
              plan={plan}
              estimate={estimate}
              countriesById={countriesById}
              selected={selectedMatchId === match.id}
              onOpen={() => onOpenMatch(match.id)}
            />
          ))}
        </div>
      ) : (
        <Card className="p-6">
          <div className="text-sm text-slate-500">No hosting or maybe matches yet.</div>
        </Card>
      )}

      {ignoredMatches.length > 0 && (
        <Card className="p-4">
          <button
            type="button"
            onClick={() => setShowIgnored((current) => !current)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Ignored matches</div>
              <div className="mt-1 text-sm text-slate-600">{ignoredMatches.length} match{ignoredMatches.length === 1 ? '' : 'es'}</div>
            </div>
            <div className="text-xs font-semibold text-slate-500">{showIgnored ? 'Collapse' : 'Expand'}</div>
          </button>

          {showIgnored && (
            <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
              {ignoredMatches.map(({ match, plan, estimate }) => (
                <PlannedMatchItem
                  key={match.id}
                  match={match}
                  plan={plan}
                  estimate={estimate}
                  countriesById={countriesById}
                  selected={selectedMatchId === match.id}
                  onOpen={() => onOpenMatch(match.id)}
                />
              ))}
            </div>
          )}
        </Card>
      )}
    </section>
  );
}

function BulkPlanningActions({ countries, stageOptions, matches, countriesById, getPlan, feedback, onApplyBulk }) {
  const [filterType, setFilterType] = useState('country');
  const [countryId, setCountryId] = useState('');
  const [stage, setStage] = useState('');
  const [targetStatus, setTargetStatus] = useState('hosting');

  const selectedValueLabel =
    filterType === 'country'
      ? countriesById[countryId]?.name || ''
      : stage ? stage.replaceAll('_', ' ') : '';

  const matchedMatches = useMemo(() => {
    if (filterType === 'country') {
      if (!countryId) return [];
      return matches.filter((match) => match.teams.includes(countryId));
    }
    if (!stage) return [];
    return matches.filter((match) => match.stage === stage);
  }, [countryId, filterType, matches, stage]);

  const preview = useMemo(() => {
    const totalMatched = matchedMatches.length;
    const alreadySet = matchedMatches.filter((match) => getPlan(match).planningStatus === targetStatus).length;
    const willChange = totalMatched - alreadySet;
    const sample = matchedMatches
      .slice(0, 3)
      .map((match) => match.teams.map((id) => countriesById[id]?.name || id).join(' vs '));

    return { totalMatched, alreadySet, willChange, sample };
  }, [countriesById, getPlan, matchedMatches, targetStatus]);

  const handleApply = () => {
    if (!preview.totalMatched || !selectedValueLabel) return;
    const message = `This will update ${preview.totalMatched} ${selectedValueLabel} match${preview.totalMatched === 1 ? '' : 'es'} to ${formatFilterLabel(targetStatus)}.`;
    if (!window.confirm(message)) return;
    onApplyBulk({
      matchIds: matchedMatches.map((match) => match.id),
      targetStatus,
      filterLabel: selectedValueLabel,
      totalMatched: preview.totalMatched,
    });
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Save size={18} />
        <h2 className="font-bold">Bulk Planning Actions</h2>
      </div>

      <div className="grid gap-3 xl:grid-cols-[180px_minmax(0,1fr)_180px_auto]">
        <select
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={filterType}
          onChange={(event) => setFilterType(event.target.value)}
        >
          <option value="country">Country</option>
          <option value="stage">Stage</option>
        </select>

        {filterType === 'country' ? (
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={countryId} onChange={(event) => setCountryId(event.target.value)}>
            <option value="">Select country</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
        ) : (
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={stage} onChange={(event) => setStage(event.target.value)}>
            <option value="">Select stage</option>
            {stageOptions.map((option) => (
              <option key={option} value={option}>
                {option.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        )}

        <select
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={targetStatus}
          onChange={(event) => setTargetStatus(event.target.value)}
        >
          <option value="hosting">Hosting</option>
          <option value="maybe">Maybe</option>
          <option value="ignore">Ignore</option>
        </select>

        <button
          type="button"
          onClick={handleApply}
          disabled={!preview.totalMatched}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            preview.totalMatched ? 'bg-slate-900 text-white hover:bg-slate-800' : 'cursor-not-allowed bg-slate-200 text-slate-500'
          }`}
        >
          Confirm update
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {selectedValueLabel ? (
          preview.totalMatched ? (
            <>
              <div>
                This will update {preview.totalMatched} {selectedValueLabel} match{preview.totalMatched === 1 ? '' : 'es'} to {formatFilterLabel(targetStatus)}.
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {preview.willChange} will change, {preview.alreadySet} already {preview.alreadySet === 1 ? 'is' : 'are'} {formatFilterLabel(targetStatus)}.
              </div>
              {preview.sample.length > 0 && <div className="mt-2 text-xs text-slate-500">Examples: {preview.sample.join(' | ')}</div>}
            </>
          ) : (
            <div>No matches found for this selection.</div>
          )
        ) : (
          <div>Choose a country or stage to preview the bulk update.</div>
        )}
      </div>

      {feedback && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{feedback}</div>}
    </Card>
  );
}

export default function App() {
  const countriesById = useMemo(() => buildMap(COUNTRIES), []);
  const drinksById = useMemo(() => buildMap(DRINKS), []);
  const foodsById = useMemo(() => buildMap(FOODS), []);
  const brandsById = useMemo(() => buildMap(BRANDS), []);

  const [matchPlans, setMatchPlans] = useLocalStorage(STORAGE_KEYS.matchPlans, []);
  const [menuItems, setMenuItems] = useLocalStorage(STORAGE_KEYS.menuItems, BASE_MENU_CONFIG);
  const [rules, setRules] = useLocalStorage(STORAGE_KEYS.consumptionRules, defaultRules);
  const [countryFilter, setCountryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [activeView, setActiveView] = useState('planner');
  const [openInsightCards, setOpenInsightCards] = useState({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState('');
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const firstMatchWithDate = MATCHES.find((match) => match.kickoffDateTime)?.kickoffDateTime;
    return monthStartFromIso(firstMatchWithDate) || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

  const stageOptions = useMemo(() => [...new Set(MATCHES.map((match) => match.stage).filter(Boolean))], []);

  useEffect(() => {
    setMenuItems((items) => items.map(normalizeMenuConfigItem));
  }, [setMenuItems]);

  const getPlan = (match) => mergePlan(match, matchPlans.find((plan) => plan.matchId === match.id));

  const savePlan = (matchId, patch) => {
    setMatchPlans((previous) => {
      const match = MATCHES.find((item) => item.id === matchId);
      const existing = previous.find((plan) => plan.matchId === matchId);
      const merged = { ...mergePlan(match, existing), ...patch };
      return existing ? previous.map((plan) => (plan.matchId === matchId ? merged : plan)) : [...previous, merged];
    });
  };

  const bulkUpdatePlanningStatus = ({ matchIds, targetStatus, filterLabel, totalMatched }) => {
    setMatchPlans((previous) => {
      const byMatchId = new Map(previous.map((plan) => [plan.matchId, plan]));
      for (const matchId of matchIds) {
        const match = MATCHES.find((item) => item.id === matchId);
        const existing = byMatchId.get(matchId);
        byMatchId.set(matchId, { ...mergePlan(match, existing), planningStatus: targetStatus });
      }
      return Array.from(byMatchId.values());
    });
    setBulkFeedback(`Updated ${totalMatched} ${filterLabel} match${totalMatched === 1 ? '' : 'es'} to ${formatFilterLabel(targetStatus)}.`);
  };

  const filteredMatches = MATCHES.filter((match) => {
    const plan = getPlan(match);
    const teamNames = match.teams.map((id) => countriesById[id]?.name || id).join(' ').toLowerCase();
    const matchDayKey = dateKeyFromIso(match.kickoffDateTime);
    if (countryFilter !== 'all' && !match.teams.includes(countryFilter)) return false;
    if (statusFilter !== 'all' && plan.planningStatus !== statusFilter) return false;
    if (stageFilter !== 'all' && match.stage !== stageFilter) return false;
    if (selectedDayKey && matchDayKey !== selectedDayKey) return false;
    if (search && !teamNames.includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedMatch = selectedMatchId ? MATCHES.find((match) => match.id === selectedMatchId) || null : null;
  const selectedPlan = selectedMatch ? getPlan(selectedMatch) : null;
  const [teamA, teamB] = selectedMatch?.teams || [];
  const selectedMatchResolved = Boolean(selectedMatch?.isResolved);
  const matchesByDateKey = useMemo(() => {
    const grouped = {};
    for (const match of MATCHES) {
      const key = dateKeyFromIso(match.kickoffDateTime);
      if (!key) continue;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(match);
    }
    Object.values(grouped).forEach((group) => group.sort(compareMatchKickoff));
    return grouped;
  }, []);

  const estimate = useMemo(
    () =>
      selectedMatch && selectedPlan
        ? calculateEstimate(selectedMatch, selectedPlan, rules, countriesById, drinksById, foodsById, menuItems)
        : { rows: [], totals: { revenue: 0, cost: 0, profit: 0, margin: null, hasMissingPricing: false } },
    [selectedMatch, selectedPlan, rules, countriesById, drinksById, foodsById, menuItems],
  );

  const dashboardSummary = useMemo(() => {
    const matchSummaries = filteredMatches.map((match) => {
      const plan = getPlan(match);
      const estimateForMatch = calculateEstimate(match, plan, rules, countriesById, drinksById, foodsById, menuItems);
      const label = match.teams.map((id) => countriesById[id]?.name || id).join(' vs ');
      const includedInFinancials = plan.planningStatus === 'hosting';
      const includedInPotentialFinancials = plan.planningStatus === 'maybe';
      const categoryTotals = estimateForMatch.rows.reduce(
        (acc, row) => {
          acc[row.kind] += row.revenue;
          return acc;
        },
        { drink: 0, food: 0 },
      );

      return {
        id: match.id,
        label,
        plan,
        attendance: plan.expectedAttendance || 0,
        revenue: includedInFinancials ? estimateForMatch.totals.revenue : 0,
        profit: includedInFinancials ? estimateForMatch.totals.profit : 0,
        rows: estimateForMatch.rows,
        categoryTotals,
        includedInFinancials,
        includedInPotentialFinancials,
      };
    });

    const includedMatches = matchSummaries.filter((match) => match.includedInFinancials);
    const potentialMatches = matchSummaries.filter((match) => match.includedInPotentialFinancials);
    const statusCounts = { hosting: 0, maybe: 0, ignore: 0, unplanned: 0 };
    const byStatus = { hosting: [], maybe: [], ignore: [], unplanned: [] };

    for (const match of matchSummaries) {
      statusCounts[match.plan.planningStatus] += 1;
      byStatus[match.plan.planningStatus].push(match);
    }

    const totalRevenue = includedMatches.reduce((sum, match) => sum + match.revenue, 0);
    const totalProfit = includedMatches.reduce((sum, match) => sum + match.profit, 0);
    const potentialRevenue = potentialMatches.reduce((sum, match) => sum + match.rows.reduce((rowSum, row) => rowSum + row.revenue, 0), 0);
    const potentialProfit = potentialMatches.reduce((sum, match) => sum + match.rows.reduce((rowSum, row) => rowSum + row.profit, 0), 0);
    const byCategory = includedMatches.reduce(
      (acc, match) => ({
        drink: acc.drink + match.categoryTotals.drink,
        food: acc.food + match.categoryTotals.food,
      }),
      { drink: 0, food: 0 },
    );

    const buildItemSummary = (matches) => {
      const itemMap = {};
      for (const match of matches) {
        for (const row of match.rows) {
          const key = `${row.kind}:${row.id}`;
          if (!itemMap[key]) {
            itemMap[key] = {
              id: row.id,
              kind: row.kind,
              name: row.name,
              revenue: 0,
              matches: new Set(),
              missingMenuItem: row.missingMenuItem,
              missingCost: row.missingCost,
              missingSellPrice: row.missingSellPrice,
            };
          }
          itemMap[key].revenue += row.revenue;
          itemMap[key].matches.add(match.label);
          itemMap[key].missingMenuItem = itemMap[key].missingMenuItem || row.missingMenuItem;
          itemMap[key].missingCost = itemMap[key].missingCost || row.missingCost;
          itemMap[key].missingSellPrice = itemMap[key].missingSellPrice || row.missingSellPrice;
        }
      }

      return Object.values(itemMap)
        .map((item) => ({ ...item, matches: Array.from(item.matches) }))
        .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
    };

    const aggregatedItems = buildItemSummary(includedMatches);
    const potentialAggregatedItems = buildItemSummary(potentialMatches);
    const missingPricingAll = aggregatedItems.filter((item) => item.missingMenuItem || item.missingCost || item.missingSellPrice);
    const potentialMissingPricing = potentialAggregatedItems.filter((item) => item.missingMenuItem || item.missingCost || item.missingSellPrice);

    return {
      revenue: {
        total: totalRevenue,
        potentialTotal: potentialRevenue,
        byCategory,
        topMatches: [...includedMatches].sort((a, b) => b.revenue - a.revenue).slice(0, 3),
        potentialMatches: potentialMatches
          .map((match) => ({ ...match, revenue: match.rows.reduce((sum, row) => sum + row.revenue, 0) }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 3),
        topItems: aggregatedItems.slice(0, 3),
      },
      profit: {
        total: totalProfit,
        potentialTotal: potentialProfit,
        margin: totalRevenue ? (totalProfit / totalRevenue) * 100 : null,
        topMatches: [...includedMatches].sort((a, b) => b.profit - a.profit).slice(0, 3),
        lowMatches: [...includedMatches].sort((a, b) => a.profit - b.profit).slice(0, 3),
      },
      matches: {
        counts: statusCounts,
        byStatus,
      },
      missingPricing: {
        count: missingPricingAll.length,
        items: missingPricingAll.slice(0, 5),
        potentialCount: potentialMissingPricing.length,
      },
    };
  }, [filteredMatches, rules, countriesById, drinksById, foodsById, menuItems]);

  const plannedMatchesSummary = useMemo(() => {
    const reviewedMatches = MATCHES.map((match) => {
      const plan = getPlan(match);
      return {
        match,
        plan,
        estimate: calculateEstimate(match, plan, rules, countriesById, drinksById, foodsById, menuItems),
      };
    })
      .filter(({ plan }) => ['hosting', 'maybe', 'ignore'].includes(plan.planningStatus))
      .sort((a, b) => compareMatchKickoff(a.match, b.match));

    return {
      active: reviewedMatches.filter(({ plan }) => plan.planningStatus !== 'ignore'),
      ignored: reviewedMatches.filter(({ plan }) => plan.planningStatus === 'ignore'),
    };
  }, [rules, countriesById, drinksById, foodsById, menuItems, matchPlans]);

  const updateSplit = (countryId, value) => {
    if (!selectedMatchResolved) return;
    const clamped = Math.max(0, Math.min(100, Number(value) || 0));
    const otherCountryId = selectedMatch.teams.find((id) => id !== countryId);
    savePlan(selectedMatch.id, { fanSplit: { [countryId]: clamped, [otherCountryId]: 100 - clamped } });
  };

  const updateMenuItem = (id, patch) => {
    setMenuItems((items) => {
      const targetKey = patch.category === 'drink' ? `drink:${patch.linkedDrinkId}` : `food:${patch.linkedFoodId}`;
      const existingIndex = items.findIndex((item) => getMenuConfigKey(item) === targetKey);

      if (existingIndex >= 0) {
        return items.map((item, index) => (index === existingIndex ? normalizeMenuConfigItem({ ...item, ...patch }) : item));
      }

      return [
        ...items,
        normalizeMenuConfigItem({
          id,
          category: patch.category,
          linkedDrinkId: patch.linkedDrinkId ?? null,
          linkedFoodId: patch.linkedFoodId ?? null,
          cost: patch.cost ?? null,
          sellPrice: patch.sellPrice ?? null,
          sellingStatus: patch.sellingStatus ?? 'not_selling',
        }),
      ];
    });
  };

  const resetLocalData = () => {
    setMatchPlans([]);
    setMenuItems(BASE_MENU_CONFIG);
    setRules(defaultRules);
    setUserMenuOpen(false);
  };

  const toggleMatchSelection = (matchId) => {
    const targetMatch = MATCHES.find((match) => match.id === matchId);
    const targetDayKey = dateKeyFromIso(targetMatch?.kickoffDateTime);
    setBulkFeedback('');
    setSelectedDayKey(targetDayKey || null);
    setSelectedMatchId((current) => (current === matchId ? null : matchId));
  };

  const toggleDaySelection = (dayKey) => {
    setSelectedDayKey((current) => {
      const nextDayKey = current === dayKey ? null : dayKey;
      setBulkFeedback('');
      if (nextDayKey && selectedMatchId) {
        const activeMatch = MATCHES.find((match) => match.id === selectedMatchId);
        if (dateKeyFromIso(activeMatch?.kickoffDateTime) !== nextDayKey) {
          setSelectedMatchId(null);
        }
      }
      return nextDayKey;
    });
  };

  const toggleInsightCard = (cardId) => {
    setBulkFeedback('');
    setOpenInsightCards((current) => ({ ...current, [cardId]: !current[cardId] }));
  };

  const openMatchInPlanner = (matchId) => {
    const targetMatch = MATCHES.find((match) => match.id === matchId);
    const targetDayKey = dateKeyFromIso(targetMatch?.kickoffDateTime);
    setSelectedDayKey(targetDayKey || null);
    setSelectedMatchId(matchId);
    setActiveView('planner');
  };

  const shiftCalendarMonth = (direction) => {
    setCalendarMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + direction, 1));
  };

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-6 text-slate-900 xl:px-8 xl:py-8">
      <div className="mx-auto w-full max-w-[1680px] space-y-6">
        <div className="flex justify-end">
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <User size={16} />
              <Menu size={16} />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-14 z-10 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                <button
                  type="button"
                  onClick={resetLocalData}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Save size={16} />
                  Reset local data
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
            <main className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {VIEW_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setActiveView(option.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      activeView === option.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {activeView === 'planner' && (
                <div className="space-y-4">
                  <div className="text-sm font-medium text-slate-500">Select a match -&gt; Set attendance -&gt; Review estimate</div>
                  <DashboardSection summary={dashboardSummary} openCards={openInsightCards} onToggleCard={toggleInsightCard} />
                </div>
              )}

              {activeView === 'planned' && (
                <PlannedMatchesView
                  plannedMatches={plannedMatchesSummary.active}
                  ignoredMatches={plannedMatchesSummary.ignored}
                  countriesById={countriesById}
                  selectedMatchId={selectedMatch?.id}
                  onOpenMatch={openMatchInPlanner}
                />
              )}

              {activeView === 'pricing' && (
                <PricingPanel
                  menuItems={menuItems}
                  updateMenuItem={updateMenuItem}
                  countries={COUNTRIES}
                  countriesById={countriesById}
                  drinksById={drinksById}
                  foodsById={foodsById}
                  selectedMatch={selectedMatch}
                />
              )}
            </main>

            <aside className="space-y-4">
              <Card className="h-fit p-4">
                <MatchCalendar
                  matches={MATCHES}
                  getPlan={getPlan}
                  selectedMatchId={selectedMatch?.id}
                  selectedDayKey={selectedDayKey}
                  onSelectMatch={toggleMatchSelection}
                  onSelectDay={toggleDaySelection}
                  monthDate={calendarMonth}
                  onChangeMonth={shiftCalendarMonth}
                />

                <div className="mb-4 flex items-center gap-2">
                  <Search size={18} />
                  <h2 className="text-base font-bold">Matches</h2>
                </div>
                <div className="space-y-3">
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                    placeholder="Search teams..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={countryFilter}
                      onChange={(event) => setCountryFilter(event.target.value)}
                    >
                      <option value="all">All countries</option>
                      {COUNTRIES.map((country) => (
                        <option key={country.id} value={country.id}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={stageFilter}
                      onChange={(event) => setStageFilter(event.target.value)}
                    >
                      <option value="all">All stages</option>
                      {stageOptions.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <select
                      className="col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                    >
                      <option value="all">All status</option>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4 max-h-[64vh] space-y-2 overflow-auto pr-1">
                  {filteredMatches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      plan={getPlan(match)}
                      countriesById={countriesById}
                      selected={selectedMatch?.id === match.id}
                      onSelect={() => toggleMatchSelection(match.id)}
                      onStatusChange={(status) => savePlan(match.id, { planningStatus: status })}
                    />
                  ))}
                  {!filteredMatches.length && <div className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">No matches match the current filters.</div>}
                </div>
              </Card>

              {(activeView === 'planner' || activeView === 'planned') && selectedDayKey && (
                <DaySchedulePanel
                  dayKey={selectedDayKey}
                  matches={matchesByDateKey[selectedDayKey]}
                  countriesById={countriesById}
                  getPlan={getPlan}
                  selectedMatchId={selectedMatch?.id}
                  onSelectMatch={toggleMatchSelection}
                />
              )}
            </aside>
          </div>

          {activeView === 'planner' && (
            <BulkPlanningActions
              countries={COUNTRIES}
              stageOptions={stageOptions}
              matches={MATCHES}
              countriesById={countriesById}
              getPlan={getPlan}
              feedback={bulkFeedback}
              onApplyBulk={bulkUpdatePlanningStatus}
            />
          )}

          {activeView === 'planner' &&
            (selectedMatch && selectedPlan ? (
              <section className="space-y-6">
                <Card className="p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <SlidersHorizontal size={18} />
                    <h2 className="font-bold">Consumption per guest</h2>
                  </div>
                  <div className="mb-3 text-xs text-slate-400">These settings apply to all matches</div>
                  <div className="grid gap-3 xl:grid-cols-4">
                    <NumberInput
                      label="Signature country drink"
                      value={rules.signatureCountryDrinkPerGuest}
                      onChange={(value) => setRules({ ...rules, signatureCountryDrinkPerGuest: value })}
                      suffix="per guest"
                    />
                    <NumberInput label="Beer" value={rules.beerPerGuest} onChange={(value) => setRules({ ...rules, beerPerGuest: value })} suffix="per guest" />
                    <NumberInput
                      label="Signature country food"
                      value={rules.signatureCountryFoodPerGuest}
                      onChange={(value) => setRules({ ...rules, signatureCountryFoodPerGuest: value })}
                      suffix="per guest"
                    />
                    <NumberInput
                      label="Generic food"
                      value={rules.genericFoodPerGuest}
                      onChange={(value) => setRules({ ...rules, genericFoodPerGuest: value })}
                      suffix="per guest"
                    />
                  </div>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)]">
                  <Card className="p-5">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                      <div>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <CalendarDays size={16} /> {miamiDateTime(selectedMatch.kickoffDateTime)} | {formatMatchStage(selectedMatch)}
                        </div>
                        <h2 className="mt-2 text-2xl font-black">
                          {countriesById[teamA]?.flag} {countriesById[teamA]?.name || teamA}{' '}
                          <span className="text-slate-400">vs</span> {countriesById[teamB]?.flag} {countriesById[teamB]?.name || teamB}
                        </h2>
                      </div>
                      <select
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={selectedPlan.planningStatus}
                        onChange={(event) => savePlan(selectedMatch.id, { planningStatus: event.target.value })}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-5 grid gap-4">
                      <NumberInput
                        label="Expected attendance"
                        helperText="Expected guests for this match"
                        value={selectedPlan.expectedAttendance}
                        onChange={(value) => savePlan(selectedMatch.id, { expectedAttendance: Math.max(0, Math.round(value)) })}
                        suffix="guests"
                        step={1}
                      />
                    </div>
                    <div className="mt-4">
                      <FanSplitControl
                        match={selectedMatch}
                        plan={selectedPlan}
                        countriesById={countriesById}
                        disabled={!selectedMatchResolved}
                        onChange={updateSplit}
                      />
                    </div>
                    {!selectedMatchResolved && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Teams not confirmed yet - revenue estimate disabled.
                      </div>
                    )}
                    <textarea
                      className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                      rows={2}
                      placeholder="Match notes..."
                      value={selectedPlan.notes || ''}
                      onChange={(event) => savePlan(selectedMatch.id, { notes: event.target.value })}
                    />
                  </Card>

                  <Card className="overflow-hidden">
                    <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center">
                      <div className="flex items-center gap-2">
                        <DollarSign size={18} />
                        <h2 className="font-bold">Estimated sales</h2>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center text-sm md:grid-cols-4">
                        <div className="rounded-xl bg-slate-100 p-3">
                          <div className="text-xs text-slate-500">Revenue</div>
                          <div className="text-lg font-black">{money(estimate.totals.revenue)}</div>
                        </div>
                        <div className="rounded-xl bg-slate-100 p-3">
                          <div className="text-xs text-slate-500">Cost</div>
                          <div className="font-black">{money(estimate.totals.cost)}</div>
                        </div>
                        <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
                          <div className="text-xs">Profit</div>
                          <div className="text-lg font-black">{money(estimate.totals.profit)}</div>
                        </div>
                        <div className="rounded-xl bg-slate-100 p-3">
                          <div className="text-xs text-slate-500">Margin</div>
                          <div className="font-black">{percent(estimate.totals.margin)}</div>
                        </div>
                      </div>
                    </div>
                    {estimate.totals.hasMissingPricing && (
                      <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
                        Some items don't have prices yet. Go to Menu & pricing to complete setup
                      </div>
                    )}
                    <div className="overflow-auto">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                          <tr>
                            <th className="p-3">Item</th>
                            <th className="p-3">Context</th>
                            <th className="p-3">Countries</th>
                            <th className="p-3 text-right">Units</th>
                            <th className="p-3 text-right">Sell</th>
                            <th className="p-3 text-right">Cost</th>
                            <th className="p-3 text-right">Profit</th>
                            <th className="p-3">Pricing</th>
                          </tr>
                        </thead>
                        <tbody>
                          {estimate.rows.length ? (
                            estimate.rows.map((row) => (
                              <tr key={`${row.kind}:${row.id}`} className="border-t border-slate-100">
                                <td className="p-3 font-semibold">{row.name}</td>
                                <td className="p-3 text-slate-500">{row.contextSummary || row.role}</td>
                                <td className="p-3 text-slate-500">{row.countries}</td>
                                <td className="p-3 text-right">{row.roundedUnits}</td>
                                <td className="p-3 text-right">{money(row.revenue)}</td>
                                <td className="p-3 text-right">{money(row.totalCost)}</td>
                                <td className="p-3 text-right font-bold">{money(row.profit)}</td>
                                <td className="p-3 text-xs text-amber-700">
                                  {row.missingMenuItem
                                    ? 'Missing menu item'
                                    : row.missingCost || row.missingSellPrice
                                      ? `Missing ${[row.missingCost ? 'cost' : '', row.missingSellPrice ? 'sell price' : ''].filter(Boolean).join(' and ')}`
                                      : 'OK'}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={8} className="p-6 text-center text-slate-500">
                                {selectedMatchResolved ? 'Add expected attendance to see estimates.' : selectedMatch ? 'Teams not confirmed yet - revenue estimate disabled.' : 'Select a match to see match-level estimates.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <CountryMiniCard country={countriesById[teamA]} drinksById={drinksById} foodsById={foodsById} brandsById={brandsById} />
                  <CountryMiniCard country={countriesById[teamB]} drinksById={drinksById} foodsById={foodsById} brandsById={brandsById} />
                </div>
              </section>
            ) : (
              <Card className="p-8">
                <div className="text-lg font-semibold text-slate-700">Select a match from the list to start planning</div>
                <div className="mt-2 text-sm text-slate-500">Planner inputs and estimated sales appear here after you choose a match.</div>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}
