"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

interface User {
  username: string
  phoneNumber?: string
  role: 'admin' | 'cashier' | 'customer'
  name: string
}

interface AuthContextType {
  user: User | null
  login: (token: string, user: User) => void
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    const token = localStorage.getItem("token")

    if (storedUser && token) {
      const userObj = JSON.parse(storedUser)
      setUser(userObj)
      
      // If user is logged in and tries to access login page, redirect to dashboard/vouchers
      if (pathname.includes("/login")) {
        if (userObj.role === 'customer') {
          router.push("/customer/vouchers")
        } else {
          router.push("/dashboard")
        }
      }
    } else {
      // Only redirect if we're trying to access a protected route
      const isProtectedRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/customer/vouchers")
      const isLoginPage = pathname.includes("/login")
      
      if (isProtectedRoute && !isLoginPage) {
        if (pathname.startsWith("/customer")) {
          router.push("/customer/login")
        } else {
          router.push("/login")
        }
      }
    }
    setIsLoading(false)
  }, [pathname, router])

  const login = (token: string, user: User) => {
    localStorage.setItem("token", token)
    localStorage.setItem("user", JSON.stringify(user))
    setUser(user)
    if (user.role === 'customer') {
      router.push("/customer/vouchers")
    } else {
      router.push("/dashboard")
    }
  }

  const logout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setUser(null)
    router.push("/")
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
