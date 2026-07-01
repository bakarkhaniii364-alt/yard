import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMobile } from '../../hooks/useMobile.js';

const tabIndices = {
  dashboard: 0,
  space: 1,
  arcade: 2,
  settings: 3
};

const indexRoutes = [
  '/dashboard',
  '/space',
  '/arcade',
  '/settings'
];

export function SwipeNavigationWrapper({ children, activeTab, sfxEnabled }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMobile();
  const containerRef = useRef(null);
  
  // Track swipe touch states
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const touchLast = useRef({ x: 0, y: 0 });
  const isSwiping = useRef(false);
  const swipeLocked = useRef(false);
  const isSwipeNavigating = useRef(false);

  const isSwipeDisabled = location.pathname !== '/dashboard' &&
                          location.pathname !== '/arcade' &&
                          location.pathname !== '/arcade/' &&
                          location.pathname !== '/space' &&
                          location.pathname !== '/settings';

  // Synchronize CSS offset with active view when not swiping
  const targetIndex = tabIndices[activeTab] !== undefined ? tabIndices[activeTab] : 0;
  const targetOffset = -targetIndex * 100;
  const [currentOffset, setCurrentOffset] = useState(targetOffset);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);

  // Synchronize activeTab programmatically or via swipe synchronously in render cycle
  if (activeTab !== prevActiveTab) {
    setPrevActiveTab(activeTab);
    if (!isSwipeNavigating.current) {
      setIsTransitioning(true);
      setCurrentOffset(targetOffset);
    } else {
      isSwipeNavigating.current = false;
      setIsTransitioning(false);
      setCurrentOffset(targetOffset);
    }
  }

  // Clear transition state after animation finishes
  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => setIsTransitioning(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  useEffect(() => {
    if (!isMobile) {
      setCurrentOffset(targetOffset);
    }
  }, [isMobile, targetOffset]);

  if (!isMobile) {
    // Desktop layout has no swipe track, simply render active children view statically
    const idx = tabIndices[activeTab] !== undefined ? tabIndices[activeTab] : 0;
    return children[idx];
  }

  const handleTouchStart = (e) => {
    if (isTransitioning || isSwipeDisabled) return;

    // Check if the touch originated from an interactive element that should not trigger swiping
    const isInteractive = e.target.closest('canvas, [data-no-swipe="true"], .emoji-picker-react, input, textarea, button, select, .no-swipe');
    if (isInteractive) {
      swipeLocked.current = true;
      return;
    }

    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    touchLast.current = { x: touch.clientX, y: touch.clientY };
    isSwiping.current = false;
    swipeLocked.current = false;
  };

  const handleTouchMove = (e) => {
    if (isTransitioning || isSwipeDisabled || swipeLocked.current && !isSwiping.current) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    touchLast.current = { x: touch.clientX, y: touch.clientY };

    // Lock swipe detection
    if (!swipeLocked.current) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      
      // If we move vertically even a little bit first, lock swipe to allow page scroll
      if (absY > 8) {
        swipeLocked.current = true;
      } else if (absX > 15) {
        swipeLocked.current = true;
        // Require a higher horizontal bias to trigger swipe, so diagonal scrolls are ignored
        if (absX > absY * 2.0) {
          isSwiping.current = true;
        }
      }
    }

    if (isSwiping.current) {
      // Prevent browser default vertical scroll/bounce
      e.preventDefault();
      
      const width = window.innerWidth;
      let percentOffset = targetOffset + (deltaX / width) * 100;

      // Cap bounds with elastic resistance past ends
      if (percentOffset > 0) {
        percentOffset = (deltaX / width) * 15; // pulling right past dashboard
      } else if (percentOffset < -300) {
        percentOffset = -300 + ((deltaX - (touchStart.current.x - touchLast.current.x)) / width) * 15; // pulling left past settings
      }

      // Live update container style directly for buttery performance
      if (containerRef.current) {
        containerRef.current.style.transform = `translate3d(${percentOffset}vw, 0, 0)`;
        containerRef.current.style.transition = 'none';
      }
    }
  };

  const handleTouchEnd = () => {
    if (isTransitioning || isSwipeDisabled || !isSwiping.current) return;

    isSwiping.current = false;
    swipeLocked.current = false;

    const deltaX = touchLast.current.x - touchStart.current.x;
    const duration = Date.now() - touchStart.current.time;
    const width = window.innerWidth;
    const velocity = Math.abs(deltaX) / duration; // px per ms

    // Threshold triggers
    const isSignificantDrag = Math.abs(deltaX) > width * 0.25;
    const isFastSwipe = velocity > 0.35 && Math.abs(deltaX) > 30;

    if (deltaX < 0 && (isSignificantDrag || isFastSwipe)) {
      // Swipe left -> Move forward to next tab
      if (targetIndex < 3) {
        const nextIndex = targetIndex + 1;
        const nextPath = indexRoutes[nextIndex];
        
        isSwipeNavigating.current = true;
        setIsTransitioning(true);
        setCurrentOffset(-nextIndex * 100);

        // Transition visually immediately
        if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(${-nextIndex * 100}vw, 0, 0)`;
          containerRef.current.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        }
        
        navigate(nextPath);

        // Failsafe: if navigation was blocked, snap back to correct tab
        setTimeout(() => {
          if (window.location.pathname !== nextPath) {
            isSwipeNavigating.current = false;
            snapBack();
          }
        }, 250);
      } else {
        // Bounce back to settings
        snapBack();
      }
    } else if (deltaX > 0 && (isSignificantDrag || isFastSwipe)) {
      // Swipe right -> Move backward to previous tab
      if (targetIndex > 0) {
        const prevIndex = targetIndex - 1;
        const prevPath = indexRoutes[prevIndex];
        
        isSwipeNavigating.current = true;
        setIsTransitioning(true);
        setCurrentOffset(-prevIndex * 100);

        // Transition visually immediately
        if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(${-prevIndex * 100}vw, 0, 0)`;
          containerRef.current.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        }
        
        navigate(prevPath);

        // Failsafe: if navigation was blocked, snap back to correct tab
        setTimeout(() => {
          if (window.location.pathname !== prevPath) {
            isSwipeNavigating.current = false;
            snapBack();
          }
        }, 250);
      } else {
        // Bounce back to dashboard
        snapBack();
      }
    } else {
      // Small drag, just snap back to current active tab
      snapBack();
    }
  };

  const snapBack = () => {
    if (containerRef.current) {
      containerRef.current.style.transform = `translate3d(${targetOffset}vw, 0, 0)`;
      containerRef.current.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    }
    setIsTransitioning(true);
    setCurrentOffset(targetOffset);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  return (
    <div className="w-full h-[100dvh] overflow-hidden relative">
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="h-full flex flex-row relative select-none"
        style={{
          width: '400vw',
          transform: `translate3d(${currentOffset}vw, 0, 0)`,
          transition: isTransitioning ? 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
          willChange: 'transform'
        }}
      >
        {/* Slide 0: Dashboard (Home) */}
        <div className="w-[100vw] h-full flex-shrink-0 overflow-y-auto overflow-x-hidden relative">
          {children[0]}
        </div>

        {/* Slide 1: SpaceHub */}
        <div className="w-[100vw] h-full flex-shrink-0 overflow-y-auto overflow-x-hidden relative">
          {children[1]}
        </div>

        {/* Slide 2: Arcade (ActivitiesHub) */}
        <div className="w-[100vw] h-full flex-shrink-0 overflow-y-auto overflow-x-hidden relative">
          {children[2]}
        </div>

        {/* Slide 3: SettingsView */}
        <div className="w-[100vw] h-full flex-shrink-0 overflow-y-auto overflow-x-hidden relative">
          {children[3]}
        </div>
      </div>
    </div>
  );
}
