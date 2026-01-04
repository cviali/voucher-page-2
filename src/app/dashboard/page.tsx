"use client"

import { useAuth } from "@/hooks/use-auth"

export default function Page() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <div>Loading...</div>
  if (!user) return null

  return (
    <div className="flex flex-1 flex-col p-8">
      <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
      <p className="text-muted-foreground">Role: {user.role}</p>
      
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {user.role === 'admin' && (
          <div className="p-6 border rounded-lg bg-card">
            <h2 className="font-semibold">Admin Overview</h2>
            <p className="text-sm text-muted-foreground">Manage all vouchers and staff members.</p>
          </div>
        )}
        {user.role === 'cashier' && (
          <div className="p-6 border rounded-lg bg-card">
            <h2 className="font-semibold">Cashier Tools</h2>
            <p className="text-sm text-muted-foreground">Bind vouchers to customer phone numbers.</p>
          </div>
        )}
      </div>
    </div>
  )
}
