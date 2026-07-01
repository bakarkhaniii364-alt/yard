import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth, useSync, useChat } from '../../context/instances.js';
import { useToast } from '../UI.jsx';
import { Copy, Check, X, Hash, MessageSquare } from 'lucide-react';

export function ShareModal({ isOpen, onClose, post, comment = null }) {
  const { userId, partnerId } = useAuth();
  const { globalState } = useSync();
  const { sendMessage: syncSendMessage } = useChat();
  const toast = useToast();

  const [dmsList, setDmsList] = useState([]);
  const [otherUsersList, setOtherUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [sending, setSending] = useState(false);

  const roomProfiles = globalState?.room_profiles || {};

  // Fetch DM connections and separate users
  useEffect(() => {
    if (!isOpen || !userId) return;

    let isMounted = true;
    const fetchDmConnections = async () => {
      setLoading(true);
      try {
        // Fetch all DM channels the current user is part of
        const { data: myDmMembers, error: dmErr } = await supabase
          .from('yard_dm_members')
          .select('channel_id')
          .eq('user_id', userId);

        if (dmErr) throw dmErr;

        const channelIds = myDmMembers?.map(m => m.channel_id) || [];
        
        let dmPartnerIds = [];
        if (channelIds.length > 0) {
          const { data: allDmMembers, error: membersErr } = await supabase
            .from('yard_dm_members')
            .select('channel_id, user_id')
            .in('channel_id', channelIds);

          if (membersErr) throw membersErr;

          // Find the user ID we are talking to in each channel
          allDmMembers?.forEach(m => {
            if (m.user_id !== userId && !dmPartnerIds.includes(m.user_id)) {
              dmPartnerIds.push(m.user_id);
            }
          });
        }

        // Always include the partnerId in the DMs list if they exist
        if (partnerId && !dmPartnerIds.includes(partnerId)) {
          dmPartnerIds.unshift(partnerId);
        }

        // Get all profiles and filter out the current user
        const allProfiles = Object.entries(roomProfiles || {})
          .map(([id, u]) => ({
            id,
            name: u.name || 'Anonymous',
            pfp: u.pfp || null,
            emoji: u.emoji || null,
            username: id.split('-')[0] || 'user'
          }))
          .filter(u => u.id !== userId);

        // Include static bots
        const staticBots = [
          { id: 'yardbot', name: 'yardbot', pfp: null, emoji: null, username: 'yardbot' },
          { id: 'crayoncat', name: 'crayoncat', pfp: null, emoji: null, username: 'crayoncat' },
          { id: 'retrogamer', name: 'retrogamer', pfp: null, emoji: null, username: 'retrogamer' }
        ];

        const combinedUsers = [...allProfiles, ...staticBots];

        // Separate into DM list and other list
        const dms = combinedUsers.filter(u => dmPartnerIds.includes(u.id));
        const others = combinedUsers.filter(u => !dmPartnerIds.includes(u.id));

        if (isMounted) {
          setDmsList(dms);
          setOtherUsersList(others);
        }
      } catch (err) {
        console.error("Error fetching DM connections:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDmConnections();

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId, partnerId, roomProfiles]);

  if (!isOpen || !post) return null;

  // Generate URL & text
  const userShortId = post.user_id?.split('-')[0] || 'user';
  const postShortId = post.id.split('-').pop();
  const compoundIdString = `${userShortId}-${postShortId}`;
  
  let targetUrl = `${window.location.origin}/post/${compoundIdString}`;
  if (comment) {
    targetUrl += `#${comment.id}`;
  }

  const postAuthorName = roomProfiles[post.user_id]?.name || post.username || 'User';

  const shareText = comment
    ? `💬 [Shared Comment] @${comment.username}: "${comment.content}" - ${targetUrl}`
    : `📢 [Shared Post] @${postAuthorName}: "${post.content}" - ${targetUrl}`;

  // Copy link handler
  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetUrl);
    toast({
      message: 'Link copied to clipboard!',
      type: 'success'
    });
  };

  // Toggle user selection
  const handleToggleSelect = (targetUserId) => {
    setSelectedUserIds(prev => {
      if (prev.includes(targetUserId)) {
        return prev.filter(id => id !== targetUserId);
      } else {
        return [...prev, targetUserId];
      }
    });
  };

  // Undo Share action
  const handleUndoShare = async (sentMessages) => {
    try {
      for (const msg of sentMessages) {
        if (msg.type === 'e2e') {
          await supabase.from('chat_messages').delete().eq('id', msg.id);
        } else {
          await supabase.from('yard_dm_messages').delete().eq('id', msg.id);
        }
      }
      toast({
        message: 'Sharing undone!',
        type: 'success'
      });
    } catch (err) {
      console.error("Failed to undo sharing:", err);
      toast({
        message: 'Failed to undo sharing.',
        type: 'error'
      });
    }
  };

  // Send to all selected users
  const handleSend = async () => {
    if (selectedUserIds.length === 0 || sending) return;
    setSending(true);

    const sentMessages = [];
    const failedUsers = [];

    try {
      for (const targetUserId of selectedUserIds) {
        try {
          // 1. Special case: partner (E2EE room message)
          if (targetUserId === partnerId) {
            const tempId = `temp-${crypto.randomUUID()}`;
            const clientId = crypto.randomUUID();
            // Since ChatProvider's sendMessage handles it in background, we can insert into chat_messages manually
            // or use syncSendMessage. Note that syncSendMessage is async but does not block.
            // Let's insert into chat_messages directly to get the message ID for undo!
            const { data, error } = await supabase
              .from('chat_messages')
              .insert({
                room_id: globalState.couple_data?.room_id || globalState.room_id || '',
                sender_id: userId,
                type: 'text',
                content: shareText,
                metadata: { status: 'sent', client_id: clientId }
              })
              .select('id')
              .single();

            if (!error && data) {
              sentMessages.push({ id: data.id, type: 'e2e' });
            } else {
              // fallback
              await syncSendMessage(shareText, 'text');
            }
            continue;
          }

          // 2. Special case: mock bots
          if (['yardbot', 'crayoncat', 'retrogamer'].includes(targetUserId)) {
            // Bots are mock users. We simulate sending to them.
            // Create a fake ID so it can be "undone" visually in the UI if needed
            sentMessages.push({ id: `mock-${Date.now()}`, type: 'mock' });
            continue;
          }

          // 3. General case: Standard DM channels
          // Step A: Find existing DM channel
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
          
          let commonChanId = myChanIds.find(cid => targetChanIds.includes(cid));

          // Step B: Create DM channel if not exists
          if (!commonChanId) {
            const { data: newChan, error: chanErr } = await supabase
              .from('yard_dm_channels')
              .insert({})
              .select('id')
              .single();

            if (chanErr) throw chanErr;
            commonChanId = newChan.id;

            // Add members
            const { error: membersErr } = await supabase
              .from('yard_dm_members')
              .insert([
                { channel_id: commonChanId, user_id: userId },
                { channel_id: commonChanId, user_id: targetUserId }
              ]);

            if (membersErr) throw membersErr;
          }

          // Step C: Insert DM message
          const { data, error: msgErr } = await supabase
            .from('yard_dm_messages')
            .insert({
              channel_id: commonChanId,
              sender_id: userId,
              content: shareText
            })
            .select('id')
            .single();

          if (msgErr) throw msgErr;
          if (data) {
            sentMessages.push({ id: data.id, type: 'dm' });
          }
        } catch (err) {
          console.error(`Failed to send to user ${targetUserId}:`, err);
          const uProfile = roomProfiles[targetUserId] || {};
          failedUsers.push(uProfile.name || 'Anonymous');
        }
      }

      // Close modal first
      onClose();

      // Show toast with Undo action
      if (sentMessages.length > 0) {
        toast({
          message: 'Post shared successfully!',
          type: 'success',
          action: {
            label: 'Undo',
            onClick: () => handleUndoShare(sentMessages)
          }
        });
      }

      if (failedUsers.length > 0) {
        toast({
          message: `Failed to share with: ${failedUsers.join(', ')}`,
          type: 'error'
        });
      }
    } catch (err) {
      console.error("Error sending share:", err);
      toast({
        message: 'Failed to share post.',
        type: 'error'
      });
    } finally {
      setSending(false);
    }
  };

  // Share to Server Channel directly
  const handleShareToChannel = async () => {
    try {
      const { data: channels } = await supabase.from('yard_channels').select('id').limit(1);
      if (channels && channels.length > 0) {
        const { data, error } = await supabase
          .from('yard_messages')
          .insert([{
            channel_id: channels[0].id,
            user_id: userId,
            content: shareText
          }])
          .select('id')
          .single();

        if (error) throw error;

        onClose();
        
        const sentMessages = [{ id: data.id, type: 'channel' }];
        toast({
          message: 'Shared to server channel!',
          type: 'success',
          action: {
            label: 'Undo',
            onClick: async () => {
              await supabase.from('yard_messages').delete().eq('id', data.id);
              toast({ message: 'Sharing undone!', type: 'success' });
            }
          }
        });
      } else {
        toast({ message: 'No server channels found to share.', type: 'warn' });
      }
    } catch (e) {
      console.error(e);
      toast({ message: 'Failed to share to channel.', type: 'error' });
    }
  };

  // Share to Room Chat directly
  const handleShareToRoomChat = async () => {
    try {
      const tempId = `temp-${crypto.randomUUID()}`;
      const clientId = crypto.randomUUID();
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: globalState.couple_data?.room_id || globalState.room_id || '',
          sender_id: userId,
          type: 'text',
          content: shareText,
          metadata: { status: 'sent', client_id: clientId }
        })
        .select('id')
        .single();

      if (error) throw error;

      onClose();

      const sentMessages = [{ id: data.id, type: 'e2e' }];
      toast({
        message: 'Shared to room chat!',
        type: 'success',
        action: {
          label: 'Undo',
          onClick: () => handleUndoShare(sentMessages)
        }
      });
    } catch (e) {
      console.error(e);
      toast({ message: 'Failed to share to room chat.', type: 'error' });
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center pointer-events-auto"
      style={{
        background: 'rgba(var(--theme-overlay-rgb, 0, 0, 0), 0.4)',
        backdropFilter: 'none !important'
      }}
    >
      <style>{`
        .custom-retro-scroll::-webkit-scrollbar {
          height: 8px;
        }
        .custom-retro-scroll::-webkit-scrollbar-track {
          background: var(--bg-disabled, #ccc);
          border: 1px solid var(--theme-border-inset, var(--primary));
        }
        .custom-retro-scroll::-webkit-scrollbar-thumb {
          background: var(--primary, #000);
          border: 1px solid var(--theme-border-outset, var(--primary));
        }
      `}</style>
      <div 
        className="glass-window bg-window flex flex-col font-mono"
        style={{
          width: '640px',
          height: '480px',
          border: '3px solid var(--theme-border-outset, var(--primary))',
          boxShadow: 'none !important',
          borderRadius: '0px !important',
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000
        }}
      >
        {/* Header Segment */}
        <div 
          className="window-header flex justify-between items-center p-1.5 flex-shrink-0 relative overflow-hidden" 
          style={{ 
            height: '40px',
            backgroundColor: 'var(--bg-header, var(--primary))', 
            color: 'var(--text-on-header, #fff)',
            borderBottom: '2px solid var(--theme-border-outset, var(--primary))'
          }}
        >
          <div className="flex gap-2 items-center flex-1">
            <div className="flex flex-col gap-[3px] w-5 flex-shrink-0">
              <div className="h-[2px] w-full bg-current opacity-50"></div>
              <div className="h-[2px] w-full bg-current opacity-50"></div>
              <div className="h-[2px] w-full bg-current opacity-50"></div>
            </div>
            <h2 className="font-bold lowercase text-sm tracking-tight flex items-center gap-2 flex-shrink-0" style={{ fontSize: '20px', fontWeight: '700', lineHeight: '1.2' }}>
              share_link.msg
            </h2>
            <div className="flex-1 h-px bg-current opacity-30 ml-2"></div>
          </div>
          <button 
            onClick={onClose} 
            aria-label="Close" 
            className="flex p-1.5 retro-border hover:brightness-110 bg-[var(--color-destructive, #ff4d4d)] text-white" 
            style={{ 
              borderRadius: '0px !important',
              boxShadow: 'none !important',
              border: '2px solid var(--theme-border-outset, var(--primary))'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body Segment */}
        <div 
          className="window-body flex-1 overflow-y-auto"
          style={{ 
            padding: '16px', // var(--space-modal)
            overflowY: 'auto'
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full text-sm font-bold opacity-60 uppercase tracking-widest">
              retrieving connections...
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Send in DMs section */}
              <div className="flex flex-col gap-3">
                <span className="text-[12px] font-bold uppercase tracking-widest text-[var(--text-muted, #777)] select-none">
                  Send to Friends
                </span>
                
                <div 
                  className="flex gap-4 overflow-x-auto pb-3 custom-retro-scroll"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--primary) var(--bg-disabled)'
                  }}
                >
                  {/* Option 1: Copy Link Square */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0 select-none">
                    <button
                      onClick={handleCopyLink}
                      className="w-12 h-12 flex items-center justify-center retro-border hover:bg-primary/20 transition-colors"
                      style={{
                        borderRadius: '0px !important',
                        border: '2px solid var(--theme-border-outset, var(--primary))',
                        backgroundColor: 'var(--bg-window, #fff)',
                        boxShadow: 'none !important'
                      }}
                    >
                      <Copy size={18} className="text-primary" />
                    </button>
                    <span 
                      className="text-[10px] font-bold uppercase tracking-tighter text-center sidebar-text-string"
                      style={{ width: '56px' }}
                    >
                      Copy Link
                    </span>
                  </div>

                  {/* DM Connections */}
                  {dmsList.map(user => {
                    const isSelected = selectedUserIds.includes(user.id);
                    return (
                      <div key={user.id} className="flex flex-col items-center gap-1.5 shrink-0 relative">
                        <button
                          onClick={() => handleToggleSelect(user.id)}
                          className="w-12 h-12 flex items-center justify-center p-0 retro-border relative overflow-hidden group hover:brightness-110 active:translate-y-[1px]"
                          style={{
                            borderRadius: '0px !important',
                            border: isSelected 
                              ? '3px solid var(--primary, #000)' 
                              : '2px solid var(--theme-border-outset, var(--primary))',
                            backgroundColor: isSelected ? 'var(--primary-light, #e0f2fe)' : 'var(--bg-window, #fff)',
                            boxShadow: 'none !important'
                          }}
                        >
                          {user.pfp ? (
                            <img 
                              src={user.pfp} 
                              alt="" 
                              className="w-full h-full object-cover" 
                              style={{ 
                                borderRadius: '0px !important',
                                filter: isSelected ? 'brightness(0.9)' : 'none'
                              }} 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-accent text-accent-text font-bold text-sm">
                              {user.emoji || user.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          
                          {/* Selection indicator */}
                          {isSelected && (
                            <div className="absolute top-0 right-0 bg-primary text-white p-0.5" style={{ borderRadius: '0px !important' }}>
                              <Check size={10} strokeWidth={4} />
                            </div>
                          )}
                        </button>
                        <span 
                          className="text-[10px] font-bold lowercase text-center sidebar-text-string"
                          style={{ width: '56px' }}
                        >
                          {user.name}
                        </span>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-primary mt-[-2px]">
                          {isSelected ? '[selected]' : '[select]'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Other friends (not yet in DMs) */}
              {otherUsersList.length > 0 && (
                <div className="flex flex-col gap-3">
                  <span className="text-[12px] font-bold uppercase tracking-widest text-[var(--text-muted, #777)] select-none">
                    More Friends
                  </span>
                  
                  <div 
                    className="flex gap-4 overflow-x-auto pb-3 custom-retro-scroll"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'var(--primary) var(--bg-disabled)'
                    }}
                  >
                    {otherUsersList.map(user => {
                      const isSelected = selectedUserIds.includes(user.id);
                      return (
                        <div key={user.id} className="flex flex-col items-center gap-1.5 shrink-0 relative">
                          <button
                            onClick={() => handleToggleSelect(user.id)}
                            className="w-12 h-12 flex items-center justify-center p-0 retro-border relative overflow-hidden group hover:brightness-110 active:translate-y-[1px]"
                            style={{
                              borderRadius: '0px !important',
                              border: isSelected 
                                ? '3px solid var(--primary, #000)' 
                                : '2px solid var(--theme-border-outset, var(--primary))',
                              backgroundColor: isSelected ? 'var(--primary-light, #e0f2fe)' : 'var(--bg-window, #fff)',
                              boxShadow: 'none !important'
                            }}
                          >
                            {user.pfp ? (
                              <img 
                                src={user.pfp} 
                                alt="" 
                                className="w-full h-full object-cover" 
                                style={{ 
                                  borderRadius: '0px !important',
                                  filter: isSelected ? 'brightness(0.9)' : 'none'
                                }} 
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-accent text-accent-text font-bold text-sm">
                                {user.emoji || user.name.slice(0, 1).toUpperCase()}
                              </div>
                            )}

                            {/* Selection indicator */}
                            {isSelected && (
                              <div className="absolute top-0 right-0 bg-primary text-white p-0.5" style={{ borderRadius: '0px !important' }}>
                                <Check size={10} strokeWidth={4} />
                              </div>
                            )}
                          </button>
                          <span 
                            className="text-[10px] font-bold lowercase text-center sidebar-text-string"
                            style={{ width: '56px' }}
                          >
                            {user.name}
                          </span>
                          <span className="text-[8px] font-bold uppercase tracking-widest text-primary mt-[-2px]">
                            {isSelected ? '[selected]' : '[select]'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Share to Section */}
              <div className="flex flex-col gap-3 border-t border-dashed border-border/20 pt-4">
                <span className="text-[12px] font-bold uppercase tracking-widest text-[var(--text-muted, #777)] select-none">
                  Share to
                </span>
                <div className="flex gap-4">
                  {/* Option 1: Share to Server Channel */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0 select-none">
                    <button
                      onClick={handleShareToChannel}
                      className="w-12 h-12 flex items-center justify-center retro-border hover:bg-primary/20 transition-colors"
                      style={{
                        borderRadius: '0px !important',
                        border: '2px solid var(--theme-border-outset, var(--primary))',
                        backgroundColor: 'var(--bg-window, #fff)',
                        boxShadow: 'none !important'
                      }}
                    >
                      <Hash size={18} className="text-primary" />
                    </button>
                    <span 
                      className="text-[10px] font-bold uppercase tracking-tighter text-center sidebar-text-string"
                      style={{ width: '64px' }}
                    >
                      Channel
                    </span>
                  </div>

                  {/* Option 2: Share to Room Chat */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0 select-none">
                    <button
                      onClick={handleShareToRoomChat}
                      className="w-12 h-12 flex items-center justify-center retro-border hover:bg-primary/20 transition-colors"
                      style={{
                        borderRadius: '0px !important',
                        border: '2px solid var(--theme-border-outset, var(--primary))',
                        backgroundColor: 'var(--bg-window, #fff)',
                        boxShadow: 'none !important'
                      }}
                    >
                      <MessageSquare size={18} className="text-primary" />
                    </button>
                    <span 
                      className="text-[10px] font-bold uppercase tracking-tighter text-center sidebar-text-string"
                      style={{ width: '64px' }}
                    >
                      Room Chat
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Segment */}
        <div 
          className="window-footer flex items-center justify-end p-1.5 flex-shrink-0 gap-3"
          style={{ 
            height: '45px',
            backgroundColor: 'var(--bg-footer, var(--bg-main))',
            borderTop: '2px solid var(--theme-border-outset, var(--primary))'
          }}
        >
          <button 
            onClick={onClose}
            className="font-bold text-xs uppercase tracking-widest retro-border hover:brightness-110"
            style={{
              height: '32px',
              padding: '6px 12px',
              backgroundColor: 'var(--bg-disabled, #ccc)',
              color: 'var(--text-disabled, #777)',
              borderRadius: '0px !important',
              boxShadow: 'none !important',
              border: '2px solid var(--theme-border-outset, var(--primary))'
            }}
          >
            Cancel
          </button>
          
          <button 
            onClick={handleSend}
            disabled={selectedUserIds.length === 0 || sending}
            className="font-bold text-xs uppercase tracking-widest retro-border hover:brightness-110"
            style={{
              height: '32px',
              padding: '6px 12px',
              backgroundColor: selectedUserIds.length === 0 || sending ? 'var(--bg-disabled, #ccc)' : 'var(--primary)',
              color: selectedUserIds.length === 0 || sending ? 'var(--text-disabled, #777)' : 'var(--text-on-primary, #fff)',
              borderRadius: '0px !important',
              boxShadow: 'none !important',
              border: '2px solid var(--theme-border-outset, var(--primary))',
              cursor: selectedUserIds.length === 0 || sending ? 'not-allowed' : 'pointer'
            }}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
