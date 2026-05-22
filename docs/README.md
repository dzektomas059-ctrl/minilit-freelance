# MiniLIT

Single-file freelance marketplace SPA with a real Supabase backend (auth, Postgres + RLS, Realtime, Storage). Built as one self-contained `index.html` so it can be served from GitHub Pages without a build step.

**Live:** https://dzektomas059-ctrl.github.io/minilit-freelance/

## What's inside `index.html`

- Auth (Supabase email + password), automatic profile sync, online status
- Биржа заданий with category / budget / search filters and «+ Разместить задание»
- Услуги (kworks) catalog with creation form
- Realtime chat backed by `messages` table with RLS
- Profile pages, личный кабинет, отзывы (1–5 stars)
- **`#offer/:taskId` — «Предложить услугу»**: contenteditable description (50–2000 chars, XSS-sanitised), title, price, deadline, optional ≤50 MB video uploaded to `portfolio_videos`, then proposal inserted into `proposals`

## Database

SQL files in this repo seed the project's database:

- `schema.sql` — core tables (profiles, jobs, services, applications, orders, chats, messages, reviews)
- `rls.sql` — row-level security policies
- `proposals.sql` — `proposals` table + RLS
- `proposals_storage.sql` — `portfolio_videos` storage bucket policies

## Local development

```bash
python3 -m http.server 8766
# open http://localhost:8766/index.html
```

## Demo accounts (password `123456`)

- `demo@mail.ru` — Анна Петрова, freelancer
- `dev@mail.ru` — Дмитрий Ковалёв, freelancer
- `copy@mail.ru` — Мария Орлова, freelancer
- `client@mail.ru` — Иван Соколов, client
