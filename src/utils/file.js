/**
 * Converts a Base64 string to a Blob object.
 * Useful for uploading drawing canvas data to Supabase Storage.
 */
export function base64ToBlob(base64, mimeType = 'image/png') {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
}

/**
 * Compresses an image Base64 string using a canvas.
 * Now supports image-orientation naturally in modern browsers.
 */
export const compressImage = (base64Str, maxWidth = 800, maxHeight = 800) => {
  return new Promise((resolve) => {
    const img = new Image();
    // Enable EXIF orientation handling in browsers that support it
    img.style.imageOrientation = 'from-image';
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Handle orientation-aware dimensions
      if (width > height) {
        if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
      } else {
        if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      // Modern browsers (Chrome 81+, FF 77+) handle EXIF automatically in drawImage
      // if image-orientation: from-image is set or by default.
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
  });
};
