import { FormEvent, useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8100';

type Settings = {
  copilot_api_key?: string | null;
  copilot_api_base_url: string;
  copilot_model: string;
  default_channel: string;
  default_objective: string;
  default_constraints: string;
  github_client_id?: string | null;
  github_client_secret?: string | null;
  github_oauth_redirect_uri?: string | null;
  github_access_token?: string | null;
  github_login?: string | null;
  brave_search_api_key?: string | null;
  facebook_access_token?: string | null;
  facebook_page_id?: string | null;
  instagram_access_token?: string | null;
  instagram_ig_user_id?: string | null;
  reddit_access_token?: string | null;
  reddit_user_agent: string;
};

type SocialProviderCapability = {
  provider: string;
  discovery_label: string;
  posting_label: string;
  search_supported: boolean;
  posting_supported: boolean;
  notes: string;
};

type ProviderStatus = {
  provider: string;
  configured: boolean;
  search_supported: boolean;
  posting_supported: boolean;
  missing_fields: string[];
  note?: string | null;
};

type SocialSearchResult = {
  id: string;
  title: string;
  subtitle?: string | null;
  url?: string | null;
  metadata: Record<string, unknown>;
};

type SocialSearchResponse = {
  provider: string;
  query: string;
  results: SocialSearchResult[];
  note?: string | null;
  applied_query?: string | null;
};

type SocialPostResponse = {
  provider: string;
  approved: boolean;
  executed: boolean;
  target_id: string;
  external_id?: string | null;
  preview: Record<string, unknown>;
  note?: string | null;
};

type Campaign = {
  id: string;
  name: string;
  site_url: string;
  summary: string;
  audience: string;
  value_proposition: string;
};

type DirectoryEntry = {
  id: string;
  campaign_id: string;
  name: string;
  url: string;
  category: string;
  status: string;
  notes?: string | null;
};

type SocialChannel = {
  id: string;
  campaign_id: string;
  platform: string;
  handle_or_group: string;
  strategy: string;
  status: string;
  notes?: string | null;
};

type KeywordPlan = {
  id: string;
  campaign_id: string;
  term: string;
  intent: string;
  target_sites: string[];
  status: string;
  notes?: string | null;
};

type WebTarget = {
  id: string;
  campaign_id: string;
  provider: string;
  title: string;
  url: string;
  subtitle?: string | null;
  notes?: string | null;
};

type StateResponse = {
  settings: Settings;
  campaigns: Campaign[];
  directories: DirectoryEntry[];
  social_channels: SocialChannel[];
  keywords: KeywordPlan[];
  web_targets: WebTarget[];
};

type DraftArtifact = {
  headline: string;
  summary: string;
  call_to_action: string;
  bullets: string[];
  notes: string;
};

const emptyCampaign = {
  name: '',
  site_url: '',
  summary: '',
  audience: '',
  value_proposition: '',
};

const emptyKeyword = {
  term: '',
  intent: '',
  target_sites: '',
  status: 'planned',
  notes: '',
};

const siteFilterOptions = [
  { value: 'any', label: 'Any site' },
  { value: 'reddit', label: 'reddit.com' },
  { value: 'facebook', label: 'facebook.com' },
  { value: 'instagram', label: 'instagram.com' },
  { value: 'x', label: 'x.com' },
];

export default function App() {
  const [state, setState] = useState<StateResponse>({
    settings: {
      copilot_api_key: '',
      copilot_api_base_url: 'https://models.github.ai/inference',
      copilot_model: 'openai/gpt-4.1-mini',
      default_channel: 'Directory listing',
      default_objective: 'Create a concise product listing for a vetted software directory.',
      default_constraints: 'Keep it factual, short, and suitable for manual review.',
      github_client_id: '',
      github_client_secret: '',
      github_oauth_redirect_uri: 'http://localhost:8100/api/github/oauth/callback',
      github_access_token: '',
      github_login: '',
      brave_search_api_key: '',
      facebook_access_token: '',
      facebook_page_id: '',
      instagram_access_token: '',
      instagram_ig_user_id: '',
      reddit_access_token: '',
      reddit_user_agent: 'promoter/0.1 by promanage',
    },
    campaigns: [],
    directories: [],
    social_channels: [],
    keywords: [],
    web_targets: [],
  });
  const [campaignForm, setCampaignForm] = useState(emptyCampaign);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [settingsForm, setSettingsForm] = useState<StateResponse['settings']>({
    copilot_api_key: '',
    copilot_api_base_url: 'https://models.github.ai/inference',
    copilot_model: 'openai/gpt-4.1-mini',
    default_channel: 'Directory listing',
    default_objective: 'Create a concise product listing for a vetted software directory.',
    default_constraints: 'Keep it factual, short, and suitable for manual review.',
    github_client_id: '',
    github_client_secret: '',
    github_oauth_redirect_uri: 'http://localhost:8100/api/github/oauth/callback',
    github_access_token: '',
    github_login: '',
    brave_search_api_key: '',
    facebook_access_token: '',
    facebook_page_id: '',
    instagram_access_token: '',
    instagram_ig_user_id: '',
    reddit_access_token: '',
    reddit_user_agent: 'promoter/0.1 by promanage',
  });
  const [draftChannel, setDraftChannel] = useState('Directory listing');
  const [draftObjective, setDraftObjective] = useState('Create a concise product listing for a vetted software directory.');
  const [draftConstraints, setDraftConstraints] = useState('Keep it factual, short, and suitable for manual review.');
  const [keywordForm, setKeywordForm] = useState(emptyKeyword);
  const [draft, setDraft] = useState<DraftArtifact | null>(null);
  const [providers, setProviders] = useState<SocialProviderCapability[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [searchProvider, setSearchProvider] = useState('reddit');
  const [searchQuery, setSearchQuery] = useState('property management');
  const [searchSiteFilter, setSearchSiteFilter] = useState('any');
  const [searchResponse, setSearchResponse] = useState<SocialSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [postProvider, setPostProvider] = useState('reddit');
  const [postTargetId, setPostTargetId] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [postImageUrl, setPostImageUrl] = useState('');
  const [approvePost, setApprovePost] = useState(false);
  const [postResponse, setPostResponse] = useState<SocialPostResponse | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadState() {
    const [stateResponse, providerResponse, statusResponse] = await Promise.all([
      fetch(`${API_URL}/api/state`),
      fetch(`${API_URL}/api/social/providers`),
      fetch(`${API_URL}/api/social/status`),
    ]);
    const data = await stateResponse.json();
    const providerData = await providerResponse.json();
    const statusData = await statusResponse.json();
    setState(data);
    setProviders(providerData);
    setProviderStatuses(statusData);
    setSettingsForm(data.settings);
    setDraftChannel(data.settings.default_channel || 'Directory listing');
    setDraftObjective(data.settings.default_objective || 'Create a concise product listing for a vetted software directory.');
    setDraftConstraints(data.settings.default_constraints || 'Keep it factual, short, and suitable for manual review.');
    if (!selectedCampaignId && data.campaigns.length > 0) {
      setSelectedCampaignId(data.campaigns[0].id);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const githubAuth = params.get('github_auth');
    if (githubAuth) {
      if (githubAuth === 'success') {
        const githubLogin = params.get('github_login');
        setMessage(githubLogin ? `GitHub connected as ${githubLogin}.` : 'GitHub connected.');
      } else {
        setMessage(params.get('github_message') || 'GitHub login failed.');
      }
      params.delete('github_auth');
      params.delete('github_login');
      params.delete('github_message');
      const query = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    }
    void loadState();
  }, []);

  async function startGitHubLogin() {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/github/oauth/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frontend_redirect: `${window.location.origin}${window.location.pathname}` }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to start GitHub login');
      }
      window.location.assign(data.authorize_url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to start GitHub login');
      setLoading(false);
    }
  }

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignForm),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create campaign');
      }
      const campaign = await response.json();
      setCampaignForm(emptyCampaign);
      setSelectedCampaignId(campaign.id);
      setMessage('Campaign created.');
      await loadState();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  }

  async function generateDraft(event: FormEvent) {
    event.preventDefault();
    if (!selectedCampaignId) {
      setMessage('Create or select a campaign first.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: settingsForm.github_access_token || settingsForm.copilot_api_key,
          api_base_url: settingsForm.copilot_api_base_url,
          model: settingsForm.copilot_model,
          campaign_id: selectedCampaignId,
          objective: draftObjective,
          channel: draftChannel,
          constraints: draftConstraints,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to generate draft');
      }
      setDraft(data.artifact);
      setMessage('Draft generated. Review before using it anywhere.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to generate draft');
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to save settings');
      }
      setSettingsForm(data);
      setMessage('Settings saved locally for this promoter instance.');
      await loadState();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  }

  async function createKeyword(event: FormEvent) {
    event.preventDefault();
    if (!selectedCampaignId) {
      setMessage('Select a campaign first.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/campaigns/${selectedCampaignId}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: keywordForm.term,
          intent: keywordForm.intent,
          target_sites: keywordForm.target_sites.split(',').map((item) => item.trim()).filter(Boolean),
          status: keywordForm.status,
          notes: keywordForm.notes || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to add keyword');
      }
      setKeywordForm(emptyKeyword);
      setMessage('Keyword plan added.');
      await loadState();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to add keyword');
    } finally {
      setLoading(false);
    }
  }

  async function searchSocial(event: FormEvent) {
    event.preventDefault();
    setSearching(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/social/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: searchProvider, query: searchQuery, limit: 10, site_filter: searchSiteFilter }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to search social provider');
      }
      setSearchResponse(data);
      setMessage('Discovery results loaded. Pick a target and review before posting.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to search social provider');
    } finally {
      setSearching(false);
    }
  }

  async function saveWebTarget(result: SocialSearchResult) {
    if (!selectedCampaignId) {
      setMessage('Select a campaign before saving a web target.');
      return;
    }
    if (!result.url) {
      setMessage('This result does not include a link that can be saved.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/campaigns/${selectedCampaignId}/web-targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: searchResponse?.provider || searchProvider,
          title: result.title,
          url: result.url,
          subtitle: result.subtitle || undefined,
          notes: searchResponse?.applied_query ? `Search: ${searchResponse.applied_query}` : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to save web target');
      }
      setMessage('Web target saved to the selected campaign.');
      await loadState();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save web target');
    } finally {
      setLoading(false);
    }
  }

  async function executePost(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/social/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: postProvider,
          target_id: postTargetId,
          title: postTitle || undefined,
          body: postBody || undefined,
          image_url: postImageUrl || undefined,
          approve_post: approvePost,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to execute social post');
      }
      setPostResponse(data);
      setMessage(data.executed ? 'Official API post executed.' : 'Preview generated. Approval is still required to execute.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to execute social post');
    } finally {
      setLoading(false);
    }
  }

  const selectedCampaign = state.campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;
  const selectedDirectories = state.directories.filter((entry) => entry.campaign_id === selectedCampaignId);
  const selectedChannels = state.social_channels.filter((entry) => entry.campaign_id === selectedCampaignId);
  const selectedKeywords = state.keywords.filter((entry) => entry.campaign_id === selectedCampaignId);
  const selectedWebTargets = state.web_targets.filter((entry) => entry.campaign_id === selectedCampaignId);

  return (
    <div className="page-shell">
      <div className="hero-panel">
        <p className="eyebrow">Promoter</p>
        <h1>Human-reviewed marketing operations for SaaS launches.</h1>
        <p className="lede">
          Build campaign briefs, draft compliant listing copy, and track submissions without automating third-party account actions.
        </p>
      </div>

      {message ? <div className="status-banner">{message}</div> : null}

      <div className="grid-layout">
        <section className="card span-two">
          <h2>Admin settings</h2>
          <div className="draft-panel auth-panel">
            <p><strong>GitHub auth:</strong> {settingsForm.github_login ? `Connected as ${settingsForm.github_login}` : 'Not connected'}</p>
            <p className="muted">Use GitHub OAuth to obtain a user token for GitHub-hosted model access. Manual token entry remains available as a fallback.</p>
            <div className="action-row">
              <button className="secondary-button" type="button" onClick={() => void startGitHubLogin()} disabled={loading}>
                Connect with GitHub
              </button>
            </div>
          </div>
          <form className="form-grid" onSubmit={saveSettings}>
            <label className="span-two">
              Manual GitHub token fallback
              <input
                type="password"
                value={settingsForm.copilot_api_key || ''}
                onChange={(event) => setSettingsForm({ ...settingsForm, copilot_api_key: event.target.value })}
                placeholder="Optional fallback if OAuth is not used"
              />
            </label>
            <label>
              API base URL
              <input value={settingsForm.copilot_api_base_url} onChange={(event) => setSettingsForm({ ...settingsForm, copilot_api_base_url: event.target.value })} />
            </label>
            <label>
              Model
              <input value={settingsForm.copilot_model} onChange={(event) => setSettingsForm({ ...settingsForm, copilot_model: event.target.value })} />
            </label>
            <label>
              Default channel
              <input value={settingsForm.default_channel} onChange={(event) => setSettingsForm({ ...settingsForm, default_channel: event.target.value })} />
            </label>
            <label>
              Default objective
              <input value={settingsForm.default_objective} onChange={(event) => setSettingsForm({ ...settingsForm, default_objective: event.target.value })} />
            </label>
            <label className="span-two">
              Default constraints
              <textarea value={settingsForm.default_constraints} onChange={(event) => setSettingsForm({ ...settingsForm, default_constraints: event.target.value })} rows={3} />
            </label>
            <label>
              GitHub OAuth client id
              <input value={settingsForm.github_client_id || ''} onChange={(event) => setSettingsForm({ ...settingsForm, github_client_id: event.target.value })} />
            </label>
            <label>
              GitHub OAuth client secret
              <input type="password" value={settingsForm.github_client_secret || ''} onChange={(event) => setSettingsForm({ ...settingsForm, github_client_secret: event.target.value })} />
            </label>
            <label className="span-two">
              GitHub OAuth redirect URI
              <input value={settingsForm.github_oauth_redirect_uri || ''} onChange={(event) => setSettingsForm({ ...settingsForm, github_oauth_redirect_uri: event.target.value })} placeholder="http://localhost:8100/api/github/oauth/callback" />
            </label>
            <label>
              Brave Search API key
              <input type="password" value={settingsForm.brave_search_api_key || ''} onChange={(event) => setSettingsForm({ ...settingsForm, brave_search_api_key: event.target.value })} />
            </label>
            <label>
              Facebook page token
              <input type="password" value={settingsForm.facebook_access_token || ''} onChange={(event) => setSettingsForm({ ...settingsForm, facebook_access_token: event.target.value })} />
            </label>
            <label>
              Facebook page id
              <input value={settingsForm.facebook_page_id || ''} onChange={(event) => setSettingsForm({ ...settingsForm, facebook_page_id: event.target.value })} />
            </label>
            <label>
              Instagram token
              <input type="password" value={settingsForm.instagram_access_token || ''} onChange={(event) => setSettingsForm({ ...settingsForm, instagram_access_token: event.target.value })} />
            </label>
            <label>
              Instagram IG user id
              <input value={settingsForm.instagram_ig_user_id || ''} onChange={(event) => setSettingsForm({ ...settingsForm, instagram_ig_user_id: event.target.value })} />
            </label>
            <label>
              Reddit token
              <input type="password" value={settingsForm.reddit_access_token || ''} onChange={(event) => setSettingsForm({ ...settingsForm, reddit_access_token: event.target.value })} />
            </label>
            <label>
              Reddit user agent
              <input value={settingsForm.reddit_user_agent} onChange={(event) => setSettingsForm({ ...settingsForm, reddit_user_agent: event.target.value })} />
            </label>
            <button className="primary-button" type="submit" disabled={loading}>Save settings</button>
          </form>
        </section>

        <section className="card">
          <h2>Provider status</h2>
          <div className="stack-list compact">
            {providerStatuses.map((status) => (
              <div key={status.provider} className="list-item static">
                <strong>{status.provider}</strong>
                <span>{status.configured ? 'configured' : 'missing required settings'}</span>
                <span>Search: {status.search_supported ? 'yes' : 'no'} · Posting: {status.posting_supported ? 'yes' : 'no'}</span>
                {status.missing_fields.length > 0 ? <span>Missing: {status.missing_fields.join(', ')}</span> : null}
                {status.note ? <span>{status.note}</span> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="card span-two">
          <h2>Create campaign</h2>
          <form className="form-grid" onSubmit={createCampaign}>
            <label>
              Campaign name
              <input value={campaignForm.name} onChange={(event) => setCampaignForm({ ...campaignForm, name: event.target.value })} required />
            </label>
            <label>
              Site URL
              <input value={campaignForm.site_url} onChange={(event) => setCampaignForm({ ...campaignForm, site_url: event.target.value })} required />
            </label>
            <label className="span-two">
              Summary
              <textarea value={campaignForm.summary} onChange={(event) => setCampaignForm({ ...campaignForm, summary: event.target.value })} required rows={3} />
            </label>
            <label>
              Audience
              <textarea value={campaignForm.audience} onChange={(event) => setCampaignForm({ ...campaignForm, audience: event.target.value })} required rows={3} />
            </label>
            <label>
              Value proposition
              <textarea value={campaignForm.value_proposition} onChange={(event) => setCampaignForm({ ...campaignForm, value_proposition: event.target.value })} required rows={3} />
            </label>
            <button className="primary-button" type="submit" disabled={loading}>Create</button>
          </form>
        </section>

        <section className="card">
          <h2>Campaigns</h2>
          <div className="stack-list">
            {state.campaigns.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                className={campaign.id === selectedCampaignId ? 'list-item active' : 'list-item'}
                onClick={() => setSelectedCampaignId(campaign.id)}
              >
                <strong>{campaign.name}</strong>
                <span>{campaign.site_url}</span>
              </button>
            ))}
            {state.campaigns.length === 0 ? <p className="muted">No campaigns yet.</p> : null}
          </div>
        </section>

        <section className="card span-two">
          <h2>Social discovery</h2>
          <form className="form-grid" onSubmit={searchSocial}>
            <label>
              Provider
              <select value={searchProvider} onChange={(event) => setSearchProvider(event.target.value)}>
                {providers.map((provider) => <option key={provider.provider} value={provider.provider}>{provider.discovery_label}</option>)}
              </select>
            </label>
            <label>
              Query
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} required />
            </label>
            <label>
              Site filter
              <select value={searchSiteFilter} onChange={(event) => setSearchSiteFilter(event.target.value)}>
                {siteFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={searching}>{searching ? 'Searching...' : 'Search'}</button>
          </form>

          {searchResponse ? (
            <div className="stack-list compact">
              {searchResponse.note ? <p className="muted">{searchResponse.note}</p> : null}
              {searchResponse.applied_query ? <p className="muted">Applied query: {searchResponse.applied_query}</p> : null}
              {searchResponse.results.length === 0 ? <p className="muted">No results returned.</p> : null}
              {searchResponse.results.map((result) => (
                <div key={`${result.id}-${result.title}`} className="list-item static">
                  <strong>{result.title}</strong>
                  {result.subtitle ? <span>{result.subtitle}</span> : null}
                  {result.url ? <span>{result.url}</span> : null}
                  <div className="action-row">
                    {providers.find((provider) => provider.provider === searchResponse.provider)?.posting_supported ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setPostProvider(searchResponse.provider);
                          setPostTargetId(result.id);
                        }}
                      >
                        Use as post target
                      </button>
                    ) : null}
                    <button type="button" className="secondary-button" onClick={() => void saveWebTarget(result)} disabled={loading || !selectedCampaignId || !result.url}>
                      Save link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="card span-two">
          <h2>User-approved posting</h2>
          <form className="form-grid" onSubmit={executePost}>
            <label>
              Provider
              <select value={postProvider} onChange={(event) => setPostProvider(event.target.value)}>
                {providers.filter((provider) => provider.posting_supported).map((provider) => <option key={provider.provider} value={provider.provider}>{provider.posting_label}</option>)}
              </select>
            </label>
            <label>
              Target id
              <input value={postTargetId} onChange={(event) => setPostTargetId(event.target.value)} required />
            </label>
            <label>
              Title
              <input value={postTitle} onChange={(event) => setPostTitle(event.target.value)} />
            </label>
            <label>
              Image URL
              <input value={postImageUrl} onChange={(event) => setPostImageUrl(event.target.value)} placeholder="Required for Instagram publishing" />
            </label>
            <label className="span-two">
              Body
              <textarea value={postBody} onChange={(event) => setPostBody(event.target.value)} rows={4} />
            </label>
            <label className="checkbox-row span-two">
              <input type="checkbox" checked={approvePost} onChange={(event) => setApprovePost(event.target.checked)} />
              <span>I approve execution through the official provider API.</span>
            </label>
            <button className="primary-button" type="submit" disabled={loading}>Preview or post</button>
          </form>

          {postResponse ? (
            <div className="draft-panel">
              <p><strong>Provider:</strong> {postResponse.provider}</p>
              <p><strong>Target:</strong> {postResponse.target_id}</p>
              <p><strong>Executed:</strong> {postResponse.executed ? 'yes' : 'no'}</p>
              {postResponse.external_id ? <p><strong>External id:</strong> {postResponse.external_id}</p> : null}
              {postResponse.note ? <p className="muted">{postResponse.note}</p> : null}
            </div>
          ) : null}
        </section>

        <section className="card span-two">
          <h2>Draft generator</h2>
          <form className="form-grid" onSubmit={generateDraft}>
            <label>
              Channel
              <input value={draftChannel} onChange={(event) => setDraftChannel(event.target.value)} required />
            </label>
            <label>
              Objective
              <input value={draftObjective} onChange={(event) => setDraftObjective(event.target.value)} required />
            </label>
            <label className="span-two">
              Constraints
              <textarea value={draftConstraints} onChange={(event) => setDraftConstraints(event.target.value)} rows={3} />
            </label>
            <button className="primary-button" type="submit" disabled={loading || !selectedCampaignId}>Generate draft</button>
          </form>

          {draft ? (
            <div className="draft-panel">
              <h3>{draft.headline}</h3>
              <p>{draft.summary}</p>
              <p><strong>CTA:</strong> {draft.call_to_action}</p>
              <ul>
                {draft.bullets.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <p className="muted">{draft.notes}</p>
            </div>
          ) : null}
        </section>

        <section className="card">
          <h2>Keyword plan</h2>
          {selectedCampaign ? (
            <>
              <form className="form-grid single-column" onSubmit={createKeyword}>
                <label>
                  Keyword or phrase
                  <input value={keywordForm.term} onChange={(event) => setKeywordForm({ ...keywordForm, term: event.target.value })} required />
                </label>
                <label>
                  Search intent
                  <input value={keywordForm.intent} onChange={(event) => setKeywordForm({ ...keywordForm, intent: event.target.value })} required />
                </label>
                <label>
                  Target sites
                  <input value={keywordForm.target_sites} onChange={(event) => setKeywordForm({ ...keywordForm, target_sites: event.target.value })} placeholder="facebook groups, product hunt, startup directories" />
                </label>
                <label>
                  Status
                  <input value={keywordForm.status} onChange={(event) => setKeywordForm({ ...keywordForm, status: event.target.value })} />
                </label>
                <label>
                  Notes
                  <textarea value={keywordForm.notes} onChange={(event) => setKeywordForm({ ...keywordForm, notes: event.target.value })} rows={3} />
                </label>
                <button className="primary-button" type="submit" disabled={loading}>Add keyword</button>
              </form>
              <div className="stack-list compact">
                {selectedKeywords.length === 0 ? <p className="muted">No keyword plans yet.</p> : null}
                {selectedKeywords.map((entry) => (
                  <div key={entry.id} className="list-item static">
                    <strong>{entry.term}</strong>
                    <span>{entry.intent} · {entry.status}</span>
                    {entry.target_sites.length > 0 ? <span>{entry.target_sites.join(', ')}</span> : null}
                  </div>
                ))}
              </div>
            </>
          ) : <p className="muted">Select a campaign.</p>}
        </section>

        <section className="card">
          <h2>Web target links</h2>
          {selectedCampaign ? (
            <div className="stack-list compact">
              {selectedWebTargets.length === 0 ? <p className="muted">Save discovery results here for later manual review.</p> : null}
              {selectedWebTargets.map((entry) => (
                <div key={entry.id} className="list-item static">
                  <strong>{entry.title}</strong>
                  <span>{entry.provider}</span>
                  <a href={entry.url} target="_blank" rel="noreferrer">{entry.url}</a>
                  {entry.subtitle ? <span>{entry.subtitle}</span> : null}
                  {entry.notes ? <span>{entry.notes}</span> : null}
                </div>
              ))}
            </div>
          ) : <p className="muted">Select a campaign.</p>}
        </section>

        <section className="card">
          <h2>Directory plan</h2>
          {selectedCampaign ? (
            <div className="stack-list compact">
              {selectedDirectories.length === 0 ? <p className="muted">Add endpoints through the API or extend the UI next.</p> : null}
              {selectedDirectories.map((entry) => (
                <div key={entry.id} className="list-item static">
                  <strong>{entry.name}</strong>
                  <span>{entry.category} · {entry.status}</span>
                </div>
              ))}
            </div>
          ) : <p className="muted">Select a campaign.</p>}
        </section>

        <section className="card">
          <h2>Channel notes</h2>
          {selectedCampaign ? (
            <div className="stack-list compact">
              {selectedChannels.length === 0 ? <p className="muted">Track approved channels, groups, or partners here.</p> : null}
              {selectedChannels.map((entry) => (
                <div key={entry.id} className="list-item static">
                  <strong>{entry.platform}</strong>
                  <span>{entry.handle_or_group} · {entry.status}</span>
                </div>
              ))}
            </div>
          ) : <p className="muted">Select a campaign.</p>}
        </section>
      </div>

      <section className="card footer-note">
        <h2>Scope guardrails</h2>
        <p>
          This scaffold is intentionally built for assisted marketing work: drafting, planning, keyword discovery planning, tracking, and manual review. Add only API-based integrations that comply with platform rules.
        </p>
          <div className="stack-list compact notes-grid">
            {providers.map((provider) => (
              <div key={provider.provider} className="list-item static">
                <strong>{provider.discovery_label}</strong>
                <span>{provider.notes}</span>
              </div>
            ))}
          </div>
      </section>
    </div>
  );
}