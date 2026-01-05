import { IconTicket, IconUsers, IconCheck, IconClock } from "@tabler/icons-react"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface DashboardStatsProps {
  stats: {
    vouchers: {
      total: number
      available: number
      active: number
      claimed: number
    }
    customers: {
      total: number
    }
  }
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-x-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Vouchers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.vouchers.total}
          </CardTitle>
          <CardAction>
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <IconTicket size={20} />
            </div>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            All vouchers in the system
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Vouchers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.vouchers.active}
          </CardTitle>
          <CardAction>
            <div className="p-2 bg-blue-500/10 rounded-full text-blue-500">
              <IconClock size={20} />
            </div>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Currently held by customers
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Claimed Vouchers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.vouchers.claimed}
          </CardTitle>
          <CardAction>
            <div className="p-2 bg-green-500/10 rounded-full text-green-500">
              <IconCheck size={20} />
            </div>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Successfully redeemed
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Customers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.customers.total}
          </CardTitle>
          <CardAction>
            <div className="p-2 bg-purple-500/10 rounded-full text-purple-500">
              <IconUsers size={20} />
            </div>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Registered customer base
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
