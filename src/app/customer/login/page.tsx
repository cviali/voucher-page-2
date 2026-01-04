"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export default function CustomerLoginPage() {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [dob, setDob] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    
    // Convert DD/MM/YYYY to YYYY-MM-DD for backend
    let formattedDob = dob
    if (dob.includes('/')) {
      const [day, month, year] = dob.split('/')
      if (day && month && year) {
        formattedDob = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
    }

    try {
      const res = await fetch('/api/auth/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, dateOfBirth: formattedDob })
      })
      
      const data = await res.json() as { token: string; user: { username: string; phoneNumber: string; role: 'admin' | 'cashier' | 'customer'; name: string }; error?: string }
      
      if (res.ok) {
        login(data.token, data.user)
      } else {
        setError(data.error || "Invalid phone number or date of birth")
      }
    } catch {
      setError("Failed to connect to server")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/50">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Customer Login</CardTitle>
          <CardDescription>Enter your phone number and date of birth.</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex gap-2">
                <div className="flex items-center justify-center px-3 rounded-md border bg-muted text-muted-foreground text-sm font-medium">
                  +62
                </div>
                <Input 
                  id="phone" 
                  placeholder="85812345678" 
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input 
                id="dob" 
                placeholder="DD/MM/YYYY"
                value={dob}
                onChange={(e) => {
                  let val = e.target.value.replace(/\D/g, '')
                  if (val.length > 2 && val.length <= 4) {
                    val = val.slice(0, 2) + '/' + val.slice(2)
                  } else if (val.length > 4) {
                    val = val.slice(0, 2) + '/' + val.slice(2, 4) + '/' + val.slice(4, 8)
                  }
                  setDob(val)
                }}
                required 
              />
            </div>
          </CardContent>
          <CardFooter className="mt-5">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              View My Vouchers
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
