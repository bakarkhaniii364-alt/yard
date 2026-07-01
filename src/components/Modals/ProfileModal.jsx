import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ImageIcon, Check, Shield, Trophy, Zap, Sparkles, Smile, MessageSquare,
  Radio, Volume2, Gamepad2, FileText, Send, HelpCircle, Activity 
} from 'lucide-react';
import { RetroWindow, RetroButton, RetroInput, getRetroPfpUrl } from '../UI.jsx';
import { compressImage } from '../../utils/file.js';
import { useChat } from '../../context/instances.js';
import { BOT_POSTS } from '../../constants/botPosts.js';

export function ProfileModal({ 
  userId, 
  currentUserId, 
  partnerId, 
  roomProfiles, 
  partnerStatusData, 
  partnerStatusLabel, 
  updateSyncStateAtomic, 
  toast, 
  onClose,
  posts = [],
  initialTab
}) {
  const isMe = userId === currentUserId;
  const isPartner = userId === partnerId;
  const navigate = useNavigate();
  
  // Resolve profile info
  let profileInfo = roomProfiles?.[userId] || {};
  let isBot = false;

  // Bot profiles fallback
  if (userId === 'yardbot' || userId === 'bot-yardbot') {
    profileInfo = { name: 'yardbot', emoji: '🤖', bio: 'I index feed posts, report status updates, and keep the Yard running smoothly. Beep boop!', status: 'active', activity: 'indexing feed posts...' };
    isBot = true;
  } else if (userId === 'crayoncat' || userId === 'bot-crayoncat') {
    profileInfo = { name: 'crayoncat', emoji: '🐱', bio: 'Napping near the fireplace. I like fish, warm blankets, and playing wordle.', status: 'idle', activity: 'napping near fireplace 💤' };
    isBot = true;
  } else if (userId === 'retrogamer' || userId === 'bot-retrogamer') {
    profileInfo = { name: 'retrogamer', emoji: '🎮', bio: 'Yard\'s resident high score champion. Challenge me in any arcade game!', status: 'active', activity: 'playing wordle race 🏆' };
    isBot = true;
  } else if (userId === 'lofidj' || userId === 'bot-lofidj') {
    profileInfo = { name: 'lofidj', emoji: '🎧', bio: 'Curating the best beats for study and work.', status: 'active', activity: 'spinning retro tracks 🎧' };
    isBot = true;
  } else if (userId === 'pixelpet' || userId === 'bot-pixelpet') {
    profileInfo = { name: 'pixelpet', emoji: '🐾', bio: 'Feed me fish and I will be happy!', status: 'active', activity: 'playing in the yard 🐾' };
    isBot = true;
  } else if (userId === 'spacewanderer' || userId === 'bot-spacewanderer') {
    profileInfo = { name: 'spacewanderer', emoji: '🚀', bio: 'Lost in the retro galaxy.', status: 'active', activity: 'stargazing in orbit 🌌' };
    isBot = true;
  }

  // Local state for editing
  const [editName, setEditName] = useState(profileInfo.name || '');
  const [editBio, setEditBio] = useState(profileInfo.bio || '');
  const [editEmoji, setEditEmoji] = useState(profileInfo.emoji || '👤');
  const [editPfp, setEditPfp] = useState(profileInfo.pfp || null);
  const [editActivity, setEditActivity] = useState(profileInfo.activity || '');
  const [editBanner, setEditBanner] = useState(profileInfo.banner || 'bg-primary-banner');

  // View mode state
  const [activeTab, setActiveTab] = useState(initialTab || 'activity');
  
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [noteText, setNoteText] = useState(() => {
    return localStorage.getItem(`note_${userId}`) || '';
  });

  const chat = useChat();

  const handlePfpUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result, 150, 150, 0.6);
          setEditPfp(compressed);
          toast('Photo buffered. Click SAVE to apply.', 'info');
        } catch (err) {
          toast('Failed to process photo.', 'error');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result, 400, 150, 0.6);
          setEditBanner(compressed);
          toast('Banner buffered. Click SAVE to apply.', 'info');
        } catch (err) {
          toast('Failed to process banner.', 'error');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!editName.trim()) {
      toast('Name cannot be empty.', 'error');
      return;
    }
    updateSyncStateAtomic('room_profiles', currentUserId, {
      name: editName,
      bio: editBio,
      emoji: editEmoji,
      pfp: editPfp,
      activity: editActivity,
      banner: editBanner
    });
    toast('Profile updated successfully!', 'success');
    onClose();
  };

  const handleSaveNote = (val) => {
    if (val.length <= 250) {
      setNoteText(val);
      localStorage.setItem(`note_${userId}`, val);
    }
  };

  const handlePlayChallenge = (gameKey, gameTitle) => {
    if (isBot) {
      if (userId === 'crayoncat') {
        toast('🐱 crayoncat ignored your invite. They are napping near the fireplace.', 'info');
      } else if (userId === 'retrogamer') {
        toast(`🎮 retrogamer: "accepted! Let's match in ${gameTitle}."`, 'success');
        setTimeout(() => {
          onClose();
          navigate(`/arcade/${gameKey}`);
        }, 1000);
      } else {
        toast('🤖 yardbot: "Challenges denied. Processing power reserved for server sync."', 'warn');
      }
    } else if (isPartner) {
      if (chat && chat.sendMessage) {
        chat.sendMessage(`Join my lobby for ${gameTitle}!`, 'game_invite', { gameId: gameKey, gameTitle, inviteStatus: 'pending' });
        toast(`Challenged ${partnerName} in ${gameTitle}! Invite posted to Chat.`, 'success');
      } else {
        toast('Messenger offline. Cannot send game challenge.', 'error');
      }
    }
  };

  const handlePing = () => {
    if (isBot) {
      if (userId === 'yardbot') {
        toast('🤖 yardbot: "Ping received. Response time 0.2ms. System stable."', 'info');
      } else if (userId === 'crayoncat') {
        toast('🐱 crayoncat: *twitches ears in sleep and continues purring*', 'info');
      } else if (userId === 'retrogamer') {
        toast('🎮 retrogamer: "Don\'t distract me! I am in the middle of a high score streak!"', 'warn');
      }
    } else {
      toast(`📟 Pinged @${isMe ? 'yourself' : (userId.split('-')[0] || 'user')}!`, 'success');
    }
  };

  const mapUserIdToDmId = (targetUserId, partnerId) => {
    if (!targetUserId) return 'e2e00000ab124c348f567890abcdef00';
    if (targetUserId === partnerId) return 'e2e00000ab124c348f567890abcdef00';
    const cleanId = targetUserId.toLowerCase();
    if (cleanId.includes('alice')) return 'a11ce000ab124c348f567890abcdef00';
    if (cleanId.includes('yardbot') || cleanId.includes('retro_bot') || cleanId.includes('retrobot')) return '5eb40b00ab124c348f567890abcdef00';
    if (cleanId.includes('crayoncat')) return 'c4a70ca7ab124c348f567890abcdef00';
    if (cleanId.includes('retrogamer')) return '4e740900ab124c348f567890abcdef00';
    if (cleanId.includes('lofidj')) return '10f1d100ab124c348f567890abcdef00';
    if (cleanId.includes('pixelpet')) return 'b1e1be70ab124c348f567890abcdef00';
    if (cleanId.includes('spacewanderer')) return '5bac3000ab124c348f567890abcdef00';
    return 'e2e00000ab124c348f567890abcdef00';
  };

  const handleMessageClick = () => {
    const targetDmId = mapUserIdToDmId(userId, partnerId);
    toast(`Opening Chat with ${profileInfo.name || 'user'}...`, 'success');
    onClose();
    navigate('/chat', { state: { selectDmId: targetDmId } });
  };

  const handleAddFriendClick = () => {
    if (isPartner) {
      toast(`You and @${partnerName.toLowerCase()} are already coupled and connected!`, 'success');
    } else if (isBot) {
      toast(`Friend request sent to @${userId}. (request auto-accepted!)`, 'success');
    } else {
      toast(`Friend request sent to @${userId.split('-')[0]}. Pending acceptance.`, 'success');
    }
  };

  const status = isBot ? profileInfo.status : (isPartner ? partnerStatusData?.status : 'active');
  const statusLabel = isBot ? profileInfo.activity : (isPartner ? partnerStatusLabel : 'online');

  // Compute profile card details dynamically (supports live preview in Edit Mode)
  const currentBanner = isMe ? editBanner : (profileInfo.banner || 'bg-primary-banner');
  const currentPfp = isMe ? editPfp : profileInfo.pfp;
  const currentEmoji = isMe ? editEmoji : (profileInfo.emoji || '👤');
  const currentDisplayName = isMe ? editName : (profileInfo.name || 'User');
  const currentBio = isMe ? editBio : profileInfo.bio;
  const currentActivity = isMe ? editActivity : statusLabel;

  // Resolve user badges
  const getBadges = () => {
    const list = [];
    if (isBot) {
      list.push({ text: 'yard.ai', icon: Shield, color: 'text-purple-500 border-purple-300 bg-purple-500/10' });
    } else {
      list.push({ text: 'sysop.dev', icon: Shield, color: 'text-blue-500 border-blue-300 bg-blue-500/10' });
      list.push({ text: 'yard.elder', icon: Sparkles, color: 'text-amber-500 border-amber-300 bg-amber-500/10' });
    }

    if (userId === 'retrogamer') {
      list.push({ text: 'arcade.pro', icon: Trophy, color: 'text-yellow-600 border-yellow-400 bg-yellow-500/10' });
    }
    if (userId === 'crayoncat') {
      list.push({ text: 'fireplace.nap', icon: Smile, color: 'text-emerald-500 border-emerald-300 bg-emerald-500/10' });
    }

    // Check if user has posts
    const hasPosts = [...(posts || []), ...BOT_POSTS].some(p => p.user_id === userId);
    if (hasPosts) {
      list.push({ text: 'active.poster', icon: Zap, color: 'text-rose-500 border-rose-300 bg-rose-500/10' });
    }

    return list;
  };

  const partnerName = roomProfiles?.[partnerId]?.name || 'Partner';
  const displayUsername = isBot ? userId : (profileInfo.username || (profileInfo.name || 'user').toLowerCase().replace(/\s+/g, ''));

  // Filter last 3 posts of this user/bot
  const userPosts = [...(posts || []), ...BOT_POSTS]
    .filter(p => p.user_id === userId)
    .slice(0, 3);

  const bannerPresets = [
    { label: 'Default Primary', value: 'bg-primary-banner' },
    { label: 'Retro Amber', value: 'bg-amber-500' },
    { label: 'Vaporwave Sunset', value: 'post-bg-vaporwave' },
    { label: 'Matrix Neon', value: 'post-bg-matrix' },
    { label: 'Midnight Purple', value: 'post-bg-midnight' },
    { label: 'Sunset Orange', value: 'post-bg-sunset' },
    { label: 'Cyberpunk Yellow', value: 'post-bg-cyberpunk' },
    { label: 'Matcha Green', value: 'post-bg-matcha' },
  ];

  return (
    <div className="modal-backdrop fixed inset-0 z-[var(--z-modal)] flex items-center justify-center">
      <RetroWindow
        title={isMe ? "profile_editor.exe" : "user_profile.sys"}
        onClose={onClose}
        className="universal-modal"
        noPadding
      >
        <div className="flex flex-col md:flex-row h-full divide-y md:divide-y-0 md:divide-x divide-dashed divide-border/20 bg-window overflow-hidden">
          
          {/* ── LEFT COLUMN: DISCORD STYLE PROFILE CARD PREVIEW ── */}
          <div className="w-full md:w-[280px] shrink-0 p-4 flex flex-col bg-[var(--bg-main)]/5 justify-between">
            <div className="glass-window bg-window retro-border-thick relative overflow-hidden flex flex-col min-h-[380px]">
              
              {/* Banner Area */}
              <div className="relative h-20 w-full shrink-0 border-b-2 border-border">
                {currentBanner.startsWith('data:image/') || currentBanner.startsWith('http') ? (
                  <img src={currentBanner} className="w-full h-full object-cover" alt="Custom Banner" />
                ) : (
                  <div className={`w-full h-full ${currentBanner}`} />
                )}
              </div>

              {/* Overlapping Avatar */}
              <div className="relative -mt-10 ml-4 shrink-0 w-16 h-16">
                {currentPfp || getRetroPfpUrl(currentDisplayName) ? (
                  <img src={currentPfp || getRetroPfpUrl(currentDisplayName)} alt="Avatar" className="w-16 h-16 retro-border object-cover bg-white" />
                ) : (
                  <div className="w-16 h-16 retro-border bg-secondary text-secondary-text flex items-center justify-center text-3xl">
                    {currentEmoji}
                  </div>
                )}
                {/* Status Dot */}
                <div 
                  className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-window rounded-full ${
                    status === 'active' ? 'bg-success' : status === 'idle' ? 'bg-warning' : 'bg-disabled'
                  }`}
                  title={status === 'active' ? 'Online' : status === 'idle' ? 'Idle' : 'Offline'}
                />
              </div>

              {/* Profile Details */}
              <div className="p-4 pt-2 flex flex-col gap-1 flex-1 min-h-0">
                <h3 className="text-sm font-black lowercase leading-none truncate">{currentDisplayName}</h3>
                <p className="text-[10px] opacity-50 font-mono mt-0.5 lowercase">
                  @{displayUsername}
                </p>

                {/* Badges */}
                <div className="flex flex-wrap gap-1 mt-1.5 shrink-0">
                  {getBadges().map(b => {
                    const Icon = b.icon;
                    return (
                      <span key={b.text} className={`flex items-center gap-0.5 text-[8px] font-black uppercase px-1 py-0.2 border leading-none ${b.color}`}>
                        <Icon size={7} />
                        <span>{b.text}</span>
                      </span>
                    );
                  })}
                </div>

                {/* Action Buttons Row */}
                {!isMe && (
                  <div className="flex items-center gap-1.5 mt-2.5 shrink-0">
                    <RetroButton 
                      size="sm" 
                      variant="primary" 
                      className="flex-1 py-1 text-[10px] uppercase font-black gap-1 justify-center leading-none h-7"
                      onClick={handleMessageClick}
                    >
                      <MessageSquare size={10} />
                      <span>Message</span>
                    </RetroButton>

                    <button 
                      className="p-1.5 leading-none h-7 flex items-center justify-center retro-border bg-window hover:bg-[var(--bg-main)]/10 text-primary transition-all active:translate-y-[1px]"
                      onClick={handleAddFriendClick}
                      title="Send Friend Request"
                    >
                      <Smile size={12} />
                    </button>

                    <button 
                      className="p-1.5 leading-none h-7 flex items-center justify-center retro-border bg-window hover:bg-[var(--bg-main)]/10 text-main-text transition-all active:translate-y-[1px] font-mono text-[9px] font-black"
                      onClick={() => {
                        toast('Option menu buffered. No additional settings.', 'info');
                      }}
                      title="More Options"
                    >
                      ...
                    </button>
                  </div>
                )}

                <div className="border-t border-dashed border-border/20 my-2 shrink-0" />

                {/* Custom Bio / About Me */}
                <div className="text-[11px] font-bold leading-normal text-main-text overflow-y-auto max-h-24 pr-1 custom-scrollbar">
                  <span className="text-[8px] font-black uppercase opacity-55 block mb-0.5">About Me</span>
                  <p className="whitespace-pre-line">{currentBio || 'No biography written yet.'}</p>
                </div>
              </div>

              {/* Quick Action Footer inside Card */}
              <div className="p-2 bg-[var(--bg-main)]/10 border-t border-dashed border-border/20 flex gap-2 justify-between items-center shrink-0">
                <span className="text-[9px] opacity-45 font-mono">yard_profile v1.5</span>
                {!isMe && (
                  <button 
                    onClick={handlePing}
                    className="p-1 text-primary hover:text-primary/80 retro-border flex items-center justify-center bg-window leading-none"
                    title="Send Ping Notification"
                  >
                    <Volume2 size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: FORM EDITOR OR TABS VIEW ── */}
          <div className="flex-1 p-4 flex flex-col min-h-0 bg-window">
            {isMe ? (
              // ── EDIT MODE (FOR CURRENT LOGGED-IN USER) ──
              <div className="flex flex-col gap-3.5 h-full overflow-y-auto pr-1 custom-scrollbar">
                <div className="flex justify-between items-center border-b border-dashed border-border/25 pb-1 shrink-0">
                  <span className="text-[10px] font-black uppercase opacity-65 tracking-widest">Customize Profile</span>
                  <span className="text-[9px] font-bold text-primary">REAL-TIME PREVIEW ON LEFT</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 shrink-0">
                  <div className="flex-1 flex flex-col gap-2.5">
                    <RetroInput 
                      label="Your Display Name" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={15}
                    />
                    <RetroInput 
                      label="Profile Emoji Symbol" 
                      value={editEmoji}
                      onChange={(e) => setEditEmoji(e.target.value)}
                      maxLength={2}
                    />
                  </div>

                  {/* Avatar Upload */}
                  <div className="flex flex-col gap-1.5 shrink-0 justify-center">
                    <span className="text-[10px] text-muted-text font-mono uppercase tracking-wider">Avatar Picture</span>
                    <label className="flex items-center gap-2 px-3 py-2 text-xs bg-window text-main-text retro-border hover:bg-[var(--bg-main)]/10 cursor-pointer justify-center">
                      <ImageIcon size={14} className="text-primary" />
                      <span>Choose Custom PFP...</span>
                      <input type="file" accept="image/*" onChange={handlePfpUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Banner Customization */}
                <div className="flex flex-col gap-2 shrink-0">
                  <span className="text-[10px] text-muted-text font-mono uppercase tracking-wider block">Banner Style</span>
                  <div className="flex flex-wrap gap-2 items-center">
                    {/* Upload banner */}
                    <label className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] bg-window text-main-text retro-border hover:bg-[var(--bg-main)]/10 cursor-pointer">
                      <ImageIcon size={11} className="text-secondary" />
                      <span>Upload Banner...</span>
                      <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
                    </label>

                    {/* Presets */}
                    <div className="flex flex-wrap gap-1.5">
                      {bannerPresets.map(preset => (
                        <button
                          key={preset.value}
                          onClick={() => setEditBanner(preset.value)}
                          className={`px-2 py-0.5 text-[9px] font-bold retro-border ${
                            editBanner === preset.value ? 'bg-primary text-primary-text border-primary' : 'bg-window hover:bg-[var(--bg-main)]/5'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Custom Status */}
                <div className="shrink-0">
                  <RetroInput 
                    label="Current Activity / Status Status" 
                    value={editActivity}
                    onChange={(e) => setEditActivity(e.target.value)}
                    placeholder="e.g. napping near fireplace"
                    maxLength={40}
                  />
                </div>

                {/* About Me (Bio) */}
                <div className="flex flex-col gap-1.5 flex-1 min-h-[90px]">
                  <label className="block text-[10px] text-muted-text font-mono uppercase tracking-wider">About Me (Bio)</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Write something about yourself..."
                    className="w-full p-2.5 text-xs bg-window text-main-text retro-border focus:outline-none focus:ring-1 focus:ring-primary/20 font-bold flex-1 resize-none min-h-[70px]"
                    maxLength={150}
                  />
                </div>

                {/* Actions Panel */}
                <div className="flex gap-2 justify-end pt-3 border-t border-dashed border-border/25 shrink-0 mt-auto">
                  <RetroButton variant="secondary" onClick={onClose} className="px-4 py-1.5 text-xs uppercase font-black">
                    Cancel
                  </RetroButton>
                  <RetroButton variant="primary" onClick={handleSave} className="px-5 py-1.5 text-xs uppercase font-black">
                    <Check size={12} className="inline mr-1" /> Save Profile
                  </RetroButton>
                </div>
              </div>
            ) : (
              // ── VIEW MODE (FOR OTHER USERS OR simulated BOTS) ──
              <div className="flex flex-col h-full min-h-0">
                {/* Discord-like tabs header */}
                <div className="flex border-b border-dashed border-border/20 shrink-0 gap-1 mb-4">
                  <button
                    onClick={() => setActiveTab('activity')}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                      activeTab === 'activity' ? 'border-primary text-primary' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    Activity
                  </button>
                  <button
                    onClick={() => setActiveTab('connections')}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                      activeTab === 'connections' ? 'border-primary text-primary' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    Socials
                  </button>
                  <button
                    onClick={() => setActiveTab('actions')}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                      activeTab === 'actions' ? 'border-primary text-primary' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    Challenges
                  </button>
                  <button
                    onClick={() => setActiveTab('notepad')}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                      activeTab === 'notepad' ? 'border-primary text-primary' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    Private Note
                  </button>
                </div>

                {/* Tab content area */}
                <div className="flex-1 overflow-y-auto pr-1 min-h-0 custom-scrollbar">
                  
                  {/* TAB 1: ACTIVITY & RECENT POSTS */}
                  {activeTab === 'activity' && (
                    <div className="flex flex-col gap-4">
                      
                      {/* Active Status Description */}
                      <div className="p-3.5 bg-[var(--bg-main)]/10 border border-dashed border-border/25 flex flex-col gap-1.5">
                        <span className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                          <Activity size={10} className="animate-pulse" />
                          <span>Status Terminal</span>
                        </span>
                        
                        {isBot ? (
                          <div className="font-mono text-[11px] leading-relaxed text-main-text flex flex-col gap-0.5">
                            {userId === 'yardbot' && (
                              <>
                                <p>System Process: ONLINE (Uptime 252.1h)</p>
                                <p>Load: CPU 8.4% | Memory 4.5MB</p>
                                <p>Active Tasks: Indexing board posts, monitoring E2EE p2p rooms</p>
                              </>
                            )}
                            {userId === 'crayoncat' && (
                              <>
                                <p>Activity: IDLE (Sleeping near fireplace)</p>
                                <p>Dream Index: Purring 98.4% (Deep sleep)</p>
                                <p>Current Mood: Needs fresh salmon pings</p>
                              </>
                            )}
                            {userId === 'retrogamer' && (
                              <>
                                <p>Activity: ACTIVE (Arcade Champion)</p>
                                <p>Leaderboards: 1st place in Retro Uno</p>
                                <p>Current task: Challenging everyone on board</p>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-main-text flex flex-col gap-1">
                            <p className="italic">"{currentActivity || 'No active status message set.'}"</p>
                            <p className="text-[9px] font-mono opacity-50 lowercase mt-1">
                              online since {new Date(partnerStatusData?.lastSeen || Date.now()).toLocaleTimeString()}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Recent Posts Feed */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[9px] font-black uppercase opacity-65 tracking-wider block">
                          Recent Board Posts ({userPosts.length})
                        </span>
                        {userPosts.length === 0 ? (
                          <p className="text-[11px] font-bold opacity-50 italic text-center py-4 bg-[var(--bg-main)]/5 border border-dashed border-border/10">
                            No recent posts from this user on the board.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {userPosts.map(p => (
                              <div key={p.id} className="p-3 bg-[var(--bg-main)]/5 border border-dashed border-border/20 flex flex-col justify-between hover:bg-[var(--bg-main)]/10 transition-colors">
                                <p className="text-xs font-bold leading-relaxed text-main-text">"{p.content}"</p>
                                <span className="text-[8px] opacity-45 font-mono mt-1 block self-end">
                                  {new Date(p.created_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: CONNECTIONS */}
                  {activeTab === 'connections' && (
                    <div className="flex flex-col gap-3">
                      <span className="text-[9px] font-black uppercase opacity-55 tracking-wider">Social Integrations</span>
                      
                      {/* Social 1: Spotify / Radio */}
                      <div className="p-3 bg-[var(--bg-main)]/10 retro-border flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                          <Radio size={16} className="text-green-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase leading-none">Lofi FM Radio</p>
                            <p className="text-[9px] opacity-50 mt-1 truncate lowercase">active listening connection</p>
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase text-success border border-success bg-success/10 shrink-0">
                          Connected
                        </span>
                      </div>

                      {/* Social 2: Arcade Systems */}
                      <div className="p-3 bg-[var(--bg-main)]/10 retro-border flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                          <Trophy size={16} className="text-yellow-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase leading-none">Arcade Leaderboards</p>
                            <p className="text-[9px] opacity-50 mt-1 truncate lowercase">
                              {userId === 'retrogamer' ? 'score: 1,420 pts (rank #1)' : 'score sync active'}
                            </p>
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase text-primary border border-primary bg-primary/10 shrink-0">
                          {userId === 'retrogamer' ? 'arcade_god' : 'Synced'}
                        </span>
                      </div>

                      {/* Social 3: GitHub codebase */}
                      <div className="p-3 bg-[var(--bg-main)]/10 retro-border flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                          <Shield size={16} className="text-blue-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase leading-none">GitHub Yard Room</p>
                            <p className="text-[9px] opacity-50 mt-1 truncate lowercase">p2p repository</p>
                          </div>
                        </div>
                        <a 
                          href="https://github.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 text-[9px] font-black uppercase bg-primary text-primary-text hover:bg-primary/95 retro-border shrink-0"
                        >
                          Source Code ↗
                        </a>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: CHALLENGES / ACTIONS */}
                  {activeTab === 'actions' && (
                    <div className="flex flex-col gap-4">
                      <div className="p-3 bg-window border border-dashed border-border/20">
                        <span className="text-[10px] font-black uppercase text-primary tracking-widest block mb-1">Challenge Center</span>
                        <p className="text-[11px] font-bold opacity-60 leading-relaxed">
                          Challenge this user to any retro game. Clicks will automatically post a room game invite into the chat feed!
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <RetroButton 
                          variant="white" 
                          onClick={() => handlePlayChallenge('wordle', 'Wordle')}
                          className="w-full py-2.5 text-xs font-black uppercase gap-2 justify-center"
                        >
                          <Gamepad2 size={12} className="text-yellow-500" />
                          <span>Challenge Wordle</span>
                        </RetroButton>

                        <RetroButton 
                          variant="white" 
                          onClick={() => handlePlayChallenge('ludo', 'Retro Ludo')}
                          className="w-full py-2.5 text-xs font-black uppercase gap-2 justify-center"
                        >
                          <Gamepad2 size={12} className="text-rose-500" />
                          <span>Challenge Ludo</span>
                        </RetroButton>

                        <RetroButton 
                          variant="white" 
                          onClick={() => handlePlayChallenge('typing', 'Typing Race')}
                          className="w-full py-2.5 text-xs font-black uppercase gap-2 justify-center"
                        >
                          <Gamepad2 size={12} className="text-blue-500" />
                          <span>Challenge Type Race</span>
                        </RetroButton>

                        <RetroButton 
                          variant="secondary" 
                          onClick={handlePing}
                          className="w-full py-2.5 text-xs font-black uppercase gap-2 justify-center"
                        >
                          <Volume2 size={12} className="text-emerald-500 animate-bounce" />
                          <span>Send Ring Signal</span>
                        </RetroButton>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: PRIVATE NOTE (YELLOW STICKY NOTE) */}
                  {activeTab === 'notepad' && (
                    <div className="bg-[#fef9c3] p-4 retro-border border-yellow-400 text-black font-mono flex flex-col gap-2 relative shadow-lg">
                      <div className="text-[10px] font-black uppercase text-yellow-600 border-b border-dashed border-yellow-300 pb-1 flex justify-between">
                        <span className="flex items-center gap-1">
                          <FileText size={10} />
                          <span>Private User Memo</span>
                        </span>
                        <span>Autosaved</span>
                      </div>
                      
                      <textarea
                        value={noteText}
                        onChange={(e) => handleSaveNote(e.target.value)}
                        placeholder="Type a private memo about this user here. It is saved in your local browser storage and is never sent to the server."
                        className="w-full bg-transparent text-xs font-bold leading-relaxed resize-none h-36 focus:outline-none text-black placeholder-yellow-600/50 font-mono border-none"
                        maxLength={250}
                      />
                      
                      <div className="text-[9px] text-right text-yellow-600/80 border-t border-dashed border-yellow-300 pt-1 flex justify-between items-center">
                        <span>Private note (visible only to you)</span>
                        <span>{noteText.length} / 250 chars</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* No view mode footer since window has header close button */}
              </div>
            )}
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
