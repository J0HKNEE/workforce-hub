import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useWorkforceData } from "@/hooks/use-workforce-data";
import {
  latestDate,
  TYPE_LABEL,
  type AttendanceType,
  type Employee,
} from "@/lib/attendance";
import { Users, UserCheck, UserX, Clock, Plane, Wrench } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — Workforce" },
      {
        name: "description",
        content:
          "Daily staffing board: who's in, out, on PTO, short-shift, or working makeup time.",
      },
    ],
  }),
  component: TodayPage,
});

const TYPE_BADGE: Record<AttendanceType, string> = {
  Present: "bg-[color:var(--chart-2)]/15 text-[color:var(--chart-2)]",
  Absent: "bg-destructive/15 text-destructive",
  PTO: "bg-[color:var(--chart-4)]/20 text-[color:var(--chart-4)]",
  ShortShift: "bg-[color:var(--chart-5)]/20 text-[color:var(--chart-5)]",
  Makeup: "bg-[color:var(--chart-1)]/15 text-[color:var(--chart-1)]",
};

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-semibold text-foreground">{value}</div>
          {hint && (
            <div className="text-xs text-muted-foreground">{hint}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TodayPage() {
  const { employees, attendance, isLoading, error } = useWorkforceData();
  const allDates = useMemo(
    () => Array.from(new Set(attendance.map((a) => a.date))).sort().reverse(),
    [attendance],
  );
  const [date, setDate] = useState<string>("");
  const [query, setQuery] = useState("");
  const activeDate = date || (allDates[0] ?? latestDate(attendance));

  const todays = useMemo(
    () => attendance.filter((a) => a.date === activeDate),
    [attendance, activeDate],
  );

  const byEmployee = useMemo(() => {
    const m = new Map<string, (typeof todays)[number]>();
    todays.forEach((r) => m.set(r.employee_id, r));
    return m;
  }, [todays]);

  type Row = { employee: Employee; type: AttendanceType; hours: number; notes: string };
  const rows: Row[] = useMemo(() => {
    return employees
      .filter((e) => e.status === "Active")
      .map((e) => {
        const rec = byEmployee.get(e.employee_id);
        return {
          employee: e,
          type: (rec?.type ?? "Absent") as AttendanceType,
          hours: rec?.hours ?? 0,
          notes: rec?.notes ?? (rec ? "" : "No record"),
        };
      })
      .filter((r) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
          r.employee.name.toLowerCase().includes(q) ||
          r.employee.team.toLowerCase().includes(q) ||
          r.employee.location.toLowerCase().includes(q)
        );
      });
  }, [employees, byEmployee, query]);

  const counts = useMemo(() => {
    const c: Record<AttendanceType | "Total", number> = {
      Total: rows.length,
      Present: 0,
      Absent: 0,
      PTO: 0,
      ShortShift: 0,
      Makeup: 0,
    };
    rows.forEach((r) => (c[r.type] += 1));
    return c;
  }, [rows]);

  const coverage =
    counts.Total === 0
      ? 0
      : Math.round(((counts.Present + counts.Makeup) / counts.Total) * 100);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Daily staffing board
          </h1>
          <p className="text-sm text-muted-foreground">
            Live view of who's working today, by employee.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search name, team, location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64"
          />
          <Select value={activeDate} onValueChange={setDate}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              {allDates.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">
            Could not load data files. Make sure
            <code className="mx-1 rounded bg-secondary px-1">
              public/data/employees.csv
            </code>
            and
            <code className="mx-1 rounded bg-secondary px-1">
              public/data/attendance.csv
            </code>
            exist.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <Kpi
          icon={Users}
          label="Coverage"
          value={`${coverage}%`}
          hint={`${counts.Present + counts.Makeup}/${counts.Total} working`}
        />
        <Kpi icon={UserCheck} label="Present" value={counts.Present} />
        <Kpi icon={UserX} label="Absent" value={counts.Absent} />
        <Kpi icon={Plane} label="PTO" value={counts.PTO} />
        <Kpi icon={Clock} label="Short shift" value={counts.ShortShift} />
        <Kpi icon={Wrench} label="Makeup" value={counts.Makeup} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Roster — {activeDate}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              ({rows.length} employees)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-4 py-2 font-medium">Team</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                  <th className="px-4 py-2 font-medium">Manager</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-right">Hours</th>
                  <th className="px-4 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-muted-foreground"
                      colSpan={7}
                    >
                      Loading…
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  rows.map((r) => (
                    <tr
                      key={r.employee.employee_id}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground">
                          {r.employee.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.employee.employee_id}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-foreground">
                        {r.employee.team}
                      </td>
                      <td className="px-4 py-2.5 text-foreground">
                        {r.employee.location}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {r.employee.manager}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          className={
                            "border-0 font-medium " + TYPE_BADGE[r.type]
                          }
                          variant="secondary"
                        >
                          {TYPE_LABEL[r.type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                        {r.hours || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {r.notes || "—"}
                      </td>
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
