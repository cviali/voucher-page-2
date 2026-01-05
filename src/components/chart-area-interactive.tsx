"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "An interactive area chart"

const chartData = [
  { date: "2024-04-01", binds: 222, claims: 150 },
  { date: "2024-04-02", binds: 97, claims: 180 },
  { date: "2024-04-03", binds: 167, claims: 120 },
  { date: "2024-04-04", binds: 242, claims: 260 },
  { date: "2024-04-05", binds: 373, claims: 290 },
  { date: "2024-04-06", binds: 301, claims: 340 },
  { date: "2024-04-07", binds: 245, claims: 180 },
  { date: "2024-04-08", binds: 409, claims: 320 },
  { date: "2024-04-09", binds: 59, claims: 110 },
  { date: "2024-04-10", binds: 261, claims: 190 },
  { date: "2024-04-11", binds: 327, claims: 350 },
  { date: "2024-04-12", binds: 292, claims: 210 },
  { date: "2024-04-13", binds: 342, claims: 380 },
  { date: "2024-04-14", binds: 137, claims: 220 },
  { date: "2024-04-15", binds: 120, claims: 170 },
  { date: "2024-04-16", binds: 138, claims: 190 },
  { date: "2024-04-17", binds: 446, claims: 360 },
  { date: "2024-04-18", binds: 364, claims: 410 },
  { date: "2024-04-19", binds: 243, claims: 180 },
  { date: "2024-04-20", binds: 89, claims: 150 },
  { date: "2024-04-21", binds: 137, claims: 200 },
  { date: "2024-04-22", binds: 224, claims: 170 },
  { date: "2024-04-23", binds: 138, claims: 230 },
  { date: "2024-04-24", binds: 387, claims: 290 },
  { date: "2024-04-25", binds: 215, claims: 250 },
  { date: "2024-04-26", binds: 75, claims: 130 },
  { date: "2024-04-27", binds: 383, claims: 420 },
  { date: "2024-04-28", binds: 122, claims: 180 },
  { date: "2024-04-29", binds: 315, claims: 240 },
  { date: "2024-04-30", binds: 454, claims: 380 },
  { date: "2024-05-01", binds: 165, claims: 220 },
  { date: "2024-05-02", binds: 293, claims: 310 },
  { date: "2024-05-03", binds: 247, claims: 190 },
  { date: "2024-05-04", binds: 385, claims: 420 },
  { date: "2024-05-05", binds: 481, claims: 390 },
  { date: "2024-05-06", binds: 498, claims: 520 },
  { date: "2024-05-07", binds: 388, claims: 300 },
  { date: "2024-05-08", binds: 149, claims: 210 },
  { date: "2024-05-09", binds: 227, claims: 180 },
  { date: "2024-05-10", binds: 293, claims: 330 },
  { date: "2024-05-11", binds: 335, claims: 270 },
  { date: "2024-05-12", binds: 197, claims: 240 },
  { date: "2024-05-13", binds: 197, claims: 160 },
  { date: "2024-05-14", binds: 448, claims: 490 },
  { date: "2024-05-15", binds: 473, claims: 380 },
  { date: "2024-05-16", binds: 338, claims: 400 },
  { date: "2024-05-17", binds: 499, claims: 420 },
  { date: "2024-05-18", binds: 315, claims: 350 },
  { date: "2024-05-19", binds: 235, claims: 180 },
  { date: "2024-05-20", binds: 177, claims: 230 },
  { date: "2024-05-21", binds: 82, claims: 140 },
  { date: "2024-05-22", binds: 81, claims: 120 },
  { date: "2024-05-23", binds: 252, claims: 290 },
  { date: "2024-05-24", binds: 294, claims: 220 },
  { date: "2024-05-25", binds: 201, claims: 250 },
  { date: "2024-05-26", binds: 213, claims: 170 },
  { date: "2024-05-27", binds: 420, claims: 460 },
  { date: "2024-05-28", binds: 233, claims: 190 },
  { date: "2024-05-29", binds: 78, claims: 130 },
  { date: "2024-05-30", binds: 340, claims: 280 },
  { date: "2024-05-31", binds: 178, claims: 230 },
  { date: "2024-06-01", binds: 178, claims: 200 },
  { date: "2024-06-02", binds: 470, claims: 410 },
  { date: "2024-06-03", binds: 103, claims: 160 },
  { date: "2024-06-04", binds: 439, claims: 380 },
  { date: "2024-06-05", binds: 88, claims: 140 },
  { date: "2024-06-06", binds: 294, claims: 250 },
  { date: "2024-06-07", binds: 323, claims: 370 },
  { date: "2024-06-08", binds: 385, claims: 320 },
  { date: "2024-06-09", binds: 438, claims: 480 },
  { date: "2024-06-10", binds: 155, claims: 200 },
  { date: "2024-06-11", binds: 92, claims: 150 },
  { date: "2024-06-12", binds: 492, claims: 420 },
  { date: "2024-06-13", binds: 81, claims: 130 },
  { date: "2024-06-14", binds: 426, claims: 380 },
  { date: "2024-06-15", binds: 307, claims: 350 },
  { date: "2024-06-16", binds: 371, claims: 310 },
  { date: "2024-06-17", binds: 475, claims: 520 },
  { date: "2024-06-18", binds: 107, claims: 170 },
  { date: "2024-06-19", binds: 341, claims: 290 },
  { date: "2024-06-20", binds: 408, claims: 450 },
  { date: "2024-06-21", binds: 169, claims: 210 },
  { date: "2024-06-22", binds: 317, claims: 270 },
  { date: "2024-06-23", binds: 480, claims: 530 },
  { date: "2024-06-24", binds: 132, claims: 180 },
  { date: "2024-06-25", binds: 141, claims: 190 },
  { date: "2024-06-26", binds: 434, claims: 380 },
  { date: "2024-06-27", binds: 448, claims: 490 },
  { date: "2024-06-28", binds: 149, claims: 200 },
  { date: "2024-06-29", binds: 103, claims: 160 },
  { date: "2024-06-30", binds: 446, claims: 400 },
]

const chartConfig = {
  vouchers: {
    label: "Vouchers",
  },
  binds: {
    label: "Binds",
    color: "hsl(var(--chart-1))",
  },
  claims: {
    label: "Claims",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const filteredData = chartData.map(d => ({
    date: d.date,
    binds: d.binds,
    claims: d.claims,
  })).filter((item) => {
    const date = new Date(item.date)
    const referenceDate = new Date("2024-06-30")
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Voucher Activity</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Total binds and claims for the last 3 months
          </span>
          <span className="@[540px]/card:hidden">Last 3 months</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillBinds" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-binds)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-binds)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillClaims" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-claims)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-claims)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="claims"
              type="natural"
              fill="url(#fillClaims)"
              stroke="var(--color-claims)"
              stackId="a"
            />
            <Area
              dataKey="binds"
              type="natural"
              fill="url(#fillBinds)"
              stroke="var(--color-binds)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
