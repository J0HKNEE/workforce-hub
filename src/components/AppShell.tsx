import { Link, useRouterState } from "@tanstack/react-router";
import { Users, CalendarCheck, TrendingUp, Github, CalendarDays, AlertTriangle } from "lucide-react";

const nav = [
  { to: "/", label: "Today", icon: CalendarCheck },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/occurrences", label: "Occurrences", icon: AlertTriangle },
  { to: "/trends", label: "Trends", icon: TrendingUp },
  { to: "/headcount", label: "Headcount", icon: Users },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-bold">
              W
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight text-foreground">
                Workforce
              </div>
              <div className="text-xs leading-tight text-muted-foreground">
                Attendance & headcount
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {nav.map((n) => {
              const active = pathname === n.to;
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                    (active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="ml-2 grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Source on GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
