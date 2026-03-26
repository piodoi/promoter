from __future__ import annotations

from typing import List

import httpx
from fastapi import HTTPException

from app.models import (
    AdminSettings,
    ProviderStatus,
    SocialPostRequest,
    SocialPostResponse,
    SocialProviderCapability,
    SocialSearchRequest,
    SocialSearchResponse,
    SocialSearchResult,
)


FACEBOOK_GRAPH_BASE = "https://graph.facebook.com/v22.0"
REDDIT_BASE = "https://oauth.reddit.com"
BRAVE_SEARCH_BASE = "https://api.search.brave.com/res/v1/web/search"
SITE_FILTER_DOMAINS = {
    "any": None,
    "reddit": "reddit.com",
    "facebook": "facebook.com",
    "instagram": "instagram.com",
    "x": "x.com",
}


def get_provider_capabilities() -> List[SocialProviderCapability]:
    return [
        SocialProviderCapability(
            provider="brave",
            discovery_label="Brave web search",
            posting_label="No posting",
            search_supported=True,
            posting_supported=False,
            notes="Uses Brave Search API for general web discovery. This provider is search-only and does not execute posts.",
        ),
        SocialProviderCapability(
            provider="facebook",
            discovery_label="Facebook pages",
            posting_label="Facebook page posts",
            notes="Official Graph API support is limited to pages and permitted assets. Group discovery/posting is not exposed here.",
        ),
        SocialProviderCapability(
            provider="reddit",
            discovery_label="Reddit subreddits",
            posting_label="Reddit self-posts",
            notes="Uses Reddit OAuth endpoints. Posting requires an approved token and is only executed after explicit user approval.",
        ),
        SocialProviderCapability(
            provider="instagram",
            discovery_label="Instagram hashtags",
            posting_label="Instagram business publishing",
            notes="Official Instagram Graph API requires a business/creator setup. Discovery is hashtag-based; posting requires an IG user id and media URL.",
        ),
    ]


def get_provider_statuses(settings: AdminSettings) -> List[ProviderStatus]:
    return [
        ProviderStatus(
            provider="brave",
            configured=bool(settings.brave_search_api_key),
            search_supported=True,
            posting_supported=False,
            missing_fields=[] if settings.brave_search_api_key else ["brave_search_api_key"],
            note="General web discovery through Brave Search.",
        ),
        ProviderStatus(
            provider="facebook",
            configured=bool(settings.facebook_access_token and settings.facebook_page_id),
            search_supported=True,
            posting_supported=True,
            missing_fields=[
                field
                for field, value in {
                    "facebook_access_token": settings.facebook_access_token,
                    "facebook_page_id": settings.facebook_page_id,
                }.items()
                if not value
            ],
            note="Page discovery and page feed posting through the official Graph API.",
        ),
        ProviderStatus(
            provider="instagram",
            configured=bool(settings.instagram_access_token and settings.instagram_ig_user_id),
            search_supported=True,
            posting_supported=True,
            missing_fields=[
                field
                for field, value in {
                    "instagram_access_token": settings.instagram_access_token,
                    "instagram_ig_user_id": settings.instagram_ig_user_id,
                }.items()
                if not value
            ],
            note="Hashtag discovery and business publishing through the official Graph API.",
        ),
        ProviderStatus(
            provider="reddit",
            configured=bool(settings.reddit_access_token),
            search_supported=True,
            posting_supported=True,
            missing_fields=[] if settings.reddit_access_token else ["reddit_access_token"],
            note="Subreddit discovery and self-post submission through Reddit OAuth.",
        ),
    ]


def _require_token(value: str | None, label: str) -> str:
    if not value:
        raise HTTPException(status_code=400, detail=f"Missing {label} in promoter settings")
    return value


async def search_social(settings: AdminSettings, request: SocialSearchRequest) -> SocialSearchResponse:
    provider = request.provider.lower()

    if provider == "brave":
        return await _search_brave(settings, request)
    if provider == "reddit":
        return await _search_reddit(settings, request)
    if provider == "facebook":
        return await _search_facebook(settings, request)
    if provider == "instagram":
        return await _search_instagram(settings, request)

    raise HTTPException(status_code=400, detail="Unsupported provider")


async def create_social_post(settings: AdminSettings, request: SocialPostRequest) -> SocialPostResponse:
    provider = request.provider.lower()
    preview = {
        "title": request.title,
        "body": request.body,
        "image_url": request.image_url,
    }

    if provider == "brave":
        return SocialPostResponse(
            provider=provider,
            approved=False,
            executed=False,
            target_id=request.target_id,
            preview=preview,
            note="Brave Search is a discovery-only provider. Use it to find sites, then continue manually or with a supported posting API.",
        )

    if not request.approve_post:
        return SocialPostResponse(
            provider=provider,
            approved=False,
            executed=False,
            target_id=request.target_id,
            preview=preview,
            note="Preview only. Set approve_post=true from the UI to execute an official API post.",
        )

    if provider == "reddit":
        return await _post_reddit(settings, request, preview)
    if provider == "facebook":
        return await _post_facebook(settings, request, preview)
    if provider == "instagram":
        return await _post_instagram(settings, request, preview)

    raise HTTPException(status_code=400, detail="Unsupported provider")


async def _search_brave(settings: AdminSettings, request: SocialSearchRequest) -> SocialSearchResponse:
    token = _require_token(settings.brave_search_api_key, "brave_search_api_key")
    site_filter = (request.site_filter or "any").lower()
    site_domain = SITE_FILTER_DOMAINS.get(site_filter)
    applied_query = request.query if not site_domain else f"{request.query} site:{site_domain}"
    headers = {
        "Accept": "application/json",
        "X-Subscription-Token": token,
    }
    params = {
        "q": applied_query,
        "count": request.limit,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(BRAVE_SEARCH_BASE, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()

    results = []
    for item in data.get("web", {}).get("results", []):
        results.append(SocialSearchResult(
            id=item.get("url", ""),
            title=item.get("title") or item.get("url") or "Unknown result",
            subtitle=item.get("description"),
            url=item.get("url"),
            metadata={
                "display_url": item.get("meta_url", {}).get("display"),
                "age": item.get("age"),
                "language": item.get("language"),
            },
        ))

    return SocialSearchResponse(
        provider="brave",
        query=request.query,
        results=results,
        note="Brave Search returns general web results. Review targets manually before outreach or submission.",
        applied_query=applied_query,
    )


async def _search_reddit(settings: AdminSettings, request: SocialSearchRequest) -> SocialSearchResponse:
    token = _require_token(settings.reddit_access_token, "reddit_access_token")
    user_agent = settings.reddit_user_agent or "promoter/0.1 by promanage"
    headers = {"Authorization": f"Bearer {token}", "User-Agent": user_agent}
    params = {"q": request.query, "limit": request.limit, "include_over_18": "on"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{REDDIT_BASE}/subreddits/search", headers=headers, params=params)
        response.raise_for_status()
        data = response.json()

    results = []
    for child in data.get("data", {}).get("children", []):
        item = child.get("data", {})
        results.append(SocialSearchResult(
            id=item.get("display_name", ""),
            title=item.get("title") or item.get("display_name", "Unknown subreddit"),
            subtitle=item.get("public_description"),
            url=f"https://reddit.com{item.get('url', '')}" if item.get("url") else None,
            metadata={
                "subscribers": item.get("subscribers"),
                "over18": item.get("over18"),
            },
        ))

    return SocialSearchResponse(provider="reddit", query=request.query, results=results, applied_query=request.query)


async def _search_facebook(settings: AdminSettings, request: SocialSearchRequest) -> SocialSearchResponse:
    token = _require_token(settings.facebook_access_token, "facebook_access_token")
    params = {
        "type": "page",
        "q": request.query,
        "limit": request.limit,
        "fields": "id,name,link,category,fan_count,about",
        "access_token": token,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{FACEBOOK_GRAPH_BASE}/search", params=params)
        response.raise_for_status()
        data = response.json()

    results = [
        SocialSearchResult(
            id=item.get("id", ""),
            title=item.get("name", "Unknown page"),
            subtitle=item.get("category") or item.get("about"),
            url=item.get("link"),
            metadata={"fan_count": item.get("fan_count")},
        )
        for item in data.get("data", [])
    ]
    return SocialSearchResponse(
        provider="facebook",
        query=request.query,
        results=results,
        note="Facebook discovery is limited here to pages exposed through the official Graph API.",
        applied_query=request.query,
    )


async def _search_instagram(settings: AdminSettings, request: SocialSearchRequest) -> SocialSearchResponse:
    token = _require_token(settings.instagram_access_token, "instagram_access_token")
    ig_user_id = _require_token(settings.instagram_ig_user_id, "instagram_ig_user_id")
    params = {
        "user_id": ig_user_id,
        "q": request.query,
        "access_token": token,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        search_response = await client.get(f"{FACEBOOK_GRAPH_BASE}/ig_hashtag_search", params=params)
        search_response.raise_for_status()
        search_data = search_response.json()

        hashtags = search_data.get("data", [])[: request.limit]
        results: List[SocialSearchResult] = []

        for item in hashtags:
            hashtag_id = item.get("id")
            if not hashtag_id:
                continue
            media_response = await client.get(
                f"{FACEBOOK_GRAPH_BASE}/{hashtag_id}/recent_media",
                params={
                    "user_id": ig_user_id,
                    "fields": "id,caption,permalink,media_type,timestamp",
                    "access_token": token,
                },
            )
            media_response.raise_for_status()
            media_data = media_response.json().get("data", [])
            subtitle = media_data[0].get("caption") if media_data else None
            permalink = media_data[0].get("permalink") if media_data else None
            results.append(SocialSearchResult(
                id=hashtag_id,
                title=f"#{request.query}",
                subtitle=subtitle,
                url=permalink,
                metadata={"recent_media_count": len(media_data)},
            ))

    return SocialSearchResponse(
        provider="instagram",
        query=request.query,
        results=results,
        note="Instagram discovery here uses hashtag search through the official Graph API.",
        applied_query=request.query,
    )


async def _post_reddit(settings: AdminSettings, request: SocialPostRequest, preview: dict) -> SocialPostResponse:
    token = _require_token(settings.reddit_access_token, "reddit_access_token")
    user_agent = settings.reddit_user_agent or "promoter/0.1 by promanage"
    headers = {"Authorization": f"Bearer {token}", "User-Agent": user_agent}
    data = {
        "api_type": "json",
        "kind": "self",
        "sr": request.target_id,
        "title": request.title or "",
        "text": request.body or "",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(f"{REDDIT_BASE}/api/submit", headers=headers, data=data)
        response.raise_for_status()
        payload = response.json()

    errors = payload.get("json", {}).get("errors", [])
    if errors:
        raise HTTPException(status_code=502, detail=f"Reddit rejected the submission: {errors}")

    return SocialPostResponse(
        provider="reddit",
        approved=True,
        executed=True,
        target_id=request.target_id,
        external_id=request.target_id,
        preview=preview,
        note="Reddit submission sent through the official OAuth API.",
    )


async def _post_facebook(settings: AdminSettings, request: SocialPostRequest, preview: dict) -> SocialPostResponse:
    token = _require_token(settings.facebook_access_token, "facebook_access_token")
    page_id = request.target_id or _require_token(settings.facebook_page_id, "facebook_page_id")
    payload = {
        "message": request.body or request.title or "",
        "access_token": token,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(f"{FACEBOOK_GRAPH_BASE}/{page_id}/feed", data=payload)
        response.raise_for_status()
        data = response.json()

    return SocialPostResponse(
        provider="facebook",
        approved=True,
        executed=True,
        target_id=page_id,
        external_id=data.get("id"),
        preview=preview,
        note="Facebook post sent through the official Graph API page feed endpoint.",
    )


async def _post_instagram(settings: AdminSettings, request: SocialPostRequest, preview: dict) -> SocialPostResponse:
    token = _require_token(settings.instagram_access_token, "instagram_access_token")
    ig_user_id = _require_token(settings.instagram_ig_user_id, "instagram_ig_user_id")
    if not request.image_url:
        raise HTTPException(status_code=400, detail="Instagram publishing requires image_url")

    async with httpx.AsyncClient(timeout=45.0) as client:
        create_response = await client.post(
            f"{FACEBOOK_GRAPH_BASE}/{ig_user_id}/media",
            data={
                "image_url": request.image_url,
                "caption": request.body or request.title or "",
                "access_token": token,
            },
        )
        create_response.raise_for_status()
        container_id = create_response.json().get("id")
        if not container_id:
            raise HTTPException(status_code=502, detail="Instagram did not return a media container id")

        publish_response = await client.post(
            f"{FACEBOOK_GRAPH_BASE}/{ig_user_id}/media_publish",
            data={
                "creation_id": container_id,
                "access_token": token,
            },
        )
        publish_response.raise_for_status()
        data = publish_response.json()

    return SocialPostResponse(
        provider="instagram",
        approved=True,
        executed=True,
        target_id=ig_user_id,
        external_id=data.get("id"),
        preview=preview,
        note="Instagram publish request sent through the official Graph API business publishing flow.",
    )