import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Heart, Share2, Plus, X, ThumbsUp, ThumbsDown, 
  Copy, MessageSquare, Flame, Check, MessageCircle, Gamepad2,
  Image as ImageIcon
} from 'lucide-react';
import { RetroWindow, RetroButton, useToast, ImageViewerOverlay } from '../components/UI.jsx';
import { useAuth, useSync, useChat } from '../context/instances.js';
import { BOT_POSTS } from '../constants/botPosts.js';
import { ShareModal } from '../components/Modals/ShareModal.jsx';
import { supabase } from '../lib/supabase.js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useLastSeen } from '../hooks/useLastSeen.js';

export function PostDetailView({ isModal = false, modalPostId = null, onCloseModal = null, onUsernameClick = null }) {
  const { compoundId } = useParams();
  const navigate = useNavigate();
  const { userId, roomId, partnerId, isInitialized } = useAuth();
  const sync = useSync();
  const { globalState, updateSyncState, updateSyncStateAtomic } = sync;
  const { sendMessage: syncSendMessage } = useChat();
  const toast = useToast();
  const { partnerStatusData, partnerStatusLabel } = useLastSeen();

  const profile = globalState?.room_profiles?.[userId] || {};

  // Parse ID
  // If rendered as a modal inside Dashboard, we use the modalPostId prop
  const activePostId = isModal ? modalPostId : compoundId;

  const [dbPosts, setDbPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyToId, setReplyToId] = useState(null);
  
  // Sharing Modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTargetComment, setShareTargetComment] = useState(null); // If sharing a comment instead of post
  const [viewImageSrc, setViewImageSrc] = useState(null);


  const handleContextMenu = (e, targetUserId) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('show_user_context_menu', {
      detail: {
        x: e.clientX,
        y: e.clientY,
        userId: targetUserId
      }
    }));
  };

  const processMentionsInMarkdown = (text) => {
    if (!text) return '';
    let processed = text;
    
    // Find all @words
    const matches = text.match(/@\w+/g);
    if (matches) {
      const uniqueMatches = [...new Set(matches)];
      uniqueMatches.forEach(match => {
        const usernameClean = match.slice(1);
        
        // Find matching user
        const matchedUserId = Object.keys(globalState?.room_profiles || {}).find(uid => {
          const profileName = globalState.room_profiles[uid]?.name || '';
          const emailName = globalState.room_profiles[uid]?.email?.split('@')[0] || '';
          const shortUid = uid.split('-')[0];
          return profileName.toLowerCase() === usernameClean.toLowerCase() || 
                 emailName.toLowerCase() === usernameClean.toLowerCase() ||
                 shortUid.toLowerCase() === usernameClean.toLowerCase();
        });
        
        const isBotMatch = ['yardbot', 'crayoncat', 'retrogamer'].includes(usernameClean.toLowerCase());
        const botId = isBotMatch ? usernameClean.toLowerCase() : null;
        
        const targetUserId = matchedUserId || botId;
        if (targetUserId) {
          const regex = new RegExp(`${match}\\b`, 'g');
          processed = processed.replace(regex, `[${match}](mention://${targetUserId})`);
        }
      });
    }
    return processed;
  };

  const renderMentions = (text) => {
    if (!text) return null;
    
    const parts = text.split(/(\s+)/); // keep whitespace
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const usernameClean = part.slice(1).replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
        
        const matchedUserId = Object.keys(globalState?.room_profiles || {}).find(uid => {
          const profileName = globalState.room_profiles[uid]?.name || '';
          const emailName = globalState.room_profiles[uid]?.email?.split('@')[0] || '';
          const shortUid = uid.split('-')[0];
          return profileName.toLowerCase() === usernameClean.toLowerCase() || 
                 emailName.toLowerCase() === usernameClean.toLowerCase() ||
                 shortUid.toLowerCase() === usernameClean.toLowerCase();
        });
        
        const isBotMatch = ['yardbot', 'crayoncat', 'retrogamer'].includes(usernameClean.toLowerCase());
        const botId = isBotMatch ? usernameClean.toLowerCase() : null;
        const targetUserId = matchedUserId || botId;

        if (targetUserId) {
          return (
            <span 
              key={index} 
              onClick={(e) => {
                e.stopPropagation();
                handleUsernameClick(targetUserId);
              }}
              className="text-primary hover:underline cursor-pointer font-black px-1 bg-primary/10 retro-border border-primary/20 inline-block"
            >
              {part}
            </span>
          );
        }
      }
      return part;
    });
  };

  const handleUsernameClick = (uid) => {
    if (onUsernameClick) {
      onUsernameClick(uid);
    } else {
      window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId: uid } }));
    }
  };

  // Fetch posts from Supabase or globalState to locate our target post
  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('yard_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setDbPosts(data);
      } else {
        setDbPosts(globalState.posts || []);
      }
    } catch (e) {
      setDbPosts(globalState.posts || []);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [globalState.posts]);

  // Resolve post
  let post = null;
  const postsToSearch = dbPosts.length > 0 ? dbPosts : (globalState.posts || []);

  if (isModal) {
    post = postsToSearch.find(p => p.id === activePostId) || BOT_POSTS.find(p => p.id === activePostId);
  } else {
    // URL parsing mode
    const [userPart, postPart] = (activePostId || '').split('-');
    if (userPart && postPart) {
      post = postsToSearch.find(p => {
        const pShortId = p.id.split('-').pop();
        const uShortId = p.user_id.split('-')[0];
        return pShortId.startsWith(postPart) && uShortId.startsWith(userPart);
      });

      if (!post) {
        post = BOT_POSTS.find(p => {
          const pShortId = p.id.split('-').pop();
          const uShortId = p.user_id.split('-')[0];
          return pShortId.startsWith(postPart) && uShortId.startsWith(userPart);
        });
      }
    }
  }

  // Merge bot post likes from globalState
  if (post && post.id.startsWith('botpost-') && globalState.bot_likes?.[post.id] !== undefined) {
    post = { ...post, likes: globalState.bot_likes[post.id] };
  }

  // Fetch comments
  const fetchComments = async () => {
    if (!post) return;
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('yard_post_comments')
        .select('*')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      let list = [];
      const preloaded = post.comments || [];

      if (!error && data) {
        list = [...preloaded, ...data];
      } else {
        const stateComments = globalState.comments?.[post.id] || [];
        list = [...preloaded, ...stateComments];
      }

      // Deduplicate comments by ID
      const unique = list.reduce((acc, current) => {
        const x = acc.find(item => item.id === current.id);
        if (!x) return acc.concat([current]);
        return acc;
      }, []);

      // Merge bot comment reactions from globalState.bot_comment_reactions
      const merged = unique.map(c => {
        if (c.id.startsWith('botcomment-') && globalState.bot_comment_reactions?.[c.id]) {
          return {
            ...c,
            likes: globalState.bot_comment_reactions[c.id].likes || [],
            dislikes: globalState.bot_comment_reactions[c.id].dislikes || []
          };
        }
        return c;
      });

      setComments(merged);
    } catch (e) {
      const preloaded = post.comments || [];
      const stateComments = globalState.comments?.[post.id] || [];
      const combined = [...preloaded, ...stateComments];
      const unique = combined.reduce((acc, current) => {
        const x = acc.find(item => item.id === current.id);
        if (!x) return acc.concat([current]);
        return acc;
      }, []);
      
      const merged = unique.map(c => {
        if (c.id.startsWith('botcomment-') && globalState.bot_comment_reactions?.[c.id]) {
          return {
            ...c,
            likes: globalState.bot_comment_reactions[c.id].likes || [],
            dislikes: globalState.bot_comment_reactions[c.id].dislikes || []
          };
        }
        return c;
      });
      setComments(merged);
    }
    setLoadingComments(false);
  };

  useEffect(() => {
    if (post) {
      fetchComments();
    }
  }, [post?.id, globalState.comments, globalState.bot_comment_reactions]);

  // If post has been deleted / not found
  if (!post) {
    const errorWindow = (
      <RetroWindow title="error.sys" className="w-full text-center">
        <p className="font-bold text-sm mb-6 text-[var(--color-destructive)]">
          The post has been deleted. Go back to feed?
        </p>
        <RetroButton 
          className="w-full justify-center text-xs uppercase" 
          onClick={() => {
            if (isModal && onCloseModal) onCloseModal();
            else navigate('/dashboard');
          }}
        >
          Go back to feed?
        </RetroButton>
      </RetroWindow>
    );

    if (isModal) {
      return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md">{errorWindow}</div>
        </div>
      );
    }
    return (
      <div className="w-full max-w-md mx-auto p-4 flex flex-col justify-center h-[50vh]">
        {errorWindow}
      </div>
    );
  }

  // Get author profile
  const author = globalState?.room_profiles?.[post.user_id] || {
    name: post.username || 'Anonymous',
    emoji: post.emoji || '👤',
    pfp: post.avatar || null
  };

  const compoundIdString = (() => {
    const userShortId = post.user_id.split('-')[0];
    const postShortId = post.id.split('-').pop();
    return `${userShortId}-${postShortId}`;
  })();

  const postUrl = `${window.location.origin}/post/${compoundIdString}`;

  // Add Comment Action
  const handleAddComment = async (e) => {
    if (e) e.preventDefault();
    if (!commentText.trim()) return;

    const newComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      post_id: post.id,
      user_id: userId,
      username: profile.name || 'You',
      emoji: profile.emoji || '👤',
      avatar: profile.pfp || null,
      content: commentText,
      parent_id: replyToId || null,
      likes: [],
      dislikes: [],
      created_at: new Date().toISOString()
    };

    try {
      const insertObj = {
        post_id: post.id,
        user_id: userId,
        username: profile.name || 'You',
        emoji: profile.emoji || '👤',
        avatar: profile.pfp || null,
        content: commentText,
        likes: [],
        dislikes: []
      };

      if (replyToId) {
        insertObj.parent_id = replyToId;
      }

      let { error } = await supabase
        .from('yard_post_comments')
        .insert([insertObj]);

      // Handle missing parent_id column dynamically
      if (error && (error.message?.includes('parent_id') || error.code === '42703')) {
        console.warn("[DB] parent_id column does not exist. Retrying insert without parent_id.");
        const fallbackObj = { ...insertObj };
        delete fallbackObj.parent_id;
        const retryResult = await supabase
          .from('yard_post_comments')
          .insert([fallbackObj]);
        if (retryResult.error) throw retryResult.error;
      } else if (error) {
        throw error;
      }
      toast('Comment published!', 'success');
    } catch (err) {
      // Fallback
      updateSyncState('comments', (prev = {}) => {
        const postComs = prev[post.id] || [];
        return { ...prev, [post.id]: [...postComs, newComment] };
      });
      toast('Comment synced to state!', 'success');
    }

    setCommentText('');
    setReplyToId(null);
    fetchComments();
  };

  // Like comment
  const handleLikeComment = async (commentId) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    const commentLikes = comment.likes || [];
    const index = commentLikes.indexOf(userId);
    const newLikes = index === -1 ? [...commentLikes, userId] : commentLikes.filter(id => id !== userId);
    const newDislikes = (comment.dislikes || []).filter(id => id !== userId);

    const isBotComment = commentId.startsWith('botcomment-');
    if (isBotComment) {
      updateSyncState('bot_comment_reactions', (prev = {}) => {
        return {
          ...prev,
          [commentId]: { likes: newLikes, dislikes: newDislikes }
        };
      });
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          return { ...c, likes: newLikes, dislikes: newDislikes };
        }
        return c;
      }));
      toast('Reaction updated!', 'success');
      return;
    }

    try {
      const { error } = await supabase
        .from('yard_post_comments')
        .update({ likes: newLikes, dislikes: newDislikes })
        .eq('id', commentId);

      if (error) throw error;
      fetchComments();
    } catch (e) {
      updateSyncState('comments', (prev = {}) => {
        const postComs = prev[post.id] || [];
        const updated = postComs.map(c => {
          if (c.id === commentId) {
            return { ...c, likes: newLikes, dislikes: newDislikes };
          }
          return c;
        });
        return { ...prev, [post.id]: updated };
      });
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          return { ...c, likes: newLikes, dislikes: newDislikes };
        }
        return c;
      }));
    }
  };

  // Dislike comment
  const handleDislikeComment = async (commentId) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    const commentDislikes = comment.dislikes || [];
    const index = commentDislikes.indexOf(userId);
    const newDislikes = index === -1 ? [...commentDislikes, userId] : commentDislikes.filter(id => id !== userId);
    const newLikes = (comment.likes || []).filter(id => id !== userId);

    const isBotComment = commentId.startsWith('botcomment-');
    if (isBotComment) {
      updateSyncState('bot_comment_reactions', (prev = {}) => {
        return {
          ...prev,
          [commentId]: { likes: newLikes, dislikes: newDislikes }
        };
      });
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          return { ...c, likes: newLikes, dislikes: newDislikes };
        }
        return c;
      }));
      toast('Reaction updated!', 'success');
      return;
    }

    try {
      const { error } = await supabase
        .from('yard_post_comments')
        .update({ likes: newLikes, dislikes: newDislikes })
        .eq('id', commentId);

      if (error) throw error;
      fetchComments();
    } catch (e) {
      updateSyncState('comments', (prev = {}) => {
        const postComs = prev[post.id] || [];
        const updated = postComs.map(c => {
          if (c.id === commentId) {
            return { ...c, likes: newLikes, dislikes: newDislikes };
          }
          return c;
        });
        return { ...prev, [post.id]: updated };
      });
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          return { ...c, likes: newLikes, dislikes: newDislikes };
        }
        return c;
      }));
    }
  };

  // Share link handler
  const handleCopyLink = () => {
    const url = shareTargetComment 
      ? `${postUrl}#${shareTargetComment.id}` 
      : postUrl;
    navigator.clipboard.writeText(url);
    toast('Link copied to clipboard!', 'success');
    setShowShareModal(false);
  };

  // Share to DM/Chat handler
  const handleShareToDM = () => {
    const text = shareTargetComment
      ? `💬 *Comment by ${shareTargetComment.username}* on Post:\n"${shareTargetComment.content}"\nLink: ${postUrl}#${shareTargetComment.id}`
      : `📢 *Shared Board Post* by ${author.name}:\n"${post.content}"\nLink: ${postUrl}`;
    
    syncSendMessage(text, 'text');
    toast('Shared to room chat!', 'success');
    setShowShareModal(false);
  };

  // Share to GC / Channel handler
  const handleShareToChannel = async () => {
    const text = shareTargetComment
      ? `💬 [Shared Comment] @${shareTargetComment.username}: "${shareTargetComment.content}" - ${postUrl}#${shareTargetComment.id}`
      : `📢 [Shared Post] @${author.name}: "${post.content}" - ${postUrl}`;

    try {
      // Find first channel inside servers to mock sending to a server channel
      const { data: channels } = await supabase.from('yard_channels').select('id').limit(1);
      if (channels && channels.length > 0) {
        await supabase.from('yard_messages').insert([{
          channel_id: channels[0].id,
          user_id: userId,
          content: text
        }]);
        toast('Shared to server channel!', 'success');
      } else {
        toast('No server channels found to share.', 'warn');
      }
    } catch (e) {
      toast('Failed to share to channel.', 'error');
    }
    setShowShareModal(false);
  };

  const renderDetailWindow = () => {
    const bgClass = '';
    return (
      <RetroWindow 
        title={isModal ? `post_comments.exe` : `post_detail.sys`} 
        onClose={() => {
          if (isModal && onCloseModal) onCloseModal();
          else navigate('/dashboard');
        }}
        className={isModal ? "universal-modal" : "w-full flex flex-col max-h-[85vh] sm:max-h-[80vh] border-none md:border-solid rounded-none relative"}
        noPadding
      >
        <div className={`${isModal ? 'window-body' : 'flex-1 overflow-y-auto p-5'} custom-scrollbar flex flex-col gap-6`}>
          {/* Post Author Info */}
          <div className="flex items-center gap-3 pb-4 border-b border-dashed border-border/20">
            {author.pfp ? (
              <img 
                src={author.pfp} 
                alt="" 
                className="w-10 h-10 border-2 border-border object-cover bg-white cursor-pointer hover:opacity-85 transition-opacity" 
                onClick={() => handleUsernameClick(post.user_id)}
                onContextMenu={(e) => handleContextMenu(e, post.user_id)}
              />
            ) : (
              <div 
                className="w-10 h-10 border-2 border-border bg-accent text-accent-text flex items-center justify-center text-xl cursor-pointer hover:opacity-85 transition-opacity"
                onClick={() => handleUsernameClick(post.user_id)}
                onContextMenu={(e) => handleContextMenu(e, post.user_id)}
              >
                {author.emoji || '👤'}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span 
                onClick={() => handleUsernameClick(post.user_id)}
                onContextMenu={(e) => handleContextMenu(e, post.user_id)}
                className="font-black text-sm lowercase hover:underline cursor-pointer"
              >
                {author.name}
              </span>
              <span className="text-[10px] font-bold opacity-60 font-mono mt-0.5">
                {new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Post Content */}
          <div className="text-xs font-mono font-bold leading-relaxed text-main-text break-words markdown-body pl-1">
            {post.content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  p: ({node, ...props}) => <span className="block mb-1.5" {...props} />,
                  a: ({node, href, children, ...props}) => {
                    if (href?.startsWith('mention://')) {
                      const targetUserId = href.replace('mention://', '');
                      return (
                        <span 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleUsernameClick(targetUserId);
                          }}
                          className="text-primary hover:underline cursor-pointer font-black px-1 bg-primary/10 retro-border border-primary/20 inline-block align-baseline"
                        >
                          {children}
                        </span>
                      );
                    }
                    return <a {...props} href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>;
                  }
                }}
              >
                {processMentionsInMarkdown(post.content)}
              </ReactMarkdown>
            ) : null}

            {post.image_url && (
              <div 
                className="mt-3 retro-border overflow-hidden bg-black/5 flex items-center justify-center max-h-72 cursor-pointer" 
                onClick={() => setViewImageSrc(post.image_url)}
              >
                <img 
                  src={post.image_url} 
                  alt="Post Attachment" 
                  className="max-w-full max-h-72 object-contain hover:scale-[1.01] transition-transform duration-300"
                />
              </div>
            )}
          </div>

          {/* Post Actions Footer */}
          <div className="p-2.5 border-t border-b border-dashed border-border/20 bg-[var(--bg-main)]/5 flex justify-between items-center">
            <span className="text-[9px] font-black uppercase opacity-65 pl-1">
              likes: {post.likes?.length || 0}
            </span>
            <RetroButton 
              size="sm" 
              variant="white" 
              className="gap-1.5"
              onClick={() => {
                setShareTargetComment(null);
                setShowShareModal(true);
              }}
            >
              <Share2 size={10} />
              <span>Share</span>
            </RetroButton>
          </div>

          {/* Comments Section */}
          <div className="flex flex-col gap-3 flex-1">
            <div className="flex justify-between items-center border-b border-dashed border-border/20 pb-2">
              <span className="text-[10px] font-black uppercase opacity-65 tracking-widest">
                Comments ({comments.length})
              </span>
              {loadingComments && (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary border-t-transparent" />
              )}
            </div>

            {/* Comments List */}
            <div className="flex flex-col gap-3 min-h-[100px]">
              {comments.length === 0 ? (
                <p className="text-xs font-bold opacity-50 italic text-center py-6">
                  No comments posted yet. Be the first to share your thoughts!
                </p>
              ) : (() => {
                const mainComments = comments.filter(c => !c.parent_id);
                const repliesMap = comments.reduce((acc, c) => {
                  if (c.parent_id) {
                    if (!acc[c.parent_id]) acc[c.parent_id] = [];
                    acc[c.parent_id].push(c);
                  }
                  return acc;
                }, {});

                const renderCommentNode = (comment, depth = 0) => {
                  const commentAuthor = globalState?.room_profiles?.[comment.user_id] || {
                    name: comment.username || 'Anonymous',
                    emoji: comment.emoji || '👤',
                    pfp: comment.avatar || null
                  };

                  const userLiked = (comment.likes || []).includes(userId);
                  const userDisliked = (comment.dislikes || []).includes(userId);
                  const childReplies = repliesMap[comment.id] || [];

                  return (
                    <div key={comment.id} className="w-full">
                      <div className="flex gap-3">
                        {/* Left column: Avatar and Threadline */}
                        <div className="flex flex-col items-center shrink-0">
                          {commentAuthor.pfp ? (
                            <img 
                              src={commentAuthor.pfp} 
                              alt="" 
                              className="w-6 h-6 rounded-none border object-cover bg-white cursor-pointer hover:opacity-85 transition-opacity" 
                              onClick={() => handleUsernameClick(comment.user_id)}
                              onContextMenu={(e) => handleContextMenu(e, comment.user_id)}
                            />
                          ) : (
                            <span 
                              className="text-xs cursor-pointer hover:opacity-85 transition-opacity flex items-center justify-center w-6 h-6 border bg-accent text-accent-text font-bold"
                              onClick={() => handleUsernameClick(comment.user_id)}
                              onContextMenu={(e) => handleContextMenu(e, comment.user_id)}
                            >
                              {commentAuthor.emoji || '👤'}
                            </span>
                          )}
                          {/* Vertical guide threadline */}
                          {childReplies.length > 0 && (
                            <div className="w-[2px] flex-1 border-l-2 border-solid border-border/20 hover:border-primary/50 transition-colors my-1" />
                          )}
                        </div>

                        {/* Right column: Comment content and replies */}
                        <div className="flex-1 flex flex-col gap-2 min-w-0">
                          {/* Comment Card */}
                          <div 
                            id={comment.id}
                            className="p-3 bg-[var(--bg-main)]/20 retro-border flex flex-col gap-2 relative group font-mono"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span 
                                  className="font-black text-[10px] truncate lowercase cursor-pointer hover:underline"
                                  onClick={() => handleUsernameClick(comment.user_id)}
                                  onContextMenu={(e) => handleContextMenu(e, comment.user_id)}
                                >
                                  {commentAuthor.name}
                                </span>
                                {comment.parent_id && (
                                  <span className="text-[8px] opacity-45 font-mono lowercase">
                                    ↳ replied to @{comments.find(x => x.id === comment.parent_id)?.username || 'user'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[8px] opacity-45 font-mono">
                                {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <p className="text-xs font-semibold break-words leading-relaxed pl-1">
                              {renderMentions(comment.content)}
                            </p>

                            <div className="flex justify-between items-center border-t border-dashed border-border/10 pt-2 mt-1">
                              <div className="flex gap-3">
                                <button 
                                  type="button"
                                  onClick={() => handleLikeComment(comment.id)}
                                  className={`flex items-center gap-1 text-[9px] font-black uppercase ${userLiked ? 'text-primary' : 'opacity-65 hover:opacity-100'}`}
                                  title="Like"
                                >
                                  <ThumbsUp size={10} fill={userLiked ? "currentColor" : "none"} />
                                  <span>{comment.likes?.length || 0}</span>
                                </button>

                                <button 
                                  type="button"
                                  onClick={() => handleDislikeComment(comment.id)}
                                  className={`flex items-center gap-1 text-[9px] font-black uppercase ${userDisliked ? 'text-primary' : 'opacity-65 hover:opacity-100'}`}
                                  title="Dislike"
                                >
                                  <ThumbsDown size={10} fill={userDisliked ? "currentColor" : "none"} />
                                  <span>{comment.dislikes?.length || 0}</span>
                                </button>

                                <button 
                                  type="button"
                                  onClick={() => {
                                    setReplyToId(comment.id);
                                    setTimeout(() => {
                                      const input = document.getElementById('comment-input-field');
                                      if (input) input.focus();
                                    }, 50);
                                  }}
                                  className="flex items-center gap-1 text-[9px] font-black uppercase text-secondary hover:underline"
                                  title="Reply"
                                >
                                  <MessageSquare size={10} />
                                  <span>Reply</span>
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setShareTargetComment(comment);
                                  setShowShareModal(true);
                                }}
                                className="opacity-0 group-hover:opacity-65 hover:!opacity-100 transition-opacity flex items-center gap-1 text-[9px] font-black uppercase text-primary"
                                title="Share Comment"
                              >
                                <Share2 size={9} />
                                <span>Share</span>
                              </button>
                            </div>
                          </div>

                          {/* Nested Replies */}
                          {childReplies.length > 0 && (
                            <div className="flex flex-col gap-2 mt-1">
                              {childReplies.map(reply => renderCommentNode(reply, depth + 1))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                };

                return (
                  <div className="flex flex-col gap-4">
                    {mainComments.map(c => renderCommentNode(c, 0))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Comment Composition Box */}
        <div className="p-4 bg-[var(--bg-main)] border-t-2 border-border shrink-0 flex flex-col gap-2">
          {replyToId && (
            <div className="flex justify-between items-center bg-accent/10 retro-border p-1.5 text-[9px] font-black lowercase text-main-text">
              <span>
                replying to @{comments.find(c => c.id === replyToId)?.username || 'user'}
              </span>
              <button 
                type="button" 
                onClick={() => setReplyToId(null)}
                className="text-red-500 hover:text-red-700 font-bold"
              >
                [cancel]
              </button>
            </div>
          )}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input 
              id="comment-input-field"
              type="text"
              placeholder={replyToId ? "Write a reply..." : "Write a comment..."}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={200}
              className="flex-1 px-3 py-2 text-xs bg-window text-main-text retro-border focus:outline-none focus:ring-1 focus:ring-primary/20 font-bold"
            />
            <RetroButton 
              type="submit" 
              variant="primary" 
              size="sm"
              disabled={!commentText.trim()}
            >
              {replyToId ? "Reply" : "Comment"}
            </RetroButton>
          </form>
        </div>
      </RetroWindow>
    );
  };

  return (
    <>
      {isModal ? (
        <div className="modal-backdrop fixed inset-0 z-[var(--z-modal)] flex items-center justify-center">
          {renderDetailWindow()}
        </div>
      ) : (
        <div className="w-full max-w-2xl mx-auto p-4 flex flex-col justify-center min-h-[80vh]">
          {renderDetailWindow()}
        </div>
      )}

      {/* ── MODAL: SHARE OPTIONS ── */}
      <ShareModal 
        isOpen={showShareModal} 
        onClose={() => setShowShareModal(false)} 
        post={post} 
        comment={shareTargetComment}
      />

      {/* ── IMAGE VIEWER OVERLAY ── */}
      {viewImageSrc && (
        <ImageViewerOverlay 
          src={viewImageSrc} 
          onClose={() => setViewImageSrc(null)} 
        />
      )}
    </>
  );
}
