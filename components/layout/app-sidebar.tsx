"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight, ClipboardList, Fuel, LayoutDashboard } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { CompanyLogo } from "@/components/layout/company-logo"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

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
    { icon: LayoutDashboard, label: "Resumen", href: "/admin" },
    { icon: ClipboardList, label: "Registros", href: "/admin/registros" },
  ],
}

export function AppSidebar({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const { role } = useAuth()
  const pathname = usePathname()
  const items = role ? navItems[role] : []
  return <aside className={`fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border z-50 transition-all ${isOpen ? "w-64" : "w-20"}`}>
    <div className="flex h-[73px] items-center justify-center border-b border-sidebar-border px-3">{isOpen ? <CompanyLogo className="h-14 w-full" /> : <CompanyLogo className="h-12 w-14" />}</div>
    <SidebarLinks items={items} pathname={pathname} expanded={isOpen} />
    <button onClick={onToggle} className="absolute -right-3 top-20 rounded-full border bg-sidebar p-1">{isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
  </aside>
}

export function MobileSidebar({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const { role } = useAuth()
  const pathname = usePathname()
  const items = role ? navItems[role] : []

  return <Sheet open={isOpen} onOpenChange={onOpenChange}>
    <SheetContent side="left" className="w-72 p-0 lg:hidden">
      <SheetHeader className="border-b pr-12">
        <SheetTitle><CompanyLogo className="h-12 w-40" /></SheetTitle>
        <SheetDescription className="sr-only">Navegacion principal</SheetDescription>
      </SheetHeader>
      <SidebarLinks items={items} pathname={pathname} expanded onNavigate={() => onOpenChange(false)} />
    </SheetContent>
  </Sheet>
}

function SidebarLinks({ items, pathname, expanded, onNavigate }: { items: (typeof navItems)[keyof typeof navItems]; pathname: string; expanded: boolean; onNavigate?: () => void }) {
  return <nav className="space-y-1 p-3">{items.map((item) => {
    const Icon = item.icon
    const active = pathname === item.href || (pathname.startsWith(`${item.href}/`) && item.href.split("/").filter(Boolean).length > 1)
    return <Button key={item.href} asChild variant={active ? "secondary" : "ghost"} className={`w-full gap-3 ${expanded ? "justify-start" : "justify-center"}`}>
      <Link href={item.href} onClick={onNavigate}><Icon className="w-5 h-5" />{expanded && item.label}</Link>
    </Button>
  })}</nav>
}
