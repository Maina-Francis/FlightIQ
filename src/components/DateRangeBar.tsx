import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { format, addDays, subDays, parseISO, isValid } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SearchParams } from "@/lib/flights";

interface DateRangeBarProps {
  searchParams: SearchParams;
  lowestPrice?: number | null;
  currency?: string;
}

export function DateRangeBar({ searchParams, lowestPrice, currency = "USD" }: DateRangeBarProps) {
  const navigate = useNavigate();

  const currentDateObj = useMemo(() => {
    try {
      const parsed = parseISO(searchParams.departureDate);
      return isValid(parsed) ? parsed : new Date();
    } catch {
      return new Date();
    }
  }, [searchParams.departureDate]);

  // Generate 7 days: 3 days before, selected day, 3 days after
  const dateSlots = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const slots = [];
    for (let offset = -3; offset <= 3; offset++) {
      const slotDate = addDays(currentDateObj, offset);
      slotDate.setHours(0, 0, 0, 0);
      const isPast = slotDate.getTime() < today.getTime();
      const isCurrent = offset === 0;

      slots.push({
        date: slotDate,
        dateStr: format(slotDate, "yyyy-MM-dd"),
        dayName: format(slotDate, "EEE"),
        dayNum: format(slotDate, "MMM d"),
        isCurrent,
        isPast,
      });
    }
    return slots;
  }, [currentDateObj]);

  function handleSelectDate(targetDateStr: string) {
    if (targetDateStr === searchParams.departureDate) return;

    // If round-trip, preserve trip duration
    let newReturnDate = searchParams.returnDate;
    if (searchParams.tripType === "round" && searchParams.returnDate) {
      try {
        const oldDep = parseISO(searchParams.departureDate);
        const oldRet = parseISO(searchParams.returnDate);
        const diffDays = Math.max(
          1,
          Math.round((oldRet.getTime() - oldDep.getTime()) / (1000 * 60 * 60 * 24)),
        );
        const newDep = parseISO(targetDateStr);
        newReturnDate = format(addDays(newDep, diffDays), "yyyy-MM-dd");
      } catch {
        // preserve existing if parse fails
      }
    }

    navigate({
      to: "/search",
      search: {
        origin: searchParams.origin,
        destination: searchParams.destination,
        departureDate: targetDateStr,
        returnDate: newReturnDate ?? undefined,
        tripType: searchParams.tripType,
        adults: searchParams.adults,
        cabin: searchParams.cabin,
      },
    });
  }

  function handleShift(days: number) {
    const newDate = addDays(currentDateObj, days);
    handleSelectDate(format(newDate, "yyyy-MM-dd"));
  }

  return (
    <div className="glass-panel overflow-hidden rounded-2xl border border-border/80 bg-card/40 p-2 sm:p-2.5 shadow-xs">
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Prev Arrow */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleShift(-3)}
          className="h-10 w-8 shrink-0 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Previous dates"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Horizontal Dates Strip */}
        <div className="grid flex-1 grid-cols-7 gap-1 sm:gap-1.5 overflow-x-auto py-1">
          {dateSlots.map((slot) => {
            const isSelected = slot.isCurrent;

            return (
              <button
                key={slot.dateStr}
                type="button"
                disabled={slot.isPast}
                onClick={() => handleSelectDate(slot.dateStr)}
                className={cn(
                  "group relative flex flex-col items-center justify-center rounded-xl p-2 sm:py-2.5 transition-all text-center",
                  slot.isPast
                    ? "cursor-not-allowed opacity-35"
                    : isSelected
                      ? "border-2 border-primary bg-primary/15 text-primary shadow-xs ring-1 ring-primary/30"
                      : "border border-border/60 bg-background/50 hover:border-primary/40 hover:bg-accent/60 text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider",
                    isSelected ? "text-primary font-bold" : "text-muted-foreground",
                  )}
                >
                  {slot.dayName}
                </span>

                <span
                  className={cn(
                    "font-mono text-xs sm:text-sm font-extrabold mt-0.5",
                    isSelected ? "text-foreground" : "text-foreground/90",
                  )}
                >
                  {slot.dayNum}
                </span>

                {isSelected ? (
                  <span className="mt-1 rounded-full bg-primary px-1.5 py-0.2 text-[9px] font-bold text-primary-foreground tracking-tight">
                    Active
                  </span>
                ) : (
                  <span className="mt-1 text-[9px] font-medium text-muted-foreground group-hover:text-primary transition-colors">
                    View
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Next Arrow */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleShift(3)}
          className="h-10 w-8 shrink-0 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Next dates"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
