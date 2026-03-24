# NovaPesa Backend API

Secure Node.js + Express backend for NovaPesa AI Money Coach.
Deployed on Render. Keeps OpenAI API key secure.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | / | Health check |
| GET | /health | Server status |
| POST | /analyze | Full financial analysis |
| POST | /chat | Nova AI chat |
| POST | /plan | 90-Day plan generator |

## Deploy on Render

1. Push this folder to GitHub
2. Go to render.com → New Web Service
3. Connect your GitHub repo
4. Add environment variable: OPENAI_API_KEY
5. Deploy!

## Local Development

```bash
npm install
cp .env.example .env
# Add your OpenAI key to .env
npm run dev
```
