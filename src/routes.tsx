import { Hono } from 'hono';
import { renderToString } from 'hono/jsx/dom/server';
import type { Env } from './types';
import {
  getSightingsForDate,
  getSightedDatesInRange,
  getLatestPolledDate,
  getPollStatus,
} from './db';
import { buildWeekGrid, todayEastern } from './calendarUtil';
import { runPoll } from './poller';
import { IndexPage } from './templates/Index';
import { WeekStrip } from './templates/WeekStrip';
import { DayDetail } from './templates/DayDetail';
import { HowItWorks } from './templates/HowItWorks';
import { HowToContribute } from './templates/HowToContribute';

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function page(jsx: Parameters<typeof renderToString>[0]): string {
  return '<!DOCTYPE html>' + renderToString(jsx);
}

function formatDisplayDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(isoDate + 'T00:00:00Z'));
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
  const sixDaysAgo = new Date(today + 'T12:00:00Z');
  sixDaysAgo.setUTCDate(sixDaysAgo.getUTCDate() - 6);
  const windowStart = sixDaysAgo.toISOString().slice(0, 10);

  const [sightedDates, todaySightings, latest, pollStatus] = await Promise.all([
    getSightedDatesInRange(c.env.DB, windowStart, today),
    getSightingsForDate(c.env.DB, today),
    getLatestPolledDate(c.env.DB),
    getPollStatus(c.env.DB),
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
      />
    )
  );
});

app.get('/week/:anchor', async (c) => {
  const today = todayEastern();
  const anchor = clampToToday(c.req.param('anchor'), today);

  const anchorDate = new Date(anchor + 'T12:00:00Z');
  const windowStart = new Date(anchorDate);
  windowStart.setUTCDate(anchorDate.getUTCDate() - 6);

  const sightedDates = await getSightedDatesInRange(
    c.env.DB,
    windowStart.toISOString().slice(0, 10),
    anchor
  );

  const weekGrid = buildWeekGrid(anchor, sightedDates);
  return c.html(renderToString(<WeekStrip weekGrid={weekGrid} />));
});

app.get('/day/:obsDate', async (c) => {
  const obsDate = c.req.param('obsDate');
  const sightings = await getSightingsForDate(c.env.DB, obsDate);
  return c.html(
    renderToString(
      <DayDetail sightings={sightings} displayDate={formatDisplayDate(obsDate)} />
    )
  );
});

app.post('/admin/poll', async (c) => {
  const auth = c.req.header('Authorization');
  if (!auth || auth !== `Bearer ${c.env.POLL_SECRET}`) {
    return c.text('Unauthorized', 401);
  }
  await runPoll(c.env);
  return c.redirect('/');
});

app.get('/how-it-works', (c) => c.html(page(<HowItWorks />)));
app.get('/how-to-contribute', (c) => c.html(page(<HowToContribute />)));

export default app;
