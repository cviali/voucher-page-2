"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { formatDate } from "@/lib/utils"
import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { Ticket, Clock, CheckCircle2 } from "lucide-react"

interface Voucher {
  id: string;
  code: string;
  status: string;
  expiryDate: string;
  imageUrl: string | null;
  description: string | null;
  claimRequestedAt: string | null;
}

export default function CustomerVouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const { user, isLoading } = useAuth()

  const fetchVouchers = useCallback(async () => {
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`/api/customer/vouchers?phoneNumber=${user?.phoneNumber || user?.username}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        const data = await res.json() as Voucher[]
        setVouchers(data)
      } else {
        toast.error("Failed to fetch vouchers")
      }
    } catch {
      toast.error("Connection error")
    } finally {
      setIsFetching(false)
    }
  }, [user])

  useEffect(() => {
    if (user && user.role === 'customer') {
      fetchVouchers()
    }
  }, [user, fetchVouchers])

  return (
    <>
      <main className="w-full max-w-[690px] p-6 space-y-6">
        {isLoading || isFetching ? (
          <div className="py-20 text-center text-muted-foreground">Loading...</div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
              <Ticket className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">You don&apos;t have any vouchers yet.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {vouchers.map((voucher, index) => {
              const isExpired = new Date(voucher.expiryDate) < new Date()
              const isUsed = voucher.status === 'claimed'
              const isInactive = isExpired || isUsed
              const isRequested = !!voucher.claimRequestedAt

              return (
                <motion.div
                  key={voucher.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link href={`/customer/vouchers/${voucher.id}`}>
                    <Card className={`overflow-hidden border-none shadow-md rounded-xl transition-all active:scale-[0.98] p-0 gap-0 ${isInactive ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                      <div className="relative aspect-video w-full">
                        {voucher.imageUrl ? (
                          <Image 
                            src={voucher.imageUrl} 
                            alt="Voucher" 
                            fill 
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                            <Ticket className="w-12 h-12 text-white/20" />
                          </div>
                        )}
                        <div className="absolute top-4 right-4">
                          <Badge className={`px-3 py-1 rounded-full border-none ${
                            isUsed ? 'bg-zinc-500' : 
                            isExpired ? 'bg-red-500' : 
                            isRequested ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}>
                            {isUsed ? 'Used' : isExpired ? 'Expired' : isRequested ? 'Pending' : 'Active'}
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="px-6 py-4 flex justify-between items-center bg-card">
                        <div className="space-y-1">
                          <h3 className="font-bold text-lg leading-tight text-foreground">
                            {voucher.code}
                          </h3>
                          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Valid until {formatDate(voucher.expiryDate)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            {isUsed ? <CheckCircle2 className="w-5 h-5 text-muted-foreground" /> : <Ticket className="w-5 h-5 text-foreground" />}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
