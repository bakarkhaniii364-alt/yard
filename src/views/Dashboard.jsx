import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Heart, Gamepad2, MessageSquare, Settings as SettingsIcon, 
  Flame, Bell, Search, Plus, Edit2, Check, X, Trophy, 
  Activity, Sparkles, Smile, MessageCircle, LogOut, Share2, Trash2, Copy,
  Image as ImageIcon, Paperclip, Type, Eye, Mic, MicOff, Headphones,
  Video, Film, MapPin, Phone, MoreHorizontal
} from 'lucide-react';
import { RetroWindow, RetroButton, RetroInput, ConfirmDialog, useToast, ImageViewerOverlay } from '../components/UI.jsx';
import { useAuth, useSync, useChat } from '../context/instances.js';
import { useDashboardLogic } from '../hooks/useDashboardLogic.js';
import { useLastSeen } from '../hooks/useLastSeen.js';
import { useNotificationHistory } from '../hooks/useNotificationHistory.js';
import { NotificationHistoryModal } from '../components/Modals/NotificationHistoryModal.jsx';
import { supabase } from '../lib/supabase.js';
import { BOT_POSTS } from '../constants/botPosts.js';
import { PostDetailView } from './PostDetailView.jsx';
import { ShareModal } from '../components/Modals/ShareModal.jsx';
import { useAssetSync } from '../hooks/useAssetSync.js';
import { compressImage } from '../utils/file.js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export function Dashboard({ theme, setTheme, sfxEnabled, setSfxEnabled, notificationsEnabled, setNotificationsEnabled, weather, setWeather, onOpenLeaderboard }) {
  const { userId, partnerId, roomId, logout, user } = useAuth();
  const sync = useSync();
  const { globalState, isInitialized, updateSyncState, updateSyncStateAtomic, mergeSyncState, broadcast: syncBroadcast } = sync;
  const { messages: chatHistory, sendMessage: syncSendMessage, searchMessages } = useChat();
  const toast = useToast();
  const navigate = useNavigate();

  // Basic profiles
  const profile = globalState?.room_profiles?.[userId] || {};
  const partnerProfile = globalState?.room_profiles?.[partnerId] || {};
  const streaks = globalState?.user_streaks?.[userId] || { count: 0 };
  const coupleData = globalState?.couple_data || {};

  const partnerName = coupleData.nicknames?.[partnerId] || partnerProfile.name || 'Partner';

  // Last seen tracking
  const { partnerStatusData, partnerStatusLabel } = useLastSeen();
  const isPartnerOnline = partnerStatusData.status === 'active';
  const isPartnerIdle = partnerStatusData.status === 'idle';

  // Run original dashboard logic in the background (handles streaks, weather caching, etc.)
  const dashboardLogic = useDashboardLogic({
    userId, roomId, partnerId, partnerProfile,
    updateSyncStateAtomic, mergeSyncState, sfxEnabled,
    toast, setShowKiss: () => {}, syncBroadcast, coupleData,
    globalState, isInitialized, user
  });
  const dbStats = dashboardLogic?.dbStats || {};

  // Notifications
  const { history, unreadCount } = useNotificationHistory(userId);
  const [showNotifModal, setShowNotifModal] = useState(false);

  // Bio States
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState('');

  useEffect(() => {
    if (profile.bio) {
      setBioInput(profile.bio);
    }
  }, [profile.bio]);

  // Window Visibility States (backed by localStorage for persistence)
  const [showProfile, setShowProfile] = useState(() => localStorage.getItem('win_show_profile') !== 'false');
  const [showShortcuts, setShowShortcuts] = useState(() => localStorage.getItem('win_show_shortcuts') !== 'false');
  const [showActiveFriends, setShowActiveFriends] = useState(() => localStorage.getItem('win_show_active_friends') !== 'false');
  const [showFriendRequests, setShowFriendRequests] = useState(() => localStorage.getItem('win_show_friend_requests') !== 'false');
  const [showNotificationsWindow, setShowNotificationsWindow] = useState(() => localStorage.getItem('win_show_notifications_window') !== 'false');
  const [showStats, setShowStats] = useState(() => localStorage.getItem('win_show_stats') !== 'false');

  const handleSetShowProfile = (val) => {
    setShowProfile(val);
    localStorage.setItem('win_show_profile', String(val));
  };
  const handleSetShowShortcuts = (val) => {
    setShowShortcuts(val);
    localStorage.setItem('win_show_shortcuts', String(val));
  };
  const handleSetShowActiveFriends = (val) => {
    setShowActiveFriends(val);
    localStorage.setItem('win_show_active_friends', String(val));
  };
  const handleSetShowFriendRequests = (val) => {
    setShowFriendRequests(val);
    localStorage.setItem('win_show_friend_requests', String(val));
  };
  const handleSetShowNotificationsWindow = (val) => {
    setShowNotificationsWindow(val);
    localStorage.setItem('win_show_notifications_window', String(val));
  };
  const handleSetShowStats = (val) => {
    setShowStats(val);
    localStorage.setItem('win_show_stats', String(val));
  };

  // Quick Action States (Discord Style)
  const [micMuted, setMicMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);

  // Mock Friend Requests
  const [friendRequests, setFriendRequests] = useState([
    { id: 'req-1', name: 'pixelart_fan', emoji: '🎨' },
    { id: 'req-2', name: 'cyber_runner', emoji: '⚡' },
    { id: 'req-3', name: 'cozy_tea', emoji: '🍵' }
  ]);

  // Ignore/Mute States
  const [selectedPostForIgnore, setSelectedPostForIgnore] = useState(null);
  const [ignoredPostIds, setIgnoredPostIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ignored_post_ids') || '[]');
    } catch (e) {
      return [];
    }
  });
  const [ignoredUserIds, setIgnoredUserIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ignored_user_ids') || '[]');
    } catch (e) {
      return [];
    }
  });

  const ignorePost = (postId) => {
    const next = [...ignoredPostIds, postId];
    setIgnoredPostIds(next);
    localStorage.setItem('ignored_post_ids', JSON.stringify(next));
    toast({
      message: 'Post ignored.',
      type: 'success',
      action: {
        label: 'Undo',
        onClick: () => {
          const undoList = next.filter(id => id !== postId);
          setIgnoredPostIds(undoList);
          localStorage.setItem('ignored_post_ids', JSON.stringify(undoList));
        }
      }
    });
  };

  const ignoreUser = (authorId, username) => {
    const next = [...ignoredUserIds, authorId];
    setIgnoredUserIds(next);
    localStorage.setItem('ignored_user_ids', JSON.stringify(next));
    toast({
      message: `Muted all posts from @${username || 'user'}.`,
      type: 'success',
      action: {
        label: 'Undo',
        onClick: () => {
          const undoList = next.filter(id => id !== authorId);
          setIgnoredUserIds(undoList);
          localStorage.setItem('ignored_user_ids', JSON.stringify(undoList));
        }
      }
    });
  };

  // Feed States
  const [dbPosts, setDbPosts] = useState([]);
  const [postContent, setPostContent] = useState('');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Search takeover states
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchTab, setSearchTab] = useState('all');
  const [matchingMessages, setMatchingMessages] = useState([]);
  const [messagesSearchLoading, setMessagesSearchLoading] = useState(false);
  const [savedScrollTop, setSavedScrollTop] = useState(0);

  const handleOpenSearch = () => {
    if (!isSearchActive) {
      if (scrollContainerRef.current) {
        setSavedScrollTop(scrollContainerRef.current.scrollTop);
      }
      setIsSearchActive(true);
    }
  };

  const handleCloseSearch = () => {
    setIsSearchActive(false);
    setSearchQuery('');
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = savedScrollTop;
      }
    }, 50);
  };

  const location = useLocation();

  useEffect(() => {
    if (location.state?.autoOpenSearch) {
      handleOpenSearch();
      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => {
        const input = document.querySelector('input[placeholder="Search feed posts or users..."]');
        if (input) {
          input.focus();
          input.select();
        }
      }, 100);
    }
  }, [location.state]);

  useEffect(() => {
    const handleOpenSearchEvent = () => {
      handleOpenSearch();
      setTimeout(() => {
        const input = document.querySelector('input[placeholder="Search feed posts or users..."]');
        if (input) {
          input.focus();
          input.select();
        }
      }, 50);
    };
    window.addEventListener('open_search', handleOpenSearchEvent);
    return () => window.removeEventListener('open_search', handleOpenSearchEvent);
  }, [savedScrollTop, isSearchActive]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || 
          document.activeElement.tagName === 'TEXTAREA' || 
          document.activeElement.isContentEditable) {
        return;
      }

      if (e.key === '/' || (e.ctrlKey && e.key === 'k')) {
        e.preventDefault();
        handleOpenSearch();
        setTimeout(() => {
          const input = document.querySelector('input[placeholder="Search feed posts or users..."]');
          if (input) {
            input.focus();
            input.select();
          }
        }, 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [savedScrollTop, isSearchActive]);

  useEffect(() => {
    if (!isSearchActive) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        handleCloseSearch();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isSearchActive, savedScrollTop]);

  // Debounced message search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setMatchingMessages([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setMessagesSearchLoading(true);
      try {
        const { data } = await searchMessages(searchQuery, 0, 50);
        setMatchingMessages(data || []);
      } catch (err) {
        console.error("Error searching messages:", err);
      } finally {
        setMessagesSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, searchMessages]);

  // Rich Compose States
  const [selectedBg, setSelectedBg] = useState('none');
  const [selectedPhoto, setSelectedPhoto] = useState(null); // base64 compressed dataUrl
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [composePreviewMode, setComposePreviewMode] = useState(false);
  const [viewImageSrc, setViewImageSrc] = useState(null); // for ImageViewerOverlay
  
  const photoInputRef = useRef(null);
  const textareaRef = useRef(null);
  const { uploadAsset } = useAssetSync(roomId);

  // Comments / Share Modals
  const [selectedPostForComments, setSelectedPostForComments] = useState(null);
  const [sharingPost, setSharingPost] = useState(null);
  
  const handleContextMenu = (e, targetUserId) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('show_user_context_menu', {
      detail: {
        x: e.clientX,
        y: e.clientY,
        userId: targetUserId
      }
    }));
  };

  // Logout confirm
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const scrollContainerRef = useRef(null);

  // Helper to process mentions in posts
  const processMentionsInMarkdown = (text) => {
    if (!text) return '';
    let processed = text;
    
    // Find all @words
    const matches = text.match(/@\w+/g);
    if (matches) {
      const uniqueMatches = [...new Set(matches)];
      uniqueMatches.forEach(match => {
        const usernameClean = match.slice(1);
        
        // Find matching user
        const matchedUserId = Object.keys(globalState?.room_profiles || {}).find(uid => {
          const profileName = globalState.room_profiles[uid]?.name || '';
          const emailName = globalState.room_profiles[uid]?.email?.split('@')[0] || '';
          const shortUid = uid.split('-')[0];
          return profileName.toLowerCase() === usernameClean.toLowerCase() || 
                 emailName.toLowerCase() === usernameClean.toLowerCase() ||
                 shortUid.toLowerCase() === usernameClean.toLowerCase();
        });
        
        const isBotMatch = ['yardbot', 'crayoncat', 'retrogamer'].includes(usernameClean.toLowerCase());
        const botId = isBotMatch ? usernameClean.toLowerCase() : null;
        
        const targetUserId = matchedUserId || botId;
        if (targetUserId) {
          const regex = new RegExp(`${match}\\b`, 'g');
          processed = processed.replace(regex, `[${match}](mention://${targetUserId})`);
        }
      });
    }
    return processed;
  };

  // Fetch Posts from Supabase or Fallback to state
  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('yard_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setDbPosts(data);
      } else {
        setDbPosts(globalState.posts || []);
      }
    } catch (e) {
      setDbPosts(globalState.posts || []);
    }
  };

  useEffect(() => {
    if (isInitialized) {
      fetchPosts();
    }
  }, [isInitialized, globalState.posts]);

  // Combined Posts list (User + Bots) sorted by date descending
  const customPosts = dbPosts.length > 0 ? dbPosts : (globalState.posts || []);
  const postsToRender = [...customPosts, ...BOT_POSTS].map(p => {
    if (p.id.startsWith('botpost-') && globalState.bot_likes?.[p.id] !== undefined) {
      return { ...p, likes: globalState.bot_likes[p.id] };
    }
    return p;
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const filteredPosts = postsToRender.filter(post => {
    if (ignoredPostIds.includes(post.id)) return false;
    if (ignoredUserIds.includes(post.user_id)) return false;

    const author = globalState.room_profiles?.[post.user_id] || { name: post.username || 'Anonymous' };
    const nameMatch = author.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const contentMatch = post.content?.toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || contentMatch;
  });

  const allUsersList = [
    ...Object.entries(globalState?.room_profiles || {}).map(([id, u]) => ({
      id,
      name: u.name || 'Anonymous',
      emoji: u.emoji || '👤',
      pfp: u.pfp || null,
      username: id.split('-')[0] || 'user'
    })),
    { id: 'yardbot', name: 'yardbot', emoji: '🤖', pfp: null, username: 'yardbot' },
    { id: 'crayoncat', name: 'crayoncat', emoji: '🐱', pfp: null, username: 'crayoncat' },
    { id: 'retrogamer', name: 'retrogamer', emoji: '🎮', pfp: null, username: 'retrogamer' }
  ];

  const matchingUsers = searchQuery.trim() === '' ? [] : allUsersList.filter(u => {
    return u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
           u.id.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Insert Markdown helper at cursor selection range
  const insertMarkdown = (syntax) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    let replacement = '';
    let cursorOffset = 0;

    switch (syntax) {
      case 'bold':
        replacement = `**${selected || 'bold text'}**`;
        cursorOffset = selected ? 0 : 2;
        break;
      case 'italic':
        replacement = `*${selected || 'italic text'}*`;
        cursorOffset = selected ? 0 : 1;
        break;
      case 'code':
        replacement = `\`${selected || 'code'}\``;
        cursorOffset = selected ? 0 : 1;
        break;
      case 'link':
        replacement = `[${selected || 'link text'}](https://)`;
        cursorOffset = selected ? 0 : 10;
        break;
      case 'latex':
        replacement = `$$${selected || 'equation'}$$`;
        cursorOffset = selected ? 0 : 2;
        break;
      case 'list':
        replacement = `\n- ${selected || 'list item'}`;
        break;
      default:
        break;
    }

    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setPostContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const newSelStart = start + replacement.length - (selected ? 0 : cursorOffset);
      textarea.setSelectionRange(newSelStart, newSelStart);
    }, 50);
  };

  // Compress and set photo base64
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        setIsUploadingPhoto(true);
        const compressed = await compressImage(reader.result);
        setSelectedPhoto(compressed);
      } catch (err) {
        console.error("Image compression error:", err);
        toast("Failed to process image.", "error");
      } finally {
        setIsUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Publish Post Action
  const handlePublishPost = async (e) => {
    if (e) e.preventDefault();
    if (!postContent.trim() && !selectedPhoto) return;

    let finalPhotoUrl = null;
    if (selectedPhoto) {
      try {
        // Convert compressed base64 back to a blob for storage upload
        const blob = await fetch(selectedPhoto).then(r => r.blob());
        const asset = await uploadAsset(blob, 'scrapbook', userId);
        if (asset && asset.url) {
          finalPhotoUrl = asset.url;
        } else {
          finalPhotoUrl = selectedPhoto;
        }
      } catch (err) {
        console.warn("Storage upload failed, falling back to base64 inline image:", err);
        finalPhotoUrl = selectedPhoto;
      }
    }

    const postObj = {
      id: `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      username: profile.name || user?.email?.split('@')[0] || 'You',
      avatar: profile.pfp || null,
      emoji: profile.emoji || '👤',
      content: postContent,
      background: selectedBg,
      image_url: finalPhotoUrl,
      likes: [],
      created_at: new Date().toISOString()
    };

    try {
      // 1. Try to insert to database table
      const { error } = await supabase
        .from('yard_posts')
        .insert([{
          user_id: userId,
          content: postContent,
          background: selectedBg,
          image_url: finalPhotoUrl,
          likes: []
        }]);

      if (error) throw error;
      toast('Post published to board!', 'success');
    } catch (err) {
      // 2. Fallback to state syncing
      updateSyncState('posts', (prev = []) => [postObj, ...prev]);
      toast('Post synced to room feed!', 'success');
    }

    setPostContent('');
    setSelectedPhoto(null);
    setSelectedBg('none');
    setComposePreviewMode(false);
    setShowComposeModal(false);
    fetchPosts();
  };

  // Delete Post Action
  const handleDeletePost = async (postId) => {
    const isDbPost = dbPosts.some(p => p.id === postId);
    try {
      if (isDbPost) {
        const { error } = await supabase
          .from('yard_posts')
          .delete()
          .eq('id', postId);
        if (error) throw error;
        toast('Post deleted from board!', 'success');
      } else {
        updateSyncState('posts', (prev = []) => prev.filter(p => p.id !== postId));
        toast('Post deleted!', 'success');
      }
    } catch (e) {
      updateSyncState('posts', (prev = []) => prev.filter(p => p.id !== postId));
      toast('Post deleted!', 'success');
    }
    fetchPosts();
  };

  // Toggle Like on Post
  const handleToggleLike = async (postId, postUserId) => {
    const post = postsToRender.find(p => p.id === postId);
    if (!post) return;

    const isBotPost = postId.startsWith('botpost-');
    const likes = post.likes || [];
    const index = likes.indexOf(userId);
    const newLikes = index === -1 ? [...likes, userId] : likes.filter(id => id !== userId);

    if (isBotPost) {
      updateSyncState('bot_likes', (prev = {}) => {
        return { ...prev, [postId]: newLikes };
      });
      toast('Reaction updated!', 'success');
      return;
    }

    try {
      const { error } = await supabase
        .from('yard_posts')
        .update({ likes: newLikes })
        .eq('id', postId);

      if (error) throw error;
      fetchPosts();
    } catch (e) {
      // Fallback
      updateSyncState('posts', (prev = []) => {
        return prev.map(p => {
          if (p.id === postId) {
            return { ...p, likes: newLikes };
          }
          return p;
        });
      });
    }
  };

  // Save Bio Inline
  const handleSaveBio = () => {
    setIsEditingBio(false);
    updateSyncStateAtomic('room_profiles', userId, { bio: bioInput });
    toast('Bio updated successfully!', 'success');
  };

  // Format Relative Date
  const formatRelativeDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Middle scroll handler for infinite scroll
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 60) {
      if (visibleCount < filteredPosts.length && !isLoadingMore) {
        setIsLoadingMore(true);
        setTimeout(() => {
          setVisibleCount(prev => prev + 5);
          setIsLoadingMore(false);
        }, 800);
      }
    }
  };

  // Sharing links helpers
  const getPostUrl = (post) => {
    const userShortId = post.user_id.split('-')[0];
    const postShortId = post.id.split('-').pop();
    return `${window.location.origin}/post/${userShortId}-${postShortId}`;
  };

  const handleCopyLink = (post) => {
    navigator.clipboard.writeText(getPostUrl(post));
    toast('Link copied to clipboard!', 'success');
    setSharingPost(null);
  };

  const handleShareToDM = (post) => {
    const url = getPostUrl(post);
    const authorName = globalState?.room_profiles?.[post.user_id]?.name || post.username || 'User';
    const text = `📢 *Shared Board Post* by ${authorName}:\n"${post.content}"\nLink: ${url}`;
    
    syncSendMessage(text, 'text');
    toast('Shared to room chat!', 'success');
    setSharingPost(null);
  };

  const handleShareToChannel = async (post) => {
    const url = getPostUrl(post);
    const authorName = globalState?.room_profiles?.[post.user_id]?.name || post.username || 'User';
    const text = `📢 [Shared Post] @${authorName}: "${post.content}" - ${url}`;

    try {
      const { data: channels } = await supabase.from('yard_channels').select('id').limit(1);
      if (channels && channels.length > 0) {
        await supabase.from('yard_messages').insert([{
          channel_id: channels[0].id,
          user_id: userId,
          content: text
        }]);
        toast('Shared to server channel!', 'success');
      } else {
        toast('No server channels found to share.', 'warn');
      }
    } catch (e) {
      toast('Failed to share to channel.', 'error');
    }
    setSharingPost(null);
  };

  const getUserStatusInfo = (userObj) => {
    if (userObj.id === 'yardbot') return { label: 'Online', colorClass: 'bg-success' };
    if (userObj.id === 'crayoncat') return { label: 'Idle', colorClass: 'bg-warning' };
    if (userObj.id === 'retrogamer') return { label: 'Active', colorClass: 'bg-success' };
    
    const targetProfile = globalState?.room_profiles?.[userObj.id] || {};
    const presence = sync.onlineUsers?.[userObj.id];
    const status = targetProfile.userStatus || (presence?.status || 'offline');
    
    let colorClass = 'bg-success';
    let label = 'Online';
    
    if (status === 'idle') {
      colorClass = 'bg-warning';
      label = 'Idle';
    } else if (status === 'dnd') {
      colorClass = 'bg-[var(--color-destructive)]';
      label = 'DND';
    } else if (status === 'offline') {
      colorClass = 'bg-disabled';
      label = 'Offline';
    }
    
    return { label, colorClass };
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

  const renderUserRow = (u) => {
    const statusInfo = getUserStatusInfo(u);
    const targetProfile = globalState?.room_profiles?.[u.id] || {};
    const isMe = u.id === userId;
    
    return (
      <div 
        key={u.id}
        className="flex items-center justify-between gap-3 p-2 retro-border bg-[var(--bg-main)]/5 hover:bg-accent/10 transition-colors"
      >
        <div 
          className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-85"
          onClick={() => window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId: u.id } }))}
        >
          <div className="relative shrink-0">
            {u.pfp ? (
              <img src={u.pfp} alt="" className="w-8 h-8 border object-cover bg-white" />
            ) : (
              <div className="w-8 h-8 border bg-accent text-accent-text flex items-center justify-center text-xs font-bold font-mono">
                {u.emoji || '👤'}
              </div>
            )}
            <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 border border-window rounded-full ${statusInfo.colorClass}`} />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black leading-none lowercase hover:underline">
                {u.name}
              </span>
              <span className="text-[8px] font-mono tracking-tighter opacity-50">
                @{u.username}
              </span>
            </div>
            <span className="text-[9px] font-bold opacity-60 truncate mt-1 lowercase italic">
              {u.id === 'yardbot' ? 'indexing feed posts... 🤖' : 
               u.id === 'crayoncat' ? 'napping near fireplace 💤' :
               u.id === 'retrogamer' ? 'playing wordle race 🏆' :
               targetProfile.activity || (statusInfo.label === 'Offline' ? 'offline' : 'active')}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 shrink-0">
          {!isMe && (
            <RetroButton 
              size="sm" 
              variant="white"
              className="h-6 text-[10px] font-black uppercase px-2"
              onClick={() => {
                const targetDmId = mapUserIdToDmId(u.id, partnerId);
                navigate('/chat', { state: { selectDmId: targetDmId } });
              }}
            >
              DM
            </RetroButton>
          )}
          {!isMe && u.id !== 'yardbot' && u.id !== 'crayoncat' && u.id !== 'retrogamer' && (
            <RetroButton 
              size="sm" 
              variant="primary"
              className="h-6 text-[10px] font-black uppercase px-2"
              onClick={() => {
                toast(`Friend request sent to @${u.username}`, 'success');
              }}
            >
              Add Friend
            </RetroButton>
          )}
        </div>
      </div>
    );
  };

  const renderPostRow = (post) => {
    const author = globalState?.room_profiles?.[post.user_id] || {
      name: post.username || 'Anonymous',
      emoji: post.emoji || '👤',
      pfp: post.avatar || null
    };
    
    const snippet = post.content ? (post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content) : '';
    
    return (
      <div 
        key={post.id}
        className="flex items-center justify-between gap-3 p-2 retro-border bg-[var(--bg-main)]/5 hover:bg-accent/10 transition-colors"
      >
        <div 
          className="flex items-start gap-2.5 min-w-0 cursor-pointer hover:opacity-85"
          onClick={() => setSelectedPostForComments(post.id)}
        >
          <div className="shrink-0 mt-0.5">
            {author.pfp ? (
              <img src={author.pfp} alt="" className="w-6 h-6 border object-cover bg-white" />
            ) : (
              <div className="w-6 h-6 border bg-accent text-accent-text flex items-center justify-center text-[10px] font-bold font-mono">
                {author.emoji || '👤'}
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black truncate lowercase leading-none">{author.name}</span>
              <span className="text-[8px] opacity-40 font-mono">{formatRelativeDate(post.created_at)}</span>
            </div>
            <span className="text-[10px] font-bold opacity-75 mt-1 truncate max-w-md">{snippet}</span>
          </div>
        </div>
        
        <RetroButton
          size="sm"
          variant="white"
          className="h-6 text-[10px] font-black uppercase px-2 shrink-0"
          onClick={() => setSelectedPostForComments(post.id)}
        >
          View Post
        </RetroButton>
      </div>
    );
  };

  const renderMessageRow = (msg) => {
    const senderProfile = globalState?.room_profiles?.[msg.sender_id] || {
      name: msg.username || 'Anonymous',
      emoji: msg.emoji || '👤',
      pfp: msg.avatar || null
    };
    
    const snippet = msg.text ? (msg.text.length > 100 ? msg.text.substring(0, 100) + '...' : msg.text) : '';
    const formattedTime = new Date(msg.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + msg.time;
    
    return (
      <div 
        key={msg.id}
        className="flex items-center justify-between gap-3 p-2 retro-border bg-[var(--bg-main)]/5 hover:bg-accent/10 transition-colors"
      >
        <div 
          className="flex items-start gap-2.5 min-w-0 cursor-pointer hover:opacity-85"
          onClick={() => navigate('/chat', { state: { jumpToMessageId: msg.id, jumpToMessageTime: msg.created_at } })}
        >
          <div className="shrink-0 mt-0.5">
            {senderProfile.pfp ? (
              <img src={senderProfile.pfp} alt="" className="w-6 h-6 border object-cover bg-white" />
            ) : (
              <div className="w-6 h-6 border bg-accent text-accent-text flex items-center justify-center text-[10px] font-bold font-mono">
                {senderProfile.emoji || '👤'}
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black truncate lowercase leading-none">{senderProfile.name}</span>
              <span className="text-[8px] opacity-40 font-mono">{formattedTime}</span>
            </div>
            <span className="text-[10px] font-bold opacity-75 mt-1 truncate max-w-md italic">"{snippet}"</span>
          </div>
        </div>
        
        <RetroButton
          size="sm"
          variant="white"
          className="h-6 text-[10px] font-black uppercase px-2 shrink-0"
          onClick={() => navigate('/chat', { state: { jumpToMessageId: msg.id, jumpToMessageTime: msg.created_at } })}
        >
          Open Conversation
        </RetroButton>
      </div>
    );
  };

  return (
    <div className="w-full h-screen grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-2 p-2 overflow-hidden box-border">
      {/* ── LEFT COLUMN: PROFILE & SHORTCUTS ── */}
      <div className="hidden lg:flex flex-col gap-2 shrink-0 h-full min-h-0 overflow-hidden">
        {/* Shortcuts Window */}
        {showShortcuts && (
          <RetroWindow title="shortcuts.sys" noPadding>
            <div className="flex flex-col gap-1.5 p-2">
              <RetroButton 
                size="sm"
                variant="white" 
                className="w-full justify-start text-xs font-black uppercase"
                onClick={() => navigate('/chat')}
                data-testid="app-icon-chat"
              >
                <MessageSquare size={14} className="text-blue-500" />
                <span>Messenger</span>
              </RetroButton>

              <RetroButton 
                size="sm"
                variant="white" 
                className="w-full justify-start text-xs font-black uppercase"
                onClick={onOpenLeaderboard}
              >
                <Trophy size={14} className="text-yellow-500" />
                <span>Leaderboards</span>
              </RetroButton>

              <RetroButton 
                size="sm"
                variant="white" 
                className="w-full justify-start text-xs font-black uppercase"
                onClick={() => navigate('/arcade')}
                data-testid="app-icon-arcade"
              >
                <Gamepad2 size={14} className="text-purple-500" />
                <span>Arcade Games</span>
              </RetroButton>

              <RetroButton 
                size="sm"
                variant="white" 
                className="w-full justify-start text-xs font-black uppercase"
                onClick={() => navigate('/settings')}
              >
                <SettingsIcon size={14} className="text-slate-500" />
                <span>Control Panel</span>
              </RetroButton>

              <RetroButton 
                size="sm"
                variant="custom" 
                className="w-full justify-start text-xs font-black uppercase bg-red-500 text-white border-red-700 mt-1"
                onClick={() => setShowLogoutConfirm(true)}
              >
                <LogOut size={14} />
                <span>Log out</span>
              </RetroButton>
            </div>
          </RetroWindow>
        )}

        {/* Friend Requests Panel */}
        {showFriendRequests && (
          <RetroWindow 
            title="friend_requests.exe" 
            noPadding
            headerActions={
              friendRequests.length > 0 && (
                <span className="px-1.5 py-0.5 bg-[var(--color-destructive)] text-white text-[8px] font-black leading-none retro-border">
                  {friendRequests.length}
                </span>
              )
            }
          >
            <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto pr-1 p-2">
              {friendRequests.length === 0 ? (
                <div className="text-center py-3 text-xs font-bold opacity-50">
                  No pending requests
                </div>
              ) : (
                friendRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between gap-2 p-1 hover:bg-black/5 rounded-sm transition-all border border-dashed border-border/10">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5.5 h-5.5 retro-border retro-bg-accent flex items-center justify-center text-xs shrink-0">
                        {req.emoji}
                      </div>
                      <span className="text-[11px] font-black truncate lowercase">@{req.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => {
                          setFriendRequests(prev => prev.filter(r => r.id !== req.id));
                          toast(`Accepted friend request from @${req.name}`, 'success');
                        }}
                        className="p-1 bg-success text-success-text hover:brightness-110 active:translate-y-px retro-border leading-none"
                        title="Accept Request"
                      >
                        <Check size={10} className="text-white" />
                      </button>
                      <button 
                        onClick={() => {
                          setFriendRequests(prev => prev.filter(r => r.id !== req.id));
                          toast(`Declined request from @${req.name}`, 'info');
                        }}
                        className="p-1 bg-[var(--color-destructive)] text-white hover:brightness-110 active:translate-y-px retro-border leading-none"
                        title="Decline Request"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </RetroWindow>
        )}

        {/* Notifications Panel */}
        {showNotificationsWindow && (
          <RetroWindow 
            title="notifications.sys" 
            noPadding
            headerActions={
              unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-yellow-500 text-black text-[8px] font-black leading-none retro-border">
                  {unreadCount}
                </span>
              )
            }
          >
            <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto pr-1 p-2">
              <div className="flex justify-between items-center border-b border-dashed border-border/10 pb-1 mb-0.5 shrink-0">
                <span className="text-[9px] font-black uppercase opacity-65">History</span>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllRead} 
                    className="text-[9px] font-black uppercase text-primary hover:underline hover:-translate-y-px active:translate-y-0"
                  >
                    Mark read
                  </button>
                )}
              </div>
              
              {history.length === 0 ? (
                <div className="text-center py-3 text-xs font-bold opacity-50">
                  No notifications
                </div>
              ) : (
                history.slice(0, 10).map((notif) => {
                  const isUnread = notif.timestamp > lastReadAt;
                  return (
                    <div 
                      key={notif.id} 
                      className={`flex items-start gap-1.5 p-1 rounded-sm hover:bg-black/5 transition-colors border border-border/10 relative ${isUnread ? 'bg-accent/5' : ''}`}
                    >
                      {/* Unread dot */}
                      {isUnread && (
                        <div className="w-1.5 h-1.5 bg-primary rounded-full absolute right-1.5 top-1.5 animate-pulse" />
                      )}
                      
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-[11px] font-bold leading-normal text-main-text break-words lowercase">
                          {notif.message}
                        </p>
                        <span className="text-[8px] opacity-40 font-mono block mt-0.5">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </RetroWindow>
        )}
      </div>

      {/* ── HORIZONTAL MIDDLE COLUMN: FEED & SEARCH ── */}
      <div className="flex flex-col gap-2 h-full min-h-0 overflow-hidden relative">
        {/* Top search box with Popover */}
        <div className="relative flex flex-col z-50">
          <div className="relative z-50">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-main-text" />
            <input
              type="text"
              placeholder="Search feed posts or users..."
              value={searchQuery}
              onFocus={handleOpenSearch}
              onChange={(e) => {
                handleOpenSearch();
                setSearchQuery(e.target.value);
              }}
              className="w-full pl-12 pr-4 h-[44px] retro-border bg-window focus:bg-accent/5 outline-none font-bold transition-all placeholder:opacity-30 text-xs"
            />
          </div>

          {/* Search Dropdown Panel */}
          {isSearchActive && (
            <>
              {/* Invisible Click-Outside Backdrop */}
              <div 
                className="fixed inset-0 z-40 bg-transparent"
                onClick={handleCloseSearch}
              />
              
              {/* Dropdown Container */}
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-window retro-border-thick retro-shadow-dark flex flex-col max-h-[450px] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                
                {/* Compact Tab Header */}
                <div className="flex items-center justify-between border-b-[2px] border-border bg-[var(--bg-header)] text-[var(--text-on-header)] p-1.5 flex-shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-wider pl-1 font-mono">search_lookup.exe</span>
                  
                  {/* Tabs */}
                  <div className="flex gap-1">
                    {['all', 'users', 'posts', 'messages'].map(t => (
                      <button
                        key={t}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchTab(t);
                        }}
                        className={`px-2 py-0.5 text-[9px] font-black uppercase transition-all retro-border ${
                          searchTab === t
                            ? 'bg-[var(--primary)] text-[var(--text-on-primary)] shadow-none translate-y-px font-mono'
                            : 'bg-window text-main-text hover:bg-black/5 active:translate-y-px shadow-sm font-mono'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dropdown Body */}
                <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3 custom-scrollbar bg-window text-main-text text-xs">
                  {searchQuery.trim() === '' ? (
                    <div className="text-center py-6 text-xs font-bold opacity-50 italic flex flex-col items-center justify-center gap-1 font-mono">
                      <Search size={16} />
                      <span>type to search...</span>
                    </div>
                  ) : (
                    <>
                      {/* TAB: ALL */}
                      {searchTab === 'all' && (
                        <div className="flex flex-col gap-4">
                          {/* Section: Users */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center border-b border-dashed border-border/20 pb-0.5">
                              <span className="text-[9px] font-black uppercase opacity-65 tracking-widest font-mono">Users ({matchingUsers.length})</span>
                              {matchingUsers.length > 3 && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchTab('users');
                                  }} 
                                  className="text-[9px] font-black uppercase text-primary hover:underline font-mono"
                                >
                                  [ See All ]
                                </button>
                              )}
                            </div>
                            {matchingUsers.length === 0 ? (
                              <span className="text-[10px] font-bold opacity-50 italic py-1 font-mono">No matching users</span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {matchingUsers.slice(0, 3).map(u => renderUserRow(u))}
                              </div>
                            )}
                          </div>

                          {/* Section: Posts */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center border-b border-dashed border-border/20 pb-0.5">
                              <span className="text-[9px] font-black uppercase opacity-65 tracking-widest font-mono">Feed Posts ({filteredPosts.length})</span>
                              {filteredPosts.length > 3 && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchTab('posts');
                                  }} 
                                  className="text-[9px] font-black uppercase text-primary hover:underline font-mono"
                                >
                                  [ See All ]
                                </button>
                              )}
                            </div>
                            {filteredPosts.length === 0 ? (
                              <span className="text-[10px] font-bold opacity-50 italic py-1 font-mono">No matching posts</span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {filteredPosts.slice(0, 3).map(post => renderPostRow(post))}
                              </div>
                            )}
                          </div>

                          {/* Section: Messages */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center border-b border-dashed border-border/20 pb-0.5">
                              <span className="text-[9px] font-black uppercase opacity-65 tracking-widest font-mono">Messages ({matchingMessages.length})</span>
                              {matchingMessages.length > 3 && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchTab('messages');
                                  }} 
                                  className="text-[9px] font-black uppercase text-primary hover:underline font-mono"
                                >
                                  [ See All ]
                                </button>
                              )}
                            </div>
                            {messagesSearchLoading ? (
                              <span className="text-[10px] font-bold opacity-50 italic py-1 font-mono">Searching...</span>
                            ) : matchingMessages.length === 0 ? (
                              <span className="text-[10px] font-bold opacity-50 italic py-1 font-mono">No matching messages</span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {matchingMessages.slice(0, 3).map(msg => renderMessageRow(msg))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* TAB: USERS */}
                      {searchTab === 'users' && (
                        <div className="flex flex-col gap-1.5">
                          <div className="border-b border-dashed border-border/20 pb-0.5 mb-1">
                            <span className="text-[9px] font-black uppercase opacity-65 tracking-widest font-mono">All Matching Users ({matchingUsers.length})</span>
                          </div>
                          {matchingUsers.length === 0 ? (
                            <span className="text-[10px] font-bold opacity-50 italic py-1 font-mono">No matching users</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {matchingUsers.map(u => renderUserRow(u))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB: POSTS */}
                      {searchTab === 'posts' && (
                        <div className="flex flex-col gap-1.5">
                          <div className="border-b border-dashed border-border/20 pb-0.5 mb-1">
                            <span className="text-[9px] font-black uppercase opacity-65 tracking-widest font-mono">All Matching Posts ({filteredPosts.length})</span>
                          </div>
                          {filteredPosts.length === 0 ? (
                            <span className="text-[10px] font-bold opacity-50 italic py-1 font-mono">No matching posts</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {filteredPosts.map(post => renderPostRow(post))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB: MESSAGES */}
                      {searchTab === 'messages' && (
                        <div className="flex flex-col gap-1.5">
                          <div className="border-b border-dashed border-border/20 pb-0.5 mb-1 flex justify-between items-center">
                            <span className="text-[9px] font-black uppercase opacity-65 tracking-widest font-mono">All Matching Messages ({matchingMessages.length})</span>
                            {messagesSearchLoading && (
                              <span className="text-[9px] font-bold text-primary animate-pulse font-mono">loading...</span>
                            )}
                          </div>
                          {matchingMessages.length === 0 ? (
                            <span className="text-[10px] font-bold opacity-50 italic py-1 font-mono">No matching messages</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {matchingMessages.map(msg => renderMessageRow(msg))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rest of the Middle Column (Dimmed when search is active) */}
        <div className={`flex flex-col gap-2 flex-1 min-h-0 transition-opacity duration-150 ${isSearchActive ? 'opacity-40 pointer-events-none' : ''}`}>
          {/* Window Restore Bar */}
          {(!showProfile || !showShortcuts || !showActiveFriends || !showFriendRequests || !showNotificationsWindow || !showStats) && (
            <div className="flex gap-2 items-center bg-window retro-border p-2 text-xs flex-wrap">
              <span className="font-black uppercase text-[10px] opacity-60 font-mono">Restore Windows:</span>
              {!showProfile && (
                <RetroButton size="sm" variant="white" onClick={() => handleSetShowProfile(true)}>
                  + profile
                </RetroButton>
              )}
              {!showShortcuts && (
                <RetroButton size="sm" variant="white" onClick={() => handleSetShowShortcuts(true)}>
                  + shortcuts.sys
                </RetroButton>
              )}
              {!showFriendRequests && (
                <RetroButton size="sm" variant="white" onClick={() => handleSetShowFriendRequests(true)}>
                  + friend_requests.exe
                </RetroButton>
              )}
              {!showNotificationsWindow && (
                <RetroButton size="sm" variant="white" onClick={() => handleSetShowNotificationsWindow(true)}>
                  + notifications.sys
                </RetroButton>
              )}
              {!showActiveFriends && (
                <RetroButton size="sm" variant="white" onClick={() => handleSetShowActiveFriends(true)}>
                  + active_friends.sys
                </RetroButton>
              )}
              {!showStats && (
                <RetroButton size="sm" variant="white" onClick={() => handleSetShowStats(true)}>
                  + stats.sys
                </RetroButton>
              )}
            </div>
          )}

          {/* Facebook-style Compose Bar (Retro styled) */}
          <div className="glass-window bg-window retro-border-thick p-3.5 flex items-center gap-3">
            {/* User Avatar */}
            <div className="relative shrink-0">
              {profile.pfp ? (
                <img 
                  src={profile.pfp} 
                  alt="" 
                  className="w-9 h-9 border border-border object-cover bg-white cursor-pointer hover:opacity-85 transition-opacity" 
                  onClick={() => window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId } }))}
                  onContextMenu={(e) => handleContextMenu(e, userId)}
                />
              ) : (
                <div 
                  className="w-9 h-9 border border-border bg-accent text-accent-text flex items-center justify-center text-sm cursor-pointer hover:opacity-85 transition-opacity font-bold font-mono"
                  onClick={() => window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId } }))}
                  onContextMenu={(e) => handleContextMenu(e, userId)}
                >
                  {profile.emoji || '👤'}
                </div>
              )}
            </div>

            {/* Rounded Input Field with Retro Border */}
            <div 
              onClick={() => setShowComposeModal(true)} 
              className="flex-1 bg-[var(--bg-main)]/10 hover:bg-[var(--bg-main)]/15 transition-all retro-border rounded-none px-4 h-9 text-xs text-main-text/60 font-semibold cursor-pointer select-none flex items-center lowercase"
            >
              what's on your mind, {profile.name || 'friend'}?
            </div>

            {/* Quick Action Icons with Retro Styling */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                type="button" 
                onClick={() => setShowComposeModal(true)} 
                className="p-1.5 text-rose-500 hover:bg-[var(--bg-main)]/10 retro-border bg-window active:translate-y-px transition-all" 
                title="Live video"
              >
                <Video size={16} />
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setShowComposeModal(true);
                  setTimeout(() => {
                    const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
                    if (fileInput) fileInput.click();
                  }, 200);
                }} 
                className="p-1.5 text-emerald-500 hover:bg-[var(--bg-main)]/10 retro-border bg-window active:translate-y-px transition-all" 
                title="Photo/video"
              >
                <ImageIcon size={16} />
              </button>
              <button 
                type="button" 
                onClick={() => setShowComposeModal(true)} 
                className="p-1.5 text-pink-500 hover:bg-[var(--bg-main)]/10 retro-border bg-window active:translate-y-px transition-all" 
                title="Reels"
              >
                <Film size={16} />
              </button>
            </div>
          </div>

          {/* Infinite Scroll container */}
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-scroll custom-scrollbar flex flex-col gap-4 pr-1 pb-20 lg:pb-4"
          >
            {filteredPosts.length === 0 ? (
              <div className="retro-border p-8 text-center bg-window border-dashed opacity-50 flex flex-col items-center justify-center gap-2">
                <Smile size={28} />
                <p className="text-xs font-bold font-mono">No board posts match your query.</p>
              </div>
            ) : (
              filteredPosts.slice(0, visibleCount).map((post) => {
                const author = globalState?.room_profiles?.[post.user_id] || {
                  name: post.username || 'Anonymous',
                  emoji: post.emoji || '👤',
                  pfp: post.avatar || null
                };

                const hasLiked = (post.likes || []).includes(userId);
                const numComments = (post.comments?.length || 0) + (globalState.comments?.[post.id]?.length || 0);
                const bgClass = post.background && post.background !== 'none' ? `post-bg-${post.background}` : '';

                return (
                  <div 
                    key={post.id} 
                    className="glass-window bg-window retro-border-thick retro-shadow-dark flex flex-col transform-gpu animate-in fade-in duration-300"
                  >
                    {/* Post Card Header */}
                    <div className="window-header retro-border border-t-0 border-l-0 border-r-0 border-b-[2px] flex justify-between items-center p-2 bg-[var(--bg-header)] text-[var(--text-on-header)]">
                      <div className="flex items-center gap-2 min-w-0">
                        {author.pfp ? (
                          <img 
                            src={author.pfp} 
                            alt="" 
                            className="w-6 h-6 border border-border object-cover bg-white cursor-pointer hover:opacity-85 transition-opacity" 
                            onClick={() => window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId: post.user_id } }))}
                            onContextMenu={(e) => handleContextMenu(e, post.user_id)}
                          />
                        ) : (
                          <div 
                            className="w-6 h-6 border border-border bg-accent text-accent-text flex items-center justify-center text-xs cursor-pointer hover:opacity-85 transition-opacity font-mono"
                            onClick={() => window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId: post.user_id } }))}
                            onContextMenu={(e) => handleContextMenu(e, post.user_id)}
                          >
                            {author.emoji || '👤'}
                          </div>
                        )}
                        <span 
                          className="font-black text-xs truncate lowercase cursor-pointer hover:underline"
                          onClick={() => window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId: post.user_id } }))}
                          onContextMenu={(e) => handleContextMenu(e, post.user_id)}
                        >
                          {author.name || 'user'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] font-bold opacity-60 font-mono">
                          {formatRelativeDate(post.created_at)}
                        </span>
                        {post.user_id === userId && (
                          <button 
                            onClick={() => handleDeletePost(post.id)}
                            className="p-1 text-red-500 hover:text-red-700 bg-black/5 hover:bg-black/10 retro-border leading-none"
                            title="Delete Post"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                        <button 
                          onClick={() => setSelectedPostForIgnore(post)}
                          className="p-1 text-muted-text hover:text-[var(--color-destructive)] bg-black/5 hover:bg-black/10 retro-border leading-none"
                          title="Ignore Post"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </div>

                    {/* Post Content */}
                    <div className="p-3 bg-window text-xs font-mono font-bold leading-relaxed text-main-text break-words markdown-body">
                      {post.content ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            p: ({node, ...props}) => <span className="block mb-1.5" {...props} />,
                            a: ({node, href, ...props}) => {
                              if (href?.startsWith('mention://')) {
                                const targetUserId = href.replace('mention://', '');
                                return (
                                  <span 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId: targetUserId } }));
                                    }}
                                    className="text-primary hover:underline cursor-pointer font-black px-1 bg-primary/10 retro-border border-primary/20 inline-block align-baseline"
                                  >
                                    {props.children}
                                  </span>
                                );
                              }
                              return <a {...props} href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" />;
                            }
                          }}
                        >
                          {processMentionsInMarkdown(post.content)}
                        </ReactMarkdown>
                      ) : null}

                      {post.image_url && (
                        <div 
                          className="mt-3 retro-border overflow-hidden bg-black/5 flex items-center justify-center max-h-72 cursor-pointer" 
                          onClick={() => setSelectedPostForComments(post.id)}
                        >
                          <img 
                            src={post.image_url} 
                            alt="Post Attachment" 
                            className="max-w-full max-h-72 object-contain hover:scale-[1.01] transition-transform duration-300"
                          />
                        </div>
                      )}
                    </div>

                    {/* Post Actions Footer */}
                    <div className="p-2 border-t border-dashed border-border/30 bg-[var(--bg-main)]/20 flex gap-2 justify-end">
                      <RetroButton
                        size="sm"
                        variant={hasLiked ? "primary" : "white"}
                        className="h-7 px-2.5 text-[9px] font-black gap-1.5"
                        onClick={() => handleToggleLike(post.id, post.user_id)}
                      >
                        <Heart 
                          size={10} 
                          fill={hasLiked ? "currentColor" : "none"} 
                          className={hasLiked ? "scale-110" : ""}
                        />
                        <span>{post.likes?.length || 0}</span>
                      </RetroButton>

                      <RetroButton
                        size="sm"
                        variant="white"
                        className="h-7 px-2.5 text-[9px] font-black gap-1.5"
                        onClick={() => setSelectedPostForComments(post.id)}
                      >
                        <MessageCircle size={10} />
                        <span>{numComments}</span>
                      </RetroButton>

                      <RetroButton
                        size="sm"
                        variant="white"
                        className="h-7 px-2.5 text-[9px] font-black gap-1.5"
                        onClick={() => setSharingPost(post)}
                      >
                        <Share2 size={10} />
                        <span>Share</span>
                      </RetroButton>
                    </div>
                  </div>
                );
              })
            )}

            {/* Loading spinner */}
            {isLoadingMore && (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN: ACTIVE FRIEND ACTIVITIES ── */}
      <div className="hidden lg:flex flex-col gap-2 shrink-0 h-full min-h-0 overflow-hidden">
        {showActiveFriends && (
          <RetroWindow title="active_friends.sys" noPadding>
            <div className="flex flex-col gap-2 p-2">
              <div className="flex justify-between items-center border-b border-dashed border-border/20 pb-1.5 shrink-0">
                <span className="text-[10px] font-black uppercase opacity-65 tracking-widest">Activity Feed</span>
                <Activity size={12} className="text-success animate-pulse" />
              </div>

              {/* Partner activity */}
              {partnerId && (
                <div 
                  className="flex items-start gap-2 p-1 hover:bg-black/5 rounded-sm transition-all cursor-pointer hover:opacity-85"
                  onClick={() => window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId: partnerId } }))}
                  onContextMenu={(e) => handleContextMenu(e, partnerId)}
                >
                  <div className="relative shrink-0 mt-0.5">
                    {partnerProfile.pfp ? (
                      <img 
                        src={partnerProfile.pfp} 
                        alt="" 
                        className="w-8 h-8 retro-border object-cover bg-white" 
                      />
                    ) : (
                      <div className="w-8 h-8 retro-bg-secondary retro-border flex items-center justify-center text-sm">
                        {partnerProfile.emoji || '👤'}
                      </div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 border-2 border-window rounded-full ${isPartnerOnline ? 'bg-success' : isPartnerIdle ? 'bg-warning' : 'bg-disabled'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-black truncate leading-none lowercase hover:underline">
                        {partnerName}
                      </p>
                      <span className="text-[7px] font-black uppercase px-1 py-0.2 retro-border leading-none scale-90 shrink-0">
                        {isPartnerOnline ? 'Online' : isPartnerIdle ? 'Idle' : 'Offline'}
                      </span>
                    </div>
                    <p className="text-[9px] font-bold opacity-60 truncate mt-1 lowercase italic">
                      {partnerProfile.activity || partnerStatusLabel || 'resting...'}
                    </p>
                  </div>
                </div>
              )}

              {/* Simulated Active Friends (Seeding user feed when alone) */}
              <div 
                className="flex items-start gap-2 p-1 hover:bg-black/5 rounded-sm transition-all border-t border-dashed border-border/20 pt-2 cursor-pointer hover:opacity-85"
                onClick={() => window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId: 'yardbot' } }))}
                onContextMenu={(e) => handleContextMenu(e, 'yardbot')}
              >
                <div className="relative shrink-0 mt-0.5">
                  <div className="w-8 h-8 retro-bg-accent retro-border flex items-center justify-center text-sm">🤖</div>
                  <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-2 border-window rounded-full bg-success" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-black truncate leading-none lowercase hover:underline">yardbot</p>
                    <span className="text-[7px] font-black uppercase px-1 py-0.2 bg-success text-success-text retro-border leading-none scale-90 shrink-0">Bot</span>
                  </div>
                  <p className="text-[9px] font-bold opacity-60 truncate mt-1 lowercase italic">indexing feed posts... 🤖</p>
                </div>
              </div>

              <div 
                className="flex items-start gap-2 p-1 hover:bg-black/5 rounded-sm transition-all cursor-pointer hover:opacity-85"
                onClick={() => window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId: 'crayoncat' } }))}
                onContextMenu={(e) => handleContextMenu(e, 'crayoncat')}
              >
                <div className="relative shrink-0 mt-0.5">
                  <div className="w-8 h-8 retro-bg-primary retro-border flex items-center justify-center text-sm">🐱</div>
                  <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-2 border-window rounded-full bg-warning" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-black truncate leading-none lowercase hover:underline">crayoncat</p>
                    <span className="text-[7px] font-black uppercase px-1 py-0.2 bg-warning text-warning-text retro-border leading-none scale-90 shrink-0">Idle</span>
                  </div>
                  <p className="text-[9px] font-bold opacity-60 truncate mt-1 lowercase italic">napping near fireplace 💤</p>
                </div>
              </div>

              <div 
                className="flex items-start gap-2 p-1 hover:bg-black/5 rounded-sm transition-all cursor-pointer hover:opacity-85"
                onClick={() => window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId: 'retrogamer' } }))}
                onContextMenu={(e) => handleContextMenu(e, 'retrogamer')}
              >
                <div className="relative shrink-0 mt-0.5">
                  <div className="w-8 h-8 retro-bg-secondary retro-border flex items-center justify-center text-sm">🎮</div>
                  <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-2 border-window rounded-full bg-success" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-black truncate leading-none lowercase hover:underline">retrogamer</p>
                    <span className="text-[7px] font-black uppercase px-1 py-0.2 bg-success text-success-text retro-border leading-none scale-90 shrink-0">Active</span>
                  </div>
                  <p className="text-[9px] font-bold opacity-60 truncate mt-1 lowercase italic">playing wordle race 🏆</p>
                </div>
              </div>
            </div>
          </RetroWindow>
        )}

        {showStats && (
          <RetroWindow title="stats.sys" noPadding>
            <div className="flex flex-col gap-1.5 p-2">
              {Object.keys(dbStats).length === 0 ? (
                <div className="text-center py-3 text-xs font-bold opacity-50">
                  No stats recorded
                </div>
              ) : (
                Object.entries(dbStats).map(([gameName, stat]) => (
                  <div key={gameName} className="border-b border-dashed border-border/20 pb-1.5 last:border-0 last:pb-0">
                    <div className="flex justify-between items-center text-xs font-black uppercase text-primary">
                      <span>{gameName}</span>
                      <span className="text-secondary font-mono">{stat.score ?? stat.wins ?? 0} pts</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] opacity-75 font-bold mt-0.5 lowercase">
                      <span>Wins: {stat.wins ?? 0}</span>
                      <span>Losses: {stat.losses ?? 0}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </RetroWindow>
        )}
      </div>

      {/* ── MODAL: COMPOSE POST (RETRO STYLE) ── */}
      {showComposeModal && (
        <div className="modal-backdrop fixed inset-0 z-[var(--z-modal)] flex items-center justify-center">
          <RetroWindow 
            title="compose_post.exe" 
            onClose={() => setShowComposeModal(false)}
            className="universal-modal"
            noPadding
          >
            <form onSubmit={handlePublishPost} className="flex flex-col h-full bg-main/5">
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {/* User Row */}
                <div className="flex items-center gap-3">
                  {profile.pfp ? (
                    <img src={profile.pfp} alt="" className="w-10 h-10 border-2 border-border object-cover bg-white" />
                  ) : (
                    <div className="w-10 h-10 border-2 border-border bg-accent text-accent-text flex items-center justify-center text-base font-bold">
                      {profile.emoji || '👤'}
                    </div>
                  )}
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-sm font-black text-main-text lowercase">{profile.name || 'friend'}</span>
                    {/* Interactive Privacy Dropdown */}
                    <div className="relative group/privacy">
                      <button 
                        type="button"
                        className="flex items-center gap-1.5 px-2 py-1 bg-window hover:bg-[var(--bg-main)]/5 border-2 border-border text-[10px] font-bold text-main-text/70 transition-all select-none active:translate-y-px rounded-none"
                      >
                        <span>Don't show to...</span>
                        <span className="text-[8px]">▼</span>
                      </button>
                      <div className="absolute top-full left-0 mt-1 hidden group-hover/privacy:flex flex-col bg-window border-2 border-border p-1 w-40 z-50 text-left rounded-none shadow-none">
                        <button type="button" onClick={() => toast({ message: "Post set to Public", type: 'success' })} className="px-2 py-1.5 text-xs text-main-text hover:bg-[var(--bg-main)]/10 text-left rounded-none">Public</button>
                        <button type="button" onClick={() => toast({ message: "Post set to Friends only", type: 'success' })} className="px-2 py-1.5 text-xs text-main-text hover:bg-[var(--bg-main)]/10 text-left rounded-none">Friends Only</button>
                        <button type="button" onClick={() => toast({ message: "Post set to Private", type: 'success' })} className="px-2 py-1.5 text-xs text-main-text hover:bg-[var(--bg-main)]/10 text-left rounded-none">Only Me</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Text Area Content */}
                <div className="flex flex-col gap-2 p-3 bg-window retro-border border-dashed flex-1 min-h-[180px]">
                  <textarea
                    ref={textareaRef}
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder={`What's on your mind, ${profile.name || 'friend'}?`}
                    className="w-full text-sm bg-transparent text-main-text focus:outline-none resize-none font-bold flex-1 placeholder:opacity-40"
                    autoFocus
                  />
                  
                  {/* Aa and Emoji Controls */}
                  <div className="flex justify-between items-center shrink-0">
                    <div 
                      className="px-2 py-1 bg-accent text-accent-text border-2 border-border flex items-center justify-center text-[10px] font-black cursor-pointer select-none rounded-none" 
                      onClick={() => toast({ message: "Post background matches the theme selected in Settings", type: 'info' })} 
                      title="Theme background"
                    >
                      AA
                    </div>
                    
                    <button 
                      type="button" 
                      onClick={() => toast({ message: "Use system keyboard shortcut (Win + .) to pick emojis", type: 'info' })}
                      className="text-xs font-bold px-2 py-1 border-2 border-border bg-window hover:bg-[var(--bg-main)]/5 active:translate-y-px rounded-none"
                      title="Insert Emoji"
                    >
                      [ EMOJI ]
                    </button>
                  </div>
                </div>

                {/* Attachment Thumbnail */}
                {selectedPhoto && (
                  <div className="relative border-2 border-border p-1 bg-window max-w-max self-start rounded-none">
                    <img src={selectedPhoto} alt="Upload Thumbnail" className="w-16 h-16 object-cover" />
                    <button
                      type="button"
                      onClick={() => setSelectedPhoto(null)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white flex items-center justify-center hover:bg-red-700 text-[10px] font-black leading-none border-2 border-border rounded-none"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Add to Post bar */}
                <div className="flex justify-between items-center px-3 py-2 border-2 border-border bg-window rounded-none">
                  <span className="text-xs font-black text-main-text lowercase">Add to your post</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="file"
                      ref={photoInputRef}
                      onChange={handlePhotoChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <button 
                      type="button" 
                      onClick={() => photoInputRef.current?.click()}
                      className="p-1.5 text-emerald-500 hover:bg-[var(--bg-main)]/10 border-2 border-border bg-window active:translate-y-px rounded-none" 
                      title="Photo/video"
                      disabled={isUploadingPhoto}
                    >
                      <ImageIcon size={14} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toast({ message: "Tag friends feature coming soon!", type: 'info' })} 
                      className="p-1.5 text-blue-500 hover:bg-[var(--bg-main)]/10 border-2 border-border bg-window active:translate-y-px rounded-none" 
                      title="Tag Friends"
                    >
                      <Plus size={14} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toast({ message: "Feelings and activities coming soon!", type: 'info' })} 
                      className="p-1.5 text-amber-500 hover:bg-[var(--bg-main)]/10 border-2 border-border bg-window active:translate-y-px rounded-none" 
                      title="Feeling/activity"
                    >
                      <Smile size={14} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toast({ message: "Check-in at location coming soon!", type: 'info' })} 
                      className="p-1.5 text-rose-500 hover:bg-[var(--bg-main)]/10 border-2 border-border bg-window active:translate-y-px rounded-none" 
                      title="Location"
                    >
                      <MapPin size={14} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toast({ message: "Call dialer option coming soon!", type: 'info' })} 
                      className="p-1.5 text-sky-500 hover:bg-[var(--bg-main)]/10 border-2 border-border bg-window active:translate-y-px rounded-none" 
                      title="Call Dial"
                    >
                      <Phone size={14} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toast({ message: "More features coming soon!", type: 'info' })} 
                      className="p-1.5 text-gray-500 hover:bg-[var(--bg-main)]/10 border-2 border-border bg-window active:translate-y-px rounded-none" 
                      title="More"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="window-footer shrink-0">
                <RetroButton
                  type="button"
                  variant="secondary"
                  onClick={() => setShowComposeModal(false)}
                  className="px-4 py-1.5 text-xs uppercase"
                >
                  Cancel
                </RetroButton>
                <RetroButton
                  type="submit"
                  variant="primary"
                  disabled={!postContent.trim() && !selectedPhoto}
                  className="px-6 py-1.5 text-xs uppercase font-black"
                >
                  Post
                </RetroButton>
              </div>
            </form>
          </RetroWindow>
        </div>
      )}



      {/* ── MODAL: NOTIFICATION MODAL ── */}
      {showNotifModal && (
        <NotificationHistoryModal 
          userId={userId}
          onClose={() => setShowNotifModal(false)} 
          sfxEnabled={sfxEnabled}
        />
      )}

      {/* ── LOGOUT CONFIRMATION ── */}
      {showLogoutConfirm && (
        <ConfirmDialog
          title="logout_session.exe"
          message="Are you sure you want to log out of the Yard?"
          onConfirm={logout}
          onCancel={() => setShowLogoutConfirm(false)}
          sfx={sfxEnabled}
        />
      )}

      {/* ── MODAL: COMMENTS OVERLAY ── */}
      {selectedPostForComments && (
        <PostDetailView 
          isModal={true}
          modalPostId={selectedPostForComments}
          onCloseModal={() => setSelectedPostForComments(null)}
          onUsernameClick={(uid) => window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId: uid } }))}
        />
      )}

      {/* ── MODAL: SHARE OVERLAY ── */}
      <ShareModal 
        isOpen={!!sharingPost} 
        onClose={() => setSharingPost(null)} 
        post={sharingPost} 
      />

      {/* ── IMAGE VIEWER OVERLAY ── */}
      {viewImageSrc && (
        <ImageViewerOverlay 
          src={viewImageSrc} 
          onClose={() => setViewImageSrc(null)} 
        />
      )}

      {/* ── MODAL: IGNORE POST OPTIONS ── */}
      {selectedPostForIgnore && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <RetroWindow 
            title="ignore_post.exe" 
            onClose={() => setSelectedPostForIgnore(null)}
            className="w-full max-w-sm"
          >
            <div className="flex flex-col gap-4">
              <p className="font-bold text-sm leading-relaxed">
                Would you like to ignore this specific post, or mute all posts from <span className="text-primary">@{selectedPostForIgnore.username || 'user'}</span>?
              </p>
              <div className="flex flex-col gap-2">
                <RetroButton 
                  variant="primary" 
                  onClick={() => {
                    ignorePost(selectedPostForIgnore.id);
                    setSelectedPostForIgnore(null);
                  }}
                  className="py-2.5 text-xs font-black uppercase"
                >
                  Ignore This Post
                </RetroButton>
                <RetroButton 
                  variant="white" 
                  onClick={() => {
                    ignoreUser(selectedPostForIgnore.user_id, selectedPostForIgnore.username);
                    setSelectedPostForIgnore(null);
                  }}
                  className="py-2.5 text-xs font-black uppercase"
                >
                  Mute @{selectedPostForIgnore.username || 'user'}
                </RetroButton>
                <RetroButton 
                  variant="secondary" 
                  onClick={() => setSelectedPostForIgnore(null)}
                  className="py-2 text-xs font-black uppercase border-dashed"
                >
                  Cancel
                </RetroButton>
              </div>
            </div>
          </RetroWindow>
        </div>
      )}
    </div>
  );
}
