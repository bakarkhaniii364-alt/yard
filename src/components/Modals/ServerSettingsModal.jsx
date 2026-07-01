import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Check, Trash2, Shield, Calendar, Settings, Plus, Users, 
  Smile, Tag, Heart, Info, Play, Volume2, ShieldAlert, 
  Link, Eye, EyeOff, Ban, Clock, FileText, HelpCircle, 
  Sparkles, Activity, PlusCircle, Trash, ExternalLink, Globe, Lock
} from 'lucide-react';
import { 
  RetroWindow, RetroButton, RetroInput, ConfirmDialog, 
  useToast, getRetroPfpUrl 
} from '../UI.jsx';
import { playAudio } from '../../utils/audio.js';

export function ServerSettingsModal({ 
  activeServer, 
  servers, 
  setServers, 
  onClose, 
  sfxEnabled,
  userId
}) {
  const { addToast } = useToast();

  // 1. Initial State Fallbacks
  const [tab, setTab] = useState('profile');
  
  const [name, setName] = useState(activeServer?.name || '');
  const [icon, setIcon] = useState(activeServer?.icon || '🎮');
  const [bannerColor, setBannerColor] = useState(activeServer?.bannerColor || 'linear-gradient(135deg, #1f1f1f, #3a3a3a)');
  const [description, setDescription] = useState(activeServer?.description || 'Welcome to the Yard server!');
  const [traits, setTraits] = useState(activeServer?.traits || ['', '', '', '', '']);
  const [tag, setTag] = useState(activeServer?.tag || (activeServer?.name || '').substring(0, 4).toUpperCase());
  const [access, setAccess] = useState(activeServer?.access || 'public');
  const [verificationLevel, setVerificationLevel] = useState(activeServer?.verificationLevel || 'low');
  
  // Simulated datasets
  const [bans, setBans] = useState(activeServer?.bans || [
    { id: 'banned_1', name: 'spambot_99', reason: 'Spamming referral links' },
    { id: 'banned_2', name: 'troll_king', reason: 'Harassing members' }
  ]);
  const [invites, setInvites] = useState(activeServer?.invites || [
    { code: 'yard-welcome', uses: 42, creator: 'You' },
    { code: 'lobby-chat', uses: 12, creator: 'Alice' }
  ]);
  const [roles, setRoles] = useState(activeServer?.roles || [
    { id: 'role_owner', name: 'Owner', color: '#ff5555', permissions: { admin: true, manageChannels: true } },
    { id: 'role_admin', name: 'Admin', color: '#55ff55', permissions: { admin: true, manageChannels: true } },
    { id: 'role_member', name: 'Member', color: '#5555ff', permissions: { admin: false, manageChannels: false } }
  ]);
  const [emojis, setEmojis] = useState(activeServer?.emojis || [
    { id: 'emo_1', name: 'yard_tree', char: '🌳' },
    { id: 'emo_2', name: 'game_controller', char: '🎮' }
  ]);
  const [stickers, setStickers] = useState(activeServer?.stickers || [
    { id: 'stk_1', name: 'gg_wp', char: '⚡' },
    { id: 'stk_2', name: 'lofi_vibes', char: '🍵' }
  ]);
  const [soundboard, setSoundboard] = useState(activeServer?.soundboard || [
    { id: 'snd_1', name: 'arcade_boop', char: '🔊' },
    { id: 'snd_2', name: 'level_up', char: '🔔' }
  ]);
  const [automod, setAutomod] = useState(activeServer?.automod || {
    profanity: true,
    invites: false,
    spam: true
  });
  const [webhooks, setWebhooks] = useState(activeServer?.webhooks || [
    { id: 'web_1', name: 'GitHub Commits', channel: 'general' }
  ]);
  const [auditLogs, setAuditLogs] = useState(activeServer?.auditLogs || [
    { time: '10 mins ago', user: 'You', action: 'Created server' }
  ]);

  // Community setup state
  const [communityStep, setCommunityStep] = useState(0); // 0 = not enabled, 1 = step 1, 2 = step 2, 3 = finished
  const [isCommunityEnabled, setIsCommunityEnabled] = useState(activeServer?.isCommunityEnabled || false);

  // Invite creation states
  const [newInviteCode, setNewInviteCode] = useState('');

  // Role creation states
  const [selectedRoleId, setSelectedRoleId] = useState('role_admin');
  const [roleNameInput, setRoleNameInput] = useState('');
  const [roleColorInput, setRoleColorInput] = useState('#55ff55');
  const [roleAdminCheck, setRoleAdminCheck] = useState(true);
  const [roleChannelsCheck, setRoleChannelsCheck] = useState(true);

  // Emoji upload states
  const [newEmojiName, setNewEmojiName] = useState('');
  const [newEmojiChar, setNewEmojiChar] = useState('');

  // Sound play helper
  const triggerAudio = (type) => {
    playAudio(type, sfxEnabled);
  };

  // Keep role edit inputs in sync
  useEffect(() => {
    const r = roles.find(x => x.id === selectedRoleId);
    if (r) {
      setRoleNameInput(r.name);
      setRoleColorInput(r.color);
      setRoleAdminCheck(!!r.permissions?.admin);
      setRoleChannelsCheck(!!r.permissions?.manageChannels);
    }
  }, [selectedRoleId, roles]);

  // Add audit log entry helper
  const addAuditLog = (actionText) => {
    const entry = {
      time: 'Just now',
      user: 'You',
      action: actionText
    };
    setAuditLogs(prev => [entry, ...prev]);
  };

  // Swatch colors for Server Banner
  const bannerPresets = [
    { label: 'Deep Charcoal', value: 'linear-gradient(135deg, #1f1f1f, #3a3a3a)' },
    { label: 'Neon Pink', value: 'linear-gradient(135deg, #ec4899, #be185d)' },
    { label: 'Crimson Red', value: 'linear-gradient(135deg, #ef4444, #b91c1c)' },
    { label: 'Sunset Orange', value: 'linear-gradient(135deg, #f97316, #c2410c)' },
    { label: 'Retro Yellow', value: 'linear-gradient(135deg, #eab308, #a16207)' },
    { label: 'Cyber Purple', value: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
    { label: 'Ocean Blue', value: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
    { label: 'Mint Teal', value: 'linear-gradient(135deg, #14b8a6, #0f766e)' },
    { label: 'Matcha Green', value: 'linear-gradient(135deg, #22c55e, #15803d)' },
    { label: 'CRT Grey', value: 'linear-gradient(135deg, #6b7280, #374151)' }
  ];

  // Save Settings
  const handleSave = () => {
    triggerAudio('success');

    const updatedServers = servers.map(s => {
      if (s.id === activeServer.id) {
        return {
          ...s,
          name,
          icon,
          bannerColor,
          description,
          traits,
          tag,
          access,
          verificationLevel,
          bans,
          invites,
          roles,
          emojis,
          stickers,
          soundboard,
          automod,
          webhooks,
          auditLogs,
          isCommunityEnabled
        };
      }
      return s;
    });

    setServers(updatedServers);
    localStorage.setItem('yard_custom_servers', JSON.stringify(updatedServers));
    addToast('Server configuration saved!', 'success');
    onClose();
  };

  // Kick member helper
  const handleKickMember = (memberId, memberName) => {
    triggerAudio('click');
    const updatedServers = servers.map(s => {
      if (s.id === activeServer.id) {
        return {
          ...s,
          members: s.members.filter(m => m.id !== memberId)
        };
      }
      return s;
    });
    setServers(updatedServers);
    localStorage.setItem('yard_custom_servers', JSON.stringify(updatedServers));
    addToast(`${memberName} kicked from server.`, 'info');
    addAuditLog(`Kicked member ${memberName}`);
  };

  // Change member role helper
  const handleChangeMemberRole = (memberId, newRole, memberName) => {
    triggerAudio('click');
    const updatedServers = servers.map(s => {
      if (s.id === activeServer.id) {
        return {
          ...s,
          members: s.members.map(m => m.id === memberId ? { ...m, role: newRole } : m)
        };
      }
      return s;
    });
    setServers(updatedServers);
    localStorage.setItem('yard_custom_servers', JSON.stringify(updatedServers));
    addToast(`Updated ${memberName}'s role to ${newRole}!`, 'success');
    addAuditLog(`Promoted ${memberName} to ${newRole}`);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full divide-y md:divide-y-0 md:divide-x divide-dashed divide-border/20 bg-window overflow-hidden">
      
      {/* ── LEFT SIDEBAR NAVIGATION ── */}
      <div className="w-full md:w-[200px] shrink-0 p-3 flex flex-col gap-1 bg-[var(--bg-main)]/5 overflow-y-auto select-none border-r border-dashed border-border/20 custom-scrollbar">
        <div className="text-[10px] font-black uppercase opacity-45 px-2 py-0.5 tracking-wider truncate mb-1">
          {name || 'Server Settings'}
        </div>

        {/* Category: Overview */}
        <div className="text-[9px] font-black uppercase tracking-widest opacity-60 px-2 mt-2 mb-1">Overview</div>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('profile'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'profile' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          Server Profile
        </button>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('tag'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'tag' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          Server Tag
        </button>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('engagement'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'engagement' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          Engagement
        </button>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('boost'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'boost' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          Boost Perks
        </button>

        {/* Category: Expression */}
        <div className="text-[9px] font-black uppercase tracking-widest opacity-60 px-2 mt-3 mb-1">Expression</div>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('emoji'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'emoji' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          Emoji
        </button>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('stickers'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'stickers' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          Stickers
        </button>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('soundboard'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'soundboard' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          Soundboard
        </button>

        {/* Category: People */}
        <div className="text-[9px] font-black uppercase tracking-widest opacity-60 px-2 mt-3 mb-1">People</div>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('members'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'members' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          Members
        </button>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('roles'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'roles' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          Roles
        </button>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('invites'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'invites' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          Invites
        </button>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('access'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'access' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          Access
        </button>

        {/* Category: Apps */}
        <div className="text-[9px] font-black uppercase tracking-widest opacity-60 px-2 mt-3 mb-1">Apps</div>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('integrations'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'integrations' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          Integrations
        </button>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('app_directory'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'app_directory' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          App Directory
        </button>

        {/* Category: Moderation */}
        <div className="text-[9px] font-black uppercase tracking-widest opacity-60 px-2 mt-3 mb-1">Moderation</div>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('safety'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'safety' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          Safety Setup
        </button>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('audit_log'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'audit_log' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          Audit Log
        </button>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('bans'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'bans' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          Bans
        </button>
        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('automod'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 ${tab === 'automod' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          AutoMod
        </button>

        <div className="border-t border-dashed border-border/20 my-2"></div>

        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('community'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 flex items-center gap-1.5 ${tab === 'community' ? 'bg-green-600 text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          <Globe size={11} />
          <span>Community</span>
        </button>

        <button
          type="button"
          onClick={() => { triggerAudio('click'); setTab('template'); }}
          className={`px-2 py-1 text-xs font-bold text-left uppercase border-0 flex items-center gap-1.5 ${tab === 'template' ? 'bg-primary text-white font-black' : 'hover:bg-black/5 text-main-text'}`}
        >
          <FileText size={11} />
          <span>Template</span>
        </button>

        <div className="border-t border-dashed border-border/20 my-2"></div>

        {/* Delete Server Action */}
        <button
          type="button"
          onClick={() => {
            triggerAudio('click');
            if (activeServer?.id === 'da2a11b0ab124c348f567890abcdef12') {
              addToast("Cannot delete the core Yard server!", "error");
              return;
            }
            if (window.confirm(`Are you sure you want to permanently delete "${name}"? This action is absolute and cannot be undone.`)) {
              const updated = servers.filter(s => s.id !== activeServer.id);
              setServers(updated);
              localStorage.setItem('yard_custom_servers', JSON.stringify(updated));
              addToast("Server deleted permanently.", "info");
              onClose();
            }
          }}
          className="px-2 py-1.5 text-xs font-bold text-left uppercase border-0 text-red-600 hover:bg-red-50 flex items-center gap-1.5"
        >
          <Trash2 size={11} />
          <span>Delete Server</span>
        </button>
      </div>

      {/* ── RIGHT CONTENT AREA ── */}
      <div className="flex-1 p-4 flex flex-col min-h-0 bg-window font-mono text-main-text select-none">
        
        {/* TAB 1: SERVER PROFILE */}
        {tab === 'profile' && (
          <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-y-auto custom-scrollbar">
            {/* Input Form Column */}
            <div className="flex-1 flex flex-col gap-3.5">
              <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1">
                Server Profile Overview
              </span>

              <RetroInput
                label="Server Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter server name"
              />

              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-widest text-[var(--text-muted)] font-bold">Icon</span>
                <span className="text-[10px] text-muted-text font-bold">We recommend an image or a retro emoji/character symbol.</span>
                <div className="flex gap-2">
                  <RetroInput
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="Enter emoji or symbol"
                    className="max-w-[120px]"
                  />
                  <RetroButton 
                    variant="secondary" 
                    onClick={() => { triggerAudio('click'); setIcon('🎮'); }}
                    className="text-xs"
                  >
                    Reset Icon
                  </RetroButton>
                </div>
              </div>

              {/* Banner Presets */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-widest text-[var(--text-muted)] font-bold">Banner Theme</span>
                <span className="text-[10px] text-muted-text font-bold">Select a preset color gradient for your server banner:</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {bannerPresets.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => { triggerAudio('click'); setBannerColor(p.value); }}
                      style={{ background: p.value }}
                      className={`h-7 border-2 ${bannerColor === p.value ? 'border-primary scale-105' : 'border-border/30 hover:border-border'} transition-all`}
                      title={p.label}
                    />
                  ))}
                </div>
              </div>

              {/* Traits Slots */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-widest text-[var(--text-muted)] font-bold">Traits</span>
                <span className="text-[10px] text-muted-text font-bold">Add up to 5 characteristics or interests of your server:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {traits.map((trait, idx) => (
                    <div key={idx} className="relative flex items-center">
                      <RetroInput
                        value={trait}
                        onChange={(e) => {
                          const updated = [...traits];
                          updated[idx] = e.target.value;
                          setTraits(updated);
                        }}
                        placeholder={`Trait ${idx + 1}`}
                        className="text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-widest text-[var(--text-muted)] font-bold">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell the world a bit about this server..."
                  rows={2}
                  className="w-full text-xs font-bold p-2 retro-input-container bg-transparent resize-none focus:outline-none"
                />
              </div>
            </div>

            {/* Live Preview Card Column */}
            <div className="w-full md:w-[220px] flex flex-col shrink-0">
              <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1 mb-3">
                Live Card Preview
              </span>

              {/* Discord Profile Card Replica */}
              <div className="w-full bg-[var(--bg-main)]/5 border-2 border-border/30 flex flex-col font-mono select-none overflow-hidden">
                {/* Banner Gradient */}
                <div className="h-14 w-full relative" style={{ background: bannerColor }}>
                  <div className="absolute top-2 right-2 bg-black/40 text-white text-[8px] font-black uppercase tracking-wider px-1 border border-white/20">
                    {access === 'public' ? 'Public' : 'Private'}
                  </div>
                </div>

                {/* Profile Details Container */}
                <div className="p-3 relative flex flex-col gap-2 bg-window pt-7">
                  {/* Icon Overlay */}
                  <div className="absolute -top-7 left-3 w-12 h-12 bg-window border-2 border-border flex items-center justify-center text-xl shadow-inner font-sans">
                    {icon}
                  </div>

                  {/* Title & Tag */}
                  <div className="flex flex-col">
                    <span className="text-xs font-black truncate max-w-full tracking-tight">{name || 'Unnamed Server'}</span>
                    <span className="text-[9px] font-bold text-primary font-mono select-all">[{tag || 'NONE'}]</span>
                  </div>

                  {/* Description Preview */}
                  <p className="text-[10px] text-muted-text line-clamp-2 leading-tight font-bold mb-1">
                    {description || 'No description provided.'}
                  </p>

                  <div className="border-t border-dashed border-border/20 pt-1.5 flex flex-col gap-1">
                    {/* Live Counts */}
                    <div className="flex items-center gap-1.5 text-[9px] font-bold">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0" />
                      <span>1 Online</span>
                      <span className="w-1 h-1 bg-border/40 rounded-full shrink-0" />
                      <span>{activeServer?.members?.length || 1} Members</span>
                    </div>

                    {/* Established Date */}
                    <div className="text-[9px] font-bold opacity-60 flex items-center gap-1">
                      <Clock size={9} />
                      <span>Est. Jun 2026</span>
                    </div>
                  </div>

                  {/* Display Traits Chips */}
                  {traits.some(t => t.trim()) && (
                    <div className="flex flex-wrap gap-1 mt-1 border-t border-dashed border-border/20 pt-1.5">
                      {traits.map((t, i) => t.trim() ? (
                        <span key={i} className="text-[8px] font-black uppercase bg-primary/10 text-primary border border-primary/20 px-1 py-0.5 truncate max-w-[80px]">
                          {t}
                        </span>
                      ) : null)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SERVER TAG */}
        {tab === 'tag' && (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1">
              Custom Server Tag
            </span>

            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-text leading-relaxed">
                Add a 4-character tag code that represents your guild. This tag shows up alongside user labels in general channels.
              </p>
            </div>

            <RetroInput
              label="Guild Tag (Max 4 chars)"
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="e.g. RVLS"
              className="max-w-[200px]"
            />

            <div className="p-3 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase opacity-65 tracking-wider">Chat Header Preview</span>
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span className="opacity-75">💬 #general</span>
                <span className="opacity-40">•</span>
                <span className="bg-primary/10 text-primary px-1 text-[10px] font-black uppercase">[{tag || 'TAG'}] {name}</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ENGAGEMENT */}
        {tab === 'engagement' && (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1">
              Engagement Tools
            </span>

            <div className="p-3 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black uppercase">Welcome Screen</span>
                  <span className="text-[10px] opacity-60 font-bold">Display a welcome dialog box to first-time members.</span>
                </div>
                <input 
                  type="checkbox" 
                  defaultChecked 
                  className="w-4 h-4 cursor-pointer accent-primary" 
                />
              </div>

              <div className="flex justify-between items-center border-t border-dashed border-border/20 pt-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black uppercase">Auto Join Announcement</span>
                  <span className="text-[10px] opacity-60 font-bold">Send welcome message when someone joins this server.</span>
                </div>
                <input 
                  type="checkbox" 
                  defaultChecked 
                  className="w-4 h-4 cursor-pointer accent-primary" 
                />
              </div>

              <div className="flex flex-col gap-1.5 border-t border-dashed border-border/20 pt-3">
                <span className="text-xs font-black uppercase">Announcement Channel</span>
                <span className="text-[10px] opacity-60 font-bold">Select the channel where server announcements are posted:</span>
                <select className="p-1.5 bg-window retro-border text-xs font-bold w-full max-w-[200px] outline-none text-main-text">
                  <option value="announcements">#announcements</option>
                  <option value="general">#general</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BOOST PERKS */}
        {tab === 'boost' && (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1">
              Server Boost Status
            </span>

            <div className="p-4 bg-primary/10 border-2 border-primary flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles size={24} className="text-primary" />
                <div className="flex flex-col">
                  <span className="text-sm font-black uppercase tracking-wide">Server Boost Level 2</span>
                  <span className="text-xs font-bold text-primary">8 Active Boosters</span>
                </div>
              </div>
              <span className="text-xs font-black uppercase bg-primary text-white px-2 py-0.5 select-none">Active</span>
            </div>

            <div className="space-y-2.5">
              <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block">Unlocked Features</span>
              
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <div className="p-2.5 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex items-center gap-2">
                  <Check size={14} className="text-green-600 shrink-0" />
                  <span>+50 Custom Emojis slots</span>
                </div>
                <div className="p-2.5 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex items-center gap-2">
                  <Check size={14} className="text-green-600 shrink-0" />
                  <span>1080p 60fps streaming</span>
                </div>
                <div className="p-2.5 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex items-center gap-2">
                  <Check size={14} className="text-green-600 shrink-0" />
                  <span>Custom Server Banner color</span>
                </div>
                <div className="p-2.5 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex items-center gap-2">
                  <Check size={14} className="text-green-600 shrink-0" />
                  <span>128Kbps audio quality</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: EMOJI */}
        {tab === 'emoji' && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1 shrink-0">
              Manage Emojis ({emojis.length}/100)
            </span>

            {/* Quick Upload Form */}
            <div className="p-3 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex flex-wrap gap-2 items-end shrink-0">
              <RetroInput
                label="Emoji Alias"
                value={newEmojiName}
                onChange={(e) => setNewEmojiName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. peepo_dance"
                className="flex-1 min-w-[120px]"
              />
              <RetroInput
                label="Symbol/Char"
                value={newEmojiChar}
                onChange={(e) => setNewEmojiChar(e.target.value.slice(0, 2))}
                placeholder="e.g. 😎"
                className="w-[90px] shrink-0"
              />
              <RetroButton
                variant="primary"
                onClick={() => {
                  if (!newEmojiName || !newEmojiChar) {
                    addToast('Please fill out emoji alias and character.', 'warn');
                    return;
                  }
                  triggerAudio('click');
                  const newEmo = { id: `emo_${Date.now()}`, name: newEmojiName, char: newEmojiChar };
                  setEmojis(prev => [...prev, newEmo]);
                  setNewEmojiName('');
                  setNewEmojiChar('');
                  addToast(`Emoji :${newEmojiName}: added!`, 'success');
                  addAuditLog(`Uploaded custom emoji :${newEmojiName}:`);
                }}
                className="py-1 px-4 uppercase text-xs shrink-0"
              >
                Upload
              </RetroButton>
            </div>

            {/* Emojis Grid List */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
              {emojis.map(e => (
                <div key={e.id} className="p-2 bg-[var(--bg-main)]/5 border border-dashed border-border/15 flex justify-between items-center text-xs font-bold">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-sans">{e.char}</span>
                    <span>:{e.name}:</span>
                  </div>
                  <button
                    onClick={() => {
                      triggerAudio('click');
                      setEmojis(prev => prev.filter(x => x.id !== e.id));
                      addToast('Emoji deleted.', 'info');
                      addAuditLog(`Deleted custom emoji :${e.name}:`);
                    }}
                    className="p-1 text-red-600 hover:bg-red-50 border-0 flex items-center justify-center"
                    title="Delete Emoji"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: STICKERS */}
        {tab === 'stickers' && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1 shrink-0">
              Custom Stickers ({stickers.length}/50)
            </span>

            {/* Quick Sticker Upload */}
            <div className="p-3 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex flex-wrap gap-2 items-end shrink-0">
              <RetroInput
                label="Sticker Name"
                placeholder="e.g. pixel_gg"
                className="flex-1 min-w-[120px]"
                id="sticker-name-field"
              />
              <RetroInput
                label="Symbol"
                placeholder="e.g. ⚡"
                className="w-[90px] shrink-0"
                id="sticker-symbol-field"
              />
              <RetroButton
                variant="primary"
                onClick={() => {
                  triggerAudio('click');
                  const nameEl = document.getElementById('sticker-name-field');
                  const symEl = document.getElementById('sticker-symbol-field');
                  if (!nameEl?.value || !symEl?.value) {
                    addToast('Fill both sticker fields.', 'warn');
                    return;
                  }
                  const newStk = { id: `stk_${Date.now()}`, name: nameEl.value, char: symEl.value };
                  setStickers(prev => [...prev, newStk]);
                  addToast(`Sticker ${newStk.name} added!`, 'success');
                  addAuditLog(`Uploaded custom sticker ${newStk.name}`);
                  nameEl.value = '';
                  symEl.value = '';
                }}
                className="py-1 px-4 uppercase text-xs shrink-0"
              >
                Add Sticker
              </RetroButton>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
              {stickers.map(s => (
                <div key={s.id} className="p-2 bg-[var(--bg-main)]/5 border border-dashed border-border/15 flex justify-between items-center text-xs font-bold">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-sans">{s.char}</span>
                    <span>{s.name}</span>
                  </div>
                  <button
                    onClick={() => {
                      triggerAudio('click');
                      setStickers(prev => prev.filter(x => x.id !== s.id));
                      addToast('Sticker deleted.', 'info');
                      addAuditLog(`Deleted custom sticker ${s.name}`);
                    }}
                    className="p-1 text-red-600 hover:bg-red-50 border-0 flex items-center justify-center"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: SOUNDBOARD */}
        {tab === 'soundboard' && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1 shrink-0">
              Soundboard Sounds ({soundboard.length}/24)
            </span>

            {/* Quick Upload */}
            <div className="p-3 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex flex-wrap gap-2 items-end shrink-0">
              <RetroInput
                label="Sound Title"
                placeholder="e.g. anime_wow"
                className="flex-1 min-w-[120px]"
                id="sound-title-field"
              />
              <RetroInput
                label="Icon Char"
                placeholder="e.g. 🔊"
                className="w-[90px] shrink-0"
                id="sound-char-field"
              />
              <RetroButton
                variant="primary"
                onClick={() => {
                  triggerAudio('click');
                  const titleEl = document.getElementById('sound-title-field');
                  const charEl = document.getElementById('sound-char-field');
                  if (!titleEl?.value || !charEl?.value) {
                    addToast('Fill both soundboard fields.', 'warn');
                    return;
                  }
                  const newSnd = { id: `snd_${Date.now()}`, name: titleEl.value, char: charEl.value };
                  setSoundboard(prev => [...prev, newSnd]);
                  addToast(`Sound ${newSnd.name} added!`, 'success');
                  addAuditLog(`Uploaded custom sound ${newSnd.name}`);
                  titleEl.value = '';
                  charEl.value = '';
                }}
                className="py-1 px-4 uppercase text-xs shrink-0"
              >
                Add Sound
              </RetroButton>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
              {soundboard.map(s => (
                <div key={s.id} className="p-2 bg-[var(--bg-main)]/5 border border-dashed border-border/15 flex justify-between items-center text-xs font-bold">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-sans">{s.char}</span>
                    <span>{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        triggerAudio('click');
                        addToast(`Playing sound: ${s.name}`, 'info');
                      }}
                      className="p-1 border hover:bg-black/5 flex items-center justify-center"
                      title="Play sound"
                    >
                      <Play size={12} className="text-primary" />
                    </button>
                    <button
                      onClick={() => {
                        triggerAudio('click');
                        setSoundboard(prev => prev.filter(x => x.id !== s.id));
                        addToast('Sound deleted.', 'info');
                        addAuditLog(`Deleted soundboard sound ${s.name}`);
                      }}
                      className="p-1 text-red-600 hover:bg-red-50 border-0 flex items-center justify-center"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 8: MEMBERS */}
        {tab === 'members' && (
          <div className="flex-1 flex flex-col gap-3.5 min-h-0">
            <div className="flex justify-between items-center border-b border-dashed border-border/25 pb-1 shrink-0">
              <span className="text-[10px] font-black uppercase opacity-65 tracking-widest">
                Manage Members ({activeServer.members.length})
              </span>
            </div>

            {/* Members List Container */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-0 custom-scrollbar">
              {activeServer.members.map(member => {
                const currentUserRole = activeServer.members.find(m => m.id === 'user_me' || m.id === userId)?.role || 'member';
                const isOwner = member.role === 'owner';
                const isYou = member.id === 'user_me' || member.id === userId;

                return (
                  <div key={member.id} className="p-2 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <img 
                        src={getRetroPfpUrl(member.name)} 
                        className="w-7 h-7 retro-border object-cover bg-white shrink-0" 
                        alt=""
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold truncate leading-none mb-0.5">{member.name} {isYou && '(You)'}</span>
                        <span className="text-[9px] opacity-60 font-mono uppercase leading-none">
                          Role: {member.role || 'member'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Role selection dropdown */}
                      {!isYou && currentUserRole === 'owner' && !isOwner && (
                        <select
                          value={member.role || 'member'}
                          onChange={(e) => handleChangeMemberRole(member.id, e.target.value, member.name)}
                          className="text-[10px] font-bold p-1 bg-window retro-border outline-none text-main-text"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                          <option value="moderator">Moderator</option>
                        </select>
                      )}

                      {/* Kick button */}
                      {!isYou && !isOwner && (currentUserRole === 'owner' || currentUserRole === 'admin') && (
                        <button
                          onClick={() => handleKickMember(member.id, member.name)}
                          className="p-1 px-2.5 text-[9px] font-black uppercase bg-red-600 text-white hover:bg-red-700 retro-border border-0"
                        >
                          Kick
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 9: ROLES */}
        {tab === 'roles' && (
          <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-y-auto custom-scrollbar">
            {/* Roles List Sidebar */}
            <div className="w-[150px] shrink-0 flex flex-col gap-1.5 border-r border-dashed border-border/20 pr-3.5">
              <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1">
                Roles
              </span>
              {roles.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { triggerAudio('click'); setSelectedRoleId(r.id); }}
                  className={`w-full text-left px-2 py-1 text-xs font-bold uppercase ${selectedRoleId === r.id ? 'bg-primary/15 text-primary border border-primary/20 font-black' : 'hover:bg-black/5 text-main-text border-0'}`}
                >
                  <span className="mr-1.5 inline-block w-2.5 h-2.5" style={{ backgroundColor: r.color }} />
                  {r.name}
                </button>
              ))}
              <RetroButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  triggerAudio('click');
                  const newId = `role_${Date.now()}`;
                  const newRole = {
                    id: newId,
                    name: 'NEW ROLE',
                    color: '#a855f7',
                    permissions: { admin: false, manageChannels: false }
                  };
                  setRoles(prev => [...prev, newRole]);
                  setSelectedRoleId(newId);
                  addToast('New role created.', 'success');
                  addAuditLog('Created new server role');
                }}
                className="mt-2 text-[10px] font-black uppercase"
              >
                + Add Role
              </RetroButton>
            </div>

            {/* Role Config Panel */}
            <div className="flex-1 flex flex-col gap-3.5 min-w-0">
              <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1">
                Role Settings
              </span>

              <RetroInput
                label="Role Name"
                value={roleNameInput}
                onChange={(e) => {
                  const updated = roles.map(r => r.id === selectedRoleId ? { ...r, name: e.target.value } : r);
                  setRoles(updated);
                }}
              />

              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-widest text-[var(--text-muted)] font-bold">Role Color</span>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={roleColorInput}
                    onChange={(e) => {
                      const updated = roles.map(r => r.id === selectedRoleId ? { ...r, color: e.target.value } : r);
                      setRoles(updated);
                    }}
                    className="w-10 h-7 border cursor-pointer bg-transparent"
                  />
                  <span className="text-xs font-mono font-bold">{roleColorInput.toUpperCase()}</span>
                </div>
              </div>

              {/* Permissions */}
              <div className="flex flex-col gap-2 mt-1">
                <span className="text-xs uppercase tracking-widest text-[var(--text-muted)] font-bold">Permissions</span>
                
                <div className="p-3 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-black uppercase">Administrator</span>
                      <span className="text-[10px] opacity-60 font-bold">Grant full administrative power to this role.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={roleAdminCheck}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRoleAdminCheck(checked);
                        const updated = roles.map(r => r.id === selectedRoleId ? {
                          ...r,
                          permissions: { ...r.permissions, admin: checked }
                        } : r);
                        setRoles(updated);
                      }}
                      className="w-4 h-4 cursor-pointer accent-primary animate-none"
                    />
                  </div>

                  <div className="flex justify-between items-center border-t border-dashed border-border/20 pt-3">
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-black uppercase">Manage Channels</span>
                      <span className="text-[10px] opacity-60 font-bold">Allow members to create and edit channel templates.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={roleChannelsCheck}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRoleChannelsCheck(checked);
                        const updated = roles.map(r => r.id === selectedRoleId ? {
                          ...r,
                          permissions: { ...r.permissions, manageChannels: checked }
                        } : r);
                        setRoles(updated);
                      }}
                      className="w-4 h-4 cursor-pointer accent-primary animate-none"
                    />
                  </div>
                </div>
              </div>

              {selectedRoleId !== 'role_owner' && (
                <RetroButton
                  variant="secondary"
                  onClick={() => {
                    if (window.confirm("Delete this role permanently?")) {
                      triggerAudio('click');
                      setRoles(prev => prev.filter(r => r.id !== selectedRoleId));
                      setSelectedRoleId('role_member');
                      addToast('Role deleted.', 'info');
                      addAuditLog('Deleted server role');
                    }
                  }}
                  className="mt-auto self-start bg-red-600 text-white hover:bg-red-700 text-xs"
                >
                  Delete Role
                </RetroButton>
              )}
            </div>
          </div>
        )}

        {/* TAB 10: INVITES */}
        {tab === 'invites' && (
          <div className="flex-1 flex flex-col gap-3.5 min-h-0">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1 shrink-0">
              Active Invites ({invites.length})
            </span>

            {/* Invite generation */}
            <div className="p-3 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex gap-2 items-end shrink-0">
              <RetroInput
                label="Custom Invite Code"
                value={newInviteCode}
                onChange={(e) => setNewInviteCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="e.g. retro-gamers"
                className="flex-1"
              />
              <RetroButton
                variant="primary"
                onClick={() => {
                  if (!newInviteCode.trim()) {
                    addToast('Enter an invite code.', 'warn');
                    return;
                  }
                  triggerAudio('click');
                  const newInv = { code: newInviteCode, uses: 0, creator: 'You' };
                  setInvites(prev => [...prev, newInv]);
                  setNewInviteCode('');
                  addToast(`Invite link ${newInviteCode} generated!`, 'success');
                  addAuditLog(`Generated invite code: ${newInviteCode}`);
                }}
                className="py-1 px-4 uppercase text-xs"
              >
                Create
              </RetroButton>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
              {invites.map(i => (
                <div key={i.code} className="p-2 bg-[var(--bg-main)]/5 border border-dashed border-border/15 flex justify-between items-center text-xs font-bold">
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-primary select-all">yard.app/invite/{i.code}</span>
                    <span className="text-[9px] opacity-60 font-mono uppercase mt-0.5">
                      Uses: {i.uses} • Created by: {i.creator}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      triggerAudio('click');
                      setInvites(prev => prev.filter(x => x.code !== i.code));
                      addToast('Invite revoked.', 'info');
                      addAuditLog(`Revoked invite link: ${i.code}`);
                    }}
                    className="p-1.5 text-red-600 hover:bg-red-50 border-0 flex items-center justify-center font-bold text-[10px] uppercase border"
                    title="Revoke link"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 11: ACCESS */}
        {tab === 'access' && (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1">
              Server Access Controls
            </span>

            <div className="p-4 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex flex-col gap-4">
              <div 
                onClick={() => { triggerAudio('click'); setAccess('public'); }}
                className={`p-3 border-2 cursor-pointer flex items-start gap-3 transition-all ${access === 'public' ? 'border-primary bg-primary/5' : 'border-border/30 hover:border-border'}`}
              >
                <Globe size={18} className="text-primary shrink-0 mt-0.5" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black uppercase">Public Guild</span>
                  <span className="text-[10px] opacity-60 font-bold">Anyone with the link can search and join this guild. Unlocks discovery perks.</span>
                </div>
              </div>

              <div 
                onClick={() => { triggerAudio('click'); setAccess('private'); }}
                className={`p-3 border-2 cursor-pointer flex items-start gap-3 transition-all ${access === 'private' ? 'border-primary bg-primary/5' : 'border-border/30 hover:border-border'}`}
              >
                <Lock size={18} className="text-primary shrink-0 mt-0.5" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black uppercase">Private Guild (Invite-Only)</span>
                  <span className="text-[10px] opacity-60 font-bold">Only users explicitly invited by standard admins can join. Completely hidden from directory lists.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 12: INTEGRATIONS */}
        {tab === 'integrations' && (
          <div className="flex-1 flex flex-col gap-3.5 min-h-0">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1 shrink-0">
              Webhooks & Integrations
            </span>

            {/* Quick Webhook Creation */}
            <div className="p-3 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex gap-2 items-end shrink-0">
              <RetroInput
                label="Webhook Name"
                placeholder="GitHub Commits"
                id="webhook-name-field"
                className="flex-1"
              />
              <RetroButton
                variant="primary"
                onClick={() => {
                  triggerAudio('click');
                  const nameEl = document.getElementById('webhook-name-field');
                  if (!nameEl?.value) {
                    addToast('Enter a webhook name.', 'warn');
                    return;
                  }
                  const newWeb = { id: `web_${Date.now()}`, name: nameEl.value, channel: 'general' };
                  setWebhooks(prev => [...prev, newWeb]);
                  addToast(`Webhook "${newWeb.name}" generated!`, 'success');
                  addAuditLog(`Created webhook: ${newWeb.name}`);
                  nameEl.value = '';
                }}
                className="py-1 px-4 uppercase text-xs"
              >
                Add Webhook
              </RetroButton>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
              {webhooks.map(w => (
                <div key={w.id} className="p-2.5 bg-[var(--bg-main)]/5 border border-dashed border-border/15 flex justify-between items-center text-xs font-bold">
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold">{w.name}</span>
                    <span className="text-[9px] opacity-60 font-mono uppercase mt-0.5">
                      Destination Channel: #{w.channel} • Status: Active
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      triggerAudio('click');
                      setWebhooks(prev => prev.filter(x => x.id !== w.id));
                      addToast('Webhook deleted.', 'info');
                      addAuditLog(`Deleted webhook: ${w.name}`);
                    }}
                    className="p-1 text-red-600 hover:bg-red-50 border-0 flex items-center justify-center"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 13: APP DIRECTORY */}
        {tab === 'app_directory' && (
          <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto pr-1">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1">
              App Directory
            </span>

            <div className="grid grid-cols-2 gap-3">
              {/* App 1 */}
              <div className="p-3 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex flex-col justify-between h-32">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs font-black uppercase">Green-bot</span>
                  <p className="text-[10px] opacity-60 leading-tight font-bold">Plays retro audio logs and music tracks inside voice channels.</p>
                </div>
                <RetroButton variant="primary" size="sm" className="w-full uppercase font-black" onClick={() => { triggerAudio('click'); addToast('Green-bot is already authorized in this server.', 'info'); }}>
                  Authorized
                </RetroButton>
              </div>

              {/* App 2 */}
              <div className="p-3 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex flex-col justify-between h-32">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs font-black uppercase">Game-Master</span>
                  <p className="text-[10px] opacity-60 leading-tight font-bold">Unlocks leaderboard scoreboards and multi-player arcade tools.</p>
                </div>
                <RetroButton variant="secondary" size="sm" className="w-full uppercase font-black" onClick={() => { triggerAudio('click'); addToast('Game-Master added to server!', 'success'); addAuditLog('Authorized application: Game-Master'); }}>
                  + Add App
                </RetroButton>
              </div>
            </div>
          </div>
        )}

        {/* TAB 14: SAFETY SETUP */}
        {tab === 'safety' && (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1">
              Verification Safety Settings
            </span>

            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block">Verification Levels</span>
              
              <div className="flex flex-col gap-2.5">
                {[
                  { id: 'none', label: 'None', desc: 'No restrictions on joining members.' },
                  { id: 'low', label: 'Low', desc: 'Members must have a verified email on record.' },
                  { id: 'medium', label: 'Medium', desc: 'Members must be registered for longer than 5 minutes.' },
                  { id: 'high', label: 'High', desc: 'Members must belong to the guild for longer than 10 minutes.' }
                ].map(item => (
                  <div
                    key={item.id}
                    onClick={() => { triggerAudio('click'); setVerificationLevel(item.id); }}
                    className={`p-3 border-2 cursor-pointer flex flex-col gap-0.5 transition-all ${verificationLevel === item.id ? 'border-primary bg-primary/5' : 'border-border/30 hover:border-border'}`}
                  >
                    <span className="text-xs font-black uppercase">{item.label}</span>
                    <span className="text-[10px] opacity-60 font-bold">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 15: AUDIT LOG */}
        {tab === 'audit_log' && (
          <div className="flex-1 flex flex-col gap-3.5 min-h-0">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1 shrink-0">
              Audit Logs
            </span>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
              {auditLogs.map((log, idx) => (
                <div key={idx} className="p-2.5 bg-[var(--bg-main)]/5 border border-dashed border-border/15 flex flex-col gap-1 text-xs font-bold leading-normal">
                  <div className="flex justify-between items-center">
                    <span className="text-primary">{log.user}</span>
                    <span className="text-[9px] opacity-50 font-mono">{log.time}</span>
                  </div>
                  <p className="text-main-text leading-tight">{log.action}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 16: BANS */}
        {tab === 'bans' && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1 shrink-0">
              Banned Accounts ({bans.length})
            </span>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
              {bans.length === 0 ? (
                <p className="text-xs font-bold opacity-60 text-center py-6">No accounts banned from this server.</p>
              ) : (
                bans.map(b => (
                  <div key={b.id} className="p-2.5 bg-[var(--bg-main)]/5 border border-dashed border-border/15 flex justify-between items-center text-xs font-bold">
                    <div className="flex flex-col min-w-0">
                      <span className="text-red-600">{b.name}</span>
                      <span className="text-[9px] opacity-60 mt-0.5 truncate">Reason: {b.reason}</span>
                    </div>
                    <button
                      onClick={() => {
                        triggerAudio('click');
                        setBans(prev => prev.filter(x => x.id !== b.id));
                        addToast(`Unbanned account: ${b.name}`, 'success');
                        addAuditLog(`Revoked ban on user: ${b.name}`);
                      }}
                      className="p-1 px-2.5 text-[9px] font-black uppercase bg-primary text-white hover:brightness-110 retro-border border-0"
                    >
                      Unban
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 17: AUTOMOD */}
        {tab === 'automod' && (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1">
              AutoMod Content Rules
            </span>

            <div className="p-3 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex flex-col gap-3.5">
              <div className="flex justify-between items-center">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black uppercase">Block Profanity & Bad Words</span>
                  <span className="text-[10px] opacity-60 font-bold">Block messages containing flagged keywords/slurs.</span>
                </div>
                <input
                  type="checkbox"
                  checked={automod.profanity}
                  onChange={(e) => {
                    triggerAudio('click');
                    setAutomod(prev => ({ ...prev, profanity: e.target.checked }));
                  }}
                  className="w-4 h-4 cursor-pointer accent-primary animate-none"
                />
              </div>

              <div className="flex justify-between items-center border-t border-dashed border-border/20 pt-3.5">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black uppercase">Block Invitation Links</span>
                  <span className="text-[10px] opacity-60 font-bold">Prevent members from sharing invites to external guilds.</span>
                </div>
                <input
                  type="checkbox"
                  checked={automod.invites}
                  onChange={(e) => {
                    triggerAudio('click');
                    setAutomod(prev => ({ ...prev, invites: e.target.checked }));
                  }}
                  className="w-4 h-4 cursor-pointer accent-primary animate-none"
                />
              </div>

              <div className="flex justify-between items-center border-t border-dashed border-border/20 pt-3.5">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black uppercase">Block Suspicious Links & Spam</span>
                  <span className="text-[10px] opacity-60 font-bold">Flag message bursts and blacklisted domains.</span>
                </div>
                <input
                  type="checkbox"
                  checked={automod.spam}
                  onChange={(e) => {
                    triggerAudio('click');
                    setAutomod(prev => ({ ...prev, spam: e.target.checked }));
                  }}
                  className="w-4 h-4 cursor-pointer accent-primary animate-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 18: ENABLE COMMUNITY */}
        {tab === 'community' && (
          <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto pr-1">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1">
              Enable Community Tools
            </span>

            {isCommunityEnabled ? (
              <div className="p-4 bg-green-500/10 border-2 border-green-500 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-green-600">
                  <Check size={18} />
                  <span className="text-xs font-black uppercase">Community Enabled!</span>
                </div>
                <p className="text-[10px] font-bold text-muted-text">
                  Your server is officially set up as a public Community. You now have access to discovery details, announcements channels, and statistics.
                </p>
                <RetroButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    triggerAudio('click');
                    setIsCommunityEnabled(false);
                    setCommunityStep(0);
                    addToast('Community features disabled.', 'info');
                    addAuditLog('Disabled public community features');
                  }}
                  className="mt-2 text-[10px] uppercase font-black max-w-[120px]"
                >
                  Disable
                </RetroButton>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {communityStep === 0 && (
                  <div className="flex flex-col gap-3.5">
                    <p className="text-xs font-bold text-muted-text leading-relaxed">
                      Convert your private server into a Community to gain access to safety filters, rules channel configuration, and community discovery.
                    </p>
                    <RetroButton
                      variant="primary"
                      onClick={() => { triggerAudio('click'); setCommunityStep(1); }}
                      className="text-xs uppercase self-start"
                    >
                      Get Started
                    </RetroButton>
                  </div>
                )}

                {communityStep === 1 && (
                  <div className="flex flex-col gap-3.5">
                    <span className="text-xs font-black uppercase">Step 1: Security Requirements</span>
                    <p className="text-[10px] text-muted-text font-bold">
                      Public communities require members to have a verified email to minimize spam accounts.
                    </p>
                    <div className="p-3 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex justify-between items-center">
                      <span className="text-xs font-bold">Require verified emails for joining</span>
                      <input type="checkbox" defaultChecked disabled className="w-4 h-4 accent-primary" />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <RetroButton variant="secondary" size="sm" onClick={() => setCommunityStep(0)}>Cancel</RetroButton>
                      <RetroButton variant="primary" size="sm" onClick={() => { triggerAudio('click'); setCommunityStep(2); }}>Next</RetroButton>
                    </div>
                  </div>
                )}

                {communityStep === 2 && (
                  <div className="flex flex-col gap-3.5">
                    <span className="text-xs font-black uppercase">Step 2: Rules & Announcements</span>
                    <p className="text-[10px] text-muted-text font-bold">
                      Set up your core channel rules for server guidelines.
                    </p>
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] uppercase font-bold text-muted-text">Rules Channel</span>
                      <select className="p-1.5 bg-window retro-border text-xs w-full outline-none text-main-text">
                        <option value="announcements">#announcements</option>
                        <option value="general">#general</option>
                      </select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <RetroButton variant="secondary" size="sm" onClick={() => setCommunityStep(1)}>Back</RetroButton>
                      <RetroButton
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          triggerAudio('success');
                          setIsCommunityEnabled(true);
                          setCommunityStep(3);
                          addToast('Community features enabled!', 'success');
                          addAuditLog('Converted server to public community');
                        }}
                      >
                        Finish Setup
                      </RetroButton>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 19: SERVER TEMPLATE */}
        {tab === 'template' && (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1">
              Server Template Link
            </span>

            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-text leading-relaxed">
                Generate a layout template code. Other users can import this template to clone all channel lists, categories, roles, and settings layout when making a new server.
              </p>
            </div>

            <div className="p-3.5 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex flex-col gap-3">
              <span className="text-xs font-black uppercase">Template Link Generator</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`yard.app/template/${activeServer.id.replace('server_', '')}`}
                  className="flex-1 text-xs font-mono font-bold p-2 retro-input-container bg-window select-all outline-none"
                />
                <RetroButton
                  variant="secondary"
                  onClick={() => {
                    triggerAudio('click');
                    navigator.clipboard.writeText(`yard.app/template/${activeServer.id.replace('server_', '')}`);
                    addToast('Template link copied to clipboard!', 'success');
                  }}
                  className="text-xs uppercase font-black"
                >
                  Copy
                </RetroButton>
              </div>
            </div>
          </div>
        )}

        {/* ── FOOTER ACTIONS ── */}
        <div className="flex gap-2 justify-end mt-auto pt-4 border-t border-dashed border-border/25 shrink-0">
          <RetroButton
            variant="secondary"
            onClick={() => { triggerAudio('click'); onClose(); }}
            className="px-4 py-1 text-xs"
          >
            Cancel
          </RetroButton>
          <RetroButton
            variant="primary"
            onClick={handleSave}
            className="px-5 py-1 text-xs"
          >
            Save Settings
          </RetroButton>
        </div>
      </div>
    </div>
  );
}
