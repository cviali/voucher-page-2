export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tch-api.vlocityarena.com';

export const getApiUrl = (path: string) => {
    // If it's already an absolute URL, return it
    if (path.startsWith('http')) return path;

    // Ensure path starts with a slash
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    // Use API_BASE_URL if available
    const cleanBase = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;

    // Remove /api prefix if it exists in the path, as we're moving away from the old proxy
    let finalPath = cleanPath;
    if (finalPath.startsWith('/api/')) {
        finalPath = finalPath.slice(4);
    }

    return `${cleanBase}${finalPath}`;
};
