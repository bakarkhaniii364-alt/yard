const fs = require('fs');
let c = fs.readFileSync('src/hooks/useChatSync.js', 'utf8');

// Remove import
c = c.replace(/import \{ encryptMessage, decryptMessage \} from '\.\.\/utils\/crypto\.js';\r?\n/, '');

// Fix mapMessage signature
c = c.replace('const mapMessage = async (row, e2eeKey) => {', 'const mapMessage = async (row) => {');

// Fix mapMessage body
c = c.replace(
    /if \(row\.type === 'text'\) \{[\s\S]*?catch \(e\) \{[\s\S]*?mapped\.text = row\.content;\r?\n\s*\}\r?\n\s*\}/,
    if (row.type === 'text') {\n        mapped.text = row.content;\n        if (row.content && typeof row.content === 'string' && row.content.includes('"ciphertext"')) {\n            mapped.text = "[Legacy Encrypted Message]";\n        }\n    }
);

// Fix hook signature
c = c.replace('export function useChatSync(roomId, e2eeKey) {', 'export function useChatSync(roomId) {');

// Remove keyRef
c = c.replace(/\s*const keyRef = useRef\(e2eeKey\);\r?\n\s*useEffect\(\(\) => \{\r?\n\s*keyRef\.current = e2eeKey;\r?\n\s*\}, \[e2eeKey\]\);/, '');

// Remove e2eeKey usages from arguments
c = c.replace(/, keyRef\.current/g, '');
c = c.replace(/, e2eeKey/g, '');

// Fix sendMessage encryption block
c = c.replace(
    /if \(isBlob\) \{\r?\n\s*finalContent = URL\.createObjectURL\(content\);\s*\/\/ Create instant local preview\r?\n\s*\} else if \(type === 'text'\) \{[\s\S]*?finalContent = JSON\.stringify\(encrypted\);\r?\n\s*\}\r?\n\s*\}/,
    if (isBlob) {\n      finalContent = URL.createObjectURL(content);\n    }
);

fs.writeFileSync('src/hooks/useChatSync.js', c);
console.log('Fixed useChatSync.js');
