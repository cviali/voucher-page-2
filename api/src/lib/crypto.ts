// Native Password Hashing using PBKDF2 (Native WebCrypto)
export const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyBuffer = encoder.encode(password);

    const baseKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        256
    );

    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(new Uint8Array(derivedKey)).map(b => b.toString(16).padStart(2, '0')).join('');

    return `v1:${saltHex}:${hashHex}`;
};

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
    if (!storedHash) return false;

    if (storedHash.startsWith('$2')) {
        console.warn('Legacy bcrypt hash detected. Password must be reset.');
        return false;
    }

    const parts = storedHash.split(':');
    if (parts.length !== 3 || parts[0] !== 'v1') return false;

    const saltHex = parts[1];
    const storedHashHex = parts[2];

    const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const encoder = new TextEncoder();
    const keyBuffer = encoder.encode(password);

    const baseKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        256
    );

    const hashHex = Array.from(new Uint8Array(derivedKey)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === storedHashHex;
};
