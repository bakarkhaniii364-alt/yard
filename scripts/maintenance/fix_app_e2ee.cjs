const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// The e2eeKey reference is inside a useEffect block starting with "Data connection for E2EE Key Exchange"
const startMarker = '// Data connection for E2EE Key Exchange';
const startIndex = content.indexOf(startMarker);

if (startIndex !== -1) {
    const endMarker = '  // NEW: Robust Call State Machine';
    const endIndex = content.indexOf(endMarker, startIndex);
    
    if (endIndex !== -1) {
        content = content.slice(0, startIndex) + content.slice(endIndex);
        fs.writeFileSync('src/App.jsx', content);
        console.log('Removed E2EE Key Exchange block successfully.');
    } else {
        console.error('End marker not found');
    }
} else {
    console.error('Start marker not found');
}
