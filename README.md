# Open Retirement Toolkit

A private, local-first retirement planning app. It runs entirely in your browser, requires no account, and keeps scenarios on your device unless you explicitly export them.

This project is an independent open-source toolkit inspired by the need for transparent, reproducible financial simulations. It is not affiliated with Honest Math.

## Current vertical slice

- Deterministic and seeded Normal Monte Carlo return models
- Monthly accumulation and retirement cash flows
- Inflation, retirement income, and simplified effective tax assumptions
- 10th, 50th, and 90th percentile projections
- Named scenarios, autosave, duplication, comparison, and deletion
- JSON backup import/export, CSV export, and printable reports
- IndexedDB persistence, installable PWA shell, and offline caching
- No authentication, telemetry, or third-party runtime services

Results are conditional model estimates, not forecasts or financial advice.

## Run locally

Install [Node.js 22](https://nodejs.org/) or newer.

```bash
npm install
npm run dev
```

The first command downloads the development tools. The second starts a local web server and prints the address to open.

Run the automated calculation checks:

```bash
npm test
```

Create the production site:

```bash
npm run build
```

The finished static files appear in `dist/`.

## GitHub Pages

The included workflow tests and publishes `main` to GitHub Pages. In the repository, choose **Settings → Pages → Source → GitHub Actions** once. After this pull request is merged, the expected URL is:

https://williamxleismer.github.io/open-retirement-toolkit/

GitHub Pages hosts the application files. Financial scenarios remain in each user's browser storage.

## Roadmap

The model architecture will expand to Student's t, Laplace, historical IID bootstrap, and block bootstrap models after the core engine is independently validated. Scenario management and reporting will also receive richer comparison and migration support.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
