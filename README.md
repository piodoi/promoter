# promoter

`promoter` now ships as an A-frame cabin planning tool with the original promoter workflow preserved behind a hidden admin tab at the bottom of the frontend.

Main app scope:
- A-frame and near A-frame geometry planning
- Metric and imperial inputs with metric as the default
- Loft area estimation from downstairs footprint, height, loft level, and headroom target
- Roof, side wall, end wall, glass, and wood panel takeoffs
- Timber section guidance for the requested rafter span and spacing
- Ground anchor spacing layout and simple floor-plan generation
- Simple 3D shell preview for quick proportion checks
- PDF report export and DXF plan export for the current layout
- Optional material pricing for shell estimates

Preserved admin scope:
- Campaign briefs
- AI-assisted marketing copy generation
- Directory submission planning and tracking
- Human-reviewed outreach workflows
- Channel notes for approved API-based posting later
- GitHub OAuth-based model access for draft generation

Stack:
- FastAPI backend
- React + Vite + TypeScript frontend
- Docker + nginx deployment boilerplate

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