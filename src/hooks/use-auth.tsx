"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { jwtDecode } from "jwt-decode"
import { toast } from "sonner"

interface User {
  username: string
  phoneNumber?: string
  role: 'admin' | 'cashier' | 'customer'
  name: string
}

interface AuthContextType {
  user: User | null
  login: (token: string, user: User, redirectTo?: string) => void
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const logout = useCallback((showToast: boolean | unknown = false) => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setUser(null)
    if (showToast === true) {
      toast.error("Session expired. Please login again.")
    }
    
    // Determine which login page to go to based on current path
    if (pathname.startsWith("/customer")) {
      router.push("/customer/login")
    } else {
      router.push("/login")
    }
  }, [pathname, router])

  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    const token = localStorage.getItem("token")

    if (storedUser && token) {
      try {
        const decoded = jwtDecode<{ exp: number }>(token)
        const currentTime = Date.now() / 1000

        if (decoded.exp < currentTime) {
          logout(true)
          return
        }

        const userObj = JSON.parse(storedUser)
        setUser(userObj)
        
        // If user is logged in and tries to access login page, redirect to dashboard/vouchers
        if (pathname.includes("/login")) {
          if (userObj.role === 'customer') {
            router.push("/customer")
          } else {
            router.push("/dashboard")
          }
        }
      } catch {
        logout()
      }
    } else {
      // Only redirect if we're trying to access a protected route
      const isProtectedRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/customer/vouchers") || pathname === "/customer"
      const isLoginPage = pathname.includes("/login")
      
      if (isProtectedRoute && !isLoginPage) {
        if (pathname.startsWith("/customer")) {
          router.push(`/customer/login?redirect=${encodeURIComponent(pathname)}`)
        } else {
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
        }
      }
    }
    setIsLoading(false)
  }, [pathname, router, logout])

  const login = (token: string, user: User, redirectTo?: string) => {
    localStorage.setItem("token", token)
    localStorage.setItem("user", JSON.stringify(user))
    setUser(user)
    
    if (redirectTo) {
      router.push(redirectTo)
      return
    }

    if (user.role === 'customer') {
      router.push("/customer")
    } else {
      router.push("/dashboard")
    }
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
