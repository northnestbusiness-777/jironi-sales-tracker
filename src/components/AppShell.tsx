import { NavLink, Outlet } from "react-router-dom";
import {
  CalendarRange,
  ImagePlus,
  Landmark,
  LayoutDashboard,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MadeWithDyad } from "./made-with-dyad";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/upload", label: "New Report", icon: ImagePlus, end: false },
  { to: "/monthly", label: "Monthly", icon: CalendarRange, end: false },
  { to: "/settings", label: "Settings", icon: Settings2, end: false },
];

export default function AppShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Landmark size={18} />
            </span>
            <div className="leading-tight">
              <p className="font-display text-lg font-semibold">Ledger</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                DSR Analyser
              </p>
            </div>
          </div>
          <nav className="no-scrollbar ml-auto flex gap-1 overflow-x-auto">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
                  )
                }
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <MadeWithDyad />
    </div>
  );
}