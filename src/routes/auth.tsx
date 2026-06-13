import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in · Pages" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/library" });
    });
  }, [navigate]);

  async function signIn() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
      extraParams: {
        scope: "openid email profile https://www.googleapis.com/auth/drive.file",
        access_type: "offline",
        prompt: "consent",
      },
    });
    if (result.error) {
      toast.error("Sign in fehlgeschlagen: " + result.error.message);
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/library" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 dot-matrix">
      <div className="w-full max-w-sm border hairline bg-background p-8">
        <div className="label-mono text-muted-foreground">PAGES / SIGN IN</div>
        <h1 className="mt-3 font-mono text-3xl">Willkommen.</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Melde dich mit Google an. Pages bittet dabei um Zugriff auf seinen eigenen Ordner in deinem Drive — sonst nichts.
        </p>
        <button
          onClick={signIn}
          disabled={loading}
          className="mt-8 w-full font-mono text-sm bg-foreground text-background py-3 hover:bg-accent transition-colors disabled:opacity-60"
        >
          {loading ? "..." : "Sign in with Google →"}
        </button>
        <p className="mt-6 label-mono text-muted-foreground">
          drive.file scope · nur Pages-Dateien
        </p>
      </div>
    </div>
  );
}
