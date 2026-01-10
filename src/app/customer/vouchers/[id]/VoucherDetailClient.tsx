"use client"

import { useEffect, useState, use } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { formatDate, getOptimizedImageUrl, formatDateTimeGMT7 } from "@/lib/utils"
import { getApiUrl } from "@/lib/api-config"
import Image from "next/image"
import { motion } from "framer-motion"
import { Clock, Info, CheckCircle2, Ticket } from "lucide-react"
import { VoucherStatusBadge } from "@/components/voucher-status-badge"

interface Voucher {
  id: string;
  code: string;
  name: string | null;
  status: string;
  expiryDate: string;
  imageUrl: string | null;
  description: string | null;
  claimRequestedAt: string | null;
  usedAt: string | null;
}

export default function VoucherDetailClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [voucher, setVoucher] = useState<Voucher | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [isRequesting, setIsRequesting] = useState(false)
  const { user, isLoading } = useAuth()

  useEffect(() => {
    const fetchVoucher = async () => {
      try {
        const token = localStorage.getItem("token")
        const res = await fetch(getApiUrl(`/customer/vouchers/${id}`), {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (res.ok) {
          const data = await res.json() as Voucher
          setVoucher(data)
        } else {
          setVoucher(null)
        }
      } catch {
        toast.error("Connection error")
      } finally {
        setIsFetching(false)
      }
    }

    if (user) fetchVoucher()
  }, [user, id])

  const handleRequestClaim = async () => {
    if (!voucher) return
    setIsRequesting(true)
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(getApiUrl(`/customer/vouchers/${voucher.id}/request-claim`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        const updated = await res.json() as Voucher
        setVoucher(updated)
        toast.success("Redeem request sent! Please show this to the cashier.")
      } else {
        toast.error("Failed to send request")
      }
    } catch {
      toast.error("Connection error")
    } finally {
      setIsRequesting(false)
    }
  }

  const isExpired = voucher ? new Date(new Date(voucher.expiryDate).getTime() + 24 * 60 * 60 * 1000) < new Date() : false
  const isUsed = voucher ? voucher.status === 'claimed' : false
  const isRequested = voucher ? !!voucher.claimRequestedAt : false
  const isInactive = isExpired || isUsed

  // Parse description into terms
  const terms = voucher?.description?.split('\n').filter(line => line.trim() !== '') || []

  return (
    <>
      <main className="w-full max-w-[690px] p-6 space-y-8">
        {isLoading || isFetching ? (
          <div className="py-20 text-center text-muted-foreground">Loading...</div>
        ) : !voucher ? (
          <div className="py-20 text-center text-muted-foreground">Voucher not found</div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-xl shadow-lg">
              {voucher.imageUrl ? (
                <Image
                  src={getOptimizedImageUrl(voucher.imageUrl, 1000)}
                  alt="Voucher"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                  <Ticket className="w-16 h-16 text-white/10" />
                </div>
              )}
              <div className="absolute top-4 right-4">
                <VoucherStatusBadge
                  status={voucher.status}
                  expiryDate={voucher.expiryDate}
                  claimRequestedAt={voucher.claimRequestedAt}
                  className="px-3 py-1 rounded-full border-none text-xs font-semibold shadow-lg"
                />
              </div>
            </div>

            <div className="space-y-6 font-gotham">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{voucher.name || 'Voucher'}</h1>
                <h2 className="text-xl font-mono font-medium text-muted-foreground">{voucher.code}</h2>
                <div className="flex items-center gap-2 text-muted-foreground pt-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">Valid until {formatDate(voucher.expiryDate)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Info className="w-5 h-5" />
                  <h3 className="font-bold">Terms & Conditions</h3>
                </div>
                <ul className="space-y-1">
                  {terms.map((term, index) => (
                    <li key={index} className="flex gap-3 text-sm text-muted-foreground leading-relaxed">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      {term}
                    </li>
                  ))}
                  {terms.length === 0 && (
                    <li className="text-muted-foreground italic text-sm">No specific terms provided.</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="pt-4">
              {!isInactive && !isRequested && (
                <Button
                  className="w-full h-14 text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-lg"
                  onClick={handleRequestClaim}
                  disabled={isRequesting}
                >
                  {isRequesting ? 'Processing...' : 'Redeem Now'}
                </Button>
              )}

              {isRequested && !isUsed && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex gap-4">
                  <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-100">Redemption Requested</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                      Please show this screen to the cashier to complete your redemption.
                    </p>
                  </div>
                </div>
              )}

              {isUsed && (
                <div className="flex flex-col items-center justify-center gap-3 bg-muted p-8 rounded-xl text-muted-foreground border-2 border-dashed">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <span className="text-lg font-bold text-foreground">Voucher Redeemed</span>
                  </div>
                  <div className="text-center space-x-1">
                    <span className="text-sm tracking-wider">Redemption Time:</span>
                    <span className="text-sm ml-1">
                      {formatDateTimeGMT7(voucher.usedAt)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>
    </>
  )
}
