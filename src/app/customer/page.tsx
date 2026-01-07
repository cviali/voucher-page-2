"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";

export default function CustomerHomePage() {
  const { user, isLoading, logout } = useAuth();
  const [isFlipped, setIsFlipped] = useState(false);

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!user || user.role !== "customer") return null;

  return (
    <>
      <main className="w-full max-w-[690px] p-6 space-y-6 flex flex-col items-center">
        {/* Membership Card Container */}
        <div
          className="relative w-full max-w-[400px] aspect-[1.586/1] perspective-1000 cursor-pointer"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <motion.div
            className="w-full h-full relative preserve-3d"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          >
            {/* Front of Card (SVG Background) */}
            <div className="absolute inset-0 backface-hidden ring-1 ring-border rounded-xl shadow-2xl overflow-hidden">
              <Image
                src="/card-back.svg"
                alt="Membership Card Front"
                fill
                className="object-cover"
                priority
              />
              <div className="relative z-10 w-full h-full p-5 flex flex-col justify-between font-gotham">
                <div className="gap-y-2 flex flex-col">
                  {/* Member Name Section */}
                  <div className="space-y-0.2">
                    <p className="text-brand-orange text-[8.5px] font-semibold uppercase tracking-wider">
                      MEMBER NAME
                    </p>
                    <p className="text-md font-semibold text-white truncate leading-tight">
                      {user.name?.toUpperCase() || "MEMBER"}
                    </p>
                  </div>

                  {/* Membership Number Section */}
                  <div className="space-y-0.2">
                    <p className="text-brand-orange text-[8.5px] font-semibold uppercase tracking-wider">
                      MEMBERSHIP NUMBER
                    </p>
                    <p className="text-md font-semibold text-white truncate leading-tight">
                      {user.phoneNumber}
                    </p>
                  </div>
                </div>
                {/* Valid Until Section - Bottom Left */}
                <div className="space-y-0.2">
                  <p className="text-brand-orange text-[8px] font-bold uppercase tracking-wider">
                    VALID UNTIL
                  </p>
                  <p className="text-sm font-semibold text-white leading-tight">
                    31 Dec 2026
                  </p>
                </div>
              </div>
            </div>

            {/* Back of Card (SVG Background) */}
            <div
              className="absolute inset-0 backface-hidden rounded-xl shadow-2xl overflow-hidden"
              style={{ transform: "rotateY(180deg)" }}
            >
              <Image
                src="/card-front.svg"
                alt="Membership Card Back"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/10" />
              <div className="relative z-10 w-full h-full flex items-center justify-center p-12">
                <div className="w-full aspect-square relative opacity-20">
                  {/* Logo or pattern could go here */}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            Tap to flip card
          </p>
        </div>

        {/* Navigation Button */}
        <div className="w-full space-y-4 pt-6">
          <Link href="/customer/vouchers" className="block w-full">
            <Button className="w-full h-14 text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-lg transition-transform active:scale-[0.98]">
              MY VOUCHERS
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="w-full h-12 text-muted-foreground hover:text-foreground font-medium"
            onClick={logout}
          >
            LOG OUT
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
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
        }
      `}</style>
    </>
  );
}
