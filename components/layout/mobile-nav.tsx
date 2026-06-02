"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, ClipboardList, Fuel } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

const navItems = {
  operario: [{ icon: Fuel, label: "Tanqueo", href: "/operario" }, { icon: ClipboardList, label: "Historial", href: "/operario/historial" }],
  despachador: [{ icon: BarChart3, label: "Panel", href: "/despachador" }, { icon: ClipboardList, label: "Ordenes", href: "/despachador/ordenes" }],
  admin: [{ icon: BarChart3, label: "Resumen", href: "/admin" }, { icon: ClipboardList, label: "Registros", href: "/admin/registros" }],
}

export function MobileNav() {
  const { role } = useAuth()
  const pathname = usePathname()
  const items = role ? navItems[role] : []
  return <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-md"><div className="flex justify-around py-2">{items.map((item) => {
    const Icon = item.icon
    const active = pathname === item.href
    return <Link href={item.href} key={item.href} className={`flex flex-col items-center gap-1 rounded-lg px-4 py-2 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}><Icon className="w-5 h-5" />{item.label}</Link>
  })}</div></nav>
}
