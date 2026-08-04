<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# This is NOT the Laravel you know either

`apps/api` runs **Laravel 13**, which is likely newer than your training data.
Verify against `apps/api/vendor/laravel/framework/src/` rather than recalling
from memory. Differences already hit in this repo:

- Models configure themselves with **attributes** (`#[Fillable([...])]`,
  `#[Hidden([...])]`), not `protected $fillable` / `$hidden` properties.
- The skeleton is slim: no `app/Http/Kernel.php`. Middleware aliases and
  guest-redirect behaviour are registered in `bootstrap/app.php`.
- `routes/api.php` only exists after `php artisan install:api`.

# Monorepo layout

Run commands from the repo root — `apps/web` is an npm workspace, `apps/api` is
a Composer project. `npm run dev` starts both. The browser never calls Laravel
directly: Next.js route handlers proxy to it (see `apps/web/lib/api.ts`), so an
API change usually needs a matching change on both sides.
