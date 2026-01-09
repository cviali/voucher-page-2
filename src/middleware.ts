import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const path = request.nextUrl.pathname.replace(/^\/api/, '')
    const searchParams = request.nextUrl.search
    const destination = `https://voucher-api.christian-d59.workers.dev${path}${searchParams}`
    
    return NextResponse.rewrite(new URL(destination))
  }
}

export const config = {
  matcher: '/api/:path*',
}
