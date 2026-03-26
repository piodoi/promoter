# promoter

`promoter` is a companion app for compliant marketing operations.

It uses the same general stack as the main app:
- FastAPI backend
- React + Vite + TypeScript frontend
- Docker + nginx deployment boilerplate

Safe scope only:
- Campaign briefs
- AI-assisted marketing copy generation
- Directory submission planning and tracking
- Human-reviewed outreach workflows
- Channel notes for approved API-based posting later
- GitHub OAuth-based model access for draft generation

Not included:
- Screen-driving third-party websites
- Automated posting to personal social accounts
- Credential replay against external services
- Bulk unsolicited submission automation

## Local run

Backend:

```powershell
cd promoter/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8100
```

Frontend:

```powershell
cd promoter/frontend
npm install
npm run dev
```

## GitHub login for draft generation

The promoter app can request GitHub access through a GitHub OAuth App and use the returned user token for calls to GitHub-hosted model endpoints.

Configure these fields in Admin settings:
- GitHub OAuth client id
- GitHub OAuth client secret
- GitHub OAuth redirect URI

For local development, a typical callback value is:

```text
http://localhost:8100/api/github/oauth/callback
```

After saving those values, use the `Connect with GitHub` action in the UI. A manually entered token is still supported as a fallback, but the preferred path is GitHub login.

## Docker

Development:

```powershell
cd promoter
docker-compose up -d
```

Production:

```powershell
cd promoter
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```