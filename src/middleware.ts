import type { NextRequest } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const { env } = getCloudflareContext()
    
    // Create a new URL for the internal request
    const url = new URL(request.url)
    url.pathname = url.pathname.replace(/^\/api/, '')
    
    // Forward the request to the API service binding
    // This is much faster as it stays internal to Cloudflare
    return env.API.fetch(new Request(url.toString(), request))
  }
}

export const config = {
  matcher: '/api/:path*',
}
