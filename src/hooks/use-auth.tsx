"use client"

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { jwtDecode } from "jwt-decode"
import { toast } from "sonner"
import { isAuthorized, Role } from "@/lib/routes"

interface User {
  username: string
  phoneNumber?: string
  role: Role
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
    const currentPath = window.location.pathname
    if (currentPath.startsWith("/dashboard") || currentPath.startsWith("/admin")) {
      router.push("/admin/login")
    } else {
      router.push("/login")
    }
  }, [router])

  // Initial load: Check if user is already logged in
  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    const token = localStorage.getItem("token")

    if (storedUser && token) {
      try {
        const decoded = jwtDecode<{ exp: number }>(token)
        const currentTime = Date.now() / 1000

        if (decoded.exp < currentTime) {
          logout(true)
        } else {
          const userObj = JSON.parse(storedUser)
          // Use functional update to avoid unnecessary re-renders if the user object is deep-equal
          setUser(prev => {
            if (JSON.stringify(prev) === JSON.stringify(userObj)) return prev
            return userObj
          })
        }
      } catch {
        logout()
      }
    }
    setIsLoading(false)
  }, [logout])

  // Handle redirects on pathname changes
  useEffect(() => {
    if (isLoading) return

    const isLoginPage = pathname === "/login" || pathname === "/admin/login"
    const isProtectedRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/customer")

    if (user) {
      if (isLoginPage) {
        // If there's a redirect parameter in the URL, don't automatically redirect to default home
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.has("redirect")) return;

        if (user.role === 'customer') {
          router.push("/customer")
        } else {
          router.push("/dashboard")
        }
      } else {
        // Use single source of truth for authorization
        if (!isAuthorized(user.role, pathname)) {
          if (user.role === 'customer') {
            router.push("/customer")
          } else {
            router.push("/dashboard")
            toast.error("You don't have permission to access that page")
          }
        }
      }
    } else {
      if (isProtectedRoute && !isLoginPage) {
        if (pathname.startsWith("/dashboard")) {
          router.push(`/admin/login?redirect=${encodeURIComponent(pathname)}`)
        } else {
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
        }
      }
    }
  }, [pathname, user, router, isLoading])

  const login = useCallback((token: string, user: User, redirectTo?: string) => {
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
  }, [router])

  const value = useMemo(() => ({
    user,
    login,
    logout,
    isLoading
  }), [user, login, logout, isLoading])

  return (
    <AuthContext.Provider value={value}>
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
