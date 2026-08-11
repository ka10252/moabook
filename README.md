# moabook

A hyperlocal book-sharing marketplace for the Korean community in Singapore.
Neighbours lend, sell and give away Korean-language books to each other.

> Solo project. Product, design and engineering. Currently in user testing ahead of a closed beta.

---

## Why

International students can carry only two or three Korean books through airline baggage
limits, and Korean-language titles are hard to buy locally. At the same time, students
leaving the country need to clear out belongings, so the supply that exists is often
free rather than for sale.

The problem was never that people did not want to borrow. It was that nobody could see
what was on the bookshelf two streets away, and there was no structure that made
borrowing from a stranger feel safe.

## What the product does

| Area | Detail |
|---|---|
| **Listing** | Title search autofills cover, author and description; condition grade; rent, sell and give away can be combined on one book |
| **Transactions** | Request → accept → return, carried as cards inside a 1:1 realtime chat |
| **Communities** | PIN-protected private groups with their own shelf, board and pixel-art room |
| **Trust** | School email verification, activity badges, completed-transaction count |
| **Notifications** | Telegram as the primary channel, with web push as fallback |
| **Instrumentation** | Custom events table, admin-only aggregation RPCs, activation funnel dashboard |

## Two decisions worth explaining

**The listing gate.** In user testing, learnability scored 5.0 out of 5 while intent to
use scored 2.75. People could use it; they just would not come back until there were
books worth coming back for. The constraint was inventory, not interface. So borrowing
now asks for one listing of your own first, the first request passes free so nobody is
blocked before seeing the product, and buying is never gated because paying is already a
contribution. `borrow_gate_shown` is instrumented and the threshold that would reverse
the decision was written down before launch.

**Cutting the global virtual library.** All four testers said the shared pixel-art space
was not necessary. A space only reads as alive when someone else is in it, and that
density only exists at community scale. The global room was removed and the feature kept
only inside a community.

## Stack

- **Frontend** React 18, TypeScript, Vite, Tailwind, shadcn/ui, Framer Motion
- **Backend** Supabase (Postgres, Auth, Realtime, Storage, Edge Functions)
- **Data** Row-level security on every table; aggregation exposed only through `SECURITY DEFINER` RPCs
- **Other** PWA with a custom service worker, Phaser for the community room, Google Books and Open Library for metadata

## Running it locally

```bash
npm install
cp .env.example .env      # fill in your own Supabase project values
npm run dev               # http://localhost:8080
```

Supabase migrations live in `supabase/migrations` and are applied in filename order.

## Documentation

| File | What is in it |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Problem definition, scope and out of scope, hypotheses with the metric that would falsify each, acceptance criteria per requirement |
| [`docs/USER_TEST.md`](docs/USER_TEST.md) | Task scenarios, observation sheet, short SUS and NPS |
| [`docs/FUNNEL_METRICS.md`](docs/FUNNEL_METRICS.md) | The activation funnel and how each number is allowed to be read |
| [`docs/CORE_FEATURES.md`](docs/CORE_FEATURES.md) | Feature specs and the invariants that must not break |
| [`docs/EVENT_SCHEMA.md`](docs/EVENT_SCHEMA.md) | Behavioural event names and properties |
| [`docs/DESIGN_GUIDE.md`](docs/DESIGN_GUIDE.md) | Colour, type and component rules |
| [`docs/BACKLOG.md`](docs/BACKLOG.md) | Backlog scored with RICE, each item tagged to the test it came from |

## Status

Feature complete and instrumented. Remaining work before store submission is
reporting and blocking, plus native wrapping. Numbers in this repository come from the
events table rather than estimates, and where a metric is not yet readable the
documentation says so.
