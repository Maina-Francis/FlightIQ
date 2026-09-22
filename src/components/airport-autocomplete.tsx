import { useState, useRef, useEffect, useCallback } from "react";
import { findAirport, registerAirport, type Airport } from "@/lib/airports";
import {
  searchAirportsFn,
  getAirportByIataFn,
  type AirportSearchResult,
} from "@/lib/airports.functions";
import { cn } from "@/lib/utils";
import { Plane, X, AlertCircle, Loader2 } from "lucide-react";

type Props = {
  value: string;
  onChange: (iata: string) => void;
  placeholder?: string;
  label?: string;
};

type Result = {
  iata: string;
  city: string;
  name: string;
  country: string;
};

export function AirportAutocomplete({
  value,
  onChange,
  placeholder = "Search city or airport",
  label,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If a value is provided but not in the local airport registry yet, resolve it via API
  useEffect(() => {
    if (value && !findAirport(value)) {
      getAirportByIataFn({ data: { iata: value } })
        .then((remote) => {
          if (remote) {
            registerAirport(remote);
            setTick((t) => t + 1);
          }
        })
        .catch(() => {});
    }
  }, [value]);

  const performSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const remote = await searchAirportsFn({ data: { query: trimmed } });
      for (const r of remote) {
        registerAirport(r);
      }
      setResults(remote);
      setHighlight(0);
    } catch (err: any) {
      console.error("[FlightIQ] Airport search error:", err);
      setError(err?.message || "Unable to search airports. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => performSearch(query), 250);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, performSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectAirport(airport: Result) {
    registerAirport(airport);
    onChange(airport.iata);
    setQuery("");
    setError(null);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        return;
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && results[highlight]) {
      e.preventDefault();
      selectAirport(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const selectedAirport = value ? findAirport(value) : undefined;

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      )}
      {value ? (
        <div className="flex h-11 items-center justify-between rounded-lg border border-input bg-transparent px-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary/15 px-2 py-0.5 text-sm font-bold text-primary">
              {value}
            </span>
            <span className="text-sm text-muted-foreground">
              {selectedAirport?.city ?? ""}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
              setError(null);
              setOpen(true);
            }}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Clear selected airport"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      )}
      {open && !value && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
          {error ? (
            <div className="flex items-center gap-2.5 px-3 py-4 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : !query.trim() ? (
            <div className="px-4 py-5 text-center text-xs text-muted-foreground">
              <Plane className="mx-auto mb-2 h-5 w-5 opacity-40" />
              <p className="font-medium text-foreground">Type a city, airport, or 3-letter code</p>
              <p className="mt-0.5 text-muted-foreground">e.g. Kigali, London, Nairobi, JFK, DXB</p>
            </div>
          ) : loading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Searching airports worldwide...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No airports found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <>
              {results.map((airport, i) => (
                <button
                  type="button"
                  key={`${airport.iata}-${i}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectAirport(airport);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    i === highlight && "bg-accent",
                  )}
                >
                  <Plane className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="w-10 font-bold text-primary">{airport.iata}</span>
                  <span className="flex-1">
                    <span className="font-medium">{airport.city}</span>
                    {airport.name && airport.name !== airport.city && (
                      <span className="ml-1.5 text-muted-foreground">{airport.name}</span>
                    )}
                    {airport.country && (
                      <span className="ml-1.5 text-muted-foreground">· {airport.country}</span>
                    )}
                  </span>
                </button>
              ))}
              {loading && (
                <div className="flex items-center justify-center gap-1.5 border-t border-border/50 px-3 py-2 text-center text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Updating results...</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
