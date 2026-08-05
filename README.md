# TradeQuoteAI

A demo mobile app that generates itemised, AI-priced quotes for UK painting and decorating jobs. Describe the job and enter measurements, and it produces a priced breakdown of materials and labour, ready to send to the customer as a PDF.

> This is a portfolio/demo project. Billing (Stripe) is wired up end-to-end but there is no live payment processing — it's a working demo of a subscription flow, not a real money product.

## What it does

- **AI quote generation** — describe the job, add room/surface measurements and employee hourly rates, and an LLM (Groq, `llama-3.3-70b-versatile`) returns an itemised quote (materials + labour) using realistic UK trade pricing, which is then combined with markup and VAT to a final total
- **Customer management** — track customers and their quotes
- **PDF export** — generate a branded PDF of any quote
- **AI email drafting** — generate a short, professional email to accompany a quote
- **Auth** — email/password auth via Supabase
- **Subscription tiers (demo)** — Free / Pro / Team tiers gated through a Stripe Checkout + customer portal + webhook flow

## Tech stack

**Frontend** — Expo (React Native) app using Expo Router (file-based routing), Zustand for state, Supabase JS client for auth, Axios for API calls. Targets iOS, Android, and web from one codebase.

**Backend** — Flask API (`backend/main.py`) that:
- Calls the Groq API to generate quotes and draft emails
- Generates quote PDFs with `fpdf2`
- Handles Stripe checkout, billing portal, subscription status, and webhooks
- Rate-limits requests with `flask-limiter`
- Deploys to Railway (`Procfile`, `railway.toml`)

## Project structure

```
src/app/            Expo Router routes
  (auth)/            Login / register
  (tabs)/            Home, customers, quotes, settings
  quote/             New quote flow, quote detail view
src/components/      Shared UI components
src/lib/             API client (api.ts), Supabase client, local db helpers
src/store/           Zustand stores (auth, app state)
src/types/           Shared TypeScript types

backend/
  main.py            Flask API: quote generation, PDF export, email drafting, billing
  pdf_generator.py    Quote PDF rendering
  migrations/         SQL migrations
```

## Setup

### Frontend (Expo app)

Requires Node.js and npm.

```bash
npm install
npx expo start
```

Then choose to open it in a development build, Android emulator, iOS simulator, or Expo Go from the CLI output.

Set the backend URL for the app to call (defaults to `http://localhost:8000` for local dev):

```
EXPO_PUBLIC_API_URL=http://localhost:8000
```

You'll also need Supabase project credentials wired into `src/lib/supabase.ts` / your environment for auth to work.

### Backend (Flask API)

Requires Python 3.

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Create a `.env` file in `backend/` with:

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Groq API key, used for quote generation and email drafting |
| `SUPABASE_URL` | Supabase project URL (used to update subscription tier on webhook events) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | Stripe Price ID for the Pro tier |
| `STRIPE_TEAM_PRICE_ID` | Stripe Price ID for the Team tier |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins (defaults to `*` if unset) |
| `PORT` | Port to run on (defaults to `8000`) |
| `FLASK_DEBUG` | Set `true` for Flask debug mode |

The API runs on `http://localhost:8000` by default. Key endpoints: `POST /quotes/generate`, `POST /quotes/pdf`, `POST /quotes/draft-email`, `POST /billing/checkout`, `POST /billing/portal`, `GET /billing/status`, `POST /billing/webhook`.

## Mobile builds

Mobile builds are configured via EAS (`eas.json`, `app.json`). Bundle identifiers and store metadata are set up for iOS and Android, though this is a demo project and not published to app stores.
