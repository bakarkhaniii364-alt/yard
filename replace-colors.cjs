const fs = require('fs');
const path = require('path');

const walk = (dir, done) => {
  let results = [];
  fs.readdir(dir, (err, list) => {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach((file) => {
      file = path.resolve(dir, file);
      fs.stat(file, (err, stat) => {
        if (stat && stat.isDirectory()) {
          walk(file, (err, res) => {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          if (file.endsWith('.jsx') || file.endsWith('.css') || file.endsWith('.js')) {
            results.push(file);
          }
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

const replacements = [
  // Typography
  { regex: /fontFamily:\s*["'](?:'Pixelify Sans',\s*cursive|Pixelify Sans|Hind Siliguri)['"]/g, replace: 'fontFamily: "var(--font-display)"' },
  { regex: /fontFamily:\s*["'](?:'Space Mono',\s*'Hind Siliguri',\s*monospace)['"]/g, replace: 'fontFamily: "var(--font-mono)"' },
  { regex: /style=\{\{\s*fontFamily:\s*['"]'Pixelify Sans',\s*cursive['"]\s*\}\}/g, replace: 'style={{ fontFamily: "var(--font-display)" }}' },
  // Colors (Tailwind classes)
  { regex: /\bbg-red-500\b/g, replace: 'bg-[var(--color-destructive)]' },
  { regex: /\btext-red-500\b/g, replace: 'text-[var(--color-destructive)]' },
  { regex: /\bborder-red-500\b/g, replace: 'border-[var(--color-destructive)]' },
  { regex: /\bbg-red-600\b/g, replace: 'bg-[var(--color-destructive)]' },
  { regex: /\bbg-red-400\b/g, replace: 'bg-[var(--color-destructive)]' },
  
  { regex: /\bbg-green-500\b/g, replace: 'bg-[var(--color-game)]' },
  { regex: /\btext-green-500\b/g, replace: 'text-[var(--color-game)]' },
  { regex: /\bborder-green-500\b/g, replace: 'border-[var(--color-game)]' },
  { regex: /\bbg-green-400\b/g, replace: 'bg-[var(--color-game)]' },
  
  { regex: /\bbg-blue-500\b/g, replace: 'bg-[var(--color-cta)]' },
  { regex: /\btext-blue-500\b/g, replace: 'text-[var(--color-cta)]' },
  { regex: /\bborder-blue-500\b/g, replace: 'border-[var(--color-cta)]' },
  { regex: /\bbg-[#0078d7]\b/g, replace: 'bg-[var(--color-cta)]' },
  { regex: /\btext-[#0078d7]\b/g, replace: 'text-[var(--color-cta)]' },
  
  { regex: /text-\['Pixelify Sans',\s*cursive\]/g, replace: 'text-[var(--font-display)]' },
];

walk('./src', (err, files) => {
  if (err) throw err;
  let totalModifications = 0;
  
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;
    
    replacements.forEach(({regex, replace}) => {
      content = content.replace(regex, replace);
    });
    
    if (content !== originalContent) {
      fs.writeFileSync(file, content, 'utf8');
      totalModifications++;
      console.log(`Modified: ${file}`);
    }
  });
  
  console.log(`\nFinished! Modified ${totalModifications} files.`);
});
