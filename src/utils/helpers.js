export function hexToRgba(hex) { let c = hex.substring(1).split(''); if(c.length===3) c= [c[0], c[0], c[1], c[1], c[2], c[2]]; c= '0x'+c.join(''); return [(c>>16)&255, (c>>8)&255, c&255, 255]; }

export function floodFill(canvas, startX, startY, fillColorHex) {
  const ctx = canvas.getContext('2d'); const w = canvas.width, h = canvas.height; if (w === 0 || h === 0) return;
  const imageData = ctx.getImageData(0, 0, w, h); const data = imageData.data;
  const [fR, fG, fB, fA] = hexToRgba(fillColorHex); const startPos = (startY * w + startX) * 4;
  const sR = data[startPos], sG = data[startPos+1], sB = data[startPos+2], sA = data[startPos+3];
  if (sR === fR && sG === fG && sB === fB && sA === fA) return;
  const matchStartColor = (pos) => data[pos] === sR && data[pos+1] === sG && data[pos+2] === sB && data[pos+3] === sA;
  const colorPixel = (pos) => { data[pos] = fR; data[pos+1] = fG; data[pos+2] = fB; data[pos+3] = fA; };
  const stack = [[startX, startY]];
  while (stack.length) {
    const [cx, cy] = stack.pop(); let currY = cy; let pos = (currY * w + cx) * 4;
    while (currY >= 0 && matchStartColor(pos)) { currY--; pos -= w * 4; } currY++; pos += w * 4;
    let reachLeft = false, reachRight = false;
    while (currY < h && matchStartColor(pos)) {
      colorPixel(pos);
      if (cx > 0) { if (matchStartColor(pos - 4)) { if (!reachLeft) { stack.push([cx - 1, currY]); reachLeft = true; } } else if (reachLeft) reachLeft = false; }
      if (cx < w - 1) { if (matchStartColor(pos + 4)) { if (!reachRight) { stack.push([cx + 1, currY]); reachRight = true; } } else if (reachRight) reachRight = false; }
      currY++; pos += w * 4;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export async function fetchDynamicWord(length, fallbackList) {
  try { const res = await fetch(`https://api.datamuse.com/words?sp=${'?'.repeat(length)}&max=100`); if(res.ok) { const data = await res.json(); const valid = data.map(d=>d.word.toUpperCase()).filter(w => /^[A-Z]+$/.test(w)); if(valid.length > 0) return valid[Math.floor(Math.random() * valid.length)]; } } catch (e) {}
  return fallbackList[Math.floor(Math.random() * fallbackList.length)];
}

export function getScore(scores, game) {
  if (!scores) return 0;
  let val = scores[game];
  if (typeof val === 'object' && val !== null) { val = val.me !== undefined ? val.me : (val.wins !== undefined ? val.wins : 0); }
  return Number(val) || 0;
}

export function calculateLevenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  var matrix = [];
  for (var i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  for (var j = 0; j <= a.length; j++) { matrix[0][j] = j; }
  for (var i = 1; i <= b.length; i++) {
    for (var j = 1; j <= a.length; j++) {
      if (b.charAt(i-1) === a.charAt(j-1)) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, Math.min(matrix[i][j-1] + 1, matrix[i-1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}

export const compressImage = (base64Str, maxWidth = 150, maxHeight = 150, quality = 0.7) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
      } else {
        if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
      }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

export async function isValidWord(word) {
    if (!word) return false;
    try {
        const res = await fetch(`https://api.datamuse.com/words?sp=${word}&max=1`);
        if (res.ok) {
            const data = await res.json();
            return data.length > 0 && data[0].word.toUpperCase() === word.toUpperCase();
        }
    } catch (e) {
        console.warn('Word validation API failed, defaulting to accept', e);
    }
    return true; // Fallback: accept if API fails
}
