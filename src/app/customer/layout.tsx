"use client"

import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  // Don't show navbar on login page
  if (pathname === "/customer/login") {
    return <>{children}</>
  }

  let title = "My Membership"
  let backHref = ""

  if (pathname === "/customer/vouchers") {
    title = "My Vouchers"
    backHref = "/customer"
  } else if (pathname.startsWith("/customer/vouchers/")) {
    title = "Voucher Details"
    backHref = "/customer/vouchers"
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <nav className="w-full bg-card border-b flex justify-center sticky top-0 z-30">
        <div className="w-full px-6 py-4 flex items-center relative">
          {backHref && (
            <Link href={backHref} className="absolute left-6">
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
          )}
          <h1 className="text-xl font-bold tracking-tight mx-auto">{title}</h1>
        </div>
      </nav>
      {children}
    </div>
  )
}
