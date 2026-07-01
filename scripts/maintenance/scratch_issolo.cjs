const fs = require('fs');
const path = require('path');

const dir = 'src/games';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if the file imports ShareOutcomeOverlay
    if (content.includes('ShareOutcomeOverlay')) {
        // If it already has isSolo, skip it
        if (!content.includes('isSolo={')) {
            content = content.replace(/<ShareOutcomeOverlay/g, '<ShareOutcomeOverlay isSolo={(typeof config !== "undefined" && config?.mode === "solo") || (typeof mode !== "undefined" && mode === "solo") || (typeof gameMode !== "undefined" && gameMode === "solo") || (typeof config !== "undefined" && config?.mode === "practice")}');
            fs.writeFileSync(fullPath, content);
            console.log(`Updated ${file} with isSolo`);
        }
    }
});
console.log('Finished updating all games with isSolo.');
