import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from '../components/UI.jsx';
// IMPORT FIXED: No more lazy(), this guarantees the playerRef has the .seekTo() method
import ReactPlayer from 'react-player';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { 
    Play, Pause, RotateCcw, RotateCw, Heart, Link as LinkIcon, 
    MessageSquare, Volume2, VolumeX, Maximize2, Minimize2, Settings, Globe, 
    Users, Search, ArrowLeft, Film, Tv, X, Reply, Download
} from 'lucide-react';
import { useSync, useAuth } from '../context/instances.js';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';

import { parseEmbedUrl, getLocalEmbedUrl, PROVIDER_LABELS } from '../utils/embed.js';
import {
  fetchJson,
  searchTVmaze,
  searchIMDbProxy,
  searchTMDB,
  fetchTVmazeEpisodes,
  fetchTVmazeShow,
  lookupTVmazeByImdb,
  cinemaFetchErrorMessage,
} from '../utils/cinemaApi.js';

export default function SyncWatcher({ onBack, sfx, userId, onShareToChat }) {
    // TMDb API Key from Vite env (Optional)
    const tmdbKey = import.meta.env.VITE_TMDB_API_KEY || '';

    const { broadcast, roomProfiles } = useSync();
    const { partnerId } = useAuth();
    const partnerName = roomProfiles?.[partnerId]?.name || 'Partner';
    
    // Database Synced State (So late-joiners see the right screen)
    const [syncedUrl, setSyncedUrl] = useGlobalSync('sync_watcher_url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    const [mode, setMode] = useGlobalSync('sync_watcher_mode', 'video');
    const [syncedTitle, setSyncedTitle] = useGlobalSync('sync_watcher_title_v2', 'YouTube/Video');
    
    // Watch Sessions & Chats State
    const [sessions, setSessions] = useGlobalSync('sync_watcher_sessions_v4', []);
    const [currentSessionId, setCurrentSessionId] = useGlobalSync('sync_watcher_current_session_id_v4', null);
    const [chatsBySessionId, setChatsBySessionId] = useGlobalSync('sync_watcher_chats_by_session_v4', {});
    const watcherChat = currentSessionId ? (chatsBySessionId[currentSessionId] || []) : [];
    
    // Shared lists state for watchlist auto-add and tick
    const [lists, setLists] = useGlobalSync('shared_lists', { watchlist: [], bucketlist: [], groceries: [] });
    const [historyRecommendations, setHistoryRecommendations] = useState([]);
    const [recsLoading, setRecsLoading] = useState(false);
    
    const myName = roomProfiles?.[userId]?.name || 'You';

    const addToast = useToast();

    // Local UI State
    const [inputUrl, setInputUrl] = useState('');
    const [localProvider, setLocalProvider] = useState(() => {
        const saved = localStorage.getItem('sync_watcher_provider_v2');
        if (!saved || saved === 'vidsrc' || saved === 'vidsrc.to') {
            return 'multiembed'; // Default to multiembed since it is sandbox-compatible and runs without errors
        }
        return saved;
    });

    const [replyingTo, setReplyingTo] = useState(null);
    const [showTicketsModal, setShowTicketsModal] = useState(false);
    const [activeTab, setActiveTab] = useState('chat');
    const [selectedHistorySession, setSelectedHistorySession] = useState(null);
    const [hasSeenTickets, setHasSeenTickets] = useState(false);

    const getLocalEmbedUrl = (url, provider) => {
        const info = parseEmbedUrl(url);
        if (!info) return url;

        const { id, type, season, episode } = info;

        if (type === 'movie') {
            if (provider === 'vidsrc' || provider === 'vidsrc.to') {
                return `https://vidsrc.su/embed/movie/${id}`;
            }
            if (provider === 'vidsrc.su') {
                return `https://vidsrc.su/embed/movie/${id}`;
            }
            if (provider === 'vidsrc.cc') {
                return `https://vidsrc.cc/v2/embed/movie/${id}`;
            }
            if (provider === 'vidsrc.me') {
                return `https://vidsrcme.ru/embed/movie/${id}`;
            }
            if (provider === 'vidsrc.xyz') {
                return `https://vidsrc-embed.su/embed/movie/${id}`;
            }
            if (provider === 'multiembed') {
                return `https://multiembed.mov/?video_id=${id}`;
            }
            if (provider === 'vidlink') {
                return `https://vidlink.pro/movie/${id}`;
            }
            if (provider === 'vidking') {
                return `https://www.vidking.net/embed/movie/${id}?color=e50914&autoPlay=true`;
            }
            return `https://vidsrc.su/embed/movie/${id}`;
        } else {
            if (provider === 'vidsrc' || provider === 'vidsrc.to') {
                return `https://vidsrc.su/embed/tv/${id}/${season}/${episode}`;
            }
            if (provider === 'vidsrc.su') {
                return `https://vidsrc.su/embed/tv/${id}/${season}/${episode}`;
            }
            if (provider === 'vidsrc.cc') {
                return `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`;
            }
            if (provider === 'vidsrc.me') {
                return `https://vidsrcme.ru/embed/tv/${id}/${season}/${episode}`;
            }
            if (provider === 'vidsrc.xyz') {
                return `https://vidsrc-embed.su/embed/tv/${id}/${season}/${episode}`;
            }
            if (provider === 'multiembed') {
                return `https://multiembed.mov/?video_id=${id}&tmdb=0&s=${season}&e=${episode}`;
            }
            if (provider === 'vidlink') {
                return `https://vidlink.pro/tv/${id}/${season}/${episode}`;
            }
            if (provider === 'vidking') {
                return `https://www.vidking.net/embed/tv/${id}/${season}/${episode}?color=e50914&autoPlay=true&nextEpisode=true&episodeSelector=true`;
            }
            return `https://vidsrc.su/embed/tv/${id}/${season}/${episode}`;
        }
    };
    const [volume, setVolume] = useState(0.8);
    const [muted, setMuted] = useState(false);
    const [playing, setPlaying] = useState(false);
    
    // TIMELINE FIX: Separate fraction (for slider) from seconds (for text display)
    const [playedFraction, setPlayedFraction] = useState(0); 
    const [playedSeconds, setPlayedSeconds] = useState(0); 
    const [duration, setDuration] = useState(0);
    
    // Live Reaction Chat Input
    const [chatInput, setChatInput] = useState('');
    const [hearts, setHearts] = useState([]);
    const [loadError, setLoadError] = useState(null);

    // Cinema Search States
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchFilter, setSearchFilter] = useState('all'); // all, movie, tv
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [selectedShow, setSelectedShow] = useState(null);
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [episodes, setEpisodes] = useState([]);
    const [episodesLoading, setEpisodesLoading] = useState(false);
    const [allTVmazeEpisodes, setAllTVmazeEpisodes] = useState([]);

    const playerRef = useRef(null);
    const wrapperRef = useRef(null);
    const isSeeking = useRef(false);
    const chatEndRef = useRef(null);

    // Fullscreen and pointer click overlay states
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [ripples, setRipples] = useState([]);

    const addRipple = useCallback((x, y, label) => {
        const id = `${Date.now()}-${Math.random()}`;
        setRipples(prev => [...prev, { id, x, y, label }]);
        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== id));
        }, 1000);
    }, []);


    // Control Sync Refs to avoid infinite broadcast loops
    const incomingPlay = useRef(0);
    const incomingPause = useRef(0);
    const incomingSeek = useRef(0);
    const hasAnnouncedJoin = useRef(false);
    const prevPartnerActivity = useRef(null);
    const pendingSyncRef = useRef(null);

    const appendSystemLog = useCallback((text) => {
        if (!currentSessionId) return;
        const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, sender: 'SYSTEM', text };
        setChatsBySessionId((prev) => ({
            ...prev,
            [currentSessionId]: [...(prev[currentSessionId] || []), entry]
        }));
        broadcast('watcher_chat', { ...entry, sessionId: currentSessionId, isMe: false });
    }, [currentSessionId, setChatsBySessionId, broadcast]);

    const appendChatMessage = useCallback((msg) => {
        if (!currentSessionId) return;
        setChatsBySessionId((prev) => ({
            ...prev,
            [currentSessionId]: [...(prev[currentSessionId] || []), msg]
        }));
        broadcast('watcher_chat', { ...msg, sessionId: currentSessionId, isMe: false });
    }, [currentSessionId, setChatsBySessionId, broadcast]);

    const archiveSession = useCallback((prevUrl, prevTitle, chatLogs) => {
        if (!prevUrl || !chatLogs || chatLogs.length === 0) return;

        const userMsgs = chatLogs.filter(m => m.sender !== 'SYSTEM');
        if (userMsgs.length === 0 && chatLogs.length <= 1) {
            return;
        }

        const msgCount = userMsgs.length;
        const systemLogs = chatLogs.filter(m => m.sender === 'SYSTEM');
        
        const playCount = systemLogs.filter(m => m.text.toLowerCase().includes('played') || m.text.toLowerCase().includes('started')).length;
        const pauseCount = systemLogs.filter(m => m.text.toLowerCase().includes('paused')).length;

        const summaryText = `🍿 Finished watching: **${prevTitle || 'Custom Video'}**\n💬 ${msgCount} chat reactions exchanged\n🔄 Sync adjustments: ${playCount} plays, ${pauseCount} pauses.`;

        if (onShareToChat) {
            onShareToChat(summaryText, null, {
                type: 'watchparty_summary',
                title: prevTitle || 'Custom Video',
                msgCount,
                playCount,
                pauseCount,
                url: prevUrl
            });
        }
    }, [onShareToChat]);

    const addToWatchlistAndTick = useCallback((title) => {
        if (!title) return;
        setLists(prev => {
            const currentWatchlist = prev?.watchlist || [];
            const exists = currentWatchlist.some(item => item.text.toLowerCase() === title.toLowerCase());
            
            if (exists) {
                const needsUpdate = currentWatchlist.some(item => item.text.toLowerCase() === title.toLowerCase() && !item.done);
                if (!needsUpdate) return prev;
                return {
                    ...prev,
                    watchlist: currentWatchlist.map(item => 
                        item.text.toLowerCase() === title.toLowerCase() 
                            ? { ...item, done: true } 
                            : item
                    )
                };
            } else {
                const newItem = {
                    id: Date.now(),
                    text: title,
                    done: true,
                    authorId: userId
                };
                return {
                    ...prev,
                    watchlist: [...currentWatchlist, newItem]
                };
            }
        });
    }, [userId, setLists]);

    const fetchAndSaveMetadata = useCallback(async (sessionId, type, tmdbId) => {
        if (!tmdbId || !tmdbKey) return;
        try {
            const endpointType = type === 'tv' ? 'tv' : 'movie';
            const detailsUrl = `https://api.themoviedb.org/3/${endpointType}/${tmdbId}?api_key=${tmdbKey}&append_to_response=credits`;
            const details = await fetchJson(detailsUrl);
            if (details) {
                const genres = details.genres ? details.genres.map(g => g.name) : [];
                const year = details.release_date 
                    ? new Date(details.release_date).getFullYear() 
                    : details.first_air_date 
                        ? new Date(details.first_air_date).getFullYear() 
                        : 'N/A';
                const cast = details.credits?.cast ? details.credits.cast.slice(0, 5).map(c => c.name) : [];
                const director = details.credits?.crew ? details.credits.crew.find(c => c.job === 'Director')?.name || '' : '';
                
                setSessions(prev => prev.map(s => {
                    if (s.id === sessionId) {
                        return {
                            ...s,
                            metadata: {
                                ...s.metadata,
                                genres,
                                year,
                                cast,
                                director,
                                tagline: details.tagline || ''
                            }
                        };
                    }
                    return s;
                }));
            }
        } catch (e) {
            console.error('Error fetching details from TMDB:', e);
        }
    }, [tmdbKey, setSessions]);

    const loadNewVideo = useCallback((newUrl, newTitle, metadata = null) => {
        archiveSession(syncedUrl, syncedTitle, watcherChat);
        setSyncedUrl(newUrl);
        setSyncedTitle(newTitle);
        
        const itemTitle = metadata?.title || newTitle;
        const cleanTitle = itemTitle.split(' - Season')[0];
        addToWatchlistAndTick(cleanTitle);
        
        // Resolve session state for new video
        const active = sessions.find(s => s.url === newUrl && !s.completed);
        if (active) {
            setCurrentSessionId(active.id);
            if (metadata?.tmdbId && (!active.metadata?.genres || active.metadata.genres.length === 0)) {
                fetchAndSaveMetadata(active.id, metadata.type, metadata.tmdbId);
            }
        } else {
            const latest = [...sessions].reverse().find(s => s.url === newUrl);
            if (latest) {
                setCurrentSessionId(latest.id);
                if (metadata?.tmdbId && (!latest.metadata?.genres || latest.metadata.genres.length === 0)) {
                    fetchAndSaveMetadata(latest.id, metadata.type, metadata.tmdbId);
                }
            } else {
                const newSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
                const newSession = {
                  id: newSessionId,
                  url: newUrl,
                  title: newTitle,
                  startTime: Date.now(),
                  completed: false,
                  completedAt: null,
                  ticketsClaimed: false,
                  metadata: {
                    type: metadata?.type || (newTitle.includes('TV Show') || newTitle.includes('Season') ? 'tv' : 'movie'),
                    tmdbId: metadata?.tmdbId || null,
                    imdbId: metadata?.imdbId || null,
                    title: cleanTitle,
                    poster: metadata?.poster || '',
                    year: metadata?.year || 'N/A',
                    genres: [],
                    cast: metadata?.cast || [],
                    director: ''
                  }
                };
                setSessions(prev => [...prev, newSession]);
                setCurrentSessionId(newSessionId);
                
                if (metadata?.tmdbId) {
                    fetchAndSaveMetadata(newSessionId, metadata.type, metadata.tmdbId);
                }
            }
        }
    }, [syncedUrl, syncedTitle, watcherChat, archiveSession, sessions, setSyncedUrl, setSyncedTitle, setSessions, setCurrentSessionId, addToWatchlistAndTick, fetchAndSaveMetadata]);

    const completeSession = useCallback((sessId) => {
        if (!sessId) return;
        setSessions(prev => prev.map(s => {
            if (s.id === sessId && !s.completed) {
                return { ...s, completed: true, completedAt: Date.now() };
            }
            return s;
        }));
        appendSystemLog(`Finished watching "${syncedTitle}"! Collect your digital tickets.`);
    }, [syncedTitle, setSessions, appendSystemLog]);

    const handleStartNewSession = useCallback((url, title) => {
        playAudio('click', sfx);
        const newSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        const existingSess = [...sessions].reverse().find(s => s.url === url);
        const newSession = {
          id: newSessionId,
          url: url,
          title: title,
          startTime: Date.now(),
          completed: false,
          completedAt: null,
          ticketsClaimed: false,
          metadata: existingSess?.metadata || {
            type: title.includes('TV Show') || title.includes('Season') ? 'tv' : 'movie',
            title: title.split(' - Season')[0],
            year: 'N/A',
            genres: [],
            cast: [],
            director: ''
          }
        };
        setSessions(prev => [...prev, newSession]);
        setCurrentSessionId(newSessionId);
        setChatsBySessionId(prev => ({
            ...prev,
            [newSessionId]: []
        }));
        appendSystemLog(`${myName} started a new watch session`);
    }, [sfx, myName, sessions, setSessions, setCurrentSessionId, setChatsBySessionId, appendSystemLog]);

    useEffect(() => {
        if (!syncedUrl) return;
        
        const active = sessions.find(s => s.url === syncedUrl && !s.completed);
        if (active) {
            if (currentSessionId !== active.id) {
                setCurrentSessionId(active.id);
            }
        } else {
            const latest = [...sessions].reverse().find(s => s.url === syncedUrl);
            if (latest) {
                if (currentSessionId !== latest.id) {
                    setCurrentSessionId(latest.id);
                }
            } else {
                if (!currentSessionId) {
                    const newSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
                    const newSession = {
                      id: newSessionId,
                      url: syncedUrl,
                      title: syncedTitle,
                      startTime: Date.now(),
                      completed: false,
                      completedAt: null,
                      ticketsClaimed: false
                    };
                    setSessions(prev => [...prev, newSession]);
                    setCurrentSessionId(newSessionId);
                }
            }
        }
    }, [syncedUrl, sessions, currentSessionId, syncedTitle, setSessions, setCurrentSessionId]);

    const activeSession = sessions.find(s => s.id === currentSessionId);
    useEffect(() => {
        if (activeSession && activeSession.completed && !hasSeenTickets) {
            setShowTicketsModal(true);
            setHasSeenTickets(true);
        } else if (activeSession && !activeSession.completed) {
            setHasSeenTickets(false);
        }
    }, [activeSession, hasSeenTickets]);

    const handleProviderChange = (prov) => {
        playAudio('click', sfx);
        setLocalProvider(prov);
        localStorage.setItem('sync_watcher_provider_v2', prov);
        appendSystemLog(`${myName} switched mirror to ${PROVIDER_LABELS[prov] || prov}`);
    };

    const handleModeChange = (newMode) => {
        if (newMode === mode) return;
        playAudio('click', sfx);
        setMode(newMode);
        appendSystemLog(`${myName} switched to ${newMode === 'video' ? 'Video' : 'Cinema'} mode`);
    };

    const handlePlayerReady = () => {
        if (pendingSyncRef.current) {
            const { time, playing } = pendingSyncRef.current;
            console.log(`[SYNC] Applying pending sync time: ${time}s, playing: ${playing}`);
            incomingSeek.current += 1;
            playerRef.current.seekTo(time, 'seconds');
            setPlayedSeconds(time);
            setPlaying(playing);
            pendingSyncRef.current = null;
        }
    };

    const formatTime = (sec) => {
        if (isNaN(sec) || sec === null || sec === undefined || sec === 0) return "0:00";
        const date = new Date(sec * 1000);
        const hh = date.getUTCHours();
        const mm = date.getUTCMinutes();
        const ss = date.getUTCSeconds().toString().padStart(2, '0');
        if (hh > 0) return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
        return `${mm}:${ss}`;
    };

    useEffect(() => {
        if (hasAnnouncedJoin.current) return;
        hasAnnouncedJoin.current = true;
        appendSystemLog(`${myName} joined the watch party`);
    }, [appendSystemLog, myName]);

    useEffect(() => {
        const activity = partnerId ? roomProfiles?.[partnerId]?.activity : null;
        if (prevPartnerActivity.current !== null) {
            if (activity === 'Watching SyncWatcher' && prevPartnerActivity.current !== 'Watching SyncWatcher') {
                appendSystemLog(`${partnerName} joined the watch party`);
            } else if (activity !== 'Watching SyncWatcher' && prevPartnerActivity.current === 'Watching SyncWatcher') {
                appendSystemLog(`${partnerName} left the watch party`);
            }
        }
        prevPartnerActivity.current = activity;
    }, [partnerId, roomProfiles, partnerName, appendSystemLog]);

    useEffect(() => {
        broadcast('watcher_join', { sender: userId });
    }, [broadcast, userId]);

    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    useEffect(() => {
        if (syncedTitle) {
            document.title = `Watch ${syncedTitle} | Yard`;
        } else {
            document.title = 'Watch SyncWatcher | Yard';
        }
    }, [syncedTitle]);




    useEffect(() => {
        if (!tmdbKey) {
            console.warn('TMDB key not set — cinema will use fallback providers only');
        }
    }, [tmdbKey]);

    useEffect(() => {
        const fetchRecommendations = async () => {
            // Get unique, non-empty sessions with metadata
            const history = sessions
                .filter(s => s.metadata && (s.metadata.title || s.metadata.tmdbId))
                .reverse(); // most recent first
                
            if (history.length === 0) {
                setHistoryRecommendations(RETRO_CLASSIC_SUGGESTIONS.slice(0, 6));
                return;
            }

            setRecsLoading(true);
            const lastThree = history.slice(0, 3);

            if (tmdbKey) {
                try {
                    const allRecs = [];
                    const seenIds = new Set();

                    for (const session of lastThree) {
                        const { tmdbId, type } = session.metadata;
                        if (!tmdbId) continue;
                        const endpointType = type === 'tv' ? 'tv' : 'movie';
                        const url = `https://api.themoviedb.org/3/${endpointType}/${tmdbId}/recommendations?api_key=${tmdbKey}`;
                        try {
                            const data = await fetchJson(url);
                            if (data?.results) {
                                data.results.forEach(item => {
                                    if (!seenIds.has(item.id)) {
                                        seenIds.add(item.id);
                                        allRecs.push({
                                            id: item.id,
                                            title: item.title || item.name,
                                            year: item.release_date 
                                                ? new Date(item.release_date).getFullYear() 
                                                : item.first_air_date 
                                                    ? new Date(item.first_air_date).getFullYear() 
                                                    : 'N/A',
                                            poster: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
                                            type: item.media_type || (item.title ? 'movie' : 'tv'),
                                            overview: item.overview
                                        });
                                    }
                                });
                            }
                        } catch (e) {
                            console.error(`Error fetching recommendations for TMDB ID ${tmdbId}:`, e);
                        }
                    }

                    if (allRecs.length > 0) {
                        setHistoryRecommendations(allRecs.slice(0, 6));
                        setRecsLoading(false);
                        return;
                    }
                } catch (err) {
                    console.error('Error in TMDB recommendations pipeline:', err);
                }
            }

            // Fallback scorer
            const scoredCatalog = RETRO_CLASSIC_SUGGESTIONS.map(catalogItem => {
                let score = 0;
                
                lastThree.forEach(watched => {
                    const watchedMeta = watched.metadata;
                    if (!watchedMeta) return;

                    // 1. Genre match (+3 per genre)
                    if (Array.isArray(watchedMeta.genres) && Array.isArray(catalogItem.genres)) {
                        const matchedGenres = catalogItem.genres.filter(g => 
                            watchedMeta.genres.some(wg => wg.toLowerCase() === g.toLowerCase())
                        );
                        score += matchedGenres.length * 3;
                    }

                    // 2. Director match (+5)
                    if (watchedMeta.director && catalogItem.director && 
                        watchedMeta.director.toLowerCase() === catalogItem.director.toLowerCase()) {
                        score += 5;
                    }

                    // 3. Lead Cast match (+2 per actor)
                    if (Array.isArray(watchedMeta.cast) && Array.isArray(catalogItem.cast)) {
                        const matchedCast = catalogItem.cast.filter(c => 
                            watchedMeta.cast.some(wc => wc.toLowerCase() === c.toLowerCase())
                        );
                        score += matchedCast.length * 2;
                    }

                    // 4. Year proximity (+2 if within 5 years)
                    const watchedYear = parseInt(watchedMeta.year);
                    const catalogYear = parseInt(catalogItem.year);
                    if (!isNaN(watchedYear) && !isNaN(catalogYear)) {
                        if (Math.abs(watchedYear - catalogYear) <= 5) {
                            score += 2;
                        }
                    }
                });

                return { ...catalogItem, score };
            });

            const watchedTitles = new Set(history.map(s => s.metadata?.title?.toLowerCase() || ''));
            const filteredRecommendations = scoredCatalog
                .filter(item => !watchedTitles.has(item.title.toLowerCase()))
                .sort((a, b) => b.score - a.score)
                .slice(0, 6);

            if (filteredRecommendations.length > 0) {
                setHistoryRecommendations(filteredRecommendations);
            } else {
                setHistoryRecommendations(scoredCatalog.sort((a, b) => b.score - a.score).slice(0, 6));
            }
            setRecsLoading(false);
        };

        fetchRecommendations();
    }, [sessions, tmdbKey]);

    // Embed URL parsing & derived state
    const parsedEmbed = parseEmbedUrl(syncedUrl);
    const isCinemaPlayerUrl = !!parsedEmbed;
    const isTvUrl = parsedEmbed?.type === 'tv';
    const currentTvId = parsedEmbed?.id || '';
    const currentSeason = parseInt(parsedEmbed?.season) || 1;
    const currentEpisode = parseInt(parsedEmbed?.episode) || 1;

    // Fallback if the user has selected a provider that requires TMDB IDs but tmdbKey is missing (so we only have IMDb IDs)
    let activeProvider = localProvider;
    if (!tmdbKey) {
        const compatibleProviders = ['vidsrc', 'vidsrc.su', 'vidsrc.cc', 'vidsrc.me', 'vidsrc.xyz', 'multiembed'];
        if (!compatibleProviders.includes(localProvider)) {
            activeProvider = 'multiembed'; // Fallback to MULTI (which is sandbox-compatible and keyless)
        }
    }

    // For troubleshooting: temporarily consider sandbox not applied so iframe is rendered without sandbox attribute
    const [forceEmbed, setForceEmbed] = useState(false);
    const [showCinemaSearch, setShowCinemaSearch] = useState(false);
    const trustedEmbedProviders = ['multiembed'];
    const providerSupportsSandbox = trustedEmbedProviders.includes(activeProvider);
    const providerAllowedEmbed = trustedEmbedProviders.includes(activeProvider) || forceEmbed;

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [watcherChat]);



    const fetchTMDBTVDetails = async (showId) => {
        try {
            return await fetchJson(`https://api.themoviedb.org/3/tv/${showId}?api_key=${tmdbKey}`);
        } catch (e) {
            console.error('TMDb TV details error:', e);
            return null;
        }
    };

    const fetchTMDBSeasonEpisodes = async (showId, seasonNumber) => {
        try {
            const data = await fetchJson(
              `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}?api_key=${tmdbKey}`
            );
            return data?.episodes || [];
        } catch (e) {
            console.error('TMDb season episodes error:', e);
            return [];
        }
    };

    const resolveShowImdbId = async (show) => {
        if (show.imdbId) return show.imdbId;
        const tvmaze = await fetchTVmazeShow(show.id);
        if (tvmaze?.externals?.imdb) return tvmaze.externals.imdb;
        try {
            const imdbResults = await searchIMDbProxy(show.title);
            const match = imdbResults.find((m) => m.title.toLowerCase() === show.title.toLowerCase());
            if (match) return match.id;
        } catch (e) {
            console.error('Error searching IMDb proxy by title:', e);
        }
        return null;
    };

    // --- SEARCH ACTION ---
    const handleSearch = async (query) => {
        if (!query.trim()) return;
        playAudio('click', sfx);
        setSearchLoading(true);
        setSearchError(null);
        setSelectedShow(null);
        try {
            if (tmdbKey) {
                const results = await searchTMDB(query, tmdbKey);
                setSearchResults(results);
            } else {
                let movieResultsRaw = await searchIMDbProxy(query);
                let tvResults = await searchTVmaze(query);
                
                const unifiedResults = [];
                const addedImdbIds = new Set();
                
                tvResults.forEach(tv => {
                    unifiedResults.push(tv);
                    if (tv.imdbId) addedImdbIds.add(tv.imdbId);
                });

                for (const item of movieResultsRaw) {
                    if (addedImdbIds.has(item.id)) {
                        continue;
                    }
                    unifiedResults.push(item);
                    addedImdbIds.add(item.id);
                }
                
                setSearchResults(unifiedResults);
            }
        } catch (err) {
            console.error('[Cinema] Search failed:', err);
            setSearchError(cinemaFetchErrorMessage(err));
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSelectItem = async (item) => {
        playAudio('click', sfx);
        
        let itemType = item.type;
        let resolvedItem = { ...item };

        if (itemType === 'movie' && !tmdbKey && String(item.id).startsWith('tt')) {
            setSearchLoading(true);
            try {
                // First search TVmaze by title to avoid 404 console errors for actual movies
                const searchData = await searchTVmaze(item.title);
                const match = searchData.find((entry) => entry.imdbId === item.id);
                if (match) {
                  const lookupData = await fetchTVmazeShow(match.id);
                  if (lookupData) {
                    itemType = 'tv';
                    resolvedItem = {
                      id: lookupData.id,
                      title: lookupData.name,
                      year: lookupData.premiered ? new Date(lookupData.premiered).getFullYear() : 'N/A',
                      poster: lookupData.image?.medium || lookupData.image?.original || item.poster || '',
                      type: 'tv',
                      imdbId: item.id,
                      summary: lookupData.summary,
                    };
                  }
                }
            } catch (e) {
                console.error('Error in TVmaze movie/tv lookup:', e);
            } finally {
                setSearchLoading(false);
            }
        }

        if (itemType === 'movie') {
            const isImdb = String(resolvedItem.id).startsWith('tt');
            const url = isImdb 
                ? `https://vidsrc.su/embed/movie/${resolvedItem.id}`
                : `https://www.vidking.net/embed/movie/${resolvedItem.id}?color=e50914&autoPlay=true`;
            loadNewVideo(url, resolvedItem.title, {
                type: 'movie',
                tmdbId: !isImdb ? resolvedItem.id : null,
                imdbId: isImdb ? resolvedItem.id : null,
                title: resolvedItem.title,
                poster: resolvedItem.poster,
                year: resolvedItem.year
            });
            setMode('cinema');
            setShowCinemaSearch(false);
            appendSystemLog(`${myName} started playing Movie: ${resolvedItem.title}`);
        } else {
            setSelectedShow(resolvedItem);
            setEpisodesLoading(true);
            try {
                if (tmdbKey) {
                    const details = await fetchTMDBTVDetails(resolvedItem.id);
                    if (details && details.seasons) {
                        const validSeasons = details.seasons
                            .filter(s => s.season_number > 0)
                            .map(s => s.season_number);
                        setSeasons(validSeasons);
                        const firstSeason = validSeasons[0] || 1;
                        setSelectedSeason(firstSeason);
                        
                        const eps = await fetchTMDBSeasonEpisodes(resolvedItem.id, firstSeason);
                        setEpisodes(eps.map(e => ({
                            id: e.id,
                            number: e.episode_number,
                            name: e.name,
                            airdate: e.air_date
                        })));
                    }
                } else {
                    let tvmazeShowId = resolvedItem.id;
                    if (String(resolvedItem.id).startsWith('tt')) {
                        const lookupData = await lookupTVmazeByImdb(resolvedItem.id);
                        if (lookupData?.id) {
                            tvmazeShowId = lookupData.id;
                            setSelectedShow({
                                id: lookupData.id,
                                title: lookupData.name,
                                year: lookupData.premiered ? new Date(lookupData.premiered).getFullYear() : 'N/A',
                                poster: lookupData.image?.medium || lookupData.image?.original || resolvedItem.poster || '',
                                type: 'tv',
                                imdbId: resolvedItem.id,
                                summary: lookupData.summary
                            });
                        } else {
                            throw new Error('Show not found on TVmaze');
                        }
                    }
                    const eps = await fetchTVmazeEpisodes(tvmazeShowId);
                    const uniqueSeasons = [...new Set(eps.map(e => e.season))].sort((a, b) => a - b);
                    setSeasons(uniqueSeasons);
                    const firstSeason = uniqueSeasons[0] || 1;
                    setSelectedSeason(firstSeason);
                    setAllTVmazeEpisodes(eps);
                    setEpisodes(eps.filter(e => e.season === firstSeason).map(e => ({
                        id: e.id,
                        number: e.number,
                        name: e.name,
                        airdate: e.airdate
                    })));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setEpisodesLoading(false);
            }
        }
    };

    const handleSeasonSelect = async (seasonNum) => {
        playAudio('click', sfx);
        setSelectedSeason(seasonNum);
        setEpisodesLoading(true);
        try {
            if (tmdbKey) {
                const eps = await fetchTMDBSeasonEpisodes(selectedShow.id, seasonNum);
                setEpisodes(eps.map(e => ({
                    id: e.id,
                    number: e.episode_number,
                    name: e.name,
                    airdate: e.air_date
                })));
            } else {
                setEpisodes(allTVmazeEpisodes.filter(e => e.season === seasonNum).map(e => ({
                    id: e.id,
                    number: e.number,
                    name: e.name,
                    airdate: e.airdate
                })));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setEpisodesLoading(false);
        }
    };

    const handlePlayEpisode = async (episodeNumber) => {
        playAudio('click', sfx);
        
        let id = tmdbKey ? selectedShow.id : selectedShow.imdbId;
        if (!tmdbKey && !id) {
            setEpisodesLoading(true);
            id = await resolveShowImdbId(selectedShow);
            setEpisodesLoading(false);
            if (id) {
                setSelectedShow(prev => prev ? { ...prev, imdbId: id } : prev);
            }
        }

        if (!id) {
            console.error('No IMDb ID available for this show');
            setSearchError('Could not resolve IMDb ID for this series.');
            return;
        }

        const isImdb = String(id).startsWith('tt');
        const url = isImdb
            ? `https://vidsrc.su/embed/tv/${id}/${selectedSeason}/${episodeNumber}`
            : `https://www.vidking.net/embed/tv/${id}/${selectedSeason}/${episodeNumber}?color=e50914&autoPlay=true&nextEpisode=true&episodeSelector=true`;
        
        const epTitle = `${selectedShow.title} - Season ${selectedSeason} Ep ${episodeNumber}`;
        loadNewVideo(url, epTitle, {
            type: 'tv',
            tmdbId: tmdbKey ? selectedShow.id : null,
            imdbId: !tmdbKey ? selectedShow.imdbId : null,
            title: selectedShow.title,
            poster: selectedShow.poster,
            year: selectedShow.year
        });
        setMode('cinema');
        setShowCinemaSearch(false);
        appendSystemLog(`${myName} started playing TV: ${epTitle}`);
    };


    const getEpisodesForSeason = async (tvId, seasonNum) => {
        try {
            if (tmdbKey && !String(tvId).startsWith('tt')) {
                const eps = await fetchTMDBSeasonEpisodes(tvId, seasonNum);
                return eps ? eps.map(e => ({ number: e.episode_number })) : [];
            } else {
                let tvmazeId = tvId;
                if (String(tvId).startsWith('tt')) {
                    const lookup = await lookupTVmazeByImdb(tvId);
                    if (lookup && lookup.id) {
                        tvmazeId = lookup.id;
                    } else {
                        return [];
                    }
                }
                const eps = await fetchTVmazeEpisodes(tvmazeId);
                if (!eps) return [];
                return eps.filter(e => e.season === seasonNum).map(e => ({ number: e.number }));
            }
        } catch (e) {
            console.error('[SYNC] Failed to fetch episodes:', e);
            return [];
        }
    };

    const handleNextPrevEpisode = async (direction) => {
        playAudio('click', sfx);
        
        let newEp = currentEpisode + direction;
        let newSeason = currentSeason;
        
        if (addToast) {
            addToast({ message: 'Loading next episode...', type: 'info', duration: 1500 });
        }

        if (direction > 0) {
            const currentSeasonEps = await getEpisodesForSeason(currentTvId, currentSeason);
            const totalEps = currentSeasonEps.length;
            
            if (totalEps > 0 && currentEpisode >= totalEps) {
                // End of season reached, try next season
                const nextSeasonNum = currentSeason + 1;
                const nextSeasonEps = await getEpisodesForSeason(currentTvId, nextSeasonNum);
                if (nextSeasonEps.length > 0) {
                    newSeason = nextSeasonNum;
                    newEp = 1;
                } else {
                    if (addToast) {
                        addToast({ message: 'You have reached the end of the series!', type: 'info' });
                    }
                    return;
                }
            }
        } else {
            // Going backwards
            if (newEp < 1) {
                if (currentSeason > 1) {
                    const prevSeasonNum = currentSeason - 1;
                    const prevSeasonEps = await getEpisodesForSeason(currentTvId, prevSeasonNum);
                    if (prevSeasonEps.length > 0) {
                        newSeason = prevSeasonNum;
                        newEp = prevSeasonEps.length; // Last episode of previous season
                    } else {
                        newEp = 1;
                    }
                } else {
                    newEp = 1;
                }
            }
        }

        const isImdb = String(currentTvId).startsWith('tt');
        const url = isImdb
            ? `https://vidsrc.su/embed/tv/${currentTvId}/${newSeason}/${newEp}`
            : `https://www.vidking.net/embed/tv/${currentTvId}/${newSeason}/${newEp}?color=e50914&autoPlay=true&nextEpisode=true&episodeSelector=true`;
        
        const showTitle = selectedShow?.title || (isTvUrl ? "TV Show" : "Cinema");
        const epTitle = `${showTitle} - Season ${newSeason} Ep ${newEp}`;
        loadNewVideo(url, epTitle, {
            type: 'tv',
            tmdbId: selectedShow?.id || (isTvUrl && !String(currentTvId).startsWith('tt') ? currentTvId : null),
            imdbId: selectedShow?.imdbId || (isTvUrl && String(currentTvId).startsWith('tt') ? currentTvId : null),
            title: showTitle,
            poster: selectedShow?.poster || '',
            year: selectedShow?.year || 'N/A'
        });
        appendSystemLog(`${myName} skipped to Season ${newSeason} Episode ${newEp}`);
    };

    // --- CONTROLS ---
    const handlePlayPause = () => {
        playAudio('click', sfx);
        setPlaying(!playing);
    };

    const handlePlayerClick = (e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        playAudio('click', sfx);
        const nextPlaying = !playing;
        setPlaying(nextPlaying);

        addRipple(x, y, myName);

        broadcast('watcher_click', { x, y, playing: nextPlaying, senderName: myName, sender: userId });
        broadcast('watcher_control', { action: nextPlaying ? 'PLAY' : 'PAUSE' });
        appendSystemLog(`${myName} ${nextPlaying ? 'played' : 'paused'} the video`);
    };

    const handleSkip = (seconds) => {
        playAudio('click', sfx);
        if (playerRef.current) {
            const currentTime = playerRef.current.getCurrentTime() || 0;
            const newTime = Math.max(0, currentTime + seconds);
            incomingSeek.current += 1;
            playerRef.current.seekTo(newTime, 'seconds');
            setPlayedSeconds(newTime);
            if (duration > 0) setPlayedFraction(newTime / duration);
            broadcast('watcher_control', { action: 'SEEK_SECONDS', time: newTime });
            const direction = seconds > 0 ? 'forward' : 'backward';
            appendSystemLog(`${myName} skipped ${direction} by ${Math.abs(seconds)}s`);
        }
    };

    const handleReplay = () => {
        playAudio('click', sfx);
        if (playerRef.current) {
            incomingSeek.current += 1;
            playerRef.current.seekTo(0, 'seconds');
            setPlayedSeconds(0);
            setPlayedFraction(0);
            broadcast('watcher_control', { action: 'SEEK_SECONDS', time: 0 });
            if (!playing) {
                setPlaying(true);
                broadcast('watcher_control', { action: 'PLAY' });
            }
            appendSystemLog(`${myName} replayed the video`);
        }
    };

    const handleSeekMouseUp = (e) => {
        const newFraction = parseFloat(e.target.value);
        if (playerRef.current) {
            playerRef.current.seekTo(newFraction, 'fraction');
        }
        isSeeking.current = false;
    };

    const handleInvite = () => {
        playAudio('click', sfx);
        broadcast('watchparty_invite', { 
            sender: userId, 
            senderName: myName,
            url: syncedUrl,
            title: syncedTitle,
            timestamp: Date.now() 
        });
        if (onShareToChat) {
            onShareToChat(`Join me to watch "${syncedTitle}"!`, null, { 
                type: 'watchparty_invite', 
                url: syncedUrl, 
                title: syncedTitle 
            });
        }
                appendSystemLog('Invite sent to partner!');
                // Show undoable toast
                if (addToast) {
                    addToast({ message: 'Invite sent', type: 'success', duration: 5000, action: { label: 'Undo', onClick: () => {
                        broadcast('watchparty_invite_cancel', { sender: userId, timestamp: Date.now(), url: syncedUrl });
                        appendSystemLog('Invite cancelled');
                    }}});
                }
    };

    const handleUrlChange = (e) => setInputUrl(e.target.value);
    const handleLoadUrl = () => {
        if (!inputUrl) return;
        playAudio('click', sfx);
        const targetUrl = inputUrl.trim();
        setInputUrl('');
        setLoadError(null);
        
        let newTitle = "Custom Video";
        const parsed = parseEmbedUrl(targetUrl);
        if (parsed) {
            newTitle = parsed.type === 'movie' ? `Movie: ${parsed.id}` : `TV Show: ${parsed.id} (S${parsed.season}E${parsed.episode})`;
        }
        
        loadNewVideo(targetUrl, newTitle);
        appendSystemLog(`${myName} loaded new video: ${newTitle}`);
    };

    const sendReaction = () => {
        playAudio('click', sfx);
        const x = Math.random() * 80 + 10;
        const y = Math.random() * 20 + 70;
        
        const newHeart = { id: Date.now(), x, y };
        setHearts(prev => [...prev, newHeart]);
        setTimeout(() => setHearts(prev => prev.filter(h => h.id !== newHeart.id)), 2000);
        broadcast('watcher_heart', { x, y });
    };

    // --- LOW LATENCY SYNC PULSE ---
    useEffect(() => {
        if (!playing || isSeeking.current) return;
        
        const pulseInterval = setInterval(() => {
            if (playerRef.current) {
                const ct = playerRef.current.getCurrentTime();
                if (ct > 0) {
                    broadcast('watcher_pulse', { time: ct, timestamp: Date.now() });
                }
            }
        }, 3000); // Pulse every 3s when playing

        return () => clearInterval(pulseInterval);
    }, [playing]);

    useEffect(() => {
        const handleBroadcast = ({ detail: { event, payload } }) => {
            if (event === 'watcher_chat') {
                const targetSessionId = payload.sessionId || currentSessionId;
                if (!targetSessionId) return;
                setChatsBySessionId(prev => {
                    const list = prev[targetSessionId] || [];
                    if (list.some(m => m.id === payload.id)) return prev;
                    return {
                        ...prev,
                        [targetSessionId]: [...list, payload]
                    };
                });
            }
            if (event === 'watcher_heart') {
                const newHeart = { id: Date.now(), x: payload.x, y: payload.y };
                setHearts(prev => [...prev, newHeart]);
                setTimeout(() => setHearts(prev => prev.filter(h => h.id !== newHeart.id)), 2000);
            }
            if (event === 'watcher_click' && payload.sender !== userId) {
                addRipple(payload.x, payload.y, payload.senderName);
            }
            if (event === 'watcher_join' && payload.sender !== userId) {
                if (playerRef.current) {
                    const ct = playerRef.current.getCurrentTime() || 0;
                    broadcast('watcher_sync_state', { time: ct, playing: playing, url: syncedUrl });
                }
            }
            if (event === 'watcher_sync_state') {
                console.log('[SYNC] Received watcher_sync_state:', payload);
                if (playerRef.current) {
                    incomingSeek.current += 1;
                    playerRef.current.seekTo(payload.time, 'seconds');
                    setPlayedSeconds(payload.time);
                    setPlaying(payload.playing);
                } else {
                    pendingSyncRef.current = { time: payload.time, playing: payload.playing };
                }
            }
            if (event === 'watcher_pulse' && playerRef.current && playing) {
                const ct = playerRef.current.getCurrentTime();
                const diff = Math.abs(ct - payload.time);
                // If drift is more than 1.5s, force a seek to match
                if (diff > 1.5) {
                    console.log(`[SYNC] Correcting drift of ${diff.toFixed(2)}s`);
                    incomingSeek.current += 1;
                    playerRef.current.seekTo(payload.time, 'seconds');
                }
            }
            if (event === 'watcher_control' && playerRef.current) {
                if (payload.action === 'PLAY') {
                    incomingPlay.current += 1;
                    setPlaying(true);
                }
                if (payload.action === 'PAUSE') {
                    incomingPause.current += 1;
                    setPlaying(false);
                }
                if (payload.action === 'SEEK_FRACTION') {
                    incomingSeek.current += 1;
                    playerRef.current.seekTo(payload.time, 'fraction');
                    setPlayedFraction(payload.time);
                }
                if (payload.action === 'SEEK_SECONDS') {
                    incomingSeek.current += 1;
                    playerRef.current.seekTo(payload.time, 'seconds');
                    setPlayedSeconds(payload.time);
                }
            }
        };

        window.addEventListener('sync_broadcast', handleBroadcast);
        return () => window.removeEventListener('sync_broadcast', handleBroadcast);
    }, [playing, syncedUrl, userId, broadcast, addRipple, currentSessionId, setChatsBySessionId]); // need playing in deps for the pulse listener logic

    const sendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        playAudio('click', sfx);
        
        const msg = { 
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, 
            sender: myName, 
            text: chatInput.trim(), 
            isMe: true,
            replyTo: replyingTo ? { id: replyingTo.id, sender: replyingTo.sender, text: replyingTo.text } : null
        };
        appendChatMessage(msg);
        setChatInput('');
        setReplyingTo(null);
    };

    const toggleFullscreen = () => {
        playAudio('click', sfx);
        if (wrapperRef.current) {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.error("Error exiting fullscreen:", err));
            } else {
                wrapperRef.current.requestFullscreen().catch(err => console.error("Error entering fullscreen:", err));
            }
        }
    };

    const filteredResults = searchResults.filter(item => {
        if (searchFilter === 'all') return true;
        return item.type === searchFilter;
    });


    return (
        <RetroWindow title={`sync_watcher.exe`} className="w-full max-w-6xl h-[100dvh] md:h-[calc(100dvh-4rem)] max-h-none md:max-h-[850px] border-none md:border-solid flex flex-col" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
            
            {/* Header Status Bar */}
            <div className="bg-border text-window p-2 flex justify-between items-center font-bold px-4 flex-shrink-0 text-[10px] uppercase tracking-widest border-b-[3px] border-border">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2">Shared Sync <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-game)] animate-pulse border border-black/50"></span> Connected</span>
                  
                  {/* VIDEO / CINEMA TOGGLE */}
                  <div className="flex bg-black/30 rounded p-0.5 retro-border shadow-inner">
                    <button onClick={() => handleModeChange('video')} className={`px-3 py-1 rounded-sm transition-colors ${mode === 'video' ? 'bg-white text-black font-black' : 'text-white/80 hover:text-white'}`}>VIDEO</button>
                    <button onClick={() => handleModeChange('cinema')} className={`px-3 py-1 rounded-sm transition-colors ${mode === 'cinema' ? 'bg-white text-black font-black' : 'text-white/80 hover:text-white'}`}>CINEMA</button>
                  </div>

                  {/* LOCAL PROVIDER SELECTOR (Only in Cinema Mode) */}
                  {mode === 'cinema' && (
                    <div className="flex bg-black/30 rounded p-0.5 retro-border shadow-inner ml-2 items-center gap-1 overflow-x-auto custom-scrollbar whitespace-nowrap">
                      <span className="text-white/40 px-1.5 py-1 text-[8px] font-black tracking-wider uppercase select-none hidden xs:inline">MIRROR:</span>
                      <button onClick={() => handleProviderChange('vidsrc')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'vidsrc' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>VS.TO</button>
                      <button onClick={() => handleProviderChange('vidsrc.su')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'vidsrc.su' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>VS.SU</button>
                      <button onClick={() => handleProviderChange('vidsrc.cc')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'vidsrc.cc' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>VS.CC</button>
                      <button onClick={() => handleProviderChange('vidsrc.me')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'vidsrc.me' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>VS.ME</button>
                      <button onClick={() => handleProviderChange('vidsrc.xyz')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'vidsrc.xyz' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>VS.XYZ</button>
                      <button onClick={() => handleProviderChange('multiembed')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'multiembed' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>MULTI</button>
                      {tmdbKey && (
                        <>
                          <button onClick={() => handleProviderChange('vidlink')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'vidlink' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>VIDLINK</button>
                          <button onClick={() => handleProviderChange('vidking')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'vidking' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>VIDKING</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="hidden sm:flex items-center gap-2 opacity-80">
                    <Settings size={12} /> Use player gear icon for resolution
                </div>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden bg-main" ref={wrapperRef}>

                {/* LEFT: Viewport & Controls */}
                <div className="flex-1 flex flex-col bg-black relative border-b-[3px] lg:border-b-0 lg:border-r-[3px] border-border">

                    {/* The Player / Browser / Cinema */}
                    <div className="flex-1 relative flex items-center justify-center w-full h-full">
                        {mode === 'video' ? (
                            <div className="relative w-full h-full">
                                {loadError && (
                                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black text-white/80 text-center p-4">
                                        <p className="font-bold text-lg mb-2">Could not load video</p>
                                        <p className="text-sm opacity-70 max-w-xs">{loadError}</p>
                                    </div>
                                )}
                                <ReactPlayer
                                    ref={playerRef}
                                    src={syncedUrl}
                                    playing={playing}
                                    volume={volume}
                                    muted={muted}
                                    onTimeUpdate={(e) => { 
                                        const ct = e.target.currentTime;
                                        const dur = e.target.duration;
                                        if (!isSeeking.current && typeof ct === 'number') {
                                            if (dur > 0) setPlayedFraction(ct / dur);
                                            setPlayedSeconds(ct);
                                        }
                                    }}
                                    onDurationChange={(e) => { if (typeof e.target.duration === 'number') setDuration(e.target.duration); }}
                                    onPlay={() => {
                                        setPlaying(true);
                                        if (incomingPlay.current > 0) {
                                            incomingPlay.current--;
                                        } else {
                                            broadcast('watcher_control', { action: 'PLAY' });
                                            appendSystemLog(`${myName} played`);
                                        }
                                    }}
                                    onPause={() => {
                                        setPlaying(false);
                                        if (incomingPause.current > 0) {
                                            incomingPause.current--;
                                        } else {
                                            broadcast('watcher_control', { action: 'PAUSE' });
                                            appendSystemLog(`${myName} paused`);
                                        }
                                    }}
                                    onSeek={(seconds) => {
                                        if (incomingSeek.current > 0) {
                                            incomingSeek.current--;
                                        } else {
                                            broadcast('watcher_control', { action: 'SEEK_SECONDS', time: seconds });
                                            const diff = seconds - playedSeconds;
                                            const absDiff = Math.abs(diff);
                                            if (absDiff > 1.5) {
                                                const direction = diff > 0 ? 'forward' : 'backward';
                                                appendSystemLog(`${myName} sought ${direction} to ${formatTime(seconds)} (${Math.round(absDiff)}s)`);
                                            }
                                        }
                                    }}
                                    onError={() => setLoadError('URL blocked by owner. Try a different YouTube link.')}
                                    onReady={handlePlayerReady}
                                    onEnded={() => completeSession(currentSessionId)}
                                    width="100%"
                                    height="100%"
                                    style={{ position: 'absolute', top: 0, left: 0 }}
                                    config={{ youtube: { playerVars: { modestbranding: 1, rel: 0, controls: 1 } } }}
                                />
                                {/* Click Catcher Overlay (covers top 85% of player to allow clicking bottom player bar) */}
                                <div 
                                    className="absolute top-0 left-0 right-0 bottom-12 z-20 cursor-pointer" 
                                    onClick={handlePlayerClick}
                                />
                                
                                {/* Ripples overlay */}
                                <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                                    {ripples.map(ripple => (
                                        <div 
                                            key={ripple.id} 
                                            className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
                                            style={{ left: `${ripple.x}%`, top: `${ripple.y}%` }}
                                        >
                                            <div className="w-12 h-12 rounded-full border-2 border-primary absolute opacity-70 animate-ping" />
                                            <div 
                                                className="w-8 h-8 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center"
                                                style={{ animation: 'ripple-pulse 0.8s ease-out forwards' }}
                                            />
                                            {ripple.label && (
                                                <span className="mt-2 bg-black/85 text-white font-black text-[8px] uppercase px-1.5 py-0.5 rounded tracking-widest border border-white/20 shadow-md">
                                                    {ripple.label}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                
                                <style>{`
                                    @keyframes ripple-pulse {
                                        0% {
                                            transform: scale(0.2);
                                            opacity: 1;
                                            border-width: 3px;
                                        }
                                        100% {
                                            transform: scale(1.5);
                                            opacity: 0;
                                            border-width: 1px;
                                        }
                                    }
                                `}</style>
                            </div>
                        ) : (
                            /* CINEMA MODE */
                            <div className="absolute inset-0 bg-main flex flex-col overflow-hidden">
                                        {isCinemaPlayerUrl && !showCinemaSearch ? (
                                    <>
                                        {/* Floating Cinema Controls */}
                                        <div className="absolute top-3 left-3 z-30 flex gap-2">
                                            <button 
                                                onClick={toggleFullscreen} 
                                                className="p-2 bg-black/85 text-white retro-border hover:bg-primary transition-colors flex items-center justify-center shadow-lg active:translate-y-[1px]"
                                                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                                            >
                                                {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                                            </button>
                                            {activeSession && !activeSession.completed && (
                                                <>
                                                    <button 
                                                        onClick={() => { playAudio('click', sfx); setShowTicketsModal(true); }}
                                                        className="px-3 py-1.5 bg-primary text-white font-black text-[10px] tracking-wider uppercase retro-border hover:brightness-110 transition-colors flex items-center gap-1 shadow-lg active:translate-y-[1px]"
                                                        title="View & Download Tickets Now"
                                                    >
                                                        Tickets
                                                    </button>
                                                    <button 
                                                        onClick={() => { playAudio('click', sfx); completeSession(currentSessionId); }}
                                                        className="px-3 py-1.5 bg-green-700 text-white font-black text-[10px] tracking-wider uppercase retro-border hover:bg-green-600 transition-colors flex items-center gap-1 shadow-lg active:translate-y-[1px]"
                                                        title="Finish watching and get tickets"
                                                    >
                                                        Finish Watching
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        {/* Cinema Search Overlay Toggle (Hover zone revealed on top-right) */}
                                        <div 
                                            className="absolute top-0 right-0 p-8 pt-3 pr-3 z-30 group/search-zone flex justify-end"
                                            onMouseLeave={() => {
                                                if (!searchQuery.trim()) {
                                                    setIsSearchExpanded(false);
                                                }
                                            }}
                                        >
                                            <div className={`transition-all duration-300 flex items-center gap-1.5 bg-black/85 p-1.5 retro-border shadow-lg ${isSearchExpanded ? 'opacity-100' : 'opacity-0 group-hover/search-zone:opacity-100'}`}>
                                                {isSearchExpanded && (
                                                    <input 
                                                        type="text"
                                                        value={searchQuery}
                                                        onChange={e => setSearchQuery(e.target.value)}
                                                        placeholder="Search Cinema..."
                                                        className="bg-main text-main-text font-bold border border-border px-2 py-0.5 text-[9px] uppercase focus:outline-none focus:border-primary w-32"
                                                        onClick={e => e.stopPropagation()}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                handleSearch(searchQuery);
                                                                setShowCinemaSearch(true);
                                                                setIsSearchExpanded(false);
                                                            }
                                                        }}
                                                        autoFocus
                                                    />
                                                )}
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        playAudio('click', sfx);
                                                        if (!isSearchExpanded) {
                                                            setIsSearchExpanded(true);
                                                        } else {
                                                            if (searchQuery.trim()) {
                                                                handleSearch(searchQuery);
                                                                setShowCinemaSearch(true);
                                                                setIsSearchExpanded(false);
                                                            } else {
                                                                setIsSearchExpanded(false);
                                                            }
                                                        }
                                                    }}
                                                    className="p-1 text-white hover:text-primary transition-colors flex items-center justify-center"
                                                    title="Search Cinema"
                                                >
                                                    <Search size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {providerAllowedEmbed ? (
                                            <>
                                                <iframe
                                                    src={getLocalEmbedUrl(syncedUrl, activeProvider)}
                                                    className="w-full h-full border-none bg-black"
                                                    title="Cinema Player"
                                                    allowFullScreen
                                                    referrerPolicy="no-referrer-when-downgrade"
                                                    allow="autoplay; fullscreen; picture-in-picture"
                                                />
                                            </>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <div className="bg-window p-4 retro-border text-center max-w-lg">
                                                    <p className="text-lg font-black text-red-600">This mirror may open popups or redirects.</p>
                                                    <p className="text-sm opacity-70 my-2">Embedding is blocked for safety. You can open the provider in a new tab instead.</p>
                                                    <div className="flex gap-2 justify-center mt-3">
                                                        <button onClick={() => window.open(getLocalEmbedUrl(syncedUrl, activeProvider), '_blank', 'noopener')} className="px-4 py-2 bg-primary text-white font-black">Open Provider</button>
                                                        <button onClick={() => setForceEmbed(true)} className="px-4 py-2 bg-black text-white font-bold border border-white/10">Embed Anyway</button>
                                                    </div>
                                                    <div className="text-[10px] opacity-60 mt-2">Provider: {activeProvider}</div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    /* CINEMA SEARCH INTERFACE */
                                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6 text-main-text pb-20 custom-scrollbar">
                                        
                                        {/* Mode Header */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b-[3px] border-border border-dashed pb-4">
                                            <div>
                                                <h1 className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                                                    <Film size={20} className="text-primary" /> VidKing Cinema
                                                </h1>
                                                <p className="text-[10px] font-bold opacity-60 mt-1 uppercase tracking-widest">
                                                    {tmdbKey ? 'TMDb Search API Active' : 'Keyless Fallback active (Powered by TVmaze & IMDb)'}
                                                </p>
                                                <p className="text-[10px] font-bold opacity-60 mt-1 uppercase tracking-widest text-yellow-500">
                                                    Note: Content is hosted by third-party providers. If a video fails to load, try switching the Mirror above.
                                                </p>
                                            </div>
                                            {isCinemaPlayerUrl && (
                                                <RetroButton 
                                                    onClick={() => { playAudio('click', sfx); setShowCinemaSearch(false); }} 
                                                    className="px-4 py-2 text-xs font-bold flex items-center gap-1.5 shadow-sm shrink-0"
                                                >
                                                    <X size={12} /> Close Search
                                                </RetroButton>
                                            )}
                                        </div>

                                        {selectedShow ? (
                                            /* TV SHOW DETAILS / SEASONS / EPISODES VIEW */
                                            <div className="flex flex-col gap-5 animate-in fade-in-50 duration-200">
                                                <button 
                                                    onClick={() => { playAudio('click', sfx); setSelectedShow(null); }} 
                                                    className="self-start text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity"
                                                >
                                                    <ArrowLeft size={12} /> Back to Results
                                                </button>
                                                
                                                <div className="flex flex-col sm:flex-row gap-4 bg-window p-4 border-[3px] border-border shadow-sm">
                                                    <div className="w-24 shrink-0 aspect-[2/3] bg-black/20 retro-border overflow-hidden flex items-center justify-center">
                                                        {selectedShow.poster ? (
                                                            <img src={selectedShow.poster} alt={selectedShow.title} className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150"><rect width="100%" height="100%" fill="%23333"/><text x="50%" y="50%" font-family="sans-serif" font-size="14" fill="%23999" text-anchor="middle" dy=".3em">No Image</text></svg>'; }} />
                                                        ) : (
                                                            <Tv size={32} className="opacity-30" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 flex flex-col gap-2">
                                                        <h2 className="text-lg font-black leading-tight">{selectedShow.title}</h2>
                                                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">{selectedShow.year} • TV Show</p>
                                                        {selectedShow.summary && (
                                                            <div className="text-[11px] opacity-80 leading-relaxed font-bold max-h-24 overflow-y-auto pr-2" dangerouslySetInnerHTML={{__html: selectedShow.summary}} />
                                                        )}
                                                        {selectedShow.overview && (
                                                            <p className="text-[11px] opacity-80 leading-relaxed font-bold max-h-24 overflow-y-auto pr-2">{selectedShow.overview}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Season Selector */}
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Select Season</label>
                                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                                        {seasons.map(sNum => (
                                                            <button 
                                                                key={sNum}
                                                                onClick={() => handleSeasonSelect(sNum)}
                                                                className={`px-4 py-1.5 font-black text-xs retro-border shrink-0 transition-colors ${selectedSeason === sNum ? 'bg-primary text-white border-primary' : 'bg-window text-main-text hover:bg-main'}`}
                                                            >
                                                                Season {sNum}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Episode Selector */}
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Select Episode</label>
                                                    {episodesLoading ? (
                                                        <div className="flex items-center gap-2 py-4">
                                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Loading episodes...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                            {episodes.map(ep => (
                                                                <button 
                                                                    key={ep.id}
                                                                    onClick={() => handlePlayEpisode(ep.number)}
                                                                    className="bg-window hover:bg-main border-[3px] border-border hover:border-primary p-3 text-left transition-all flex flex-col gap-1.5 group shadow-sm"
                                                                >
                                                                    <div className="flex justify-between items-start w-full">
                                                                        <span className="text-[9px] font-black text-primary uppercase tracking-widest">Episode {ep.number}</span>
                                                                        {ep.airdate && <span className="text-[9px] opacity-50 font-bold">{ep.airdate}</span>}
                                                                    </div>
                                                                    <span className="text-xs font-bold text-main-text group-hover:text-primary truncate w-full">{ep.name || `Episode ${ep.number}`}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            /* SEARCH FORM & RESULTS */
                                            <div className="flex flex-col gap-4">
                                                {/* Search Bar */}
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <input 
                                                            type="text" 
                                                            value={searchQuery}
                                                            onChange={e => setSearchQuery(e.target.value)}
                                                            placeholder="Search Movies or TV Shows..." 
                                                            className="w-full bg-window text-main-text font-bold border-[3px] border-border px-3 py-2 pl-9 text-xs focus:outline-none focus:border-primary placeholder:opacity-50"
                                                            onKeyDown={e => e.key === 'Enter' && handleSearch(searchQuery)}
                                                        />
                                                        <Search size={14} className="absolute left-3 top-3 text-main-text opacity-50" />
                                                    </div>
                                                    <RetroButton variant="primary" onClick={() => handleSearch(searchQuery)} className="px-6 text-xs font-bold flex items-center gap-1 shadow-sm">
                                                        Search
                                                    </RetroButton>
                                                </div>

                                                {/* Filter Controls */}
                                                <div className="flex gap-2 text-[10px] uppercase font-bold tracking-wider">
                                                    <button onClick={() => { playAudio('click', sfx); setSearchFilter('all'); }} className={`px-3 py-1.5 retro-border transition-colors ${searchFilter === 'all' ? 'bg-primary text-white border-primary' : 'bg-window text-main-text hover:bg-main'}`}>All</button>
                                                    <button onClick={() => { playAudio('click', sfx); setSearchFilter('movie'); }} className={`px-3 py-1.5 retro-border transition-colors ${searchFilter === 'movie' ? 'bg-primary text-white border-primary' : 'bg-window text-main-text hover:bg-main'}`}>Movies</button>
                                                    <button onClick={() => { playAudio('click', sfx); setSearchFilter('tv'); }} className={`px-3 py-1.5 retro-border transition-colors ${searchFilter === 'tv' ? 'bg-primary text-white border-primary' : 'bg-window text-main-text hover:bg-main'}`}>TV Shows</button>
                                                </div>

                                                {!searchLoading && !searchQuery && (
                                                    <div className="flex flex-col gap-6 animate-in fade-in-50 duration-200 mt-2">
                                                        {/* Shared Watchlist Suggestions */}
                                                        {lists?.watchlist?.filter(item => !item.done).length > 0 && (
                                                            <div className="flex flex-col gap-2">
                                                                <h3 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5 border-b border-border border-dashed pb-1">
                                                                    🎬 From Your Shared Watchlist
                                                                </h3>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {lists.watchlist.filter(item => !item.done).map(item => (
                                                                        <button 
                                                                            key={item.id}
                                                                            onClick={() => {
                                                                                playAudio('click', sfx);
                                                                                setSearchQuery(item.text);
                                                                                handleSearch(item.text);
                                                                            }}
                                                                            className="px-3 py-1.5 bg-window hover:bg-main text-main-text font-bold text-xs retro-border shadow-sm flex items-center gap-1.5 transition-all active:translate-y-[1px]"
                                                                        >
                                                                            <span>{item.text}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Recommendations Grid */}
                                                        <div className="flex flex-col gap-3">
                                                            <h3 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5 border-b border-border border-dashed pb-1">
                                                                🌟 Recommended For You
                                                            </h3>
                                                            {recsLoading ? (
                                                                <div className="flex items-center gap-2 py-4">
                                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                                                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Curating suggestions...</span>
                                                                </div>
                                                            ) : historyRecommendations.length === 0 ? (
                                                                <p className="text-[10px] font-bold opacity-50 uppercase tracking-wider">No recommendations available yet.</p>
                                                            ) : (
                                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                                                    {historyRecommendations.map((item, idx) => (
                                                                        <div 
                                                                            key={item.id || idx}
                                                                            onClick={() => {
                                                                                playAudio('click', sfx);
                                                                                setSearchQuery(item.title);
                                                                                handleSearch(item.title);
                                                                            }}
                                                                            className="bg-window border-[3px] border-border p-2 cursor-pointer hover:border-primary transition-all flex flex-col group shadow-sm"
                                                                        >
                                                                            <div className="aspect-[2/3] w-full bg-black/10 mb-1.5 relative overflow-hidden retro-border flex items-center justify-center">
                                                                                {item.poster ? (
                                                                                    <img src={item.poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" onError={(e) => { e.target.onerror = null; e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150"><rect width="100%" height="100%" fill="%23333"/><text x="50%" y="50%" font-family="sans-serif" font-size="12" fill="%23999" text-anchor="middle" dy=".3em">No Image</text></svg>'; }} />
                                                                                ) : (
                                                                                    item.type === 'movie' ? <Film size={24} className="opacity-30" /> : <Tv size={24} className="opacity-30" />
                                                                                )}
                                                                                <span className="absolute top-1 right-1 bg-black/80 text-white font-black text-[6px] uppercase px-1.5 py-0.5 rounded tracking-widest border border-white/20">
                                                                                    {item.type}
                                                                                </span>
                                                                            </div>
                                                                            <h4 className="font-bold text-[10px] truncate text-main-text group-hover:text-primary transition-colors leading-tight">{item.title}</h4>
                                                                            <p className="text-[8px] opacity-60 font-black uppercase tracking-widest mt-0.5">{item.year}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Status Display */}
                                                {searchLoading && (
                                                    <div className="flex flex-col items-center justify-center py-16">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-primary border-t-transparent mb-3"></div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Searching Database...</p>
                                                    </div>
                                                )}

                                                {searchError && (
                                                    <div className="bg-red-900/20 text-[var(--color-destructive)] border-[3px] border-red-900 p-3 text-xs font-bold text-center">
                                                        {searchError}
                                                    </div>
                                                )}

                                                {!searchLoading && filteredResults.length === 0 && searchQuery && (
                                                    <div className="text-center py-12 opacity-55 text-[10px] font-black uppercase tracking-widest">
                                                        No matches found. Try other keywords.
                                                    </div>
                                                )}

                                                {/* Results Grid */}
                                                {!searchLoading && filteredResults.length > 0 && (
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-in fade-in-50 duration-200">
                                                        {filteredResults.map(item => (
                                                            <div 
                                                                key={`${item.type}-${item.id}`} 
                                                                onClick={() => handleSelectItem(item)}
                                                                className="bg-window border-[3px] border-border p-2 cursor-pointer hover:border-primary transition-all flex flex-col group shadow-sm hover:shadow-md"
                                                            >
                                                                <div className="aspect-[2/3] w-full bg-black/10 mb-2 relative overflow-hidden retro-border flex items-center justify-center">
                                                                    {item.poster ? (
                                                                        <img src={item.poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" onError={(e) => { e.target.onerror = null; e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150"><rect width="100%" height="100%" fill="%23333"/><text x="50%" y="50%" font-family="sans-serif" font-size="14" fill="%23999" text-anchor="middle" dy=".3em">No Image</text></svg>'; }} />
                                                                    ) : (
                                                                        item.type === 'movie' ? <Film size={32} className="opacity-30" /> : <Tv size={32} className="opacity-30" />
                                                                    )}
                                                                    <span className="absolute top-1.5 right-1.5 bg-black/80 text-white font-black text-[8px] uppercase px-1.5 py-0.5 rounded tracking-widest border border-white/20">
                                                                        {item.type}
                                                                    </span>
                                                                </div>
                                                                <h3 className="font-bold text-xs truncate mb-0.5 text-main-text group-hover:text-primary transition-colors">{item.title}</h3>
                                                                <p className="text-[9px] opacity-60 font-black uppercase tracking-widest">{item.year}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Floating Hearts Overlay (Only visible during active cinema watch) */}
                                {isCinemaPlayerUrl && (
                                    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                                        {hearts.map(heart => (
                                            <div key={heart.id} className="absolute text-4xl text-primary animate-float-up drop-shadow-xl" style={{ left: `${heart.x}%`, top: `${heart.y}%` }}>❤️</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Custom Retro Control Bar (Only for standard Video Mode or TV Cinema Mode skip controls) */}
                    {mode === 'video' ? (
                        <div className="bg-window p-3 sm:p-4 shrink-0 flex flex-col gap-3 z-20">
                            
                            {/* Timeline Slider */}
                            <div className="flex items-center gap-3 text-main-text font-black text-[10px] tracking-widest">
                                <span className="w-10 text-right">{formatTime(playedSeconds)}</span>
                                <input 
                                    type="range" 
                                    min={0} 
                                    max={1} 
                                    step="any" 
                                    value={playedFraction} 
                                    onMouseDown={() => { isSeeking.current = true; }}
                                    onTouchStart={() => { isSeeking.current = true; }}
                                    onChange={(e) => setPlayedFraction(parseFloat(e.target.value))} 
                                    onMouseUp={handleSeekMouseUp} 
                                    onTouchEnd={handleSeekMouseUp} 
                                    className="flex-1 accent-primary h-2 bg-main retro-border rounded-full appearance-none outline-none cursor-pointer" 
                                />
                                <span className="w-10">{formatTime(duration)}</span>
                            </div>

                            {/* Media Buttons */}
                            <div className="flex justify-between items-center bg-main p-2 border-[3px] border-border mt-2 shadow-sm">
                                <div className="flex gap-1.5 sm:gap-2 items-center">
                                    <RetroButton onClick={handlePlayPause} className="w-9 h-9 p-0 flex items-center justify-center bg-primary text-white border-primary hover:brightness-110 shadow-sm !rounded-none" title={playing ? "Pause" : "Play"}>
                                        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                                    </RetroButton>
                                    <RetroButton onClick={handleReplay} className="w-9 h-9 p-0 flex items-center justify-center bg-window text-main-text border-border hover:bg-main shadow-sm !rounded-none" title="Replay">
                                        <RotateCcw size={15} />
                                    </RetroButton>
                                    <RetroButton onClick={() => handleSkip(-10)} className="w-9 h-9 p-0 flex items-center justify-center bg-window text-main-text border-border hover:bg-main shadow-sm !rounded-none" title="Back 10s">
                                        <span className="text-[8px] font-black leading-none">-10s</span>
                                    </RetroButton>
                                    <RetroButton onClick={() => handleSkip(10)} className="w-9 h-9 p-0 flex items-center justify-center bg-window text-main-text border-border hover:bg-main shadow-sm !rounded-none" title="Forward 10s">
                                        <span className="text-[8px] font-black leading-none">+10s</span>
                                    </RetroButton>
                                    
                                    <div className="hidden sm:flex items-center gap-2 ml-2 text-main-text bg-window px-2.5 py-1.5 border-[2px] border-border shadow-sm !rounded-none">
                                        <button onClick={() => setMuted(!muted)} className="hover:text-primary transition-colors focus:outline-none flex items-center justify-center">
                                            {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                                        </button>
                                        <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(e) => {setVolume(parseFloat(e.target.value)); setMuted(false);}} className="w-20 accent-primary h-1.5 bg-black/20 rounded-full appearance-none outline-none cursor-pointer" />
                                    </div>
                                </div>

                                <div className="flex gap-1.5 items-center">
                                    {activeSession && !activeSession.completed && (
                                        <>
                                            <RetroButton 
                                                onClick={() => { playAudio('click', sfx); setShowTicketsModal(true); }} 
                                                className="h-9 px-3 flex items-center justify-center text-xs font-black bg-primary text-white border-primary hover:brightness-110 transition-colors shadow-sm !rounded-none"
                                                title="View & Download Tickets Now"
                                            >
                                                Tickets
                                            </RetroButton>
                                            <RetroButton 
                                                onClick={() => { playAudio('click', sfx); completeSession(currentSessionId); }} 
                                                className="h-9 px-3 flex items-center justify-center text-xs font-black bg-green-700 text-white border-green-700 hover:bg-green-600 transition-colors shadow-sm !rounded-none"
                                                title="Finish Watching & Get Tickets"
                                            >
                                                Finish
                                            </RetroButton>
                                        </>
                                    )}
                                    <RetroButton onClick={sendReaction} className="w-9 h-9 p-0 flex items-center justify-center text-pink-500 hover:bg-pink-50 transition-colors bg-white border border-pink-200 shadow-sm !rounded-none" title="Send Love">
                                        <Heart size={16} fill="currentColor" />
                                    </RetroButton>
                                    <RetroButton onClick={toggleFullscreen} className="w-9 h-9 p-0 flex items-center justify-center text-main-text hover:text-primary transition-colors bg-white border border-black/10 shadow-sm !rounded-none" title="Fullscreen">
                                        <Maximize2 size={16} />
                                    </RetroButton>
                                </div>
                            </div>
                        </div>
                    ) : (mode === 'cinema' && isTvUrl) ? (
                        /* TV Episode skipping panel in Cinema Mode */
                        <div className="bg-window p-4 shrink-0 flex items-center justify-between border-t-[3px] border-border z-20 shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5"><Tv size={12}/> Now Playing Episode</span>
                                <span className="text-sm font-bold text-main-text">Season {currentSeason}, Episode {currentEpisode}</span>
                            </div>
                            <div className="flex gap-3">
                                <RetroButton 
                                    onClick={() => handleNextPrevEpisode(-1)} 
                                    disabled={currentEpisode <= 1} 
                                    className="px-4 py-2 text-xs font-black flex items-center gap-2 hover:bg-main transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed !rounded-none"
                                    title="Previous Episode"
                                >
                                    <RotateCcw size={12} /> Previous
                                </RetroButton>
                                <RetroButton 
                                    onClick={() => handleNextPrevEpisode(1)} 
                                    className="px-4 py-2 text-xs font-black flex items-center gap-2 bg-primary text-white border-primary hover:brightness-110 transition-all shadow-sm !rounded-none"
                                    title="Next Episode"
                                >
                                    Next Episode <RotateCw size={12} />
                                </RetroButton>
                            </div>
                        </div>
                    ) : null}

                    {/* URL Loader (Only for standard Video Mode, supports direct VidKing embed pasting) */}
                    {mode === 'video' && (
                        <div className="bg-window p-3 sm:p-4 shrink-0 flex gap-2 border-t-[3px] border-border border-dashed z-20">
                            <input 
                                type="text" 
                                value={inputUrl} 
                                onChange={(e) => setInputUrl(e.target.value)} 
                                placeholder="Paste YouTube or MP4 link..."
                                className="flex-1 bg-main text-main-text font-bold border-[3px] border-border px-3 py-2 text-xs focus:outline-none focus:border-primary placeholder:opacity-50 min-h-[44px]" 
                            />
                            <RetroButton variant="primary" onClick={handleLoadUrl} className="px-6 text-xs font-bold flex items-center gap-2 shadow-sm min-h-[44px]">
                                <LinkIcon size={14} /> Load
                            </RetroButton>
                        </div>
                    )}
                </div>

                {/* RIGHT: Live Chat Sidebar */}
                <div className={`w-full lg:w-80 bg-window flex flex-col shrink-0 transition-all duration-300 ${
                    isFullscreen 
                    ? 'h-[30dvh] w-full portrait:h-[30dvh] portrait:w-full landscape:hidden lg:landscape:flex lg:landscape:w-80 lg:landscape:h-auto' 
                    : 'h-64 lg:h-auto'
                }`}>
                    {/* Header */}
                    <div className="p-2 bg-border text-window font-black uppercase tracking-widest text-[10px] flex justify-between items-center shrink-0 shadow-sm border-b-[3px] border-border">
                        <span className="flex items-center gap-2 px-1">
                            <MessageSquare size={14} /> watch_party.sys
                        </span>
                        <RetroButton onClick={handleInvite} className="text-[9px] font-black px-2 py-1 flex items-center gap-1 bg-secondary text-secondary-text border-secondary active:translate-y-[1px]" title="Invite partner to watch together">
                            <Users size={10} /> Invite
                        </RetroButton>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex border-b-[3px] border-border bg-main/20 flex-shrink-0">
                        <button 
                            onClick={() => { playAudio('click', sfx); setActiveTab('chat'); setSelectedHistorySession(null); }}
                            className={`flex-1 py-2 text-center text-[10px] font-black uppercase tracking-wider border-r-[3px] border-border ${activeTab === 'chat' ? 'bg-window text-primary border-b-[3px] border-b-primary -mb-[3px]' : 'text-main-text/60 hover:bg-main/45'}`}
                        >
                            Live Chat
                        </button>
                        <button 
                            onClick={() => { playAudio('click', sfx); setActiveTab('history'); setSelectedHistorySession(null); }}
                            className={`flex-1 py-2 text-center text-[10px] font-black uppercase tracking-wider ${activeTab === 'history' ? 'bg-window text-primary border-b-[3px] border-b-primary -mb-[3px]' : 'text-main-text/60 hover:bg-main/45'}`}
                        >
                            History ({sessions.length})
                        </button>
                    </div>

                    {activeTab === 'chat' ? (
                        <>
                            {/* Archived Session Banner */}
                            {activeSession?.completed && (
                                <div className="bg-primary/10 border-b-[3px] border-dashed border-border p-2 text-[10px] text-center text-main-text font-black uppercase tracking-wider flex items-center justify-center gap-2 shrink-0">
                                    <span>📂 Archived watch (Finished)</span>
                                    <button 
                                        onClick={() => handleStartNewSession(syncedUrl, syncedTitle)}
                                        className="px-2.5 py-1 bg-primary text-white font-black text-[9px] retro-border active:translate-y-[1px]"
                                    >
                                        Start New
                                    </button>
                                </div>
                            )}

                            {/* Chat Messages Panel */}
                            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 bg-main/50 custom-scrollbar">
                                {(watcherChat || []).length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center opacity-40 text-main-text">
                                        <MessageSquare size={32} className="mb-2" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">No messages yet.<br/>Say hello!</p>
                                    </div>
                                )}
                                {(watcherChat || []).map((log, index, arr) => {
                                    const prevMsg = index > 0 ? arr[index - 1] : null;
                                    const nextMsg = index < arr.length - 1 ? arr[index + 1] : null;
                                    const isGroupStart = !prevMsg || prevMsg.sender !== log.sender || prevMsg.sender === 'SYSTEM';
                                    const isGroupEnd = !nextMsg || nextMsg.sender !== log.sender || nextMsg.sender === 'SYSTEM';
                                    const marginClass = log.sender === 'SYSTEM' ? 'my-2' : isGroupEnd ? 'mb-4' : 'mb-1';
                                    
                                    const isMe = log.isMe || log.sender === myName;
                                    
                                    if (log.sender === 'SYSTEM') {
                                        return (
                                            <div key={log.id} className="flex justify-center my-2 animate-in fade-in">
                                                <div className="bg-primary/10 px-3 py-1 retro-border border-dashed rounded text-[10px] uppercase tracking-wider font-bold text-primary/80 text-center max-w-[90%]">
                                                    {log.text}
                                                </div>
                                            </div>
                                        );
                                    }
                                    
                                    return (
                                        <div key={log.id} className={`flex flex-col relative group ${isMe ? 'items-end' : 'items-start'} ${marginClass} animate-in fade-in slide-in-from-bottom-1`}>
                                            <div id={`msg-${log.id}`} className={`flex items-end gap-2 max-w-[85%] relative transition-all duration-300 ${isMe ? 'flex-row justify-end self-end ml-auto' : 'flex-row self-start'}`}>
                                                
                                                {/* Reply hover button */}
                                                <div className={`absolute top-1/2 -translate-y-1/2 transition-all duration-300 z-20 opacity-0 group-hover:opacity-100 ${isMe ? '-left-8' : '-right-8'}`}>
                                                    <button 
                                                        onClick={() => { playAudio('click', sfx); setReplyingTo(log); }}
                                                        className="p-1 retro-border border-dashed bg-window text-main-text shadow-sm hover:text-primary hover:border-solid active:translate-y-[1px]"
                                                        title="Reply"
                                                    >
                                                        <Reply size={10} />
                                                    </button>
                                                </div>
                                                
                                                {!isMe && (
                                                    <div className="w-6 h-6 flex-shrink-0 flex items-end order-first mb-0.5">
                                                        {isGroupEnd ? (
                                                            <div className="w-6 h-6 retro-border flex items-center justify-center text-[9px] rounded-none bg-secondary text-secondary-text font-black">
                                                                {roomProfiles?.[partnerId]?.emoji || '☕'}
                                                            </div>
                                                        ) : <div className="w-6" />}
                                                    </div>
                                                )}
                                                
                                                <div className={`relative flex flex-col p-2 retro-border retro-shadow-dark ${isMe ? 'bg-primary text-[color:var(--text-on-primary)] border-primary text-white' : 'bg-window text-main-text'}`}>
                                                    {log.replyTo && (
                                                        <div 
                                                            onClick={() => {
                                                                const el = document.getElementById(`msg-${log.replyTo.id}`);
                                                                if (el) {
                                                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                    el.classList.add('animate-pulse');
                                                                    setTimeout(() => el.classList.remove('animate-pulse'), 1500);
                                                                }
                                                            }}
                                                            className={`border-l-2 border-white/40 bg-white/10 p-1.5 mb-1.5 text-[9px] cursor-pointer hover:bg-white/20 transition-all rounded-sm`}
                                                        >
                                                            <p className="font-black uppercase tracking-tighter opacity-65 mb-0.5">{log.replyTo.sender === myName ? 'You' : log.replyTo.sender}</p>
                                                            <p className="truncate italic font-bold text-[9px]">{log.replyTo.text}</p>
                                                        </div>
                                                    )}
                                                    <span className="break-words whitespace-pre-wrap text-[11px] font-bold leading-normal [word-break:break-word] overflow-hidden">
                                                        {log.text}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Reply input preview bar */}
                            {replyingTo && (
                                <div className="p-2 bg-primary text-white border-t-2 border-border/20 flex justify-between items-center text-[10px] font-bold tracking-wide animate-in slide-in-from-bottom-1 shrink-0">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Reply size={12} className="flex-shrink-0" />
                                        <span className="truncate">
                                            Replying to {replyingTo.sender}: "{replyingTo.text}"
                                        </span>
                                    </div>
                                    <button onClick={() => setReplyingTo(null)} className="p-0.5 hover:bg-white/10 retro-border flex-shrink-0 ml-2"><X size={10} /></button>
                                </div>
                            )}

                            {/* Chat form input */}
                            <form onSubmit={sendChat} className="p-3 bg-window border-t-[3px] border-border shrink-0 flex gap-2">
                                <input 
                                    type="text" 
                                    value={chatInput} 
                                    onChange={e => setChatInput(e.target.value)} 
                                    placeholder="Type a reaction..." 
                                    className="flex-1 p-2 border-[3px] border-border bg-main/50 text-main-text text-xs font-bold focus:outline-none focus:border-primary min-h-[44px]" 
                                />
                                <RetroButton type="submit" variant="accent" className="px-4 text-xs font-black shadow-sm min-h-[44px]">Send</RetroButton>
                            </form>
                        </>
                    ) : (
                        /* WATCH HISTORY / SESSIONS TAB */
                        <div className="flex-1 flex flex-col overflow-hidden bg-main/30">
                            {selectedHistorySession ? (
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    {/* Sub-header to back out */}
                                    <div className="p-2 bg-window border-b-[3px] border-border flex items-center justify-between shrink-0">
                                        <button 
                                            onClick={() => { playAudio('click', sfx); setSelectedHistorySession(null); }}
                                            className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
                                        >
                                            <ArrowLeft size={10} /> Back
                                        </button>
                                        {selectedHistorySession.completed && (
                                            <button 
                                                onClick={() => {
                                                    playAudio('click', sfx);
                                                    setShowTicketsModal(true);
                                                }}
                                                className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white font-black text-[9px] uppercase tracking-wider retro-border flex items-center gap-1 active:translate-y-[1px]"
                                            >
                                                <Download size={8} /> Tickets
                                            </button>
                                        )}
                                    </div>

                                    {/* Title box */}
                                    <div className="p-3 bg-window/65 border-b-[3px] border-dashed border-border shrink-0">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-primary truncate leading-tight">{selectedHistorySession.title}</h3>
                                        <p className="text-[8px] font-bold opacity-50 uppercase tracking-widest mt-0.5">
                                            Started: {new Date(selectedHistorySession.startTime).toLocaleDateString()}
                                        </p>
                                    </div>

                                    {/* Archived Chat log */}
                                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 custom-scrollbar bg-main/50">
                                        {(chatsBySessionId[selectedHistorySession.id] || []).length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-center opacity-40 text-main-text">
                                                <p className="text-[10px] font-black uppercase tracking-widest">No chat logs for this session.</p>
                                            </div>
                                        ) : (
                                            (chatsBySessionId[selectedHistorySession.id] || []).map((log, index, arr) => {
                                                const prevMsg = index > 0 ? arr[index - 1] : null;
                                                const nextMsg = index < arr.length - 1 ? arr[index + 1] : null;
                                                const isGroupEnd = !nextMsg || nextMsg.sender !== log.sender || nextMsg.sender === 'SYSTEM';
                                                const marginClass = log.sender === 'SYSTEM' ? 'my-2' : isGroupEnd ? 'mb-4' : 'mb-1';
                                                const isMe = log.isMe || log.sender === myName;

                                                if (log.sender === 'SYSTEM') {
                                                    return (
                                                        <div key={log.id} className="flex justify-center my-1">
                                                            <div className="bg-primary/5 px-2.5 py-0.5 border border-dashed border-border/30 rounded text-[9px] uppercase font-bold text-main-text/50 text-center">
                                                                {log.text}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div key={log.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${marginClass}`}>
                                                        <div className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'flex-row justify-end ml-auto' : 'flex-row'}`}>
                                                            {!isMe && (
                                                                <div className="w-5 h-5 flex-shrink-0 flex items-end order-first mb-0.5">
                                                                    {isGroupEnd && (
                                                                        <div className="w-5 h-5 retro-border flex items-center justify-center text-[8px] bg-secondary text-secondary-text font-black">
                                                                            {roomProfiles?.[partnerId]?.emoji || '☕'}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            <div className={`relative flex flex-col p-2 retro-border retro-shadow-dark ${isMe ? 'bg-primary text-white border-primary opacity-85' : 'bg-window text-main-text opacity-85'}`}>
                                                                {log.replyTo && (
                                                                    <div className="border-l border-white/20 bg-white/5 p-1 mb-1 text-[8px] rounded-sm">
                                                                        <p className="font-black opacity-60">{log.replyTo.sender}</p>
                                                                        <p className="truncate italic text-[9px]">{log.replyTo.text}</p>
                                                                    </div>
                                                                )}
                                                                <span className="break-words text-[10px] font-bold leading-normal [word-break:break-word]">{log.text}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
                                    {sessions.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full py-12 text-center opacity-40 text-main-text">
                                            <Film size={28} className="mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">No watch sessions archived yet.</p>
                                        </div>
                                    ) : (
                                        [...sessions].reverse().map(sess => (
                                            <div 
                                                key={sess.id}
                                                className="p-3 bg-window border-[3px] border-border shadow-sm flex flex-col gap-2 relative group"
                                            >
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-xs font-black uppercase tracking-wider text-primary truncate leading-tight">{sess.title}</h4>
                                                        <p className="text-[8px] font-bold opacity-60 uppercase tracking-widest mt-0.5">
                                                            {new Date(sess.startTime).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <span className={`px-2 py-0.5 font-black text-[7px] tracking-wider uppercase border ${sess.completed ? 'bg-green-100 text-green-700 border-green-300' : 'bg-amber-100 text-amber-700 border-amber-300'}`}>
                                                        {sess.completed ? 'Completed' : 'Watching'}
                                                    </span>
                                                </div>

                                                <div className="flex gap-2 justify-end mt-1 border-t border-dashed border-border/20 pt-2">
                                                    <button 
                                                        onClick={() => { playAudio('click', sfx); setSelectedHistorySession(sess); }}
                                                        className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-main/50 retro-border hover:bg-main hover:text-primary transition-all active:translate-y-[1px]"
                                                    >
                                                        View Chat
                                                    </button>
                                                    {sess.completed && (
                                                        <button 
                                                            onClick={() => {
                                                                playAudio('click', sfx);
                                                                setSelectedHistorySession(sess);
                                                                setShowTicketsModal(true);
                                                            }}
                                                            className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-green-700 text-white border-green-700 hover:brightness-110 transition-all flex items-center gap-1 active:translate-y-[1px]"
                                                        >
                                                            <Download size={10} /> Tickets
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}
            </div>
        </div>

            <TicketsModal 
                isOpen={showTicketsModal} 
                onClose={() => setShowTicketsModal(false)} 
                session={selectedHistorySession || activeSession}
                myName={myName}
                partnerName={partnerName}
                sfx={sfx}
            />
        </RetroWindow>
    );
}

function TicketsModal({ isOpen, onClose, session, myName, partnerName, sfx }) {
    const ticketRef = useRef(null);
    const [downloading, setDownloading] = useState(false);
    const [watchDate, setWatchDate] = useState('');
    
    useEffect(() => {
        if (isOpen) {
            const updateTime = () => {
                const now = new Date();
                setWatchDate(now.toLocaleDateString([], { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }) + ' ' + now.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }));
            };
            updateTime();
            const interval = setInterval(updateTime, 1000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);
    
    if (!isOpen || !session) return null;
        
    const handleDownload = async () => {
        playAudio('click', sfx);
        setDownloading(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const element = ticketRef.current;
            if (element) {
                const canvas = await html2canvas(element, {
                    backgroundColor: null,
                    scale: 3,
                    useCORS: true
                });
                const imgData = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = `${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_watch_tickets.png`;
                link.href = imgData;
                link.click();
            }
        } catch (e) {
            console.error('Download tickets error:', e);
        } finally {
            setDownloading(false);
        }
    };
    
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 animate-in fade-in duration-200">
            <div className="bg-window p-4 sm:p-6 retro-border retro-shadow-dark max-w-xl w-full flex flex-col gap-4 text-main-text relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                
                <button 
                    onClick={onClose}
                    className="absolute top-3 right-3 p-1 text-main-text hover:text-primary transition-colors focus:outline-none"
                >
                    <X size={18} />
                </button>
                
                <div className="text-center border-b-[3px] border-dashed border-border pb-3">
                    <h2 className="text-lg font-black uppercase tracking-wider text-primary">🎉 Watch Party Completed!</h2>
                    <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">Here are your commemorative digital movie tickets</p>
                </div>
                
                <div className="p-4 bg-main/50 retro-border flex justify-center overflow-x-auto select-none">
                    <div 
                        ref={ticketRef} 
                        className="flex flex-row gap-4 p-4 bg-main/20 rounded-lg justify-center items-center shrink-0"
                        style={{ fontFamily: 'var(--font-mono)' }}
                    >
                        {/* TICKET 1: ME */}
                        <div className="w-56 h-[340px] bg-[#fdfaf5] border-[3px] border-black text-black relative flex flex-col p-4 shadow-lg overflow-hidden justify-between rounded-lg select-none">
                            <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-main border-[3px] border-black border-r-transparent border-t-transparent -rotate-45" />
                            <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-main border-[3px] border-black border-l-transparent border-b-transparent -rotate-45" />
                            
                            <div className="flex flex-col items-center text-center">
                                <div className="text-[8px] font-black lowercase tracking-widest opacity-60 border-b border-black/20 pb-0.5 w-full">yard • admit one</div>
                                <h3 className="text-xs font-black uppercase tracking-widest text-[#d946ef] mt-2 mb-1">YOU</h3>
                                <div className="text-sm font-extrabold uppercase leading-tight line-clamp-2 px-1 break-words w-full h-10 flex items-center justify-center">{session.title}</div>
                            </div>
                            
                            <div className="border-t border-dashed border-black/40 my-1 w-full" />
                            
                            <div className="flex flex-col text-[9px] font-bold gap-1 pl-1">
                                <div><span className="opacity-65">DATE:</span> {watchDate}</div>
                                <div><span className="opacity-65">SEAT:</span> ROW A, SEAT 08</div>
                                <div><span className="opacity-65">VENUE:</span> SYNCWATCHER #7</div>
                            </div>
                            
                            <div className="border-t border-dashed border-black/40 my-1 w-full" />
                            
                            <div className="flex flex-col items-center gap-1">
                                <div className="flex justify-center items-end h-8 w-full px-2">
                                    {[1, 3, 1, 2, 4, 1, 2, 3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1].map((w, idx) => (
                                        <div key={idx} className="h-full bg-black" style={{ width: `${w}px`, marginRight: idx % 3 === 0 ? '2px' : '1px' }} />
                                    ))}
                                </div>
                                <div className="text-[7px] tracking-[3px] font-black opacity-60">#00{session.id.slice(-6).toUpperCase()}</div>
                            </div>
                        </div>

                        {/* TICKET 2: PARTNER */}
                        <div className="w-56 h-[340px] bg-[#fdfaf5] border-[3px] border-black text-black relative flex flex-col p-4 shadow-lg overflow-hidden justify-between rounded-lg select-none">
                            <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-main border-[3px] border-black border-r-transparent border-t-transparent -rotate-45" />
                            <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-main border-[3px] border-black border-l-transparent border-b-transparent -rotate-45" />
                            
                            <div className="flex flex-col items-center text-center">
                                <div className="text-[8px] font-black lowercase tracking-widest opacity-60 border-b border-black/20 pb-0.5 w-full">yard • admit one</div>
                                <h3 className="text-xs font-black uppercase tracking-widest text-[#06b6d4] mt-2 mb-1">{partnerName.toUpperCase()}</h3>
                                <div className="text-sm font-extrabold uppercase leading-tight line-clamp-2 px-1 break-words w-full h-10 flex items-center justify-center">{session.title}</div>
                            </div>
                            
                            <div className="border-t border-dashed border-black/40 my-1 w-full" />
                            
                            <div className="flex flex-col text-[9px] font-bold gap-1 pl-1">
                                <div><span className="opacity-65">DATE:</span> {watchDate}</div>
                                <div><span className="opacity-65">SEAT:</span> ROW A, SEAT 09</div>
                                <div><span className="opacity-65">VENUE:</span> SYNCWATCHER #7</div>
                            </div>
                            
                            <div className="border-t border-dashed border-black/40 my-1 w-full" />
                            
                            <div className="flex flex-col items-center gap-1">
                                <div className="flex justify-center items-end h-8 w-full px-2">
                                    {[1, 3, 1, 2, 4, 1, 2, 3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1].map((w, idx) => (
                                        <div key={idx} className="h-full bg-black" style={{ width: `${w}px`, marginRight: idx % 3 === 0 ? '2px' : '1px' }} />
                                    ))}
                                </div>
                                <div className="text-[7px] tracking-[3px] font-black opacity-60">#00{session.id.slice(-6).toUpperCase()}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-2 justify-end mt-2">
                    <RetroButton onClick={onClose} className="px-4 py-2 text-xs font-bold shadow-sm">
                        Close
                    </RetroButton>
                    <RetroButton 
                        variant="primary" 
                        onClick={handleDownload} 
                        disabled={downloading}
                        className="px-5 py-2 text-xs font-black flex items-center gap-2 bg-primary text-white border-primary hover:brightness-110 shadow-sm"
                    >
                        {downloading ? 'Downloading...' : 'Download Tickets'}
                    </RetroButton>
                </div>
            </div>
        </div>
    );
}

const RETRO_CLASSIC_SUGGESTIONS = [
    {
        title: "Pulp Fiction",
        year: 1994,
        genres: ["Crime", "Thriller"],
        cast: ["John Travolta", "Samuel L. Jackson", "Uma Thurman", "Bruce Willis"],
        director: "Quentin Tarantino",
        poster: "https://image.tmdb.org/t/p/w300/d5iil4xe79av6S4x1YgOObfsRgs.jpg",
        type: "movie"
    },
    {
        title: "The Matrix",
        year: 1999,
        genres: ["Action", "Sci-Fi"],
        cast: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"],
        director: "Lana Wachowski",
        poster: "https://image.tmdb.org/t/p/w300/f89U3wzqrjFmZ94eC4o0ldyILOf.jpg",
        type: "movie"
    },
    {
        title: "Fight Club",
        year: 1999,
        genres: ["Drama", "Thriller"],
        cast: ["Brad Pitt", "Edward Norton", "Helena Bonham Carter"],
        director: "David Fincher",
        poster: "https://image.tmdb.org/t/p/w300/b8QCuZ75gbsO55OIro7LzBhv0yR.jpg",
        type: "movie"
    },
    {
        title: "Goodfellas",
        year: 1990,
        genres: ["Crime", "Drama"],
        cast: ["Robert De Niro", "Ray Liotta", "Joe Pesci"],
        director: "Martin Scorsese",
        poster: "https://image.tmdb.org/t/p/w300/aKuFi0vlfg5711HgJEA3jXEWR6A.jpg",
        type: "movie"
    },
    {
        title: "The Shawshank Redemption",
        year: 1994,
        genres: ["Drama"],
        cast: ["Tim Robbins", "Morgan Freeman", "Bob Gunton"],
        director: "Frank Darabont",
        poster: "https://image.tmdb.org/t/p/w300/9cqN6GOU7z8w42h3vfw5rmdBTa1.jpg",
        type: "movie"
    },
    {
        title: "Se7en",
        year: 1995,
        genres: ["Crime", "Mystery", "Thriller"],
        cast: ["Brad Pitt", "Morgan Freeman", "Gwyneth Paltrow"],
        director: "David Fincher",
        poster: "https://image.tmdb.org/t/p/w300/69xm6261IP2GDwi16Jg36Z7OI19.jpg",
        type: "movie"
    },
    {
        title: "Jurassic Park",
        year: 1993,
        genres: ["Adventure", "Sci-Fi"],
        cast: ["Sam Neill", "Laura Dern", "Jeff Goldblum"],
        director: "Steven Spielberg",
        poster: "https://image.tmdb.org/t/p/w300/o0goEqt7vXn1ph46Yr4W2YgZ6i0.jpg",
        type: "movie"
    },
    {
        title: "Forrest Gump",
        year: 1994,
        genres: ["Drama", "Romance"],
        cast: ["Tom Hanks", "Robin Wright", "Gary Sinise"],
        director: "Robert Zemeckis",
        poster: "https://image.tmdb.org/t/p/w300/arw2vUYvzn31I61q5k6tfsr7584.jpg",
        type: "movie"
    },
    {
        title: "The Silence of the Lambs",
        year: 1991,
        genres: ["Crime", "Drama", "Thriller"],
        cast: ["Jodie Foster", "Anthony Hopkins", "Scott Glenn"],
        director: "Jonathan Demme",
        poster: "https://image.tmdb.org/t/p/w300/uS1Skvl43vufA0ui0gdI29d8g79.jpg",
        type: "movie"
    },
    {
        title: "Blade Runner",
        year: 1982,
        genres: ["Sci-Fi", "Thriller"],
        cast: ["Harrison Ford", "Rutger Hauer", "Sean Young"],
        director: "Ridley Scott",
        poster: "https://image.tmdb.org/t/p/w300/636652G1c5c56784d56784g.jpg",
        type: "movie"
    },
    {
        title: "Back to the Future",
        year: 1985,
        genres: ["Adventure", "Comedy", "Sci-Fi"],
        cast: ["Michael J. Fox", "Christopher Lloyd", "Lea Thompson"],
        director: "Robert Zemeckis",
        poster: "https://image.tmdb.org/t/p/w300/fNwbv6V2X6z4WhXu5V43t4w.jpg",
        type: "movie"
    },
    {
        title: "The Godfather",
        year: 1972,
        genres: ["Crime", "Drama"],
        cast: ["Marlon Brando", "Al Pacino", "James Caan"],
        director: "Francis Ford Coppola",
        poster: "https://image.tmdb.org/t/p/w300/3bhkrj67V2ekhh70F2uCGhblR7V.jpg",
        type: "movie"
    },
    {
        title: "Terminator 2: Judgment Day",
        year: 1991,
        genres: ["Action", "Sci-Fi"],
        cast: ["Arnold Schwarzenegger", "Linda Hamilton", "Edward Furlong"],
        director: "James Cameron",
        poster: "https://image.tmdb.org/t/p/w300/5M7wLh5vJ5PyEX72eeGgSbb65Sg.jpg",
        type: "movie"
    },
    {
        title: "Alien",
        year: 1979,
        genres: ["Horror", "Sci-Fi"],
        cast: ["Sigourney Weaver", "Tom Skerritt", "John Hurt"],
        director: "Ridley Scott",
        poster: "https://image.tmdb.org/t/p/w300/vfrQk5IP3oOI7cw8n31I6bd8g79.jpg",
        type: "movie"
    },
    {
        title: "Star Wars: A New Hope",
        year: 1977,
        genres: ["Adventure", "Sci-Fi"],
        cast: ["Mark Hamill", "Harrison Ford", "Carrie Fisher"],
        director: "George Lucas",
        poster: "https://image.tmdb.org/t/p/w300/6FfCtAuVA66qJFiQvslNu64t2R0.jpg",
        type: "movie"
    }
];

