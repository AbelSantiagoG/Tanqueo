"use client"

import { useEffect } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  Menu,
  ChevronDown,
  User,
  Shield,
  Truck,
  LogOut,
  Sun,
  Moon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { CompanyLogo } from "@/components/layout/company-logo"

interface AppHeaderProps {
  onMenuToggle: () => void
}

const roleConfig = {
  operario: {
    label: "Operario",
    icon: User,
    color: "text-primary",
    bgColor: "bg-primary/20",
  },
  despachador: {
    label: "Despachador",
    icon: Truck,
    color: "text-warning",
    bgColor: "bg-warning/20",
  },
  admin: {
    label: "Administrador",
    icon: Shield,
    color: "text-success",
    bgColor: "bg-success/20",
  },
}

export function AppHeader({ onMenuToggle }: AppHeaderProps) {
  const { role, logout, user } = useAuth()
  const router = useRouter()
  const currentRole = role || "operario"
  const config = roleConfig[currentRole as keyof typeof roleConfig]
  const Icon = config?.icon || User
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    router.prefetch("/login")
  }, [router])

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border/50 shadow-sm">
      <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4">
        {/* Left side */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-foreground"
            onClick={onMenuToggle}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="hidden lg:flex items-center gap-3">
            <CompanyLogo className="h-11 w-32" />
            <div>
              <h1 className="font-bold text-foreground">Control de Tanqueo</h1>
              <p className="text-xs text-muted-foreground">Sistema de Gestión</p>
            </div>
          </div>
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2">
            <CompanyLogo className="h-9 w-20 sm:w-24" />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <span className="hidden md:inline text-xs capitalize text-muted-foreground mr-2">
            {new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </span>
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
            aria-label="Cambiar tema"
          >
            <Sun className="w-5 h-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute w-5 h-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-1 border-border bg-card px-2 hover:bg-muted/50 sm:gap-2 sm:px-4"
              >
                <div className={`w-6 h-6 rounded-md ${config?.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${config?.color}`} />
                </div>
                <span className="hidden sm:inline text-foreground">{user?.full_name || config?.label}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
              <DropdownMenuLabel className="text-foreground pb-0">
                {user?.full_name || "Usuario"}
              </DropdownMenuLabel>
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal pt-0">
                Rol: {config?.label}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem
                onClick={() => {
                  router.replace("/login")
                  void logout().catch(console.error)
                }}
                className="flex items-center gap-2 text-destructive cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
