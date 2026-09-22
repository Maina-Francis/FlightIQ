import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Trash2,
  Bell,
  Mail,
  Send,
  Plane,
  LogOut,
  Plus,
  Loader2,
  Calendar,
  CheckCircle2,
  ArrowRight,
  TrendingDown,
  Clock,
  Target,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useThemeStore } from "@/lib/store";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { findAirport, registerAirport } from "@/lib/airports";
import { getAirportByIataFn } from "@/lib/airports.functions";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "My Tracked Deals — FlightIQ" },
      {
        name: "description",
        content: "View and manage your flight price alerts and notifications.",
      },
    ],
  }),
  component: DealsPage,
});

type PriceTrackerRow = {
  id: string;
  created_at: string;
  email: string | null;
  telegram_chat_id: string | null;
  origin_iata: string;
  destination_iata: string;
  departure_date: string;
  return_date: string | null;
  target_price: number | null;
  currency: string;
  is_active: boolean;
  last_seen_price: number | null;
  last_notified_at: string | null;
};

function DealsPage() {
  const { hydrate: hydrateTheme } = useThemeStore();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackers, setTrackers] = useState<PriceTrackerRow[]>([]);

  // Magic Link auth state
  const [emailInput, setEmailInput] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const loadTrackers = useCallback(async (userEmail?: string, userTelegramChatId?: string) => {
    try {
      let query = supabase
        .from("price_trackers")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      // Build an OR filter: match by email OR by telegram_chat_id
      const orParts: string[] = [];
      if (userEmail) orParts.push(`email.eq.${userEmail}`);
      if (userTelegramChatId) orParts.push(`telegram_chat_id.eq.${userTelegramChatId}`);

      if (orParts.length > 0) {
        query = query.or(orParts.join(","));
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error loading price trackers:", error);
      } else if (data) {
        setTrackers(data as PriceTrackerRow[]);
        const iatas = new Set<string>();
        data.forEach((t: any) => {
          if (t.origin_iata && !findAirport(t.origin_iata)) iatas.add(t.origin_iata);
          if (t.destination_iata && !findAirport(t.destination_iata)) iatas.add(t.destination_iata);
        });
        iatas.forEach((code) => {
          getAirportByIataFn({ data: { iata: code } })
            .then((a) => {
              if (a) {
                registerAirport(a);
                setTrackers((curr) => [...curr]);
              }
            })
            .catch(() => {});
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    hydrateTheme();
    initAnalytics();
    trackPageView("/deals");

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        // Fetch the user's linked Telegram chat ID from profiles
        let telegramChatId: string | undefined;
        const { data: profile } = await supabase
          .from("profiles")
          .select("telegram_chat_id")
          .eq("id", session.user.id)
          .maybeSingle();
        if (profile?.telegram_chat_id) telegramChatId = profile.telegram_chat_id;
        loadTrackers(session.user.email, telegramChatId);
      } else {
        loadTrackers();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user?.email) {
        // Fetch Telegram chat ID on auth state change too
        (async () => {
          let telegramChatId: string | undefined;
          const { data: profile } = await supabase
            .from("profiles")
            .select("telegram_chat_id")
            .eq("id", newSession!.user.id)
            .maybeSingle();
          if (profile?.telegram_chat_id) telegramChatId = profile.telegram_chat_id;
          loadTrackers(newSession!.user.email, telegramChatId);
        })();
      } else {
        setTrackers([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [hydrateTheme, loadTrackers]);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        ...(typeof window !== "undefined"
          ? {
              options: {
                redirectTo: window.location.origin,
              },
            }
          : {}),
      });
      if (error) toast.error(error.message);
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect to Google.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput || !emailInput.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: emailInput.trim(),
        ...(typeof window !== "undefined"
          ? {
              options: {
                emailRedirectTo: window.location.origin,
              },
            }
          : {}),
      });
      if (error) {
        toast.error(error.message);
      } else {
        setMagicLinkSent(true);
        toast.success("Magic link sent! Please check your email.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not send magic link.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from("price_trackers")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast.error("Could not remove alert.");
      return;
    }
    setTrackers((prev) => prev.filter((a) => a.id !== id));
    toast.success("Price tracker deactivated.");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setTrackers([]);
    toast.success("Signed out.");
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !session ? (
          /* Unauthenticated State: Sign in with Google or Magic Link */
          <div className="mx-auto max-w-md py-12">
            <Card className="glass-panel border-border/80 shadow-xl">
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm">
                  <Bell className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight">
                  Track Your Flight Deals
                </CardTitle>
                <CardDescription className="text-xs">
                  Sign in without passwords to view, manage, and receive alerts for your tracked
                  routes.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {magicLinkSent ? (
                  <div className="space-y-3 py-3 text-center">
                    <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                    <p className="text-sm font-semibold">Magic link on its way!</p>
                    <p className="text-xs text-muted-foreground">
                      We sent a one-click login link to <strong>{emailInput}</strong>.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMagicLinkSent(false)}
                      className="text-xs"
                    >
                      Try different email
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGoogleSignIn}
                      disabled={googleLoading || authLoading}
                      className="relative w-full border-border/80 bg-card hover:bg-accent"
                    >
                      {googleLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                      )}
                      Continue with Google
                    </Button>

                    <div className="relative flex items-center justify-center py-1">
                      <div className="w-full border-t border-border" />
                      <span className="absolute bg-card px-2 text-xs uppercase tracking-wider text-muted-foreground">
                        Or magic link
                      </span>
                    </div>

                    <form onSubmit={handleMagicLink} className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="deals-email" className="text-xs">
                          Email address
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="deals-email"
                            type="email"
                            placeholder="you@example.com"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            className="pl-9 text-xs"
                            required
                            disabled={authLoading}
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={authLoading}
                        className="w-full glow-cta gap-1.5"
                      >
                        {authLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Send Magic Link
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </form>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Authenticated Tracked Deals List */
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  My Tracked Deals
                </h1>
                <p className="text-xs text-muted-foreground">
                  Signed in as <strong>{session.user.email}</strong> · Notifications will be sent
                  when fares drop.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button asChild size="sm" className="glow-cta gap-1.5">
                  <Link to="/">
                    <Plus className="h-4 w-4" />
                    <span>Track New Route</span>
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="gap-1.5 text-xs"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </Button>
              </div>
            </div>

            {trackers.length === 0 ? (
              <Card className="glass-panel border-border/80 p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Plane className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">
                  No active price trackers
                </h3>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  Search for any flight and click <strong>"Set Price Alert"</strong> to start
                  tracking fares in your local currency.
                </p>
                <Button asChild size="sm" className="mt-6 glow-cta">
                  <Link to="/">Find Flights</Link>
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {trackers.map((tracker) => {
                  const origAirport = findAirport(tracker.origin_iata);
                  const dstAirport = findAirport(tracker.destination_iata);
                  const isEmail = !!tracker.email;

                  return (
                    <div
                      key={tracker.id}
                      className="glass-panel group flex flex-col justify-between gap-4 rounded-2xl border border-border/80 p-5 transition-all hover:border-primary/40 hover:shadow-md sm:flex-row sm:items-center"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                          <Plane className="h-5 w-5" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-bold text-foreground">
                              {tracker.origin_iata}
                            </span>
                            <span className="text-primary font-bold">→</span>
                            <span className="font-mono text-base font-bold text-foreground">
                              {tracker.destination_iata}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            {origAirport ? origAirport.city : tracker.origin_iata} to{" "}
                            {dstAirport ? dstAirport.city : tracker.destination_iata}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {tracker.departure_date}
                              {tracker.return_date ? ` — ${tracker.return_date}` : ""}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              {isEmail ? (
                                <>
                                  <Mail className="h-3 w-3 text-primary" />
                                  <span>{tracker.email}</span>
                                </>
                              ) : (
                                <>
                                  <Send className="h-3 w-3 text-accent" />
                                  <span>Telegram: {tracker.telegram_chat_id}</span>
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-5 border-t border-border/60 pt-3 sm:border-t-0 sm:pt-0">
                        {tracker.last_seen_price !== null && (
                          <div className="text-left sm:text-right">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              Current Best
                            </p>
                            <p className="text-lg font-bold text-foreground font-mono">
                              {tracker.currency} {Number(tracker.last_seen_price).toLocaleString()}
                            </p>
                            {tracker.target_price !== null && Number(tracker.last_seen_price) <= Number(tracker.target_price) ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success">
                                <TrendingDown className="h-3 w-3" />
                                At target!
                              </span>
                            ) : tracker.target_price !== null ? (
                              <span className="text-[10px] text-muted-foreground">
                                Target: {tracker.currency} {Number(tracker.target_price).toLocaleString()}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                                <Target className="h-3 w-3" />
                                Any drop
                              </span>
                            )}
                          </div>
                        )}

                        <div className="text-left sm:text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                            {tracker.target_price ? "Target Price" : "Alert Type"}
                          </p>
                          <p className="text-xl font-extrabold text-foreground font-mono">
                            {tracker.target_price
                              ? `${tracker.currency} ${Number(tracker.target_price).toLocaleString()}`
                              : "Any Price Drop"}
                          </p>
                          {tracker.last_notified_at && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Last alert: {new Date(tracker.last_notified_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(tracker.id)}
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Delete Tracker"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
