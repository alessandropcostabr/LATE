# Repository Guidelines

## Project Structure & Module Organization
The Express server boots in `server.js`, wiring middleware, session storage, and the EJS view layer. Domain logic lives in `controllers/`, persistence in `models/` via `config/database.js`, and routing in `routes/` split between API and web. Templates reside in `views/`, static assets in `public/`, and PostCSS outputs to `public/css/style.min.css`. Database assets live in `migrations/`, automation scripts in `scripts/`, and Jest specs in `__tests__/` near the feature under test.

## Build, Test, and Development Commands
- `npm run dev` — start the app with Nodemon reloading on file changes.
- `npm start` — production boot (honors `NODE_ENV=production` and compression).
- `npm run build` — run PostCSS (autoprefixer + cssnano) to refresh `style.min.css`.
- `npm test` — execute Jest in-band with coverage output under `coverage/`.
- `npm run migrate` / `npm run migrate:dry` — apply or preview SQL files in `migrations/`.
- `node scripts/seed-admin.js` — create the initial admin; requires `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## Coding Style & Naming Conventions
Use Node.js ≥22, CommonJS modules, and two-space indentation as shown in the controllers. Keep semicolons and prefer `const`/`let`. Export handlers with descriptive names (`exports.login = …`). Maintain the language split: identifiers in English, user copy and comments in pt-BR. Stick to `kebab-case` filenames and ensure shell scripts stay executable.

## Testing Guidelines
Place new specs in `__tests__/**` using the `*.test.js` suffix so Jest auto-discovers them. Favor Supertest for HTTP flows and `pg-mem` to isolate database behavior. Use `npm test -- <pattern>` to focus during development, keep the coverage report passing, and refresh snapshots only when behavior truly changes. When altering migrations, add a regression test covering the new schema path.

## Commit & Pull Request Guidelines
Match the existing log: short, imperative subjects in Portuguese for user-facing work, optional type prefixes (`feat:`, `fix:`), and PR references like `(#191)` when available. Keep commits scoped with updated tests and rebuilt assets. In PRs, outline the rationale, highlight risky areas (auth, migrations, rate limits), and attach console output or screenshots when behavior changes. List any manual steps (`npm run migrate`) so reviewers can reproduce them.

## Environment & Security Notes
Configuration relies on `.env`; set `SESSION_SECRET`, database DSN variables, and `TRUST_PROXY` when behind proxies. Define `CORS_ORIGINS` before deploying. Keep secrets and generated artifacts (`lighthouse-reports/`, `cookie.txt`) out of commits. Rotate credentials after running `scripts/seed-admin.js` in shared environments.
