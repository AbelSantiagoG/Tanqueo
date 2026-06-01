"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight, ClipboardList, Fuel, LayoutDashboard } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { CompanyLogo } from "@/components/layout/company-logo"

const navItems = {
  operario: [
    { icon: Fuel, label: "Registrar tanqueo", href: "/operario" },
    { icon: ClipboardList, label: "Mi historial", href: "/operario/historial" },
  ],
  despachador: [
    { icon: LayoutDashboard, label: "Panel principal", href: "/despachador" },
    { icon: ClipboardList, label: "Ordenes", href: "/despachador/ordenes" },
  ],
  admin: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
    { icon: ClipboardList, label: "Registros", href: "/admin/registros" },
  ],
}

export function AppSidebar({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const { role } = useAuth()
  const pathname = usePathname()
  const items = role ? navItems[role] : []
  return <aside className={`fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border z-50 transition-all ${isOpen ? "w-64" : "w-20"}`}>
    <div className="flex h-[73px] items-center justify-center border-b border-sidebar-border px-3">{isOpen ? <CompanyLogo className="h-14 w-full" /> : <CompanyLogo className="h-12 w-14" />}</div>
    <nav className="p-3 space-y-1">{items.map((item) => {
      const Icon = item.icon
      const active = pathname === item.href
      return <Link key={item.href} href={item.href}><Button variant={active ? "secondary" : "ghost"} className={`w-full gap-3 ${isOpen ? "justify-start" : "justify-center"}`}><Icon className="w-5 h-5" />{isOpen && item.label}</Button></Link>
    })}</nav>
    <button onClick={onToggle} className="absolute -right-3 top-20 rounded-full border bg-sidebar p-1">{isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
  </aside>
}
