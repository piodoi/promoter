import json
import os
import uuid
from datetime import datetime
from pathlib import Path

from app.models import (
    AdminSettings,
    AdminSettingsUpdate,
    AppState,
    Campaign,
    CampaignCreate,
    DirectoryEntry,
    DirectoryEntryCreate,
    KeywordPlan,
    KeywordPlanCreate,
    SocialChannel,
    SocialChannelCreate,
    WebTarget,
    WebTargetCreate,
)


class Storage:
    def __init__(self) -> None:
        data_dir = Path(os.getenv("PROMOTER_DATA_DIR", Path(__file__).resolve().parents[2] / "data"))
        data_dir.mkdir(parents=True, exist_ok=True)
        self._file_path = data_dir / "state.json"

    def load(self) -> AppState:
        if not self._file_path.exists():
            return AppState()

        with open(self._file_path, "r", encoding="utf-8") as handle:
            raw = json.load(handle)
        return AppState(**raw)

    def save(self, state: AppState) -> AppState:
        with open(self._file_path, "w", encoding="utf-8") as handle:
            json.dump(state.model_dump(mode="json"), handle, indent=2)
        return state

    def create_campaign(self, payload: CampaignCreate) -> Campaign:
        state = self.load()
        campaign = Campaign(id=str(uuid.uuid4()), **payload.model_dump())
        state.campaigns.append(campaign)
        self.save(state)
        return campaign

    def create_directory(self, campaign_id: str, payload: DirectoryEntryCreate) -> DirectoryEntry:
        state = self.load()
        entry = DirectoryEntry(id=str(uuid.uuid4()), campaign_id=campaign_id, **payload.model_dump())
        state.directories.append(entry)
        self.save(state)
        return entry

    def create_social_channel(self, campaign_id: str, payload: SocialChannelCreate) -> SocialChannel:
        state = self.load()
        channel = SocialChannel(id=str(uuid.uuid4()), campaign_id=campaign_id, **payload.model_dump())
        state.social_channels.append(channel)
        self.save(state)
        return channel

    def create_keyword(self, campaign_id: str, payload: KeywordPlanCreate) -> KeywordPlan:
        state = self.load()
        keyword = KeywordPlan(id=str(uuid.uuid4()), campaign_id=campaign_id, **payload.model_dump())
        state.keywords.append(keyword)
        self.save(state)
        return keyword

    def create_web_target(self, campaign_id: str, payload: WebTargetCreate) -> WebTarget:
        state = self.load()
        target = WebTarget(id=str(uuid.uuid4()), campaign_id=campaign_id, **payload.model_dump())
        state.web_targets.append(target)
        self.save(state)
        return target

    def update_settings(self, payload: AdminSettingsUpdate) -> AdminSettings:
        state = self.load()
        updated = state.settings.model_copy(update=payload.model_dump(exclude_unset=True))
        state.settings = updated
        self.save(state)
        return updated

    def list_state(self) -> AppState:
        return self.load()

    def touch_campaign(self, campaign_id: str) -> None:
        state = self.load()
        now = datetime.utcnow()
        for campaign in state.campaigns:
            if campaign.id == campaign_id:
                campaign.updated_at = now
        for keyword in state.keywords:
            if keyword.campaign_id == campaign_id:
                keyword.updated_at = now
        for target in state.web_targets:
            if target.campaign_id == campaign_id:
                target.updated_at = now
        self.save(state)


storage = Storage()