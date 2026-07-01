import React, { useState, useEffect, useRef } from 'react';

export const PixelPet = React.memo(({ happy, onPet, onHit, skin, isPartnerAfk, externalAction, partnerName = 'Partner' }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [currentAction, setCurrentAction] = useState('idle');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [isSleeping, setIsSleeping] = useState(false);
  const [sleepStartTime, setSleepStartTime] = useState(null);
  const [lastPetTime, setLastPetTime] = useState(0);
  
  const [bubbleText, setBubbleText] = useState('');
  const [useSpriteSheet, setUseSpriteSheet] = useState(false);
  const bubbleTimeoutRef = useRef(null);
  const spriteMetadataRef = useRef(null);

  const showBubble = (text, duration = 4000) => {
    setBubbleText(text);
    if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
    bubbleTimeoutRef.current = setTimeout(() => {
      setBubbleText('');
    }, duration);
  };

  const isFirstRender = useRef(true);

  // Clean up bubble timeout on unmount
  useEffect(() => {
    return () => {
      if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
    };
  }, []);

  // 1. Partner AFK/online status message
  useEffect(() => {
    if (isFirstRender.current) return;
    if (isPartnerAfk) {
      showBubble(`Miss ${partnerName}... where did they go? 💤`);
    } else {
      showBubble(`Yay! ${partnerName} is active! 👋`);
    }
  }, [isPartnerAfk, partnerName]);

  // 2. Sleeping state toggled
  useEffect(() => {
    if (isFirstRender.current) return;
    if (isSleeping) {
      showBubble("Zzz... taking a nap... 💤");
    } else {
      showBubble("Yawn... morning! ☀️");
    }
  }, [isSleeping]);

  // 3. Hover greeted text based on happy levels
  useEffect(() => {
    if (isHovering && !isSleeping) {
      const greeting = happy > 70 
        ? "I love you! ✨" 
        : happy > 40 
          ? "Meow! Cozy vibes here. ❤️" 
          : "Feed me! 🐟";
      showBubble(greeting, 3000);
    }
  }, [isHovering, isSleeping, happy]);

  // 4. Mark first render finished after mount
  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  // 5. Random cozy thoughts every 30s
  useEffect(() => {
    if (isSleeping || isPartnerAfk) return;

    const interval = setInterval(() => {
      const thoughts = [
        "Lofi beats are so cozy... 🎵",
        "Hope you're having a wonderful day! ✨",
        "Did you drink some water today? 💧",
        "I'm so glad we have our Yard. 🏠",
        "Sending cozy vibes your way! 🌈",
        "Take a deep breath and stretch! 🧘",
        "A cup of warm cocoa sounds perfect right now. ☕",
        "Our memories here are the best. 📸",
        "You're doing great! Keep it up. 🌟",
        "Just here, enjoying the quiet moment... 🍃"
      ];
      const randomThought = thoughts[Math.floor(Math.random() * thoughts.length)];
      showBubble(randomThought);
    }, 30000);

    return () => clearInterval(interval);
  }, [isSleeping, isPartnerAfk, partnerName]);

  const actionTimeoutRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const pointerDownTimeRef = useRef(0);
  const actionVariantRef = useRef(0);

  // Handle skin path (convert .png to folder path if needed)
  let skinFolder = '/assets/cat_1_9';
  if (skin && typeof skin === 'string' && skin !== 'undefined' && skin !== 'null' && !skin.includes('[object')) {
    skinFolder = skin;
    if (skinFolder.includes('Cat Sprite Sheet')) skinFolder = '/assets/cat_1_9';
    if (skinFolder.endsWith('.png')) skinFolder = skinFolder.replace('.png', '');
    if (!skinFolder.startsWith('/') && !skinFolder.startsWith('http')) skinFolder = '/assets/' + skinFolder;
  }

  // Load sprite sheet metadata if available (performance optimization)
  useEffect(() => {
    const loadSpriteMetadata = async () => {
      try {
        const response = await fetch(`${skinFolder}/_sprite.json`);
        if (response.ok) {
          const metadata = await response.json();
          spriteMetadataRef.current = metadata;
          setUseSpriteSheet(true);
        } else {
          setUseSpriteSheet(false);
        }
      } catch (err) {
        // Sprite sheet not available, fall back to individual tiles
        setUseSpriteSheet(false);
      }
    };
    loadSpriteMetadata();
  }, [skinFolder]);
  
  const isHungry = happy < 50;
  const isIgnored = lastPetTime > 0 && (Date.now() - lastPetTime > 4 * 60 * 60 * 1000);
  const isSad = !isSleeping && (isHungry || isIgnored || happy < 30);

  const randomIdleActions = ['yawn', 'wash', 'paw', 'stretch', 'scratch', 'walk'];

  useEffect(() => {
    setIsSleeping(false);
    setLastActivityTime(Date.now());

    const interval = setInterval(() => {
      const now = Date.now();
      const hr = new Date().getHours();
      const isNight = hr < 6 || hr > 22;

      if (isNight && !isSleeping && (now - lastActivityTime > 120000)) {
        setIsSleeping(true);
        setSleepStartTime(now);
      }

      if (!isNight && !isSleeping && (now - lastActivityTime > 60000) && Math.random() > 0.95) {
        setIsSleeping(true);
        setSleepStartTime(now);
      }

      if (isSleeping && sleepStartTime && (now - sleepStartTime > 1 * 60 * 60 * 1000)) {
        setIsSleeping(false);
        setLastActivityTime(now);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [isSleeping, lastActivityTime, sleepStartTime]);

  const triggerAction = (actionName, duration) => {
    actionVariantRef.current = Math.random();
    setCurrentAction(actionName);
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
    actionTimeoutRef.current = setTimeout(() => {
      setCurrentAction('idle');
    }, duration);
  };

  useEffect(() => {
    if (externalAction) triggerAction(externalAction, 3000);
  }, [externalAction]);

  useEffect(() => {
    if (isSleeping || currentAction !== 'idle' || isSad) return;
    const interval = setInterval(() => {
      if (Math.random() > 0.8) {
        const randomAction = randomIdleActions[Math.floor(Math.random() * randomIdleActions.length)];
        triggerAction(randomAction, 3000);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isSleeping, currentAction, isSad]);

  const startPress = () => {
    const now = Date.now();
    setLastPetTime(now);
    setLastActivityTime(now);
    pointerDownTimeRef.current = now;

    if (isSleeping) {
      setIsSleeping(false);
      setSleepStartTime(null);
      triggerAction('yawn', 2000);
      return;
    }

    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
    }

    holdTimeoutRef.current = setTimeout(() => {
      setLastPetTime(Date.now());
      triggerAction('paw', 1200);
      if (onPet) onPet();
      holdTimeoutRef.current = null;
    }, 400);
  };

  const releasePress = () => {
    const now = Date.now();
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
      if (now - pointerDownTimeRef.current < 400) {
        setLastPetTime(now);
        triggerAction('hiss', 800);
        if (onHit) onHit();
      }
    }
  };

  const cancelPress = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  };

  const getSpriteForState = () => {
    if (isSleeping) {
      const sleepOpts = [{ start: 132, frames: 2 }, { start: 143, frames: 2 }, { start: 176, frames: 2 }, { start: 187, frames: 2 }];
      const opt = sleepOpts[Math.floor(Date.now() / 10000) % sleepOpts.length];
      return { start: opt.start, frames: opt.frames, duration: 1000 };
    }

    const variant = actionVariantRef.current;
    if (currentAction === 'hiss') {
      const start = variant > 0.5 ? 451 : 462;
      return { start, frames: 2, duration: 500 };
    }
    if (currentAction === 'eat') return { start: 220, frames: 8, duration: 1000 };
    if (currentAction === 'meow') {
      const meows = [{s:308, f:3}, {s:319, f:3}, {s:330, f:3}, {s:341, f:3}];
      const m = meows[Math.floor(variant * meows.length)];
      return { start: m.s, frames: m.f, duration: 700 };
    }
    if (currentAction === 'yawn') {
      const yawns = [{s:352, f:8}, {s:363, f:8}, {s:374, f:8}, {s:385, f:8}];
      const y = yawns[Math.floor(variant * yawns.length)];
      return { start: y.s, frames: y.f, duration: 1100 };
    }
    if (currentAction === 'wash') {
      const licks = [{s:396, f:9}, {s:407, f:9}, {s:418, f:7}];
      const l = licks[Math.floor(variant * licks.length)];
      return { start: l.s, frames: l.f, duration: 1000 };
    }
    if (currentAction === 'paw') return { start: 484, frames: 9, duration: 900 };
    if (currentAction === 'stretch') return { start: 572, frames: 4, duration: 1200 };
    if (currentAction === 'scratch') {
      const scratches = [{s:429, f:11}, {s:440, f:11}];
      const s = scratches[Math.floor(variant * scratches.length)];
      return { start: s.s, frames: s.f, duration: 1200 };
    }
    if (currentAction === 'walk') {
      const walks = [{s:66, f:8}, {s:77, f:8}];
      const w = walks[Math.floor(variant * walks.length)];
      return { start: w.s, frames: w.f, duration: 1200 };
    }

    if (isSad) return { start: 473, frames: 1, duration: 1000 };
    if (isPartnerAfk) return { start: 176, frames: 2, duration: 1200 };
    if (isHovering) return { start: 308, frames: 3, duration: 1000 };

    const defaultOptions = [{s:132, f:2}, {s:143, f:2}, {s:176, f:2}, {s:187, f:2}, {s:66, f:8}, {s:77, f:8}];
    const def = defaultOptions[Math.floor(variant * defaultOptions.length)];
    return { start: def.s, frames: def.f, duration: def.f > 2 ? 1200 : 2000 };
  };

  const { start, frames, duration } = getSpriteForState();

  useEffect(() => {
    setCurrentFrame(0);
    if (frames <= 1) return;
    const interval = setInterval(() => {
      setCurrentFrame(f => (f + 1) % frames);
    }, duration / frames);
    return () => clearInterval(interval);
  }, [start, frames, duration]);

  const scale = 4;
  const frameSize = 32 * scale;
  const metadata = spriteMetadataRef.current;

  // Calculate sprite position for sprite sheet optimization
  const getSpritePosition = () => {
    if (!useSpriteSheet || !metadata) return null;
    const frameIndex = start + currentFrame;
    const col = frameIndex % metadata.tilesPerRow;
    const row = Math.floor(frameIndex / metadata.tilesPerRow);
    const tileW = metadata.tileWidth * scale;
    const tileH = metadata.tileHeight * scale;
    return {
      bgX: -(col * tileW),
      bgY: -(row * tileH),
      bgWidth: metadata.spriteWidth * scale,
      bgHeight: metadata.spriteHeight * scale,
    };
  };

  const spritePos = useSpriteSheet ? getSpritePosition() : null;

  return (
    <div
      className={`relative cursor-pointer select-none transition-opacity no-swipe ${isSleeping ? 'opacity-80' : ''}`}
      onMouseEnter={() => !isSleeping && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onPointerDown={startPress}
      onPointerUp={releasePress}
      onPointerLeave={cancelPress}
      title={isSleeping ? "Shh, pet is sleeping. Hold to pet, tap to hit." : "Hold to pet, tap to hit."}
    >
      {bubbleText && (
        <div className="absolute bottom-[105%] left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none w-max max-w-[200px]">
          <div 
            className="retro-border retro-shadow-dark p-2 whitespace-normal break-words relative select-none text-center text-[10px] sm:text-[11px] font-bold"
            style={{ 
              backgroundColor: 'var(--bg-window)', 
              color: 'var(--text-main)', 
              borderColor: 'var(--border)'
            }}
          >
            {bubbleText}
            {/* Arrow */}
            <div 
              className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px]" 
              style={{ borderTopColor: 'var(--border)' }}
            />
            <div 
              className="absolute left-1/2 -translate-x-1/2 top-[99%] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px]" 
              style={{ borderTopColor: 'var(--bg-window)' }}
            />
          </div>
        </div>
      )}
      {/* Pet sprite - uses sprite sheet if available, falls back to individual tiles */}
      {useSpriteSheet && spritePos ? (
        <div
          style={{
            width: `${frameSize}px`,
            height: `${frameSize}px`,
            backgroundImage: `url(${skinFolder}/_sprite.png)`,
            backgroundPosition: `${spritePos.bgX}px ${spritePos.bgY}px`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${spritePos.bgWidth}px ${spritePos.bgHeight}px`,
            imageRendering: 'pixelated',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div
          style={{
            width: `${frameSize}px`,
            height: `${frameSize}px`,
            backgroundColor: 'transparent'
          }}
        />
      )}
      {isSleeping && (
        <span className="absolute -top-2 -right-2 text-sm font-mono font-bold animate-pulse text-border drop-shadow-[2px_2px_0px_rgba(0,0,0,0.5)] opacity-0">zzz</span>
      )}
      {isSad && !isSleeping && (
        <div className="absolute -top-3 -right-2 flex flex-col items-center text-[11px] font-bold text-accent-text drop-shadow-[2px_2px_0px_rgba(0,0,0,0.5)] opacity-0">
          <span>:(</span>
          <span className="text-[10px] opacity-80">sad</span>
        </div>
      )}
      {currentAction === 'meow' && (
        <svg width="24" height="24" viewBox="0 0 16 16" className="absolute -top-4 right-0 animate-bounce drop-shadow-[2px_2px_0px_rgba(0,0,0,0.5)]">
          <path d="M4,2 L7,2 L7,3 L9,3 L9,2 L12,2 L12,3 L14,3 L14,6 L13,6 L13,8 L12,8 L12,10 L11,10 L11,11 L10,11 L10,12 L9,12 L9,13 L7,13 L7,12 L6,12 L6,11 L5,11 L5,10 L4,10 L4,8 L3,8 L3,6 L2,6 L2,3 Z" fill="#ff4d4d" />
        </svg>
      )}
    </div>
  );
});
