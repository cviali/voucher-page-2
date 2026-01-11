"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "sonner"

interface DatePickerWithRangeProps extends React.HTMLAttributes<HTMLDivElement> {
    date: DateRange | undefined
    setDate: (date: DateRange | undefined) => void
}

export function DatePickerWithRange({
    className,
    date,
    setDate,
}: DatePickerWithRangeProps) {
    const [open, setOpen] = React.useState(false)
    const [internalDate, setInternalDate] = React.useState<DateRange | undefined>(date)

    // Sync internal state if external date changes (e.g. from parent reset)
    React.useEffect(() => {
        setInternalDate(date)
    }, [date])

    const handleSelect = (range: DateRange | undefined) => {
        const wasComplete = !!(internalDate?.from && internalDate?.to)

        // 1. Double click same date: deselects in RDP, so we catch it and make it a single-day range
        if (!range && internalDate?.from && !internalDate.to) {
            const singleDay = { from: internalDate.from, to: internalDate.from }
            setInternalDate(singleDay)
            setDate(singleDay)
            setOpen(false)
            return
        }

        if (!range) {
            setInternalDate(undefined)
            return
        }

        // 2. If we had a complete range and user clicks any date, start a fresh range selection
        if (wasComplete) {
            setInternalDate({ from: range.from, to: undefined })
            // DO NOT call setDate here
            return
        }

        // 3. First click of a range: range.to will be undefined
        if (range.from && !range.to) {
            setInternalDate(range)
            // DO NOT call setDate here
            return
        }

        // 4. Second click of a range: range.to is now defined
        if (range.from && range.to) {
            // If the user selects a date earlier than the first one, 
            // reset the flow and make the new date the first selection
            if (internalDate?.from && !internalDate.to && range.from.getTime() !== internalDate.from.getTime()) {
                setInternalDate({ from: range.from, to: undefined })
                return
            }

            const days = differenceInDays(range.to, range.from)
            if (Math.abs(days) > 30) {
                toast.error("Maximum range is 30 days")
                setInternalDate({ from: range.from, to: undefined })
                return
            }
            setInternalDate(range)
            setDate(range)
            setOpen(false)
            return
        }

        setInternalDate(range)
    }

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "justify-start text-left font-normal h-9 px-3",
                            !internalDate && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {internalDate?.from ? (
                            internalDate.to ? (
                                <>
                                    {format(internalDate.from, "LLL dd, y")} -{" "}
                                    {format(internalDate.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(internalDate.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        mode="range"
                        defaultMonth={internalDate?.from}
                        selected={internalDate}
                        onSelect={handleSelect}
                        numberOfMonths={2}
                        className="rounded-lg border shadow-sm"
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
}
