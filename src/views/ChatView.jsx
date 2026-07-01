import {
  X, Send, Paperclip, Smile, Mic, Trash2, Pin, Edit2, Reply, Image as ImageIcon,
  Gamepad2, Check, Clock, Ban, Phone, PhoneOff, Video, Download, Play, Monitor,
  Music, FileText, ChevronRight, MoreVertical, MicOff, Volume2, VolumeX, Bell, History, Palette, Pause, Pencil, Upload, Search, Film, Settings, Lock, AlertTriangle, Unlock, Key, Loader, Plus, Hash, Users, User, Home, Calendar, Headphones, Gift, Zap, Info, Crown
} from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback, lazy, Suspense, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
const EmojiPicker = lazy(() => import('emoji-picker-react'));
import { RetroWindow, RetroButton, ImageViewerOverlay, MediaEditorOverlay, RetroMediaPlayer, RetroInput, ConfirmDialog, useToast, ViewOnceMedia, SkeletonText, getRetroPfpUrl } from '../components/UI.jsx';
import { PocketWatchWinder } from '../components/PocketWatchWinder.jsx';
import { SecureImage, SecureVideo, SecureAudio } from '../components/SecureMedia.jsx';
import { useSignedUrl, parseSupabaseUrl } from '../hooks/useSignedUrl.js';
import { useAssetSync } from '../hooks/useAssetSync.js';
import { useMobile } from '../hooks/useMobile.js';
import { useLastSeen } from '../hooks/useLastSeen.js';
import { playAudio } from '../utils/audio.js';
import { useBroadcast, useGlobalSync } from '../hooks/useSupabaseSync.js';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { base64ToBlob, compressImage } from '../utils/file.js';
import { isTestMode } from '../lib/testMode.js';
import { useAuth, useSync, useChat, useCall } from '../context/instances.js';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder.js';
import { useTypingIndicator } from '../hooks/useTypingIndicator.js';
import { ServerSettingsModal } from '../components/Modals/ServerSettingsModal.jsx';
import { supabase } from '../lib/supabase.js';
import { BOT_POSTS } from '../constants/botPosts.js';

const RetroIcon = ({ icon: Icon, ...props }) => <Icon {...props} />;

/* ═══════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════ */

const globalAudioRef = { current: null };
function VoiceMessagePlayer({ duration, audioUrl, isMe }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const isBlob = audioUrl?.startsWith('blob:');
  const { bucket, path } = isBlob ? { bucket: null, path: null } : parseSupabaseUrl(audioUrl);
  const { signedUrl: sUrl } = useSignedUrl(bucket, path);
  const effectiveUrl = isBlob ? audioUrl : sUrl;
  const audioRef = useRef(null);

  useEffect(() => {
    if (effectiveUrl) {
      audioRef.current = new Audio(effectiveUrl);
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [effectiveUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.onended = () => { setIsPlaying(false); setProgress(0); };

    const stopHandler = () => { if (globalAudioRef.current !== audioRef.current) setIsPlaying(false); };
    window.addEventListener('stopAudio', stopHandler);

    return () => {
      if (audio) {
        audio.pause();
        audio.removeEventListener('timeupdate', updateTime);
        audio.src = '';
      }
      window.removeEventListener('stopAudio', stopHandler);
    };
  }, [audioUrl]);

  const handleSeek = (e) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - bounds.left) / bounds.width;
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = percent * audioRef.current.duration;
      setProgress(percent * 100);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else {
      if (globalAudioRef.current && globalAudioRef.current !== audioRef.current) { globalAudioRef.current.pause(); window.dispatchEvent(new Event('stopAudio')); }
      audioRef.current.play().catch(e => console.log(e));
      globalAudioRef.current = audioRef.current;
      setIsPlaying(true);
    }
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3 w-48 sm:w-56">
      <button onClick={togglePlay} className={`w-8 h-8 retro-border retro-shadow-dark flex-shrink-0 flex items-center justify-center hover:brightness-110 transition-all ${isMe ? 'bg-window text-primary' : 'bg-primary text-white'}`}>
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>

      <div onClick={handleSeek} className="flex-1 h-4 bg-black/20 retro-border border-dashed relative overflow-hidden cursor-pointer group">
        <div
          className={`absolute top-0 left-0 h-full transition-all duration-75 ${isMe ? 'bg-primary-text' : 'bg-main-text'}`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <span className={`text-[10px] sm:text-xs font-bold whitespace-nowrap ${isMe ? 'text-primary-text opacity-90' : 'text-main-text'}`}>
        {duration}
      </span>
    </div>
  );
}

export function toTrollCase(text) {
  if (!text) return '';
  return text.split(' ').map(word => {
    const hasLorI = /[li]/i.test(word);
    
    let optALost = 0;
    let optBLost = 0;
    
    const chars = word.split('');
    let letterIndex = 0;
    
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      if (/[a-zA-Z]/.test(char)) {
        const isLorI = /[li]/i.test(char);
        if (isLorI) {
          if (letterIndex % 2 === 1) {
            optALost++;
          } else {
            optBLost++;
          }
        }
        letterIndex++;
      }
    }
    
    const startWithUpper = optBLost <= optALost;
    
    let currentLetterIdx = 0;
    return chars.map(char => {
      if (/[a-zA-Z]/.test(char)) {
        const isUpper = startWithUpper ? (currentLetterIdx % 2 === 0) : (currentLetterIdx % 2 === 1);
        currentLetterIdx++;
        
        if (/[li]/i.test(char)) {
          return char.toLowerCase();
        }
        
        return isUpper ? char.toUpperCase() : char.toLowerCase();
      }
      return char;
    }).join('');
  }).join(' ');
}

export function htmlToMarkdown(html) {
  if (!html) return '';
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  function serializeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      let childrenContent = '';
      node.childNodes.forEach(child => {
        childrenContent += serializeNode(child);
      });
      
      switch (tagName) {
        case 'strong':
        case 'b':
          return `**${childrenContent}**`;
        case 'em':
        case 'i':
          return `*${childrenContent}*`;
        case 'del':
        case 'strike':
        case 's':
          return `~~${childrenContent}~~`;
        case 'sub':
          return `$x_{${childrenContent}}$`;
        case 'sup':
          return `$x^{${childrenContent}}$`;
        case 'pre':
          if (node.classList.contains('latex-eq')) {
            return `$$\n${childrenContent}\n$$`;
          }
          return childrenContent;
        case 'br':
          return '\n';
        case 'div':
        case 'p':
          return `\n${childrenContent}`;
        default:
          return childrenContent;
      }
    }
    return '';
  }
  
  let markdown = '';
  doc.body.childNodes.forEach(node => {
    markdown += serializeNode(node);
  });
  
  return markdown.replace(/^\n+/, '').replace(/\n+$/, '');
}

export function markdownToHtml(md) {
  if (!md) return '';
  let html = md;
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  
  html = html.replace(/\$x_\{([^}]+)\}\$/g, '<sub>$1</sub>');
  
  html = html.replace(/\$x\^\{([^}]+)\}\$/g, '<sup>$1</sup>');
  
  html = html.replace(/\$\$\s*([\s\S]+?)\s*\$\$/g, '<pre class="latex-eq">$1</pre>');

  html = html.replace(/\n/g, '<br>');
  
  return html;
}

function formatMessage(text, isEdited) {
  if (!text) return null;
  return (
    <div className="markdown-body font-mono">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({node, ...props}) => <span {...props} />, 
          a: ({node, ...props}) => <a {...props} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {text}
      </ReactMarkdown>
      {isEdited && <em className="text-[9px] opacity-40 ml-1.5 font-normal">(edited)</em>}
    </div>
  );
}

function PostPreviewCard({ text }) {
  const { globalState } = useSync();
  const navigate = useNavigate();
  const [dbPost, setDbPost] = useState(null);
  const [loading, setLoading] = useState(false);

  // Match post link: /post/userShortId-postShortId
  const match = text?.match(/post\/([a-zA-Z0-9]+)-([a-zA-Z0-9]+)/);
  if (!match) return null;

  const userShortId = match[1];
  const postShortId = match[2];

  useEffect(() => {
    // 1. Search in globalState.posts or BOT_POSTS
    const postsToSearch = [
      ...(globalState?.posts || []),
      ...BOT_POSTS
    ];
    const found = postsToSearch.find(p => {
      const pShortId = p.id.split('-').pop();
      const uShortId = p.user_id?.split('-')[0] || '';
      return pShortId.startsWith(postShortId) && uShortId.startsWith(userShortId);
    });

    if (found) {
      setDbPost(found);
      return;
    }

    // 2. Fetch from Supabase yard_posts if not found
    const fetchPostFromDb = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('yard_posts')
          .select('*');
        if (!error && data) {
          const matched = data.find(p => {
            const pShortId = p.id.split('-').pop();
            const uShortId = p.user_id?.split('-')[0] || '';
            return pShortId.startsWith(postShortId) && uShortId.startsWith(userShortId);
          });
          if (matched) {
            setDbPost(matched);
          }
        }
      } catch (err) {
        console.error("Error fetching shared post preview:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPostFromDb();
  }, [userShortId, postShortId, globalState?.posts]);

  if (loading) {
    return (
      <div className="mt-2 p-2 border border-dashed border-border/25 bg-window/10 text-[10px] font-mono animate-pulse lowercase select-none">
        loading post card...
      </div>
    );
  }

  if (!dbPost) return null;

  const authorProfile = globalState?.room_profiles?.[dbPost.user_id] || {
    name: dbPost.username || 'Anonymous',
    emoji: dbPost.emoji || null,
    pfp: dbPost.avatar || null
  };

  return (
    <div 
      className="mt-2 retro-border bg-window/10 p-2 flex flex-col gap-2 hover:bg-window/20 cursor-pointer border-t-[3px] border-t-primary border-l-2 border-r-2 border-b-2"
      style={{
        borderRadius: '0px !important',
        boxShadow: 'none !important'
      }}
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/post/${userShortId}-${postShortId}`);
      }}
    >
      <div className="flex items-center gap-1.5 border-b border-dashed border-border/10 pb-1">
        {authorProfile.pfp ? (
          <img src={authorProfile.pfp} alt="" className="w-5 h-5 border object-cover bg-white" style={{ borderRadius: '0px !important' }} />
        ) : (
          <span className="w-5 h-5 border bg-accent text-accent-text flex items-center justify-center text-[10px] font-bold" style={{ borderRadius: '0px !important' }}>
            {authorProfile.emoji || 'P'}
          </span>
        )}
        <span className="text-[10px] font-black lowercase truncate">{authorProfile.name}</span>
        <span className="text-[8px] opacity-45 font-mono ml-auto uppercase">[post card]</span>
      </div>
      <div className="text-[11px] font-mono leading-relaxed font-bold">
        {dbPost.content}
      </div>
      {dbPost.image_url && (
        <div className="retro-border overflow-hidden bg-black/5 flex items-center justify-center max-h-24" style={{ borderRadius: '0px !important' }}>
          <img src={dbPost.image_url} alt="" className="max-w-full max-h-24 object-contain" style={{ borderRadius: '0px !important' }} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   DEMO DATA SEEDS
   ═══════════════════════════════════════════════════════ */

const DEFAULT_SERVERS = [
  {
    id: 'da2a11b0ab124c348f567890abcdef12',
    name: 'hangout',
    icon: '🌳',
    type: 'server',
    channels: [
      // General
      { id: 'da2a11b0ab124c348f567890abcdef11', name: 'announcements', type: 'text', category: 'General', description: 'Important updates for everyone' },
      { id: 'da2a11b0ab124c348f567890abcdef22', name: 'general', type: 'text', category: 'General', description: 'The main yard gathering place' },
      { id: 'da2a11b0ab124c348f567890abcdef33', name: 'random', type: 'text', category: 'General', description: 'Anything goes here' },
      { id: 'da2a11b0ab124c348f567890abcdef44', name: 'media-share', type: 'text', category: 'General', description: 'Share your retro memes and screenshots' },
      // Gayms
      { id: 'da2a11b0ab124c348f567890abcdef55', name: 'lobby', type: 'text', category: 'Gayms', description: 'Lobby for arcade games' },
      { id: 'da2a11b0ab124c348f567890abcdef66', name: 'high-scores', type: 'text', category: 'Gayms', description: 'Post your high scores' },
      { id: 'da2a11b0ab124c348f567890abcdef77', name: 'Voice 1', type: 'voice', category: 'Gayms' },
      // Music
      { id: 'da2a11b0ab124c348f567890abcdef88', name: 'jams', type: 'text', category: 'Music', description: 'Share music jams' },
      { id: 'da2a11b0ab124c348f567890abcdef99', name: 'Radio Yard', type: 'voice', category: 'Music' },
      // Mubi
      { id: 'da2a11b0ab124c348f567890abcdefaa', name: 'films', type: 'text', category: 'Mubi', description: 'Discuss films' },
      { id: 'da2a11b0ab124c348f567890abcdefbb', name: 'Watch Party', type: 'voice', category: 'Mubi' }
    ],
    members: [
      { id: 'user_me', name: 'You', emoji: '😊', isOnline: true, status: 'cooking...', role: 'owner' },
      { id: 'green_bot', name: 'Green-bot', emoji: '🤖', isOnline: true, status: 'watching 30,501 guilds | green-bot.app', tag: 'APP', role: 'admin' },
      { id: 'teto', name: 'teto', emoji: '🎧', isOnline: true, status: 'No alarms and No surprises', tag: 'RVLS', role: 'admin' },
      { id: 'kafka', name: 'Kafka', emoji: '☕', isOnline: true, status: 'online', role: 'member' },
      // Offline members
      { id: 'matcha_kitty', name: 'matcha_kitty', emoji: '🐱', isOnline: false, role: 'member' },
      { id: 'vapor_wave', name: 'vapor_wave', emoji: '🌊', isOnline: false, role: 'member' },
      { id: 'glitch_wizard', name: 'glitch_wizard', emoji: '🧙‍♂️', isOnline: false, role: 'member' },
      { id: 'floppy_disk', name: 'floppy_disk', emoji: '💾', isOnline: false, role: 'member' },
      { id: 'cassette_deck', name: 'cassette_deck', emoji: '📼', isOnline: false, role: 'member' },
      { id: 'cyber_punk', name: 'cyber_punk', emoji: '🕶️', isOnline: false, role: 'member' },
      { id: 'retro_gamer', name: 'retro_gamer', emoji: '🕹️', isOnline: false, role: 'member' },
      { id: 'neon_dream', name: 'neon_dream', emoji: '✨', isOnline: false, role: 'member' },
      { id: 'bit_mapped', name: 'bit_mapped', emoji: '🖥️', isOnline: false, role: 'member' },
      { id: 'pixel_artist', name: 'pixel_artist', emoji: '🎨', isOnline: false, role: 'member' },
      { id: 'synth_wave', name: 'synth_wave', emoji: '🎹', isOnline: false, role: 'member' },
      { id: 'lofi_chill', name: 'lofi_chill', emoji: '☕', isOnline: false, role: 'member' },
      { id: 'crt_monitor', name: 'crt_monitor', emoji: '📺', isOnline: false, role: 'member' },
      { id: 'disk_ette', name: 'disk_ette', emoji: '💾', isOnline: false, role: 'member' },
      { id: 'matcha_latte', name: 'matcha_latte', emoji: '🍵', isOnline: false, role: 'member' },
      { id: 'ascii_cat', name: 'ascii_cat', emoji: '🐈', isOnline: false, role: 'member' },
      { id: 'terminal_boy', name: 'terminal_boy', emoji: '📟', isOnline: false, role: 'member' }
    ]
  },
  {
    id: 'da2a11b0ab124c348f567890abcdefcc',
    name: 'Study Squad',
    icon: '📚',
    type: 'guild',
    channels: [
      { id: 'da2a11b0ab124c348f567890abcdefc1', name: 'homework', type: 'text', category: 'General', description: 'Math and coding questions' },
      { id: 'da2a11b0ab124c348f567890abcdefc2', name: 'chill', type: 'text', category: 'General', description: 'Non-study related chat' }
    ],
    members: [
      { id: 'user_me', name: 'You', emoji: '😊', isOnline: true, role: 'owner' },
      { id: 'user_alice', name: 'Alice', emoji: '👾', isOnline: true, status: 'studying React 📚', role: 'admin' },
      { id: 'user_bob', name: 'Bob', emoji: '🛹', isOnline: false, role: 'member' },
      { id: 'user_charlie', name: 'Charlie', emoji: '🍿', isOnline: true, role: 'member' },
      { id: 'user_diana', name: 'Diana', emoji: '🎧', isOnline: false, role: 'member' }
    ]
  }
];

const ALL_POTENTIAL_MEMBERS = [
  { id: 'user_partner', name: 'Partner', emoji: '☕', status: 'watching retro films' },
  { id: 'user_alice', name: 'Alice', emoji: '👾', status: 'online' },
  { id: 'user_bob', name: 'Bob', emoji: '🛹', status: 'offline' },
  { id: 'user_charlie', name: 'Charlie', emoji: '🍿', status: 'online' },
  { id: 'matcha_kitty', name: 'matcha_kitty', emoji: '🐱', status: 'napping near fireplace' },
  { id: 'vapor_wave', name: 'vapor_wave', emoji: '🌊', status: 'listening to synths' },
  { id: 'glitch_wizard', name: 'glitch_wizard', emoji: '🧙‍♂️', status: 'fixing compiler errors' },
  { id: 'retro_gamer', name: 'retro_gamer', emoji: '🕹️', status: 'playing ludo' },
];

const DEFAULT_DMS = [
  {
    id: 'e2e00000ab124c348f567890abcdef00',
    name: 'Partner',
    emoji: '☕',
    isReal: true,
    lastMessage: '',
    timestamp: '',
    unread: 0
  },
  {
    id: 'a11ce000ab124c348f567890abcdef00',
    name: 'Alice',
    emoji: '👾',
    isReal: false,
    lastMessage: 'Check out this new CSS theme I found!',
    timestamp: '2:15 PM',
    unread: 1,
    members: [
      { id: 'user_me', name: 'You', emoji: '😊', isOnline: true },
      { id: 'user_alice', name: 'Alice', emoji: '👾', isOnline: true, status: 'playing tetris 👾' }
    ]
  },
  {
    id: '5eb40b00ab124c348f567890abcdef00',
    name: 'RetroBot',
    emoji: '🤖',
    isReal: false,
    lastMessage: 'beep boop, type /help for list of commands!',
    timestamp: 'Yesterday',
    unread: 0,
    members: [
      { id: 'user_me', name: 'You', emoji: '😊', isOnline: true },
      { id: 'user_retro_bot', name: 'RetroBot', emoji: '🤖', isOnline: true, status: 'processing data 🤖' }
    ]
  }
];

const DEFAULT_DEMO_MESSAGES = {
  'da2a11b0ab124c348f567890abcdef12_da2a11b0ab124c348f567890abcdef22': [
    { id: 'm1', sender: 'user_alice', text: 'welcome to the Yard central server! 🌳', time: '10:00 AM', created_at: new Date(Date.now() - 3600000 * 5).toISOString() },
    { id: 'm2', sender: 'user_bob', text: 'hey guys, did you see the new scoreboard?', time: '10:02 AM', created_at: new Date(Date.now() - 3600000 * 4.9).toISOString() },
    { id: 'm3', sender: 'user_me', text: 'Yeah, we need to beat our highscore in Tetris!', time: '10:05 AM', created_at: new Date(Date.now() - 3600000 * 4.8).toISOString() },
    { id: 'm4', sender: 'user_alice', text: 'I am on it. I just scored 12,000 points.', time: '10:06 AM', created_at: new Date(Date.now() - 3600000 * 4.7).toISOString() }
  ],
  'da2a11b0ab124c348f567890abcdef12_da2a11b0ab124c348f567890abcdef11': [
    { id: 'a1', sender: 'user_alice', text: '📢 Announcement: The weekly doodle session starts tonight at 8 PM!', time: 'Yesterday', created_at: new Date(Date.now() - 86400000).toISOString() }
  ],
  'da2a11b0ab124c348f567890abcdefcc_da2a11b0ab124c348f567890abcdefc1': [
    { id: 'h1', sender: 'user_alice', text: 'Anyone finished the React hooks assignment?', time: 'Yesterday', created_at: new Date(Date.now() - 86400000 * 1.5).toISOString() },
    { id: 'h2', sender: 'user_charlie', text: 'I am stuck on custom hooks. Let me share my screen later.', time: 'Yesterday', created_at: new Date(Date.now() - 86400000 * 1.4).toISOString() }
  ],
  'a11ce000ab124c348f567890abcdef00': [
    { id: 'da1', sender: 'user_alice', text: 'hey! how is the new chat page coming along?', time: '2:10 PM', created_at: new Date(Date.now() - 600000).toISOString() },
    { id: 'da2', sender: 'user_alice', text: 'Check out this new CSS theme I found!', time: '2:15 PM', created_at: new Date(Date.now() - 300000).toISOString() }
  ],
  '5eb40b00ab124c348f567890abcdef00': [
    { id: 'dr1', sender: 'user_retro_bot', text: 'hello human! I am RetroBot, your pixel-perfect assistant.', time: 'Yesterday', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'dr2', sender: 'user_retro_bot', text: 'beep boop, type /help for list of commands!', time: 'Yesterday', created_at: new Date(Date.now() - 86400000 * 1.9).toISOString() }
  ]
};

const normalizeId = (id) => id?.replace(/-/g, '');
const addHyphens = (uuid) => {
  if (!uuid || uuid.length !== 32) return uuid;
  return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
};

// ── Canonical ID constants ──
const HANGOUT_SERVER_ID = 'da2a11b0ab124c348f567890abcdef12';
const GENERAL_CHANNEL_ID = 'da2a11b0ab124c348f567890abcdef22';
const DM_PARTNER_ID = 'e2e00000ab124c348f567890abcdef00';
const DM_ALICE_ID = 'a11ce000ab124c348f567890abcdef00';
const DM_RETRO_BOT_ID = '5eb40b00ab124c348f567890abcdef00';
const DM_CRAYON_CAT_ID = 'c4a70ca7ab124c348f567890abcdef00';
const DM_RETRO_GAMER_ID = '4e740900ab124c348f567890abcdef00';
const DM_LOFI_DJ_ID = '10f1d100ab124c348f567890abcdef00';
const DM_PIXEL_PET_ID = 'b1e1be70ab124c348f567890abcdef00';
const DM_SPACE_WANDERER_ID = '5bac3000ab124c348f567890abcdef00';

const MOCK_BOT_IDS = [
  DM_ALICE_ID,
  DM_RETRO_BOT_ID,
  DM_CRAYON_CAT_ID,
  DM_RETRO_GAMER_ID,
  DM_LOFI_DJ_ID,
  DM_PIXEL_PET_ID,
  DM_SPACE_WANDERER_ID
];

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */

export function ChatView({ onClose, sfx, theme, sfxEnabled }) {
  const isMobile = useMobile();
  const { userId, partnerId, roomId } = useAuth();
  const { globalState, broadcast: syncBroadcast, onlineUsers, isInitialized } = useSync();
  const { 
    messages: chatHistory, sendMessage: syncSendMessage, retrySendMessage, updateMessage: syncUpdateMessage, deleteMessage: syncDeleteMessage, clearChatHistory, loadMore: syncLoadMore, hasMore: syncHasMore, searchMessages, jumpToMessage, loadNewer, resetToLatest, changePin,
    isE2EEReady, showRestorePrompt, setShowRestorePrompt, handleRestore, restoreKeyInput, setRestoreKeyInput, restoreError, isRestoring, isDeriving,
    showPinSetupPrompt, setShowPinSetupPrompt, pinSetupStep, setPinSetupStep, pinSetupInput, setPinSetupInput, pinSetupConfirm, setPinSetupConfirm, pinWarningConfirmed, setPinWarningConfirmed, handleCreatePin, showResetConfirm, setShowResetConfirm,
    resetE2EEKeys
  } = useChat();
  const addToast = useToast();
  const { startCall, isMuted, isDeafened, toggleMic, toggleDeafen } = useCall();
  const { uploadAsset } = useAssetSync(roomId);

  // SFX normalization
  const effectiveSfxEnabled = sfxEnabled !== undefined ? sfxEnabled : sfx;

  const navigate = useNavigate();
  const location = useLocation();
  const { dmId, bubbleId, guildId, channelId } = useParams();

  // Profiles resolution
  const profile = globalState?.room_profiles?.[userId] || {};
  const partnerProfile = globalState?.room_profiles?.[partnerId] || {};
  const roomProfiles = globalState?.room_profiles || {};
  const coupleData = globalState.couple_data || {};
  const partnerNickname = coupleData.nicknames?.[partnerId] || partnerProfile.name || 'Partner';
  const partnerNicknameNode = isInitialized ? partnerNickname : <SkeletonText className="w-16 h-3 inline-block animate-pulse bg-gray-300" />;
  const { partnerStatusData, partnerStatusLabel } = useLastSeen();
  const isNormalized = !!roomId;
  const isInputDisabled = false;

  // Multi-Channel Navigation States derived from URL parameters
  const activeTab = guildId || channelId ? 'servers' : (bubbleId ? 'bubbles' : 'dms');
  const selectedServerId = guildId || null;
  const selectedChannelId = channelId || null;
  const selectedDmId = dmId || null;
  const selectedBubbleId = bubbleId || null;

  // Database lists
  const [servers, setServers] = useState([]);
  const [dms, setDms] = useState([]);
  const [bubbles, setBubbles] = useState([]);
  const [dbMessages, setDbMessages] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbMessagesLoading, setDbMessagesLoading] = useState(false);

  const [showStartDmModal, setShowStartDmModal] = useState(false);
  const [showCreateBubbleModal, setShowCreateBubbleModal] = useState(false);
  const [bubbleName, setBubbleName] = useState('');
  const [bubbleDescription, setBubbleDescription] = useState('');
  const [selectedBubbleMembers, setSelectedBubbleMembers] = useState([]);
  const [dmsExpanded, setDmsExpanded] = useState(true);
  const [bubblesExpanded, setBubblesExpanded] = useState(true);

  // Fallbacks for bots and partner
  const [demoMessages, setDemoMessages] = useState(() => {
    const saved = localStorage.getItem('yard_demo_messages');
    return saved ? JSON.parse(saved) : DEFAULT_DEMO_MESSAGES;
  });

  // Fetch all chat resources (Guilds, DMs, Bubbles) from database on mount or user change
  useEffect(() => {
    if (!userId || !isInitialized) return;

    let isMounted = true;

    const loadData = async () => {
      setDbLoading(true);
      try {
        // 1. Fetch Guilds/Servers
        const { data: serverMembers, error: serverErr } = await supabase
          .from('yard_server_members')
          .select(`
            server_id,
            role,
            joined_at,
            yard_servers (
              id,
              name,
              description,
              icon_url,
              owner_id,
              created_at
            )
          `)
          .eq('user_id', userId);

        if (serverErr) throw serverErr;

        let fetchedServers = serverMembers
          ?.filter(sm => sm.yard_servers)
          .map(sm => ({
            id: sm.yard_servers.id,
            name: sm.yard_servers.name,
            description: sm.yard_servers.description,
            icon: sm.yard_servers.icon_url,
            owner_id: sm.yard_servers.owner_id,
            role: sm.role,
            created_at: sm.yard_servers.created_at,
            channels: [],
            members: []
          })) || [];

        // Ensure "hangout" server exists in database
        let { data: existingHangout } = await supabase
          .from('yard_servers')
          .select('id')
          .eq('name', 'hangout')
          .limit(1);

        let hangoutServerId;
        if (existingHangout && existingHangout.length > 0) {
          hangoutServerId = existingHangout[0].id;
        } else {
          // Find the owner profile matching absalif5@gmail.com
          const starterOwnerId = Object.keys(roomProfiles).find(uid => roomProfiles[uid]?.email === 'absalif5@gmail.com') || userId;
          
          // Create "hangout" server
          const { data: newHangout, error: createErr } = await supabase
            .from('yard_servers')
            .insert({
              name: 'hangout',
              description: 'hangout and chat in our main yard',
              icon_url: '🌳',
              owner_id: starterOwnerId
            })
            .select('id')
            .single();
          
          if (newHangout) {
            hangoutServerId = newHangout.id;
            // Create default channels for it
            const defaultChans = [
              { server_id: hangoutServerId, name: 'announcements', type: 'text', category_name: 'General', description: 'Important updates for everyone' },
              { server_id: hangoutServerId, name: 'general', type: 'text', category_name: 'General', description: 'The main yard gathering place' },
              { server_id: hangoutServerId, name: 'random', type: 'text', category_name: 'General', description: 'Anything goes here' },
              { server_id: hangoutServerId, name: 'voice-1', type: 'voice', category_name: 'General' }
            ];
            await supabase.from('yard_channels').insert(defaultChans);

            // Add owner to members
            await supabase.from('yard_server_members').insert({
              server_id: hangoutServerId,
              user_id: starterOwnerId,
              role: 'owner'
            });
          }
        }

        if (hangoutServerId) {
          const isMember = fetchedServers.some(s => s.id === hangoutServerId);
          if (!isMember) {
            const isOwner = userId === (Object.keys(roomProfiles).find(uid => roomProfiles[uid]?.email === 'absalif5@gmail.com') || userId);
            await supabase.from('yard_server_members').insert({
              server_id: hangoutServerId,
              user_id: userId,
              role: isOwner ? 'owner' : 'member'
            });

            // Re-fetch server members for the current user
            const { data: newServerMembers } = await supabase
              .from('yard_server_members')
              .select(`
                server_id,
                role,
                joined_at,
                yard_servers (
                  id,
                  name,
                  description,
                  icon_url,
                  owner_id,
                  created_at
                )
              `)
              .eq('user_id', userId);

            fetchedServers = newServerMembers
              ?.filter(sm => sm.yard_servers)
              .map(sm => ({
                id: sm.yard_servers.id,
                name: sm.yard_servers.name,
                description: sm.yard_servers.description,
                icon: sm.yard_servers.icon_url,
                owner_id: sm.yard_servers.owner_id,
                role: sm.role,
                created_at: sm.yard_servers.created_at,
                channels: [],
                members: []
              })) || [];
          }
        }

        // Fetch channels for these servers
        const serverIds = fetchedServers.map(s => s.id);
        if (serverIds.length > 0) {
          const { data: channelsData } = await supabase
            .from('yard_channels')
            .select('*')
            .in('server_id', serverIds);

          const { data: membersData } = await supabase
            .from('yard_server_members')
            .select('*')
            .in('server_id', serverIds);

          fetchedServers.forEach(s => {
            s.channels = channelsData?.filter(c => c.server_id === s.id) || [];
            
            const sMembers = membersData?.filter(m => m.server_id === s.id) || [];
            s.members = sMembers.map(sm => {
              const uProfile = roomProfiles[sm.user_id] || {};
              return {
                id: sm.user_id,
                name: uProfile.name || 'User',
                emoji: uProfile.emoji || '👤',
                isOnline: !!onlineUsers[sm.user_id],
                role: sm.role
              };
            });
          });
        }

        if (isMounted) setServers(fetchedServers);

        // 2. Fetch DMs
        const { data: dmMembersData, error: dmErr } = await supabase
          .from('yard_dm_members')
          .select(`
            channel_id,
            joined_at,
            yard_dm_channels (
              id,
              created_at
            )
          `)
          .eq('user_id', userId);

        if (dmErr) throw dmErr;

        let dmChannels = dmMembersData?.filter(d => d.yard_dm_channels).map(d => d.channel_id) || [];

        // If user has NO DMs and has a partnerId, let's create a DM channel with partner
        if (dmChannels.length === 0 && partnerId) {
          // Create new DM channel
          const { data: newDmChan, error: dmCreateErr } = await supabase
            .from('yard_dm_channels')
            .insert({})
            .select('id')
            .single();

          if (newDmChan) {
            const channelId = newDmChan.id;
            // Add current user and partner as members
            await supabase.from('yard_dm_members').insert([
              { channel_id: channelId, user_id: userId },
              { channel_id: channelId, user_id: partnerId }
            ]);
            dmChannels = [channelId];
          }
        }

        let fetchedDms = [];
        if (dmChannels.length > 0) {
          const { data: allDmMembers } = await supabase
            .from('yard_dm_members')
            .select('channel_id, user_id')
            .in('channel_id', dmChannels);

          fetchedDms = dmChannels.map(cid => {
            const members = allDmMembers?.filter(m => m.channel_id === cid) || [];
            const otherMemberId = members.find(m => m.user_id !== userId)?.user_id || userId;
            const otherProfile = roomProfiles[otherMemberId] || {};
            return {
              id: cid,
              name: otherProfile.name || 'Partner',
              emoji: otherProfile.emoji || '☕',
              isReal: true,
              lastMessage: '',
              timestamp: '',
              unread: 0,
              members: members.map(m => ({
                id: m.user_id,
                name: roomProfiles[m.user_id]?.name || 'User',
                emoji: roomProfiles[m.user_id]?.emoji || '👤'
              }))
            };
          });
        }

        if (isMounted) setDms(fetchedDms);

        // 3. Fetch Bubbles (Groups)
        const { data: bubbleMembersData, error: bubbleErr } = await supabase
          .from('yard_bubble_members')
          .select(`
            bubble_id,
            joined_at,
            yard_bubbles (
              id,
              name,
              description,
              icon_url,
              owner_id,
              created_at
            )
          `)
          .eq('user_id', userId);

        if (bubbleErr) throw bubbleErr;

        let fetchedBubbles = [];
        if (bubbleMembersData && bubbleMembersData.length > 0) {
          const bubbleIds = bubbleMembersData.filter(b => b.yard_bubbles).map(b => b.bubble_id);
          
          const { data: allBubbleMembers } = await supabase
            .from('yard_bubble_members')
            .select('bubble_id, user_id')
            .in('bubble_id', bubbleIds);

          fetchedBubbles = bubbleMembersData
            ?.filter(b => b.yard_bubbles)
            .map(b => {
              const bid = b.yard_bubbles.id;
              const members = allBubbleMembers?.filter(bm => bm.bubble_id === bid) || [];
              return {
                id: bid,
                name: b.yard_bubbles.name,
                description: b.yard_bubbles.description,
                icon: b.yard_bubbles.icon_url || 'B',
                owner_id: b.yard_bubbles.owner_id,
                created_at: b.yard_bubbles.created_at,
                type: 'bubble',
                members: members.map(m => ({
                  id: m.user_id,
                  name: roomProfiles[m.user_id]?.name || 'User',
                  emoji: roomProfiles[m.user_id]?.emoji || ''
                }))
              };
            }) || [];
        }

        if (isMounted) setBubbles(fetchedBubbles);

      } catch (err) {
        console.error('[DATABASE] Error loading chat resources:', err);
      } finally {
        if (isMounted) setDbLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [userId, partnerId, isInitialized]);

  // Handle empty path redirection
  useEffect(() => {
    if (dbLoading) return;
    if (location.pathname === '/chat' || location.pathname === '/chat/') {
      // Check if a specific DM was requested via navigation state
      const requestedDm = location.state?.selectDmId;
      const targetDmId = requestedDm || DM_PARTNER_ID;
      navigate(`/chat/dm/${targetDmId}`, { replace: true });
    } else if (guildId && !channelId) {
      // Redirect to the first channel of the guild
      const server = servers.find(s => s.id === guildId);
      const firstChan = server?.channels?.[0]?.id;
      if (firstChan) {
        navigate(`/chat/guild/${guildId}/${firstChan}`, { replace: true });
      }
    }
  }, [dbLoading, location.pathname, dms, bubbles, servers, guildId, channelId, navigate]);

  // Modal and addition toggles
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [createServerName, setCreateServerName] = useState('');
  const [createServerIcon, setCreateServerIcon] = useState('🎮');
  const [createServerType, setCreateServerType] = useState('server'); // 'server' | 'guild'
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [showServerSettingsModal, setShowServerSettingsModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteServerConfirm, setShowDeleteServerConfirm] = useState(false);
  const [serverSettingsTab, setServerSettingsTab] = useState('info');
  const [editServerName, setEditServerName] = useState('');
  const [editServerIcon, setEditServerIcon] = useState('');

  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  // Mobile navigation views
  const [mobileView, setMobileView] = useState('chat'); // 'sidebar' | 'chat' | 'details'
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState(null);
  const [showEvents, setShowEvents] = useState(false);
  const [mutedChannels, setMutedChannels] = useState({});

  // Typing simulator state
  const [mockTypingSenders, setMockTypingSenders] = useState({});

  // Timer trackers for async bot replies
  const timersRef = useRef([]);
  const addTimer = (fn, delay) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  };

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (showCreateServer) {
      const myProfile = globalState?.room_profiles?.[userId];
      const myName = myProfile?.name || 'You';
      setCreateServerName(`${myName}'s Guild`);
      setCreateServerIcon('');
      setCreateServerType('server');
    }
  }, [showCreateServer, globalState, userId]);

  // Compute active target details
  const activeServer = activeTab === 'servers' ? servers.find(s => s.id === selectedServerId) : null;
  const currentUserRole = activeServer?.members?.find(m => m.id === userId)?.role || 'member';

  const activeChannel = useMemo(() => {
    if (activeTab === 'servers') {
      return activeServer?.channels?.find(c => c.id === selectedChannelId) || activeServer?.channels?.[0] || null;
    } else if (activeTab === 'bubbles') {
      return bubbles.find(b => b.id === selectedBubbleId) || null;
    } else {
      // Local fallback/seed DMs list (RetroBot, Alice, CrayonCat, RetroGamer, LofiDJ, PixelPet, SpaceWanderer)
      const allDms = [
        { id: DM_PARTNER_ID, name: partnerNickname, emoji: '☕', isReal: true },
        { 
          id: DM_ALICE_ID, 
          name: 'Alice', 
          emoji: '👾', 
          isReal: false,
          members: [
            { id: 'user_me', name: 'You', emoji: '😊', isOnline: true },
            { id: 'user_alice', name: 'Alice', emoji: '👾', isOnline: true }
          ]
        },
        { 
          id: DM_RETRO_BOT_ID, 
          name: 'RetroBot', 
          emoji: '🤖', 
          isReal: false,
          members: [
            { id: 'user_me', name: 'You', emoji: '😊', isOnline: true },
            { id: 'user_retro_bot', name: 'RetroBot', emoji: '🤖', isOnline: true }
          ]
        },
        { 
          id: DM_CRAYON_CAT_ID, 
          name: 'CrayonCat', 
          emoji: '🐱', 
          isReal: false,
          members: [
            { id: 'user_me', name: 'You', emoji: '😊', isOnline: true },
            { id: 'crayoncat', name: 'CrayonCat', emoji: '🐱', isOnline: true }
          ]
        },
        { 
          id: DM_RETRO_GAMER_ID, 
          name: 'RetroGamer', 
          emoji: '🕹️', 
          isReal: false,
          members: [
            { id: 'user_me', name: 'You', emoji: '😊', isOnline: true },
            { id: 'retrogamer', name: 'RetroGamer', emoji: '🕹️', isOnline: true }
          ]
        },
        { 
          id: DM_LOFI_DJ_ID, 
          name: 'LofiDJ', 
          emoji: '🎧', 
          isReal: false,
          members: [
            { id: 'user_me', name: 'You', emoji: '😊', isOnline: true },
            { id: 'lofidj', name: 'LofiDJ', emoji: '🎧', isOnline: true }
          ]
        },
        { 
          id: DM_PIXEL_PET_ID, 
          name: 'PixelPet', 
          emoji: '🐾', 
          isReal: false,
          members: [
            { id: 'user_me', name: 'You', emoji: '😊', isOnline: true },
            { id: 'pixelpet', name: 'PixelPet', emoji: '🐾', isOnline: true }
          ]
        },
        { 
          id: DM_SPACE_WANDERER_ID, 
          name: 'SpaceWanderer', 
          emoji: '🌌', 
          isReal: false,
          members: [
            { id: 'user_me', name: 'You', emoji: '😊', isOnline: true },
            { id: 'spacewanderer', name: 'SpaceWanderer', emoji: '🌌', isOnline: true }
          ]
        },
        ...dms
      ];
      return allDms.find(d => d.id === selectedDmId) || null;
    }
  }, [activeTab, activeServer, selectedChannelId, bubbles, selectedBubbleId, partnerNickname, dms, selectedDmId]);

  // Formatting & Input Staging States
  const [openReactMsgId, setOpenReactMsgId] = useState(null);
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState(() => activeTab === 'servers' ? 'members' : 'media');
  const [sidebarView, setSidebarView] = useState('profile');
  const [profileUserId, setProfileUserId] = useState(null);
  const [sessionTime, setSessionTime] = useState('00:08:42');
  const [mutualServersExpanded, setMutualServersExpanded] = useState(false);
  const [mutualFriendsExpanded, setMutualFriendsExpanded] = useState(false);

  const searchInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Update default tab and profileUserId for detail panel on channel/DM switch
  useEffect(() => {
    if (activeTab === 'servers') {
      setActiveSidebarTab('members');
      setSidebarView('details'); // Reset to details for servers
      const otherMembers = activeServer?.members?.filter(m => m.id !== 'user_me' && m.id !== userId) || [];
      if (otherMembers.length > 0) {
        setProfileUserId(otherMembers[0].id);
      } else {
        setProfileUserId(null);
      }
    } else if (activeTab === 'bubbles') {
      setActiveSidebarTab('info');
      setSidebarView('details');
      setProfileUserId(null);
    } else {
      setActiveSidebarTab('media');
      if (activeChannel?.isReal) {
        setProfileUserId(partnerId);
      } else if (activeChannel) {
        const otherMember = activeChannel.members?.find(m => m.id !== 'user_me');
        if (otherMember) {
          setProfileUserId(otherMember.id);
        } else {
          setProfileUserId(activeChannel.id);
        }
      }
    }
  }, [selectedServerId, selectedChannelId, selectedDmId, selectedBubbleId, activeTab, partnerId, userId]);

  useEffect(() => {
    if (showServerSettingsModal && activeServer) {
      setEditServerName(activeServer.name);
      setEditServerIcon(activeServer.icon);
    }
  }, [showServerSettingsModal, activeServer?.id]);

  // Reset collapse states when profileUserId changes
  useEffect(() => {
    setMutualServersExpanded(false);
    setMutualFriendsExpanded(false);
  }, [profileUserId]);

  // Increment simulated arcade game time when viewing profileUserId
  useEffect(() => {
    const start = Date.now() - 522000; // start ~8m 42s ago
    const interval = setInterval(() => {
      const diff = Date.now() - start;
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setSessionTime(
        `${hrs > 0 ? hrs + ':' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [profileUserId]);

  const getGameDetails = (activity) => {
    if (!activity) return null;
    const lower = activity.toLowerCase();
    if (lower.includes('ludo')) {
      return { id: 'ludo', name: 'Ludo', icon: '🎲', detail: '2-4 Players • Turn-based' };
    }
    if (lower.includes('tic-tac-toe') || lower.includes('tictactoe')) {
      return { id: 'tictactoe', name: 'Tic-Tac-Toe', icon: '❌', detail: '2 Players • Turn-based' };
    }
    if (lower.includes('sudoku')) {
      return { id: 'sudoku', name: 'Sudoku', icon: '🔢', detail: '1 Player • Solo/Co-op' };
    }
    if (lower.includes('wordle') || lower.includes('retro word')) {
      return { id: 'wordle', name: 'Wordle', icon: '📝', detail: '1-2 Players • Challenge' };
    }
    if (lower.includes('chess')) {
      return { id: 'chess', name: 'Chess', icon: '♟️', detail: '2 Players • Turn-based' };
    }
    if (lower.includes('pictionary') || lower.includes('drawing')) {
      return { id: 'pictionary', name: 'Pictionary', icon: '🎨', detail: '2+ Players • Drawing' };
    }
    return null;
  };

  const getMemberProfile = (id) => {
    if (!id) return null;
    
    // 1. Check if it's the partner and we are in DM
    if (id === partnerId && activeTab === 'dms') {
      return {
        id,
        name: partnerNickname,
        username: partnerProfile.username || partnerNickname.toLowerCase().replace(/\s+/g, ''),
        pfp: partnerProfile.pfp || getRetroPfpUrl(partnerNickname),
        bio: partnerProfile.bio || 'Yard enthusiast and member.',
        banner: partnerProfile.banner || 'bg-primary-banner',
        activity: partnerProfile.activity || '',
        tag: partnerProfile.tag || (activeChannel?.id === DM_RETRO_BOT_ID ? 'APP' : ''),
        status: partnerStatusData?.status || 'offline',
        statusLabel: partnerStatusLabel || 'offline',
        memberSince: partnerProfile.member_since || '14 Feb 2021'
      };
    }
    
    // 2. Check roomProfiles
    if (roomProfiles[id]) {
      const p = roomProfiles[id];
      return {
        id,
        name: p.name || 'User',
        username: p.username || (p.name || 'user').toLowerCase().replace(/\s+/g, ''),
        pfp: p.pfp || getRetroPfpUrl(p.name || 'User'),
        bio: p.bio || 'Yard enthusiast and member.',
        banner: p.banner || 'bg-primary-banner',
        activity: p.activity || '',
        tag: p.tag || '',
        status: p.status || 'offline',
        statusLabel: p.statusLabel || 'offline',
        memberSince: p.member_since || '17 Dec 2021'
      };
    }

    // 3. Check server members
    const serverMember = activeServer?.members?.find(m => m.id === id);
    if (serverMember) {
      return {
        id,
        name: serverMember.name,
        username: serverMember.id === 'user_me' ? 'you' : serverMember.name.toLowerCase().replace(/\s+/g, ''),
        pfp: getRetroPfpUrl(serverMember.name),
        bio: serverMember.bio || `${serverMember.name} is a member of ${activeServer.name}.`,
        banner: serverMember.banner || 'bg-primary-banner',
        activity: serverMember.status || '',
        tag: serverMember.tag || '',
        status: serverMember.isOnline ? 'active' : 'offline',
        statusLabel: serverMember.isOnline ? 'online' : 'offline',
        memberSince: '14 Feb 2021'
      };
    }

    // 4. Check DM bots / fallbacks
    const botId = id;
    let botProfile = {
      id: botId,
      name: botId,
      username: botId.toLowerCase().replace(/\s+/g, ''),
      pfp: getRetroPfpUrl(botId),
      banner: 'bg-primary-banner',
      status: 'active',
      statusLabel: 'online',
      activity: '',
      bio: 'Yard Assistant Bot',
      memberSince: '01 Jan 2026'
    };

    if (botId.includes('yardbot')) {
      botProfile.name = 'YardBot';
      botProfile.bio = 'I index feed posts, report status updates, and keep the Yard running smoothly. Beep boop!';
      botProfile.activity = 'indexing feed posts...';
      botProfile.tag = 'APP';
    } else if (botId.includes('crayoncat')) {
      botProfile.name = 'CrayonCat';
      botProfile.bio = 'Napping near the fireplace. I like fish, warm blankets, and playing wordle.';
      botProfile.activity = 'napping near fireplace 💤';
      botProfile.status = 'idle';
      botProfile.statusLabel = 'idle';
    } else if (botId.includes('retrogamer')) {
      botProfile.name = 'RetroGamer';
      botProfile.bio = 'Yard\'s resident high score champion. Challenge me in any arcade game!';
      botProfile.activity = 'playing wordle race 🏆';
    } else if (botId.includes('lofidj')) {
      botProfile.name = 'LofiDJ';
      botProfile.bio = 'Curating the best beats for study and work.';
      botProfile.activity = 'spinning retro tracks 🎧';
    } else if (botId.includes('pixelpet')) {
      botProfile.name = 'PixelPet';
      botProfile.bio = 'Feed me fish and I will be happy!';
      botProfile.activity = 'playing in the yard 🐾';
    } else if (botId.includes('spacewanderer')) {
      botProfile.name = 'SpaceWanderer';
      botProfile.bio = 'Lost in the retro galaxy.';
      botProfile.activity = 'stargazing in orbit 🌌';
    } else {
      return null;
    }
    return botProfile;
  };

  const handleJoinGameFromProfile = (gameId) => {
    playAudio('click', effectiveSfxEnabled);
    addToast(`Joining ${gameId} session...`, 'success');
    setLobbyState(prev => {
      const newPlayers = Array.from(new Set([...(prev?.players || []), userId]));
      return {
        ...prev,
        players: newPlayers,
        gameId: gameId,
        status: newPlayers.length >= 2 ? 'ready' : 'waiting'
      };
    });
    navigate(`/arcade/${gameId}/lobby`, { state: { autoJoin: true } });
  };

  const handleSpectateGameFromProfile = (gameId) => {
    playAudio('click', effectiveSfxEnabled);
    addToast(`Spectating ${gameId} session...`, 'success');
    navigate(`/arcade/${gameId}/play`);
  };

  // Draft persistence hook key mapping
  const draftKey = activeChannel?.id === DM_PARTNER_ID 
    ? `yard_chat_draft_${userId}` 
    : `yard_chat_draft_${userId}_${activeChannel?.id}`;

  const [input, setInput] = useState(() => {
    try {
      const draft = localStorage.getItem(draftKey);
      return draft ? markdownToHtml(draft) : '';
    } catch (e) {
      return '';
    }
  });

  // Re-load draft when channel changes
  useEffect(() => {
    try {
      const draft = localStorage.getItem(draftKey);
      const html = draft ? markdownToHtml(draft) : '';
      setInput(html);
      if (textareaRef.current) {
        textareaRef.current.innerHTML = html;
        textareaRef.current.style.height = 'auto';
      }
    } catch (_) {
      setInput('');
      if (textareaRef.current) textareaRef.current.innerHTML = '';
    }
  }, [selectedServerId, selectedChannelId, selectedDmId, activeTab, draftKey]);

  useEffect(() => {
    if (input) {
      localStorage.setItem(draftKey, htmlToMarkdown(input));
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [input, draftKey]);

  // Text formatting selection listener
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed && textareaRef.current?.contains(sel.anchorNode)) {
        setShowFormatting(true);
      } else {
        setShowFormatting(false);
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // Formatting Toolbar command executor
  const applyFormatting = (command) => {
    document.execCommand(command, false, null);
    if (textareaRef.current) {
      textareaRef.current.focus();
      setInput(textareaRef.current.innerHTML);
    }
  };

  // Voice recording & Typing hooks
  const {
    isRecording, recordingTime, voicePreview, voicePreviewUrl, voiceBase64,
    mediaRecorderRef, audioChunksRef, voiceExtensionRef,
    startRecording, stopRecording, discardVoiceNote, recordingStartTimeRef
  } = useVoiceRecorder();

  const { isTypingLocal, isPartnerTyping, handleTyping, stopTyping } = useTypingIndicator(userId, partnerId);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [lobbyState, setLobbyState] = useGlobalSync('arcade_lobby', { players: [], gameId: null, status: 'idle', config: null });

  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [activeOptions, setActiveOptions] = useState(null);
  const [viewLimit, setViewLimit] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState({ byMe: false, byPartner: false, hasMedia: false });
  const [searchResults, setSearchResults] = useState([]);
  const [searchPage, setSearchPage] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isHistoricalView, setIsHistoricalView] = useState(false);
  const [viewerContext, setViewerContext] = useState({ items: [], index: 0, isOpen: false });
  const [pendingFiles, setPendingFiles] = useState([]);
  const [editingFileIndex, setEditingFileIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isWatchWinderOpen, setIsWatchWinderOpen] = useState(false);
  const [watchWinderInitialDate, setWatchWinderInitialDate] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const readMsgIdsRef = useRef(new Set());
  const [deleteTargetMessage, setDeleteTargetMessage] = useState(null);
  const [deletedForMeIds, setDeletedForMeIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`deleted_for_me_${roomId}`) || '[]');
    } catch {
      return [];
    }
  });

  const handleDeleteForMe = (msgId) => {
    const nextList = [...deletedForMeIds, msgId];
    setDeletedForMeIds(nextList);
    localStorage.setItem(`deleted_for_me_${roomId}`, JSON.stringify(nextList));
  };

  const [isWindowFocused, setIsWindowFocused] = useState(document.hasFocus());
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Trigger bot replies when messaging mock bots in the database-mapped view
  const triggerDbBotReply = async (channelId, botName, userText) => {
    setMockTypingSenders(prev => ({ ...prev, [channelId]: true }));
    
    addTimer(async () => {
      setMockTypingSenders(prev => ({ ...prev, [channelId]: false }));
      
      let replyText = '';
      if (botName === 'RetroBot') {
        const cleanText = userText.trim().toLowerCase();
        if (cleanText === '/help') {
          replyText = 'Beep boop! Here is what I can do:\n- `/help`: Show this info\n- `/games`: List popular arcade games\n- `/time`: Get current system clock\n- `/ping`: Check bot latency';
        } else if (cleanText === '/games') {
          replyText = '🤖 Play these fun retro games in our Arcade cabinet:\n1. 🟥 Tetris\n2. 🎱 8-Ball Pool\n3. 👾 Pixel Art Editor';
        } else if (cleanText === '/time') {
          replyText = `⏰ Current System Time: ${new Date().toLocaleTimeString()}`;
        } else if (cleanText === '/ping') {
          replyText = '🏓 Pong! (latency: 42ms)';
        } else {
          replyText = `beep boop! I received your message: "${userText}". I am your friendly Yard companion! Type \`/help\` to see commands. 🤖`;
        }
      } else { // Alice
        const replies = [
          "Oh nice! I like that.",
          "Check out this cool new theme I am designing!",
          "Haha that's hilarious 😂",
          "I am currently coding in my yard... catch you in a bit!",
          "Wow, really? Tell me more!"
        ];
        replyText = replies[Math.floor(Math.random() * replies.length)];
      }

      const newMsg = {
        id: `demo-${Date.now()}-${Math.random()}`,
        sender: botName === 'RetroBot' ? 'user_retro_bot' : 'user_alice',
        type: 'text',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        created_at: new Date().toISOString(),
        reactions: [],
        isPinned: false,
        isDeleted: false
      };

      setDemoMessages(prev => {
        const next = {
          ...prev,
          [channelId]: [...(prev[channelId] || []), newMsg]
        };
        localStorage.setItem('yard_demo_messages', JSON.stringify(next));
        return next;
      });
      playAudio('receive', effectiveSfxEnabled);
    }, 1500);
  };

  // Fetch messages and subscribe to updates for database chats
  useEffect(() => {
    if (!activeChannel) {
      setDbMessages([]);
      return;
    }
    
    // Bots and E2EE are handled differently
    if (activeChannel.id === DM_PARTNER_ID || MOCK_BOT_IDS.includes(activeChannel.id)) {
      setDbMessages([]);
      return;
    }

    let isMounted = true;
    setDbMessagesLoading(true);

    const activeId = activeChannel.id;
    let dbTableName = '';
    let filterCol = '';
    
    if (activeTab === 'servers') {
      dbTableName = 'yard_messages';
      filterCol = 'channel_id';
    } else if (activeTab === 'bubbles') {
      dbTableName = 'yard_bubble_messages';
      filterCol = 'bubble_id';
    } else {
      dbTableName = 'yard_dm_messages';
      filterCol = 'channel_id';
    }

    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from(dbTableName)
          .select('*')
          .eq(filterCol, activeId)
          .order('created_at', { ascending: true })
          .limit(100);

        if (error) throw error;

        if (isMounted) {
          const mappedMsgs = data.map(m => ({
            id: m.id,
            sender: m.sender_id || m.user_id,
            text: m.content,
            url: m.attachment_url,
            created_at: m.created_at,
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            reactions: [],
            isDeleted: false
          }));
          setDbMessages(mappedMsgs);
        }
      } catch (err) {
        console.error('[MESSAGES] Fetch error:', err);
      } finally {
        if (isMounted) setDbMessagesLoading(false);
      }
    };

    loadMessages();

    // Subscribe to realtime database updates
    const channelName = `realtime_${dbTableName}_${activeId}`;
    const realtimeChannel = supabase.channel(channelName);
    realtimeChannel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: dbTableName,
        filter: `${filterCol}=eq.${activeId}`
      }, async (payload) => {
        if (!isMounted) return;
        
        if (payload.eventType === 'INSERT') {
          const m = payload.new;
          const mapped = {
            id: m.id,
            sender: m.sender_id || m.user_id,
            text: m.content,
            url: m.attachment_url,
            created_at: m.created_at,
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            reactions: [],
            isDeleted: false
          };
          setDbMessages(prev => {
            if (prev.some(x => x.id === mapped.id)) return prev;
            return [...prev, mapped];
          });
          playAudio('receive', effectiveSfxEnabled);
        } else if (payload.eventType === 'UPDATE') {
          const m = payload.new;
          setDbMessages(prev => prev.map(x => x.id === m.id ? {
            ...x,
            text: m.content,
            url: m.attachment_url
          } : x));
        } else if (payload.eventType === 'DELETE') {
          setDbMessages(prev => prev.filter(x => x.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(realtimeChannel);
    };
  }, [activeChannel, activeTab, effectiveSfxEnabled]);

  // Active message feed calculation based on selected channel
  const rawHistory = activeChannel?.id === DM_PARTNER_ID
    ? (Array.isArray(chatHistory) ? chatHistory : [])
    : (MOCK_BOT_IDS.includes(activeChannel?.id)
      ? (demoMessages[activeChannel?.id] || [])
      : dbMessages);

  const safeHistory = rawHistory.filter(m => !deletedForMeIds.includes(m.id));

  // Auto-scroll on channel switches
  useEffect(() => {
    setViewLimit(50);
    setInitialScrollDone(false);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 100);
  }, [selectedServerId, selectedChannelId, selectedDmId, activeTab]);

  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Keyboard shortcut focus
  useEffect(() => {
    if (replyingTo || editingMsgId) {
      const focusTextarea = () => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      };
      focusTextarea();
      const t1 = setTimeout(focusTextarea, 50);
      const t2 = setTimeout(focusTextarea, 150);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [replyingTo, editingMsgId, activeOptions]);

  const longPressTimers = useRef({});
  const handleTouchStart = (msgId) => {
    if (longPressTimers.current[msgId]) {
      clearTimeout(longPressTimers.current[msgId]);
    }
    longPressTimers.current[msgId] = setTimeout(() => {
      playAudio('click', effectiveSfxEnabled);
      setActiveOptions(msgId);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  };

  const handleTouchEnd = (msgId) => {
    if (longPressTimers.current[msgId]) {
      clearTimeout(longPressTimers.current[msgId]);
      delete longPressTimers.current[msgId];
    }
  };

  const handleInputChange = (e) => {
    setInput(e.currentTarget.innerHTML);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
    if (activeChannel?.id === 'dm_partner') {
      handleTyping();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
      return;
    }

    if (e.key === 'ArrowUp' && !input && !editingMsgId) {
      const myMsgs = safeHistory.filter(m => (m.sender === userId || m.sender === 'user_me') && m.type === 'text' && !m.isDeleted);
      if (myMsgs.length > 0) {
        const last = myMsgs[myMsgs.length - 1];
        setEditingMsgId(last.id);
        const html = markdownToHtml(last.text);
        setInput(html);
        if (textareaRef.current) {
          textareaRef.current.innerHTML = html;
        }
        e.preventDefault();
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(textareaRef.current);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }, 50);
      }
    }
    if (e.key === 'Escape') {
      setEditingMsgId(null);
      setInput('');
      setReplyingTo(null);
      if (textareaRef.current) {
        textareaRef.current.innerHTML = '';
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  // Safe Mark-as-Read for Partner
  useEffect(() => {
    if (activeChannel?.id !== DM_PARTNER_ID || !Array.isArray(chatHistory) || !isWindowFocused) return;
    if (!isNearBottom) return;

    const unreadFromPartner = chatHistory.filter(m =>
      m.sender === partnerId &&
      m.sender !== userId &&
      m.status !== 'read' &&
      !readMsgIdsRef.current.has(m.id) &&
      !String(m.id).startsWith('temp-')
    );

    if (unreadFromPartner.length > 0) {
      if (isNormalized && syncUpdateMessage) {
        const idsToUpdate = unreadFromPartner.map(m => {
          readMsgIdsRef.current.add(m.id);
          return m.id;
        });
        syncUpdateMessage(idsToUpdate, { status: 'read', readAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
      }
    }
  }, [chatHistory, partnerId, isNormalized, syncUpdateMessage, isWindowFocused, isNearBottom, activeChannel?.id]);

  // Search filter
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        if (activeChannel?.id === DM_PARTNER_ID) {
          const { data, hasMore } = await searchMessages(searchQuery, searchPage, 10, searchFilters);
          setSearchResults(data);
          setSearchHasMore(hasMore);
        } else if (MOCK_BOT_IDS.includes(activeChannel?.id)) {
          const allMsgs = demoMessages[activeChannel?.id] || [];
          let filtered = allMsgs.filter(m => !m.isDeleted && m.text && m.text.toLowerCase().includes(searchQuery.toLowerCase()));
          if (searchFilters.byMe) {
            filtered = filtered.filter(m => m.sender === 'user_me' || m.sender === userId);
          }
          if (searchFilters.byPartner) {
            filtered = filtered.filter(m => m.sender !== 'user_me' && m.sender !== userId);
          }
          const start = searchPage * 10;
          setSearchResults(filtered.slice(start, start + 10));
          setSearchHasMore(filtered.length > start + 10);
        } else {
          try {
            const dbTableName = activeTab === 'servers' ? 'yard_messages' : (activeTab === 'bubbles' ? 'yard_bubble_messages' : 'yard_dm_messages');
            const filterCol = activeTab === 'servers' ? 'channel_id' : (activeTab === 'bubbles' ? 'bubble_id' : 'channel_id');
            const { data } = await supabase
              .from(dbTableName)
              .select('*')
              .eq(filterCol, activeChannel.id)
              .ilike('content', `%${searchQuery}%`)
              .limit(10);
            
            if (data) {
              setSearchResults(data.map(m => ({
                id: m.id,
                sender: m.sender_id || m.user_id,
                text: m.content,
                created_at: m.created_at,
                time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              })));
            }
          } catch (err) {
            console.error('Search error:', err);
          }
          setSearchHasMore(false);
        }
        setIsSearching(false);
      } else {
        setSearchResults([]);
        setSearchHasMore(false);
        setSearchPage(0);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, searchPage, searchFilters, searchMessages, activeChannel, demoMessages, activeTab]);

  const handleJumpToMessage = async (msgId, createdAt) => {
    if (activeChannel?.id === 'dm_partner') {
      const loadedMsgs = await jumpToMessage(createdAt);
      setIsHistoricalView(true);
      
      let targetMsgId = msgId;
      if (!targetMsgId && createdAt && loadedMsgs && loadedMsgs.length > 0) {
        const targetTime = new Date(createdAt).getTime();
        let closest = loadedMsgs[0];
        let minDiff = Math.abs(new Date(closest.created_at).getTime() - targetTime);
        for (const m of loadedMsgs) {
          const diff = Math.abs(new Date(m.created_at).getTime() - targetTime);
          if (diff < minDiff) {
            minDiff = diff;
            closest = m;
          }
        }
        targetMsgId = closest.id;
      }

      if (targetMsgId) {
        setHighlightedMessageId(targetMsgId);
      }
      setTimeout(() => {
        if (targetMsgId) {
          const el = document.getElementById(`msg-${targetMsgId}`);
          el?.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
        setTimeout(() => setHighlightedMessageId(null), 3000);
      }, 200);
    } else {
      if (msgId) {
        setHighlightedMessageId(msgId);
        setTimeout(() => {
          const el = document.getElementById(`msg-${msgId}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => setHighlightedMessageId(null), 3000);
        }, 100);
      }
    }
  };

  const handleJumpToPresent = async () => {
    if (activeChannel?.id === 'dm_partner') {
      await resetToLatest();
    }
    setIsHistoricalView(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleChatScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 100 && isHistoricalView) {
      loadNewer();
    }

    if (scrollTop < 50 && syncHasMore && activeChannel?.id === DM_PARTNER_ID) {
      syncLoadMore();
      setViewLimit(p => p + 50);
    }

    const nearBottom = scrollHeight - scrollTop - clientHeight < 150;
    setIsNearBottom(nearBottom);

    if (isWatchWinderOpen) {
      const container = e.target;
      const containerRect = container.getBoundingClientRect();
      const targetY = containerRect.top + containerRect.height / 2;

      let closestMsg = null;
      let closestDiff = Infinity;

      const msgElements = container.querySelectorAll('[id^="msg-"]');
      for (const el of msgElements) {
        const rect = el.getBoundingClientRect();
        const msgCenterY = rect.top + rect.height / 2;
        const diff = Math.abs(msgCenterY - targetY);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestMsg = el;
        }
      }

      if (closestMsg) {
        const msgId = closestMsg.id.replace('msg-', '');
        const msgObj = safeHistory.find(m => String(m.id) === msgId);
        if (msgObj && msgObj.created_at) {
          const newDateStr = msgObj.created_at;
          const newDate = new Date(newDateStr);
          setWatchWinderInitialDate(prev => {
            if (!prev) return newDateStr;
            const prevDate = new Date(prev);
            if (prevDate.toDateString() !== newDate.toDateString()) {
              return newDateStr;
            }
            return prev;
          });
        }
      }
    }
  };

  const lastMessageId = safeHistory[safeHistory.length - 1]?.id;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, []);

  useEffect(() => {
    if (lastMessageId && !isHistoricalView) {
      if (!initialScrollDone) {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        setInitialScrollDone(true);
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [lastMessageId, isHistoricalView, initialScrollDone]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (activeOptions && !e.target.closest('.message-options-menu') && !e.target.closest('.options-trigger')) {
        setActiveOptions(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeOptions]);

  const handlePinChange = async (e) => {
    if (e) e.preventDefault();
    setPinChangeError('');
    if (newPin.length < 6) {
      setPinChangeError('PIN must be at least 6 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinChangeError('PINs do not match.');
      return;
    }
    setIsChangingPin(true);
    playAudio('click', effectiveSfxEnabled);
    try {
      const success = await changePin(newPin);
      if (success) {
        setNewPin('');
        setConfirmPin('');
      }
    } catch (err) {
      setPinChangeError('Failed to change PIN.');
    } finally {
      setIsChangingPin(false);
    }
  };

  const handleStartCall = (type) => {
    playAudio('click', effectiveSfxEnabled);
    if (activeChannel?.isReal) {
      startCall(type);
      syncSendMessage(`${type === 'video' ? 'Video' : 'Voice'} Call`, 'call_invite', { status: 'ringing', callType: type });
    } else {
      sendDemoMessage(`${type === 'video' ? 'Video' : 'Voice'} Call`, 'call_invite', { status: 'ringing', callType: type });
      addToast("Mock call initiated!", "success");
    }
  };

  const handleJoinGame = (inviteMsg) => {
    playAudio('click', effectiveSfxEnabled);
    setLobbyState(prev => {
      const newPlayers = Array.from(new Set([...(prev?.players || []), userId]));
      return {
        ...prev,
        players: newPlayers,
        gameId: inviteMsg.gameId || prev.gameId,
        status: newPlayers.length >= 2 ? 'ready' : 'waiting'
      };
    });
    navigate(`/arcade/${inviteMsg.gameId}/lobby`, { state: { autoJoin: true } });
  };

  /* ═══════════════════════════════════════════════════════
     MULTI-CHANNEL CORE HANDLERS (SEND / EDIT / DELETE)
     ═══════════════════════════════════════════════════════ */

  const handleSend = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isInputDisabled) return;

    if (e && e._isInvite) {
      if (activeChannel?.id === DM_PARTNER_ID) {
        syncSendMessage(e.text, 'game_invite', { gameId: e.gameId, gameTitle: e.gameTitle, inviteStatus: 'pending' });
      } else if (MOCK_BOT_IDS.includes(activeChannel?.id)) {
        sendDemoMessage(e.text, 'game_invite', { gameId: e.gameId, gameTitle: e.gameTitle, inviteStatus: 'pending' });
      } else {
        const dbTableName = activeTab === 'servers' ? 'yard_messages' : (activeTab === 'bubbles' ? 'yard_bubble_messages' : 'yard_dm_messages');
        const insertObj = { content: e.text };
        if (activeTab === 'servers') {
          insertObj.channel_id = activeChannel.id;
          insertObj.user_id = userId;
        } else if (activeTab === 'bubbles') {
          insertObj.bubble_id = activeChannel.id;
          insertObj.sender_id = userId;
        } else {
          insertObj.channel_id = activeChannel.id;
          insertObj.sender_id = userId;
        }
        await supabase.from(dbTableName).insert(insertObj);
      }
      return;
    }

    const markdownInput = htmlToMarkdown(input);
    if (!markdownInput.trim() && pendingFiles.length === 0 && voicePreview === null) return;
    playAudio('send', effectiveSfxEnabled);

    const isE2EE = activeChannel?.id === DM_PARTNER_ID;
    const isMockBot = MOCK_BOT_IDS.includes(activeChannel?.id);

    if (editingMsgId) {
      if (isE2EE) {
        syncUpdateMessage(editingMsgId, { text: markdownInput, isEdited: true });
      } else if (isMockBot) {
        updateDemoMessage(editingMsgId, { text: markdownInput, isEdited: true });
      } else {
        const dbTableName = activeTab === 'servers' ? 'yard_messages' : (activeTab === 'bubbles' ? 'yard_bubble_messages' : 'yard_dm_messages');
        await supabase.from(dbTableName).update({ content: markdownInput }).eq('id', editingMsgId);
      }
      setEditingMsgId(null);
    }
    else if (pendingFiles.length > 0) {
      if (isE2EE) {
        pendingFiles.forEach(item => {
          if (item.type === 'image' && item.data) {
            const blob = base64ToBlob(item.data);
            const file = new File([blob], `image_${Date.now()}.png`, { type: 'image/png' });
            syncSendMessage(file, 'image', { text: markdownInput.trim(), isViewOnce });
          } else {
            syncSendMessage(item.file, item.type, { text: markdownInput.trim(), fileName: item.name, isViewOnce });
          }
        });
      } else if (isMockBot) {
        pendingFiles.forEach(item => {
          let url = item.data;
          if (!url && item.file) {
            url = URL.createObjectURL(item.file);
          }
          sendDemoMessage(url, item.type, {
            text: markdownInput.trim(),
            fileName: item.name,
            fileSize: item.file?.size,
            isViewOnce
          });
        });
      } else {
        const dbTableName = activeTab === 'servers' ? 'yard_messages' : (activeTab === 'bubbles' ? 'yard_bubble_messages' : 'yard_dm_messages');
        for (const item of pendingFiles) {
          let attachmentUrl = item.data;
          if (item.file) {
            try {
              const fileExt = item.name.split('.').pop() || 'png';
              const fileName = `${roomId || 'public'}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
              const { data: storageData } = await supabase.storage.from('scrapbook').upload(fileName, item.file);
              if (storageData) {
                const { data: urlData } = supabase.storage.from('scrapbook').getPublicUrl(fileName);
                attachmentUrl = urlData?.publicUrl || '';
              }
            } catch (err) {
              console.error('[STORAGE] Upload failed:', err);
            }
          }
          const insertObj = {
            content: markdownInput.trim() || item.name,
            attachment_url: attachmentUrl
          };
          if (activeTab === 'servers') {
            insertObj.channel_id = activeChannel.id;
            insertObj.user_id = userId;
          } else if (activeTab === 'bubbles') {
            insertObj.bubble_id = activeChannel.id;
            insertObj.sender_id = userId;
          } else {
            insertObj.channel_id = activeChannel.id;
            insertObj.sender_id = userId;
          }
          await supabase.from(dbTableName).insert(insertObj);
        }
      }
      setPendingFiles([]);
      setIsViewOnce(false);
    }
    else {
      if (isE2EE) {
        syncSendMessage(markdownInput, 'text', { replyTo: replyingTo }).catch(err => {
          console.error("Failed to send message:", err);
        });
      } else if (isMockBot) {
        sendDemoMessage(markdownInput, 'text', { replyTo: replyingTo });
      } else {
        const dbTableName = activeTab === 'servers' ? 'yard_messages' : (activeTab === 'bubbles' ? 'yard_bubble_messages' : 'yard_dm_messages');
        const insertObj = {
          content: markdownInput
        };
        if (activeTab === 'servers') {
          insertObj.channel_id = activeChannel.id;
          insertObj.user_id = userId;
        } else if (activeTab === 'bubbles') {
          insertObj.bubble_id = activeChannel.id;
          insertObj.sender_id = userId;
        } else {
          insertObj.channel_id = activeChannel.id;
          insertObj.sender_id = userId;
        }
        const { error } = await supabase.from(dbTableName).insert(insertObj);
        if (error) console.error("Database insert error:", error);
      }
    }

    setInput(''); setReplyingTo(null); setActiveOptions(null); setShowEmojiPicker(false);
    if (textareaRef.current) {
      textareaRef.current.innerHTML = '';
      textareaRef.current.style.height = 'auto';
    }
    if (isHistoricalView) {
      handleJumpToPresent();
    }
    if (activeChannel?.id === DM_PARTNER_ID) {
      stopTyping();
    }
  };

  const sendDemoMessage = (text, type = 'text', meta = {}) => {
    const activeId = activeChannel.id;
    const newMsg = {
      id: `demo-${Date.now()}-${Math.random()}`,
      sender: 'user_me',
      type,
      text: type === 'text' ? text : (meta.text || ''),
      url: type !== 'text' ? text : null,
      audioUrl: type === 'voice' ? text : null,
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      duration: meta.duration,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      created_at: new Date().toISOString(),
      reactions: [],
      isPinned: false,
      isDeleted: false,
      metadata: meta
    };

    if (replyingTo) {
      newMsg.replyTo = {
        id: replyingTo.id,
        sender: replyingTo.sender,
        text: replyingTo.text
      };
    }

    setDemoMessages(prev => {
      const next = {
        ...prev,
        [activeId]: [...(prev[activeId] || []), newMsg]
      };
      localStorage.setItem('yard_demo_messages', JSON.stringify(next));
      return next;
    });

    if (activeId === DM_RETRO_BOT_ID) {
      triggerRetroBotReply(text);
    } else if (activeId === DM_ALICE_ID) {
      triggerAliceReply(text);
    } else if (activeId === DM_CRAYON_CAT_ID) {
      triggerCrayonCatReply(text);
    } else if (activeId === DM_RETRO_GAMER_ID) {
      triggerRetroGamerReply(text);
    } else if (activeId === DM_LOFI_DJ_ID) {
      triggerLofiDJReply(text);
    } else if (activeId === DM_PIXEL_PET_ID) {
      triggerPixelPetReply(text);
    } else if (activeId === DM_SPACE_WANDERER_ID) {
      triggerSpaceWandererReply(text);
    } else if (activeServer && activeChannel.id === 'general') {
      triggerServerReply(activeServer.id, text);
    }
  };

  const updateDemoMessage = (msgId, fields) => {
    const activeId = activeChannel.id;
    setDemoMessages(prev => {
      const list = prev[activeId] || [];
      const nextList = list.map(m => m.id === msgId ? { ...m, ...fields } : m);
      const next = { ...prev, [activeId]: nextList };
      localStorage.setItem('yard_demo_messages', JSON.stringify(next));
      return next;
    });
  };

  const deleteDemoMessage = (msgId) => {
    const activeId = activeChannel.id;
    setDemoMessages(prev => {
      const list = prev[activeId] || [];
      const nextList = list.map(m => m.id === msgId 
        ? { 
            ...m, 
            isDeleted: true, 
            text: 'message deleted', 
            metadata: { 
              ...m.metadata, 
              deletedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              wasReadBeforeDelete: true
            } 
          } 
        : m
      );
      const next = { ...prev, [activeId]: nextList };
      localStorage.setItem('yard_demo_messages', JSON.stringify(next));
      return next;
    });
  };

  const clearDemoChat = () => {
    const activeId = activeChannel.id;
    setDemoMessages(prev => {
      const next = { ...prev, [activeId]: [] };
      localStorage.setItem('yard_demo_messages', JSON.stringify(next));
      return next;
    });
  };

  /* ═══════════════════════════════════════════════════════
     ASYNC SIMULATED REPLIES
     ═══════════════════════════════════════════════════════ */

  const triggerRetroBotReply = (userText) => {
    setMockTypingSenders(prev => ({ ...prev, [DM_RETRO_BOT_ID]: true }));
    addTimer(() => {
      setMockTypingSenders(prev => ({ ...prev, [DM_RETRO_BOT_ID]: false }));
      let text = '';
      const cleanText = userText.trim().toLowerCase();
      if (cleanText === '/help') {
        text = 'Beep boop! Here is what I can do:\n- `/help`: Show this info\n- `/games`: List popular arcade games\n- `/time`: Get current system clock\n- `/ping`: Check bot latency';
      } else if (cleanText === '/games') {
        text = '🤖 Play these fun retro games in our Arcade cabinet:\n1. 🟥 Tetris\n2. 🎱 8-Ball Pool\n3. 👾 Pixel Art Editor';
      } else if (cleanText === '/time') {
        text = `⏰ Current System Time: ${new Date().toLocaleTimeString()}`;
      } else if (cleanText === '/ping') {
        text = '🏓 Pong! (latency: 42ms)';
      } else {
        text = `beep boop! I received your message: "${userText}". I am your friendly Yard companion! Type \`/help\` to see commands. 🤖`;
      }
      sendDemoMessageResponse(DM_RETRO_BOT_ID, 'user_retro_bot', text);
    }, 1200);
  };

  const triggerAliceReply = (userText) => {
    setMockTypingSenders(prev => ({ ...prev, [DM_ALICE_ID]: true }));
    addTimer(() => {
      setMockTypingSenders(prev => ({ ...prev, [DM_ALICE_ID]: false }));
      const replies = [
        "Oh nice! I like that.",
        "Check out this cool new theme I am designing!",
        "Haha that's hilarious 😂",
        "I am currently coding in my yard... catch you in a bit!",
        "Wow, really? Tell me more!"
      ];
      const text = replies[Math.floor(Math.random() * replies.length)];
      sendDemoMessageResponse(DM_ALICE_ID, 'user_alice', text);
    }, 1800);
  };

  const triggerCrayonCatReply = (userText) => {
    setMockTypingSenders(prev => ({ ...prev, [DM_CRAYON_CAT_ID]: true }));
    addTimer(() => {
      setMockTypingSenders(prev => ({ ...prev, [DM_CRAYON_CAT_ID]: false }));
      const replies = [
        "meow... I was napping. Did you bring fish? 🐟",
        "purr... let me finish my wordle race first.",
        "meow! that sounds fun.",
        "sleeping is my main game. but I'm listening!"
      ];
      const text = replies[Math.floor(Math.random() * replies.length)];
      sendDemoMessageResponse(DM_CRAYON_CAT_ID, 'crayoncat', text);
    }, 1500);
  };

  const triggerRetroGamerReply = (userText) => {
    setMockTypingSenders(prev => ({ ...prev, [DM_RETRO_GAMER_ID]: true }));
    addTimer(() => {
      setMockTypingSenders(prev => ({ ...prev, [DM_RETRO_GAMER_ID]: false }));
      const replies = [
        "High score is waiting! Challenge me in Arcade!",
        "Nice play! I'm currently practicing my ludo speedrun.",
        "Game on! Let's beat the highest score in Tetris.",
        "GG! You play well."
      ];
      const text = replies[Math.floor(Math.random() * replies.length)];
      sendDemoMessageResponse(DM_RETRO_GAMER_ID, 'retrogamer', text);
    }, 1500);
  };

  const triggerLofiDJReply = (userText) => {
    setMockTypingSenders(prev => ({ ...prev, [DM_LOFI_DJ_ID]: true }));
    addTimer(() => {
      setMockTypingSenders(prev => ({ ...prev, [DM_LOFI_DJ_ID]: false }));
      const replies = [
        "Spinning some fresh retro tracks right now. 🎧",
        "Keep the vibes chill. Have you listened to the new synth wave mix?",
        "Drop the beat! Let me know if you want a track recommendation.",
        "Curating beats for your study session."
      ];
      const text = replies[Math.floor(Math.random() * replies.length)];
      sendDemoMessageResponse(DM_LOFI_DJ_ID, 'lofidj', text);
    }, 1500);
  };

  const triggerPixelPetReply = (userText) => {
    setMockTypingSenders(prev => ({ ...prev, [DM_PIXEL_PET_ID]: true }));
    addTimer(() => {
      setMockTypingSenders(prev => ({ ...prev, [DM_PIXEL_PET_ID]: false }));
      const replies = [
        "woof woof! I am playing in the yard. 🐾",
        "scratch my ears please!",
        "bark! let's run around!",
        "PixelPet is happy to see you!"
      ];
      const text = replies[Math.floor(Math.random() * replies.length)];
      sendDemoMessageResponse(DM_PIXEL_PET_ID, 'pixelpet', text);
    }, 1500);
  };

  const triggerSpaceWandererReply = (userText) => {
    setMockTypingSenders(prev => ({ ...prev, [DM_SPACE_WANDERER_ID]: true }));
    addTimer(() => {
      setMockTypingSenders(prev => ({ ...prev, [DM_SPACE_WANDERER_ID]: false }));
      const replies = [
        "Stargazing from orbit... the retro galaxy is beautiful tonight. 🌌",
        "Greetings from space! I am searching for lost retro signals.",
        "Lost in orbit, but I still get your messages!",
        "Cruising at warp speed."
      ];
      const text = replies[Math.floor(Math.random() * replies.length)];
      sendDemoMessageResponse(DM_SPACE_WANDERER_ID, 'spacewanderer', text);
    }, 1500);
  };

  const triggerServerReply = (serverId, userText) => {
    const activeId = activeChannel.id;
    const targetKey = `${serverId}_${activeId}`;
    setMockTypingSenders(prev => ({ ...prev, [targetKey]: true }));
    addTimer(() => {
      setMockTypingSenders(prev => ({ ...prev, [targetKey]: false }));
      const replies = [
        "That's so cool!",
        "Wait, who is winning the scoreboard today?",
        "Yeah, I agree.",
        "Awesome! 🌳",
        "Let's play some pool later!"
      ];
      const senders = ['user_alice', 'user_bob', 'user_charlie'];
      const randomSender = senders[Math.floor(Math.random() * senders.length)];
      const text = replies[Math.floor(Math.random() * replies.length)];
      sendDemoMessageResponse(activeId, randomSender, text);
    }, 2000);
  };

  const sendDemoMessageResponse = (channelId, senderId, text) => {
    const newMsg = {
      id: `demo-${Date.now()}-${Math.random()}`,
      sender: senderId,
      type: 'text',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      created_at: new Date().toISOString(),
      reactions: [],
      isPinned: false,
      isDeleted: false
    };

    setDemoMessages(prev => {
      const next = {
        ...prev,
        [channelId]: [...(prev[channelId] || []), newMsg]
      };
      localStorage.setItem('yard_demo_messages', JSON.stringify(next));
      return next;
    });
    playAudio('receive', effectiveSfxEnabled);
  };

  /* ═══════════════════════════════════════════════════════
     VOICE / FILE ATTACHMENTS HELPERS
     ═══════════════════════════════════════════════════════ */

  const handleMicDown = (e) => {
    if (e.type === 'mousedown' && e.button !== 0) return;
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  const handleMicUp = () => {
    if (isRecording) {
      const elapsed = Date.now() - (recordingStartTimeRef.current || 0);
      if (elapsed > 500) {
        stopRecording();
      }
    }
  };

  const confirmVoiceNote = async () => {
    if (!voiceBase64 || !voicePreview) return;
    playAudio('send', effectiveSfxEnabled);

    const isE2EE = activeChannel?.id === DM_PARTNER_ID;
    const isMockBot = MOCK_BOT_IDS.includes(activeChannel?.id);

    if (isE2EE) {
      try {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const extension = voiceExtensionRef.current || 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioFile = new File([audioBlob], `voice_${Date.now()}.${extension}`, { type: mimeType });
        await syncSendMessage(audioFile, 'voice', {
          duration: `${Math.floor(voicePreview / 60)}:${(voicePreview % 60).toString().padStart(2, '0')}`,
          replyTo: replyingTo
        });
      } catch (e) {
        alert("Upload Failed: " + e.message);
      }
    } else {
      const durationStr = `${Math.floor(voicePreview / 60)}:${(voicePreview % 60).toString().padStart(2, '0')}`;
      sendDemoMessage(voicePreviewUrl, 'voice', { duration: durationStr });
    }
    setReplyingTo(null);
    discardVoiceNote();
  };

  const getFileType = (file) => {
    const name = file.name.toLowerCase();
    const type = file.type || '';
    if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(name)) {
      return 'image';
    }
    if (type.startsWith('video/') || /\.(mp4|mkv|avi|webm|mov|flv|3gp|wmv)$/.test(name)) {
      return 'video';
    }
    if (type.startsWith('audio/') || /\.(mp3|aac|flac|wav|m4a|ogg)$/.test(name)) {
      return 'audio';
    }
    return 'file';
  };

  const handleFiles = async (files) => {
    if (files.length > 0) {
      for (const file of files) {
        const fileType = getFileType(file);
        if (fileType === 'image') {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const compressed = await compressImage(reader.result);
            setPendingFiles(prev => [...prev, { type: 'image', data: compressed, name: file.name, file }]);
          };
          reader.readAsDataURL(file);
        } else if (fileType === 'video') {
          setPendingFiles(prev => [...prev, { type: 'video', file, name: file.name }]);
        } else if (fileType === 'audio') {
          setPendingFiles(prev => [...prev, { type: 'audio', file, name: file.name }]);
        } else {
          setPendingFiles(prev => [...prev, { type: 'file', file, name: file.name }]);
        }
      }
      playAudio('click', effectiveSfxEnabled);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleSaveEditedFile = (editedFile, dataUrl, meta = {}) => {
    if (editingFileIndex === null) return;
    setPendingFiles(prev => {
      const next = [...prev];
      const item = next[editingFileIndex];
      next[editingFileIndex] = { ...item, file: editedFile, data: dataUrl, metadata: { ...item.metadata, ...meta } };
      return next;
    });
    setEditingFileIndex(null);
    playAudio('click', effectiveSfxEnabled);
  };

  const handleSaveToScrapbook = async (url) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      await uploadAsset(blob, 'scrapbook', userId);
      playAudio('click', effectiveSfxEnabled);
      alert("Saved to Scrapbook successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to save to Scrapbook: " + e.message);
    }
  };

  const isPng = (msg) => {
    const name = (msg.fileName || '').toLowerCase();
    const url = (msg.url || '').toLowerCase();
    return name.endsWith('.png') || url.includes('.png') || url.startsWith('data:image/png');
  };

  const getFileStyle = (fileName) => {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    switch (ext) {
      case 'pdf':
        return { icon: FileText, color: 'text-danger bg-danger/10', label: 'PDF Document' };
      case 'docx':
      case 'doc':
      case 'txt':
        return { icon: FileText, color: 'text-secondary bg-secondary/10', label: 'Word Document' };
      case 'zip':
      case 'rar':
      case '7z':
        return { icon: Paperclip, color: 'text-primary bg-primary/10', label: 'Archive Zip' };
      default:
        return { icon: FileText, color: 'text-main-text opacity-70 bg-black/5', label: 'File Attachment' };
    }
  };

  const onEmojiClick = (emojiData) => { setInput(prev => prev + emojiData.emoji); };

  /* ═══════════════════════════════════════════════════════
     SERVER & CHANNEL MANAGEMENT
     ═══════════════════════════════════════════════════════ */

  const handleGuildIconUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result, 150, 150, 0.6);
          setCreateServerIcon(compressed);
          addToast('Icon uploaded successfully.', 'info');
        } catch (err) {
          addToast('Failed to process image.', 'error');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateServerSubmit = async (e) => {
    e.preventDefault();
    if (!createServerName.trim()) return;

    playAudio('click', effectiveSfxEnabled);
    try {
      const iconUrl = createServerIcon || getRetroPfpUrl(createServerName);
      
      // 1. Insert server
      const { data: newServer, error: serverErr } = await supabase
        .from('yard_servers')
        .insert({
          name: createServerName.trim(),
          description: createServerType === 'guild' ? 'Mini-Guild' : 'Standard Guild',
          icon_url: iconUrl,
          owner_id: userId
        })
        .select()
        .single();

      if (serverErr) throw serverErr;

      // 2. Add owner to server members
      const { error: memberErr } = await supabase
        .from('yard_server_members')
        .insert({
          server_id: newServer.id,
          user_id: userId,
          role: 'owner'
        });

      if (memberErr) throw memberErr;

      // 3. Create default channel
      const { data: newChan, error: chanErr } = await supabase
        .from('yard_channels')
        .insert({
          server_id: newServer.id,
          name: 'general',
          type: 'text',
          category_name: 'General',
          description: 'General server discussions'
        })
        .select()
        .single();

      if (chanErr) throw chanErr;

      setCreateServerName('');
      setCreateServerIcon('');
      setShowCreateServer(false);
      playAudio('success', effectiveSfxEnabled);
      addToast(`${createServerType === 'guild' ? 'Guild' : 'Server'} created!`, 'success');

      // Update state locally
      const mappedNewServer = {
        id: newServer.id,
        name: newServer.name,
        description: newServer.description,
        icon: newServer.icon_url,
        owner_id: newServer.owner_id,
        role: 'owner',
        created_at: newServer.created_at,
        channels: [newChan],
        members: [{
          id: userId,
          name: profile.name || 'You',
          emoji: profile.emoji || '😊',
          isOnline: true,
          role: 'owner'
        }]
      };
      setServers(prev => [...prev, mappedNewServer]);

      // Navigate to new server and channel
      navigate(`/chat/guild/${newServer.id}/${newChan.id}`);

    } catch (err) {
      console.error('[SERVER_CREATE] Error:', err);
      addToast('Failed to create server.', 'error');
    }
  };

  const handleAddMemberToServer = async (memberObj) => {
    try {
      const { error } = await supabase
        .from('yard_server_members')
        .insert({
          server_id: selectedServerId,
          user_id: memberObj.id,
          role: 'member'
        });

      if (error) {
        if (error.code === '23505') { // Duplicate key
          addToast('User is already a member of this server!', 'warn');
          return;
        }
        throw error;
      }

      addToast(`${memberObj.name} added to the server!`, 'success');

      setServers(prev => prev.map(s => {
        if (s.id === selectedServerId) {
          return {
            ...s,
            members: [...s.members, {
              id: memberObj.id,
              name: memberObj.name,
              emoji: memberObj.emoji,
              isOnline: true,
              role: 'member'
            }]
          };
        }
        return s;
      }));
    } catch (err) {
      console.error('[MEMBER_ADD] Error:', err);
      addToast('Failed to add member.', 'error');
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    const cleanChanName = newChannelName.trim().toLowerCase().replace(/\s+/g, '-');
    playAudio('click', effectiveSfxEnabled);
    
    try {
      const { data: newChan, error } = await supabase
        .from('yard_channels')
        .insert({
          server_id: selectedServerId,
          name: cleanChanName,
          type: 'text',
          category_name: 'General',
          description: 'A custom text channel'
        })
        .select()
        .single();

      if (error) throw error;

      addToast(`Channel #${cleanChanName} created!`, 'success');
      setNewChannelName('');
      setIsAddingChannel(false);

      setServers(prev => prev.map(s => {
        if (s.id === selectedServerId) {
          return {
            ...s,
            channels: [...s.channels, newChan]
          };
        }
        return s;
      }));

      navigate(`/chat/guild/${selectedServerId}/${newChan.id}`);
    } catch (err) {
      console.error('[CHANNEL_CREATE] Error:', err);
      addToast('Failed to create channel.', 'error');
    }
  };

  const handleStartDm = async (targetUserId) => {
    try {
      // 1. Check if DM channel already exists between users
      const { data: myChans } = await supabase
        .from('yard_dm_members')
        .select('channel_id')
        .eq('user_id', userId);

      const { data: targetChans } = await supabase
        .from('yard_dm_members')
        .select('channel_id')
        .eq('user_id', targetUserId);

      const myChanIds = myChans?.map(c => c.channel_id) || [];
      const targetChanIds = targetChans?.map(c => c.channel_id) || [];
      
      const commonChanId = myChanIds.find(cid => targetChanIds.includes(cid));

      if (commonChanId) {
        navigate(`/chat/dm/${commonChanId}`);
        setShowStartDmModal(false);
        return;
      }

      // 2. Create new DM channel
      const { data: newChan, error: chanErr } = await supabase
        .from('yard_dm_channels')
        .insert({})
        .select('id')
        .single();

      if (chanErr) throw chanErr;

      // 3. Add members
      const { error: membersErr } = await supabase
        .from('yard_dm_members')
        .insert([
          { channel_id: newChan.id, user_id: userId },
          { channel_id: newChan.id, user_id: targetUserId }
        ]);

      if (membersErr) throw membersErr;

      addToast('Direct message channel established.', 'success');
      setShowStartDmModal(false);
      
      const otherProfile = roomProfiles[targetUserId] || {};
      const newDmObj = {
        id: newChan.id,
        name: otherProfile.name || 'Partner',
        emoji: otherProfile.emoji || '☕',
        isReal: true,
        lastMessage: '',
        timestamp: '',
        unread: 0,
        members: [
          { id: userId, name: profile.name || 'You', emoji: profile.emoji || '👤' },
          { id: targetUserId, name: otherProfile.name || 'User', emoji: otherProfile.emoji || '👤' }
        ]
      };
      setDms(prev => [newDmObj, ...prev]);

      navigate(`/chat/dm/${newChan.id}`);
    } catch (err) {
      console.error('[DM_CREATE] Error:', err);
      addToast('Failed to start DM.', 'error');
    }
  };

  const handleCreateBubbleSubmit = async (e) => {
    e.preventDefault();
    if (selectedBubbleMembers.length === 0) {
      addToast('Please select at least one friend to start a bubble.', 'warn');
      return;
    }

    playAudio('success', effectiveSfxEnabled);
    try {
      // Auto-generate name based on members
      const memberNames = selectedBubbleMembers.map(uid => roomProfiles[uid]?.name || 'User');
      let autoName = memberNames.join(', ');
      if (autoName.length > 40) autoName = autoName.substring(0, 37) + '...';
      const finalName = autoName || 'Group Chat';

      // 1. Create bubble
      const { data: newBubble, error: bubbleErr } = await supabase
        .from('yard_bubbles')
        .insert({
          name: finalName,
          description: '',
          icon_url: 'B',
          owner_id: userId
        })
        .select()
        .single();

      if (bubbleErr) throw bubbleErr;

      // 2. Add members
      const memberInserts = [
        { bubble_id: newBubble.id, user_id: userId },
        ...selectedBubbleMembers.map(uid => ({ bubble_id: newBubble.id, user_id: uid }))
      ];

      const { error: membersErr } = await supabase
        .from('yard_bubble_members')
        .insert(memberInserts);

      if (membersErr) throw membersErr;

      setBubbleName('');
      setBubbleDescription('');
      setSelectedBubbleMembers([]);
      setShowCreateBubbleModal(false);

      addToast(`Bubble "${newBubble.name}" created!`, 'success');

      const membersList = [userId, ...selectedBubbleMembers].map(uid => ({
        id: uid,
        name: roomProfiles[uid]?.name || 'User',
        emoji: roomProfiles[uid]?.emoji || ''
      }));
      
      const newBubbleObj = {
        id: newBubble.id,
        name: newBubble.name,
        description: newBubble.description,
        icon: newBubble.icon_url || 'B',
        owner_id: newBubble.owner_id,
        created_at: newBubble.created_at,
        type: 'bubble',
        members: membersList
      };
      setBubbles(prev => [newBubbleObj, ...prev]);

      navigate(`/chat/bubble/${newBubble.id}`);
    } catch (err) {
      console.error('[BUBBLE_CREATE] Error:', err);
      addToast('Failed to create bubble.', 'error');
    }
  };

  const handleLeaveBubble = async () => {
    if (!activeChannel || activeChannel.type !== 'bubble') return;
    const ok = window.confirm("Are you sure you want to leave this bubble?");
    if (!ok) return;

    playAudio('click', effectiveSfxEnabled);
    try {
      const { error } = await supabase
        .from('yard_bubble_members')
        .delete()
        .eq('bubble_id', activeChannel.id)
        .eq('user_id', userId);

      if (error) throw error;

      addToast("Left the bubble.", "success");
      setBubbles(prev => prev.filter(b => b.id !== activeChannel.id));
      setShowDetails(false);
      navigate('/chat');
    } catch (err) {
      console.error('[BUBBLE_LEAVE] Error:', err);
      addToast("Failed to leave bubble.", "error");
    }
  };

  const handleDeleteBubble = async () => {
    if (!activeChannel || activeChannel.type !== 'bubble') return;
    const ok = window.confirm("Are you sure you want to delete this bubble? This will remove all members and delete all chat history.");
    if (!ok) return;

    playAudio('click', effectiveSfxEnabled);
    try {
      const { error } = await supabase
        .from('yard_bubbles')
        .delete()
        .eq('id', activeChannel.id);

      if (error) throw error;

      addToast("Bubble deleted.", "success");
      setBubbles(prev => prev.filter(b => b.id !== activeChannel.id));
      setShowDetails(false);
      navigate('/chat');
    } catch (err) {
      console.error('[BUBBLE_DELETE] Error:', err);
      addToast("Failed to delete bubble.", "error");
    }
  };

  /* ═══════════════════════════════════════════════════════
     SUB-COMPONENTS / LAYOUT RENDERS
     ═══════════════════════════════════════════════════════ */

  const renderMediaToolbar = (msg, isMe) => {
    const effectiveUrl = msg.url || msg.audioUrl;
    if (!effectiveUrl) return null;

    return (
      <div className="flex items-center gap-2.5 mt-2 pt-2 border-t border-dashed border-border/15 shrink-0 text-main-text/60 select-none">
        <div className="relative">
          <button 
            onClick={(e) => { e.stopPropagation(); setOpenReactMsgId(openReactMsgId === msg.id ? null : msg.id); }} 
            className="hover:text-primary transition-colors p-1 hover:bg-black/5 rounded flex items-center justify-center"
            title="React"
          >
            <Smile size={13} />
          </button>
          {openReactMsgId === msg.id && (
            <div className="absolute bottom-6 left-0 bg-window border-2 border-border p-1 flex gap-1 shadow-md z-[110] rounded-md animate-in slide-in-from-bottom-2 duration-100">
              {['❤️', '😂', '😢', '😮', '😡'].map(emoji => (
                <button 
                  key={emoji} 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeChannel.isReal) {
                      const rs = msg.reactions || [];
                      syncUpdateMessage(msg.id, { reactions: rs.includes(emoji) ? rs.filter(e => e !== emoji) : [...rs, emoji] });
                    } else {
                      const rs = msg.reactions || [];
                      updateDemoMessage(msg.id, { reactions: rs.includes(emoji) ? rs.filter(e => e !== emoji) : [...rs, emoji] });
                    }
                    setOpenReactMsgId(null);
                  }} 
                  className={`text-sm p-1 hover:scale-130 active:scale-95 transition-transform ${(msg.reactions || []).includes(emoji) ? 'bg-accent/40 rounded' : ''}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button 
          onClick={async (e) => {
            e.stopPropagation();
            try {
              const res = await fetch(effectiveUrl);
              const blob = await res.blob();
              const blobUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = msg.fileName || 'download';
              a.click();
              URL.revokeObjectURL(blobUrl);
            } catch (err) {
              window.open(effectiveUrl, '_blank');
            }
          }} 
          className="hover:text-primary transition-colors p-1 hover:bg-black/5 rounded flex items-center justify-center"
          title="Download"
        >
          <Download size={13} />
        </button>

        {msg.type === 'image' && (
          <button 
            onClick={(e) => { e.stopPropagation(); handleSaveToScrapbook(effectiveUrl); }} 
            className="hover:text-primary transition-colors p-1 hover:bg-black/5 rounded flex items-center gap-1 text-[10px] font-black uppercase font-mono"
            title="Save to Album"
          >
            <ImageIcon size={13} /> <span className="hidden sm:inline">Album</span>
          </button>
        )}

        {isMe && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm("Delete this media message?")) {
                if (activeChannel.isReal) {
                  syncDeleteMessage(msg.id);
                } else {
                  deleteDemoMessage(msg.id);
                }
              }
            }} 
            className="hover:text-danger transition-colors p-1 hover:bg-black/5 rounded ml-auto flex items-center justify-center text-red-600"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    );
  };

  const handleContextMenu = (e, targetUserId) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('show_user_context_menu', {
      detail: { x: e.clientX, y: e.clientY, userId: targetUserId }
    }));
  };

  const openViewer = (url, msgId) => {
    const gallery = safeHistory.filter(m => (m.type === 'image' || m.type === 'image_group' || m.type === 'video'))
      .flatMap(m => {
        if (m.type === 'image_group') {
          return m.urls.map((u, idx) => ({
            url: u,
            type: 'image',
            id: m.id,
            createdAt: m.created_at,
            isDeleted: m.isDeleted,
            metadata: {
              title: `Group Photo ${idx + 1}`,
              sender: m.sender === userId || m.sender === 'user_me' ? 'You' : (roomProfiles[m.sender]?.name || 'Partner'),
              time: m.time,
              isMine: m.sender === userId || m.sender === 'user_me'
            },
            reactions: m.reactions
          }));
        }
        return [{
          url: m.url,
          type: m.type,
          id: m.id,
          createdAt: m.created_at,
          isDeleted: m.isDeleted,
          metadata: {
            title: m.type === 'video' ? 'Video Message' : 'Photo Message',
            sender: m.sender === userId || m.sender === 'user_me' ? 'You' : (roomProfiles[m.sender]?.name || 'Partner'),
            time: m.time,
            isMine: m.sender === userId || m.sender === 'user_me',
            isViewOnce: m.metadata?.isViewOnce
          },
          reactions: m.reactions
        }];
      });

    const initialIndex = gallery.findIndex(item => item.url === url && item.id === msgId);
    setViewerContext({ items: gallery, index: initialIndex >= 0 ? initialIndex : 0, isOpen: true });
  };

  // Channel details sidebar queries
  const mediaMessages = safeHistory.filter(m => (m.type === 'image' || m.type === 'image_group' || m.type === 'video') && !m.isDeleted && !m.metadata?.isViewOnce);
  const pinnedMessages = safeHistory.filter(m => m.isPinned && !m.isDeleted).reverse();
  const callHistory = safeHistory.filter(m => m.type === 'call_invite');

  // Title render details
  const isTypingActive = activeChannel?.isReal ? isPartnerTyping : !!mockTypingSenders[activeChannel?.id];
  const activeStatusDot = activeChannel?.isReal 
    ? (partnerStatusData?.status === 'active' ? 'bg-success' : partnerStatusData?.status === 'idle' ? 'bg-warning' : 'bg-disabled')
    : (activeChannel?.id === DM_RETRO_BOT_ID ? 'bg-success' : 'bg-success');

  const channelLabel = activeTab === 'servers' 
    ? `#${activeChannel?.name}` 
    : (activeChannel?.isReal ? partnerNickname : activeChannel?.name);

  const channelSubtitle = activeTab === 'servers'
    ? `${activeServer?.name} • ${activeServer?.members?.length || 0} members`
    : (activeChannel?.isReal ? partnerStatusLabel.toLowerCase() : 'online');

  // Interactive header details click logic
  const handleHeaderTitleClick = () => {
    playAudio('click', effectiveSfxEnabled);
    if (isMobile) {
      setMobileView('details');
    } else {
      setShowDetails(!showDetails);
    }
  };

  const handleOpenProfileSidebar = (memberId) => {
    playAudio('click', effectiveSfxEnabled);
    if (activeTab === 'servers') {
      // For servers, open the full-screen modal directly and do not show profile.sys in the sidebar details
      window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId: memberId } }));
      return;
    }
    setProfileUserId(memberId);
    setSidebarView('profile');
    if (isMobile) {
      setMobileView('details');
    } else {
      setShowDetails(true);
    }
  };

  const headerActions = (
    <div className="flex gap-1.5">
      {(activeTab === 'dms' || activeTab === 'bubbles') ? (
        <>
          <button 
            onClick={() => handleStartCall('audio')} 
            className="flex p-1.5 retro-border retro-shadow-dark hover:brightness-110 transition-all active:translate-y-[1px] active:shadow-none bg-window text-main-text" 
            title="Voice Call"
          >
            <Phone size={14} />
          </button>
          <button 
            onClick={() => handleStartCall('video')} 
            className="flex p-1.5 retro-border retro-shadow-dark hover:brightness-110 transition-all active:translate-y-[1px] active:shadow-none bg-window text-main-text" 
            title="Video Call"
          >
            <Video size={14} />
          </button>
          
          {/* User Profile / Members Button */}
          <button 
            onClick={() => {
              playAudio('click', effectiveSfxEnabled);
              if (activeTab === 'bubbles') {
                if ((isMobile ? mobileView === 'details' : showDetails) && sidebarView === 'details' && activeSidebarTab === 'members') {
                  if (isMobile) setMobileView('chat');
                  else setShowDetails(false);
                } else {
                  setSidebarView('details');
                  setActiveSidebarTab('members');
                  if (isMobile) setMobileView('details');
                  else setShowDetails(true);
                }
              } else {
                if ((isMobile ? mobileView === 'details' : showDetails) && sidebarView === 'profile') {
                  if (isMobile) setMobileView('chat');
                  else setShowDetails(false);
                } else {
                  setSidebarView('profile');
                  if (isMobile) setMobileView('details');
                  else setShowDetails(true);
                }
              }
            }} 
            className={`flex p-1.5 retro-border retro-shadow-dark hover:brightness-110 transition-all active:translate-y-[1px] active:shadow-none ${
              activeTab === 'bubbles'
                ? (((isMobile ? mobileView === 'details' : showDetails) && sidebarView === 'details' && activeSidebarTab === 'members') ? 'bg-primary text-white border-primary' : 'bg-window text-main-text')
                : (((isMobile ? mobileView === 'details' : showDetails) && sidebarView === 'profile') ? 'bg-primary text-white border-primary' : 'bg-window text-main-text')
            }`} 
            title={activeTab === 'bubbles' ? "Members List" : "User Profile"}
          >
            {activeTab === 'bubbles' ? <Users size={14} /> : <User size={14} />}
          </button>

          {/* Chat Details Button */}
          <button 
            onClick={() => {
              playAudio('click', effectiveSfxEnabled);
              if (activeTab === 'bubbles') {
                if ((isMobile ? mobileView === 'details' : showDetails) && sidebarView === 'details' && activeSidebarTab === 'info') {
                  if (isMobile) setMobileView('chat');
                  else setShowDetails(false);
                } else {
                  setSidebarView('details');
                  setActiveSidebarTab('info');
                  if (isMobile) setMobileView('details');
                  else setShowDetails(true);
                }
              } else {
                if ((isMobile ? mobileView === 'details' : showDetails) && sidebarView === 'details') {
                  if (isMobile) setMobileView('chat');
                  else setShowDetails(false);
                } else {
                  setSidebarView('details');
                  if (isMobile) setMobileView('details');
                  else setShowDetails(true);
                }
              }
            }} 
            className={`flex p-1.5 retro-border retro-shadow-dark hover:brightness-110 transition-all active:translate-y-[1px] active:shadow-none ${
              activeTab === 'bubbles'
                ? (((isMobile ? mobileView === 'details' : showDetails) && sidebarView === 'details' && activeSidebarTab === 'info') ? 'bg-primary text-white border-primary' : 'bg-window text-main-text')
                : (((isMobile ? mobileView === 'details' : showDetails) && sidebarView === 'details') ? 'bg-primary text-white border-primary' : 'bg-window text-main-text')
            }`} 
            title="Chat Details"
          >
            <Info size={14} />
          </button>
        </>
      ) : (
        <>
          <button 
            onClick={() => {
              playAudio('click', effectiveSfxEnabled);
              setActiveSidebarTab('search');
              if (isMobile) {
                setMobileView('details');
              } else {
                setShowDetails(true);
              }
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }} 
            className="flex p-1.5 retro-border retro-shadow-dark hover:brightness-110 transition-all active:translate-y-[1px] active:shadow-none bg-window text-main-text" 
            title="Search Messages"
          >
            <Search size={14} />
          </button>

          {/* Chat/Server Details Button */}
          <button 
            onClick={() => {
              playAudio('click', effectiveSfxEnabled);
              if ((isMobile ? mobileView === 'details' : showDetails) && sidebarView === 'details') {
                if (isMobile) setMobileView('chat');
                else setShowDetails(false);
              } else {
                setSidebarView('details');
                if (isMobile) setMobileView('details');
                else setShowDetails(true);
              }
            }} 
            className={`flex p-1.5 retro-border retro-shadow-dark hover:brightness-110 transition-all active:translate-y-[1px] active:shadow-none ${
              ((isMobile ? mobileView === 'details' : showDetails) && sidebarView === 'details') 
                ? 'bg-primary text-white border-primary' 
                : 'bg-window text-main-text'
            }`} 
            title="Server Details"
          >
            <Users size={14} />
          </button>
        </>
      )}
    </div>
  );

  // E2EE view state filter
  const shouldShowE2EE = activeChannel?.isReal && (showPinSetupPrompt || showRestorePrompt);

  return (
    <>
      {/* Lightbox / Overlay modals */}
      {viewerContext.isOpen && (
        <ImageViewerOverlay
          images={viewerContext.items}
          currentIndex={viewerContext.index}
          onClose={() => setViewerContext(p => ({ ...p, isOpen: false }))}
          onNext={() => setViewerContext(p => ({ ...p, index: (p.index + 1) % p.items.length }))}
          onPrev={() => setViewerContext(p => ({ ...p, index: (p.index - 1 + p.items.length) % p.items.length }))}
          onDelete={(idx, mode) => {
            const item = viewerContext.items[idx];
            if (!item?.id) return;
            if (mode === 'everyone') {
              if (activeChannel.isReal) {
                syncUpdateMessage(item.id, { isDeleted: true, text: 'message deleted' });
              } else {
                updateDemoMessage(item.id, { isDeleted: true, text: 'message deleted' });
              }
            } else {
              if (activeChannel.isReal) {
                syncDeleteMessage(item.id);
              } else {
                deleteDemoMessage(item.id);
              }
            }
            setViewerContext(p => ({ ...p, isOpen: false }));
          }}
          onReact={(idx, emoji) => {
            const item = viewerContext.items[idx];
            if (item?.id) {
              const rs = item.reactions || [];
              if (activeChannel.isReal) {
                syncUpdateMessage(item.id, { reactions: rs.includes(emoji) ? rs.filter(e => e !== emoji) : [...rs, emoji] });
              } else {
                updateDemoMessage(item.id, { reactions: rs.includes(emoji) ? rs.filter(e => e !== emoji) : [...rs, emoji] });
              }
            }
          }}
          onJumpToMessage={(idx) => {
            const item = viewerContext.items[idx];
            if (item?.id) {
              handleJumpToMessage(item.id, item.createdAt);
              setViewerContext(p => ({ ...p, isOpen: false }));
            }
          }}
          onSaveToScrapbook={handleSaveToScrapbook}
          sfx={effectiveSfxEnabled}
        />
      )}

      {editingFileIndex !== null && pendingFiles[editingFileIndex] && (
        <MediaEditorOverlay
          file={pendingFiles[editingFileIndex].file}
          type={pendingFiles[editingFileIndex].type}
          onSave={handleSaveEditedFile}
          onClose={() => setEditingFileIndex(null)}
          sfx={effectiveSfxEnabled}
        />
      )}

      {/* Three Column Windows Wrapper */}
      <div className="w-full h-full p-2 flex gap-2 overflow-hidden bg-transparent relative select-none min-h-0">
        
        {/* Column 1: Server Rail + Channel List (spaces.sys) */}
        <RetroWindow
          title="spaces.sys"
          onClose={onClose}
          className={`${isMobile && mobileView !== 'sidebar' ? 'hidden' : 'flex'} w-full md:w-[280px] lg:w-[320px] shrink-0 h-full flex flex-col min-h-0`}
          noPadding
          sfx={effectiveSfxEnabled}
        >
          <div className="flex flex-1 h-full overflow-hidden min-h-0">
            {/* Server Rail (Narrow Column ~56px) */}
            <div className="w-14 bg-main border-r border-dashed border-border/30 flex flex-col items-center py-3 gap-3 overflow-y-auto shrink-0 scrollbar-none">
              
              {/* Direct Messages Home Button */}
              <div className="relative group flex items-center justify-center">
                <button
                  onClick={() => { playAudio('click', effectiveSfxEnabled); navigate('/chat'); if (isMobile) setMobileView('chat'); }}
                  className={`w-9 h-9 flex items-center justify-center rounded-md border-2 transition-all ${
                    activeTab !== 'servers' 
                      ? 'bg-primary text-[color:var(--text-on-primary)] border-primary shadow-[inset_1px_1px_0_rgba(255,255,255,0.4)]' 
                      : 'bg-window text-main-text border-border hover:brightness-115 active:translate-y-[1px]'
                  }`}
                >
                  <Home size={16} />
                </button>
                <div className="absolute left-16 top-1/2 -translate-y-1/2 hidden group-hover:block bg-[#ffffe1] border border-black text-black text-[9px] font-mono font-bold px-2 py-0.5 shadow-[2px_2px_0_rgba(0,0,0,0.25)] whitespace-nowrap z-50">
                  Direct Messages
                </div>
              </div>

              {/* Separator line */}
              <div className="w-8 h-[2px] bg-border opacity-30 my-1 shrink-0" />

              {/* Servers list */}
              {servers.map((serv) => (
                <div key={serv.id} className="relative group flex items-center justify-center">
                  <button
                    onClick={() => {
                      playAudio('click', effectiveSfxEnabled);
                      const defaultChan = serv.channels?.[0]?.id || 'general';
                      navigate(`/chat/guild/${serv.id}/${defaultChan}`);
                      if (isMobile) setMobileView('chat');
                    }}
                    className={`w-9 h-9 flex items-center justify-center text-lg rounded-md border-2 overflow-hidden transition-all ${
                      activeTab === 'servers' && selectedServerId === serv.id
                        ? 'bg-primary border-primary shadow-[inset_1px_1px_0_rgba(255,255,255,0.4)] text-[color:var(--text-on-primary)]'
                        : 'bg-window border-border text-main-text hover:brightness-115 active:translate-y-[1px]'
                    }`}
                  >
                    {serv.icon && (serv.icon.startsWith('data:') || serv.icon.includes('/') || serv.icon.startsWith('blob:')) ? (
                      <img src={serv.icon} alt={serv.name} className="w-full h-full object-cover bg-white" />
                    ) : (
                      <span className="font-bold text-xs uppercase">{serv.name[0]?.toUpperCase() || 'G'}</span>
                    )}
                  </button>
                  <div className="absolute left-16 top-1/2 -translate-y-1/2 hidden group-hover:block bg-[#ffffe1] border border-black text-black text-[9px] font-mono font-bold px-2 py-0.5 shadow-[2px_2px_0_rgba(0,0,0,0.25)] whitespace-nowrap z-50">
                    {serv.name} {serv.type === 'guild' ? '(Mini-Guild)' : '(Standard Guild)'}
                  </div>
                </div>
              ))}

              {/* Add Server Button */}
              <div className="relative group flex items-center justify-center mt-1">
                <button
                  onClick={() => { playAudio('click', effectiveSfxEnabled); setShowCreateServer(true); }}
                  className="w-9 h-9 flex items-center justify-center rounded-md border-2 border-dashed border-border bg-window/50 text-muted-text hover:text-primary hover:border-primary transition-all active:translate-y-[1px]"
                >
                  <Plus size={16} />
                </button>
                <div className="absolute left-16 top-1/2 -translate-y-1/2 hidden group-hover:block bg-[#ffffe1] border border-black text-black text-[9px] font-mono font-bold px-2 py-0.5 shadow-[2px_2px_0_rgba(0,0,0,0.25)] whitespace-nowrap z-50">
                  Create a Guild
                </div>
              </div>

            </div>

            {/* Channels / DMs Sidebar List */}
            <div className="flex-1 flex flex-col bg-window/40 h-full overflow-hidden min-h-0 relative">
              
              {/* Header section */}
              <div 
                onClick={() => {
                  if (activeTab === 'servers') {
                    setShowServerMenu(!showServerMenu);
                  }
                }}
                className={`p-3 border-b-2 border-border flex items-center justify-between shrink-0 bg-window/10 ${activeTab === 'servers' ? 'cursor-pointer hover:bg-black/5' : ''}`}
              >
                <div className="flex flex-col select-none leading-none">
                  <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1">
                    {activeTab === 'servers' ? activeServer?.name : 'Direct Messages'}
                    {activeTab === 'servers' && <ChevronRight size={10} className={`transform transition-transform ${showServerMenu ? 'rotate-90' : ''}`} />}
                  </span>
                  <span className="text-[8px] font-bold opacity-60 uppercase tracking-widest mt-0.5 font-mono">
                    {activeTab === 'servers' 
                      ? (activeServer?.type === 'guild' ? '🛡️ Guild (Max 10)' : '🌳 Server')
                      : 'private logs'}
                  </span>
                </div>
                {isMobile && (
                  <button onClick={(e) => { e.stopPropagation(); setMobileView('chat'); }} className="p-1 border bg-window"><X size={12} /></button>
                )}
              </div>

              {showServerMenu && activeTab === 'servers' && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowServerMenu(false)} />
                  <div className="absolute top-[45px] left-2 right-2 z-20 bg-[var(--bg-window)] border-2 border-border shadow-lg p-1.5 font-mono flex flex-col gap-0.5 animate-in slide-in-from-top-1 duration-100">
                    {currentUserRole === 'owner' && (
                      <button 
                        type="button"
                        onClick={() => {
                          playAudio('click', effectiveSfxEnabled);
                          setShowServerMenu(false);
                          setShowServerSettingsModal(true);
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs font-black uppercase hover:bg-black/5 flex items-center gap-2"
                      >
                        <Settings size={12} className="text-primary" />
                        <span>Server Settings</span>
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={() => {
                        playAudio('click', effectiveSfxEnabled);
                        setShowServerMenu(false);
                        setIsAddingChannel(true);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs font-black uppercase hover:bg-black/5 flex items-center gap-2"
                    >
                      <Plus size={12} className="text-primary" />
                      <span>Create Channel</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        playAudio('click', effectiveSfxEnabled);
                        setShowServerMenu(false);
                        setShowInviteModal(true);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs font-black uppercase hover:bg-black/5 flex items-center gap-2"
                    >
                      <Plus size={12} className="text-primary" />
                      <span>Invite Friends</span>
                    </button>
                    {activeServer?.id !== HANGOUT_SERVER_ID && (
                      <button 
                        type="button"
                        onClick={() => {
                          playAudio('click', effectiveSfxEnabled);
                          setShowServerMenu(false);
                          setShowDeleteServerConfirm(true);
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs font-black uppercase hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-dashed border-border/20 mt-1 pt-1.5"
                      >
                        <Trash2 size={12} />
                        <span>Delete Server</span>
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Channels/DMs items feed */}
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                
                {(activeTab === 'dms' || activeTab === 'bubbles') ? (
                  <>
                    {/* Collapsible Direct Messages Section */}
                    <div className="mb-2 font-mono">
                      <div className="w-full px-2 py-1 flex items-center justify-between text-[10px] font-black uppercase text-main-text select-none">
                        <button
                          type="button"
                          onClick={() => {
                            playAudio('click', effectiveSfxEnabled);
                            setDmsExpanded(!dmsExpanded);
                          }}
                          className="flex items-center gap-1 hover:opacity-80 text-[10px] font-black uppercase"
                        >
                          <ChevronRight size={10} className={`transform transition-transform ${dmsExpanded ? 'rotate-90' : ''}`} />
                          <span>Direct Messages</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playAudio('click', effectiveSfxEnabled);
                            setShowStartDmModal(true);
                          }}
                          className="p-0.5 hover:bg-black/5 text-primary"
                          title="Start Direct Message"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      
                      {dmsExpanded && (
                        <div className="flex flex-col gap-0.5 mt-1 pl-1">
                          {[
                            { id: DM_PARTNER_ID, name: partnerNickname, emoji: '☕', isReal: true },
                            { id: DM_ALICE_ID, name: 'Alice', emoji: '👾', isReal: false },
                            { id: DM_RETRO_BOT_ID, name: 'RetroBot', emoji: '🤖', isReal: false },
                            ...[
                              { id: DM_CRAYON_CAT_ID, name: 'CrayonCat', emoji: '🐱', isReal: false },
                              { id: DM_RETRO_GAMER_ID, name: 'RetroGamer', emoji: '🕹️', isReal: false },
                              { id: DM_LOFI_DJ_ID, name: 'LofiDJ', emoji: '🎧', isReal: false },
                              { id: DM_PIXEL_PET_ID, name: 'PixelPet', emoji: '🐾', isReal: false },
                              { id: DM_SPACE_WANDERER_ID, name: 'SpaceWanderer', emoji: '🌌', isReal: false }
                            ].filter(bot => demoMessages[bot.id] && demoMessages[bot.id].length > 0),
                            ...dms
                          ].map(dm => {
                            const dmActive = selectedDmId === dm.id;
                            const isOnline = dm.isReal 
                              ? partnerStatusData?.status === 'active' 
                              : true;

                            return (
                              <button
                                key={dm.id}
                                onClick={() => {
                                  playAudio('click', effectiveSfxEnabled);
                                  navigate(`/chat/dm/${dm.id}`);
                                  if (isMobile) setMobileView('chat');
                                }}
                                className={`w-full p-2 flex items-center gap-2.5 rounded text-left transition-all font-mono select-none ${
                                  dmActive 
                                    ? 'bg-accent text-accent-text retro-border' 
                                    : 'hover:bg-black/5 text-main-text'
                                }`}
                              >
                                <div className="relative flex-shrink-0">
                                  <div className="w-8 h-8 retro-border bg-window flex items-center justify-center text-sm shadow-inner text-primary">
                                    <User size={14} />
                                  </div>
                                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border border-window rounded-full ${isOnline ? 'bg-success' : 'bg-disabled'}`} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-black tracking-tight">{dm.isReal ? partnerNickname : dm.name}</span>
                                  <span className="text-[9px] opacity-60 truncate tracking-tighter">
                                    {dm.isReal ? (partnerStatusLabel.length > 20 ? partnerStatusLabel.substring(0, 18) + '...' : partnerStatusLabel) : 'online'}
                                  </span>
                                </div>
                                {dm.unread > 0 && !dmActive && (
                                  <div className="ml-auto w-4 h-4 bg-primary text-white text-[8px] font-black rounded-full flex items-center justify-center">{dm.unread}</div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Collapsible Group Bubbles Section */}
                    <div className="mb-2 font-mono">
                      <div className="w-full px-2 py-1 flex items-center justify-between text-[10px] font-black uppercase text-main-text select-none">
                        <button
                          type="button"
                          onClick={() => {
                            playAudio('click', effectiveSfxEnabled);
                            setBubblesExpanded(!bubblesExpanded);
                          }}
                          className="flex items-center gap-1 hover:opacity-80 text-[10px] font-black uppercase"
                        >
                          <ChevronRight size={10} className={`transform transition-transform ${bubblesExpanded ? 'rotate-90' : ''}`} />
                          <span>Group Bubbles</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playAudio('click', effectiveSfxEnabled);
                            setShowCreateBubbleModal(true);
                          }}
                          className="p-0.5 hover:bg-black/5 text-primary"
                          title="Create Bubble"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      
                      {bubblesExpanded && (
                        <div className="flex flex-col gap-0.5 mt-1 pl-1">
                          {bubbles.map(bubble => {
                            const bubbleActive = selectedBubbleId === bubble.id;
                            return (
                              <button
                                key={bubble.id}
                                onClick={() => {
                                  playAudio('click', effectiveSfxEnabled);
                                  navigate(`/chat/bubble/${bubble.id}`);
                                  if (isMobile) setMobileView('chat');
                                }}
                                className={`w-full p-2 flex items-center gap-2.5 rounded text-left transition-all font-mono select-none ${
                                  bubbleActive 
                                    ? 'bg-accent text-accent-text retro-border' 
                                    : 'hover:bg-black/5 text-main-text'
                                }`}
                              >
                                <div className="relative flex-shrink-0">
                                  <div className="w-8 h-8 retro-border bg-window flex items-center justify-center text-xs font-black uppercase text-accent shadow-inner">
                                    {bubble.name[0]?.toUpperCase() || 'B'}
                                  </div>
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-black tracking-tight">{bubble.name}</span>
                                  <span className="text-[9px] opacity-60 truncate tracking-tighter">
                                    {bubble.members?.length || 0} members
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                          {bubbles.length === 0 && (
                            <span className="text-[10px] font-bold opacity-50 pl-6 py-2 lowercase block">
                              No bubbles created yet
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Collapsible Events Header */}
                    <div className="mb-2">
                      <button 
                        type="button"
                        onClick={() => { playAudio('click', effectiveSfxEnabled); setShowEvents(!showEvents); }}
                        className="w-full px-2 py-1.5 flex items-center justify-between text-[10px] font-black uppercase text-main-text hover:bg-black/5 rounded font-mono"
                      >
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-primary" />
                          <span>📅 Events</span>
                        </div>
                        <ChevronRight size={10} className={`transform transition-transform ${showEvents ? 'rotate-90' : ''}`} />
                      </button>
                      {showEvents && (
                        <div className="pl-6 pr-2 py-1 text-[10px] font-bold text-muted-text font-mono border-l-2 border-dashed border-border/20 ml-3 mt-1">
                          No upcoming events.
                        </div>
                      )}
                    </div>

                    {/* Grouped Channels by Category */}
                    {(() => {
                      const cats = ['General', 'Gayms', 'Music', 'Mubi'];
                      const channels = activeServer?.channels || [];
                      
                      return cats.map(cat => {
                        const catChans = channels.filter(c => (c.category || 'General').toLowerCase() === cat.toLowerCase());
                        if (catChans.length === 0) return null;
                        
                        const isCollapsed = !!collapsedCategories[cat];
                        return (
                          <div key={cat} className="mb-2 font-mono">
                            <button
                              type="button"
                              onClick={() => {
                                playAudio('click', effectiveSfxEnabled);
                                setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
                              }}
                              className="w-full px-2 py-1 flex items-center justify-between text-[9px] font-black uppercase opacity-60 hover:opacity-100 text-main-text select-none text-left"
                            >
                              <span>{cat}</span>
                              <ChevronRight size={8} className={`transform transition-transform ${!isCollapsed ? 'rotate-90' : ''}`} />
                            </button>
                            
                            {!isCollapsed && (
                              <div className="flex flex-col gap-0.5 mt-1 pl-1">
                                {catChans.map(chan => {
                                  const chanActive = selectedChannelId === chan.id;
                                  const voiceConnected = activeVoiceChannelId === chan.id;
                                  const isVoice = chan.type === 'voice';
                                  
                                  return (
                                    <button
                                      key={chan.id}
                                      type="button"
                                      onClick={() => {
                                        if (isVoice) {
                                          handleVoiceChannelClick(chan);
                                        } else {
                                          playAudio('click', effectiveSfxEnabled);
                                          navigate(`/chat/guild/${selectedServerId}/${chan.id}`);
                                          if (isMobile) setMobileView('chat');
                                        }
                                      }}
                                      className={`w-full p-1.5 flex items-center gap-2 rounded text-left transition-all select-none ${
                                        chanActive || voiceConnected
                                          ? 'bg-accent text-accent-text retro-border font-black' 
                                          : 'hover:bg-black/5 text-main-text font-bold'
                                      }`}
                                    >
                                      {isVoice ? (
                                        <Volume2 size={13} className={`${voiceConnected ? 'text-primary' : 'text-muted-text'} flex-shrink-0`} />
                                      ) : (
                                        <Hash size={13} className="text-muted-text flex-shrink-0" />
                                      )}
                                      <span className="text-xs truncate">{chan.name}</span>
                                      {voiceConnected && (
                                        <span className="ml-auto text-[8px] bg-success text-white px-1 py-0.2 uppercase font-black font-mono">Connected</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}

                    {/* Custom server channel creator */}
                    {isAddingChannel ? (
                      <form onSubmit={handleCreateChannel} className="p-2 border-t border-dashed border-border/20 flex gap-1 animate-in slide-in-from-top-1 font-mono">
                        <input 
                          type="text" 
                          value={newChannelName} 
                          onChange={e => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                          placeholder="new-channel" 
                          className="bg-window text-xs font-bold retro-inset p-1.5 w-full outline-none text-main-text"
                          required
                          autoFocus
                        />
                        <button type="submit" className="px-2 bg-primary text-white text-xs font-black retro-border shrink-0 hover:brightness-110">Add</button>
                        <button type="button" onClick={() => setIsAddingChannel(false)} className="px-2 bg-window text-main-text text-xs font-black retro-border shrink-0 hover:brightness-110">X</button>
                      </form>
                    ) : (
                      activeServer?.id !== HANGOUT_SERVER_ID && (
                        <button 
                          onClick={() => setIsAddingChannel(true)} 
                          className="text-[10px] font-black uppercase text-primary hover:underline px-3 py-2 text-left flex items-center gap-1.5 mt-2 font-mono"
                        >
                          <Plus size={10} /> Add Channel
                        </button>
                      )
                    )}
                  </>
                )}

              </div>

              {/* Bottom user profile pod */}
              {activeTab === 'servers' && (
                <div className="p-2 border-t-2 border-border bg-window/65 flex items-center justify-between shrink-0 font-mono gap-1 select-none">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      {profile.pfp ? (
                        <img 
                          src={profile.pfp} 
                          alt="You" 
                          className="w-7 h-7 retro-border object-cover bg-white" 
                        />
                      ) : (
                        <img 
                          src={getRetroPfpUrl(profile.name || 'You')} 
                          alt="You" 
                          className="w-7 h-7 retro-border object-cover bg-white" 
                        />
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border border-window rounded-full bg-success" />
                    </div>
                    <div className="flex flex-col min-w-0 leading-none">
                      <span className="text-xs font-bold truncate">{profile.name || 'You'}</span>
                      <span className="text-[7.5px] opacity-60 truncate mt-0.5">Online</span>
                    </div>
                  </div>
                  
                  {/* Call and settings controls */}
                  <div className="flex items-center gap-1">
                    <button 
                      type="button"
                      onClick={() => {
                        toggleMic();
                        playAudio('click', effectiveSfxEnabled);
                        addToast(!isMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');
                      }}
                      className={`p-1.5 retro-border transition-all active:translate-y-[1px] hover:brightness-110 ${
                        isMuted 
                          ? 'bg-[var(--color-destructive)] text-white border-[var(--color-destructive)] shadow-inner' 
                          : 'bg-window text-main-text'
                      }`}
                      title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                    >
                      {isMuted ? <MicOff size={11} /> : <Mic size={11} />}
                    </button>
                    
                    <button 
                      type="button"
                      onClick={() => {
                        toggleDeafen();
                        playAudio('click', effectiveSfxEnabled);
                        addToast(!isDeafened ? 'Audio deafened' : 'Audio enabled', 'info');
                      }}
                      className={`p-1.5 retro-border transition-all active:translate-y-[1px] hover:brightness-110 ${
                        isDeafened 
                          ? 'bg-[var(--color-destructive)] text-white border-[var(--color-destructive)] shadow-inner' 
                          : 'bg-window text-main-text'
                      }`}
                      title={isDeafened ? 'Undeafen Audio' : 'Deafen Audio'}
                    >
                      <Headphones size={11} className={isDeafened ? 'stroke-[2.5]' : ''} />
                    </button>
                    
                    <button 
                      type="button"
                      onClick={() => {
                        playAudio('click', effectiveSfxEnabled);
                        window.dispatchEvent(new CustomEvent('open_settings'));
                      }}
                      className="p-1.5 retro-border bg-window text-main-text transition-all active:translate-y-[1px] hover:brightness-110"
                      title="Settings"
                    >
                      <Settings size={11} />
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </RetroWindow>

        {/* Column 2: Active Chat Message Area (chat.exe) */}
        <RetroWindow
          title={(
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 active:opacity-60 transition-opacity" onClick={handleHeaderTitleClick}>
              <div className="flex flex-col leading-none items-start justify-center">
                <span className="font-black text-sm truncate tracking-tight flex items-center gap-1.5 text-main-text">
                  {activeTab === 'servers' && <Hash size={14} className="text-primary" />}
                  {channelLabel}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={`w-2 h-2 rounded-full ${activeStatusDot}`} />
                  <span className="text-[7.5px] font-black opacity-60 uppercase tracking-widest font-mono text-main-text">{channelSubtitle}</span>
                </div>
              </div>
            </div>
          )}
          onClose={onClose}
          headerActions={headerActions}
          className={`${isMobile && mobileView !== 'chat' ? 'hidden' : 'flex'} flex-1 h-full flex flex-col min-h-0`}
          noPadding
          sfx={effectiveSfxEnabled}
        >
          {isDragging && (
            <div className="absolute inset-0 z-[200] bg-primary/20 border-4 border-dashed border-primary flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300 pointer-events-none" style={{ backgroundColor: 'rgba(var(--color-primary-rgb), 0.1)' }}>
              <div className="w-24 h-24 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(var(--color-primary-rgb),0.5)] animate-bounce">
                <Upload size={48} />
              </div>
              <span className="font-black uppercase tracking-[0.3em] text-primary text-xl bg-window px-6 py-2 retro-border">Drop to Stage Attachment</span>
            </div>
          )}

          <div className="flex flex-col h-full flex-1 relative min-h-0">
            {/* Header bar actions helper for Mobile drawer toggles */}
            {isMobile && (
              <div className="flex items-center gap-2 p-2 border-b bg-window/50 shrink-0">
                <button 
                  onClick={() => { playAudio('click', effectiveSfxEnabled); setMobileView('sidebar'); }} 
                  className="px-2.5 py-1.5 retro-border bg-window text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 font-mono"
                >
                  <ChevronRight size={10} className="transform rotate-180" /> Server List
                </button>
                <div className="flex-1" />
                <button 
                  onClick={() => { playAudio('click', effectiveSfxEnabled); setMobileView('details'); }} 
                  className="px-2.5 py-1.5 retro-border bg-window text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 font-mono"
                >
                  Details <ChevronRight size={10} />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col relative chat-container" onScroll={handleChatScroll}>
              
              {shouldShowE2EE ? (
                /* E2EE PIN Config and restore prompts container (Strictly for real Partner DM) */
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                  <div className="w-full max-w-md retro-border p-6 shadow-xl bg-window animate-in fade-in duration-300">
                    {showPinSetupPrompt ? (
                      pinSetupStep === 'warning' ? (
                        <div className="flex flex-col gap-5 py-2 text-center">
                          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                            <AlertTriangle size={32} className="text-yellow-600 animate-pulse" />
                          </div>
                          <h1 className="text-xl font-black lowercase text-primary">Warning: Important Notice ⚠️</h1>
                          <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded text-left text-xs font-bold text-amber-800 space-y-2 font-mono">
                            <p>If you forget your PIN, your message history cannot be recovered.</p>
                            <p>This cannot be undone.</p>
                          </div>
                          <p className="text-xs text-muted-text font-bold">
                            Yard uses true End-to-End Encryption. We do not store your PIN on our servers, meaning we cannot reset it or recover your chats.
                          </p>
                          
                          <label className="flex items-start gap-2 cursor-pointer group mt-2 text-left">
                            <input 
                              type="checkbox" 
                              checked={pinWarningConfirmed}
                              onChange={e => setPinWarningConfirmed(e.target.checked)}
                              className="w-4 h-4 mt-0.5 border-2 border-border accent-primary cursor-pointer"
                            />
                            <span className="text-xs font-bold text-muted-text group-hover:text-main-text lowercase">
                              I understand that my message history will be permanently lost if I forget my PIN.
                            </span>
                          </label>
          
                          <RetroButton 
                            onClick={() => setPinSetupStep('input')} 
                            disabled={!pinWarningConfirmed} 
                            className="w-full py-3 text-base mt-2"
                          >
                            Continue
                          </RetroButton>
                        </div>
                      ) : (
                        <form 
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!pinSetupInput || pinSetupInput.length < 6) {
                              addToast("PIN must be at least 6 digits.", "error");
                              return;
                            }
                            if (pinSetupInput !== pinSetupConfirm) {
                              addToast("PINs do not match.", "error");
                              return;
                            }
                            handleCreatePin(pinSetupInput);
                          }}
                          className="flex flex-col gap-5 py-2 text-center"
                        >
                          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 font-mono">
                            <Lock size={32} className="text-primary" />
                          </div>
                          <h1 className="text-xl font-black lowercase text-primary">Create Chat PIN 🔐</h1>
                          <p className="font-bold text-muted-text text-sm">
                            Choose a numeric PIN (min 6 digits) to secure your chat history. You will need to enter this PIN when logging in on new devices.
                          </p>
          
                          <RetroInput 
                            label="Enter Chat PIN"
                            icon={Key}
                            type="password"
                            autoComplete="new-password"
                            pattern="[0-9]*"
                            inputMode="numeric"
                            placeholder="e.g. 123456"
                            value={pinSetupInput}
                            onChange={e => setPinSetupInput(e.target.value.replace(/\D/g, ''))}
                            required
                            autoFocus
                            disabled={isDeriving}
                          />
          
                          <RetroInput 
                            label="Confirm Chat PIN"
                            icon={Check}
                            type="password"
                            autoComplete="new-password"
                            pattern="[0-9]*"
                            inputMode="numeric"
                            placeholder="e.g. 123456"
                            value={pinSetupConfirm}
                            onChange={e => setPinSetupConfirm(e.target.value.replace(/\D/g, ''))}
                            required
                            disabled={isDeriving}
                          />
          
                          <RetroButton type="submit" disabled={isDeriving || pinSetupInput.length < 6 || pinSetupInput !== pinSetupConfirm} className="w-full py-3 text-base">
                            {isDeriving ? (
                              <span className="flex items-center justify-center gap-2">
                                <Loader className="animate-spin" size={16} /> securing your keys...
                              </span>
                            ) : 'Create PIN'}
                          </RetroButton>
                        </form>
                      )
                    ) : (
                      <form onSubmit={handleRestore} className="flex flex-col gap-5 py-2 text-center">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                          <Unlock size={32} className="text-primary" />
                        </div>
                        <h1 className="text-xl font-black lowercase text-primary">unlock chat history 🔒</h1>
                        <p className="font-bold text-muted-text text-sm">
                          We detected existing encrypted chats, but your encryption keys are not on this device. Enter your Chat PIN to unlock them.
                        </p>
          
                        <RetroInput 
                          label="Enter Chat PIN"
                          icon={Key}
                          type="password"
                          autoComplete="current-password"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          placeholder="Enter your 6-digit PIN"
                          value={restoreKeyInput}
                          onChange={e => setRestoreKeyInput(e.target.value.replace(/\D/g, ''))}
                          error={restoreError}
                          required
                          autoFocus
                          disabled={isRestoring || isDeriving}
                        />
          
                        <RetroButton type="submit" disabled={isRestoring || isDeriving || !restoreKeyInput.trim()} className="w-full py-3 text-base">
                          {isDeriving ? (
                            <span className="flex items-center justify-center gap-2">
                              <Loader className="animate-spin" size={16} /> securing your keys...
                            </span>
                          ) : 'Unlock History'}
                        </RetroButton>
          
                        <div className="relative flex py-2 items-center">
                          <div className="flex-grow border-t border-border opacity-20"></div>
                          <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-muted-text uppercase tracking-widest font-mono">or</span>
                          <div className="flex-grow border-t border-border opacity-20"></div>
                        </div>
          
                        <div className="space-y-2 text-left">
                          <p className="text-xs font-bold text-muted-text text-center font-mono">Forgot your Chat PIN?</p>
                          <RetroButton 
                            onClick={() => setShowResetConfirm(true)} 
                            type="button"
                            variant="secondary" 
                            disabled={isRestoring || isDeriving}
                            className="w-full py-2.5 text-xs font-bold font-mono"
                          >
                            Reset Chat History
                          </RetroButton>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Beginning of logs header */}
                  <div className="flex flex-col items-center gap-1 mt-2 mb-6 w-full text-center select-none shrink-0">
                    <div className="text-[10px] sm:text-xs font-bold opacity-50 text-main-text max-w-sm lowercase leading-relaxed font-mono">
                      this is the beginning of your private, secure retro room history with {activeTab === 'servers' ? `#${activeChannel?.name}` : (activeChannel?.isReal ? partnerNickname : activeChannel?.name)}. say hello!
                    </div>
                    <div className="text-[10px] sm:text-xs font-bold opacity-50 text-main-text lowercase font-mono">
                      -- connection secured --
                    </div>
                  </div>

                  {isHistoricalView && (
                    <div className="sticky top-4 z-[100] flex justify-center mb-4">
                      <button onClick={handleJumpToPresent} className="bg-primary text-white px-4 py-2 rounded-full retro-border shadow-xl font-bold text-xs uppercase hover:scale-105 active:scale-95 transition-all flex items-center gap-2 font-mono">
                        <History size={14} /> Jump to Present
                      </button>
                    </div>
                  )}

                  {/* Message logs renderer loop */}
                  {safeHistory.slice(-viewLimit).map((msg, index) => {
                    const visibleMsgs = safeHistory.slice(-viewLimit);
                    const prevMsg = visibleMsgs[index - 1];
                    const nextMsg = visibleMsgs[index + 1];

                    // Date dividers
                    let showTimeDivider = false;
                    let dividerText = '';
                    if (msg.created_at) {
                      const currTime = new Date(msg.created_at);
                      if (prevMsg && prevMsg.created_at) {
                        const prevTime = new Date(prevMsg.created_at);
                        if (currTime.getTime() - prevTime.getTime() > 3600000 || currTime.getDate() !== prevTime.getDate()) {
                          showTimeDivider = true;
                        }
                      } else {
                        showTimeDivider = true;
                      }
                      if (showTimeDivider) {
                        dividerText = currTime.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                      }
                    }

                    // Check alignment details
                    const isMe = msg.sender === userId || msg.sender === 'user_me';
                    
                    // Sender info resolution (real profiles vs mock members)
                    let senderName = 'Partner';
                    let senderEmoji = '☕';
                    let senderPfp = null;

                    if (isMe) {
                      senderName = 'You';
                      senderEmoji = profile.emoji || '😊';
                      senderPfp = profile.pfp;
                    } else if (activeChannel?.isReal) {
                      const senderInfo = roomProfiles[msg.sender] || partnerProfile || {};
                      senderName = senderInfo.name || partnerNickname;
                      senderEmoji = senderInfo.emoji || '☕';
                      senderPfp = senderInfo.pfp;
                    } else {
                      const membersList = activeServer ? activeServer.members : activeChannel?.members;
                      const member = membersList?.find(m => m.id === msg.sender);
                      senderName = member ? member.name : 'User';
                      senderEmoji = member ? member.emoji : '👤';
                    }

                    const isGroupStart = !prevMsg || prevMsg.sender !== msg.sender;
                    const isGroupEnd = !nextMsg || nextMsg.sender !== msg.sender;
                    const marginClass = isGroupEnd ? "mb-6" : "mb-2";

                    if (msg.type === 'call_invite' && msg.status === 'ringing') return null;
                    if (msg.type === 'system' && (!msg.text || !msg.text.trim())) return null;

                    const isCallLog = msg.type === 'call_invite';
                    const isPureEmoji = msg.type === 'text' && msg.text && /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])+$/.test(msg.text.trim());
                    const isPureImage = (msg.type === 'image' || msg.type === 'image_group') && !msg.text;
                    const isGameInvite = msg.type === 'game_invite' || msg.type === 'watchparty_invite' || msg.type === 'watchparty_summary';
                    const noBubble = (isPureEmoji || isPureImage) && !msg.isDeleted;
                    const isHighlighted = highlightedMessageId === msg.id;
                    const hasReplies = safeHistory.some(m => m.replyTo && m.replyTo.id === msg.id && !m.isDeleted);

                    return (
                      <React.Fragment key={msg.id}>
                        {showTimeDivider && (
                          <div className="flex justify-center my-6 animate-in fade-in">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playAudio('click', effectiveSfxEnabled);
                                setWatchWinderInitialDate(msg.created_at);
                                setIsWatchWinderOpen(true);
                              }}
                              className="retro-date-divider-btn force-pill bg-window/50 hover:bg-accent hover:text-accent-text transition-colors duration-150 px-4 py-1 retro-border shadow-sm text-[10px] font-black uppercase text-main-text/60 tracking-widest cursor-pointer select-none font-mono"
                              title="Wind back in time"
                            >
                              {dividerText}
                            </button>
                          </div>
                        )}

                        {msg.type === 'system' ? (
                          <div className="flex justify-center my-3 animate-in fade-in">
                            <div className="bg-primary/10 px-4 py-1.5 retro-border border-dashed rounded text-xs italic font-bold text-primary/80 text-center max-w-sm font-mono">
                              {msg.text}
                            </div>
                          </div>
                        ) : (
                          <div className={`flex flex-col relative group ${isMe ? 'items-end' : 'items-start'} ${marginClass} animate-in fade-in duration-200`}>
                            
                            <div id={`msg-${msg.id}`} className={`flex items-end gap-2 max-w-[70%] relative transition-all duration-300 ${isHighlighted ? 'scale-105 brightness-110 z-30' : ''} ${isMe ? 'flex-row justify-end self-end ml-auto' : 'flex-row self-start'}`}>
                              
                              {!msg.isDeleted && !isCallLog && !isMobile && (
                                <div className={`
                                  absolute top-1/2 -translate-y-1/2 transition-all duration-300 z-20
                                  ${isMe ? '-left-10 md:group-hover:left-[-45px]' : '-right-10 md:group-hover:right-[-45px]'}
                                  opacity-0 md:group-hover:opacity-100
                                `}>
                                  <button onClick={() => { playAudio('click', effectiveSfxEnabled); setActiveOptions(activeOptions === msg.id ? null : msg.id) }} className="options-trigger p-1.5 retro-border bg-window border-dashed text-main-text shadow-sm">
                                    <MoreVertical size={14} />
                                  </button>
                                </div>
                              )}

                              {/* Avatar display for others */}
                              {!isMe && (
                                <div className="w-8 h-8 flex-shrink-0 flex items-end order-first">
                                  {isGroupEnd ? (
                                    senderPfp ? (
                                      <img 
                                        src={senderPfp} 
                                        alt={senderName} 
                                        className="w-8 h-8 retro-border object-cover bg-white cursor-pointer rounded-none" 
                                        onClick={() => handleOpenProfileSidebar(msg.sender)}
                                        onContextMenu={(e) => handleContextMenu(e, msg.sender)}
                                      />
                                    ) : (
                                      <div 
                                        className="w-8 h-8 retro-border flex items-center justify-center text-[10px] retro-bg-secondary cursor-pointer rounded-none"
                                        onClick={() => handleOpenProfileSidebar(msg.sender)}
                                        onContextMenu={(e) => handleContextMenu(e, msg.sender)}
                                      >
                                        {senderEmoji}
                                      </div>
                                    )
                                  ) : <div className="w-8 text-main-text" />}
                                </div>
                              )}

                              <div
                                onTouchStart={() => isMobile && handleTouchStart(msg.id)}
                                onTouchEnd={() => isMobile && handleTouchEnd(msg.id)}
                                onTouchMove={() => isMobile && handleTouchEnd(msg.id)}
                                className={`
                                  relative flex flex-col group/bubble font-mono
                                  ${noBubble || isGameInvite ? 'p-0 bg-transparent' : 'p-2 sm:p-3.5 retro-border retro-shadow-dark'} 
                                  ${msg.isDeleted ? 'bg-transparent border-dashed border-border/50 text-main-text/50 italic shadow-none' :
                                    isCallLog ? 'bg-black/5 border-dashed italic shadow-none' :
                                      isMe ? (noBubble ? '' : 'bg-primary text-[color:var(--text-on-primary)]') : (noBubble ? '' : 'bg-window text-main-text')}
                                  ${isHighlighted ? 'ring-4 ring-accent ring-opacity-50 animate-pulse' : ''}
                                  ${isMobile ? 'active:scale-[0.98] select-none' : ''} transition-all duration-100
                                `}
                              >
                                
                                {/* Reply Preview */}
                                {msg.replyTo && !msg.isDeleted && (
                                  <div
                                    onClick={() => {
                                      const el = document.getElementById(`msg-${msg.replyTo.id}`);
                                      if (el) {
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        el.classList.add('animate-shake');
                                        setTimeout(() => el.classList.remove('animate-shake'), 1000);
                                      }
                                    }}
                                    className="border-l-4 border-border/40 bg-border/20 p-2 mb-2 text-[10px] opacity-90 cursor-pointer hover:bg-border/30 transition-all active:scale-95"
                                  >
                                    <p className="font-black uppercase tracking-tighter mb-0.5 opacity-60 font-mono">
                                      {msg.replyTo.sender === userId || msg.replyTo.sender === 'user_me' ? 'You' : 'Partner'}
                                    </p>
                                    <p className="truncate italic font-bold">{msg.replyTo.text || '📸 Media / Attachment'}</p>
                                  </div>
                                )}

                                {/* Content items */}
                                {msg.isDeleted ? (
                                  <div className="flex flex-col gap-1 px-1 py-0.5 select-none">
                                    <span className="flex items-center gap-2 text-main-text/40 italic"><Ban size={12} /> message deleted</span>
                                    <div className="flex items-center justify-end gap-1 opacity-45 text-[8px] font-bold uppercase tracking-tighter mt-1 font-mono">
                                      <span>Deleted {msg.metadata?.deletedAt || msg.time}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {msg.type === 'text' && (
                                      <div className="flex flex-col gap-1 w-full max-w-full">
                                        <span className={`${isPureEmoji ? 'text-4xl sm:text-5xl' : 'break-words whitespace-pre-wrap max-w-full-break block [word-break:break-word] overflow-hidden'}`}>{formatMessage(msg.text, msg.isEdited)}</span>
                                        <PostPreviewCard text={msg.text} />
                                      </div>
                                    )}
                                    
                                    {msg.type === 'voice' && (
                                       <div className="flex flex-col gap-1 w-[240px] sm:w-[300px]">
                                         <VoiceMessagePlayer duration={msg.duration} audioUrl={msg.url || msg.audioUrl} isMe={isMe} />
                                         {renderMediaToolbar({ ...msg, url: msg.url || msg.audioUrl, fileName: `voice_note_${msg.id}.wav` }, isMe)}
                                       </div>
                                     )}

                                     {msg.type === 'video' && (
                                       <div className="flex flex-col gap-2 relative group/video w-full max-w-[280px] sm:max-w-xs overflow-hidden rounded-lg">
                                         {msg.metadata?.isViewOnce ? (
                                            <ViewOnceMedia 
                                              url={msg.url} 
                                              type="video" 
                                              onClick={() => openViewer(msg.url, msg.id)}
                                              className="w-full aspect-video retro-border"
                                            />
                                         ) : (
                                           <RetroMediaPlayer
                                             url={msg.url}
                                             type="video"
                                             autoPlay={false}
                                             className="w-full aspect-video retro-border"
                                             onClick={() => openViewer(msg.url, msg.id)}
                                           />
                                         )}
                                         {msg.text && <span className="italic text-xs opacity-80 break-words">{msg.text}</span>}
                                         {!msg.metadata?.isViewOnce && renderMediaToolbar(msg, isMe)}
                                       </div>
                                     )}

                                     {msg.type === 'audio' && (
                                       <div className="w-[240px] sm:w-[320px] max-w-full overflow-hidden flex flex-col gap-1">
                                         <RetroMediaPlayer
                                           url={msg.url}
                                           type="audio"
                                           autoPlay={false}
                                           fileName={msg.fileName}
                                           className="w-full retro-border bg-window/20"
                                         />
                                         <span className="text-[9px] font-black uppercase tracking-tighter opacity-40 flex items-center gap-1 mt-1 truncate font-mono">
                                           <Music size={10} /> {msg.fileName || 'Audio Message'}
                                         </span>
                                         {renderMediaToolbar(msg, isMe)}
                                       </div>
                                     )}

                                     {msg.type === 'file' && (
                                       <div className="flex flex-col gap-2 min-w-[220px]">
                                         {(() => {
                                           const fileStyle = getFileStyle(msg.fileName);
                                           const FileIcon = fileStyle.icon;
                                           return (
                                             <a href={msg.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-window retro-border hover:bg-accent/10 transition-all group no-underline text-main-text rounded-md">
                                               <div className={`p-2 rounded ${fileStyle.color} group-hover:scale-110 transition-transform`}>
                                                 <FileIcon size={24} />
                                               </div>
                                               <div className="flex flex-col overflow-hidden">
                                                 <span className="font-bold text-xs truncate w-32">{msg.fileName || 'Attachment'}</span>
                                                 <span className="text-[9px] opacity-45 uppercase font-black font-mono">{msg.fileSize ? `${(msg.fileSize / 1024).toFixed(1)} KB` : fileStyle.label}</span>
                                               </div>
                                               <Download size={16} className="ml-auto opacity-30 group-hover:opacity-100" />
                                             </a>
                                           );
                                         })()}
                                         {renderMediaToolbar(msg, isMe)}
                                       </div>
                                     )}

                                     {msg.type === 'game_invite' && (
                                      <div className="retro-border retro-shadow-dark bg-window p-3 w-64 text-main-text mt-1">
                                        <div className="flex items-center gap-2 mb-3 border-b-2 border-border/20 pb-2">
                                          <Gamepad2 size={18} className="text-primary" />
                                          <span className="font-black text-[10px] uppercase tracking-widest font-mono">Activity Invite</span>
                                        </div>
                                        <p className="text-xs font-bold mb-4 opacity-80">{msg.text || `Join me for ${msg.gameTitle || "a game"}!`}</p>
                                        <button onClick={() => handleJoinGame(msg)} className="w-full py-2 text-xs font-bold bg-accent text-accent-text retro-border retro-shadow-dark hover:brightness-110 transition-all">Join Now</button>
                                      </div>
                                    )}

                                    {msg.type === 'call_invite' && (
                                      <div className="flex flex-col gap-1 py-1 min-w-[160px]">
                                        <div className="flex items-center gap-3">
                                          <div className={`p-2 retro-border retro-shadow-dark flex-shrink-0 ${msg.status === 'missed' ? 'bg-[var(--color-destructive)] text-white' : 'bg-gray-100 text-gray-500'}`}>
                                            {msg.status === 'missed' ? <PhoneOff size={16} /> : <Phone size={16} />}
                                          </div>
                                          <div className="flex flex-col text-main-text">
                                            <span className="text-[11px] font-black uppercase tracking-widest leading-none mb-1 font-mono">
                                              {msg.status === 'ringing' ? 'Calling...' : 'Call Log'}
                                            </span>
                                            <span className="text-[9px] opacity-40 font-bold font-mono">{msg.time}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {msg.type === 'image' && (
                                       <div className="flex flex-col gap-2">
                                         <div className={`relative ${isPng(msg) ? 'bg-transparent-checkerboard' : 'bg-black/5'} rounded-md overflow-hidden`}>
                                           {msg.metadata?.isViewOnce ? (
                                              <ViewOnceMedia 
                                                url={msg.url} 
                                                type="image" 
                                                onClick={() => openViewer(msg.url, msg.id)}
                                                className={`${isPureImage ? 'w-48 sm:w-64' : 'w-32 h-32 sm:w-48 sm:h-48'}`}
                                              />
                                           ) : (
                                             <SecureImage
                                               url={msg.url}
                                               alt=""
                                               onClick={() => openViewer(msg.url, msg.id)}
                                               className={`${isPureImage ? 'w-48 sm:w-64' : 'w-32 h-32 sm:w-48 sm:h-48'} object-contain retro-border cursor-pointer hover:brightness-95 transition-all`}
                                             />
                                           )}
                                         </div>
                                         {msg.text && <span className="italic text-xs opacity-80 break-words whitespace-pre-wrap max-w-full-break block">{msg.text}</span>}
                                         {!msg.metadata?.isViewOnce && renderMediaToolbar(msg, isMe)}
                                       </div>
                                     )}
                                  </>
                                )}

                                {/* Thread replies count */}
                                {hasReplies && !msg.isDeleted && (
                                  <div 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      playAudio('click', effectiveSfxEnabled);
                                      const replies = safeHistory.filter(m => m.replyTo && m.replyTo.id === msg.id && !m.isDeleted);
                                      if (replies.length > 0) {
                                        const firstEl = document.getElementById(`msg-${replies[0].id}`);
                                        firstEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      }
                                    }}
                                    className={`flex items-center gap-1.5 mt-1.5 mb-1 cursor-pointer select-none hover:text-accent font-black text-[9px] uppercase tracking-tighter transition-colors font-mono ${
                                      isMe ? 'justify-end text-primary-text/80' : 'justify-start text-main-text/60'
                                    }`}
                                  >
                                    <Reply size={11} className="transform scale-x-[-1]" />
                                    <span>{safeHistory.filter(m => m.replyTo && m.replyTo.id === msg.id && !m.isDeleted).length} replies</span>
                                  </div>
                                )}

                                {/* Timestamp details */}
                                {!msg.isDeleted && !isCallLog && !noBubble && !isGameInvite && (
                                  <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end text-current' : 'justify-end text-main-text'} opacity-60 text-[9px] font-bold uppercase tracking-tighter font-mono`}>
                                    <span>{msg.time}</span>
                                    {isMe && msg.status && msg.status !== 'failed' && (
                                      <span className="flex -space-x-1.5 ml-1">
                                        <Check size={10} className={msg.status === 'read' ? 'text-green-300 drop-shadow-md' : 'opacity-70'} />
                                        {(msg.status === 'delivered' || msg.status === 'read') && <Check size={10} className={msg.status === 'read' ? 'text-green-300 drop-shadow-md' : 'opacity-70'} />}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Reactions list */}
                                {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && !isCallLog && (
                                  <div className={`absolute -bottom-3 ${isMe ? 'right-2' : 'left-2'} bg-window text-main-text retro-border retro-shadow-dark px-2 py-0.5 text-[11px] flex gap-1 z-10 animate-in zoom-in-50`}>
                                    {msg.reactions.map((r, i) => (
                                      <span key={i} className="hover:scale-125 transition-transform cursor-default">
                                        {typeof r === 'string' ? r : r.emoji}
                                      </span>
                                    ))}
                                  </div>
                                )}

                              </div>

                              {/* Options Dropdown menu popup */}
                              {activeOptions === msg.id && (
                                <>
                                  {isMobile && (
                                    <div className="fixed inset-0 bg-black/45 z-[999]" onClick={(e) => { e.stopPropagation(); setActiveOptions(null); }} />
                                  )}
                                  <div className={`
                                    message-options-menu absolute z-[1000] bg-window retro-border retro-shadow py-1.5 flex flex-col w-44 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-main-text rounded-md shadow-2xl border-2
                                    ${isMobile ? 'left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 fixed border-4' : (isMe ? 'right-[calc(100%+12px)]' : 'left-[calc(100%+12px)]')}
                                    ${!isMobile && index >= visibleMsgs.length - 3 ? 'bottom-0' : 'top-0'} 
                                  `}>
                                    <button onClick={() => { setReplyingTo(msg); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-accent hover:text-accent-text text-left transition-colors"><Reply size={14} className="text-[var(--color-cta)]" /> Reply</button>
                                    <button onClick={() => { 
                                      if (activeChannel.isReal) {
                                        syncUpdateMessage(msg.id, { isPinned: !msg.isPinned }); 
                                      } else {
                                        updateDemoMessage(msg.id, { isPinned: !msg.isPinned });
                                      }
                                      setActiveOptions(null); 
                                    }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-accent hover:text-accent-text text-left transition-colors"><Pin size={14} className="text-orange-500" /> {msg.isPinned ? 'Unpin' : 'Pin'}</button>

                                    <div className="flex items-center justify-around px-1 py-2 border-y-2 border-border/10 bg-border/5 my-1">
                                      {['❤️', '😂', '😢', '😮', '😡'].map(emoji => (
                                        <button key={emoji} onClick={() => {
                                          const rs = msg.reactions || [];
                                          if (activeChannel.isReal) {
                                            syncUpdateMessage(msg.id, { reactions: rs.includes(emoji) ? rs.filter(e => e !== emoji) : [...rs, emoji] });
                                          } else {
                                            updateDemoMessage(msg.id, { reactions: rs.includes(emoji) ? rs.filter(e => e !== emoji) : [...rs, emoji] });
                                          }
                                          setActiveOptions(null);
                                        }} className="text-base p-1 hover:scale-150 transition-transform active:scale-95">{emoji}</button>
                                      ))}
                                    </div>

                                    {isMe && !msg.isDeleted && msg.type === 'text' && (
                                      <button onClick={() => {
                                         setEditingMsgId(msg.id);
                                         setInput(msg.text);
                                         setActiveOptions(null);
                                         if (textareaRef.current) {
                                           textareaRef.current.innerHTML = markdownToHtml(msg.text);
                                         }
                                       }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-accent hover:text-accent-text text-left transition-colors"><Edit2 size={14} className="text-green-600" /> Edit</button>
                                    )}
                                    {!msg.isDeleted && (
                                      <button onClick={() => { setDeleteTargetMessage(msg); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-red-100 text-red-600 text-left transition-colors"><Trash2 size={14} /> Delete</button>
                                    )}
                                  </div>
                                </>
                              )}

                            </div>

                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}

                  <div ref={messagesEndRef} className="h-4" />

                  {/* Typing indicators */}
                  {isTypingActive && (
                    <div className="flex items-center gap-2 mb-4 animate-in fade-in duration-300">
                      <div className="w-8 h-8 bg-secondary border-2 border-border flex items-center justify-center text-sm rounded-none">
                        {activeTab === 'servers' ? '👾' : activeChannel?.emoji}
                      </div>
                      <div className="bg-window border-2 border-border px-3 py-2 text-[10px] font-bold text-main-text flex gap-1 items-center">
                        {activeTab === 'servers' ? 'Someone' : (activeChannel?.isReal ? partnerNickname : activeChannel?.name)} is typing
                        <span className="flex gap-0.5">
                          <span className="w-1 h-1 bg-main-text rounded-full animate-bounce"></span>
                          <span className="w-1 h-1 bg-main-text rounded-full animate-bounce [animation-delay:0.2s]"></span>
                          <span className="w-1 h-1 bg-main-text rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

            </div>

            {/* Message input bar form */}
            <div className="flex flex-col bg-accent text-accent-text border-t-2 border-border relative shrink-0">
              {showEmojiPicker && (
                <div className={isMobile ? "fixed bottom-[80px] left-0 right-0 z-[9999] animate-in slide-in-from-bottom-2 flex justify-center px-4" : "absolute bottom-full left-0 z-[var(--z-overlay)] mb-2 animate-in slide-in-from-bottom-2"}>
                  <div className="retro-border retro-shadow-dark overflow-hidden max-w-full">
                    <div className="bg-primary text-white px-2 py-1 flex justify-between items-center border-b-2 retro-border">
                      <span className="text-[10px] font-black uppercase tracking-widest font-mono">Select Emoji</span>
                      <button onClick={() => setShowEmojiPicker(false)}><X size={12} /></button>
                    </div>
                    <Suspense fallback={<div className="p-8 bg-window text-main-text font-bold font-mono">Loading...</div>}>
                      <EmojiPicker
                        onEmojiClick={onEmojiClick}
                        theme="auto"
                        skinTonesDisabled
                        searchDisabled={window.innerWidth < 640}
                        width={window.innerWidth < 640 ? 280 : 350}
                        height={350}
                      />
                    </Suspense>
                  </div>
                </div>
              )}

              {/* staged file preview banner */}
              {pendingFiles.length > 0 && (
                <div className="p-3 bg-window border-b-2 border-dashed border-border flex flex-col gap-3 animate-in slide-in-from-bottom-2 text-main-text select-none">
                  <div className="w-full flex justify-between items-center mb-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase tracking-wider text-primary font-mono">Staged for Upload:</span>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-main-text group font-mono">
                        <input type="checkbox" checked={isViewOnce} onChange={(e) => setIsViewOnce(e.target.checked)} className="w-3 h-3 accent-[var(--color-destructive)]" />
                        <span className="group-hover:text-[var(--color-destructive)] transition-colors uppercase tracking-widest">View Once</span>
                      </label>
                    </div>
                    <button onClick={() => { setPendingFiles([]); setIsViewOnce(false); }} className="text-[9px] font-bold underline opacity-60 hover:opacity-100 uppercase tracking-tighter font-mono">Clear All</button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {pendingFiles.map((item, i) => (
                      <div key={i} className="relative bg-black/5 p-1 retro-border border-dashed min-w-[64px] flex flex-col items-center justify-center group/item">
                        {item.type === 'image' ? (
                          <img src={item.data} alt="preview" className="w-16 h-16 object-cover retro-border" />
                        ) : (
                          <div className="w-16 h-16 flex flex-col items-center justify-center gap-1 bg-accent/5 text-accent overflow-hidden font-mono">
                            {item.type === 'video' ? <Video size={24} /> : item.type === 'audio' ? <Music size={24} /> : <FileText size={24} />}
                            <span className="text-[8px] font-black uppercase truncate w-14 text-center px-1">{item.name}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center gap-1 z-10">
                          <button onClick={() => setEditingFileIndex(i)} className="bg-primary text-white p-1.5 retro-border hover:scale-110 transition-transform" title="Edit Attachment"><Pencil size={12} /></button>
                          <button onClick={() => setPendingFiles(p => p.filter((_, idx) => idx !== i))} className="bg-[var(--color-destructive)] text-white p-1.5 retro-border hover:scale-110 transition-transform" title="Remove"><X size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* voice note preview bar */}
              {voicePreview !== null && (
                <div className="p-3 bg-window border-t-2 border-border flex items-center justify-between gap-3 text-main-text animate-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mic size={16} className="text-primary animate-pulse" />
                    </div>
                    <span className="text-sm font-bold uppercase tracking-tighter font-mono">Voice Note Staged</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <VoiceMessagePlayer duration={`${Math.floor(voicePreview / 60)}:${(voicePreview % 60).toString().padStart(2, '0')}`} audioUrl={voicePreviewUrl} isMe={true} />
                    <div className="flex gap-1 ml-2">
                      <button onClick={() => discardVoiceNote()} className="px-3 py-1.5 retro-border bg-window text-main-text text-[10px] font-black uppercase hover:bg-red-50 transition-colors font-mono">Discard</button>
                      <button onClick={confirmVoiceNote} className="px-3 py-1.5 retro-border bg-primary text-primary-text text-[10px] font-black uppercase hover:brightness-110 transition-all font-mono">Send Note</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Reply Preview Header bar */}
              {replyingTo && (
                <div className="p-2 bg-primary text-white border-t-2 border-border/20 flex justify-between items-center text-sm animate-in slide-in-from-bottom-1">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Reply size={14} className="flex-shrink-0" />
                    <span className="font-bold truncate font-mono">
                      Replying to {replyingTo.sender === userId || replyingTo.sender === 'user_me' ? 'You' : 'Partner'}: {replyingTo.text || '📸 Media / Attachment'}
                    </span>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-white/10 retro-border flex-shrink-0 ml-2"><X size={14} /></button>
                </div>
              )}

              {/* Chat Input form bar */}
              {!shouldShowE2EE && (
                <form onSubmit={handleSend} className="flex gap-1.5 sm:gap-2 items-center p-1.5 sm:p-3 relative bg-window z-35">
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />

                  <div className="flex items-center gap-1 sm:gap-2 pr-1 sm:pr-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-[34px] h-[34px] sm:w-[44px] sm:h-[44px] flex items-center justify-center retro-border bg-window text-main-text hover:brightness-110 transition-all shrink-0">
                      <Paperclip size={isMobile ? 15 : 20} />
                    </button>
                    <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`w-[34px] h-[34px] sm:w-[44px] sm:h-[44px] flex items-center justify-center retro-border transition-all shrink-0 ${showEmojiPicker ? 'bg-accent text-accent-text' : 'bg-window text-main-text hover:brightness-110'}`}>
                      <Smile size={isMobile ? 15 : 20} />
                    </button>
                  </div>

                  {showFormatting && (
                    <div className="absolute -top-12 left-0 right-0 mx-auto w-max bg-window retro-border shadow-lg z-50 flex gap-1 p-1 animate-in fade-in zoom-in-95 duration-200" onMouseDown={(e) => e.preventDefault()}>
                      <button type="button" onClick={() => applyFormatting('bold')} className="w-8 h-8 flex items-center justify-center font-serif font-bold hover:bg-accent hover:text-accent-text transition-colors text-main-text" title="Bold">B</button>
                      <button type="button" onClick={() => applyFormatting('italic')} className="w-8 h-8 flex items-center justify-center font-serif italic hover:bg-accent hover:text-accent-text transition-colors text-main-text" title="Italic">I</button>
                      <button type="button" onClick={() => applyFormatting('strikeThrough')} className="w-8 h-8 flex items-center justify-center font-serif line-through hover:bg-accent hover:text-accent-text transition-colors text-main-text" title="Strikethrough">S</button>
                      <button type="button" onClick={() => applyFormatting('subscript')} className="w-8 h-8 flex items-center justify-center font-serif text-[10px] hover:bg-accent hover:text-accent-text transition-colors text-main-text" title="Subscript">x₂</button>
                      <button type="button" onClick={() => applyFormatting('superscript')} className="w-8 h-8 flex items-center justify-center font-serif text-[10px] hover:bg-accent hover:text-accent-text transition-colors text-main-text" title="Superscript">x²</button>
                      <div className="w-px bg-border mx-1 my-1"></div>
                      <button type="button" onClick={() => {
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount) {
                          document.execCommand('insertText', false, toTrollCase(sel.toString()));
                        }
                      }} className="w-8 h-8 flex items-center justify-center font-bold text-[10px] hover:bg-accent hover:text-accent-text transition-colors text-main-text" title="Trollcase">tRoLl</button>
                    </div>
                  )}

                  <div className="flex-1 relative flex items-center bg-window retro-inset overflow-hidden min-h-[34px] sm:min-h-[44px]">
                    <div
                      contentEditable={!isRecording && voicePreview === null && !isInputDisabled}
                      ref={textareaRef}
                      onInput={handleInputChange}
                      onKeyDown={handleKeyDown}
                      data-placeholder={pendingFiles.length > 0 ? "Add a caption..." : "type a message..."}
                      suppressContentEditableWarning={true}
                      className={`w-full p-1.5 sm:p-2.5 focus:outline-none font-bold placeholder:font-normal text-xs sm:text-base chat-input-textarea resize-none overflow-y-auto text-main-text self-center empty:before:content-[attr(data-placeholder)] empty:before:opacity-50 empty:before:pointer-events-none empty:before:font-normal ${isRecording ? 'text-[var(--color-danger)] animate-pulse bg-[var(--color-danger)]/15' : 'bg-transparent'}`}
                      style={{ minHeight: isMobile ? '34px' : '44px', maxHeight: '120px' }}
                    />
                  </div>

                  {activeTab === 'servers' && !isMobile && (
                    <div className="flex items-center gap-1 px-1 shrink-0 font-mono">
                      {/* Gift */}
                      <button
                        type="button"
                        onClick={() => { playAudio('click', effectiveSfxEnabled); addToast("Nitro Gift select opened!", "info"); }}
                        className="p-1 hover:bg-black/5 text-muted-text hover:text-primary transition-colors"
                        title="Send a Nitro Gift"
                      >
                        <Gift size={15} />
                      </button>
                      
                      {/* GIF */}
                      <button
                        type="button"
                        onClick={() => { playAudio('click', effectiveSfxEnabled); addToast("GIF picker opened!", "info"); }}
                        className="px-1 py-0.5 text-[8.5px] font-black border-2 border-muted-text hover:border-primary text-muted-text hover:text-primary transition-colors tracking-tighter"
                        title="Search GIFs"
                      >
                        GIF
                      </button>
                      
                      {/* Stickers */}
                      <button
                        type="button"
                        onClick={() => { playAudio('click', effectiveSfxEnabled); addToast("Sticker list opened!", "info"); }}
                        className="p-1 hover:bg-black/5 text-muted-text hover:text-primary transition-colors text-xs font-black"
                        title="Send a Sticker"
                      >
                        🎴
                      </button>
                      
                      {/* Activities */}
                      <button
                        type="button"
                        onClick={() => { playAudio('click', effectiveSfxEnabled); addToast("Activities dashboard opened!", "info"); }}
                        className="p-1 hover:bg-black/5 text-muted-text hover:text-primary transition-colors"
                        title="Start an Activity"
                      >
                        <Gamepad2 size={15} />
                      </button>
                    </div>
                  )}

                  <div className="flex shrink-0">
                    {!input.trim() && !editingMsgId && voicePreview === null && pendingFiles.length === 0 ? (
                      <button type="button" onMouseDown={handleMicDown} onMouseUp={handleMicUp} onMouseLeave={handleMicUp} onTouchStart={handleMicDown} onTouchEnd={handleMicUp} className={`w-[34px] h-[34px] sm:w-[44px] sm:h-[44px] flex items-center justify-center retro-outset select-none ${isRecording ? 'bg-[var(--color-danger)] text-white shadow-none translate-y-[2px]' : 'bg-window text-main-text hover:brightness-110'}`}>
                        <RetroIcon icon={Mic} size={isMobile ? 15 : 20} className={isRecording ? 'animate-bounce' : ''} />
                      </button>
                    ) : (
                      <button type="submit" className="w-[34px] h-[34px] sm:w-[44px] sm:h-[44px] flex items-center justify-center bg-primary text-primary-text retro-outset hover:brightness-110">
                        <RetroIcon icon={Send} size={isMobile ? 15 : 20} />
                      </button>
                    )}
                  </div>

                </form>
              )}

            </div>
          </div>
        </RetroWindow>

        {/* Column 3: Detail Panel Sidebar (details.sys) */}
        <RetroWindow
          title={sidebarView === 'profile' ? "profile.sys" : "details.sys"}
          onClose={() => {
            playAudio('click', effectiveSfxEnabled);
            if (isMobile) {
              setMobileView('chat');
            } else {
              setShowDetails(false);
            }
          }}
          className={`${(isMobile ? mobileView === 'details' : showDetails) ? 'flex' : 'hidden'} w-full md:w-72 lg:w-80 shrink-0 h-full flex flex-col min-h-0`}
          noPadding
          sfx={effectiveSfxEnabled}
        >
          {/* Right Detail Panel content */}
          <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0">
            {sidebarView === 'profile' ? (
              /* Discord-style profile overview */
              (() => {
                const profileUser = getMemberProfile(profileUserId);
                if (!profileUser) {
                  return (
                    <div className="p-4 text-center font-mono text-[10px] font-bold opacity-50 lowercase">
                      no user selected
                    </div>
                  );
                }

                // Calculate mutual servers
                const mutualServers = servers.filter(server => 
                  server.members?.some(m => m.id === userId || m.id === 'user_me') && 
                  server.members?.some(m => m.id === profileUser.id)
                );

                // Calculate mutual friends
                const mutualFriendsSet = new Set();
                mutualServers.forEach(server => {
                  server.members?.forEach(m => {
                    if (m.id !== userId && m.id !== 'user_me' && m.id !== profileUser.id) {
                      mutualFriendsSet.add(m.id);
                    }
                  });
                });
                const mutualFriends = Array.from(mutualFriendsSet)
                  .map(id => getMemberProfile(id))
                  .filter(Boolean);

                // Get active game detail
                let activeGame = getGameDetails(profileUser.activity);
                if (!activeGame) {
                  if (profileUser.id === 'retrogamer') {
                    activeGame = { id: 'wordle', name: 'Wordle', icon: '📝', detail: 'Playing Wordle Race' };
                  } else if (profileUser.id === 'crayoncat') {
                    activeGame = { id: 'sudoku', name: 'Sudoku', icon: '🔢', detail: 'Playing Sudoku' };
                  } else if (profileUser.id === partnerId) {
                    activeGame = { id: 'ludo', name: 'Ludo', icon: '🎲', detail: 'Playing Ludo' };
                  }
                }

                // Status dot color
                const statusColor = profileUser.status === 'active' 
                  ? 'bg-success' 
                  : profileUser.status === 'idle' 
                    ? 'bg-warning' 
                    : 'bg-disabled';

                return (
                  <div className="flex-1 flex flex-col h-full overflow-hidden relative font-mono text-main-text select-none">
                    {/* Scrollable Container */}
                    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col pb-4">
                      {/* Banner */}
                      <div className={`h-[80px] w-full shrink-0 relative ${profileUser.banner}`} />
                      
                      {/* Avatar Area */}
                      <div className="relative px-4 -mt-10 mb-2 flex justify-between items-end">
                        {/* Circular Avatar */}
                        <div className="w-[72px] h-[72px] bg-window border-[4px] border-window rounded-full overflow-hidden relative select-none">
                          <img 
                            src={profileUser.pfp} 
                            alt={profileUser.name} 
                            className="w-full h-full object-cover" 
                          />
                          {/* Status dot */}
                          <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-window rounded-full ${statusColor}`} />
                        </div>
                        
                        {/* Discord style badges */}
                        <div className="flex gap-1 mb-1">
                          {profileUser.tag === 'APP' && (
                            <span className="px-1.5 py-0.5 text-[8px] font-black bg-blue-500 text-white rounded flex items-center gap-0.5 uppercase tracking-wide">
                              <Check size={8} strokeWidth={3} /> APP
                            </span>
                          )}
                          {profileUser.tag === 'RVLS' && (
                            <span className="px-1.5 py-0.5 text-[8px] font-black bg-primary text-white rounded flex items-center gap-0.5 uppercase tracking-wide">
                              <Zap size={8} strokeWidth={3} /> RVLS
                            </span>
                          )}
                          {profileUser.id === partnerId && (
                            <span className="px-1.5 py-0.5 text-[8px] font-black bg-red-500 text-white rounded flex items-center gap-0.5 uppercase tracking-wide">
                              💖 SO
                            </span>
                          )}
                          {/* Some extra cute badges */}
                          <span className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center text-[10px]" title="Active Developer">
                            🛡️
                          </span>
                          <span className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center text-[10px]" title="HypeSquad">
                            ✨
                          </span>
                        </div>
                      </div>

                      {/* Profile Info Details */}
                      <div className="px-4 py-2 flex flex-col gap-3">
                        {/* Username, name, tags */}
                        <div className="flex flex-col">
                          <span className="text-base font-black uppercase tracking-tight text-main-text leading-tight">{profileUser.name}</span>
                          <span className="text-[10px] opacity-75 font-semibold font-mono tracking-tight lowercase">
                            @{profileUser.username}
                          </span>
                        </div>

                        {/* Bio */}
                        {profileUser.bio && (
                          <div className="bg-black/5 p-2 border border-border border-dashed">
                            <span className="text-[8px] font-black uppercase opacity-45 tracking-widest mb-1 block">About Me</span>
                            <p className="text-[10px] font-medium leading-normal text-main-text break-words">
                              {profileUser.bio}
                            </p>
                          </div>
                        )}

                        {/* Playing Arcade Game Card */}
                        {activeGame && (
                          <div className="bg-black/10 border border-primary/45 p-2.5 flex flex-col gap-2 relative">
                            <div className="flex justify-between items-center">
                              <span className="text-[8px] font-black uppercase tracking-widest text-primary">Playing A Game</span>
                              <span className="text-[9px] font-bold opacity-60">Arcade</span>
                            </div>
                            <div className="flex gap-2.5 items-center">
                              {/* Game icon */}
                              <div className="w-12 h-12 bg-primary/20 border-2 border-primary flex items-center justify-center text-2xl flex-shrink-0">
                                {activeGame.icon}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-black uppercase text-main-text leading-tight">{activeGame.name}</span>
                                <span className="text-[9px] opacity-80 font-bold font-mono">
                                  🎮 {sessionTime} elapsed
                                </span>
                                <span className="text-[8px] opacity-60 font-semibold font-mono tracking-wide truncate">
                                  {activeGame.detail}
                                </span>
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-1.5 mt-1">
                              <button
                                type="button"
                                onClick={() => handleJoinGameFromProfile(activeGame.id)}
                                className="py-1 bg-primary text-primary-text hover:brightness-110 active:translate-y-[1px] text-[10px] font-black uppercase retro-border text-center"
                              >
                                Join
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSpectateGameFromProfile(activeGame.id)}
                                className="py-1 bg-window text-main-text hover:brightness-110 active:translate-y-[1px] text-[10px] font-black uppercase retro-border text-center"
                              >
                                Spectate
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Member Since Container */}
                        <div className="bg-black/5 p-2 border border-border">
                          <span className="text-[8px] font-black uppercase opacity-45 tracking-widest mb-0.5 block">Member Since</span>
                          <span className="text-[10px] font-bold text-main-text">{profileUser.memberSince}</span>
                        </div>

                        {/* Mutual Servers (Expandable) */}
                        <div className="border border-border bg-window/50">
                          <button 
                            type="button"
                            onClick={() => {
                              playAudio('click', effectiveSfxEnabled);
                              setMutualServersExpanded(!mutualServersExpanded);
                            }}
                            className="w-full px-2.5 py-1.5 flex items-center justify-between text-[10px] font-black uppercase hover:bg-black/5"
                          >
                            <span>Mutual Servers — {mutualServers.length}</span>
                            <ChevronRight size={12} className={`transform transition-transform ${mutualServersExpanded ? 'rotate-90' : ''}`} />
                          </button>
                          {mutualServersExpanded && (
                            <div className="px-2.5 pb-2.5 pt-1 border-t border-dashed border-border/20 flex flex-col gap-1.5 bg-black/5 max-h-[150px] overflow-y-auto">
                              {mutualServers.map(server => (
                                <div key={server.id} className="flex items-center gap-2 py-0.5 border-b border-border/10 last:border-0">
                                  <span className="text-xs">{server.icon}</span>
                                  <span className="text-[9px] font-bold uppercase truncate">{server.name}</span>
                                </div>
                              ))}
                              {mutualServers.length === 0 && (
                                <span className="text-[9px] font-bold opacity-50 text-center py-2">no mutual servers</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Mutual Friends (Expandable) */}
                        <div className="border border-border bg-window/50">
                          <button 
                            type="button"
                            onClick={() => {
                              playAudio('click', effectiveSfxEnabled);
                              setMutualFriendsExpanded(!mutualFriendsExpanded);
                            }}
                            className="w-full px-2.5 py-1.5 flex items-center justify-between text-[10px] font-black uppercase hover:bg-black/5"
                          >
                            <span>Mutual Friends — {mutualFriends.length}</span>
                            <ChevronRight size={12} className={`transform transition-transform ${mutualFriendsExpanded ? 'rotate-90' : ''}`} />
                          </button>
                          {mutualFriendsExpanded && (
                            <div className="px-2.5 pb-2.5 pt-1 border-t border-dashed border-border/20 flex flex-col gap-1.5 bg-black/5 max-h-[150px] overflow-y-auto">
                              {mutualFriends.map(friend => (
                                <div key={friend.id} className="flex items-center gap-2 py-0.5 border-b border-border/10 last:border-0">
                                  <img src={friend.pfp} alt={friend.name} className="w-5 h-5 retro-border object-cover bg-white" />
                                  <span className="text-[9px] font-bold uppercase truncate">{friend.name}</span>
                                </div>
                              ))}
                              {mutualFriends.length === 0 && (
                                <span className="text-[9px] font-bold opacity-50 text-center py-2">no mutual friends</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Docked View Full Profile at Bottom */}
                    <div className="border-t border-border bg-window/80 backdrop-blur-sm shrink-0 mt-auto">
                      <button 
                        type="button"
                        onClick={() => {
                          playAudio('click', effectiveSfxEnabled);
                          window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId: profileUser.id } }));
                        }}
                        className="w-full py-2.5 text-[10px] font-black uppercase tracking-wider text-center hover:bg-primary hover:text-primary-text active:translate-y-[1px] transition-all"
                      >
                        View Full Profile
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (activeTab === 'dms' || activeTab === 'bubbles') ? (
              /* Original DM sidebar structure with Partner Profile + Tabs (Media, Calls, Search, Settings) */
              <>
                <div className="flex border-b border-border bg-window/50 shrink-0 overflow-x-auto whitespace-nowrap">
                  {activeTab === 'bubbles' && (
                    <button 
                      onClick={() => setActiveSidebarTab('info')} 
                      className={`flex-1 py-2.5 px-2 transition-all flex items-center justify-center border-b-2 ${activeSidebarTab === 'info' ? 'border-b-primary bg-window text-main-text' : 'border-b-transparent text-muted-text hover:text-main-text hover:bg-window/5'}`}
                      title="Info"
                    >
                      <Info size={14} />
                    </button>
                  )}
                  {activeTab === 'bubbles' && (
                    <button 
                      onClick={() => setActiveSidebarTab('members')} 
                      className={`flex-1 py-2.5 px-2 transition-all flex items-center justify-center border-b-2 ${activeSidebarTab === 'members' ? 'border-b-primary bg-window text-main-text' : 'border-b-transparent text-muted-text hover:text-main-text hover:bg-window/5'}`}
                      title="Members"
                    >
                      <Users size={14} />
                    </button>
                  )}
                  <button 
                    onClick={() => setActiveSidebarTab('media')} 
                    className={`flex-1 py-2.5 px-2 transition-all flex items-center justify-center border-b-2 ${activeSidebarTab === 'media' ? 'border-b-primary bg-window text-main-text' : 'border-b-transparent text-muted-text hover:text-main-text hover:bg-window/5'}`}
                    title="Media"
                  >
                    <ImageIcon size={14} />
                  </button>
                  {activeTab !== 'bubbles' && (
                    <button 
                      onClick={() => setActiveSidebarTab('calls')} 
                      className={`flex-1 py-2.5 px-2 transition-all flex items-center justify-center border-b-2 ${activeSidebarTab === 'calls' ? 'border-b-primary bg-window text-main-text' : 'border-b-transparent text-muted-text hover:text-main-text hover:bg-window/5'}`}
                      title="Calls"
                    >
                      <History size={14} />
                    </button>
                  )}
                  <button 
                    onClick={() => setActiveSidebarTab('search')} 
                    className={`flex-1 py-2.5 px-2 transition-all flex items-center justify-center border-b-2 ${activeSidebarTab === 'search' ? 'border-b-primary bg-window text-main-text' : 'border-b-transparent text-muted-text hover:text-main-text hover:bg-window/5'}`}
                    title="Search"
                  >
                    <Search size={14} />
                  </button>
                  <button 
                    onClick={() => setActiveSidebarTab('settings')} 
                    className={`flex-1 py-2.5 px-2 transition-all flex items-center justify-center border-b-2 ${activeSidebarTab === 'settings' ? 'border-b-primary bg-window text-main-text' : 'border-b-transparent text-muted-text hover:text-main-text hover:bg-window/5'}`}
                    title="Settings"
                  >
                    <Settings size={14} />
                  </button>
                </div>

                <div className="p-4 flex-1 overflow-hidden flex flex-col min-h-0 text-main-text">

                  {activeSidebarTab === 'info' && activeTab === 'bubbles' && activeChannel && (
                    <div className="flex flex-col h-full overflow-y-auto pr-1 font-mono select-none">
                      <span className="text-[10px] font-black uppercase opacity-45 mb-3 tracking-widest">About Bubble</span>
                      
                      <div className="retro-border p-3 bg-window mb-4 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 retro-border bg-window flex items-center justify-center text-xl shadow-inner shrink-0">
                            {activeChannel.icon || '💬'}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs font-black uppercase truncate block">{activeChannel.name}</span>
                            <span className="text-[9px] opacity-60 font-bold uppercase tracking-wider block">
                              Group Chat Bubble
                            </span>
                          </div>
                        </div>

                        {activeChannel.description && (
                          <p className="text-[10px] font-semibold opacity-75 border-t border-dashed border-border/20 pt-2">
                            {activeChannel.description}
                          </p>
                        )}
                      </div>

                      <div className="retro-border p-3 bg-window mb-4 flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase opacity-45 tracking-widest mb-1">Details</span>
                        <div className="flex justify-between items-center text-[10px] border-b border-dashed border-border/10 pb-1">
                          <span className="opacity-60">Created By</span>
                          <span className="font-bold">{roomProfiles[activeChannel.owner_id]?.name || 'User'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] border-b border-dashed border-border/10 pb-1">
                          <span className="opacity-60">Created At</span>
                          <span className="font-bold">
                            {activeChannel.created_at ? new Date(activeChannel.created_at).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="opacity-60">Total Members</span>
                          <span className="font-bold">{activeChannel.members?.length || 0}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col gap-2 mt-auto">
                        {activeChannel.owner_id === userId ? (
                          <button 
                            onClick={handleDeleteBubble} 
                            className="w-full py-2 bg-red-600 text-white text-[10px] font-black uppercase retro-border hover:bg-red-700 transition-all active:translate-y-[1px]"
                          >
                            Delete Bubble
                          </button>
                        ) : (
                          <button 
                            onClick={handleLeaveBubble} 
                            className="w-full py-2 bg-red-600 text-white text-[10px] font-black uppercase retro-border hover:bg-red-700 transition-all active:translate-y-[1px]"
                          >
                            Leave Bubble
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {activeSidebarTab === 'members' && activeTab === 'bubbles' && (
                    <div className="flex flex-col h-full overflow-y-auto pr-1 font-mono">
                      <span className="text-[10px] font-black uppercase opacity-45 mb-3 tracking-widest">Members — {activeChannel?.members?.length || 0}</span>
                      <div className="flex flex-col gap-2">
                        {activeChannel?.members?.map(member => (
                          <div 
                            key={member.id} 
                            className="flex items-center gap-2 group/member cursor-pointer p-1 hover:bg-black/5 rounded transition-all" 
                            onClick={() => handleOpenProfileSidebar(member.id)}
                          >
                            <div className="relative flex-shrink-0">
                              <img 
                                src={getRetroPfpUrl(member.name)} 
                                alt={member.name} 
                                className="w-7 h-7 retro-border object-cover bg-white" 
                              />
                              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border border-window rounded-full bg-success" />
                            </div>
                            <div className="flex flex-col leading-none min-w-0 flex-1">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-xs font-bold truncate">{member.name}</span>
                                {member.id === activeChannel.owner_id && (
                                  <Crown size={10} className="text-yellow-500 fill-yellow-500 shrink-0" title="Bubble Owner" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeSidebarTab === 'media' && (
                    <div className="flex flex-col h-full">
                      <span className="text-[10px] font-black uppercase opacity-45 mb-3 tracking-widest font-mono">Shared Media</span>
                      <div className="grid grid-cols-3 gap-1 overflow-y-auto pr-1">
                        {mediaMessages.map(msg => (
                          <div key={msg.id} className="aspect-square bg-black/5 retro-border overflow-hidden cursor-pointer" onClick={() => openViewer(msg.url, msg.id)}>
                            <SecureImage url={msg.url} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                          </div>
                        ))}
                        {mediaMessages.length === 0 && (
                          <span className="col-span-3 text-[10px] font-bold opacity-50 text-center py-4 lowercase font-mono">no shared files yet</span>
                        )}
                      </div>
                    </div>
                  )}

                  {activeSidebarTab === 'calls' && (
                    <div className="flex flex-col h-full">
                      <span className="text-[10px] font-black uppercase opacity-45 mb-3 tracking-widest font-mono">Call Logs</span>
                      <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                        {callHistory.map(call => (
                          <div key={call.id} className="p-2 bg-window retro-border flex items-center gap-2">
                            <Phone size={12} className="text-primary" />
                            <div className="flex flex-col font-mono">
                              <span className="text-[10px] font-bold">Couple Call</span>
                              <span className="text-[8px] opacity-65">{call.time}</span>
                            </div>
                          </div>
                        ))}
                        {callHistory.length === 0 && (
                          <span className="text-[10px] font-bold opacity-50 text-center py-4 lowercase font-mono">no call logs</span>
                        )}
                      </div>
                    </div>
                  )}

                  {activeSidebarTab === 'search' && (
                    <div className="flex flex-col h-full min-h-0">
                      <div className="flex bg-window retro-inset p-2 mb-3">
                        <input
                          type="text"
                          ref={searchInputRef}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search..."
                          className="bg-transparent outline-none w-full text-xs font-black uppercase text-main-text font-mono"
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                        {searchResults.map(msg => (
                          <div key={msg.id} onClick={() => handleJumpToMessage(msg.id, msg.created_at)} className="p-2 bg-window retro-border cursor-pointer hover:bg-accent/15 transition-all text-left">
                            <div className="flex justify-between items-center mb-1 text-[8px] font-bold uppercase opacity-65 font-mono">
                              <span>{msg.sender === userId || msg.sender === 'user_me' ? 'You' : 'Partner'}</span>
                              <span>{msg.time}</span>
                            </div>
                            <p className="text-[10px] font-medium truncate">{msg.text}</p>
                          </div>
                        ))}
                        {searchQuery && searchResults.length === 0 && (
                          <span className="text-[10px] font-bold opacity-50 text-center py-4 lowercase font-mono">no results found</span>
                        )}
                      </div>
                    </div>
                  )}

                  {activeSidebarTab === 'settings' && (
                    <div className="flex flex-col h-full overflow-y-auto pr-1 font-mono">
                      <span className="text-[10px] font-black uppercase opacity-45 mb-3 tracking-widest">Encryption & History</span>
                      
                      {activeChannel?.isReal && (
                        <div className="flex flex-col gap-3 font-mono">
                          <div className="p-3 bg-window retro-border flex flex-col gap-2">
                            <span className="text-[10px] font-black uppercase">Change PIN</span>
                            <form onSubmit={handlePinChange} className="flex flex-col gap-2">
                              <input type="password" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="New 6-digit PIN" className="bg-window text-xs font-bold retro-inset p-1.5 outline-none text-main-text" />
                              <input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} placeholder="Confirm PIN" className="bg-window text-xs font-bold retro-inset p-1.5 outline-none text-main-text" />
                              {pinChangeError && <span className="text-[9px] text-red-600 font-bold">{pinChangeError}</span>}
                              <button type="submit" className="py-1.5 bg-primary text-white text-[10px] font-black uppercase retro-border">Update PIN</button>
                            </form>
                          </div>

                          <button onClick={() => setShowResetConfirm(true)} className="w-full py-2 bg-window hover:bg-red-50 text-red-600 text-[10px] font-black uppercase border-2 border-red-600 border-dashed">Reset Encryption Keys</button>
                        </div>
                      )}

                      <button onClick={() => setShowClearChatConfirm(true)} className="w-full py-2 mt-4 bg-red-600 text-white text-[10px] font-black uppercase retro-border">Delete Chat Log</button>
                    </div>
                  )}

                </div>
              </>
            ) : (
              /* Server / Guild Right detail sidebar with Active Users list */
              <div className="flex-1 flex flex-col h-full overflow-hidden text-main-text min-h-0">
                <div className="flex border-b border-border bg-window/20 shrink-0">
                  <button 
                    onClick={() => setActiveSidebarTab('members')} 
                    className={`flex-1 py-2 px-1 transition-all border-b-2 flex items-center justify-center ${activeSidebarTab === 'members' ? 'border-b-primary bg-window text-main-text' : 'border-b-transparent text-muted-text hover:text-main-text hover:bg-window/5'}`}
                    title="Members"
                  >
                    <Users size={14} />
                  </button>
                  <button 
                    onClick={() => setActiveSidebarTab('media')} 
                    className={`flex-1 py-2 px-1 transition-all border-b-2 flex items-center justify-center ${activeSidebarTab === 'media' ? 'border-b-primary bg-window text-main-text' : 'border-b-transparent text-muted-text hover:text-main-text hover:bg-window/5'}`}
                    title="Media"
                  >
                    <ImageIcon size={14} />
                  </button>
                  <button 
                    onClick={() => setActiveSidebarTab('search')} 
                    className={`flex-1 py-2 px-1 transition-all border-b-2 flex items-center justify-center ${activeSidebarTab === 'search' ? 'border-b-primary bg-window text-main-text' : 'border-b-transparent text-muted-text hover:text-main-text hover:bg-window/5'}`}
                    title="Search"
                  >
                    <Search size={14} />
                  </button>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
                  
                  {activeSidebarTab === 'members' && (
                    <>
                      <div className="retro-border p-3 bg-window">
                        <div className="flex items-center gap-2 mb-2 select-none">
                          <span className="text-2xl">{activeServer?.icon}</span>
                          <div className="flex flex-col">
                            <span className="text-xs font-black uppercase">{activeServer?.name}</span>
                            <span className="text-[9px] opacity-60 font-bold uppercase tracking-wider font-mono">
                              {activeServer?.type === 'guild' ? '🛡️ Guild (Max 10)' : '🌳 Server'}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] font-semibold opacity-75 border-t border-dashed border-border/20 pt-2 font-mono">
                          #{activeChannel?.name}: {activeChannel?.description || 'A cozy space on the Yard network.'}
                        </p>
                      </div>

                      <div className="flex flex-col flex-1 min-h-[150px] font-mono select-none">
                        {/* Online Section */}
                        {(() => {
                          const onlineChans = activeServer?.members?.filter(m => m.isOnline) || [];
                          return (
                            <div className="mb-4">
                              <span className="text-[9px] font-black uppercase opacity-45 tracking-widest mb-2 block font-mono font-black font-black">
                                Online — {onlineChans.length}
                              </span>
                              <div className="flex flex-col gap-2">
                                {onlineChans.map(member => (
                                  <div 
                                    key={member.id} 
                                    className="flex items-center gap-2 group/member cursor-pointer p-1 hover:bg-black/5 rounded transition-all" 
                                    onContextMenu={(e) => handleContextMenu(e, member.id)}
                                    onClick={(e) => handleOpenProfileSidebar(member.id)}
                                  >
                                    <div className="relative flex-shrink-0">
                                      <img 
                                        src={getRetroPfpUrl(member.name)} 
                                        alt={member.name} 
                                        className="w-7 h-7 retro-border object-cover bg-white" 
                                      />
                                      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border border-window rounded-full bg-success" />
                                    </div>
                                    <div className="flex flex-col leading-none min-w-0 flex-1">
                                      <div className="flex items-center gap-1 flex-wrap">
                                        <span className="text-xs font-bold truncate">{member.name}</span>
                                        {member.role === 'owner' && (
                                          <Crown size={10} className="text-yellow-500 fill-yellow-500 shrink-0" title="Server Owner" />
                                        )}
                                        {member.role === 'admin' && (
                                          <span className="px-1 py-0.2 text-[7px] font-black bg-purple-600 text-white rounded flex items-center gap-0.5 uppercase scale-90 leading-none">
                                            ADM
                                          </span>
                                        )}
                                        {member.tag === 'APP' && (
                                          <span className="px-1 py-0.2 text-[7px] font-black bg-blue-500 text-white rounded flex items-center gap-0.5 uppercase">
                                            <Check size={8} strokeWidth={3} /> APP
                                          </span>
                                        )}
                                        {member.tag === 'RVLS' && (
                                          <span className="px-1 py-0.2 text-[7px] font-black bg-primary text-white rounded flex items-center gap-0.5 uppercase">
                                            <Zap size={8} strokeWidth={3} /> RVLS
                                          </span>
                                        )}
                                      </div>
                                      {member.status && (
                                        <span className="text-[8px] opacity-60 mt-0.5 truncate max-w-[140px] font-mono">{member.status}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Offline Section */}
                        {(() => {
                          const offlineChans = activeServer?.members?.filter(m => !m.isOnline) || [];
                          return (
                            <div>
                              <span className="text-[9px] font-black uppercase opacity-45 tracking-widest mb-2 block font-mono font-black">
                                Offline — {offlineChans.length}
                              </span>
                              <div className="flex flex-col gap-2">
                                {offlineChans.map(member => (
                                  <div 
                                    key={member.id} 
                                    className="flex items-center gap-2 opacity-50 group/member cursor-pointer p-1 hover:bg-black/5 rounded transition-all" 
                                    onContextMenu={(e) => handleContextMenu(e, member.id)}
                                    onClick={(e) => handleOpenProfileSidebar(member.id)}
                                  >
                                    <div className="relative flex-shrink-0">
                                      <img 
                                        src={getRetroPfpUrl(member.name)} 
                                        alt={member.name} 
                                        className="w-7 h-7 retro-border object-cover bg-white" 
                                      />
                                      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border border-window rounded-full bg-disabled" />
                                    </div>
                                    <div className="flex flex-col leading-none min-w-0 flex-1">
                                      <div className="flex items-center gap-1 flex-wrap">
                                        <span className="text-xs font-bold truncate">{member.name}</span>
                                        {member.role === 'owner' && (
                                          <Crown size={10} className="text-yellow-500 fill-yellow-500 shrink-0" title="Server Owner" />
                                        )}
                                        {member.role === 'admin' && (
                                          <span className="px-1 py-0.2 text-[7px] font-black bg-purple-600 text-white rounded flex items-center gap-0.5 uppercase scale-90 leading-none">
                                            ADM
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  )}

                  {activeSidebarTab === 'media' && (
                    <div className="grid grid-cols-3 gap-1">
                      {mediaMessages.map(msg => (
                        <div key={msg.id} className="aspect-square bg-black/5 retro-border overflow-hidden cursor-pointer" onClick={() => openViewer(msg.url, msg.id)}>
                          <img src={msg.url} className="w-full h-full object-cover hover:scale-105 transition-transform" alt="" />
                        </div>
                      ))}
                      {mediaMessages.length === 0 && (
                        <span className="col-span-3 text-[10px] font-bold opacity-50 text-center py-4 lowercase font-mono">no shared files</span>
                      )}
                    </div>
                  )}

                  {activeSidebarTab === 'search' && (
                    <div className="flex flex-col h-full min-h-0">
                      <div className="flex bg-window retro-inset p-2 mb-3">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search channel..."
                          className="bg-transparent outline-none w-full text-xs font-black uppercase text-main-text font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        {searchResults.map(msg => {
                          const isMe = msg.sender === 'user_me';
                          const sender = activeServer?.members.find(m => m.id === msg.sender)?.name || 'Someone';
                          return (
                            <div key={msg.id} onClick={() => handleJumpToMessage(msg.id, msg.created_at)} className="p-2 bg-window retro-border cursor-pointer hover:bg-accent/15 transition-all text-left">
                              <div className="flex justify-between items-center mb-1 text-[8px] font-bold uppercase opacity-65 font-mono">
                                <span>{isMe ? 'You' : sender}</span>
                                <span>{msg.time}</span>
                              </div>
                              <p className="text-[10px] font-medium truncate">{msg.text}</p>
                            </div>
                          );
                        })}
                        {searchQuery && searchResults.length === 0 && (
                          <span className="text-[10px] font-bold opacity-50 text-center py-4 lowercase font-mono font-mono">no results found</span>
                        )}
                      </div>
                    </div>
                  )}

                </div>
                
                {/* Option to clear channel log */}
                {activeServer?.id !== HANGOUT_SERVER_ID && (
                  <div className="p-4 border-t border-dashed border-border/20 shrink-0">
                    <button onClick={clearDemoChat} className="w-full py-2 bg-red-600 text-white text-[10px] font-black uppercase retro-border font-mono">Clear Channel Log</button>
                  </div>
                )}

              </div>
            )}
          </div>
        </RetroWindow>

      </div>

      {/* PocketWatchWinder for time travel scroll jump date selector (rendered at root context) */}
      {isWatchWinderOpen && (
        <PocketWatchWinder
          initialDate={watchWinderInitialDate}
          roomId={roomId}
          sfx={effectiveSfxEnabled}
          onClose={() => setIsWatchWinderOpen(false)}
          onJumpToDate={async (date) => {
            setIsWatchWinderOpen(false);
            if (date) {
              setWatchWinderInitialDate(date.toISOString());
              await handleJumpToMessage(null, date.toISOString());
            }
          }}
        />
      )}

      {/* Message deletion modal popup */}
      {deleteTargetMessage && (
        <div className="fixed inset-0 z-[var(--z-modal)] bg-black/35 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <RetroWindow title="delete_message.exe" onClose={() => setDeleteTargetMessage(null)} className="w-full max-w-[280px]">
            <div className="flex flex-col gap-4 text-main-text font-mono">
              <p className="font-bold text-xs">
                {deleteTargetMessage.sender === userId || deleteTargetMessage.sender === 'user_me'
                  ? "Would you like to delete this message for everyone or just for you?" 
                  : "This will only delete the message from your end. Your partner will still be able to see it."}
              </p>
              <div className="flex flex-col gap-2 mt-2">
                {(deleteTargetMessage.sender === userId || deleteTargetMessage.sender === 'user_me') && (
                  <RetroButton 
                    variant="primary" 
                    onClick={() => {
                      playAudio('click', effectiveSfxEnabled);
                      if (activeChannel.isReal) {
                        syncUpdateMessage(deleteTargetMessage.id, { 
                          isDeleted: true, 
                          text: 'message deleted',
                          metadata: {
                            ...deleteTargetMessage.metadata,
                            deletedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            wasReadBeforeDelete: deleteTargetMessage.status === 'read'
                          }
                        });
                      } else {
                        deleteDemoMessage(deleteTargetMessage.id);
                      }
                      setDeleteTargetMessage(null);
                    }}
                    className="w-full py-2 font-black uppercase text-xs text-white"
                  >
                    Delete for Everyone
                  </RetroButton>
                )}
                <RetroButton 
                  variant="white" 
                  onClick={() => {
                    playAudio('click', effectiveSfxEnabled);
                    handleDeleteForMe(deleteTargetMessage.id);
                    setDeleteTargetMessage(null);
                  }}
                  className="w-full py-2 font-black uppercase text-xs"
                >
                  Delete for Me
                </RetroButton>
              </div>
            </div>
          </RetroWindow>
        </div>
      )}

      {/* Create Server / Guild Dialog Modal window */}
      {showCreateServer && (
        <div className="fixed inset-0 z-[var(--z-modal)] bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <RetroWindow 
            title="create_guild.exe" 
            onClose={() => setShowCreateServer(false)} 
            className="universal-modal flex flex-col"
            noPadding
            sfx={effectiveSfxEnabled}
          >
            <form onSubmit={handleCreateServerSubmit} className="flex-1 flex flex-col min-h-0 text-main-text select-none">
              
              {/* Content Body */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 font-mono">
                {/* Intro / Description */}
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-black uppercase text-primary">Create a Guild</h3>
                  <p className="text-[10px] font-medium opacity-65 leading-normal lowercase">
                    your space is where you and your friends hang out. make yours and start chatting.
                  </p>
                </div>

                {/* Photo Uploader */}
                <div className="flex flex-col items-center justify-center gap-2 mt-2">
                  <span className="text-[10px] font-black uppercase opacity-65">Guild Icon</span>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleGuildIconUpload}
                      className="hidden"
                      id="guild-icon-upload"
                    />
                    <label
                      htmlFor="guild-icon-upload"
                      className="w-20 h-20 bg-window border-[3px] border-dashed border-border/60 flex flex-col items-center justify-center cursor-pointer hover:border-primary/80 transition-colors relative"
                    >
                      {createServerIcon ? (
                        <img
                          src={createServerIcon}
                          alt="Guild Icon"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-text font-black text-xs">
                          <span>UPLD</span>
                        </div>
                      )}
                      {/* Plus badge */}
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white border-2 border-window flex items-center justify-center text-[10px] font-black font-mono">
                        +
                      </div>
                    </label>
                  </div>
                  {createServerIcon && (
                    <button
                      type="button"
                      onClick={() => setCreateServerIcon('')}
                      className="text-[8px] font-black uppercase text-[var(--color-destructive)] underline"
                    >
                      Remove Icon
                    </button>
                  )}
                </div>

                {/* Guild Name Input */}
                <RetroInput 
                  label="Guild Name"
                  placeholder="e.g. My Cozy Corner"
                  value={createServerName}
                  onChange={e => setCreateServerName(e.target.value)}
                  required
                />

                {/* Space Type Selection */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase opacity-65">Guild Size / Tier</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { playAudio('click', effectiveSfxEnabled); setCreateServerType('server'); }}
                      className={`flex-1 py-2 text-xs font-bold retro-border ${createServerType === 'server' ? 'bg-primary text-white' : 'bg-window text-main-text'}`}
                    >
                      🌳 Standard Guild (Unlimited)
                    </button>
                    <button
                      type="button"
                      onClick={() => { playAudio('click', effectiveSfxEnabled); setCreateServerType('guild'); }}
                      className={`flex-1 py-2 text-xs font-bold retro-border ${createServerType === 'guild' ? 'bg-primary text-white' : 'bg-window text-main-text'}`}
                    >
                      🛡️ Mini-Guild (Max 10)
                    </button>
                  </div>
                  <span className="text-[8px] opacity-65 italic lowercase text-center">
                    {createServerType === 'guild' ? 'Mini-guild limits membership to a maximum of 10 users' : 'Standard guilds support unlimited users'}
                  </span>
                </div>
              </div>

              {/* Footer Bar */}
              <div className="window-footer h-[45px] border-t-2 border-border flex items-center justify-between px-4 bg-window/50 shrink-0 font-mono">
                <button
                  type="button"
                  onClick={() => setShowCreateServer(false)}
                  className="px-4 py-1 bg-window hover:bg-black/5 retro-border text-[10px] font-black uppercase text-main-text"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 bg-primary text-white hover:brightness-110 retro-border text-[10px] font-black uppercase"
                >
                  Create Guild
                </button>
              </div>

            </form>
          </RetroWindow>
        </div>
      )}

      {/* Confirm key resets */}
      {showResetConfirm && (
        <ConfirmDialog
          title="Reset encryption keys?"
          message="WARNING: Resetting your keys will prompt you to set a new Chat PIN. All past messages will become permanently unreadable. This action cannot be undone."
          showCancel={true}
          onConfirm={resetE2EEKeys}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      {/* Confirm delete chat */}
      {showClearChatConfirm && (
        <ConfirmDialog
          title="Delete Chat History?"
          message="Are you sure you want to delete all messages in this chat? This will permanently delete the chat history. This action cannot be undone."
          showCancel={true}
          onConfirm={async () => {
            playAudio('click', effectiveSfxEnabled);
            if (activeChannel.isReal) {
              await clearChatHistory();
            } else {
              clearDemoChat();
            }
            setShowClearChatConfirm(false);
          }}
          onCancel={() => {
            playAudio('click', effectiveSfxEnabled);
            setShowClearChatConfirm(false);
          }}
        />
      )}

      {/* Server Settings Modal */}
      {showServerSettingsModal && activeServer && (
        <div className="fixed inset-0 z-[var(--z-modal)] bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <RetroWindow
            title="server_settings.exe"
            onClose={() => setShowServerSettingsModal(false)}
            className="flex flex-col w-[880px] h-[620px] max-w-[95vw] max-h-[90vh]"
            noPadding
            sfx={effectiveSfxEnabled}
          >
            <ServerSettingsModal
              activeServer={activeServer}
              servers={servers}
              setServers={setServers}
              onClose={() => setShowServerSettingsModal(false)}
              sfxEnabled={effectiveSfxEnabled}
              userId={userId}
            />
          </RetroWindow>
        </div>
      )}

      {/* Invite Friends Modal */}
      {showInviteModal && activeServer && (
        <div className="fixed inset-0 z-[var(--z-modal)] bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <RetroWindow
            title="invite_members.exe"
            onClose={() => setShowInviteModal(false)}
            className="w-[380px]"
            sfx={effectiveSfxEnabled}
          >
            <div className="flex flex-col gap-3 font-mono text-main-text select-none">
              <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1">
                Select Friend to Add
              </span>
              
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[200px] pr-1">
                {ALL_POTENTIAL_MEMBERS
                  .filter(friend => !activeServer.members.some(m => m.id === friend.id))
                  .map(friend => (
                    <div key={friend.id} className="flex justify-between items-center p-2 bg-[var(--bg-main)]/5 border border-dashed border-border/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg shrink-0">{friend.emoji}</span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold truncate">{friend.name}</span>
                          <span className="text-[8px] opacity-60 truncate">{friend.status}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleAddMemberToServer(friend);
                          setShowInviteModal(false);
                        }}
                        className="p-1 px-3 text-[9px] font-black uppercase bg-primary text-white hover:brightness-110 retro-border"
                      >
                        Add
                      </button>
                    </div>
                  ))}

                {ALL_POTENTIAL_MEMBERS.filter(friend => !activeServer.members.some(m => m.id === friend.id)).length === 0 && (
                  <span className="text-[10px] font-bold opacity-50 text-center py-4 lowercase font-mono">
                    All friends have been invited!
                  </span>
                )}
              </div>
              
              <div className="flex gap-2 justify-end mt-2">
                <RetroButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-1 text-xs uppercase"
                >
                  Close
                </RetroButton>
              </div>
            </div>
          </RetroWindow>
        </div>
      )}

      {/* Delete Server Confirmation Dialog */}
      {showDeleteServerConfirm && activeServer && (
        <ConfirmDialog
          title={`Delete ${activeServer.name}?`}
          message="WARNING: Deleting this server will permanently remove all channels, members, and chat logs associated with it. This action cannot be undone."
          showCancel={true}
          onConfirm={() => {
            playAudio('click', effectiveSfxEnabled);
            const updated = servers.filter(s => s.id !== selectedServerId);
            setServers(updated);
            localStorage.setItem('yard_custom_servers', JSON.stringify(updated));
            addToast('Server deleted successfully.', 'success');
            setShowDeleteServerConfirm(false);
            
            // Switch active tab/server
            if (updated.length > 0) {
              navigate(`/chat/guild/${updated[0].id}/${updated[0].channels[0]?.id || 'general'}`);
            } else {
              navigate('/chat');
            }
          }}
          onCancel={() => {
            playAudio('click', effectiveSfxEnabled);
            setShowDeleteServerConfirm(false);
          }}
        />
      )}

      {/* Start Direct Message Modal */}
      {showStartDmModal && (
        <div className="fixed inset-0 z-[var(--z-modal)] bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <RetroWindow
            title="start_dm.exe"
            onClose={() => setShowStartDmModal(false)}
            className="w-[380px] flex flex-col"
            noPadding
            sfx={effectiveSfxEnabled}
          >
            <div className="p-4 flex flex-col gap-3 font-mono text-main-text select-none">
              <span className="text-[10px] font-black uppercase opacity-65 tracking-widest block border-b border-dashed border-border/25 pb-1">
                Select User to Chat
              </span>
              
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[250px] pr-1">
                {Object.entries(roomProfiles)
                  .filter(([uid]) => uid !== userId)
                  .map(([uid, u]) => (
                    <div key={uid} className="flex justify-between items-center p-2 bg-[var(--bg-main)]/5 border border-dashed border-border/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg shrink-0">{u.emoji || '👤'}</span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold truncate">{u.name || 'User'}</span>
                          <span className="text-[8px] opacity-60 truncate">{u.status || 'offline'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          playAudio('click', effectiveSfxEnabled);
                          handleStartDm(uid);
                        }}
                        className="p-1 px-3 text-[9px] font-black uppercase bg-primary text-white hover:brightness-110 retro-border"
                      >
                        Chat
                      </button>
                    </div>
                  ))}

                {Object.keys(roomProfiles).filter(uid => uid !== userId).length === 0 && (
                  <span className="text-[10px] font-bold opacity-50 text-center py-4 lowercase font-mono">
                    No other users available!
                  </span>
                )}
              </div>
              
              <div className="flex gap-2 justify-end mt-2">
                <RetroButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowStartDmModal(false)}
                  className="px-4 py-1 text-xs uppercase"
                >
                  Cancel
                </RetroButton>
              </div>
            </div>
          </RetroWindow>
        </div>
      )}

      {/* Create Bubble Modal */}
      {showCreateBubbleModal && (
        <div className="fixed inset-0 z-[var(--z-modal)] bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <RetroWindow
            title="create_bubble.exe"
            onClose={() => setShowCreateBubbleModal(false)}
            className="w-[400px] flex flex-col"
            noPadding
            sfx={effectiveSfxEnabled}
          >
            <form onSubmit={handleCreateBubbleSubmit} className="flex-1 flex flex-col min-h-0 text-main-text select-none font-mono">
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-black uppercase text-primary">Create a Bubble</h3>
                  <p className="text-[10px] font-medium opacity-65 leading-normal lowercase">
                    bubbles are group chats where you can hang out with multiple friends. Just select who to invite!
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase opacity-65">Invite Members</span>
                  <div className="flex flex-col gap-2 overflow-y-auto max-h-[150px] pr-1 border-2 border-border p-2 bg-window">
                    {Object.entries(roomProfiles)
                      .filter(([uid]) => uid !== userId)
                      .map(([uid, u]) => {
                        const isChecked = selectedBubbleMembers.includes(uid);
                        return (
                          <label key={uid} className="flex items-center justify-between p-1 hover:bg-black/5 cursor-pointer">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm shrink-0">{u.emoji || '👤'}</span>
                              <span className="text-xs font-bold truncate">{u.name || 'User'}</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                playAudio('click', effectiveSfxEnabled);
                                setSelectedBubbleMembers(prev =>
                                  prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
                                );
                              }}
                              className="w-4 h-4 border-2 border-border accent-primary cursor-pointer"
                            />
                          </label>
                        );
                      })}
                    {Object.keys(roomProfiles).filter(uid => uid !== userId).length === 0 && (
                      <span className="text-[10px] font-bold opacity-50 text-center py-4 lowercase">
                        No other users available!
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="window-footer h-[45px] border-t-2 border-border flex items-center justify-between px-4 bg-window/50 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateBubbleModal(false)}
                  className="px-4 py-1 bg-window hover:bg-black/5 retro-border text-[10px] font-black uppercase text-main-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 bg-primary text-white hover:brightness-110 retro-border text-[10px] font-black uppercase"
                >
                  Create Bubble
                </button>
              </div>
            </form>
          </RetroWindow>
        </div>
      )}
    </>
  );
}
