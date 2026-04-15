import app from './routes';
import { runPoll } from './poller';
import type { Env } from './types';

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    try {
      await runPoll(env);
    } catch (err) {
      console.error('Unexpected error in scheduled poll', err);
    }
  },
};
