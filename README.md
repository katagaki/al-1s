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

## Responses

- Every matched GET returns **at least 128 KiB**, freshly generated for that request.
- Unmatched paths return an approximately **32 KiB** styled HTML index, with randomized filenames, sizes and dates.
- JSON, YAML, XML, INI, environment files, PHP/Python/Ruby/JavaScript configuration, SQL dumps, command histories, logs, source maps, PEM/OpenSSH keys, ZIP/tar.gz archives, SQLite databases, Mercurial dirstate records and Java HPROF data use their corresponding encodings and content types.
- Compressed archives contain randomly generated environment/configuration/database files; they are real archives, not renamed random bytes.
- Compact formats are intentionally enlarged, per the size requirement: private keys appear as repeated key bundles; Git HEAD and Mercurial requirements retain a recognizable opening followed by generated comments. These padded compact formats are decoys and are not necessarily usable as real repository metadata. JSON whitespace padding preserves parseability.
- Responses use `Cache-Control: no-store`. HEAD returns headers without a body. Matched paths accept GET/HEAD; other methods return 405. Query strings do not change the matched path.
- Synthetic values are produced locally. The Worker does not read bindings, local secret files, request bodies or upstream services. Generated tokens and keys are not associated with any real account. Hostnames and application identities use reserved `.invalid` names, apart from recognizable public service-account format fields.

## Verification

```sh
npm test
```

The tests exercise every route, minimum sizes, JSON parsing, representative binary formats and RSA keys, fresh output, dead links, encoded URLs, and GET/HEAD/404/405 behavior. The route manifest is `src/routes.json`; formats are in `src/formats.js` and `src/binary.js`. The embedded SQLite template contains only invented version-control rows; fixed-width randomized substitutions preserve its database structure.

`.gitignore` excludes dependency/build output, local secrets, captures, runtime databases, logs, and editor files. Commit `package-lock.json` for reproducible tooling installs.
