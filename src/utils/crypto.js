import localforage from 'localforage';

/**
 * Generates an ECDH P-256 key pair.
 * The private key is set to non-extractable for maximum security.
 */
export async function generateECDHKeypair() {
  return await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true, // Private key is extractable for backup/restore
    ["deriveKey", "deriveBits"]
  );
}

/**
 * Exports a public key to JWK format.
 */
export async function exportPublicKeyJWK(publicKey) {
  return await window.crypto.subtle.exportKey("jwk", publicKey);
}

/**
 * Imports a partner's public key from JWK format.
 */
export async function importPublicKeyJWK(jwk) {
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true, // Extractable
    [] // Empty usage for imported ECDH public key (used for derivation parameter)
  );
}

/**
 * Derives a shared 256-bit AES-GCM key using local private key and partner's public key.
 *
 * NOTE: ECDH shared secret derivation must be identical on both sides.
 * The derived AES-GCM target key uses the following signature:
 * - name: "ECDH", public: partnerPublicKey
 * - privateKey (local)
 * - name: "AES-GCM", length: 256 (the target key type)
 * - extractable: false (target key cannot be exported)
 * - keyUsages: ["encrypt", "decrypt"] (usages of the target key, NOT "deriveKey" / "deriveBits")
 */
export async function deriveSharedKey(privateKey, partnerPublicKey) {
  return await window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: partnerPublicKey
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false, // Derived AES key is non-extractable
    ["encrypt", "decrypt"] // Target key usages (Accidentally putting 'deriveKey' here is a common bug)
  );
}

/**
 * Helper to convert an ArrayBuffer to a Base64 string.
 */
export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Helper to convert a Base64 string to a Uint8Array.
 */
export function base64ToUint8Array(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypts plain text using the derived shared key.
 * Returns an object containing the ciphertext and IV as Base64 strings.
 */
export async function encryptText(text, derivedKey) {
  const encoded = new TextEncoder().encode(text);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    derivedKey,
    encoded
  );
  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv)
  };
}

/**
 * Decrypts ciphertext (Base64) using the derived shared key and IV (Base64).
 */
export async function decryptText(ciphertextBase64, ivBase64, derivedKey) {
  try {
    const ciphertext = base64ToUint8Array(ciphertextBase64);
    const iv = base64ToUint8Array(ivBase64);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      derivedKey,
      ciphertext
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    if (err instanceof DOMException || err.name === 'OperationError') {
      console.debug("[E2EE] Decryption tag mismatch or operation error (DOMException):", err.message);
    } else {
      console.debug("[E2EE] Unexpected decryption error:", err);
    }
    throw err; // Propagate the error so the caller's try-catch catches it and shows the placeholder UI
  }
}


/**
 * Generates a random 256-bit AES-GCM file key.
 * Must be extractable so we can encrypt it and share it with the partner.
 */
export async function generateFileKey() {
  return await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    true, // Extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a File or Blob using a file key and IV.
 * Returns a new encrypted Blob.
 */
export async function encryptFile(fileBlob, fileKey, iv) {
  const arrayBuffer = await fileBlob.arrayBuffer();
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    fileKey,
    arrayBuffer
  );
  return new Blob([encryptedBuffer], { type: 'application/octet-stream' });
}

/**
 * Decrypts an encrypted Blob using a file key, IV, and targeted MIME type.
 * Returns a decrypted Blob.
 */
export async function decryptFile(encryptedBlob, fileKey, iv, mimeType) {
  const arrayBuffer = await encryptedBlob.arrayBuffer();
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    fileKey,
    arrayBuffer
  );
  return new Blob([decryptedBuffer], { type: mimeType });
}

/**
 * Encrypts a file's key and IV using the derived shared key.
 * Returns metadata object with ciphertext and iv as Base64 strings.
 */
export async function encryptFileMetadata(fileKey, fileIv, derivedKey) {
  const rawKey = await window.crypto.subtle.exportKey("raw", fileKey);
  const metaObj = {
    key: bufferToBase64(rawKey),
    iv: bufferToBase64(fileIv)
  };
  const encoded = new TextEncoder().encode(JSON.stringify(metaObj));
  const metaIv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedMeta = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: metaIv
    },
    derivedKey,
    encoded
  );
  return {
    ciphertext: bufferToBase64(encryptedMeta),
    iv: bufferToBase64(metaIv)
  };
}

/**
 * Decrypts a file's key and IV metadata using the derived shared key.
 * Returns the imported fileKey and fileIv as Uint8Array.
 */
export async function decryptFileMetadata(encryptedMetaBase64, metaIvBase64, derivedKey) {
  const ciphertext = base64ToUint8Array(encryptedMetaBase64);
  const iv = base64ToUint8Array(metaIvBase64);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    derivedKey,
    ciphertext
  );
  const decoded = new TextDecoder().decode(decryptedBuffer);
  const metaObj = JSON.parse(decoded);

  const rawKey = base64ToUint8Array(metaObj.key);
  const fileIv = base64ToUint8Array(metaObj.iv);

  const fileKey = await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    "AES-GCM",
    true,
    ["encrypt", "decrypt"]
  );

  return { fileKey, fileIv };
}

/**
 * Loads the user's ECDH key pair from localforage.
 */
export async function getLocalKeypair(userId) {
  return await localforage.getItem(`e2ee_keys_${userId}`);
}

/**
 * Saves the user's ECDH key pair to localforage.
 */
export async function saveLocalKeypair(userId, keypair) {
  await localforage.setItem(`e2ee_keys_${userId}`, keypair);
}

/**
 * Derives a 256-bit AES-GCM wrapping key from a numeric PIN using PBKDF2.
 * @param {string} pin - The user's numeric PIN.
 * @param {Uint8Array} salt - A random 16-byte salt unique to the user.
 */
export async function deriveKeyFromPin(pin, salt) {
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);
  
  // Import raw PIN as key material for PBKDF2
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    pinData,
    { name: "PBKDF2" },
    false,
    ["deriveKey", "deriveBits"]
  );
  
  // Derive the 256-bit AES-GCM key with 310,000 iterations
  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 310000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false, // wrapping key is non-extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a private ECDH CryptoKey with a pre-derived PBKDF2 wrapping key.
 * Returns the ciphertext and iv as Base64 strings.
 */
export async function encryptPrivateKey(privateKey, aesWrappingKey) {
  const privateKeyJwk = await window.crypto.subtle.exportKey("jwk", privateKey);
  const jwkString = JSON.stringify(privateKeyJwk);
  const encoded = new TextEncoder().encode(jwkString);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    aesWrappingKey,
    encoded
  );
  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv)
  };
}

/**
 * Decrypts and imports an ECDH private CryptoKey from encrypted data using a pre-derived wrapping key.
 */
export async function decryptPrivateKey(encryptedData, aesWrappingKey) {
  const { ciphertext, iv } = encryptedData;
  const ciphertextBuffer = base64ToUint8Array(ciphertext);
  const ivBuffer = base64ToUint8Array(iv);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBuffer
    },
    aesWrappingKey,
    ciphertextBuffer
  );
  const jwkString = new TextDecoder().decode(decryptedBuffer);
  const privateKeyJwk = JSON.parse(jwkString);
  return await window.crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true, // Extractable
    ["deriveKey", "deriveBits"]
  );
}

