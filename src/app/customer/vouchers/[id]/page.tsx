import { Metadata } from "next"
import VoucherDetailClient from "./VoucherDetailClient"

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const siteUrl = 'https://voucher-page.christian-d59.workers.dev'
  const apiUrl = 'https://voucher-api.christian-d59.workers.dev'
  
  // Default metadata
  const defaultTitle = 'Exclusive Voucher'
  const defaultDescription = 'View your voucher details and redeem your reward.'

  try {
    // We use the public endpoint for metadata so it works for crawlers
    const res = await fetch(`${apiUrl}/vouchers/public/${id}`, { 
      next: { revalidate: 3600 },
      headers: { 'Accept': 'application/json' }
    })
    
    if (res.ok) {
      const voucher = await res.json() as { name?: string; imageUrl?: string }
      
      const title = voucher.name || defaultTitle
      
      // For WhatsApp/Social media, use the direct API URL to avoid rewrites
      let absoluteImageUrl = voucher.imageUrl
      if (absoluteImageUrl) {
        if (!absoluteImageUrl.startsWith('http')) {
          // If it's a relative path like /api/vouchers/image/..., 
          // extract the part after /api/ and append it to apiUrl
          const pathAfterApi = absoluteImageUrl.startsWith('/api/') 
            ? absoluteImageUrl.substring(4) 
            : absoluteImageUrl.startsWith('api/') 
              ? `/${absoluteImageUrl.substring(3)}` 
              : absoluteImageUrl
          
          absoluteImageUrl = `${apiUrl}${pathAfterApi.startsWith('/') ? '' : '/'}${pathAfterApi}`
        }
      } else {
        // Fallback to a safe default if no image (though siteUrl/favicon.svg is an SVG, WhatsApp likes JPEGs)
        // Suggestion: if you have a branded og-image.jpg, use it here.
        absoluteImageUrl = `${siteUrl}/favicon.svg`
      }

      return {
        metadataBase: new URL(siteUrl),
        title: title,
        description: defaultDescription,
        openGraph: {
          title: title,
          description: defaultDescription,
          siteName: 'Voucher Portal',
          images: [{
            url: absoluteImageUrl,
            width: 1200,
            height: 630,
            type: 'image/jpeg', // WhatsApp prefers types to be stated
          }],
          type: 'website',
          url: `/customer/vouchers/${id}`,
        },
        twitter: {
          card: 'summary_large_image',
          title: title,
          description: defaultDescription,
          images: [absoluteImageUrl],
        }
      }
    }
  } catch (error) {
    console.error('Error fetching metadata:', error)
  }

  return {
    metadataBase: new URL(siteUrl),
    title: defaultTitle,
    description: defaultDescription,
  }
}

export default async function Page({ params }: Props) {
  return <VoucherDetailClient params={params} />
}
