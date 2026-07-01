import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
const { 
  User, Trophy, Image: ImageIcon, Sun, CloudRain, Snowflake, Trash2, Volume2, 
  LogOut, Heart, Calendar, Sparkle, Lock, Eye, EyeOff, Loader, Check, Hand, Zap, 
  CloudLightning, Save, X, Bell, MessageSquare, Monitor, Brush, Palette, Gamepad2, 
  ShieldCheck, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Search, VolumeX, Info,
  Cloud, Users
} = Lucide;
import { useCall, useChat } from '../context/instances.js';
import { RetroWindow, RetroButton, RetroInput, ConfirmDialog, useToast } from '../components/UI.jsx';
import { compressImage } from '../utils/helpers.js';
import { playAudio } from '../utils/audio.js';
import { supabase } from '../lib/supabase.js';
import { requestNotificationPermission, sendNativeNotification } from '../utils/notifications.js';
import localforage from 'localforage';


export function SettingsView({ compact = false, onClose, theme, setTheme, profile, setProfile, onLogout, onDelete, sfxEnabled, setSfxEnabled, notificationsEnabled, setNotificationsEnabled, weather, setWeather, setPreviewWeather, setPreviewBgPattern, setPreviewBgPatternOpacity, scores, userId, partnerId, coupleData, setCoupleData, streaks }) {
  const navigate = useNavigate();
  const toast = useToast();
  
  const { 
    testTurnConfig, endCall, callStatus,
    noiseSuppression, setNoiseSuppression,
    echoCancellation, setEchoCancellation
  } = useCall();

  const { resetE2EEKeys } = useChat();
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState(null);
  const [showResetE2eeConfirm, setShowResetE2eeConfirm] = useState(false);

  const handleViewRecoveryKey = async () => {
    try {
      const key = await localforage.getItem(`e2ee_recovery_key_${userId}`);
      setRecoveryKey(key);
      setShowRecoveryKey(true);
      playAudio('click', localSfxEnabled);
    } catch (e) {
      toast('Failed to read recovery key.', 'error');
    }
  };

  // Remember initial state for Cancel logic
  const initialTheme = useRef(theme);
  const initialSfx = useRef(sfxEnabled);
  const initialNotifs = useRef(notificationsEnabled);
  const initialWeather = useRef(weather);
  const initialBgPattern = useRef(coupleData.settings?.bgPattern || 'grid');
  const initialBgPatternOpacity = useRef(coupleData.settings?.bgPatternOpacity ?? 0.22);
  const initialNS = useRef(noiseSuppression);
  const initialEC = useRef(echoCancellation);

  // Local Buffers for Save/Cancel logic
  const [localTheme, setLocalTheme] = useState(theme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', localTheme);
  }, [localTheme]);

  const [localProfile, setLocalProfile] = useState(profile || { name: 'You', emoji: '👤' });
  const [localCoupleData, setLocalCoupleData] = useState(coupleData);
  const [localSfxEnabled, setLocalSfxEnabled] = useState(sfxEnabled);
  const [localNotificationsEnabled, setLocalNotificationsEnabled] = useState(notificationsEnabled);
  const [localWeather, setLocalWeather] = useState(weather);
  const [localNoiseSuppression, setLocalNoiseSuppression] = useState(noiseSuppression);
  const [localEchoCancellation, setLocalEchoCancellation] = useState(echoCancellation);
  
  // Dynamic Realtime Previews
  useEffect(() => {
    if (setPreviewWeather) setPreviewWeather(localWeather);
  }, [localWeather, setPreviewWeather]);

  useEffect(() => {
    if (setPreviewBgPattern) setPreviewBgPattern(localCoupleData.settings?.bgPattern || 'grid');
  }, [localCoupleData.settings?.bgPattern, setPreviewBgPattern]);

  useEffect(() => {
    if (setPreviewBgPatternOpacity) {
      setPreviewBgPatternOpacity(localCoupleData.settings?.bgPatternOpacity !== undefined ? localCoupleData.settings?.bgPatternOpacity : 0.22);
    }
  }, [localCoupleData.settings?.bgPatternOpacity, setPreviewBgPatternOpacity]);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // View management
  const [currentView, setCurrentView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') || params.get('highlight');
    if (tab === 'anniversary' || tab === 'established' || tab === 'relationship') return 'relationship';
    return 'profile';
  }); 
  const [searchQuery, setSearchQuery] = useState('');

  const handleSave = () => {
    // Apply all local state to global state
    setTheme(localTheme);
    setProfile(localProfile);
    setCoupleData(localCoupleData);
    setSfxEnabled(localSfxEnabled);
    setNotificationsEnabled(localNotificationsEnabled);
    setWeather(localWeather);
    setNoiseSuppression(localNoiseSuppression);
    setEchoCancellation(localEchoCancellation);
    
    // Clear preview overrides so standard settings take over
    if (setPreviewWeather) setPreviewWeather(null);
    if (setPreviewBgPattern) setPreviewBgPattern(null);
    if (setPreviewBgPatternOpacity) setPreviewBgPatternOpacity(null);

    playAudio('success', localSfxEnabled);
    toast('Settings Saved!', 'success');
    
    // Close the settings view
    if (onClose) {
      setTimeout(onClose, 100);
    }
  };

  const handleCancel = () => {
    document.documentElement.setAttribute('data-theme', initialTheme.current);
    if (setPreviewWeather) setPreviewWeather(null);
    if (setPreviewBgPattern) setPreviewBgPattern(null);
    if (setPreviewBgPatternOpacity) setPreviewBgPatternOpacity(null);
    onClose();
  };

  const availableThemes = ['default', 'matcha', 'val-sage', 'lavender', 'rose', 'minimal', 'monochrome', 'nord', 'coffee', 'velvet', 'starlight', 'crayon', 'vaporwave', 'messenger', 'reddit', 'discord', 'spotify', 'github', 'cyberpunk', 'synthwave', 'matrix', 'val-killjoy', 'midnight', 'gameboy', 'superman-2025', 'spiderman', 'batman', 'neon-tokyo'];

  const settingsCategories = [
    { group: 'Account' },
    { id: 'profile', label: 'Account Info', icon: <User size={14}/> },
    { id: 'security', label: 'Password & Security', icon: <Lock size={14}/> },
    { id: 'privacy', label: 'Data & Privacy', icon: <ShieldCheck size={14}/> },
    { group: 'Yard Settings' },
    { id: 'relationship', label: 'Yard Info', icon: <Users size={14}/> },
    { id: 'aesthetics', label: 'Appearance', icon: <Palette size={14}/> },
    { id: 'system', label: 'System & Audio', icon: <Volume2 size={14}/> },
    { group: 'Other' },
    { id: 'about', label: 'About Yard', icon: <Info size={14}/> }
  ];

  const filteredCategories = settingsCategories.filter(c => 
    !c.group && (c.label.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handlePfpUpload = (e) => { 
    const file = e.target.files[0]; 
    if (file) { 
      const reader = new FileReader(); 
      reader.onloadend = async () => { 
        try {
          const compressed = await compressImage(reader.result, 150, 150, 0.6);
          setLocalProfile({...localProfile, pfp: compressed}); 
          playAudio('click', localSfxEnabled); 
          toast('Photo buffered. Click SAVE to apply.', 'info'); 
        } catch (err) {
          toast('Failed to update photo.', 'error');
        }
      }; 
      reader.readAsDataURL(file); 
    } 
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast('Password updated immediately!', 'success');
      setTimeout(() => setShowChangePassword(false), 2000);
    } catch (err) { setPasswordError(err.message); }
    finally { setPasswordLoading(false); }
  };

  const handleTestTurn = async () => {
    toast('Testing TURN...', 'info');
    await testTurnConfig();
    window.addEventListener('turn_test_result', (e) => {
      if (e.detail.hasRelay) toast('TURN relay OK!', 'success');
      else toast('TURN failed.', 'error');
    }, { once: true });
  };

  const handleExportData = async () => {
    toast('Compiling export...', 'info');
    try {
      const { data: roomData, error: roomError } = await supabase.rpc('get_my_room');
      if (roomError) throw roomError;
      const roomId = roomData?.id;
      if (!roomId) {
        toast('No active room found.', 'error');
        return;
      }
      const { data: messages, error: msgError } = await supabase.from('chat_messages').select('*').eq('room_id', roomId);
      if (msgError) throw msgError;
      const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'yard_data.json'; link.click();
      toast('Export complete!', 'success');
    } catch (err) {
      toast('Export failed: ' + err.message, 'error');
    }
  };

  const renderContent = () => {

    if (currentView === 'profile') {
      return (
        <div className="p-6 space-y-6">
           <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="relative group mx-auto sm:mx-0 shrink-0">
                 {localProfile?.pfp ? <img src={localProfile?.pfp} alt="Avatar" className="w-20 h-20 rounded-none border-4 border-border object-cover" /> : <div className="w-20 h-20 rounded-none border-4 border-border bg-primary flex items-center justify-center text-4xl">{localProfile?.emoji}</div>}
                 <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-none opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"><ImageIcon size={20}/><input type="file" accept="image/*" onChange={handlePfpUpload} className="hidden" /></label>
              </div>
             <div className="flex-1 w-full space-y-4">
               <RetroInput 
                 label="your name" 
                 value={localProfile.name || ''} 
                 onChange={(e) => setLocalProfile({...localProfile, name: e.target.value})} 
               />
               <div className="grid grid-cols-2 gap-4">
                  <RetroInput 
                    label="pet name" 
                    value={localCoupleData.petName || ''} 
                    onChange={(e) => setLocalCoupleData({...localCoupleData, petName: e.target.value})} 
                  />
                  <div className="w-full">
                    <label className="block text-[12px] text-muted-text mb-1 font-mono lowercase tracking-widest">pet variant</label>
                    <select 
                      value={localCoupleData.petSkin || '/assets/cat_1_9'} 
                      onChange={(e) => setLocalCoupleData({...localCoupleData, petSkin: e.target.value})} 
                      className="w-full px-4 h-[44px] retro-border bg-window focus:bg-accent/5 outline-none font-bold text-xs focus:ring-1 focus:ring-primary/20 transition-all"
                    >
                      <option value="/assets/cat_1">Cat 1</option>
                      <option value="/assets/cat_1_6">Cat 2</option>
                      <option value="/assets/cat_1_9">Cat 3</option>
                    </select>
                  </div>
               </div>
               
               {/* Coming Soon Features */}
               <div className="pt-4 mt-4 border-t border-dashed border-border/50">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3">Coming Soon</h4>
                  <div className="space-y-4 opacity-50">
                    <RetroInput 
                      label="status message" 
                      disabled 
                      placeholder="e.g. Working, Sleeping..." 
                    />
                    <div className="grid grid-cols-2 gap-4">
                       <RetroInput 
                         label="birthday" 
                         type="date" 
                         disabled 
                       />
                       <div className="w-full">
                         <label className="block text-[12px] text-muted-text mb-1 font-mono lowercase tracking-widest">timezone</label>
                         <select disabled className="w-full px-4 h-[44px] retro-border bg-window/50 outline-none font-bold text-xs cursor-not-allowed">
                           <option>Auto-detect</option>
                         </select>
                       </div>
                    </div>
                  </div>
               </div>

             </div>
           </div>
           
           <div className="pt-6 border-t border-dashed border-border flex justify-end">
              <RetroButton onClick={() => setShowLogoutConfirm(true)} variant="secondary" className="px-6 py-2 text-xs uppercase">LOGOUT OF YARD</RetroButton>
           </div>
        </div>
      );
    }

    if (currentView === 'security') {
      return (
        <div className="p-6 space-y-6">
           <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-4">Security Settings</h4>
           
           {/* Password Management */}
           <div className="p-4 retro-border bg-window border-dashed">
              <h5 className="text-xs font-black uppercase text-primary mb-3">Password Management</h5>
              {!showChangePassword ? (
                <RetroButton onClick={() => setShowChangePassword(true)} variant="primary" className="px-6 py-2 text-xs uppercase">RESET PASSWORD</RetroButton>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
                    <RetroInput 
                      type="password" 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      placeholder="New Password" 
                      minLength={6} 
                    />
                    <div className="flex gap-2">
                      <RetroButton type="submit" variant="primary" disabled={passwordLoading} className="flex-1 py-2 text-xs uppercase">{passwordLoading ? 'UPDATING...' : 'UPDATE'}</RetroButton>
                      <RetroButton type="button" onClick={() => setShowChangePassword(false)} variant="secondary" className="flex-1 py-2 text-xs uppercase">CANCEL</RetroButton>
                    </div>
                    {passwordError && <p className="text-xs text-[var(--color-destructive)] font-bold uppercase">{passwordError}</p>}
                </form>
              )}
           </div>

           {/* Chat Encryption (E2EE) */}
           <div className="p-4 retro-border bg-window border-dashed">
              <h5 className="text-xs font-black uppercase text-primary mb-3">Chat Encryption (E2EE)</h5>
              <div className="space-y-4 max-w-md">
                  <div className="flex justify-between items-center text-xs font-bold">
                     <span className="opacity-60">Status:</span>
                     <span className="text-success uppercase tracking-wider flex items-center gap-1">
                       <Lucide.ShieldCheck size={14} /> Active (Encrypted)
                     </span>
                  </div>
                  <p className="text-xs font-bold opacity-60 leading-normal lowercase">
                    Your chats are end-to-end encrypted. If you log in on another device or clear your browser data, you will need your Recovery Key to restore and read your chat history.
                  </p>
                  <div className="flex gap-3">
                     <RetroButton onClick={handleViewRecoveryKey} variant="white" className="flex-1 py-2 text-xs uppercase">VIEW RECOVERY KEY</RetroButton>
                     <RetroButton onClick={() => setShowResetE2eeConfirm(true)} variant="secondary" className="flex-1 py-2 text-xs uppercase">RESET ENCRYPTION</RetroButton>
                  </div>
              </div>
           </div>

           {/* Coming Soon Features */}
           <div className="p-4 retro-border bg-window/50 border-dashed opacity-60">
              <h5 className="text-xs font-black uppercase text-primary mb-3">Advanced Security (Coming Soon)</h5>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold opacity-70">Two-Factor Authentication</span>
                  <button disabled className="w-12 h-6 rounded-none border-2 border-border/30 bg-disabled relative cursor-not-allowed"><div className="w-4 h-4 rounded-none bg-window border-2 border-border/30 absolute top-[2px] left-[2px]" /></button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold opacity-70">Auto-lock App (FaceID/PIN)</span>
                  <button disabled className="w-12 h-6 rounded-none border-2 border-border/30 bg-disabled relative cursor-not-allowed"><div className="w-4 h-4 rounded-none bg-window border-2 border-border/30 absolute top-[2px] left-[2px]" /></button>
                </div>
                <RetroButton disabled variant="secondary" className="w-full py-1.5 text-xs cursor-not-allowed opacity-50 uppercase">VIEW LOGIN HISTORY</RetroButton>
              </div>
           </div>

        </div>
      );
    }
        if (currentView === 'aesthetics') {
      const weatherOptions = [
        { id: 'clear', label: 'Clear', icon: <Sun size={12} className="text-amber-500" /> },
        { id: 'rain', label: 'Rain', icon: <CloudRain size={12} className="text-indigo-400" /> },
        { id: 'snow', label: 'Snow', icon: <Snowflake size={12} className="text-sky-300" /> },
        { id: 'thunder', label: 'Thunder', icon: <Zap size={12} className="text-yellow-400" /> },
        { id: 'storm', label: 'Storm', icon: <CloudLightning size={12} className="text-purple-400" /> },
      ];

      return (
        <div className="p-4 space-y-6">

           <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2"><Sun size={12}/> Atmosphere</h4>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {weatherOptions.map(opt => (
                  <RetroButton 
                    key={opt.id} 
                    onClick={() => { setLocalWeather(opt.id); playAudio('click', localSfxEnabled); }} 
                    variant={localWeather === opt.id ? 'primary' : 'white'} 
                    className="py-2 text-xs uppercase flex items-center justify-center gap-1.5"
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </RetroButton>
                ))}
              </div>
           </div>

           <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2"><Palette size={12}/> Theme Mode</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {availableThemes.map(t => (
                  <div 
                    key={t} 
                    onClick={() => { setLocalTheme(t); playAudio('click', localSfxEnabled); }} 
                    data-theme={t}
                    className={`retro-border p-3 cursor-pointer transition-all duration-300 relative group h-24 flex flex-col justify-between overflow-hidden
                      ${localTheme === t ? 'ring-2 ring-primary border-primary scale-[1.02] shadow-xl' : 'hover:scale-[1.01] hover:border-primary/30'}`}
                    style={{ backgroundColor: 'var(--bg-main)' }}
                  >
                     {/* Selection Tint Overlay */}
                     {localTheme === t && (
                       <div className="absolute inset-0 pointer-events-none bg-primary/10" />
                     )}

                     <div className="flex justify-between items-center relative z-10">
                        <span className="text-[11px] font-black uppercase tracking-tighter text-main-text drop-shadow-sm">{t}</span>
                        {localTheme === t && (
                          <div className="w-4 h-4 rounded-none bg-primary flex items-center justify-center border border-black/10 shadow-sm animate-in zoom-in duration-300">
                            <Check size={10} className="text-primary-text" />
                          </div>
                        )}
                     </div>
                     
                     <div className="border-2 border-dashed border-main-text/20 p-2 h-12 flex flex-col gap-1.5 bg-window/40 relative z-0 transition-colors duration-500">
                        <div className="flex gap-1.5 h-full">
                           <div className="flex-[2] bg-primary border border-black/10 rounded-none shadow-sm transition-transform duration-500 group-hover:scale-105"></div>
                           <div className="flex-1 bg-secondary border border-black/10 rounded-none shadow-sm transition-transform duration-500 group-hover:scale-95"></div>
                        </div>
                        <div className="h-2 w-3/4 bg-accent border border-black/10 rounded-none shadow-sm transition-all duration-500 group-hover:w-full"></div>
                     </div>
                  </div>
                ))}
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-dashed border-border">
              <div>
                 <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3">Dashboard Pattern</h4>
                 <div className="flex gap-2">
                      {['grid', 'dots', 'lines', 'none'].map(p => (
                        <RetroButton key={p} onClick={() => setLocalCoupleData({ ...localCoupleData, settings: { ...localCoupleData.settings, bgPattern: p } })} variant={localCoupleData.settings?.bgPattern === p ? 'primary' : 'white'} className="px-4 py-2 text-xs uppercase">{p}</RetroButton>
                      ))}
                 </div>
              </div>
              <div>
                 <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3">Pattern Opacity</h4>
                 <div className="flex items-center gap-3 retro-border bg-window p-2">
                   <input 
                     type="range" 
                     min="0.05" 
                     max="0.90" 
                     step="0.05" 
                     value={localCoupleData.settings?.bgPatternOpacity !== undefined ? localCoupleData.settings?.bgPatternOpacity : 0.22} 
                     onChange={(e) => setLocalCoupleData({ ...localCoupleData, settings: { ...localCoupleData.settings, bgPatternOpacity: parseFloat(e.target.value) } })} 
                     className="flex-1 accent-primary h-1.5 cursor-pointer bg-border"
                   />
                   <span className="text-xs font-black w-8 text-right font-mono">
                     {Math.round((localCoupleData.settings?.bgPatternOpacity !== undefined ? localCoupleData.settings?.bgPatternOpacity : 0.22) * 100)}%
                   </span>
                 </div>
              </div>
            </div>
         </div>
        );
    }

    if (currentView === 'relationship') {
      return (
        <div className="p-6 space-y-6">
           <div className="max-w-md space-y-4">
              <div id="established-date-field">
                <RetroInput 
                  label="established date" 
                  type="date" 
                  value={localCoupleData?.anniversary || ''} 
                  onChange={(e) => setLocalCoupleData(prev => ({ ...prev, anniversary: e.target.value }))} 
                  className="cursor-pointer"
                />
              </div>
           </div>

           {/* Coming Soon Features */}
           <div className="max-w-md pt-4 border-t border-dashed border-border/50 opacity-60">
              <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3">Yard Metadata (Coming Soon)</h4>
              <div className="space-y-4">
                 <div className="w-full">
                    <label className="block text-[12px] text-muted-text mb-1 font-mono lowercase tracking-widest">yard status</label>
                    <select disabled className="w-full px-4 h-[44px] retro-border bg-window/50 focus:outline-none font-bold text-xs cursor-not-allowed">
                      <option>Active</option>
                      <option>Archived</option>
                      <option>Hangout</option>
                    </select>
                 </div>
                 <RetroInput 
                   label="shared description / focus" 
                   disabled 
                   placeholder="e.g. Shared development workspace, Hangout space..." 
                 />
              </div>
           </div>
        </div>
      );
    }

    if (currentView === 'system') {
      return (
        <div className="p-6 space-y-6">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-5">
                 <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2"><Volume2 size={14}/> Audio & Alerts</h4>
                 <div className="flex items-center justify-between p-2 retro-border bg-window">
                    <span className="text-xs font-bold">Sound Effects</span>
                    <button onClick={() => setLocalSfxEnabled(!localSfxEnabled)} className={`w-12 h-6 rounded-none border-2 border-border relative transition-colors duration-200 focus:outline-none ${localSfxEnabled ? 'bg-primary' : 'bg-disabled'}`}>
                       <div className={`w-4 h-4 rounded-none bg-window border-2 border-border absolute top-[2px] transition-all duration-200 ${localSfxEnabled ? 'left-[26px]' : 'left-[2px]'}`} />
                     </button>
                 </div>
                 <div className="flex items-center justify-between p-2 retro-border bg-window">
                    <span className="text-xs font-bold">Push Notifications</span>
                    <button onClick={async () => {
                       const nextState = !localNotificationsEnabled;
                       if (nextState) {
                         const granted = await requestNotificationPermission();
                         if (granted) {
                           setLocalNotificationsEnabled(true);
                           toast('Notifications enabled!', 'success');
                         } else {
                           toast('Notification permission denied.', 'error');
                           setLocalNotificationsEnabled(false);
                         }
                       } else {
                         setLocalNotificationsEnabled(false);
                       }
                    }} className={`w-12 h-6 rounded-none border-2 border-border relative transition-colors duration-200 focus:outline-none ${localNotificationsEnabled ? 'bg-primary' : 'bg-disabled'}`}>
                       <div className={`w-4 h-4 rounded-none bg-window border-2 border-border absolute top-[2px] transition-all duration-200 ${localNotificationsEnabled ? 'left-[26px]' : 'left-[2px]'}`} />
                     </button>
                 </div>
                 {localNotificationsEnabled && (
                    <div className="flex justify-between items-center p-2 retro-border bg-window border-dashed">
                       <span className="text-xs font-bold">Test Connection</span>
                       <RetroButton 
                         onClick={() => {
                           sendNativeNotification('Yard Notification Test!', { 
                             body: 'This is a test notification to verify that push notifications are working.',
                             tag: 'test-notification'
                           }, true);
                           toast('Test notification triggered!', 'info');
                         }} 
                         variant="primary" 
                         className="text-xs py-1.5 px-3 uppercase"
                       >
                         Send Test
                       </RetroButton>
                    </div>
                 )}
                 
                 {/* Coming Soon Features */}
                 <div className="p-3 retro-border bg-window/50 border-dashed opacity-60 mt-4">
                    <h5 className="text-xs font-black uppercase text-primary mb-3">Custom Tones (Coming Soon)</h5>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold opacity-70">Message Alert</span>
                      <select disabled className="px-4 h-[36px] retro-border bg-window/50 focus:outline-none font-bold text-xs cursor-not-allowed max-w-[120px]">
                        <option>Bloop</option>
                      </select>
                    </div>
                 </div>

                 <h4 className="text-xs font-black uppercase tracking-widest text-primary mt-6 mb-3 flex items-center gap-2"><Monitor size={14}/> WebRTC Advanced</h4>
                 <div className="flex items-center justify-between p-2 retro-border bg-window">
                    <span className="text-xs font-bold">Noise Suppression</span>
                    <button onClick={() => setLocalNoiseSuppression(!localNoiseSuppression)} className={`w-12 h-6 rounded-none border-2 border-border relative transition-colors duration-200 focus:outline-none ${localNoiseSuppression ? 'bg-primary' : 'bg-disabled'}`}>
                       <div className={`w-4 h-4 rounded-none bg-window border-2 border-border absolute top-[2px] transition-all duration-200 ${localNoiseSuppression ? 'left-[26px]' : 'left-[2px]'}`} />
                     </button>
                 </div>
                 <div className="flex items-center justify-between p-2 retro-border bg-window">
                    <span className="text-xs font-bold">Echo Cancellation</span>
                    <button onClick={() => setLocalEchoCancellation(!localEchoCancellation)} className={`w-12 h-6 rounded-none border-2 border-border relative transition-colors duration-200 focus:outline-none ${localEchoCancellation ? 'bg-primary' : 'bg-disabled'}`}>
                       <div className={`w-4 h-4 rounded-none bg-window border-2 border-border absolute top-[2px] transition-all duration-200 ${localEchoCancellation ? 'left-[26px]' : 'left-[2px]'}`} />
                     </button>
                 </div>

                 {/* Coming Soon Features */}
                 <div className="p-3 retro-border bg-window/50 border-dashed opacity-60 mt-4">
                    <h5 className="text-xs font-black uppercase text-primary mb-3">Hardware (Coming Soon)</h5>
                    <div className="space-y-4">
                       <div className="w-full">
                         <label className="block text-[12px] text-muted-text mb-1 font-mono lowercase tracking-widest">camera device</label>
                         <select disabled className="w-full px-4 h-[44px] retro-border bg-window/50 outline-none font-bold text-xs cursor-not-allowed">
                           <option>Default Camera</option>
                         </select>
                       </div>
                       <div className="w-full">
                         <label className="block text-[12px] text-muted-text mb-1 font-mono lowercase tracking-widest">video quality</label>
                         <select disabled className="w-full px-4 h-[44px] retro-border bg-window/50 outline-none font-bold text-xs cursor-not-allowed">
                           <option>High Definition (720p)</option>
                         </select>
                       </div>
                    </div>
                 </div>

              </div>
              <div className="space-y-4">
                 <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3">Diagnostics</h4>
                 <div className="p-3 retro-border bg-window space-y-3 border-dashed">
                    <RetroButton onClick={handleTestTurn} variant="primary" className="w-full text-xs py-2 uppercase">TEST RELAY ENGINE</RetroButton>
                    <RetroButton onClick={() => { endCall(); toast('Engine reset', 'info'); }} variant="secondary" className="w-full text-xs py-2 uppercase">HARD RESET CALLS</RetroButton>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-45 text-center">Engine: {callStatus}</p>
                 </div>
              </div>
           </div>
        </div>
      );
    }

    if (currentView === 'privacy') {
      return (
        <div className="p-6 space-y-10">
           <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3">Archive Retrieval</h4>
              <p className="text-xs opacity-70 mb-4 font-bold uppercase tracking-tight leading-tight">Download your shared history in local machine readable format.</p>
              <RetroButton onClick={handleExportData} variant="primary" className="px-6 py-2.5 text-xs uppercase">EXPORT .JSON DATA</RetroButton>
           </div>
           
           {/* Coming Soon Features */}
           <div className="pt-4 border-t border-dashed border-border/50 opacity-60">
              <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3">Visibility Controls (Coming Soon)</h4>
              <div className="space-y-4 max-w-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold opacity-70">Read Receipts</span>
                  <button disabled className="w-12 h-6 rounded-none border-2 border-border/30 bg-primary/50 relative cursor-not-allowed"><div className="w-4 h-4 rounded-none bg-window border-2 border-border/30 absolute top-[2px] left-[26px]" /></button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold opacity-70">Show Typing Indicator</span>
                  <button disabled className="w-12 h-6 rounded-none border-2 border-border/30 bg-primary/50 relative cursor-not-allowed"><div className="w-4 h-4 rounded-none bg-window border-2 border-border/30 absolute top-[2px] left-[26px]" /></button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold opacity-70">Incognito Mode (Hide Online Status)</span>
                  <button disabled className="w-12 h-6 rounded-none border-2 border-border/30 bg-disabled relative cursor-not-allowed"><div className="w-4 h-4 rounded-none bg-window border-2 border-border/30 absolute top-[2px] left-[2px]" /></button>
                </div>
              </div>
           </div>

           <div className="p-5 border-2 border-dashed border-danger/30 bg-danger/5">
              <h4 className="text-xs font-black uppercase tracking-widest text-danger mb-4">CRITICAL ZONE</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                 <RetroButton onClick={async () => {
                    const ok = window.confirm("Leave this yard?");
                    if (ok) {
                      await supabase.rpc('leave_room', { room_uuid: localCoupleData.room_id });
                      navigate('/handshake'); window.location.reload();
                    }
                 }} variant="secondary" className="flex-1 bg-window text-warning border-warning/30 hover:bg-warning/10 text-xs py-2.5 uppercase">LEAVE YARD</RetroButton>
                 <RetroButton onClick={async () => {
                    const ok = window.confirm("DELETE ALL DATA PERMANENTLY?");
                    if (ok) {
                       await supabase.rpc('delete_my_room');
                       await supabase.auth.signOut();
                       window.location.href = '/';
                    }
                 }} variant="primary" className="flex-1 bg-danger text-danger-text border-danger text-xs py-2.5 uppercase">DESTROY YARD DATA</RetroButton>
              </div>
           </div>
        </div>
      );
    }

    if (currentView === 'about') {
      return (
        <div className="p-6 space-y-8 max-w-lg">
           <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3">The Architecture</h4>
              <p className="text-xs font-bold leading-relaxed opacity-80">
                Yard is built as a peer-to-peer workspace for couples. It leverages <span className="text-primary underline">Supabase</span> for real-time synchronization and database storage, while utilizing <span className="text-primary underline">WebRTC</span> for low-latency voice and video communication.
              </p>
           </div>

           <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3">Privacy & Security</h4>
              <p className="text-xs font-bold leading-relaxed opacity-80">
                Privacy is handled by design. Signaling is conducted via encrypted broadcast channels. Live audio and video streams are routed directly between partners using <span className="text-primary">ICE/TURN</span> relay only when direct connection fails; Yard never stores or records your calls. 
              </p>
           </div>

           <div className="pt-6 border-t border-dashed border-border">
              <p className="text-xs font-bold italic opacity-70">
                Yard was built by <span className="text-main-text not-italic font-black">bakarkhaniii</span> as a fun project to explore digital intimacy and retro-futuristic UI. 
              </p>
              <p className="text-xs font-black uppercase mt-4 text-primary tracking-widest">
                Any sort of feedback would always be appreciated.
              </p>
           </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div className="modal-backdrop fixed inset-0 z-[var(--z-modal)] flex items-center justify-center">
      <RetroWindow 
        title={isMobile ? "Profile & Settings" : "control_panel.exe"} 
        onClose={handleCancel} 
        noPadding 
        className="universal-modal"
        sfx={localSfxEnabled}
      >
        <div className="flex-1 flex overflow-hidden bg-main/5">
          {/* Left Sidebar */}
          <div className="w-[220px] shrink-0 bg-window/40 border-r-2 border-border flex flex-col overflow-y-auto custom-scrollbar pt-2 pb-8">
            <div className="px-3 mb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 opacity-30" size={12} />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 retro-border bg-window text-xs font-bold focus:outline-none"
                />
              </div>
            </div>

            {filteredCategories.map((c, i) => {
               if (c.group) {
                  return (
                    <div key={`group-${i}`} className="px-4 py-2 mt-3">
                      <span className="text-xs font-black uppercase tracking-widest opacity-50">{c.group}</span>
                    </div>
                  )
               }
               const isActive = currentView === c.id;
               return (
                 <button 
                   key={c.id} 
                   onClick={() => { setCurrentView(c.id); playAudio('click', localSfxEnabled); }}
                   className={`flex items-center gap-3 px-4 py-2.5 text-sm font-bold transition-all text-left w-full relative
                     ${isActive ? 'bg-primary/10 text-primary' : 'text-main-text opacity-70 hover:opacity-100 hover:bg-black/5'}
                   `}
                 >
                   {/* Windows/Discord style active indicator pill */}
                   {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-primary rounded-r-none" />
                   )}
                   <div className="shrink-0">{c.icon}</div>
                   <span className="truncate">{c.label}</span>
                 </button>
               )
            })}
            
            <div className="px-4 py-2 mt-3">
               <span className="text-xs font-black uppercase tracking-widest opacity-50 border-t border-border/30 w-full block pt-3 mt-2">Account Action</span>
            </div>
            <button 
               onClick={() => setShowLogoutConfirm(true)}
               className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-danger hover:bg-danger/10 transition-all text-left w-full"
            >
               <LogOut size={14} />
               <span>Log Out</span>
            </button>
          </div>

          {/* Right Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative">
             <div key={currentView + localTheme} className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-2xl mx-auto">
                <h2 className="text-xl font-black mb-6 uppercase tracking-tight pb-2 border-b-2 border-border/50">{settingsCategories.find(c => c.id === currentView)?.label}</h2>
                {renderContent()}
             </div>
          </div>
        </div>

      {/* Footer Area */}
      <div className="window-footer justify-between">
         <div className="text-[10px] font-black uppercase tracking-widest opacity-30">Configurator v1.2.1-rigid</div>
          <div className="flex gap-2">
            <RetroButton onClick={handleCancel} variant="secondary" className="px-3 py-1.5 text-xs uppercase">Cancel</RetroButton>
            <RetroButton onClick={handleSave} variant="primary" className="px-4 py-1.5 text-xs uppercase">Save Changes</RetroButton>
          </div>
      </div>
    </RetroWindow>
    </div>

    {showLogoutConfirm && (
      <ConfirmDialog
        title="logout.exe"
        message="Are you sure you want to log out of the Yard?"
        onConfirm={() => { onLogout && onLogout(); }}
        onCancel={() => setShowLogoutConfirm(false)}
        sfx={localSfxEnabled}
      />
    )}

    {/* View Recovery Key Modal */}
    {showRecoveryKey && (
      <div className="fixed inset-0 z-[var(--z-modal)] modal-backdrop flex items-center justify-center p-4 animate-in fade-in duration-200">
        <RetroWindow 
          title="e2ee_recovery_key.exe" 
          className="w-full max-w-sm shadow-2xl scale-up-15"
          onClose={() => setShowRecoveryKey(false)}
        >
          <div className="flex flex-col gap-5 py-2 text-center">
            <Lucide.Key size={32} className="text-primary mx-auto animate-pulse" />
            <h5 className="text-sm font-black uppercase tracking-wide">Your E2EE Recovery Key</h5>
            
            {recoveryKey ? (
              <div className="bg-accent/20 border-2 border-border p-4 text-center space-y-3 relative overflow-hidden select-all">
                <div className="text-xl font-black tracking-tighter text-primary">{recoveryKey}</div>
                <button 
                  type="button" 
                  onClick={() => { 
                    navigator.clipboard.writeText(recoveryKey); 
                    toast("Recovery Key copied!", "success"); 
                  }} 
                  className="text-[9px] font-black uppercase text-primary hover:opacity-70 flex items-center justify-center gap-1 mx-auto border-b border-current"
                >
                  <Lucide.Copy size={10} /> copy key
                </button>
              </div>
            ) : (
              <p className="text-xs font-bold text-[var(--color-destructive)] uppercase">
                No recovery key found on this device (legacy key pair). Click "Reset Encryption" below to generate a new key pair with a recovery backup.
              </p>
            )}

            <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-none text-left text-[10px] font-bold text-amber-800">
              <Lucide.AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                Keep this key safe. Anyone who has this key can decrypt and read your Yard chat history.
              </span>
            </div>

            <RetroButton onClick={() => setShowRecoveryKey(false)} variant="primary" className="w-full py-2.5 text-xs font-bold">
              Close
            </RetroButton>
          </div>
        </RetroWindow>
      </div>
    )}

    {/* Reset Encryption Keys Dialog */}
    {showResetE2eeConfirm && (
      <ConfirmDialog
        title="Reset E2EE Encryption?"
        message="WARNING: Resetting your keys will generate a new recovery key. All past encrypted messages will become permanently unreadable. Use this if you are experiencing decryption errors."
        showCancel={true}
        onConfirm={async () => {
          setShowResetE2eeConfirm(false);
          toast('Resetting encryption...', 'info');
          try {
            await resetE2EEKeys();
            setShowRecoveryKey(false);
          } catch(e) {
            toast('Reset failed', 'error');
          }
        }}
        onCancel={() => setShowResetE2eeConfirm(false)}
        sfx={localSfxEnabled}
      />
    )}
    </>
  );
}
