"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { formatDate, getOptimizedImageUrl } from "@/lib/utils"
import { getApiUrl } from "@/lib/api-config"
import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { Ticket, Clock, Loader2 } from "lucide-react"
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
}

export default function CustomerVouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const { user, logout, isLoading } = useAuth()

  const fetchVouchers = useCallback(async (pageNum: number, isInitial: boolean = false) => {
    if (isInitial) setIsFetching(true)
    else setIsLoadingMore(true)

    try {
      const token = localStorage.getItem("token")
      const res = await fetch(
        getApiUrl(`/customer/vouchers?phoneNumber=${user?.phoneNumber || user?.username}&page=${pageNum}&limit=4`),
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (res.status === 401) {
        logout()
        return
      }

      if (res.ok) {
        const result = (await res.json()) as {
          data: Voucher[]
          totalPages: number
          page: number
        }

        if (isInitial) {
          setVouchers(result.data || [])
        } else {
          setVouchers(prev => [...(prev || []), ...(result.data || [])])
        }

        setHasMore(result.page < result.totalPages)
      } else {
        toast.error("Failed to fetch vouchers")
      }
    } catch {
      toast.error("Connection error")
    } finally {
      setIsFetching(false)
      setIsLoadingMore(false)
    }
  }, [user, logout])

  useEffect(() => {
    if (user && user.role === 'customer') {
      fetchVouchers(1, true)
    }
  }, [user, fetchVouchers])

  const loadMore = () => {
    if (hasMore && !isLoadingMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchVouchers(nextPage)
    }
  }

  return (
    <>
      <main className="w-full max-w-[690px] p-6 space-y-6">
        {isLoading || isFetching ? (
          <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p>Gathering your rewards...</p>
          </div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
              <Ticket className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">You don&apos;t have any vouchers yet.</p>
          </div>
        ) : (
          <div className="grid gap-8">
            {vouchers.map((voucher, index) => {
              const expiryDate = new Date(voucher.expiryDate)
              // Valid until the end of the expiry day (next day 00:00)
              const isExpired = new Date(expiryDate.getTime() + 24 * 60 * 60 * 1000) < new Date()
              const isUsed = voucher.status === 'claimed'
              const isInactive = isExpired || isUsed

              return (
                <motion.div
                  key={voucher.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (index % 4) * 0.1 }}
                >
                  <Link
                    href={isExpired ? "#" : `/customer/vouchers/${voucher.id}`}
                    onClick={(e) => isExpired && e.preventDefault()}
                    className={isExpired ? "cursor-default block" : "block"}
                  >
                    <Card className={`relative overflow-hidden border shadow-lg transition-all ${!isExpired ? 'active:scale-[0.98]' : ''} p-0 gap-0 group ${isInactive ? 'opacity-75 grayscale-[0.3]' : ''}`}>
                      <div className="relative aspect-video w-full overflow-hidden">
                        {voucher.imageUrl ? (
                          <Image
                            src={getOptimizedImageUrl(voucher.imageUrl, 600)}
                            alt={voucher.name || "Voucher"}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                            <Ticket className="w-16 h-16 text-white/10" />
                          </div>
                        )}

                        {/* Status Overlay */}
                        <div className="absolute top-4 right-4 z-10">
                          <VoucherStatusBadge
                            status={voucher.status}
                            expiryDate={voucher.expiryDate}
                            claimRequestedAt={voucher.claimRequestedAt}
                            className={`px-4 py-1.5 rounded-full border-2 border-white/20 shadow-lg backdrop-blur-md`}
                          />
                        </div>

                        {/* Bottom Gradient for Name */}
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-4 left-6 right-6">
                          <h2 className="text-white font-bold text-xl drop-shadow-md truncate">
                            {voucher.name || "Special Offer"}
                          </h2>
                        </div>
                      </div>

                      <CardContent className="px-6 py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">Voucher Code</span>
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                          </div>
                          <h3 className="font-mono text-2xl font-bold tracking-tighter text-foreground">
                            {voucher.code}
                          </h3>
                        </div>

                        <div className="flex flex-col items-start sm:items-end gap-1">
                          <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium">
                            <Clock className="w-4 h-4" />
                            <span>Expires {formatDate(voucher.expiryDate)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              )
            })}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="px-8 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isLoadingMore ? 'LOADING...' : 'SHOW MORE VOUCHERS'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}
