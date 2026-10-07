/**
 * sites.js
 * Observing sites the tests run at, chosen to cover the cases the astronomy
 * code has to handle. timezone is the standard-time offset in hours and
 * timeZone the IANA name, as the app stores them; longitude is negative west.
 */

const SITES = {
    // Mid-latitude reference site; US daylight saving
    home:        { latitude: 39.291,  longitude: -78.197,  elevation: 233,  timezone: -5,  timeZone: 'America/New_York' },
    // Equator and prime meridian: zero values and the 0°/360° longitude wrap
    equator:     { latitude: 0,       longitude: 0,        elevation: 0,    timezone: 0,   timeZone: 'UTC' },
    // Southern hemisphere, east longitude, positive timezone
    capeTown:    { latitude: -33.92,  longitude: 18.42,    elevation: 10,   timezone: 2,   timeZone: 'Africa/Johannesburg' },
    // Just west of 0°, European daylight saving; no astronomical darkness mid-June
    london:      { latitude: 51.48,   longitude: -0.0005,  elevation: 46,   timezone: 0,   timeZone: 'Europe/London' },
    // Short summer nights that begin after clock midnight (solar midnight ~01:10 PDT)
    seattle:     { latitude: 47.61,   longitude: -122.33,  elevation: 50,   timezone: -8,  timeZone: 'America/Los_Angeles' },
    // No astronomical darkness for about two months around the June solstice
    helsinki:    { latitude: 60.17,   longitude: 24.94,    elevation: 20,   timezone: 2,   timeZone: 'Europe/Helsinki' },
    // Midnight sun and polar night
    tromso:      { latitude: 69.65,   longitude: 18.96,    elevation: 10,   timezone: 1,   timeZone: 'Europe/Oslo' },
    // Close to the date line, far negative longitude, high elevation
    maunaKea:    { latitude: 19.82,   longitude: -155.47,  elevation: 4205, timezone: -10, timeZone: 'Pacific/Honolulu' },
    // Southern sky: circumpolar and never-rising targets from the south
    cerroTololo: { latitude: -30.17,  longitude: -70.81,   elevation: 2207, timezone: -4,  timeZone: 'America/Santiago' },
};

module.exports = { SITES };
