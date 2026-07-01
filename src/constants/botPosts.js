// Bot Users Definition
export const BOT_USERS = {
  yardbot: { id: 'bot-yardbot', name: 'yardbot', emoji: '🤖', bio: 'automated helper of the yard.' },
  crayoncat: { id: 'bot-crayoncat', name: 'crayoncat', emoji: '🐱', bio: 'loves to draw doodles and take naps near the fire.' },
  retrogamer: { id: 'bot-retrogamer', name: 'retrogamer', emoji: '🎮', bio: 'high scores are meant to be broken.' },
  lofidj: { id: 'bot-lofidj', name: 'lofidj', emoji: '🎧', bio: 'curating the best beats for study and work.' },
  pixelpet: { id: 'bot-pixelpet', name: 'pixelpet', emoji: '🐾', bio: 'feed me fish and i will be happy!' },
  spacewanderer: { id: 'bot-spacewanderer', name: 'spacewanderer', emoji: '🚀', bio: 'lost in the retro galaxy.' }
};

// Generate 50 realistic retro posts
const generateBotPosts = () => {
  const posts = [];
  const users = Object.values(BOT_USERS);
  const topics = [
    "Just updated the system boot speed to 100ms. It is absolutely lightning fast now! ⚡",
    "Spent the morning drawing some pixel art of a floating island. Check out the matcha color palette! 🍵",
    "Currently on a 15-day streak in Wordle! Can anyone beat that score? 🏆",
    "Putting together a new lo-fi playlist for coding sessions. Drop your track suggestions below! 🎧",
    "Feeling cozy today. PixelPet is sleeping right next to my terminal. 🐱💤",
    "Staring at the stars in the night sky. The pixel space hub is looking extra quiet tonight. 🌌",
    "Does anyone else still prefer Space Mono over Inter? Mono fonts just feel so right. ✍️",
    "Just beat my own high score in Tic-Tac-Toe against the AI. It blocked me three times but I still got it! 🤖",
    "Matcha theme + glassmorphism borders is the ultimate combination for web design.",
    "Reminder: Feed the tamagotchi pet today or it might get grumpy! 🐟",
    "Writing custom CSS overrides is therapeutic. Anyone else agree?",
    "P2P calls are functioning nicely. High-quality WebRTC connections with low latency! 📞",
    "Thinking about creating a retro dungeon crawler in the arcade view. What do you think?",
    "Lofi beats and rain sound effects. The ultimate study combination. 🌧️",
    "Who is up for a game of chess later? DM or invite me in the lobby! ♟️",
    "Just refactored a bunch of old React code. Reduced bundle size by 15%. Feeling productive! 🚀",
    "The weather overlay is showing clear skies. Perfect time for virtual stargazing.",
    "A cozy afternoon in the yard. The design system is looking incredibly premium today.",
    "Discovered a new synthesizer preset. Sounds like a 1983 arcade machine! 🎹",
    "Reflecting on digital intimacy. Having a shared virtual space is so special. 💕",
    "My current streak is 7 days. I will make sure not to miss tomorrow!",
    "Added a secret gameboy easter egg in the settings page. Can you find it? 👾",
    "Is anyone else studying for exams right now? Lofi DJ is keeping me sane.",
    "Working on some custom doodles. Sending a cute sketch to the scrapbook soon! 🎨",
    "The midnight theme is so easy on the eyes. Cyberpunk is also a strong choice.",
    "Pixel art tip: Use fewer colors to make your sprites look more authentic! 🎨",
    "Just made a hot cup of matcha tea. Coding time. 🍵",
    "I love how smooth the transitions are on the swipeable navigation. Butter! 🧈",
    "Yard verified highscore submitted for ludo! Let's see who can match it. 🎲",
    "Trying to write a parser for markdown formatting in chat. Regex is tricky!",
    "The neon-tokyo theme looks like a scene straight out of a retro movie. 🌃",
    "Listening to Synthwave beats while fixing bugs. The speed increases by 200%.",
    "PixelPet ate three fish today and is now doing a happy dance! 🐟🐾",
    "Remember to export your JSON data backup every once in a while. Safety first! 💾",
    "I wish we had a shared whiteboard in the channel view. That would be awesome.",
    "The sound effects in the arcade games are so nostalgic. Bloop! Beep!",
    "Exploring the retro-futuristic side of web design. Grid lines everywhere! 🌐",
    "Just finished reading a book on early computer graphics. Fascinating stuff.",
    "Is it rain or is it snow today? The weather widget keeps changing! ❄️",
    "WebRTC calls are much more reliable now with the new ICE setup. Relay OK! 👍",
    "Just completed the Couples Quiz. Turns out we know each other 92%! ❤️",
    "Vaporwave theme has the best gradients, hands down. Pink and blue forever. 🌊",
    "Just solved today's Wordle in 3 tries. Feeling like a genius! 🤓",
    "Writing blog posts in markdown is so satisfying. Straightforward and clean.",
    "Can we add a custom lofi playlist link? I want to listen to some retro jazz.",
    "Just petted PixelPet. Its happiness levels are at 100%! 🐾💕",
    "Coding in the dark with the batman theme is a vibe. 🦇",
    "Does anyone remember the sound of a dial-up modem? True nostalgia. 📞",
    "The design system needs more glassmorphism! Let's add more blur filter.",
    "50 posts milestone reached! Thanks for tuning into the bot feed! 🎉"
  ];

  const commentPool = [
    "Wow, this is awesome! 👍",
    "I totally agree with this.",
    "Can you share the link for that?",
    "Not sure about this one, to be honest.",
    "Haha, so true! 😂",
    "PixelPet is the best part of the app.",
    "Matcha theme is superior! 🍵",
    "Let's play arcade games later!",
    "This layout looks incredibly premium.",
    "Great work on this post!"
  ];

  for (let i = 0; i < 50; i++) {
    const userIndex = i % users.length;
    const author = users[userIndex];
    const postLikes = [];
    // Give random likes from other bots
    users.forEach(u => {
      if (u.id !== author.id && Math.random() > 0.4) {
        postLikes.push(u.id);
      }
    });

    const postComments = [];
    const numComments = Math.floor(Math.random() * 4) + 1; // 1 to 4 comments
    for (let c = 0; c < numComments; c++) {
      const commenterIndex = (userIndex + c + 1) % users.length;
      const commenter = users[commenterIndex];
      const commentLikes = [];
      const commentDislikes = [];
      
      users.forEach(u => {
        if (u.id !== commenter.id) {
          if (Math.random() > 0.6) commentLikes.push(u.id);
          else if (Math.random() > 0.8) commentDislikes.push(u.id);
        }
      });

      const commentId = `botcomment-${i}-${c}`;
      const parentId = c > 0 && Math.random() > 0.5 ? `botcomment-${i}-${c - 1}` : null;
      const parentComment = parentId ? postComments.find(x => x.id === parentId) : null;

      postComments.push({
        id: commentId,
        post_id: `botpost-${i}`,
        user_id: commenter.id,
        username: commenter.name,
        emoji: commenter.emoji,
        avatar: null,
        content: parentComment
          ? `@${parentComment.username} ${commentPool[(i + c) % commentPool.length]}`
          : commentPool[(i + c) % commentPool.length],
        likes: commentLikes,
        dislikes: commentDislikes,
        parent_id: parentId,
        created_at: new Date(Date.now() - 3600000 * (i + c + 1)).toISOString()
      });
    }

    const imagePool = [
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1531525645387-7f14be1bdbbd?w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop"
    ];
    const bgs = ['none', 'matcha', 'midnight', 'vaporwave', 'matrix', 'sunset', 'cyberpunk'];
    const assignedBg = bgs[i % bgs.length];
    const hasPhoto = i % 7 === 3;
    const assignedPhoto = hasPhoto ? imagePool[i % imagePool.length] : null;

    posts.push({
      id: `botpost-${i}`,
      user_id: author.id,
      username: author.name,
      emoji: author.emoji,
      avatar: null,
      content: topics[i],
      background: assignedBg,
      image_url: assignedPhoto,
      likes: postLikes,
      created_at: new Date(Date.now() - 3600000 * (i + 1)).toISOString(),
      comments: postComments
    });
  }

  return posts;
};

export const BOT_POSTS = generateBotPosts();
