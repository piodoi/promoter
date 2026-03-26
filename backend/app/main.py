import os
import secrets
from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.ai_client import generate_draft
from app.models import AdminSettingsUpdate, CampaignCreate, DirectoryEntryCreate, DraftRequest, GitHubAuthStartRequest, KeywordPlanCreate, SocialChannelCreate, SocialPostRequest, SocialSearchRequest, WebTargetCreate
from app.social_integrations import create_social_post, get_provider_capabilities, get_provider_statuses, search_social
from app.storage import storage


app = FastAPI(title="Promoter API", version="0.1.0")
app.state.github_oauth_states = {}

cors_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5174").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _append_query_params(url: str, params: dict[str, str]) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.update(params)
    return urlunparse(parsed._replace(query=urlencode(query)))


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/state")
async def get_state() -> dict:
    return storage.list_state().model_dump(mode="json")


@app.get("/api/settings")
async def get_settings() -> dict:
    return storage.list_state().settings.model_dump(mode="json")


@app.put("/api/settings")
async def update_settings(payload: AdminSettingsUpdate) -> dict:
    settings = storage.update_settings(payload)
    return settings.model_dump(mode="json")


@app.post("/api/github/oauth/start")
async def github_oauth_start(payload: GitHubAuthStartRequest) -> dict:
    settings = storage.list_state().settings
    if not settings.github_client_id or not settings.github_client_secret or not settings.github_oauth_redirect_uri:
        raise HTTPException(status_code=400, detail="GitHub OAuth client id, client secret, and redirect URI are required")

    state = secrets.token_urlsafe(24)
    app.state.github_oauth_states[state] = payload.frontend_redirect
    authorize_url = "https://github.com/login/oauth/authorize?" + urlencode({
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_oauth_redirect_uri,
        "scope": "read:user user:email",
        "state": state,
    })
    return {"authorize_url": authorize_url}


@app.get("/api/github/oauth/callback")
async def github_oauth_callback(code: str, state: str) -> RedirectResponse:
    settings = storage.list_state().settings
    frontend_redirect = app.state.github_oauth_states.pop(state, None)
    fallback_redirect = os.getenv("PROMOTER_FRONTEND_URL", "http://localhost:5174")
    redirect_target = frontend_redirect or fallback_redirect

    if not settings.github_client_id or not settings.github_client_secret or not settings.github_oauth_redirect_uri:
        return RedirectResponse(_append_query_params(redirect_target, {
            "github_auth": "error",
            "github_message": "GitHub OAuth settings are incomplete.",
        }))

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            token_response = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.github_client_id,
                    "client_secret": settings.github_client_secret,
                    "code": code,
                    "redirect_uri": settings.github_oauth_redirect_uri,
                    "state": state,
                },
            )
            token_response.raise_for_status()
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            if not access_token:
                error_description = token_data.get("error_description") or token_data.get("error") or "GitHub did not return an access token."
                raise HTTPException(status_code=502, detail=error_description)

            user_response = await client.get(
                "https://api.github.com/user",
                headers={
                    "Accept": "application/vnd.github+json",
                    "Authorization": f"Bearer {access_token}",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
            user_response.raise_for_status()
            user_data = user_response.json()
    except (httpx.HTTPError, HTTPException) as exc:
        message = exc.detail if isinstance(exc, HTTPException) else f"GitHub OAuth failed: {exc}"
        return RedirectResponse(_append_query_params(redirect_target, {
            "github_auth": "error",
            "github_message": str(message),
        }))

    storage.update_settings(AdminSettingsUpdate(
        github_access_token=access_token,
        github_login=user_data.get("login"),
    ))
    return RedirectResponse(_append_query_params(redirect_target, {
        "github_auth": "success",
        "github_login": user_data.get("login") or "connected",
    }))


@app.get("/api/social/providers")
async def get_social_providers() -> list[dict]:
    return [item.model_dump(mode="json") for item in get_provider_capabilities()]


@app.get("/api/social/status")
async def get_social_status() -> list[dict]:
    settings = storage.list_state().settings
    return [item.model_dump(mode="json") for item in get_provider_statuses(settings)]


@app.post("/api/social/search")
async def social_search(payload: SocialSearchRequest) -> dict:
    settings = storage.list_state().settings
    response = await search_social(settings, payload)
    return response.model_dump(mode="json")


@app.post("/api/social/post")
async def social_post(payload: SocialPostRequest) -> dict:
    settings = storage.list_state().settings
    response = await create_social_post(settings, payload)
    return response.model_dump(mode="json")


@app.post("/api/campaigns")
async def create_campaign(payload: CampaignCreate) -> dict:
    campaign = storage.create_campaign(payload)
    return campaign.model_dump(mode="json")


@app.post("/api/campaigns/{campaign_id}/directories")
async def create_directory(campaign_id: str, payload: DirectoryEntryCreate) -> dict:
    state = storage.list_state()
    if not any(campaign.id == campaign_id for campaign in state.campaigns):
        raise HTTPException(status_code=404, detail="Campaign not found")
    entry = storage.create_directory(campaign_id, payload)
    storage.touch_campaign(campaign_id)
    return entry.model_dump(mode="json")


@app.post("/api/campaigns/{campaign_id}/social-channels")
async def create_social_channel(campaign_id: str, payload: SocialChannelCreate) -> dict:
    state = storage.list_state()
    if not any(campaign.id == campaign_id for campaign in state.campaigns):
        raise HTTPException(status_code=404, detail="Campaign not found")
    channel = storage.create_social_channel(campaign_id, payload)
    storage.touch_campaign(campaign_id)
    return channel.model_dump(mode="json")


@app.post("/api/campaigns/{campaign_id}/keywords")
async def create_keyword(campaign_id: str, payload: KeywordPlanCreate) -> dict:
    state = storage.list_state()
    if not any(campaign.id == campaign_id for campaign in state.campaigns):
        raise HTTPException(status_code=404, detail="Campaign not found")
    keyword = storage.create_keyword(campaign_id, payload)
    storage.touch_campaign(campaign_id)
    return keyword.model_dump(mode="json")


@app.post("/api/campaigns/{campaign_id}/web-targets")
async def create_web_target(campaign_id: str, payload: WebTargetCreate) -> dict:
    state = storage.list_state()
    if not any(campaign.id == campaign_id for campaign in state.campaigns):
        raise HTTPException(status_code=404, detail="Campaign not found")
    target = storage.create_web_target(campaign_id, payload)
    storage.touch_campaign(campaign_id)
    return target.model_dump(mode="json")


@app.post("/api/drafts")
async def create_draft(payload: DraftRequest) -> dict:
    state = storage.list_state()
    campaign = next((item for item in state.campaigns if item.id == payload.campaign_id), None)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")

    resolved_payload = payload.model_copy(update={
        "api_key": payload.api_key or state.settings.github_access_token or state.settings.copilot_api_key,
        "api_base_url": payload.api_base_url or state.settings.copilot_api_base_url,
        "model": payload.model or state.settings.copilot_model,
    })

    draft = await generate_draft(
        resolved_payload,
        campaign_summary=campaign.summary,
        audience=campaign.audience,
        value_proposition=campaign.value_proposition,
    )
    return draft.model_dump(mode="json")