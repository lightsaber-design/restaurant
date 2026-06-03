# SavvyFoodie

Smart restaurant finder prototype that uses real Google Places restaurant data inside the app and opens Google Maps for place details or routes.

## Run

Open `index.html` in a browser.

Install frontend build tooling once:

```bash
npm install
```

For local frontend development:

```bash
npm run server
npm run dev
```

Then open `http://127.0.0.1:5173/`.

For a production-style local build:

```bash
npm run build
npm run server
```

Then open `http://127.0.0.1:4173/`.

For real Google Maps restaurant names, run the included proxy with a Google Maps Places API key:

```bash
$env:GOOGLE_MAPS_API_KEY="your_google_maps_api_key"
node server.mjs
```

Then open `http://127.0.0.1:4173/`.

## Notes

- Restaurant results are loaded from Google Places through `server.mjs` when `GOOGLE_MAPS_API_KEY` is set.
- The app no longer invents restaurant names when Google Places is unavailable; it shows a configuration message and a Google Maps link instead.
- SavvyFoodie keeps discovery inside the app, then opens Google Maps only for the official place page or route.
- The Google Maps API key stays on the server. Do not ship it inside the mobile app.
- The Google Places field mask intentionally avoids expensive fields such as rating, opening hours, and reservable status for the MVP.
- Google Places does not provide complete menu item prices. For food-level prices, connect restaurant-owned menus, reservation/menu APIs, or another approved provider and merge those records with Places IDs.
- The backend includes short-lived query caching and basic per-IP rate limiting to control API cost.
- The frontend includes saved favorites, location-aware history, distance filtering, ranked results, a map view, restaurant details, and a Google Maps handoff setting.
- Run backend utility tests with `node --test tests/server-utils.test.mjs`.
- Run TypeScript checks with `npm run check`.
- Frontend source is now organized under `src/` and built by Vite with hashed production assets.
- Public PWA assets live in `public/`.
- Location autocomplete currently uses OpenStreetMap Nominatim as a prototype geocoder. The app throttles requests, caches repeated queries, and shows attribution. For a Play Store release, replace it with a production geocoding provider or your own backend because public geocoding services have usage limits and policy requirements.

## Path to Play Store

This project starts as a PWA so it can later be packaged for Android without rebuilding the product.

Recommended scaling path:

1. Keep the web app mobile-first and installable with `manifest.webmanifest` and `sw.js`.
2. Keep the Google Places proxy/backend as the only component that talks to Google APIs, so API keys and cost controls stay server-side.
3. Add provider connectors for approved data sources such as Google Places, restaurant-owned menus, reservation APIs, and internal scraped data only where legally allowed.
4. Package for Android with Capacitor if native features are needed, or Trusted Web Activity if the app remains mostly web-based.
5. Add production requirements before Play Store release: privacy policy, location permission explanation, app icon set, crash analytics, offline fallback, and data-source attribution.
