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
  const defaultImage = `${siteUrl}/og-image.png`

  try {
    // We use the public endpoint for metadata so it works for crawlers
    const res = await fetch(`${apiUrl}/vouchers/public/${id}`, { 
      next: { revalidate: 3600 },
      headers: { 'Accept': 'application/json' }
    })
    
    if (res.ok) {
      const voucher = await res.json() as { name?: string; imageUrl?: string }
      
      const title = voucher.name || defaultTitle
      
      // Ensure image URL is absolute for OG tags
      // The user confirmed the path format: https://voucher-page.christian-d59.workers.dev/api/vouchers/image/...
      let absoluteImageUrl = voucher.imageUrl
      if (absoluteImageUrl) {
        if (!absoluteImageUrl.startsWith('http')) {
          const separator = absoluteImageUrl.startsWith('/') ? '' : '/'
          absoluteImageUrl = `${siteUrl}${separator}${absoluteImageUrl}`
        }
      } else {
        absoluteImageUrl = defaultImage
      }

      return {
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
            alt: title,
          }],
          type: 'website',
          url: `${siteUrl}/customer/vouchers/${id}`,
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
    title: defaultTitle,
    description: defaultDescription,
    openGraph: {
      title: defaultTitle,
      description: defaultDescription,
      images: [{
        url: defaultImage,
        width: 1200,
        height: 630,
      }],
    }
  }
}

export default async function Page({ params }: Props) {
  return <VoucherDetailClient params={params} />
}
