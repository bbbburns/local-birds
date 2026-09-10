import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import type { Env } from './types';
import {
  getSightingsForDate,
  getSightedDatesInRange,
  getLatestPolledDate,
  getPollStatus,
  countUniqueSpeciesInRange,
  getCommentsForDate,
  getAllSpeciesMissingThumbnails,
  getStaleThumbnails,
  upsertSpeciesThumbnail,
} from './db';
import type { ThumbnailUpdate } from './types';
import { buildWeekGrid, todayEastern } from './calendarUtil';
import { runPoll } from './poller';
import { IndexPage } from './templates/Index';
import { WeekStrip } from './templates/WeekStrip';
import { SpeciesSummaryBar } from './templates/SpeciesSummaryBar';
import { DayDetail } from './templates/DayDetail';
import { HowItWorks } from './templates/HowItWorks';
import { HowToContribute } from './templates/HowToContribute';

const app = new Hono<{ Bindings: Env }>({ router: new RegExpRouter() });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderToString(element: JSX.Element): string {
  return element?.toString() ?? '';
}

function page(jsx: JSX.Element): string {
  return '<!DOCTYPE html>' + renderToString(jsx);
}

const DISPLAY_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatDisplayDate(isoDate: string): string {
  return DISPLAY_DATE_FMT.format(new Date(isoDate + 'T00:00:00Z'));
}

// Returns the ISO date string 6 days before the given anchor (the week window start).
function weekWindowStart(anchor: string): string {
  const d = new Date(anchor + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 6);
  return d.toISOString().slice(0, 10);
}

// Returns true for well-formed YYYY-MM-DD calendar dates.
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
}

// Clamp a date string to today if it's in the future.
function clampToToday(isoDate: string, today: string): string {
  return isoDate > today ? today : isoDate;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/', async (c) => {
  const today = todayEastern();
  const windowStart = weekWindowStart(today);

  const [sightedDates, todaySightings, latest, pollStatus, speciesCount] = await Promise.all([
    getSightedDatesInRange(c.env.DB, windowStart, today),
    getSightingsForDate(c.env.DB, today),
    getLatestPolledDate(c.env.DB),
    getPollStatus(c.env.DB),
    countUniqueSpeciesInRange(c.env.DB, windowStart, today),
  ]);

  const weekGrid = buildWeekGrid(today, sightedDates);
  const hasTodaySightings = todaySightings.length > 0;

  return c.html(
    page(
      <IndexPage
        weekGrid={weekGrid}
        sightings={hasTodaySightings ? todaySightings : null}
        initialDate={hasTodaySightings ? today : null}
        displayDate={hasTodaySightings ? formatDisplayDate(today) : null}
        pollStatus={pollStatus}
        latest={latest}
        speciesCount={speciesCount}
      />
    )
  );
});

app.get('/week/:anchor', async (c) => {
  const today = todayEastern();
  const rawAnchor = c.req.param('anchor');
  if (!isValidDate(rawAnchor)) return c.text('Invalid date', 400);
  const anchor = clampToToday(rawAnchor, today);

  const windowStartStr = weekWindowStart(anchor);
  const [sightedDates, speciesCount] = await Promise.all([
    getSightedDatesInRange(c.env.DB, windowStartStr, anchor),
    countUniqueSpeciesInRange(c.env.DB, windowStartStr, anchor),
  ]);

  const weekGrid = buildWeekGrid(anchor, sightedDates);
  return c.html(renderToString(
    <>
      <WeekStrip weekGrid={weekGrid} />
      <SpeciesSummaryBar weekGrid={weekGrid} speciesCount={speciesCount} />
    </>
  ));
});

app.get('/day/:obsDate', async (c) => {
  const obsDate = c.req.param('obsDate');
  if (!isValidDate(obsDate)) return c.text('Invalid date', 400);
  const [sightings, comments] = await Promise.all([
    getSightingsForDate(c.env.DB, obsDate),
    getCommentsForDate(c.env.DB, obsDate),
  ]);
  return c.html(
    renderToString(
      <DayDetail sightings={sightings} displayDate={formatDisplayDate(obsDate)} comments={comments} />
    )
  );
});

app.post('/admin/poll', async (c) => {
  const auth = c.req.header('Authorization');
  if (!auth || auth !== `Bearer ${c.env.POLL_SECRET}`) {
    return c.text('Unauthorized', 401);
  }
  try {
    await runPoll(c.env, { verbose: true });
  } catch (err) {
    console.error('Unexpected error in /admin/poll', err);
    return c.text('Poll failed', 500);
  }
  return c.redirect('/');
});

app.get('/admin/thumbnails/pending', async (c) => {
  const auth = c.req.header('Authorization');
  if (!auth || auth !== `Bearer ${c.env.POLL_SECRET}`) {
    return c.text('Unauthorized', 401);
  }
  const [missing, stale] = await Promise.all([
    getAllSpeciesMissingThumbnails(c.env.DB),
    getStaleThumbnails(c.env.DB),
  ]);
  const speciesCodes = [...new Set([...missing, ...stale])];
  return c.json({ species_codes: speciesCodes });
});

app.post('/admin/thumbnails', async (c) => {
  const auth = c.req.header('Authorization');
  if (!auth || auth !== `Bearer ${c.env.POLL_SECRET}`) {
    return c.text('Unauthorized', 401);
  }
  let body: { updates?: ThumbnailUpdate[] };
  try {
    body = await c.req.json();
  } catch {
    return c.text('Invalid JSON', 400);
  }
  const updates = body.updates ?? [];
  let updated = 0;
  for (const u of updates) {
    if (!u.species_code || u.thumbnail_url === null) continue;
    await upsertSpeciesThumbnail(c.env.DB, u.species_code, u.thumbnail_url);
    updated++;
  }
  return c.json({ updated });
});

app.get('/health', async (c) => {
  try {
    await c.env.DB.prepare('SELECT 1').first();
    return c.json({ status: 'ok' }, 200);
  } catch (err) {
    console.error('Health check DB failure', err);
    return c.json({ status: 'error', error: 'db_unavailable' }, 503);
  }
});

app.get('/how-it-works', (c) => c.html(page(<HowItWorks />)));
app.get('/how-to-contribute', (c) => c.html(page(<HowToContribute />)));

export default app;
