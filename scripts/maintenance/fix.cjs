const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// The syntax error is around line 1477:
//               ) : (
//   const { assets: doodles, uploadAsset: uploadDoodle, markAssetRead } = useAssetSync(syncedRoomId, 'doodle');
// 
// // ... later in the file ...

const searchStr = "              ) : (\n  const { assets: doodles, uploadAsset: uploadDoodle, markAssetRead } = useAssetSync(syncedRoomId, 'doodle');\n\n// ... later in the file ...\n";
const searchStr2 = "              ) : (\r\n  const { assets: doodles, uploadAsset: uploadDoodle, markAssetRead } = useAssetSync(syncedRoomId, 'doodle');\r\n\r\n// ... later in the file ...\r\n";

if (code.includes(searchStr)) {
    code = code.replace(searchStr, "              ) : (\n");
} else if (code.includes(searchStr2)) {
    code = code.replace(searchStr2, "              ) : (\r\n");
}

// ensure markAssetRead is destructured correctly at the top
code = code.replace("const { assets: doodles, uploadAsset: uploadDoodle } = useAssetSync(syncedRoomId, 'doodle');", "const { assets: doodles, uploadAsset: uploadDoodle, markAssetRead } = useAssetSync(syncedRoomId, 'doodle');");

fs.writeFileSync('src/App.jsx', code);
console.log('Fixed App.jsx');
