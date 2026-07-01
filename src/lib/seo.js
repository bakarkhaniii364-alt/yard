const SITE_NAME = 'Yard';
const DEFAULT_DESCRIPTION =
  'Yard is a private space for friend groups — encrypted chat, shared scrapbooks, games, and calls.';

export const SITE_URL =
  import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') || 'https://yard-5gp.pages.dev';

const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/icon-512.png`;

/** Per-route SEO (public routes are indexable; app routes use noindex). */
export const ROUTE_SEO = {
  '/': {
    title: 'Yard — A private space for friend groups',
    description: DEFAULT_DESCRIPTION,
    index: true,
  },
  '/signup': {
    title: 'Create your Yard — Friend group space',
    description: 'Sign up and invite your friends with a short pairing code. Your shared yard unlocks when you join.',
    index: true,
  },
  '/signin': {
    title: 'Sign in to Yard',
    description: 'Return to your private group space — chat, memories, and games waiting for you.',
    index: true,
  },
  '/legal': {
    title: 'Terms & Privacy — Yard',
    description: 'Terms of service and privacy policy for the Yard app.',
    index: true,
  },
  '/password-reset': {
    title: 'Reset password — Yard',
    description: 'Reset your Yard account password.',
    index: false,
  },
  '/handshake': {
    title: 'Pair with your friends — Yard',
    description: 'Enter your friend\'s pairing code to unlock your shared Yard.',
    index: false,
  },
  '/dashboard': {
    title: 'Your Yard',
    description: 'Your yard dashboard — chat, pet, streaks, and shared apps.',
    index: false,
  },
};

const PRIVATE_PREFIXES = [
  '/dashboard',
  '/chat',
  '/handshake',
  '/settings',
  '/doodle',
  '/arcade',
  '/activities',
  '/scrapbook',
  '/notes',
  '/watch',
  '/capsule',
  '/lists',
  '/calendar',
  '/dreams',
  '/daily-q',
  '/resume',
  '/shared-canvas',
  '/pixelart',
];

const EXACT_PRIVATE_TITLES = {
  '/chat': 'Chat',
  '/settings': 'Settings',
  '/doodle': 'Doodle',
  '/scrapbook': 'Scrapbook',
  '/notes': 'Notes',
  '/watch': 'Watch SyncWatcher',
  '/capsule': 'Time Capsule',
  '/lists': 'Shared Lists',
  '/calendar': 'Calendar',
  '/dreams': 'Dream Journal',
  '/daily-q': 'Yard Quiz',
  '/resume': 'Yard Stats',
  '/shared-canvas': 'Shared Canvas',
  '/pixelart': 'Pixel Art',
};

export function getSeoForPath(pathname) {
  const exact = ROUTE_SEO[pathname];
  if (exact) return exact;

  if (EXACT_PRIVATE_TITLES[pathname]) {
    return {
      title: EXACT_PRIVATE_TITLES[pathname],
      description: DEFAULT_DESCRIPTION,
      index: false,
    };
  }

  if (pathname.startsWith('/arcade') || pathname.startsWith('/activities')) {
    const parts = pathname.split('/').filter(Boolean); // ['arcade', 'ludo', 'play']
    const gameRoute = parts[1];
    const gameTitles = {
      pictionary: 'Pictionary',
      tictactoe: 'Tic-Tac-Toe',
      memory: 'Memory Match',
      wordle: 'Retro Word',
      sudoku: 'Sudoku',
      chess: 'Chess',
      quiz: 'Yard Quiz',
      '2048': '2048',
      typing: 'Typing Race',
      wyr: 'Would You Rather',
      uno: 'Retro Uno',
      othello: 'Othello',
      pool: '8-Ball Pool',
      bluff: 'Cheat (Bluff)',
      twentyq: '20 Questions',
      ludo: 'Ludo',
    };
    const gameTitle = gameTitles[gameRoute];
    return {
      title: gameTitle || 'Arcade',
      description: DEFAULT_DESCRIPTION,
      index: false,
    };
  }

  if (PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return {
      title: 'Your Yard',
      description: DEFAULT_DESCRIPTION,
      index: false,
    };
  }

  return {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    index: false,
  };
}

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function applySeo({ title, description, index = false, path = '/' }) {
  const fullTitle = title?.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  document.title = fullTitle;

  upsertMeta('name', 'description', description);
  upsertMeta('name', 'robots', index ? 'index, follow' : 'noindex, nofollow');

  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:site_name', SITE_NAME);
  upsertMeta('property', 'og:title', fullTitle);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:url', `${SITE_URL}${path}`);
  upsertMeta('property', 'og:image', DEFAULT_OG_IMAGE);

  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', fullTitle);
  upsertMeta('name', 'twitter:description', description);
  upsertMeta('name', 'twitter:image', DEFAULT_OG_IMAGE);

  upsertLink('canonical', `${SITE_URL}${path}`);
}
