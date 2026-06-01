"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

export default function HomeRedirect() {
  const { isAuthenticated, role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && role) {
        router.replace(`/${role}`);
      } else {
        router.replace("/login");
      }
    }
  }, [isLoading, isAuthenticated, role, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      <p className="text-muted-foreground text-sm font-medium animate-pulse">Redireccionando...</p>
    </div>
  );
}
