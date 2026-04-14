import { Base } from './Base';

export function HowItWorks() {
  return (
    <Base>
      <h2 style="margin-bottom:1rem;color:#2d5a27;">How It Works</h2>
      <div id="day-detail">
        <h2>What this site shows</h2>
        <p style="margin-bottom:1rem;">
          This site tracks bird sightings reported at <strong>Durham Central Park</strong> in
          Durham, NC. It pulls data automatically from{' '}
          <a href="https://ebird.org" target="_blank" rel="noopener">eBird</a>, the citizen
          science platform run by the Cornell Lab of Ornithology, and displays any species
          observed within walking distance of the park.
        </p>

        <h2 style="margin-top:1.5rem;">Polling location &amp; radius</h2>
        <p style="margin-bottom:0.5rem;">
          Sightings are fetched for all observations within <strong>2 km</strong> of the center
          of Durham Central Park:
        </p>
        <ul style="margin-left:1.5rem;margin-bottom:1rem;line-height:1.8;">
          <li>Latitude: 36.0005° N</li>
          <li>Longitude: 78.9002° W</li>
        </ul>
        <p style="margin-bottom:1rem;">
          This circle covers Durham Central Park and immediately surrounding streets. Sightings
          reported a bit further away — across the road, in a nearby yard — may be included if
          the observer's reported location falls within 2 km.
        </p>

        <h2 style="margin-top:1.5rem;">How often we poll</h2>
        <p style="margin-bottom:1rem;">
          The site checks eBird <strong>once per hour</strong>, every hour of the day. Sightings
          submitted to eBird within the last few minutes may not appear until the next hourly
          refresh. Sometimes not until later in the day depending on eBird. I have no idea why
          this takes so long sometimes. The footer of the main page shows the time of the most
          recent successful poll.
        </p>

        <h2 style="margin-top:1.5rem;">What data we collect</h2>
        <p style="margin-bottom:0.5rem;">Each poll fetches two things from the eBird API:</p>
        <ol style="margin-left:1.5rem;margin-bottom:1rem;line-height:1.8;">
          <li>
            <strong>Recent observations</strong> — all species reported in the area over the
            past 14 days, including provisional (unreviewed) sightings.
          </li>
          <li>
            <strong>Notable sightings</strong> — species flagged by eBird as rare or unusual
            for this location and time of year. These are highlighted with a{' '}
            <span style="color:#c07800;border:1px solid #c07800;border-radius:3px;padding:0 3px;font-size:0.85em;">
              rare
            </span>{' '}
            badge on the site.
          </li>
        </ol>
        <p style="margin-bottom:1rem;">
          Species photos come from the{' '}
          <a href="https://www.macaulaylibrary.org/" target="_blank" rel="noopener">
            Macaulay Library
          </a>{' '}
          and are cached locally. Cached photos are refreshed every 30 days.
        </p>

        <h2 style="margin-top:1.5rem;">Data storage</h2>
        <p>
          Sightings are stored in a local database. Duplicate submissions from multiple
          observers are deduplicated by species per day.
        </p>
      </div>
      <p style="margin-top:1.5rem;">
        <a href="/" style="color:#2d5a27;">← Back to sightings</a>
      </p>
    </Base>
  );
}
