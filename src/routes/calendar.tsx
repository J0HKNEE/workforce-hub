import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useWorkforceData } from "@/hooks/use-workforce-data";
import {
  TYPE_LABEL,
  type AttendanceRecord,
  type AttendanceType,
} from "@/lib/attendance";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Workforce" },
      {
        name: "description",
        content:
          "Calendar view of attendance, filterable by day, week, month, quarter, employee, and manager.",
      },
    ],
  }),
  component: CalendarPage,
});

type Period = "day" | "week" | "month" | "quarter";

const TYPE_DOT: Record<AttendanceType, string> = {
  Present: "bg-[color:var(--chart-2)]",
  Absent: "bg-destructive",
  PTO: "bg-[color:var(--chart-4)]",
  ShortShift: "bg-[color:var(--chart-5)]",
  Makeup: "bg-[color:var(--chart-1)]",
};

const TYPE_BADGE: Record<AttendanceType, string> = {
  Present: "bg-[color:var(--chart-2)]/15 text-[color:var(--chart-2)]",
  Absent: "bg-destructive/15 text-destructive",
  PTO: "bg-[color:var(--chart-4)]/20 text-[color:var(--chart-4)]",
  ShortShift: "bg-[color:var(--chart-5)]/20 text-[color:var(--chart-5)]",
  Makeup: "bg-[color:var(--chart-1)]/15 text-[color:var(--chart-1)]",
};

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  x.setDate(x.getDate() - day);
  return x;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

function rangeFor(period: Period, anchor: Date): { start: Date; end: Date } {
  if (period === "day") return { start: anchor, end: anchor };
  if (period === "week") {
    const s = startOfWeek(anchor);
    return { start: s, end: addDays(s, 6) };
  }
  if (period === "month") {
    const s = startOfMonth(anchor);
    const e = new Date(s.getFullYear(), s.getMonth() + 1, 0);
    return { start: s, end: e };
  }
  const s = startOfQuarter(anchor);
  const e = new Date(s.getFullYear(), s.getMonth() + 3, 0);
  return { start: s, end: e };
}

function shift(period: Period, anchor: Date, dir: number): Date {
  const x = new Date(anchor);
  if (period === "day") x.setDate(x.getDate() + dir);
  if (period === "week") x.setDate(x.getDate() + 7 * dir);
  if (period === "month") x.setMonth(x.getMonth() + dir);
  if (period === "quarter") x.setMonth(x.getMonth() + 3 * dir);
  return x;
}

function labelFor(period: Period, r: { start: Date; end: Date }): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (period === "day") return fmt(r.start);
  if (period === "month")
    return r.start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  if (period === "quarter") {
    const q = Math.floor(r.start.getMonth() / 3) + 1;
    return `Q${q} ${r.start.getFullYear()}`;
  }
  return `${fmt(r.start)} – ${fmt(r.end)}`;
}

function CalendarPage() {
  const { employees, attendance } = useWorkforceData();
  const [period, setPeriod] = useState<Period>("month");
  const [anchor, setAnchor] = useState<Date>(new Date(2026, 5, 10));
  const [manager, setManager] = useState<string>("all");
  const [employeeId, setEmployeeId] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const managers = useMemo(
    () => Array.from(new Set(employees.map((e) => e.manager))).sort(),
    [employees],
  );
  const filteredEmployees = useMemo(
    () =>
      employees.filter((e) => manager === "all" || e.manager === manager),
    [employees, manager],
  );

  const range = rangeFor(period, anchor);
  const startISO = toISO(range.start);
  const endISO = toISO(range.end);

  const filteredAttendance = useMemo(() => {
    const empIds = new Set(filteredEmployees.map((e) => e.employee_id));
    return attendance.filter((r) => {
      if (r.date < startISO || r.date > endISO) return false;
      if (employeeId !== "all" && r.employee_id !== employeeId) return false;
      else if (!empIds.has(r.employee_id)) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      return true;
    });
  }, [attendance, filteredEmployees, employeeId, typeFilter, startISO, endISO]);

  // Group records by date for grid cells
  const byDate = useMemo(() => {
    const m = new Map<string, AttendanceRecord[]>();
    filteredAttendance.forEach((r) => {
      const arr = m.get(r.date) ?? [];
      arr.push(r);
      m.set(r.date, arr);
    });
    return m;
  }, [filteredAttendance]);

  const nameOf = useMemo(
    () => new Map(employees.map((e) => [e.employee_id, e.name])),
    [employees],
  );

  // Summary counts
  const summary = useMemo(() => {
    const c: Record<AttendanceType, number> = {
      Present: 0,
      Absent: 0,
      PTO: 0,
      ShortShift: 0,
      Makeup: 0,
    };
    filteredAttendance.forEach((r) => (c[r.type] += 1));
    return c;
  }, [filteredAttendance]);

  // Build the visible grid: for month/quarter, full weeks covering range
  const gridStart = useMemo(() => {
    if (period === "day" || period === "week") return range.start;
    return startOfWeek(range.start);
  }, [period, range.start]);
  const gridEnd = useMemo(() => {
    if (period === "day") return range.end;
    if (period === "week") return range.end;
    const lastWeekStart = startOfWeek(range.end);
    return addDays(lastWeekStart, 6);
  }, [period, range.end]);

  const cells: Date[] = useMemo(() => {
    const out: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [gridStart, gridEnd]);

  const inRange = (d: Date) => d >= range.start && d <= range.end;

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Attendance calendar
        </h1>
        <p className="text-sm text-muted-foreground">
          Filter by period, manager, or employee. Click anywhere on a day to see entries.
        </p>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex items-center gap-1 rounded-md border border-border p-1">
            {(["day", "week", "month", "quarter"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={
                  "rounded px-3 py-1 text-sm capitalize transition-colors " +
                  (period === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground")
                }
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setAnchor(shift(period, anchor, -1))}
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-44 px-3 text-center text-sm font-medium text-foreground">
              {labelFor(period, range)}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setAnchor(shift(period, anchor, 1))}
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAnchor(new Date(2026, 5, 10))}
            >
              Today
            </Button>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">From</span>
              <Input
                type="date"
                value={toISO(range.start)}
                onChange={(e) => {
                  if (e.target.value) {
                    setPeriod("day");
                    setAnchor(parseISO(e.target.value));
                  }
                }}
                className="w-40"
              />
            </div>
            <Select value={manager} onValueChange={(v) => { setManager(v); setEmployeeId("all"); }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All managers</SelectItem>
                {managers.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {filteredEmployees.map((e) => (
                  <SelectItem key={e.employee_id} value={e.employee_id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {(Object.keys(TYPE_LABEL) as AttendanceType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {(Object.keys(summary) as AttendanceType[]).map((t) => (
          <Badge
            key={t}
            variant="secondary"
            className={"border-0 font-medium " + TYPE_BADGE[t]}
          >
            {TYPE_LABEL[t]}: {summary[t]}
          </Badge>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {labelFor(period, range)}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              ({filteredAttendance.length} entries)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-border bg-border text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="bg-muted/50 px-2 py-1.5 text-center font-medium uppercase tracking-wide text-muted-foreground"
              >
                {d}
              </div>
            ))}
            {cells.map((d) => {
              const iso = toISO(d);
              const recs = byDate.get(iso) ?? [];
              const dim = !inRange(d);
              return (
                <div
                  key={iso}
                  className={
                    "min-h-24 bg-card p-1.5 align-top " +
                    (dim ? "opacity-40" : "")
                  }
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-foreground">
                      {d.getDate()}
                    </span>
                    {recs.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {recs.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {recs.slice(0, 4).map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1 truncate text-[11px] text-foreground"
                        title={`${nameOf.get(r.employee_id) ?? r.employee_id} — ${TYPE_LABEL[r.type]}${r.notes ? " · " + r.notes : ""}`}
                      >
                        <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + TYPE_DOT[r.type]} />
                        <span className="truncate">
                          {(nameOf.get(r.employee_id) ?? r.employee_id).split(" ")[0]}
                        </span>
                      </div>
                    ))}
                    {recs.length > 4 && (
                      <div className="text-[10px] text-muted-foreground">
                        +{recs.length - 4} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Entries in range</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium text-right">Hours</th>
                  <th className="px-4 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No entries match the current filters.
                    </td>
                  </tr>
                )}
                {filteredAttendance
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-2 text-foreground">{r.date}</td>
                      <td className="px-4 py-2 text-foreground">
                        {nameOf.get(r.employee_id) ?? r.employee_id}
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="secondary"
                          className={"border-0 font-medium " + TYPE_BADGE[r.type]}
                        >
                          {TYPE_LABEL[r.type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-foreground">
                        {r.hours || "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{r.notes || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
