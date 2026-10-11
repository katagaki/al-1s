# AL-1S

A synthetic information-disclosure decoy for Node.js and Cloudflare Workers. It serves freshly generated, fabricated data at all 393 paths identified in the source log review. Only the path/category manifest is included; no request logs, IP addresses, original tokens or real configuration are committed.

## Run locally

Requires Node.js 22 or newer. The Node server has no runtime package dependencies.

```sh
npm start
```

The server listens on `http://127.0.0.1:3000`. Set `PORT` to change the local port.

## Cloudflare Workers

```sh
npm ci
npm run dev
npm run build
npm run deploy
```

These scripts use the Cloudflare **cf CLI**, configured in `cloudflare.config.ts` and `vite.config.js`. Authenticate with `cf auth login` before deployment. The Worker is named `al-1s`; no existing domain or production route is configured automatically. A recent compatibility date enables the Node Buffer and zlib APIs used by the generators.

The Worker deploys `src/index.js` directly. **Every unmatched path returns generated HTML with HTTP 404 from the fetch handler.** `assets.runWorkerFirst: true` ensures the handler takes precedence, including over Vite's development file serving; asset HTML and not-found rewrites are disabled. No static-asset binding, SPA fallback or separate `404.html` file is used. This also covers `/`, unless it is added to the exact route manifest. Generated index links point to random, unmatched `/archive/...` paths and continue to return 404; they never redirect or fetch another server.

## Cloudflare Workers Builds (Git integration)

Cloudflare's default deploy command uses Wrangler. `wrangler.jsonc` declares `src/index.js` as its entry point and enables Node.js compatibility. It deploys the fetch handler directly, with no assets directory or static-file fallback. `cloudflare.config.ts` remains the configuration for the local cf CLI workflow.

In the Cloudflare build settings, use the repository root (`/`) as the root directory, `npm run build` as the build command, and `npx wrangler deploy` as the deploy command. The configured Worker name is `al-1s` and must match the Worker connected to the repository. Non-production branches can use `npx wrangler versions upload`.

## Responses

- Every decoy GET returns **at least 128 KiB**, freshly generated for that request. `/AGENTS.md`, `/CLAUDE.md` and `/README.md` return exactly **1 MiB of random emoji** instead of prose.
- `/robots.txt` is the only fixed-content endpoint: `User-agent: *` and `Disallow: /`. It returns HTTP 200 without size padding.
- Unmatched paths return an approximately **32 KiB** styled HTML index, with randomized filenames, sizes and dates.
- JSON, YAML, XML, INI, environment files, PHP/Python/Ruby/JavaScript configuration, SQL dumps, command histories, logs, source maps, PEM/OpenSSH keys, ZIP/tar.gz archives, SQLite databases, Mercurial dirstate records and Java HPROF data use their corresponding encodings and content types.
- Compressed archives contain randomly generated environment/configuration/database files; they are real archives, not renamed random bytes.
- Named configuration files and endpoints use recognizable keys and nesting: Google service-account and application-default credentials, Firebase, Azure Functions, Vercel, Amplify, Docker registry authentication, Spring Actuator, Rails, Spring, Serverless, and others. Application-specific files without a universal schema use conventional database, authentication, mail and service settings. All values that resemble credentials are fabricated.
- `.env`, `.env.json`, `.env.yml` and `.env.yaml` include familiar database, AWS, mail and authentication keys, plus Azure, GCP, OpenAI, Anthropic/Claude and Cloudflare mock IDs and credentials. Archive `.env` files use the same mock provider fields. Additional mock service credentials enlarge the contents. Other extensible formats grow their own collections, such as hosting sites, functions, loggers, traces, registry credentials and database connections; JSON size comes from content rather than whitespace padding.
- Names use a 128-word dictionary (such as harbor, atlas, juniper, glacier and lantern) with random suffixes for service names, hosts, filenames and generated indexes.
- Compact formats are intentionally enlarged, per the size requirement: private keys (including service-account `private_key` values) appear as repeated key bundles, application-default credentials have oversized mock refresh tokens, and Git HEAD and Mercurial requirements retain a recognizable opening followed by generated comments. These oversized formats are decoys and are not necessarily usable as real credentials or repository metadata.
- Responses use `Cache-Control: no-store`. HEAD returns headers without a body. Matched paths accept GET/HEAD; other methods return 405. Query strings do not change the matched path.
- Synthetic values are produced locally. The Worker does not read bindings, local secret files, request bodies or upstream services. Generated tokens and keys are not associated with any real account. Hostnames and application identities use reserved `.invalid` names, apart from recognizable public service-account format fields.

## Verification

```sh
npm test
```

The tests exercise every route, minimum sizes including JSON content without formatting, expected schema keys, mock credential formats, representative binary formats and RSA keys, fresh output, dead links, encoded URLs, and GET/HEAD/404/405 behavior. The route manifest is `src/routes.json`; formats are in `src/formats.js`, `src/schemas.js` and `src/binary.js`. The embedded SQLite template contains only invented version-control rows; fixed-width randomized substitutions preserve its database structure.

`.gitignore` excludes dependency/build output, local secrets, captures, runtime databases, logs, and editor files. Commit `package-lock.json` for reproducible tooling installs.
