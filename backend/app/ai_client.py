import os

import httpx
from fastapi import HTTPException

from app.models import DraftArtifact, DraftRequest, DraftResponse


def build_prompt(request: DraftRequest, campaign_summary: str, audience: str, value_proposition: str) -> str:
    return (
        "You are a compliant B2B SaaS marketing assistant. "
        "Generate concise directory listing copy and manual outreach material. "
        "Do not suggest spam, fake engagement, scraping, or account automation.\n\n"
        f"Objective: {request.objective}\n"
        f"Channel: {request.channel}\n"
        f"Campaign summary: {campaign_summary}\n"
        f"Target audience: {audience}\n"
        f"Value proposition: {value_proposition}\n"
        f"Constraints: {request.constraints or 'Keep it factual and concise.'}\n\n"
        "Return JSON with keys: headline, summary, call_to_action, bullets, notes."
    )


async def generate_draft(request: DraftRequest, campaign_summary: str, audience: str, value_proposition: str) -> DraftResponse:
    base_url = request.api_base_url or os.getenv("COPILOT_API_BASE_URL", "https://models.github.ai/inference")
    model = request.model or os.getenv("COPILOT_MODEL", "openai/gpt-4.1-mini")
    prompt = build_prompt(request, campaign_summary, audience, value_proposition)

    if not request.api_key:
        raise HTTPException(status_code=400, detail="GitHub access token is required")

    headers = {
        "Authorization": f"Bearer {request.api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Return only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(f"{base_url.rstrip('/')}/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"AI request failed: {exc}") from exc

    try:
        content = data["choices"][0]["message"]["content"]
        artifact = DraftArtifact.model_validate_json(content)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="AI response was not valid draft JSON") from exc

    return DraftResponse(prompt_used=prompt, artifact=artifact)