import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Plane, Sun, Moon, ChevronDown, MapPin, Bell, User, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCurrencyStore, useThemeStore } from "@/lib/store";
import { CURRENCIES } from "@/lib/currency";
import { trackCurrencyChanged } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { AuthModal } from "@/components/auth-modal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";

export function Navbar() {
  const { currency, detectedCountry, detectedCity, setCurrency } = useCurrencyStore();
  const { theme, toggle } = useThemeStore();
  const [session, setSession] = useState<Session | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    // Initial session lookup
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for real-time auth state updates
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out successfully.");
  }

  const detectedLabel =
    detectedCity && detectedCountry
      ? `${detectedCity}, ${detectedCountry}`
      : detectedCountry
        ? detectedCountry
        : null;

  const userInitial = session?.user?.email ? session.user.email.charAt(0).toUpperCase() : "U";

  return (
    <>
      <header className="sticky top-0 z-40 w-full">
        <div className="glass-panel mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-coral shadow-md">
              <Plane className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-foreground">
              Flight<span className="text-primary">IQ</span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Currency Selector */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1.5 px-2 sm:px-3">
                        <span className="text-base leading-none">{CURRENCIES[currency]?.flag}</span>
                        <span className="hidden text-sm font-semibold sm:inline">{currency}</span>
                        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 p-2">
                      <div className="mb-2 flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {detectedLabel ? `Detected: ${detectedLabel}` : "Click to change currency"}
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {Object.values(CURRENCIES).map((c) => (
                          <button
                            key={c.code}
                            onClick={() => {
                              const change = setCurrency(c.code);
                              trackCurrencyChanged({
                                from_currency: change.from,
                                to_currency: change.to,
                                detected_country: change.detectedCountry,
                              });
                            }}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                              c.code === currency && "bg-accent/50 font-medium",
                            )}
                          >
                            <span className="text-base">{c.flag}</span>
                            <span className="font-semibold">{c.code}</span>
                            <span className="text-muted-foreground">{c.label}</span>
                            <span className="ml-auto text-muted-foreground">{c.symbol}</span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </TooltipTrigger>
                <TooltipContent>
                  {detectedLabel
                    ? `Detected location: ${detectedLabel} — Click to change`
                    : "Click to change currency"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Dark / Light Toggle */}
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* My Tracked Deals */}
            <Button asChild variant="outline" size="sm" className="hidden gap-1.5 sm:inline-flex">
              <Link to="/deals">
                <Bell className="h-4 w-4" />
                <span>Tracked Deals</span>
              </Link>
            </Button>

            {/* Authentication State */}
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 px-2">
                    <Avatar className="h-7 w-7 border border-border">
                      <AvatarFallback className="bg-primary/20 text-xs font-bold text-primary">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-[120px] truncate text-xs font-medium sm:inline">
                      {session.user.email}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs font-semibold leading-none text-foreground">Account</p>
                      <p className="truncate text-xs leading-none text-muted-foreground">
                        {session.user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link to="/deals" className="flex w-full items-center gap-2">
                      <Bell className="h-4 w-4" />
                      <span>My Tracked Deals</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => setAuthModalOpen(true)}
                className="glow-cta gap-1.5"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Auth Modal for Sign In / Sign Up */}
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </>
  );
}
