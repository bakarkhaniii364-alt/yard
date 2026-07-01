import React, { useEffect, useState, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import YSupabaseProvider from '../lib/y-supabase-provider.js'
import { IndexeddbPersistence } from 'y-indexeddb'
import { RetroWindow } from '../components/UI.jsx'

export function SharedNotes({ onClose, sfx, roomId, userId, userName, userColor }) {
  const ydoc = useMemo(() => new Y.Doc(), []);
  const [provider, setProvider] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Correctly use roomId passed from route
    const roomIdentifier = roomId ? `yard-notes-${roomId}` : `yard-notes-fallback`;
    
    // Set up local indexeddb persistence
    const indexeddbProvider = new IndexeddbPersistence(roomIdentifier, ydoc);
    indexeddbProvider.on('synced', () => setIsLoaded(true));

    const supaProvider = new YSupabaseProvider(roomIdentifier, ydoc, { user: { name: userName, color: userColor } });
    setProvider(supaProvider);
    
    return () => {
      try { supaProvider.destroy(); } catch (_) {}
      try { indexeddbProvider.destroy(); } catch (_) {}
    }
  }, [roomId, ydoc]);

  // Keep track of online users in this note session
  useEffect(() => {
    if (!provider) return;

    const handleAwarenessChange = () => {
      const states = provider.awareness.getStates();
      const users = [];
      states.forEach((state) => {
        if (state.user) {
          users.push(state.user);
        }
      });
      setActiveUsers(users);
    };

    provider.awareness.on('change', handleAwarenessChange);
    handleAwarenessChange(); // fetch initial users

    return () => {
      provider.awareness.off('change', handleAwarenessChange);
    };
  }, [provider]);

  const extensions = useMemo(() => {
    const base = [
      StarterKit.configure({ history: false }),
      Collaboration.configure({
        document: ydoc,
      }),
    ];

    if (provider) {
      base.push(
        CollaborationCursor.configure({
          provider: provider,
          user: { name: userName, color: userColor || '#e94560' },
        })
      );
    }
    return base;
  }, [provider, ydoc, userName, userColor]);

  const editor = useEditor({
    extensions,
  }, [extensions]);

  if (!editor || !isLoaded) {
    return (
      <RetroWindow title="shared_notes.exe" onClose={onClose} sfx={sfx} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px]">
        <div className="flex items-center justify-center h-full w-full text-main-text font-black animate-pulse">
          Loading Notes...
        </div>
      </RetroWindow>
    )
  }

  return (
    <RetroWindow 
      title="shared_notes.exe" 
      onClose={onClose} 
      sfx={sfx} 
      className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px]" 
      noPadding
      confirmOnClose={true}
      hasUnsavedChanges={() => editor?.getText().trim() !== ''}
    >


      <div className="flex flex-col h-full bg-white">
        <div className="p-3 border-b-2 border-dashed border-[var(--border)] bg-[var(--bg-window)] flex items-center justify-between">
           <h2 className="font-black text-xs uppercase tracking-widest text-main-text">Shared Notepad</h2>
           <div className="flex items-center gap-3">
              {/* Presence badges */}
              {activeUsers.length > 0 && (
                <div className="flex -space-x-1.5 mr-1">
                  {activeUsers.map((u, idx) => (
                    <div 
                      key={idx} 
                      className="w-5 h-5 rounded-full border border-black flex items-center justify-center text-[8px] font-black uppercase text-white shadow-sm shrink-0"
                      style={{ backgroundColor: u.color }}
                      title={u.name}
                    >
                      {u.name.substring(0, 2)}
                    </div>
                  ))}
                </div>
              )}
              <div className="w-3 h-3 rounded-full bg-[var(--color-game)] animate-pulse shadow-[0_0_5px_#22c55e]" title="Live Syncing" />
           </div>
        </div>
        
        {/* Lined paper layout with click-to-focus */}
        <div 
          className="flex-1 overflow-y-auto ruled-notepad cursor-text selection:bg-[var(--accent)] selection:text-[var(--text-main)]"
          onClick={() => editor?.commands.focus()}
        >
          <EditorContent editor={editor} className="outline-none" />
        </div>

        <div className="p-2 bg-[var(--bg-window)] border-t border-dashed border-[var(--border)]/20 text-[8px] font-black uppercase tracking-[0.2em] text-center opacity-40 text-main-text">
           Real-time CRDT Collaboration Active
        </div>
      </div>
    </RetroWindow>
  )
}
