import React, { useState, useEffect, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate, Outlet } from 'react-router-dom';
import { BootLoader } from './components/BootLoader.jsx';
import { LivingBackground } from './components/Visuals/LivingBackground.jsx';
import { WeatherOverlay } from './components/Visuals/WeatherOverlay.jsx';
import { Confetti } from './components/Visuals/Confetti.jsx';
import { ProtectedRoute, PublicRoute } from './components/AuthGuards.jsx';
import { SeoManager } from './components/SeoManager.jsx';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { setSoundEnabled } from 'react-sounds';
import { useAuth, useSync } from './context/instances.js';

import { LandingView, AuthView } from './views/Onboarding.jsx';
import { ResetPasswordView } from './views/ResetPasswordView.jsx';
import { ChannelsView } from './views/Channels.jsx';
import { ArcadeView } from './views/Arcade.jsx';
import { Dashboard } from './views/Dashboard.jsx';
import { MobileBottomNav } from './components/Navigation/MobileBottomNav.jsx';
import { LeftNavBar } from './components/Navigation/LeftNavBar.jsx';
import { HighScoresModal } from './components/Modals/HighScoresModal.jsx';
import { UserContextMenu } from './components/Modals/UserContextMenu.jsx';
import { ProfileModal } from './components/Modals/ProfileModal.jsx';
import { useToast } from './components/UI.jsx';
import { useLastSeen } from './hooks/useLastSeen.js';

const ChatView = React.lazy(() => import('./views/ChatView.jsx').then(m => ({ default: m.ChatView })));
const SettingsView = React.lazy(() => import('./views/SettingsView.jsx').then(m => ({ default: m.SettingsView })));
const PostDetailView = React.lazy(() => import('./views/PostDetailView.jsx').then(m => ({ default: m.PostDetailView })));

const AppLoader = () => null;

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userId, partnerId, roomId, logout, loading: authLoading, hasInitialized } = useAuth();
  const sync = useSync();
  const { globalState, updateSyncState, updateSyncStateAtomic } = sync;

  const [theme, setTheme] = useLocalStorage('app_theme', 'matcha');
  const [weather, setWeather] = useLocalStorage('app_weather', 'clear');
  const [sfxEnabled, setSfxEnabled] = useLocalStorage('sfx_enabled', true); 
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage('notifications_enabled', true);
  const [showHighScoresModal, setShowHighScoresModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState(null);
  const [profileModalInitialTab, setProfileModalInitialTab] = useState(null);
  const [bootFinished, setBootFinished] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('yard_boot_finished') === 'true';
    }
    return false;
  });

  useEffect(() => {
    setSoundEnabled(sfxEnabled);
  }, [sfxEnabled]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme); 
  }, [theme]);

  const { partnerStatusData, partnerStatusLabel } = useLastSeen();
  const toast = useToast();

  useEffect(() => {
    const handleOpenProfile = (e) => {
      const { userId, initialTab } = e.detail || {};
      setProfileModalUserId(userId);
      setProfileModalInitialTab(initialTab || null);
    };
    const handleOpenSettings = () => {
      setShowSettingsModal(true);
    };
    window.addEventListener('open_user_profile', handleOpenProfile);
    window.addEventListener('open_settings', handleOpenSettings);
    return () => {
      window.removeEventListener('open_user_profile', handleOpenProfile);
      window.removeEventListener('open_settings', handleOpenSettings);
    };
  }, []);

  const isOnboarding = ['/', '/login', '/signup', '/signin'].includes(location.pathname);

  return (
    <>
      {!bootFinished && (
        <BootLoader 
          onComplete={() => {
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('yard_boot_finished', 'true');
            }
            setBootFinished(true);
          }} 
          sfxEnabled={sfxEnabled} 
        />
      )}
      
      <div className={`retro-everywhere w-full mesh-bg flex flex-col relative ${
        isOnboarding 
          ? 'min-h-[100dvh] items-center p-0 sm:p-4 md:p-8' 
          : `h-screen overflow-hidden ${user ? 'md:pl-12' : ''}`
      } ${hasInitialized ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
        {!isOnboarding && <LivingBackground weather={weather} />}
        {!isOnboarding && <WeatherOverlay weather={weather} />}
        <Confetti active={false} />

        {hasInitialized && (
          <>
            <SeoManager />
            <div className={`app-glitch-wrapper flex-1 w-full flex flex-col min-h-0 ${isOnboarding ? 'items-center' : ''}`} data-hawkins={theme === 'hawkins'}>
              <Suspense fallback={<AppLoader />}>
                <Routes>
                  <Route path="/" element={<PublicRoute><LandingView /></PublicRoute>} />
                  <Route path="/signup" element={<PublicRoute><AuthView mode="signup" /></PublicRoute>} />
                  <Route path="/signin" element={<PublicRoute><AuthView mode="signin" /></PublicRoute>} />
                  <Route path="/password-reset" element={<ResetPasswordView sfx={sfxEnabled} />} />

                  {/* Yard Specific Routes */}
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <Dashboard 
                        theme={theme} 
                        setTheme={setTheme} 
                        sfxEnabled={sfxEnabled} 
                        setSfxEnabled={setSfxEnabled} 
                        weather={weather} 
                        setWeather={setWeather} 
                        notificationsEnabled={notificationsEnabled}
                        setNotificationsEnabled={setNotificationsEnabled}
                        onOpenLeaderboard={() => setShowHighScoresModal(true)}
                      />
                    </ProtectedRoute>
                  } />
                  <Route path="/channels" element={<ProtectedRoute><ChannelsView theme={theme} sfxEnabled={sfxEnabled} /></ProtectedRoute>} />
                  <Route path="/arcade" element={<ProtectedRoute><ArcadeView theme={theme} sfxEnabled={sfxEnabled} /></ProtectedRoute>} />
                  <Route path="/post/:compoundId" element={
                    <ProtectedRoute>
                      <Suspense fallback={<AppLoader />}>
                        <PostDetailView />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/chat" element={
                    <ProtectedRoute>
                      <Suspense fallback={<AppLoader />}>
                        <ChatView theme={theme} sfxEnabled={sfxEnabled} />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/chat/dm/:dmId" element={
                    <ProtectedRoute>
                      <Suspense fallback={<AppLoader />}>
                        <ChatView theme={theme} sfxEnabled={sfxEnabled} />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/chat/bubble/:bubbleId" element={
                    <ProtectedRoute>
                      <Suspense fallback={<AppLoader />}>
                        <ChatView theme={theme} sfxEnabled={sfxEnabled} />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/chat/guild/:guildId" element={
                    <ProtectedRoute>
                      <Suspense fallback={<AppLoader />}>
                        <ChatView theme={theme} sfxEnabled={sfxEnabled} />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/chat/guild/:guildId/:channelId" element={
                    <ProtectedRoute>
                      <Suspense fallback={<AppLoader />}>
                        <ChatView theme={theme} sfxEnabled={sfxEnabled} />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/settings" element={
                    <ProtectedRoute>
                      <Suspense fallback={<AppLoader />}>
                        <SettingsView 
                          theme={theme}
                          setTheme={setTheme}
                          profile={globalState?.room_profiles?.[userId] || { name: 'You', emoji: '👤' }}
                          setProfile={(newProf) => {
                            updateSyncStateAtomic('room_profiles', userId, newProf);
                          }}
                          onLogout={logout}
                          sfxEnabled={sfxEnabled}
                          setSfxEnabled={setSfxEnabled}
                          notificationsEnabled={notificationsEnabled}
                          setNotificationsEnabled={setNotificationsEnabled}
                          weather={weather}
                          setWeather={setWeather}
                          userId={userId}
                          partnerId={partnerId}
                          coupleData={globalState?.couple_data || {}}
                          setCoupleData={(newCouple) => {
                            updateSyncState('couple_data', newCouple);
                          }}
                          streaks={globalState?.user_streaks?.[userId]}
                          onClose={() => navigate('/dashboard')}
                        />
                      </Suspense>
                    </ProtectedRoute>
                  } />

                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
            </div>
          </>
        )}
        {!isOnboarding && hasInitialized && user && (
          <LeftNavBar 
            sfxEnabled={sfxEnabled} 
            setSfxEnabled={setSfxEnabled} 
            onOpenLeaderboard={() => setShowHighScoresModal(true)}
            isLeaderboardOpen={showHighScoresModal}
            onOpenSettings={() => setShowSettingsModal(true)}
          />
        )}
        {!isOnboarding && hasInitialized && user && <MobileBottomNav sfxEnabled={sfxEnabled} />}
        {showHighScoresModal && (
          <HighScoresModal 
            roomId={roomId} 
            onClose={() => setShowHighScoresModal(false)} 
            sfxEnabled={sfxEnabled}
          />
        )}
        {showSettingsModal && (
          <div className="modal-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="w-full max-w-5xl animate-in zoom-in-95 duration-200">
              <Suspense fallback={null}>
                <SettingsView 
                  theme={theme}
                  setTheme={setTheme}
                  profile={globalState?.room_profiles?.[userId] || { name: 'You', emoji: '👤' }}
                  setProfile={(newProf) => {
                    updateSyncStateAtomic('room_profiles', userId, newProf);
                  }}
                  onLogout={logout}
                  sfxEnabled={sfxEnabled}
                  setSfxEnabled={setSfxEnabled}
                  notificationsEnabled={notificationsEnabled}
                  setNotificationsEnabled={setNotificationsEnabled}
                  weather={weather}
                  setWeather={setWeather}
                  userId={userId}
                  partnerId={partnerId}
                  coupleData={globalState?.couple_data || {}}
                  setCoupleData={(newCouple) => {
                    updateSyncState('couple_data', newCouple);
                  }}
                  streaks={globalState?.user_streaks?.[userId]}
                  onClose={() => setShowSettingsModal(false)}
                />
              </Suspense>
            </div>
          </div>
        )}
        {profileModalUserId && (
          <ProfileModal
            userId={profileModalUserId}
            currentUserId={userId}
            partnerId={partnerId}
            roomProfiles={globalState?.room_profiles}
            partnerStatusData={partnerStatusData}
            partnerStatusLabel={partnerStatusLabel}
            updateSyncStateAtomic={updateSyncStateAtomic}
            toast={toast}
            onClose={() => {
              setProfileModalUserId(null);
              setProfileModalInitialTab(null);
            }}
            posts={globalState?.posts}
            initialTab={profileModalInitialTab}
          />
        )}
        <UserContextMenu />
      </div>
    </>
  );
}

