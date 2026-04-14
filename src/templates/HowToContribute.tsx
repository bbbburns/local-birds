import { Base } from './Base';

export function HowToContribute() {
  return (
    <Base>
      <h2 style="margin-bottom:1rem;color:#2d5a27;">How to Contribute</h2>
      <div id="day-detail">
        <p style="margin-bottom:1.5rem;">
          This site is only as good as the sightings people report. If you see a bird at
          Durham Central Park, submitting a checklist to eBird takes about two minutes and
          your observation will appear here later that day.
        </p>

        <h2>Submit via the eBird Mobile App</h2>
        <p style="margin-bottom:0.75rem;">
          The eBird app (free for{' '}
          <a href="https://apps.apple.com/us/app/ebird/id988799279" target="_blank" rel="noopener">
            iOS
          </a>{' '}
          and{' '}
          <a
            href="https://play.google.com/store/apps/details?id=edu.cornell.birds.ebird"
            target="_blank"
            rel="noopener"
          >
            Android
          </a>
          ) is the easiest way to log sightings in the field.
        </p>
        <ol style="margin-left:1.5rem;margin-bottom:1.5rem;line-height:2;">
          <li>Open the app and tap <strong>Start a checklist</strong>.</li>
          <li>
            For location, search for <strong>Durham Central Park</strong> or use your GPS if
            you're already there.
          </li>
          <li>
            Choose your observation type — <em>Traveling</em> if you walked around,{' '}
            <em>Stationary</em> if you stayed in one spot.
          </li>
          <li>Add each species you observed and the count (or tap "X" if you didn't count).</li>
          <li>
            Tap <strong>Submit</strong> when you're done. Your checklist is live on eBird
            immediately.
          </li>
        </ol>

        <h2>Submit via eBird.org</h2>
        <p style="margin-bottom:0.75rem;">
          If you prefer a browser, you can submit directly on the eBird website.
        </p>
        <ol style="margin-left:1.5rem;margin-bottom:1.5rem;line-height:2;">
          <li>
            Go to{' '}
            <a href="https://ebird.org/submit" target="_blank" rel="noopener">
              ebird.org/submit
            </a>{' '}
            and sign in (create a free account if you don't have one).
          </li>
          <li>
            Click <strong>Start a checklist</strong> and search for the location{' '}
            <strong>Durham Central Park, Durham, NC</strong>.
          </li>
          <li>Enter your observation date, time, and duration.</li>
          <li>
            Add each species you saw. You can search by common name or scientific name.
          </li>
          <li>Click <strong>Submit checklist</strong>.</li>
        </ol>

        <h2>Tips for a good checklist</h2>
        <ul style="margin-left:1.5rem;margin-bottom:1.5rem;line-height:2;">
          <li>
            Submit a <strong>complete checklist</strong> (reporting all species you detected)
            rather than just incidental sightings — it's more valuable to science and more
            likely to be verified quickly.
          </li>
          <li>Include a count for each species, even an approximate one.</li>
          <li>
            Add a note or photo for any unusual species — this helps eBird reviewers confirm
            rare sightings faster, and they'll show up with the{' '}
            <span style="color:#c07800;border:1px solid #c07800;border-radius:3px;padding:0 3px;font-size:0.85em;">
              rare
            </span>{' '}
            badge here sooner.
          </li>
          <li>Sightings appear on this site usually later in the same day of submission.</li>
        </ul>

        <h2>New to birding?</h2>
        <p>
          The{' '}
          <a href="https://merlin.allaboutbirds.org/" target="_blank" rel="noopener">
            Merlin Bird ID app
          </a>{' '}
          (also free, from Cornell) can help you identify what you're seeing and hearing. It
          works well alongside eBird.
        </p>
      </div>
      <p style="margin-top:1.5rem;">
        <a href="/" style="color:#2d5a27;">← Back to sightings</a>
      </p>
    </Base>
  );
}
