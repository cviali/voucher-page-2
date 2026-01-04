"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { formatDate } from "@/lib/utils"
import Image from "next/image"

interface Voucher {
  id: number;
  code: string;
  status: string;
  expiryDate: string;
  imageUrl: string | null;
  description: string | null;
}

export default function CustomerVouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const { user, isLoading, logout } = useAuth()

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

  if (isLoading || isFetching) return <div className="p-8">Loading...</div>
  if (!user || user.role !== 'customer') return null

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Vouchers</h1>
          <p className="text-muted-foreground">Logged in as {user.name} ({user.phoneNumber})</p>
        </div>
        <Button variant="outline" onClick={logout}>Log Out</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {vouchers.length === 0 ? (
          <p className="text-muted-foreground">You don&apos;t have any vouchers yet.</p>
        ) : (
          vouchers.map((voucher) => (
            <Card key={voucher.id} className="overflow-hidden">
              {voucher.imageUrl && (
                <div className="relative h-48 w-full">
                  <Image 
                    src={voucher.imageUrl} 
                    alt="Voucher" 
                    fill 
                    className="object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span className="font-mono">{voucher.code}</span>
                  <Badge variant={voucher.status === 'active' ? 'default' : 'secondary'}>
                    {voucher.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {voucher.description && (
                  <p className="text-sm font-medium">{voucher.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Expires: {formatDate(voucher.expiryDate)}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
