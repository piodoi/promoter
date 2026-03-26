from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, HttpUrl


class Campaign(BaseModel):
    id: str
    name: str
    site_url: HttpUrl
    summary: str
    audience: str
    value_proposition: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CampaignCreate(BaseModel):
    name: str
    site_url: HttpUrl
    summary: str
    audience: str
    value_proposition: str


class DirectoryEntry(BaseModel):
    id: str
    campaign_id: str
    name: str
    url: HttpUrl
    category: str
    status: str = "planned"
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DirectoryEntryCreate(BaseModel):
    name: str
    url: HttpUrl
    category: str
    status: str = "planned"
    notes: Optional[str] = None


class SocialChannel(BaseModel):
    id: str
    campaign_id: str
    platform: str
    handle_or_group: str
    strategy: str
    status: str = "draft"
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SocialChannelCreate(BaseModel):
    platform: str
    handle_or_group: str
    strategy: str
    status: str = "draft"
    notes: Optional[str] = None


class KeywordPlan(BaseModel):
    id: str
    campaign_id: str
    term: str
    intent: str
    target_sites: List[str] = Field(default_factory=list)
    status: str = "planned"
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class KeywordPlanCreate(BaseModel):
    term: str
    intent: str
    target_sites: List[str] = Field(default_factory=list)
    status: str = "planned"
    notes: Optional[str] = None


class WebTarget(BaseModel):
    id: str
    campaign_id: str
    provider: str
    title: str
    url: str
    subtitle: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class WebTargetCreate(BaseModel):
    provider: str
    title: str
    url: str
    subtitle: Optional[str] = None
    notes: Optional[str] = None


class AdminSettings(BaseModel):
    copilot_api_key: Optional[str] = None
    copilot_api_base_url: str = "https://models.github.ai/inference"
    copilot_model: str = "openai/gpt-4.1-mini"
    default_channel: str = "Directory listing"
    default_objective: str = "Create a concise product listing for a vetted software directory."
    default_constraints: str = "Keep it factual, short, and suitable for manual review."
    github_client_id: Optional[str] = None
    github_client_secret: Optional[str] = None
    github_oauth_redirect_uri: Optional[str] = None
    github_access_token: Optional[str] = None
    github_login: Optional[str] = None
    brave_search_api_key: Optional[str] = None
    facebook_access_token: Optional[str] = None
    facebook_page_id: Optional[str] = None
    instagram_access_token: Optional[str] = None
    instagram_ig_user_id: Optional[str] = None
    reddit_access_token: Optional[str] = None
    reddit_user_agent: str = "promoter/0.1 by promanage"


class AdminSettingsUpdate(BaseModel):
    copilot_api_key: Optional[str] = None
    copilot_api_base_url: Optional[str] = None
    copilot_model: Optional[str] = None
    default_channel: Optional[str] = None
    default_objective: Optional[str] = None
    default_constraints: Optional[str] = None
    github_client_id: Optional[str] = None
    github_client_secret: Optional[str] = None
    github_oauth_redirect_uri: Optional[str] = None
    github_access_token: Optional[str] = None
    github_login: Optional[str] = None
    brave_search_api_key: Optional[str] = None
    facebook_access_token: Optional[str] = None
    facebook_page_id: Optional[str] = None
    instagram_access_token: Optional[str] = None
    instagram_ig_user_id: Optional[str] = None
    reddit_access_token: Optional[str] = None
    reddit_user_agent: Optional[str] = None


class DraftRequest(BaseModel):
    api_key: Optional[str] = None
    api_base_url: Optional[str] = None
    model: Optional[str] = None
    campaign_id: str
    objective: str
    channel: str
    constraints: Optional[str] = None


class GitHubAuthStartRequest(BaseModel):
    frontend_redirect: str


class DraftArtifact(BaseModel):
    headline: str
    summary: str
    call_to_action: str
    bullets: List[str]
    notes: str


class DraftResponse(BaseModel):
    prompt_used: str
    artifact: DraftArtifact


class SocialProviderCapability(BaseModel):
    provider: str
    discovery_label: str
    posting_label: str
    search_supported: bool = True
    posting_supported: bool = True
    notes: str


class SocialSearchRequest(BaseModel):
    provider: str
    query: str
    limit: int = 10
    site_filter: Optional[str] = None


class SocialSearchResult(BaseModel):
    id: str
    title: str
    subtitle: Optional[str] = None
    url: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SocialSearchResponse(BaseModel):
    provider: str
    query: str
    results: List[SocialSearchResult] = Field(default_factory=list)
    note: Optional[str] = None
    applied_query: Optional[str] = None


class ProviderStatus(BaseModel):
    provider: str
    configured: bool
    search_supported: bool
    posting_supported: bool
    missing_fields: List[str] = Field(default_factory=list)
    note: Optional[str] = None


class SocialPostRequest(BaseModel):
    provider: str
    target_id: str
    title: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    approve_post: bool = False


class SocialPostResponse(BaseModel):
    provider: str
    approved: bool
    executed: bool
    target_id: str
    external_id: Optional[str] = None
    preview: Dict[str, Any] = Field(default_factory=dict)
    note: Optional[str] = None


class AppState(BaseModel):
    settings: AdminSettings = Field(default_factory=AdminSettings)
    campaigns: List[Campaign] = Field(default_factory=list)
    directories: List[DirectoryEntry] = Field(default_factory=list)
    social_channels: List[SocialChannel] = Field(default_factory=list)
    keywords: List[KeywordPlan] = Field(default_factory=list)
    web_targets: List[WebTarget] = Field(default_factory=list)