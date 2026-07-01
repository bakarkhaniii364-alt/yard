Inline style attributes and style objects found (need refactor to remove inline styles for strict CSP):

- src/apps/TimeCapsuleApp.jsx: lines ~53,~59,~64,~65,~85
- src/components/Call/PremiumCallHub.jsx: multiple inline style objects (width, boxShadow, colors, left positions)
- src/apps/SharedNotes.jsx: inline backgroundColor on user color
- src/apps/ScrapbookApp.jsx: inline positioning and transform for draggable items
- src/components/LofiPlayer.jsx: width/opacity animation durations and animationDuration inline

Suggested next steps:
- Convert static inline styles (colors, spacing) to CSS classes in `src/styles/` or component-scoped CSS modules.
- For dynamic numeric styles (percentages), replace with CSS classes for quantized steps or move rendering logic to CSS transforms tied to classes.
- Alternatively, adopt a small runtime that inserts hashed style blocks into a `<style nonce="...">` tag at app bootstrap and reference them via class names.
- Prioritize `PremiumCallHub.jsx`, `ScrapbookApp.jsx`, and `LofiPlayer.jsx` as they impact UX and CSP.
