# Open Retirement Toolkit

A private, local-first retirement planning app. It runs entirely in your browser, requires no account, and keeps scenarios on your device unless you explicitly export them.

This project is an independent open-source toolkit inspired by the need for transparent, reproducible financial simulations. It is not affiliated with Honest Math.

## Current vertical slice

- Deterministic, seeded Normal Monte Carlo, historical moving-block bootstrap, Student's t, and fixed-age stress models
- Monthly accumulation and retirement cash flows
- Inflation, retirement income, and simplified effective tax assumptions
- Named Social Security, pension, and other income streams with timing, growth, and taxable share
- One-time inflation-adjustable expenses for medical costs and major purchases
- 10th, 50th, and 90th percentile projections
- Named scenarios, autosave, duplication, comparison, and deletion
- JSON backup import/export, CSV export, and printable reports
- IndexedDB persistence, installable PWA shell, and offline caching
- No authentication, telemetry, or third-party runtime services

Results are conditional model estimates, not forecasts or financial advice.

Within each month, the engine applies the market return and optional stress overlay, recurring contributions or retirement cash flow, then one-time expenses. Taxes remain a simplified effective-rate model.

### Historical CSV format

Historical bootstrap data is imported and stored locally with its scenario. Use consecutive monthly rows and decimal rates:

```csv
date,portfolio_return,inflation
2000-01,0.02,0.002
2000-02,-0.01,0.001
```

The toolkit does not bundle market history until redistribution rights and transformations are documented. Imported datasets need at least as many rows as the selected 12, 24, or 60 month block length.

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

Run the full local CI-equivalent verification, including enforced coverage thresholds, statistical checks, a 10,000-trial performance smoke test, type checking, and the production build:

```bash
npm run verify
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

### Student's t calibration

Student's t is an advanced portfolio-wide model with 3, 5, 8, and 30 degree-of-freedom presets. The expected return input is treated as an annual arithmetic mean divided by 12. Annual volatility is divided by the square root of 12, and t samples are scaled by `sqrt((df - 2) / df)` to preserve that configured variance. Returns below -100% deplete the portfolio at the wealth layer.

## Roadmap

Later candidates include Laplace, historical IID bootstrap, asset-level allocation, richer income timelines, depletion analysis, real-dollar views, and stronger backup workflows.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
