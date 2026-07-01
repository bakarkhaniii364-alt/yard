import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import localforage from 'localforage';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth, useSync } from './instances.js';
import { isTestMode, sendTestStateUpdate, onTestStateUpdate } from '../lib/testMode.js';
import { ChatContext } from './instances.js';
import { 
  generateECDHKeypair, 
  exportPublicKeyJWK, 
  importPublicKeyJWK, 
  deriveSharedKey, 
  encryptText, 
  decryptText, 
  generateFileKey, 
  encryptFile, 
  decryptFile, 
  encryptFileMetadata, 
  decryptFileMetadata, 
  encryptPrivateKey,
  decryptPrivateKey,
  deriveKeyFromPin,
  bufferToBase64,
  base64ToUint8Array
} from '../utils/crypto.js';
import { RetroWindow, RetroInput, RetroButton, ConfirmDialog, useToast } from '../components/UI.jsx';
import { Lock, Unlock, Key, Copy, Check, Loader, AlertTriangle } from 'lucide-react';


const CACHE_VERSION = 'v6'; // Bumped for raw DB cache and E2EE support

const decryptedMediaCache = new Map();

/**
 * Downloads and decrypts encrypted media files from Supabase Storage.
 */
async function getOrDecryptMedia(row, sharedKeys) {
  if (decryptedMediaCache.has(row.id)) {
    return decryptedMediaCache.get(row.id);
  }
  try {
    const meta = row.metadata?.encrypted_media_meta;
    if (!meta) return '';

    const keysArray = Array.isArray(sharedKeys) ? sharedKeys : [sharedKeys];
    let fileKey, fileIv;
    let decrypted = false;

    for (const key of keysArray) {
      try {
        const result = await decryptFileMetadata(meta.ciphertext, meta.iv, key);
        fileKey = result.fileKey;
        fileIv = result.fileIv;
        decrypted = true;
        break;
      } catch (e) {
        // Try next key
      }
    }

    if (!decrypted) throw new Error('Failed to decrypt file metadata with any key');

    // Download the encrypted file
    const parts = row.content.split('/');
    const bucket = parts[0];
    const path = parts.slice(1).join('/');

    const { data: encryptedBlob, error: downloadError } = await supabase.storage.from(bucket).download(path);
    if (downloadError) throw downloadError;

    // Decrypt the file blob
    const mimeType = row.metadata?.mimeType || 'application/octet-stream';
    const decryptedBlob = await decryptFile(encryptedBlob, fileKey, fileIv, mimeType);

    // Create a local URL
    const url = URL.createObjectURL(decryptedBlob);
    decryptedMediaCache.set(row.id, url);
    return url;
  } catch (err) {
    console.debug('[E2EE] Media decryption failed:', err);
    return '';
  }
}

export function ChatProvider({ children }) {
  const { roomId, userId, partnerId, user } = useAuth();
  const location = useLocation();
  const isOnChatRoute = location.pathname === '/chat';
  const sync = useSync();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const rawContentMapRef = useRef(new Map());

  // E2EE States
  const [isE2EEReady, setIsE2EEReady] = useState(false);
  const privateKeyRef = useRef(null);
  const sharedKeyRef = useRef(null);
  const sharedKeysHistoryRef = useRef([]);

  // E2EE Initialization Guards
  const e2eeInitRef = useRef(false); // Tracks if local keys have been initialized this session
  const derivedKeyInputsRef = useRef(null); // Tracks the partner key fingerprint used for last derivation
  const [e2eeVersion, setE2eeVersion] = useState(0); // Incremented to force re-initialization (e.g., after restore)
  const [isE2EEInitializing, setIsE2EEInitializing] = useState(true);

  // E2EE PIN Setup & Restoration States
  const [showPinSetupPrompt, setShowPinSetupPrompt] = useState(false);
  const [pinSetupStep, setPinSetupStep] = useState('warning'); // 'warning' | 'input'
  const [pinSetupInput, setPinSetupInput] = useState('');
  const [pinSetupConfirm, setPinSetupConfirm] = useState('');
  const [pinWarningConfirmed, setPinWarningConfirmed] = useState(false);
  
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [restoreKeyInput, setRestoreKeyInput] = useState(''); // Holds PIN input during restore
  const [restoreError, setRestoreError] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeriving, setIsDeriving] = useState(false); // For showing "securing your keys..." spinner
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const addToast = useToast();

  // Sync Room Profiles for Public Keys
  const roomProfiles = sync?.globalState?.room_profiles || {};
  const myPubJwkX = roomProfiles[userId]?.e2ee_public_key?.x || null;
  const myPubJwkY = roomProfiles[userId]?.e2ee_public_key?.y || null;
  const partnerPubJwkX = roomProfiles[partnerId]?.e2ee_public_key?.x || null;
  const partnerPubJwkY = roomProfiles[partnerId]?.e2ee_public_key?.y || null;
  const isSyncInitialized = sync?.isInitialized;

  // Unified bulletproof key backup helper
  const saveKeysAndBackup = useCallback(async (keys, pin) => {
    try {
      const localPubJwk = await exportPublicKeyJWK(keys.publicKey);

      // Generate a random 16-byte salt
      const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
      const saltBase64 = bufferToBase64(saltBytes);

      // Derive PBKDF2 wrapping key and encrypt the private key
      const wrappingKey = await deriveKeyFromPin(pin, saltBytes);
      const encrypted = await encryptPrivateKey(keys.privateKey, wrappingKey);

      // Keep private key in-memory ref only
      privateKeyRef.current = keys.privateKey;

      // 1. Update user_metadata in Supabase Auth (backup source of truth)
      await supabase.auth.updateUser({
        data: {
          encrypted_private_key: encrypted,
          e2ee_public_key: localPubJwk,
          e2ee_salt: saltBase64
        }
      });

      // 2. Update room profiles in SyncContext (shared with partner for handshake)
      const existingProfile = sync?.globalState?.room_profiles?.[userId] || {};
      const currentPubKey = existingProfile.e2ee_public_key;
      let pubKeyHistory = existingProfile.e2ee_public_key_history || [];
      
      if (currentPubKey) {
        const isDuplicate = pubKeyHistory.some(k => k.x === currentPubKey.x && k.y === currentPubKey.y);
        if (!isDuplicate) {
          pubKeyHistory = [...pubKeyHistory, currentPubKey];
        }
      }

      await sync.updateSyncStateAtomic('room_profiles', userId, {
        e2ee_public_key: localPubJwk,
        e2ee_public_key_history: pubKeyHistory,
        encrypted_private_key: encrypted,
        e2ee_salt: saltBase64
      });
    } catch (err) {
      console.error('[E2EE] saveKeysAndBackup failed:', err);
      throw err;
    }
  }, [userId, sync]);

  // Initialize E2EE Cryptography & Exchange Keys
  useEffect(() => {
    if (!userId || !roomId || !isSyncInitialized) {
      privateKeyRef.current = null;
      sharedKeyRef.current = null;
      setIsE2EEReady(false);
      e2eeInitRef.current = false;
      derivedKeyInputsRef.current = null;
      setIsE2EEInitializing(false);
      return;
    }

    let isCurrent = true;
    setIsE2EEInitializing(true);

    const initE2EE = async () => {
      try {
        // --- PHASE 1: Local key initialization (runs once per session) ---
        if (!e2eeInitRef.current) {
          const myProfile = roomProfiles[userId] || {};
          const backupExists = !!myProfile.encrypted_private_key || !!user?.user_metadata?.encrypted_private_key;

          if (!privateKeyRef.current) {
            if (backupExists) {
              let latestUser = user;
              try {
                const { data } = await supabase.auth.getUser();
                if (data?.user) latestUser = data.user;
              } catch (e) {
                console.warn('[E2EE] Failed to fetch latest user metadata:', e);
              }
              
              // Retrieve cached E2EE PIN from localStorage to persist unlock state
              const userPin = localStorage.getItem(`e2ee_pin_${userId}`);
              const saltBase64 = myProfile.e2ee_salt || latestUser?.user_metadata?.e2ee_salt;
              const encryptedData = myProfile.encrypted_private_key || latestUser?.user_metadata?.encrypted_private_key;
              const pubJwk = myProfile.e2ee_public_key || latestUser?.user_metadata?.e2ee_public_key;

              if (userPin && saltBase64 && encryptedData && pubJwk) {
                try {
                  const saltBytes = base64ToUint8Array(saltBase64);
                  const wrappingKey = await deriveKeyFromPin(userPin, saltBytes);
                  const privateKey = await decryptPrivateKey(encryptedData, wrappingKey);
                  privateKeyRef.current = privateKey;
                  if (isCurrent) {
                    setIsE2EEReady(true);
                    setShowRestorePrompt(false);
                    setShowPinSetupPrompt(false);
                  }

                  // Heal database room profile if it was missing/erased
                  if (!myProfile.encrypted_private_key) {
                    await sync.updateSyncStateAtomic('room_profiles', userId, {
                      e2ee_public_key: pubJwk,
                      encrypted_private_key: encryptedData,
                      e2ee_salt: saltBase64
                    });
                  }
                } catch (err) {
                  console.error('[E2EE] Auto-restore from user_metadata failed:', err);
                }
              }

              // No auto-restore even in test mode. Force user input.
              
              if (!privateKeyRef.current) {
                // A backup exists on the database. Show the PIN restore prompt.
                if (isCurrent) {
                  setShowRestorePrompt(true);
                  setIsE2EEInitializing(false);
                }
                return; // Halt initialization until restored or reset
              }
            } else {
              // No backup exists. Prompt user to setup PIN.
              if (isCurrent) {
                setShowPinSetupPrompt(true);
                setIsE2EEInitializing(false);
              }
              return; // Halt initialization until PIN is setup
            }
          }

          if (isCurrent) {
            e2eeInitRef.current = true;
          }
        }

        if (!isCurrent) return;

        // --- PHASE 2: Derive shared key (re-runs when partner key changes) ---
        const myPrivateKey = privateKeyRef.current;
        if (!myPrivateKey) return; // Still no private key

        if (partnerId) {
          const partnerProfile = roomProfiles[partnerId] || {};
          const partnerPubJwk = partnerProfile.e2ee_public_key;
          if (partnerPubJwk) {
            const historyJwks = partnerProfile.e2ee_public_key_history || [];
            const allJwks = [partnerPubJwk, ...historyJwks];
            
            // Only re-derive if the partner key inputs actually changed
            const inputFingerprint = allJwks.map(k => `${k.x}:${k.y}`).join(',');
            if (derivedKeyInputsRef.current === inputFingerprint && sharedKeyRef.current) {
              // Same inputs, skip re-derivation
              return;
            }
            
            const derivedKeys = [];
            for (const jwk of allJwks) {
               try {
                 const partnerPubKey = await importPublicKeyJWK(jwk);
                 const derived = await deriveSharedKey(myPrivateKey, partnerPubKey);
                 derivedKeys.push(derived);
               } catch (e) {
                 console.warn('[E2EE] Failed to derive historical key:', e);
               }
            }
            
            if (isCurrent && derivedKeys.length > 0) {
              derivedKeyInputsRef.current = inputFingerprint;
              sharedKeyRef.current = derivedKeys[0];
              sharedKeysHistoryRef.current = derivedKeys;
              setIsE2EEReady(true);
            }
          } else {
            if (isCurrent) {
              derivedKeyInputsRef.current = null;
              sharedKeyRef.current = null;
              sharedKeysHistoryRef.current = [];
              setIsE2EEReady(false);
            }
          }
        }
        
        if (isCurrent) {
          setIsE2EEInitializing(false);
        }
      } catch (err) {
        console.error('[E2EE] Init failed:', err);
        if (isCurrent) {
          setIsE2EEInitializing(false);
        }
      }
    };

    initE2EE();

    return () => {
      isCurrent = false;
    };
  }, [userId, roomId, partnerId, isSyncInitialized, myPubJwkX, myPubJwkY, partnerPubJwkX, partnerPubJwkY, e2eeVersion, user, saveKeysAndBackup]);

  // Detect if partner has reset their E2EE key and clear local history/cache
  useEffect(() => {
    if (!roomId || !partnerId || !isSyncInitialized) return;
    const partnerProfile = roomProfiles[partnerId];
    const partnerPubKey = partnerProfile?.e2ee_public_key;
    if (partnerPubKey) {
      const pubKeyStr = `${partnerPubKey.x}:${partnerPubKey.y}`;
      const cacheKey = `last_partner_pubkey_${roomId}_${partnerId}`;
      const storedPubKey = localStorage.getItem(cacheKey);

      if (storedPubKey && storedPubKey !== pubKeyStr) {
        console.log('[E2EE] Partner public key change/reset detected. Clearing local chat history and cache.');
        setMessages([]);
        const rawCacheKey = `chat_raw_cache_${roomId}_${CACHE_VERSION}`;
        localforage.setItem(rawCacheKey, []).catch(() => {});
      }
      localStorage.setItem(cacheKey, pubKeyStr);
    }
  }, [roomId, partnerId, isSyncInitialized, roomProfiles]);

  // Restore/Reset Callbacks
  const handleRestore = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!restoreKeyInput.trim()) return;

    setIsRestoring(true);
    setRestoreError(null);
    setIsDeriving(true);

    // Yield main thread to allow the spinner to render
    setTimeout(async () => {
      try {
        const myProfile = roomProfiles[userId] || {};
        const encryptedData = myProfile.encrypted_private_key || user?.user_metadata?.encrypted_private_key;
        const pubJwk = myProfile.e2ee_public_key || user?.user_metadata?.e2ee_public_key;
        const saltBase64 = myProfile.e2ee_salt || user?.user_metadata?.e2ee_salt;

        if (!encryptedData || !pubJwk || !saltBase64) {
          throw new Error('No backup found for this account.');
        }

        const pin = restoreKeyInput.trim();
        const saltBytes = base64ToUint8Array(saltBase64);

        // PBKDF2 wrapping key derivation
        const wrappingKey = await deriveKeyFromPin(pin, saltBytes);
        const privateKey = await decryptPrivateKey(encryptedData, wrappingKey);

        privateKeyRef.current = privateKey;
        setIsE2EEReady(true);

        // Cache the verified PIN locally
        localStorage.setItem(`e2ee_pin_${userId}`, pin);

        addToast('Chat history successfully unlocked!', 'success');
        setShowRestorePrompt(false);
        setRestoreKeyInput('');
        setRestoreError(null);

        // Force re-derivation by resetting guards and bumping version
        e2eeInitRef.current = false;
        derivedKeyInputsRef.current = null;
        setE2eeVersion(v => v + 1);
      } catch (err) {
        console.error('[E2EE] Restore failed:', err);
        setRestoreError('Invalid Chat PIN. Please double-check and try again.');
        addToast('Failed to unlock chat history.', 'error');
      } finally {
        setIsRestoring(false);
        setIsDeriving(false);
      }
    }, 50);
  }, [userId, roomProfiles, user, restoreKeyInput, addToast]);

  const handleCreatePin = useCallback(async (pin) => {
    setIsDeriving(true);
    // Yield main thread to allow the spinner to render
    setTimeout(async () => {
      try {
        const keys = await generateECDHKeypair();
        await saveKeysAndBackup(keys, pin);

        // Cache the newly created PIN locally
        localStorage.setItem(`e2ee_pin_${userId}`, pin);

        addToast('Chat PIN successfully created! Chat history is now encrypted.', 'success');
        setShowPinSetupPrompt(false);
        setIsE2EEReady(true);
        // Force re-derivation
        e2eeInitRef.current = false;
        derivedKeyInputsRef.current = null;
        setE2eeVersion(v => v + 1);
      } catch (err) {
        console.error('[E2EE] PIN setup failed:', err);
        addToast('Failed to set up Chat PIN.', 'error');
      } finally {
        setIsDeriving(false);
      }
    }, 50);
  }, [userId, saveKeysAndBackup, addToast]);

  const changePin = useCallback(async (newPin) => {
    if (!privateKeyRef.current) {
      addToast('Chat must be unlocked to change PIN.', 'error');
      return false;
    }
    setIsDeriving(true);
    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
          const saltBase64 = bufferToBase64(saltBytes);

          const wrappingKey = await deriveKeyFromPin(newPin, saltBytes);
          const encrypted = await encryptPrivateKey(privateKeyRef.current, wrappingKey);

          await supabase.auth.updateUser({
            data: {
              encrypted_private_key: encrypted,
              e2ee_salt: saltBase64
            }
          });

          await sync.updateSyncStateAtomic('room_profiles', userId, {
            encrypted_private_key: encrypted,
            e2ee_salt: saltBase64
          });

          // Cache the changed PIN locally
          localStorage.setItem(`e2ee_pin_${userId}`, newPin);

          addToast('Chat PIN changed successfully!', 'success');
          resolve(true);
        } catch (err) {
          console.error('[E2EE] changePin failed:', err);
          addToast('Failed to change PIN.', 'error');
          resolve(false);
        } finally {
          setIsDeriving(false);
        }
      }, 50);
    });
  }, [userId, sync, addToast]);

  const clearChatHistory = useCallback(async () => {
    if (!roomId) return;
    try {
      const { error } = await supabase.from('chat_messages').delete().eq('room_id', roomId);
      if (error) {
        console.error('[CHAT] Error clearing chat history:', error);
        return;
      }
      setMessages([]);
      const rawCacheKey = `chat_raw_cache_${roomId}_${CACHE_VERSION}`;
      localforage.setItem(rawCacheKey, []).catch(() => {});

      if (sync?.broadcast) {
        sync.broadcast('chat_cleared', { roomId });
      }
    } catch (e) {
      console.error('[CHAT] clearChatHistory exception:', e);
    }
  }, [roomId, sync]);

  const handleResetHistory = useCallback(async () => {
    setIsRestoring(true);
    setRestoreError(null);
    setShowResetConfirm(false);

    try {
      // Clear key state
      privateKeyRef.current = null;
      sharedKeyRef.current = null;
      setIsE2EEReady(false);

      // Clear the cached PIN
      localStorage.removeItem(`e2ee_pin_${userId}`);

      // Delete database messages and local cache
      await clearChatHistory();

      // Force user to set up a new Chat PIN from scratch
      setShowRestorePrompt(false);
      setShowPinSetupPrompt(true);
      setPinSetupStep('warning');
      setPinSetupInput('');
      setPinSetupConfirm('');
      setPinWarningConfirmed(false);
      
      addToast('Resetting chat keys. Please set up a new PIN.', 'info');
    } catch (err) {
      console.error('[E2EE] Reset failed:', err);
      addToast('Failed to reset encryption keys.', 'error');
    } finally {
      setIsRestoring(false);
    }
  }, [userId, roomId, sync, addToast, clearChatHistory]);

  /**
   * Maps a database row into an application message object.
   * Decrypts content on-the-fly if encrypted.
   */
  const mapMessage = useCallback(async (row) => {
    const isTemp = String(row.id).startsWith('temp-');
    const isDeleted = !!row.metadata?.isDeleted;
    const isEncrypted = !!row.metadata?.is_encrypted && !isTemp && !isDeleted;
    const currentSharedKey = sharedKeyRef.current;

    const mapped = {
      ...row,
      sender: row.sender_id,
      time: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      replyTo: row.metadata?.replyTo || null,
      reactions: row.metadata?.reactions || [],
      isDeleted: row.metadata?.isDeleted || false,
      isEdited: row.metadata?.isEdited || false,
      duration: row.metadata?.duration || null,
      status: row.metadata?.status || 'sent',
      readAt: row.metadata?.readAt || null,
      fileName: row.metadata?.fileName || null,
      fileSize: row.metadata?.fileSize || null,
      clientId: row.metadata?.client_id || null
    };

    if (isDeleted) {
      mapped.text = 'This message was deleted';
    } else if (row.type === 'text') {
      if (isEncrypted) {
        if (sharedKeysHistoryRef.current.length > 0) {
          let decrypted = false;
          for (const key of sharedKeysHistoryRef.current) {
            try {
              mapped.text = await decryptText(row.content, row.metadata.iv, key);
              decrypted = true;
              break;
            } catch (e) {
              // Try next key
            }
          }
          if (!decrypted) {
            console.debug('[E2EE] Decrypt text failed for all available keys');
            mapped.text = '[Encrypted Message (Decryption failed)]';
          }
        } else {
          mapped.text = '[Encrypted Message]';
        }
      } else {
        mapped.text = row.content || '';
        if (row.content && row.content.includes('"ciphertext"')) {
          mapped.text = '[Legacy Encrypted Message]';
        }
      }
    } else if (row.type === 'image') {
      if (isEncrypted) {
        if (sharedKeysHistoryRef.current.length > 0) {
          mapped.url = await getOrDecryptMedia(row, sharedKeysHistoryRef.current);
        } else {
          mapped.url = '';
          mapped.isMediaLocked = true;
        }
      } else {
        mapped.url = row.content;
      }
    } else if (row.type === 'voice') {
      if (isEncrypted) {
        if (sharedKeysHistoryRef.current.length > 0) {
          mapped.audioUrl = await getOrDecryptMedia(row, sharedKeysHistoryRef.current);
        } else {
          mapped.audioUrl = '';
          mapped.isMediaLocked = true;
        }
      } else {
        mapped.audioUrl = row.content;
      }
    } else if (row.type === 'video' || row.type === 'audio' || row.type === 'file') {
      if (isEncrypted) {
        if (sharedKeysHistoryRef.current.length > 0) {
          mapped.url = await getOrDecryptMedia(row, sharedKeysHistoryRef.current);
        } else {
          mapped.url = '';
          mapped.isMediaLocked = true;
        }
      } else {
        mapped.url = row.content;
      }
    } else if (row.type === 'game_invite') {
      mapped.text = row.content;
      mapped.gameId = row.metadata?.gameId;
      mapped.gameTitle = row.metadata?.gameTitle;
      mapped.status = row.metadata?.status;
    } else if (row.type === 'call_invite') {
      mapped.callType = row.metadata?.callType || 'voice';
      mapped.status = row.metadata?.status || 'accepted';
    }

    return mapped;
  }, []);

  // Main Chat Initialization and Realtime Subscriptions
  useEffect(() => {
    if (!roomId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    if (isE2EEInitializing) return;

    let mounted = true;
    const rawCacheKey = `chat_raw_cache_${roomId}_${CACHE_VERSION}`;

    const updateRawCache = async (eventType, row) => {
      try {
        const cached = await localforage.getItem(rawCacheKey) || [];
        let nextRaw = [...cached];
        if (eventType === 'INSERT') {
          if (!nextRaw.some(r => r.id === row.id)) {
            nextRaw = [row, ...nextRaw].slice(0, 50);
          }
        } else if (eventType === 'UPDATE') {
          nextRaw = nextRaw.map(r => r.id === row.id ? row : r);
        } else if (eventType === 'DELETE') {
          nextRaw = nextRaw.filter(r => r.id !== row.id);
        }
        await localforage.setItem(rawCacheKey, nextRaw);
      } catch (err) {
        console.warn('[CHAT] Cache update failed:', err);
      }
    };

    const initChat = async () => {
      if (isTestMode()) {
        setLoading(false);
        return;
      }

      // Load raw cached rows first and map them
      const cachedRaw = await localforage.getItem(rawCacheKey);
      if (cachedRaw && mounted) {
        const resolvedData = await Promise.all(cachedRaw.map(row => mapMessage(row)));
        const sortedData = resolvedData.reverse();
        setMessages(sortedData);
        setLoading(false);
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[CHAT] Fetch error:', error);
        if (mounted) setLoading(false);
        return;
      }

      if (data && mounted) {
        await localforage.setItem(rawCacheKey, data);
        const resolvedData = await Promise.all(data.map(row => mapMessage(row)));
        const sortedData = resolvedData.reverse();
        setMessages(sortedData);
        setLoading(false);
        setHasMore(data.length === 50);
      }
    };

    initChat();

    let channel = null;
    let unsubs = [];

    if (isTestMode()) {
      unsubs.push(onTestStateUpdate('chat_message', (payload) => {
        mapMessage(payload).then(mapped => {
          if (!mounted) return;
          setMessages(prev => {
            if (prev.some(m => m.id === mapped.id)) return prev;
            return [...prev, mapped];
          });
        });
      }));

      unsubs.push(onTestStateUpdate('chat_message_update', (payload) => {
        mapMessage(payload).then(mapped => {
          if (!mounted) return;
          setMessages(prev => prev.map(m => m.id === mapped.id ? mapped : m));
        });
      }));
    } else {
      channel = supabase.channel(`chat_realtime_${roomId}_${CACHE_VERSION}`);
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (payload.eventType === 'INSERT') {
            updateRawCache('INSERT', payload.new);
            mapMessage(payload.new).then(mapped => {
              if (!mounted) return;
              setMessages(prev => {
                if (prev.some(m => m.id === mapped.id)) return prev;
                
                const clientId = mapped.clientId;
                if (clientId && prev.some(m => String(m.id).startsWith('temp-') && m.clientId === clientId)) {
                  return prev.map(m => (String(m.id).startsWith('temp-') && m.clientId === clientId) ? mapped : m);
                }

                return [...prev, mapped];
              });
            });
          } else if (payload.eventType === 'UPDATE') {
            updateRawCache('UPDATE', payload.new);
            mapMessage(payload.new).then(mapped => {
              if (!mounted) return;
              setMessages(prev => prev.map(m => m.id === mapped.id ? mapped : m));
            });
          } else if (payload.eventType === 'DELETE') {
            updateRawCache('DELETE', payload.old);
            if (mounted) setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        })
        .subscribe();
    }

    const handleBroadcast = (e) => {
      const { event, payload } = e.detail;
      if (event === 'chat_cleared' && payload?.roomId === roomId) {
        if (mounted) {
          setMessages([]);
          localforage.setItem(rawCacheKey, []).catch(() => {});
        }
      }
    };
    window.addEventListener('sync_broadcast', handleBroadcast);

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
      unsubs.forEach(un => un());
      window.removeEventListener('sync_broadcast', handleBroadcast);
    };
  }, [roomId, isE2EEReady, isE2EEInitializing, mapMessage]); // Re-subscribe and refresh when E2EE becomes available

  const { broadcast } = sync || {};

  /**
   * Encrypts and sends a chat message.
   */
  const sendMessage = useCallback(async (content, type = 'text', metadata = {}) => {
    const meta = (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) ? metadata : {};

    if (!roomId || !userId) {
      console.error('[CHAT] sendMessage called before auth ready:', { roomId, userId });
      return;
    }
    if (!content && type === 'text') {
      console.warn('[CHAT] Refusing empty text message');
      return;
    }

    const tempId = `temp-${crypto.randomUUID()}`;
    const clientId = crypto.randomUUID();
    const optimisticContent = (content instanceof Blob || content instanceof File) ? URL.createObjectURL(content) : content;

    const optimisticMsg = {
      id: tempId,
      room_id: roomId,
      sender_id: userId,
      type,
      content: optimisticContent,
      metadata: { ...meta, status: 'sending', client_id: clientId },
      created_at: new Date().toISOString()
    };

    const mappedOptimistic = await mapMessage(optimisticMsg);
    mappedOptimistic.clientId = clientId;
    
    if (content instanceof Blob || content instanceof File) {
      rawContentMapRef.current.set(clientId, content);
    }
    
    setMessages(prev => [...prev, mappedOptimistic]);

    if (isTestMode()) {
      sendTestStateUpdate('chat_message', optimisticMsg);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      return optimisticMsg;
    }

    try {
      let finalContent = content;
      let finalMetadata = { ...meta, client_id: clientId };
      const currentSharedKey = sharedKeyRef.current;

      if (currentSharedKey) {
        if (type === 'text') {
          // ASSERTION: The IV for text message encryption is generated internally within the encryptText helper 
          // using window.crypto.getRandomValues and cannot be passed in from outside. This ensures absolute uniqueness.
          const encrypted = await encryptText(content, currentSharedKey);
          finalContent = encrypted.ciphertext;
          finalMetadata.iv = encrypted.iv;
          finalMetadata.is_encrypted = true;
        } else if (content instanceof Blob || content instanceof File) {
          // Encrypt file content with a randomized key
          const fileKey = await generateFileKey();
          // ASSERTION: The IV for file content encryption is generated directly within this function scope 
          // using window.crypto.getRandomValues and cannot be passed in from outside. This ensures absolute uniqueness.
          const fileIv = window.crypto.getRandomValues(new Uint8Array(12));
          const encryptedBlob = await encryptFile(content, fileKey, fileIv);

          const fileExt = content.name?.split('.').pop() || content.type.split('/')[1]?.split(';')[0] || 'bin';
          const bucket = (type === 'voice' || type === 'audio') ? 'voice_notes' : 'scrapbook';
          const fileName = `${roomId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, encryptedBlob);
          if (uploadError) throw uploadError;

          finalContent = `${bucket}/${fileName}`;
          
          // Encrypt fileKey metadata with shared ECDH key
          const encryptedMeta = await encryptFileMetadata(fileKey, fileIv, currentSharedKey);
          
          finalMetadata.encrypted_media_meta = encryptedMeta;
          finalMetadata.is_encrypted = true;
          finalMetadata.mimeType = content.type;
          
          if (content.name && !meta.fileName) finalMetadata.fileName = content.name;
          if (content.size && !meta.fileSize) finalMetadata.fileSize = content.size;
        }
      } else {
        console.warn('[E2EE] Sending unencrypted message (no shared key derived yet)');
        if (content instanceof Blob || content instanceof File) {
          const fileExt = content.name?.split('.').pop() || content.type.split('/')[1]?.split(';')[0] || 'bin';
          const bucket = (type === 'voice' || type === 'audio') ? 'voice_notes' : 'scrapbook';
          const fileName = `${roomId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, content);
          if (uploadError) throw uploadError;

          finalContent = `${bucket}/${fileName}`;
          if (content.name && !meta.fileName) finalMetadata.fileName = content.name;
          if (content.size && !meta.fileSize) finalMetadata.fileSize = content.size;
        }
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: userId,
          type,
          content: finalContent,
          metadata: { ...finalMetadata, status: 'sent' }
        })
        .select()
        .single();

      if (error) throw error;

      if (broadcast) {
        broadcast('chat_message', { sender: userId, type });
      }

      if (data && data.id) {
        const mapped = await mapMessage(data);
        if (clientId) {
          rawContentMapRef.current.delete(clientId);
        }
        setMessages(prev => {
          if (!prev.some(m => String(m.id).startsWith('temp-') && m.clientId === clientId)) {
             if (prev.some(m => m.id === mapped.id)) return prev;
             return [...prev, mapped];
          }
          return prev.map(m => (String(m.id).startsWith('temp-') && m.clientId === clientId) ? mapped : m);
        });

        // Update local raw cache
        const rawCacheKey = `chat_raw_cache_${roomId}_${CACHE_VERSION}`;
        const cached = await localforage.getItem(rawCacheKey) || [];
        if (!cached.some(r => r.id === data.id)) {
          const nextRaw = [data, ...cached].slice(0, 50);
          await localforage.setItem(rawCacheKey, nextRaw);
        }
      } else {
        if (clientId) {
          rawContentMapRef.current.delete(clientId);
        }
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      }
    } catch (err) {
      console.error('[CHAT] Send error:', err);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
    }
  }, [roomId, userId, broadcast, mapMessage]);

  const updateMessage = useCallback(async (idOrIds, updates) => {
    if (!idOrIds) return;
    const isArray = Array.isArray(idOrIds);
    if (isArray && idOrIds.length === 0) return;

    if (isTestMode()) {
      const ids = isArray ? idOrIds : [idOrIds];
      setMessages(prev => {
        return prev.map(m => {
          if (ids.includes(m.id)) {
            const updatedMetadata = {
              ...(m.metadata || {}),
              ...updates,
              client_id: m.clientId || m.metadata?.client_id
            };
            const updatedRow = {
              id: m.id,
              room_id: m.room_id || roomId,
              sender_id: m.sender_id || m.sender,
              type: m.type,
              content: updates.text !== undefined ? updates.text : m.content,
              metadata: updatedMetadata,
              created_at: m.created_at || new Date().toISOString()
            };
            sendTestStateUpdate('chat_message_update', updatedRow);
            return {
              ...m,
              ...updates,
              metadata: updatedMetadata,
              status: updatedMetadata.status || m.status,
              readAt: updatedMetadata.readAt || m.readAt
            };
          }
          return m;
        });
      });
      return;
    }

    // Supabase JS update replaces JSONB. We must merge it manually.
    // Fetch the existing message(s) first.
    const { data: existingRows } = await supabase
      .from('chat_messages')
      .select('*')
      .filter('id', isArray ? 'in' : 'eq', isArray ? `(${idOrIds.join(',')})` : idOrIds);
      
    if (!existingRows || existingRows.length === 0) return;

    for (const row of existingRows) {
      let finalContent = row.content;
      const mergedMetadata = { ...(row.metadata || {}), ...updates };
      
      // If we are updating the text content
      if (updates.text !== undefined) {
        finalContent = updates.text;
        delete mergedMetadata.text; // Text doesn't belong in metadata
        
        const currentSharedKey = sharedKeyRef.current;
        if (currentSharedKey && !updates.isDeleted) {
          try {
            const encrypted = await encryptText(finalContent, currentSharedKey);
            finalContent = encrypted.ciphertext;
            mergedMetadata.iv = encrypted.iv;
            mergedMetadata.is_encrypted = true;
          } catch (e) {
            console.error('[CHAT] Encryption failed during update:', e);
          }
        } else {
          mergedMetadata.is_encrypted = false;
        }
      }

      const { error } = await supabase
        .from('chat_messages')
        .update({ content: finalContent, metadata: mergedMetadata })
        .eq('id', row.id);
        
      if (error) console.error('[CHAT] Update error:', error);
    }
  }, []);

  const deleteMessage = useCallback(async (id) => {
    if (!id) return;
    
    // Track row locally for test mode deletion
    if (isTestMode()) {
      setMessages(prev => prev.filter(m => m.id !== id));
      sendTestStateUpdate('chat_message_delete', { id });
      return;
    }

    try {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('id', id)
        .single();
        
      if (data) {
        const content = data.content;
        const type = data.type;
        // If content points to a file in a storage bucket
        if ((type === 'image' || type === 'video' || type === 'audio' || type === 'voice' || type === 'file') && content && content.includes('/')) {
          const parts = content.split('/');
          const bucket = parts[0];
          const path = parts.slice(1).join('/');
          if (bucket && path) {
            console.log(`[CHAT] Deleting file from storage bucket ${bucket}: ${path}`);
            await supabase.storage.from(bucket).remove([path]);
          }
        }
      }
    } catch (e) {
      console.warn('[CHAT] Failed to delete media file from storage:', e);
    }

    const { error } = await supabase.from('chat_messages').delete().eq('id', id);
    if (error) console.error('[CHAT] Delete error:', error);
  }, []);

  const loadMore = useCallback(async () => {
    if (!roomId || !hasMore || loading) return;
    const oldestMsg = messages[0];
    if (!oldestMsg) return;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .lt('created_at', oldestMsg.created_at)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[CHAT] Load more error:', error);
      return;
    }

    if (data) {
      const resolvedData = await Promise.all(data.map(row => mapMessage(row)));
      const sortedData = resolvedData.reverse();
      setMessages(prev => [...sortedData, ...prev]);
      setHasMore(data.length === 50);
    }
  }, [roomId, hasMore, loading, messages, mapMessage]);

  const resetToLatest = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) {
      const resolvedData = await Promise.all(data.map(row => mapMessage(row)));
      const sortedData = resolvedData.reverse();
      setMessages(sortedData);
      setHasMore(data.length === 50);
    }
    setLoading(false);
  }, [roomId, mapMessage]);

  const searchMessages = useCallback(async (query, page = 0, limit = 20, filters = {}) => {
    if (!roomId) return { data: [], hasMore: false };
    const { byMe, byPartner, hasMedia } = filters;
    const isE2EEActive = !!sharedKeyRef.current;

    if (query && isE2EEActive) {
      // In-memory decryption search for E2EE text search (up to 1000 messages)
      let q = supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId);

      if (byMe) q = q.eq('sender_id', userId);
      if (byPartner) q = q.eq('sender_id', partnerId);
      if (hasMedia) q = q.in('type', ['image', 'video', 'audio', 'voice', 'file']);

      const { data, error } = await q
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        console.error('[CHAT] E2EE Search error:', error);
        return { data: [], hasMore: false };
      }

      const resolvedData = await Promise.all(data.map(row => mapMessage(row)));
      const filtered = resolvedData.filter(m => {
        if (!query) return true;
        return m.text && m.text.toLowerCase().includes(query.toLowerCase());
      });

      const paginated = filtered.slice(page * limit, (page + 1) * limit);
      return { data: paginated, hasMore: filtered.length > (page + 1) * limit };
    } else {
      // Standard database search (either no text query or non-E2EE)
      let q = supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId);

      if (byMe) q = q.eq('sender_id', userId);
      if (byPartner) q = q.eq('sender_id', partnerId);
      if (hasMedia) q = q.in('type', ['image', 'video', 'audio', 'voice', 'file']);
      
      if (query) {
        q = q.textSearch('content', query, { type: 'websearch', config: 'english' });
      }

      const { data, error } = await q
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (error) {
        console.error('[CHAT] Search error:', error);
        return { data: [], hasMore: false };
      }

      const resolvedData = await Promise.all(data.map(row => mapMessage(row)));
      return { data: resolvedData, hasMore: data.length === limit };
    }
  }, [roomId, userId, partnerId, mapMessage]);

  const jumpToMessage = useCallback(async (createdAt) => {
    if (!roomId || !createdAt) return [];
    setLoading(true);
    
    const { data: before } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .lte('created_at', createdAt)
      .order('created_at', { ascending: false })
      .limit(25);
      
    const { data: after } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .gt('created_at', createdAt)
      .order('created_at', { ascending: true })
      .limit(25);
      
    const combined = [...(before || []).reverse(), ...(after || [])];
    const resolvedData = await Promise.all(combined.map(row => mapMessage(row)));
    setMessages(resolvedData);
    setHasMore((before || []).length === 25);
    setLoading(false);
    return resolvedData;
  }, [roomId, mapMessage]);

  const loadNewer = useCallback(async () => {
    if (!roomId || loading) return;
    const newestMsg = messages[messages.length - 1];
    if (!newestMsg) return;
    
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .gt('created_at', newestMsg.created_at)
      .order('created_at', { ascending: true })
      .limit(50);
      
    if (data && data.length > 0) {
      const resolvedData = await Promise.all(data.map(row => mapMessage(row)));
      setMessages(prev => [...prev, ...resolvedData]);
    }
  }, [roomId, loading, messages, mapMessage]);

  const retrySendMessage = useCallback(async (msg) => {
    if (!msg || !msg.id) return;
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    const clientId = msg.clientId;
    let originalContent = msg.content;
    if (clientId && rawContentMapRef.current.has(clientId)) {
      originalContent = rawContentMapRef.current.get(clientId);
    }
    const { status, client_id, ...meta } = msg.metadata || {};
    const resendMetadata = {
      ...meta,
      replyTo: msg.replyTo,
      duration: msg.duration,
      fileName: msg.fileName,
      fileSize: msg.fileSize,
      gameId: msg.gameId,
      gameTitle: msg.gameTitle,
      callType: msg.callType
    };
    Object.keys(resendMetadata).forEach(key => {
      if (resendMetadata[key] === undefined || resendMetadata[key] === null) {
        delete resendMetadata[key];
      }
    });
    await sendMessage(originalContent, msg.type, resendMetadata);
    if (clientId) {
      rawContentMapRef.current.delete(clientId);
    }
  }, [sendMessage]);

  const value = { 
    messages, sendMessage, retrySendMessage, updateMessage, deleteMessage, clearChatHistory, loadMore, loading, hasMore, searchMessages, jumpToMessage, loadNewer, resetToLatest, resetE2EEKeys: handleResetHistory, changePin,
    isE2EEReady,
    showRestorePrompt, setShowRestorePrompt,
    handleRestore, restoreKeyInput, setRestoreKeyInput, restoreError, isRestoring, isDeriving,
    showPinSetupPrompt, setShowPinSetupPrompt,
    pinSetupStep, setPinSetupStep, pinSetupInput, setPinSetupInput, pinSetupConfirm, setPinSetupConfirm, pinWarningConfirmed, setPinWarningConfirmed, handleCreatePin,
    showResetConfirm, setShowResetConfirm
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}
