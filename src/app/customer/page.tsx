"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { motion } from "framer-motion"

export default function CustomerHomePage() {
  const { user, isLoading, logout } = useAuth()
  const [isFlipped, setIsFlipped] = useState(false)

  if (isLoading) return <div className="p-8 text-center">Loading...</div>
  if (!user || user.role !== 'customer') return null

  return (
    <>
      <main className="w-full max-w-[690px] p-6 space-y-6 flex flex-col items-center">
        {/* Membership Card Container */}
        <div className="relative w-full max-w-[350px] aspect-[1.6/1] perspective-1000 cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
          <motion.div
            className="w-full h-full relative preserve-3d"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          >
            {/* Front of Card (Details) */}
            <div className="absolute inset-0 backface-hidden">
              <Card className="w-full h-full bg-zinc-800 text-white p-6 flex flex-col justify-between border-none shadow-xl rounded-xl">
                <div className="space-y-3">
                  <div className="space-y-0.5">
                    <p className="text-zinc-400 text-[9px] uppercase tracking-widest">Member Name</p>
                    <p className="text-base font-medium">{user.name}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-zinc-400 text-[9px] uppercase tracking-widest">Membership Number</p>
                    <p className="text-base font-mono tracking-wider">{user.phoneNumber}</p>
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <div className="space-y-0.5">
                    <p className="text-zinc-400 text-[9px] uppercase tracking-widest">Valid Until</p>
                    <p className="text-xs">31 Dec 2026</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border-2 border-white/20" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Back of Card (Logo) */}
            <div className="absolute inset-0 backface-hidden rotate-y-180">
              <Card className="w-full h-full bg-zinc-900 text-white overflow-hidden relative border-none shadow-xl rounded-xl">
                <div className="absolute top-0 right-0 p-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full border-2 border-white/20" />
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 p-6 space-y-1">
                  <p className="text-zinc-400 text-[10px] uppercase tracking-[0.2em]">Membership Card</p>
                  <h2 className="text-xl font-bold tracking-tight">Voucher App</h2>
                </div>
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                  <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-white blur-3xl" />
                </div>
              </Card>
            </div>
          </motion.div>
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">Tap the card to flip</p>
        </div>

        {/* Navigation Button */}
        <div className="w-full space-y-3">
          <Link href="/customer/vouchers" className="block w-full">
            <Button className="w-full h-14 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-lg">
              My Vouchers
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            className="w-full h-12 text-muted-foreground hover:text-foreground" 
            onClick={logout}
          >
            Log Out
          </Button>
        </div>
      </main>

      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </>
  )
}
