import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth, useSync, useCall } from '../../context/instances.js';
import { useToast } from '../UI.jsx';
import { playAudio } from '../../utils/audio.js';

export function UserContextMenu() {
  const [menu, setMenu] = useState(null); // { x: number, y: number, userId: string }
  const { userId: currentUserId, partnerId } = useAuth();
  const { globalState } = useSync();
  const { startCall } = useCall();
  const toast = useToast();
  const navigate = useNavigate();

  const menuRef = useRef(null);

  useEffect(() => {
    const handleShow = (e) => {
      const { x, y, userId } = e.detail;
      setMenu({ x, y, userId });
    };

    const handleClose = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenu(null);
      }
    };

    window.addEventListener('show_user_context_menu', handleShow);
    window.addEventListener('mousedown', handleClose);

    return () => {
      window.removeEventListener('show_user_context_menu', handleShow);
      window.removeEventListener('mousedown', handleClose);
    };
  }, []);

  if (!menu) return null;

  const { x, y, userId } = menu;
  const roomProfiles = globalState?.room_profiles || {};
  const profileInfo = roomProfiles[userId] || {};
  const username = profileInfo.name || userId.split('-')[0] || 'User';

  const menuWidth = 180;
  const menuHeight = 360;
  const adjustedX = x + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 10 : x;
  const adjustedY = y + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 10 : y;

  const handleAction = (actionType) => {
    setMenu(null);
    playAudio('click', true);

    switch (actionType) {
      case 'profile':
        window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId } }));
        break;

      case 'mention': {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
          const start = activeEl.selectionStart;
          const end = activeEl.selectionEnd;
          const text = activeEl.value;
          const mentionText = `@${username} `;
          activeEl.value = text.substring(0, start) + mentionText + text.substring(end);
          activeEl.focus();
          activeEl.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          navigator.clipboard.writeText(`@${username}`);
          toast({ message: `Copied @${username} to clipboard`, type: 'success' });
        }
        break;
      }

      case 'message': {
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
        const targetDmId = mapUserIdToDmId(userId, partnerId);
        navigate('/chat', { state: { selectDmId: targetDmId } });
        setTimeout(() => {
          const chatInput = document.querySelector('textarea, input[type="text"]');
          if (chatInput) chatInput.focus();
        }, 150);
        break;
      }

      case 'call':
        if (userId === currentUserId) {
          toast({ message: "You cannot call yourself", type: 'warn' });
        } else {
          startCall('audio');
          toast({ message: `Calling ${username}...`, type: 'success' });
        }
        break;

      case 'note':
        window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId, initialTab: 'notepad' } }));
        break;

      case 'add_friend':
        toast({ message: `@${username} is already connected in your room!`, type: 'success' });
        break;

      case 'ignore':
        toast({ message: `Ignored all posts from @${username}`, type: 'info' });
        break;

      case 'block':
        toast({ message: `Blocked @${username}. (Mock action)`, type: 'error' });
        break;

      default:
        break;
    }
  };

  const itemClass = "w-full text-left px-2.5 py-1 text-xs font-black text-main-text hover:bg-primary hover:text-primary-text flex items-center justify-between transition-colors cursor-pointer select-none lowercase";
  const dangerItemClass = "w-full text-left px-2.5 py-1 text-xs font-black text-[#f23f43] hover:bg-[#f23f43] hover:text-white flex items-center justify-between transition-colors cursor-pointer select-none lowercase";

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        zIndex: 9999
      }}
      className="w-[180px] bg-window border border-border shadow-2xl p-1 flex flex-col gap-[1px] font-mono text-main-text"
    >
      <button onClick={() => handleAction('profile')} className={itemClass}>
        <span>profile</span>
      </button>

      <button onClick={() => handleAction('mention')} className={itemClass}>
        <span>mention</span>
      </button>

      <button onClick={() => handleAction('message')} className={itemClass}>
        <span>message</span>
      </button>

      <button onClick={() => handleAction('call')} className={itemClass}>
        <span>start a call</span>
      </button>

      <button onClick={() => handleAction('note')} className="w-full text-left px-2.5 py-1 hover:bg-primary hover:text-primary-text flex flex-col justify-start transition-colors cursor-pointer select-none group/note lowercase">
        <span className="text-xs font-black text-main-text group-hover/note:text-primary-text">add note</span>
        <span className="text-[8px] text-gray-500 font-normal leading-none mt-0.5 group-hover/note:text-primary-text/75">only visible to you</span>
      </button>

      <div className="border-t border-dashed border-border/20 my-[3px]" />

      {/* Apps Submenu */}
      <div className="relative group/sub">
        <button className={itemClass}>
          <span>apps</span>
          <ChevronRight size={12} className="opacity-60" />
        </button>
        <div className="absolute top-0 left-full ml-1 hidden group-hover/sub:flex flex-col bg-window border border-border shadow-2xl p-1 w-36 gap-[1px]">
          <button onClick={() => { setMenu(null); navigate('/arcade/wordle'); }} className={itemClass}>
            <span>play wordle</span>
          </button>
          <button onClick={() => { setMenu(null); navigate('/arcade/ludo'); }} className={itemClass}>
            <span>play ludo</span>
          </button>
          <button onClick={() => { setMenu(null); navigate('/arcade/typing'); }} className={itemClass}>
            <span>play type race</span>
          </button>
        </div>
      </div>

      {/* Invite Submenu */}
      <div className="relative group/sub">
        <button className={itemClass}>
          <span>invite to server</span>
          <ChevronRight size={12} className="opacity-60" />
        </button>
        <div className="absolute top-0 left-full ml-1 hidden group-hover/sub:flex flex-col bg-window border border-border shadow-2xl p-1 w-40 gap-[1px]">
          <button onClick={() => { setMenu(null); toast({ message: "Invitation sent to Main Server", type: 'success' }); }} className={itemClass}>
            <span>main yard server</span>
          </button>
          <button onClick={() => { setMenu(null); toast({ message: "Lobby invitation sent", type: 'success' }); }} className={itemClass}>
            <span>arcade lobby</span>
          </button>
        </div>
      </div>

      <button onClick={() => handleAction('add_friend')} className={itemClass}>
        <span>add friend</span>
      </button>

      <button onClick={() => handleAction('ignore')} className={itemClass}>
        <span>ignore</span>
      </button>

      <button onClick={() => handleAction('block')} className={dangerItemClass}>
        <span>block</span>
      </button>

      <div className="border-t border-dashed border-border/20 my-[3px]" />

      {/* Role Submenu */}
      <div className="relative group/sub">
        <button className={itemClass}>
          <span>role</span>
          <ChevronRight size={12} className="opacity-60" />
        </button>
        <div className="absolute top-0 left-full ml-1 hidden group-hover/sub:flex flex-col bg-window border border-border shadow-2xl p-1 w-28 gap-[1px]">
          <button onClick={() => { setMenu(null); toast({ message: "Role changed to Owner", type: 'info' }); }} className={itemClass}>
            <span>owner</span>
          </button>
          <button onClick={() => { setMenu(null); toast({ message: "Role changed to Admin", type: 'info' }); }} className={itemClass}>
            <span>admin</span>
          </button>
          <button onClick={() => { setMenu(null); toast({ message: "Role changed to Guest", type: 'info' }); }} className={itemClass}>
            <span>guest</span>
          </button>
        </div>
      </div>
    </div>
  );
}
