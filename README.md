# AL-1S

A synthetic information-disclosure decoy for Node.js and Cloudflare Workers. It serves fabricated data at 394 known probe paths. Only the route manifest is included; no original logs, tokens or real configuration are committed.

## Run locally

Requires Node.js 22 or newer. The server has no runtime dependencies.

```sh
npm start
```

Listens at `http://127.0.0.1:3000`; override the port with `PORT`.

## Cloudflare Workers

```sh
npm ci
cf auth login
npm run dev
npm run build
npm run deploy
```

The scripts use the **cf CLI** with `cloudflare.config.ts` and `vite.config.js`. The Worker is named `al-1s`; no production domain or route is configured automatically.

For Cloudflare Workers Builds (Git integration), use these settings:

- Root directory: `/`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Non-production deploy command: `npx wrangler versions upload`

`wrangler.jsonc` supports the Git integration's default Wrangler workflow. Both configurations deploy `src/index.js` with Node.js compatibility. The fetch handler handles unmatched paths directly, without a static-file or SPA fallback.

## Responses

- Matched GETs return at least **128 KiB** of fresh synthetic content in the requested format, including structured configuration, logs, keys, archives and databases. All credential-like values are fabricated; compact formats may be oversized and unusable as real credentials or metadata.
- `/AGENTS.md`, `/CLAUDE.md` and `/README.md` return exactly **1 MiB of random emoji**.
- `/robots.txt` returns only `User-agent: *` and `Disallow: /` with HTTP 200.
- `/favicon.ico` serves a poop emoji icon; `/livewire/livewire.js` serves fresh synthetic JavaScript.
- Unmatched paths, including `/`, return HTTP **404** with an approximately **32 KiB** nginx/Apache-style directory listing. Randomized links stay within unmatched `/archive/...` paths and also return 404.
- Responses use `Cache-Control: no-store`. HEAD returns headers without a body; matched paths reject other methods with 405. Query strings do not affect route matching.

Generation runs locally without reading secrets, bindings, request bodies or upstream services. ZIP and tar.gz responses are real archives containing fabricated files. The SQLite template contains invented rows. Hostnames use reserved `.invalid` names except for recognizable service-account format fields.

## Verification

```sh
npm test
```

Tests cover every route, sizes, schemas, credential and binary formats, fresh output, dead links and HTTP behavior. Routes are in `src/routes.json`; generators are in `src/formats.js`, `src/schemas.js` and `src/binary.js`.
