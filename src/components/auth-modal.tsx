import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plane, Mail, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AuthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingMagicLink, setLoadingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handleGoogleSignIn() {
    setLoadingGoogle(true);
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
      if (error) {
        toast.error(error.message || "Failed to sign in with Google.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect to Google authentication.");
    } finally {
      setLoadingGoogle(false);
    }
  }

  async function handleMagicLinkSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setLoadingMagicLink(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        ...(typeof window !== "undefined"
          ? {
              options: {
                emailRedirectTo: window.location.origin,
              },
            }
          : {}),
      });

      if (error) {
        toast.error(error.message || "Could not send magic link.");
      } else {
        setMagicLinkSent(true);
        toast.success("Magic link sent! Check your inbox.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong sending your login link.");
    } finally {
      setLoadingMagicLink(false);
    }
  }

  function handleReset() {
    setMagicLinkSent(false);
    setEmail("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) {
          setTimeout(handleReset, 300);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-left">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-md sm:mx-0">
            <Plane className="h-6 w-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Sign in to FlightIQ
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Track price drops, sync flight alerts across devices, and manage your deals with zero
            markup.
          </DialogDescription>
        </DialogHeader>

        {magicLinkSent ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Check your inbox</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                We sent a secure, password-free login link to:
              </p>
              <p className="mt-1 font-mono text-sm font-medium text-foreground">{email}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Click the link in the email to automatically sign in. You can close this window.
            </p>
            <div className="pt-2">
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Use a different email
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Google OAuth Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={loadingGoogle || loadingMagicLink}
              className="relative w-full border-border/80 bg-card hover:bg-accent"
            >
              {loadingGoogle ? (
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

            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-border" />
              <span className="absolute bg-card px-2 text-xs uppercase tracking-wider text-muted-foreground">
                Or magic link
              </span>
            </div>

            {/* Magic Link Form */}
            <form onSubmit={handleMagicLinkSignIn} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="auth-email" className="text-xs font-medium">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="auth-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                    disabled={loadingMagicLink || loadingGoogle}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loadingMagicLink || loadingGoogle}
                className="w-full glow-cta gap-1.5"
              >
                {loadingMagicLink ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending Magic Link...
                  </>
                ) : (
                  <>
                    Send Magic Link
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              No password needed. We'll send a one-click login link straight to your email.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
