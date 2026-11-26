# JiZhengZhiXing (吉政知行)

**[简体中文](README.md) | English**

A student-developed, early-stage AI assistant for tourism planning and public-service navigation in Jilin, China. The project explores how a grounded agent can turn a natural-language request into useful, source-backed guidance rather than unsupported chatbot answers.

## What is in this repository?

- **Travel planning:** structured intent parsing, retrieval and ranking, itinerary assembly, optional model-assisted wording, and output validation. A deterministic fallback keeps the travel planner useful without a model.
- **Public-service navigation:** restricted tools search service guides and locate verified official portals; policy summaries link back to original documents.
- **Local workspaces:** tourist, merchant and administrative demonstrations share browser-local data. They do not provide verified identities, government approvals or cross-device synchronization.
- **Mobile preview:** a separate Cloudflare Worker, mobile web interface and Android shell. The mobile API requires an access code and uses rate limiting.

The structured tourism dataset includes 40 attractions, 12 routes, 12 seasonal entries and 8 official portals. These are repository dataset counts, not adoption metrics. Prices, opening hours and booking availability must be verified against official sources.

## Architecture

| Path | Responsibility |
| --- | --- |
| `src/worker.mjs` | Web Worker API |
| `src/agent.mjs`, `src/knowledge.mjs` | Restricted service tools and knowledge |
| `src/wenlv/` | Intent, retrieval, itinerary, data and guardrails |
| `src/mobile-worker.mjs` | Independent mobile API |
| `public/`, `mobile/site/`, `mobile/android/` | Web UI, mobile UI and Android shell |
| `tests/`, `scripts/` | Regression tests and development utilities |

## Getting started

Use Git and Node.js 22 (the version used in the regression workflow).

```bash
git clone https://github.com/zzq778/-.git
cd ./-
npm run build:mobile
npm test
node scripts/wenlv-plan.mjs "两天冬天带孩子去哪" --check
```

These tests and the deterministic planning script do not require model credentials. Live inference and deployment require a separately configured Cloudflare environment. See [mobile deployment](docs/MOBILE_DEPLOYMENT.md) and the [Chinese README](README.md) for detailed setup and feature boundaries.

## Development status and responsible use

This is an independently developed preview, not an official government service or a production booking system. The package manifest identifies version 0.9.0; the mobile API source identifies 0.9.7. These are code version markers, not release or deployment guarantees. See the [Web candidate record](docs/WENLV_PRODUCT_V080.md) and [mobile product record](docs/MOBILE_PRODUCT_V097.md). Test, live-model and device acceptance must be distinguished.

Travel suggestions are not real-time navigation or reservation guarantees. Do not enter actual identity documents, credentials or other sensitive data into the demo.

## Contributing and licensing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). The repository is publicly visible; no repository-wide license is currently specified. Public visibility alone does not grant permission to redistribute or relicense the code or assets. A license requires agreement from the relevant rights holders.
