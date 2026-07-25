# Credentials & secrets

**Never commit real keys.** `.env` is gitignored; `.env.example` is the committed template.

## Setup (each teammate)
1. `cp .env.example .env`
2. Fill in the real values (ask Dhruv on the team channel — not in git/issues/PRs).
3. Keys are shared out-of-band, not through this repo.

## What each secret is for
| Var | Used as | Where |
|---|---|---|
| `FAL_KEY` | HTTP header `Authorization: Key <FAL_KEY>` | fal nodes (Wizper, video/vision router, LLM fingerprint & scorer) |
| `APIFY_TOKEN` | HTTP header `Authorization: Bearer <APIFY_TOKEN>` | Apify download/scrape nodes |
| `N8N_API_URL` | n8n Cloud public API base | deploy/validate workflows via API |

## In n8n Cloud
Secrets live as **Header Auth credentials** in n8n (not in the workflow JSON):
- **fal**: Header Auth → Name `Authorization`, Value `Key <FAL_KEY>`
- **Apify**: Header Auth → Name `Authorization`, Value `Bearer <APIFY_TOKEN>`

Committed workflow JSONs have credentials **stripped** — attach the credentials in the n8n UI after importing.

## If a key leaks
Rotate immediately: fal → dashboard API keys; Apify → console Settings → Integrations. Then update `.env` and the n8n credentials.
