import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getApiUrl } from '../config';

const ICONS = {
  Users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  Niches: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
  ),
  'YT Channels': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/><path d="M21.54 4.15A1.98 1.98 0 0 0 20 3.5H4c-.83 0-1.54.6-1.54 1.4v12.2c0 .8.71 1.4 1.54 1.4h16c.83 0 1.54-.6 1.54-1.4V4.55c0-.26-.1-.5-.27-.7l-.73-.7z"/></svg>
  ),
  'FB Pages': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
  ),
  'Whop Channels': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/><path d="M16 2v20"/></svg>
  ),
  'Whop Campaigns': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3h4v18h-4z"/><path d="M3 7h4v12H3z"/><path d="M17 10h4v9h-4z"/></svg>
  ),
};

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState('Users');

  const [users, setUsers] = useState([]);
  const [niches, setNiches] = useState([]);
  const [ytChannels, setYtChannels] = useState([]);
  const [fbPages, setFbPages] = useState([]);
  const [whopChannels, setWhopChannels] = useState([]);
  const [whopCampaigns, setWhopCampaigns] = useState([]);

  const [loading, setLoading] = useState({});
  const [error, setError] = useState('');

  const [userNichesMap, setUserNichesMap] = useState({});
  const [userYtMap, setUserYtMap] = useState({});

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [addForm, setAddForm] = useState({});
  const [showAdd, setShowAdd] = useState(false);

  const authHeader = useMemo(() => ({ 'X-Admin-Password': password }), [password]);

  const apiGet = useCallback(async (path) => {
    const res = await fetch(getApiUrl(path), { headers: authHeader });
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  }, [authHeader]);

  const apiPost = useCallback(async (path, body) => {
    const res = await fetch(getApiUrl(path), {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  }, [authHeader]);

  const apiPut = useCallback(async (path, body) => {
    const res = await fetch(getApiUrl(path), {
      method: 'PUT',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  }, [authHeader]);

  const apiDelete = useCallback(async (path) => {
    const res = await fetch(getApiUrl(path), { method: 'DELETE', headers: authHeader });
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  }, [authHeader]);

  const setLoadingState = (key, val) => setLoading(prev => ({ ...prev, [key]: val }));

  const loadAll = useCallback(async () => {
    try {
      const [u, n, y, f, wc, wca] = await Promise.all([
        apiGet('/api/admin/users').catch(() => []),
        apiGet('/api/admin/niches').catch(() => []),
        apiGet('/api/admin/youtube-channels').catch(() => []),
        apiGet('/api/admin/fb-pages').catch(() => []),
        apiGet('/api/admin/whop-channels').catch(() => []),
        apiGet('/api/admin/whop-campaigns').catch(() => []),
      ]);
      setUsers(u);
      setNiches(n);
      setYtChannels(y);
      setFbPages(f);
      setWhopChannels(wc);
      setWhopCampaigns(wca);

      const nicheNameMap = {};
      n.forEach(ni => { nicheNameMap[ni.id] = ni.name; });
      const ytNameMap = {};
      y.forEach(ch => { ytNameMap[ch.id] = ch.name; });

      const uNiches = {};
      const uYt = {};

      await Promise.all(u.map(async (user) => {
        try {
          const [nicheData, ytData] = await Promise.all([
            apiGet(`/api/admin/users/${user.id}/niches`),
            apiGet(`/api/admin/users/${user.id}/youtube-channels`),
          ]);
          uNiches[user.id] = (nicheData.niche_ids || []).map(id => nicheNameMap[id]).filter(Boolean);
          uYt[user.id] = (ytData.channel_ids || []).map(id => ytNameMap[id]).filter(Boolean);
        } catch {
          uNiches[user.id] = [];
          uYt[user.id] = [];
        }
      }));

      setUserNichesMap(uNiches);
      setUserYtMap(uYt);
    } catch (e) {
      setError(e.message);
    }
  }, [apiGet]);

  useEffect(() => {
    if (authenticated) loadAll();
  }, [authenticated, loadAll]);

  const handleLogin = async () => {
    setAuthError('');
    try {
      await apiGet('/api/admin/users');
      setAuthenticated(true);
    } catch (e) {
      setAuthError(e.message || 'Invalid password');
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ ...item });
    setShowAdd(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (entity, id) => {
    const key = `edit-${entity}-${id}`;
    setLoadingState(key, true);
    setError('');
    try {
      if (entity === 'users') {
        await apiPut(`/api/admin/users/${id}`, { name: editForm.name });
      } else if (entity === 'niches') {
        await apiPut(`/api/admin/niches/${id}`, { name: editForm.name });
      } else if (entity === 'youtube-channels') {
        await apiPut(`/api/admin/youtube-channels/${id}`, {
          name: editForm.name,
          username: editForm.username,
          url: editForm.url,
          niche_id: editForm.niche_id || null,
        });
      } else if (entity === 'fb-pages') {
        await apiPut(`/api/admin/fb-pages/${id}`, {
          name: editForm.name,
          page_name: editForm.page_name,
          url: editForm.url,
        });
      } else if (entity === 'whop-channels') {
        await apiPut(`/api/admin/whop-channels/${id}`, { name: editForm.name });
      } else if (entity === 'whop-campaigns') {
        await apiPut(`/api/admin/whop-campaigns/${id}`, {
          name: editForm.name,
          whop_channel_id: editForm.whop_channel_id || null,
        });
      }
      setEditingId(null);
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingState(key, false);
    }
  };

  const handleDelete = async (entity, id) => {
    if (!window.confirm(`Delete this ${entity.slice(0, -1)}?`)) return;
    const key = `del-${entity}-${id}`;
    setLoadingState(key, true);
    setError('');
    try {
      if (entity === 'users') await apiDelete(`/api/admin/users/${id}`);
      else if (entity === 'niches') await apiDelete(`/api/admin/niches/${id}`);
      else if (entity === 'youtube-channels') await apiDelete(`/api/admin/youtube-channels/${id}`);
      else if (entity === 'fb-pages') await apiDelete(`/api/admin/fb-pages/${id}`);
      else if (entity === 'whop-channels') await apiDelete(`/api/admin/whop-channels/${id}`);
      else if (entity === 'whop-campaigns') await apiDelete(`/api/admin/whop-campaigns/${id}`);
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingState(key, false);
    }
  };

  const handleAdd = async (entity) => {
    const key = `add-${entity}`;
    setLoadingState(key, true);
    setError('');
    try {
      if (entity === 'users') {
        await apiPost('/api/admin/users', { name: addForm.name });
      } else if (entity === 'niches') {
        await apiPost('/api/admin/niches', { name: addForm.name });
      } else if (entity === 'youtube-channels') {
        await apiPost('/api/admin/youtube-channels', {
          name: addForm.name,
          username: addForm.username,
          url: addForm.url,
          niche_id: addForm.niche_id || null,
        });
      } else if (entity === 'fb-pages') {
        await apiPost('/api/admin/fb-pages', {
          name: addForm.name,
          page_name: addForm.page_name,
          url: addForm.url,
        });
      } else if (entity === 'whop-channels') {
        await apiPost('/api/admin/whop-channels', { name: addForm.name });
      } else if (entity === 'whop-campaigns') {
        await apiPost('/api/admin/whop-campaigns', {
          name: addForm.name,
          whop_channel_id: addForm.whop_channel_id || null,
        });
      }
      setShowAdd(false);
      setAddForm({});
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingState(key, false);
    }
  };

  const [nicheModal, setNicheModal] = useState(null);
  const [nicheModalIds, setNicheModalIds] = useState([]);
  const [nicheModalLoading, setNicheModalLoading] = useState(false);

  const openNicheModal = async (user) => {
    setNicheModal(user);
    setNicheModalLoading(true);
    try {
      const data = await apiGet(`/api/admin/users/${user.id}/niches`);
      setNicheModalIds(data.niche_ids || []);
    } catch (e) {
      setError(e.message);
      setNicheModalIds([]);
    }
    setNicheModalLoading(false);
  };

  const toggleNicheId = (id) => {
    setNicheModalIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const saveNicheModal = async () => {
    if (!nicheModal) return;
    try {
      await apiPut(`/api/admin/users/${nicheModal.id}/niches`, { niche_ids: nicheModalIds });
      setNicheModal(null);
      loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  const [ytModal, setYtModal] = useState(null);
  const [ytModalIds, setYtModalIds] = useState([]);
  const [ytModalLoading, setYtModalLoading] = useState(false);
  const [ytFiltered, setYtFiltered] = useState([]);

  const openYtModal = async (user) => {
    setYtModal(user);
    setYtModalLoading(true);
    try {
      const [nicheData, ytData, linkedData] = await Promise.all([
        apiGet(`/api/admin/users/${user.id}/niches`),
        apiGet('/api/admin/youtube-channels'),
        apiGet(`/api/admin/users/${user.id}/youtube-channels`),
      ]);
      const userNicheIds = nicheData.niche_ids || [];
      setYtFiltered(ytData.filter(ch => userNicheIds.includes(ch.niche_id)));
      setYtModalIds(linkedData.channel_ids || []);
    } catch (e) {
      setError(e.message);
      setYtFiltered([]);
      setYtModalIds([]);
    }
    setYtModalLoading(false);
  };

  const toggleYtId = (id) => {
    setYtModalIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const saveYtModal = async () => {
    if (!ytModal) return;
    try {
      await apiPut(`/api/admin/users/${ytModal.id}/youtube-channels`, { channel_ids: ytModalIds });
      setYtModal(null);
      loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  const [wcNicheModal, setWcNicheModal] = useState(null);
  const [wcNicheModalIds, setWcNicheModalIds] = useState([]);
  const [wcNicheModalLoading, setWcNicheModalLoading] = useState(false);

  const openWcNicheModal = async (campaign) => {
    setWcNicheModal(campaign);
    setWcNicheModalLoading(true);
    try {
      const data = await apiGet(`/api/admin/whop-campaigns/${campaign.id}/niches`);
      setWcNicheModalIds(data.niche_ids || []);
    } catch (e) {
      setError(e.message);
      setWcNicheModalIds([]);
    }
    setWcNicheModalLoading(false);
  };

  const toggleWcNicheId = (id) => {
    setWcNicheModalIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const saveWcNicheModal = async () => {
    if (!wcNicheModal) return;
    try {
      await apiPut(`/api/admin/whop-campaigns/${wcNicheModal.id}/niches`, { niche_ids: wcNicheModalIds });
      setWcNicheModal(null);
      loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  // Whop Campaign → YT Channels modal (filtered by campaign's niches)
  const [campaignYtModal, setCampaignYtModal] = useState(null);
  const [campaignYtModalIds, setCampaignYtModalIds] = useState([]);
  const [campaignYtModalLoading, setCampaignYtModalLoading] = useState(false);
  const [campaignYtFiltered, setCampaignYtFiltered] = useState([]);

  const openCampaignYtModal = async (campaign) => {
    setCampaignYtModal(campaign);
    setCampaignYtModalLoading(true);
    try {
      const [nicheData, ytData, linkedData] = await Promise.all([
        apiGet(`/api/admin/whop-campaigns/${campaign.id}/niches`),
        apiGet('/api/admin/youtube-channels'),
        apiGet(`/api/admin/whop-campaigns/${campaign.id}/youtube-channels`),
      ]);
      const nicheIds = nicheData.niche_ids || [];
      setCampaignYtFiltered(ytData.filter(ch => nicheIds.includes(ch.niche_id)));
      setCampaignYtModalIds(linkedData.channel_ids || []);
    } catch (e) {
      setError(e.message);
      setCampaignYtFiltered([]);
      setCampaignYtModalIds([]);
    }
    setCampaignYtModalLoading(false);
  };

  const toggleCampaignYtId = (id) => {
    setCampaignYtModalIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const saveCampaignYtModal = async () => {
    if (!campaignYtModal) return;
    try {
      await apiPut(`/api/admin/whop-campaigns/${campaignYtModal.id}/youtube-channels`, { channel_ids: campaignYtModalIds });
      setCampaignYtModal(null);
      loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  // YT Channel → Whop Campaigns modal (filtered by channel's niche)
  const [ytCampaignModal, setYtCampaignModal] = useState(null);
  const [ytCampaignModalIds, setYtCampaignModalIds] = useState([]);
  const [ytCampaignModalLoading, setYtCampaignModalLoading] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState(new Set());

  const toggleExpandUser = (id) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openYtCampaignModal = async (channel) => {
    setYtCampaignModal(channel);
    setYtCampaignModalLoading(true);
    try {
      const linkedData = await apiGet(`/api/admin/youtube-channels/${channel.id}/whop-campaigns`);
      setYtCampaignModalIds(linkedData.campaign_ids || []);
    } catch (e) {
      setError(e.message);
      setYtCampaignModalIds([]);
    }
    setYtCampaignModalLoading(false);
  };

  const toggleYtCampaignId = (id) => {
    setYtCampaignModalIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const saveYtCampaignModal = async () => {
    if (!ytCampaignModal) return;
    try {
      await apiPut(`/api/admin/youtube-channels/${ytCampaignModal.id}/whop-campaigns`, { campaign_ids: ytCampaignModalIds });
      setYtCampaignModal(null);
      loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!authenticated) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-zinc-900/80 border border-zinc-700/50 rounded-2xl p-8 text-center space-y-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h2 className="text-xl font-bold text-white">Admin Access</h2>
          <p className="text-sm text-zinc-400">Enter admin password to manage users, niches, channels, and pages.</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
            autoFocus
          />
          {authError && <p className="text-red-400 text-sm">{authError}</p>}
          <button
            onClick={handleLogin}
            className="w-full px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold transition-all"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  const tabs = ['Users', 'Niches', 'YT Channels', 'FB Pages', 'Whop Channels', 'Whop Campaigns'];

  const entityKey = (tab) => {
    if (tab === 'Users') return 'users';
    if (tab === 'Niches') return 'niches';
    if (tab === 'YT Channels') return 'youtube-channels';
    if (tab === 'FB Pages') return 'fb-pages';
    if (tab === 'Whop Channels') return 'whop-channels';
    if (tab === 'Whop Campaigns') return 'whop-campaigns';
  };

  const currentData = () => {
    if (tab === 'Users') return users;
    if (tab === 'Niches') return niches;
    if (tab === 'YT Channels') return ytChannels;
    if (tab === 'FB Pages') return fbPages;
    if (tab === 'Whop Channels') return whopChannels;
    if (tab === 'Whop Campaigns') return whopCampaigns;
    return [];
  };

  const renderRow = (item) => {
    const isEditing = editingId === item.id;
    const entity = entityKey(tab);

    if (isEditing) {
      return (
        <tr key={item.id} className="border-t border-zinc-800/50">
          <td className="py-3 px-4 text-zinc-400 text-sm">{item.id}</td>
          <td className="py-3 px-4">
            <input
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
              value={editForm.name || ''}
              onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </td>
          {tab === 'YT Channels' && (
            <>
              <td className="py-3 px-4">
                <input
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
                  value={editForm.username || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                />
              </td>
              <td className="py-3 px-4">
                <input
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
                  value={editForm.url || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, url: e.target.value }))}
                />
              </td>
              <td className="py-3 px-4">
                <select
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
                  value={editForm.niche_id || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, niche_id: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">None</option>
                  {niches.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </td>
            </>
          )}
          {tab === 'FB Pages' && (
            <>
              <td className="py-3 px-4">
                <input
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
                  value={editForm.page_name || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, page_name: e.target.value }))}
                />
              </td>
              <td className="py-3 px-4">
                <input
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
                  value={editForm.url || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, url: e.target.value }))}
                />
              </td>
              <td className="py-3 px-4">
                <select
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
                  value={editForm.niche_id || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, niche_id: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">None</option>
                  {niches.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </td>
            </>
          )}
          {tab === 'Whop Campaigns' && (
            <>
              <td className="py-3 px-4">
                <select
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
                  value={editForm.whop_channel_id || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, whop_channel_id: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">None</option>
                  {whopChannels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </td>
            </>
          )}
          <td className="py-3 px-4">
            <div className="flex gap-2">
              <button onClick={() => handleSave(entity, item.id)} className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors">
                {loading[`edit-${entity}-${item.id}`] ? '...' : 'Save'}
              </button>
              <button onClick={cancelEdit} className="px-3 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-medium transition-colors">Cancel</button>
            </div>
          </td>
        </tr>
      );
    }

    const entityNiches = entity === 'youtube-channels' ? 'youtube-channels' : entity;

    return (
      <React.Fragment key={item.id}>
        <tr className="border-t border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
          <td className="py-3 px-4 text-zinc-400 text-sm">
            {tab === 'Users' && (
              <button onClick={() => toggleExpandUser(item.id)} className="mr-2 text-zinc-500 hover:text-zinc-300 transition-colors align-middle">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${expandedUsers.has(item.id) ? 'rotate-90' : ''}`}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            )}
            <span>{item.id}</span>
          </td>
          <td className="py-3 px-4 text-white text-sm">{item.name}</td>
        {tab === 'Users' && (
          <>
            <td className="py-3 px-4">
              <div className="flex flex-wrap gap-1">
                {(userNichesMap[item.id] || []).map(n => (
                  <span key={n} className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300">{n}</span>
                ))}
                {(userNichesMap[item.id] || []).length === 0 && (
                  <span className="text-xs text-zinc-600">—</span>
                )}
              </div>
            </td>
            <td className="py-3 px-4">
              <div className="flex flex-wrap gap-1">
                {(userYtMap[item.id] || []).map(n => (
                  <span key={n} className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">{n}</span>
                ))}
                {(userYtMap[item.id] || []).length === 0 && (
                  <span className="text-xs text-zinc-600">—</span>
                )}
              </div>
            </td>
            <td className="py-3 px-4">
              <div className="flex flex-wrap gap-1">
                {(item.youtube_channels || []).flatMap(ch => ch.campaigns || []).filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i).map(c => (
                  <span key={c.id} className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300" title={c.whop_channel_name ? `${c.whop_channel_name} / ${c.name}` : c.name}>
                    {c.whop_channel_name ? `${c.whop_channel_name} / ${c.name}` : c.name}
                  </span>
                ))}
                {(!item.youtube_channels || item.youtube_channels.flatMap(ch => ch.campaigns || []).length === 0) && (
                  <span className="text-xs text-zinc-600">—</span>
                )}
              </div>
            </td>
          </>
        )}
        {tab === 'YT Channels' && (
          <>
            <td className="py-3 px-4 text-zinc-300 text-sm">@{item.username}</td>
            <td className="py-3 px-4 text-zinc-300 text-sm">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary/80 hover:text-primary underline underline-offset-2">{item.url}</a>
            </td>
            <td className="py-3 px-4">
              <span className={`text-xs px-2 py-0.5 rounded-full ${item.niche_name ? 'bg-violet-500/15 text-violet-300' : 'bg-zinc-700/50 text-zinc-500'}`}>
                {item.niche_name || '—'}
              </span>
            </td>
            <td className="py-3 px-4">
              <div className="flex flex-wrap gap-1">
                {(item.campaigns || []).map(c => (
                  <span key={c.id} className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300">{c.name}</span>
                ))}
                {(item.campaigns || []).length === 0 && <span className="text-xs text-zinc-600">—</span>}
              </div>
            </td>
          </>
        )}
        {tab === 'FB Pages' && (
          <>
            <td className="py-3 px-4 text-zinc-300 text-sm">{item.page_name}</td>
            <td className="py-3 px-4 text-zinc-300 text-sm">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary/80 hover:text-primary underline underline-offset-2">{item.url}</a>
            </td>
            <td className="py-3 px-4">
              <span className={`text-xs px-2 py-0.5 rounded-full ${item.niche_name ? 'bg-violet-500/15 text-violet-300' : 'bg-zinc-700/50 text-zinc-500'}`}>
                {item.niche_name || '—'}
              </span>
            </td>
          </>
        )}
        {tab === 'Whop Campaigns' && (
          <>
            <td className="py-3 px-4">
              <span className={`text-xs px-2 py-0.5 rounded-full ${item.whop_channel_name ? 'bg-cyan-500/15 text-cyan-300' : 'bg-zinc-700/50 text-zinc-500'}`}>
                {item.whop_channel_name || '—'}
              </span>
            </td>
            <td className="py-3 px-4">
              <div className="flex flex-wrap gap-1">
                {(item.niches || []).map(n => (
                  <span key={n.id} className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300">{n.name}</span>
                ))}
                {(item.niches || []).length === 0 && <span className="text-xs text-zinc-600">—</span>}
              </div>
            </td>
            <td className="py-3 px-4">
              <div className="flex flex-wrap gap-1">
                {(item.youtube_channels || []).map(ch => (
                  <span key={ch.id} className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">{ch.name}</span>
                ))}
                {(item.youtube_channels || []).length === 0 && <span className="text-xs text-zinc-600">—</span>}
              </div>
            </td>
          </>
        )}
        <td className="py-3 px-4">
          <div className="flex gap-2 items-center flex-wrap">
            {tab === 'Users' && (
              <>
                <button
                  onClick={() => openNicheModal(item)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 text-xs font-medium transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  Niche
                </button>
                <button
                  onClick={() => openYtModal(item)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/><path d="M21.54 4.15A1.98 1.98 0 0 0 20 3.5H4c-.83 0-1.54.6-1.54 1.4v12.2c0 .8.71 1.4 1.54 1.4h16c.83 0 1.54-.6 1.54-1.4V4.55c0-.26-.1-.5-.27-.7l-.73-.7z"/></svg>
                  YT
                </button>
              </>
            )}
            {tab === 'Whop Campaigns' && (
              <>
                <button
                  onClick={() => openWcNicheModal(item)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 text-xs font-medium transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  Niche
                </button>
                <button
                  onClick={() => openCampaignYtModal(item)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/><path d="M21.54 4.15A1.98 1.98 0 0 0 20 3.5H4c-.83 0-1.54.6-1.54 1.4v12.2c0 .8.71 1.4 1.54 1.4h16c.83 0 1.54-.6 1.54-1.4V4.55c0-.26-.1-.5-.27-.7l-.73-.7z"/></svg>
                  YT
                </button>
              </>
            )}
            {tab === 'YT Channels' && (
              <button
                onClick={() => openYtCampaignModal(item)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-medium transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3h4v18h-4z"/><path d="M3 7h4v12H3z"/><path d="M17 10h4v9h-4z"/></svg>
                Campaigns
              </button>
            )}
            <button onClick={() => startEdit(item)} className="px-3 py-1 rounded-lg bg-zinc-700/80 hover:bg-zinc-600 text-zinc-300 text-xs font-medium transition-colors">Edit</button>
            <button onClick={() => handleDelete(entityNiches, item.id)} className="px-3 py-1 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-300 text-xs font-medium transition-colors">
              {loading[`del-${entityNiches}-${item.id}`] ? '...' : 'Del'}
            </button>
          </div>
        </td>
      </tr>
      {tab === 'Users' && expandedUsers.has(item.id) && (
        <tr className="bg-zinc-900/30">
          <td colSpan={10} className="p-0">
            <div className="px-6 py-4">
              {!item.youtube_channels || item.youtube_channels.length === 0 ? (
                <p className="text-zinc-500 text-xs">No linked YouTube channels</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-zinc-800/40">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">YT Channel</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Niche</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Campaign</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Whop Channel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.youtube_channels.map(ch => (
                      ch.campaigns.length === 0 ? (
                        <tr key={ch.id} className="border-t border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
                          <td className="py-2 px-3 text-zinc-200 text-sm">{ch.name}</td>
                          <td className="py-2 px-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${ch.niche_name ? 'bg-violet-500/15 text-violet-300' : 'bg-zinc-700/50 text-zinc-500'}`}>
                              {ch.niche_name || '—'}
                            </span>
                          </td>
                          <td className="py-2 px-3" colSpan={2}><span className="text-xs text-zinc-500">—</span></td>
                        </tr>
                      ) : (
                        ch.campaigns.map((camp, i) => (
                          <tr key={`${ch.id}-${camp.id}`} className="border-t border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
                            {i === 0 && (
                              <td className="py-2 px-3 text-zinc-200 text-sm" rowSpan={ch.campaigns.length}>{ch.name}</td>
                            )}
                            {i === 0 && (
                              <td className="py-2 px-3" rowSpan={ch.campaigns.length}>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${ch.niche_name ? 'bg-violet-500/15 text-violet-300' : 'bg-zinc-700/50 text-zinc-500'}`}>
                                  {ch.niche_name || '—'}
                                </span>
                              </td>
                            )}
                            <td className="py-2 px-3 text-zinc-200 text-sm">{camp.name}</td>
                            <td className="py-2 px-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${camp.whop_channel_name ? 'bg-cyan-500/15 text-cyan-300' : 'bg-zinc-700/50 text-zinc-500'}`}>
                                {camp.whop_channel_name || '—'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
  };

  const renderAddForm = () => {
    if (!showAdd) return null;
    const entity = entityKey(tab);

    return (
      <div className="bg-zinc-800/50 border border-zinc-700/30 rounded-xl p-5 mb-6 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-300">Add New {tab.slice(0, -1)}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Name</label>
            <input
              className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
              value={addForm.name || ''}
              onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Name"
            />
          </div>
          {tab === 'YT Channels' && (
            <>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Username</label>
                <input
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
                  value={addForm.username || ''}
                  onChange={e => setAddForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">URL</label>
                <input
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
                  value={addForm.url || ''}
                  onChange={e => setAddForm(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Niche</label>
                <select
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
                  value={addForm.niche_id || ''}
                  onChange={e => setAddForm(prev => ({ ...prev, niche_id: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">None</option>
                  {niches.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
            </>
          )}
          {tab === 'FB Pages' && (
            <>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Page Name</label>
                <input
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
                  value={addForm.page_name || ''}
                  onChange={e => setAddForm(prev => ({ ...prev, page_name: e.target.value }))}
                  placeholder="Page name"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">URL</label>
                <input
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
                  value={addForm.url || ''}
                  onChange={e => setAddForm(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Niche</label>
                <select
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
                  value={addForm.niche_id || ''}
                  onChange={e => setAddForm(prev => ({ ...prev, niche_id: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">None</option>
                  {niches.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
            </>
          )}
          {tab === 'Whop Campaigns' && (
            <>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Whop Channel</label>
                <select
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-white text-sm focus:outline-none focus:border-primary/50"
                  value={addForm.whop_channel_id || ''}
                  onChange={e => setAddForm(prev => ({ ...prev, whop_channel_id: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">None</option>
                  {whopChannels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => handleAdd(entity)}
            className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-all"
          >
            {loading[`add-${entity}`] ? 'Adding...' : 'Create'}
          </button>
          <button onClick={() => { setShowAdd(false); setAddForm({}); }} className="px-5 py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium transition-colors">Cancel</button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">Administration</h1>
            <p className="text-zinc-400 text-sm mt-1">Manage users, niches, YouTube channels, and Facebook pages</p>
          </div>
          <button onClick={() => setAuthenticated(false)} className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm transition-colors">Lock</button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">{error}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-800/50 rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setEditingId(null); setShowAdd(false); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <span className="hidden sm:inline">{ICONS[t]}</span>
              {t}
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          {!showAdd && (
            <button
              onClick={() => { setShowAdd(true); setEditingId(null); setAddForm({}); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add {tab.slice(0, -1)}
            </button>
          )}
        </div>

        {renderAddForm()}

        {/* Table */}
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-800/30">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">ID</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Name</th>
                  {tab === 'Users' && (
                    <>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Niches</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">YT Channels</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Campaigns</th>
                    </>
                  )}
                  {tab === 'YT Channels' && (
                    <>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Username</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">URL</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Niche</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Campaigns</th>
                    </>
                  )}
                  {tab === 'FB Pages' && (
                    <>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Page Name</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">URL</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Niche</th>
                    </>
                  )}
                  {tab === 'Whop Campaigns' && (
                    <>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Whop Channel</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Niches</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">YT Channels</th>
                    </>
                  )}
                  <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentData().map(renderRow)}
                {currentData().length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-zinc-500 text-sm">No entries found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{users.length}</p>
            <p className="text-xs text-zinc-500 mt-1">Users</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{niches.length}</p>
            <p className="text-xs text-zinc-500 mt-1">Niches</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{ytChannels.length}</p>
            <p className="text-xs text-zinc-500 mt-1">YT Channels</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{fbPages.length}</p>
            <p className="text-xs text-zinc-500 mt-1">FB Pages</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{whopChannels.length}</p>
            <p className="text-xs text-zinc-500 mt-1">Whop Channels</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{whopCampaigns.length}</p>
            <p className="text-xs text-zinc-500 mt-1">Whop Campaigns</p>
          </div>
        </div>
        </div>

      {/* Niche Linkage Modal */}
      {nicheModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setNicheModal(null)}>
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                Niches for {nicheModal.name}
              </h3>
              <button onClick={() => setNicheModal(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="text-xs text-zinc-500">
              Select niches for this user
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {nicheModalLoading ? (
                <p className="text-zinc-500 text-sm text-center py-8">Loading...</p>
              ) : niches.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">No niches created yet</p>
              ) : (
                niches.map(n => (
                  <label key={n.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={nicheModalIds.includes(n.id)}
                      onChange={() => toggleNicheId(n.id)}
                      className="rounded border-zinc-600 text-primary focus:ring-primary/30 bg-zinc-800"
                    />
                    <span className="text-sm text-zinc-200">{n.name}</span>
                  </label>
                ))
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={saveNicheModal} className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-all">
                Save
              </button>
              <button onClick={() => setNicheModal(null)} className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YT Channel Linkage Modal */}
      {ytModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setYtModal(null)}>
          <div className="max-w-lg w-full bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                YT Channels for {ytModal.name}
              </h3>
              <button onClick={() => setYtModal(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="text-xs text-zinc-500">
              {ytFiltered.length === 0
                ? 'No YT channels available — link the user to niches first, then create YT channels under those niches.'
                : 'Select YT channels linked to this user\'s niches'}
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {ytModalLoading ? (
                <p className="text-zinc-500 text-sm text-center py-8">Loading...</p>
              ) : ytFiltered.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">No matching YT channels</p>
              ) : (
                ytFiltered.map(ch => (
                  <label key={ch.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={ytModalIds.includes(ch.id)}
                      onChange={() => toggleYtId(ch.id)}
                      className="rounded border-zinc-600 text-primary focus:ring-primary/30 bg-zinc-800"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm text-zinc-200">{ch.name}</span>
                      <span className="text-xs text-zinc-500">@{ch.username} {ch.niche_name ? `· ${ch.niche_name}` : ''}</span>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={saveYtModal} className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-all">
                Save
              </button>
              <button onClick={() => setYtModal(null)} className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Whop Campaign Niche Linkage Modal */}
      {wcNicheModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setWcNicheModal(null)}>
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                Niches for {wcNicheModal.name}
              </h3>
              <button onClick={() => setWcNicheModal(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="text-xs text-zinc-500">
              Select niches for this campaign
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {wcNicheModalLoading ? (
                <p className="text-zinc-500 text-sm text-center py-8">Loading...</p>
              ) : niches.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">No niches created yet</p>
              ) : (
                niches.map(n => (
                  <label key={n.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={wcNicheModalIds.includes(n.id)}
                      onChange={() => toggleWcNicheId(n.id)}
                      className="rounded border-zinc-600 text-primary focus:ring-primary/30 bg-zinc-800"
                    />
                    <span className="text-sm text-zinc-200">{n.name}</span>
                  </label>
                ))
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={saveWcNicheModal} className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-all">
                Save
              </button>
              <button onClick={() => setWcNicheModal(null)} className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Whop Campaign → YT Channels Modal */}
      {campaignYtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setCampaignYtModal(null)}>
          <div className="max-w-lg w-full bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                YT Channels for {campaignYtModal.name}
              </h3>
              <button onClick={() => setCampaignYtModal(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="text-xs text-zinc-500">
              {campaignYtFiltered.length === 0
                ? 'No YT channels available — link niches to this campaign first, then create YT channels under those niches.'
                : 'Select YT channels matching this campaign\'s niches'}
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {campaignYtModalLoading ? (
                <p className="text-zinc-500 text-sm text-center py-8">Loading...</p>
              ) : campaignYtFiltered.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">No matching YT channels</p>
              ) : (
                campaignYtFiltered.map(ch => (
                  <label key={ch.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={campaignYtModalIds.includes(ch.id)}
                      onChange={() => toggleCampaignYtId(ch.id)}
                      className="rounded border-zinc-600 text-primary focus:ring-primary/30 bg-zinc-800"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm text-zinc-200">{ch.name}</span>
                      <span className="text-xs text-zinc-500">@{ch.username} {ch.niche_name ? `· ${ch.niche_name}` : ''}</span>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={saveCampaignYtModal} className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-all">
                Save
              </button>
              <button onClick={() => setCampaignYtModal(null)} className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YT Channel → Whop Campaigns Modal */}
      {ytCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setYtCampaignModal(null)}>
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                Campaigns for {ytCampaignModal.name}
              </h3>
              <button onClick={() => setYtCampaignModal(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {ytCampaignModalLoading ? (
                <p className="text-zinc-500 text-sm text-center py-8">Loading...</p>
              ) : whopCampaigns.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">No campaigns created yet</p>
              ) : (
                (() => {
                  const filtered = whopCampaigns.filter(c => !ytCampaignModal.niche_id || (c.niches || []).some(n => n.id === ytCampaignModal.niche_id));
                  return filtered.length === 0 ? (
                    <p className="text-zinc-500 text-sm text-center py-8">No campaigns match this channel's niche</p>
                  ) : (
                    filtered.map(c => (
                      <label key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={ytCampaignModalIds.includes(c.id)}
                          onChange={() => toggleYtCampaignId(c.id)}
                          className="rounded border-zinc-600 text-primary focus:ring-primary/30 bg-zinc-800"
                        />
                        <span className="text-sm text-zinc-200">{c.name}</span>
                      </label>
                    ))
                  );
                })()
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={saveYtCampaignModal} className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-all">
                Save
              </button>
              <button onClick={() => setYtCampaignModal(null)} className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
