// Give the cloudflare:test `env` (typed as Cloudflare.Env) the Worker's bindings.
import type { Env as WorkerEnv } from '../src/types';

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {}
  }
}
