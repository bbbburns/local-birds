import type { Sighting } from '../types';

export function DayDetail({
  sightings,
  displayDate,
}: {
  sightings: Sighting[];
  displayDate: string;
}) {
  return (
    <>
      <h2>{displayDate}</h2>
      {sightings.length > 0 ? (
        <>
          <ul class="sighting-list">
            {sightings.map((s) => (
              <li class={`sighting-row${s.notable ? ' sighting-notable' : ''}`}>
                <div class="sighting-thumb">
                  {s.thumbnail_url ? (
                    <a
                      href={`https://ebird.org/species/${s.species_code}`}
                      target="_blank"
                      rel="noopener"
                    >
                      <img
                        src={s.thumbnail_url}
                        alt={s.common_name}
                        width="52"
                        height="52"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <div class="thumb-placeholder" />
                  )}
                </div>
                <div class="sighting-info">
                  <a
                    class="species-link"
                    href={`https://ebird.org/species/${s.species_code}`}
                    target="_blank"
                    rel="noopener"
                  >
                    {s.common_name}
                  </a>
                  <span class="sci">{s.sci_name}</span>
                  {s.how_many != null && (
                    <span class="count">×{s.how_many}</span>
                  )}
                  {!!s.notable && <span class="rare-badge">★ Rare</span>}
                  {!s.obs_valid && <span class="provisional">provisional</span>}
                </div>
                {s.sub_id && (
                  <a
                    class="checklist-link"
                    href={`https://ebird.org/checklist/${s.sub_id}`}
                    target="_blank"
                    rel="noopener"
                    title="View checklist on eBird"
                  >
                    <span class="link-full">✓ eBird checklist ↗</span>
                    <span class="link-icon">↗</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p class="meta">{sightings.length} species recorded</p>
          <p class="meta legend">Select a bird name for photos and details on eBird.org</p>
        </>
      ) : (
        <p class="no-sightings">No birds were spotted on this date.</p>
      )}
    </>
  );
}
