import type { Child } from 'hono/jsx';

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #f5f5f0;
    color: #222;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
  }

  header {
    background: #2d5a27;
    color: #fff;
    padding: 1.25rem 1.5rem;
  }
  .header-inner { display: flex; align-items: center; gap: 1rem; }
  .header-cardinal { height: 60px; width: 50px; flex-shrink: 0; }
  .header-nav { margin-left: auto; display: flex; gap: 1rem; flex-shrink: 0; }
  .header-nav a { color: #fff; text-decoration: none; font-size: 1rem; font-weight: 500; white-space: nowrap; }
  .header-nav a:hover { text-decoration: underline; }
  header h1 { font-size: 1.4rem; font-weight: 600; }
  header p { font-size: 1rem; opacity: 0.8; margin-top: 0.2rem; }

  main {
    max-width: 760px;
    width: 100%;
    margin: 2rem auto;
    padding: 0 1rem;
    flex: 1;
  }

  .banner {
    background: #fff8e1;
    border: 1px solid #f0c040;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    margin-bottom: 1.5rem;
    font-size: 1rem;
  }

  /* Week strip */
  #week-strip-container { margin-bottom: 1.5rem; }

  .week-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .week-label { flex: 1; text-align: center; font-size: 1rem; color: #555; }
  .nav-right { display: flex; gap: 4px; }
  .nav-btn {
    background: #2d5a27;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 0.25rem 0.6rem;
    cursor: pointer;
    font-size: 1rem;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .nav-btn:hover { background: #3d7a36; }
  .nav-btn:disabled { background: #ccc; cursor: default; }

  .week-cells {
    display: flex;
    gap: 4px;
  }
  .week-day {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 2px;
    border-radius: 6px;
    background: #fff;
    border: 1px solid #eee;
    color: #555;
    user-select: none;
  }
  .week-day.has-data {
    background: #e8f5e2;
    color: #1a3d15;
    cursor: pointer;
    font-weight: 600;
    border-color: #c8e6c0;
  }
  .week-day.has-data:hover { background: #c8e6c0; }
  .week-day.is-today { border: 2px solid #2d5a27; }
  .week-day.has-data-today { cursor: pointer; }
  .week-day.has-data-today:hover { background: #f0f0eb; }
  .week-day.is-selected,
  .week-day.is-selected:hover { background: #2d5a27; color: #fff; border-color: #2d5a27; }
  .week-day.is-selected .week-day-name { color: #fff; }
  .week-day.is-future { color: #999; }
  .week-day-name { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .week-day-num { font-size: 1rem; margin-top: 2px; font-variant-numeric: tabular-nums; }

  /* Day detail */
  #day-detail {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
    padding: 1.25rem 1.5rem;
    min-height: 60px;
  }
  #day-detail h2 { font-size: 1.2rem; margin-bottom: 0.75rem; color: #2d5a27; }
  ul.sighting-list { list-style: none; }
  li.sighting-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f0f0f0;
  }
  li.sighting-row:last-child { border-bottom: none; }
  .sighting-thumb { flex-shrink: 0; }
  .sighting-thumb img {
    width: 52px;
    height: 52px;
    object-fit: cover;
    border-radius: 4px;
    display: block;
  }
  .thumb-placeholder {
    width: 52px;
    height: 52px;
    border-radius: 4px;
    background: #eee;
  }
  .sighting-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }
  a.species-link {
    font-weight: 600;
    color: #1a3d15;
    text-decoration: none;
    font-size: 1rem;
  }
  a.species-link:hover { text-decoration: underline; }
  .sci { color: #666; font-style: italic; font-size: 0.875rem; }
  .count { color: #555; font-size: 0.875rem; }
  .provisional {
    display: inline-block;
    color: #c07800;
    font-size: 0.8rem;
    border: 1px solid #c07800;
    border-radius: 3px;
    padding: 0 3px;
  }
  a.checklist-link {
    flex-shrink: 0;
    font-size: 0.8rem;
    color: #2d5a27;
    text-decoration: none;
    opacity: 0.7;
  }
  a.checklist-link:hover { opacity: 1; text-decoration: underline; }
  #day-detail .meta { margin-top: 0.75rem; font-size: 0.875rem; color: #666; }
  #day-detail .legend { margin-top: 0.25rem; font-style: italic; }

  footer {
    text-align: center;
    padding: 1.5rem;
    font-size: 0.875rem;
    color: #666;
  }
  footer a { color: #2d5a27; }
  .poll-status { margin-top: 0.4rem; font-size: 0.875rem; }
  .poll-ok { color: #2d5a27; }
  .poll-fail { color: #b00; }

  .today-btn { font-size: 0.875rem; padding: 0.25rem 0.75rem; }

  .htmx-indicator { display: none; }
  .htmx-request .htmx-indicator,
  .htmx-request.htmx-indicator { display: flex; }
  .loading-spinner {
    position: absolute;
    inset: 0;
    align-items: center;
    justify-content: center;
    background: rgba(255,255,255,0.75);
    border-radius: 8px;
    color: #666;
    font-size: 0.9rem;
    z-index: 1;
  }

  .error-banner {
    background: #fdecea;
    border: 1px solid #e57373;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    font-size: 0.9rem;
    color: #b00;
    display: none;
  }

  li.sighting-notable {
    background: #fff8e1;
    border-radius: 6px;
    margin: 0 -0.5rem;
    padding: 0.5rem;
  }
  .rare-badge {
    display: inline-block;
    font-size: 0.8rem;
    color: #c07800;
    border: 1px solid #c07800;
    border-radius: 3px;
    padding: 0 4px;
    margin-left: 0.4rem;
    vertical-align: middle;
  }

  .no-sightings { color: #666; font-size: 0.9rem; }

  @media (pointer: coarse) {
    .nav-btn {
      padding: 0.6rem 1.25rem;
      min-height: 44px;
    }
    .week-day {
      padding: 10px 2px;
    }
    a.checklist-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
    }
    .today-btn {
      padding: 0.6rem 1rem;
    }
  }

  .day-short { display: none; }
  .link-icon  { display: none; }

  @media (max-width: 600px) {
    header { padding: 0.75rem 1rem; }
    .header-inner { flex-wrap: wrap; }
    .header-cardinal { height: 40px; width: 33px; }
    header h1 { font-size: 1.1rem; }
    header p { font-size: 0.875rem; }
    .header-nav {
      width: 100%;
      margin-left: 0;
      justify-content: center;
      padding-top: 0.5rem;
      margin-top: 0.25rem;
      border-top: 1px solid rgba(255,255,255,0.2);
      gap: 1.5rem;
    }

    main { margin: 1rem auto; }
    #day-detail { padding: 1rem; }
    .poll-status { line-height: 1.8; }

    .week-day-name { font-size: 0.75rem; }
    .day-full  { display: none; }
    .day-short { display: inline; }

    .link-full { display: none; }
    .link-icon { display: inline; }
  }

  @media (max-width: 380px) {
    li.sighting-row { gap: 0.5rem; }
    .sighting-thumb img, .thumb-placeholder { width: 44px; height: 44px; }
  }
`;

const HTMX_ERROR_SCRIPT = `
  document.body.addEventListener('htmx:responseError', function() {
    var el = document.getElementById('htmx-error');
    if (el) { el.style.display = 'block'; }
  });
  document.body.addEventListener('htmx:beforeRequest', function() {
    var el = document.getElementById('htmx-error');
    if (el) { el.style.display = 'none'; }
  });
`;

export function Base({
  children,
  footerExtra,
}: {
  children: Child;
  footerExtra?: Child;
}) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Durham Central Park — Bird Sightings</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <script src="/htmx.min.js" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <header>
          <div class="header-inner">
            <a href="/" style="display:flex;align-items:center;gap:1rem;text-decoration:none;color:inherit;">
              <img src="/cardinal.svg" alt="Red Cardinal" class="header-cardinal" />
              <div>
                <h1>Durham Central Park — Bird Sightings</h1>
                <p>Durham, NC · Powered by eBird</p>
              </div>
            </a>
            <nav class="header-nav">
              <a href="/how-it-works">How It Works</a>
              <a href="/how-to-contribute">How to Contribute</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer>
          Bird data provided by{' '}
          <a href="https://ebird.org" target="_blank" rel="noopener">eBird</a>,
          a citizen science program of the{' '}
          <a href="https://www.birds.cornell.edu" target="_blank" rel="noopener">Cornell Lab of Ornithology</a>.
          {footerExtra}
        </footer>
        <script dangerouslySetInnerHTML={{ __html: HTMX_ERROR_SCRIPT }} />
      </body>
    </html>
  );
}
