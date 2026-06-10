import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkforceData } from "@/hooks/use-workforce-data";
import { Award } from "lucide-react";

export const Route = createFileRoute("/perfect")({
  head: () => ({
    meta: [
      { title: "Perfect Attendance — Workforce" },
      {
        name: "description",
        content:
          "Track employees with perfect attendance and punctuality in any rolling 3-month period.",
      },
    ],
  }),
  component: PerfectPage,
});

function daysBefore(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function PerfectPage() {
  const { employees, attendance } = useWorkforceData();
  const today = "2026-06-10";
  const [end, setEnd] = useState<string>(today);
  const [start, setStart] = useState<string>(daysBefore(today, 90));
  const [manager, setManager] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "perfect" | "broken">("perfect");

  const managers = useMemo(
    () => Array.from(new Set(employees.map((e) => e.manager))).sort(),
    [employees],
  );

  const rows = useMemo(() => {
    const visible = employees.filter((e) => manager === "all" || e.manager === manager);
    return visible
      .map((e) => {
        const recs = attendance.filter(
          (r) =>
            r.employee_id === e.employee_id &&
            r.date >= start &&
            r.date <= end,
        );
        // Disqualifiers: any occurrence (tardy/leave early/absence), Absent type, or ShortShift.
        // Approved PTO and Makeup time do NOT break perfect attendance.
        const disqualifiers = recs.filter(
          (r) =>
            r.occurrence ||
            r.type === "Absent" ||
            r.type === "ShortShift",
        );
        const counts = {
          absences: disqualifiers.filter((r) => r.type === "Absent" || r.occurrence_reason === "Absence").length,
          tardies: disqualifiers.filter((r) => r.occurrence_reason === "Tardy").length,
          leaveEarly: disqualifiers.filter((r) => r.occurrence_reason === "LeaveEarly").length,
          shortShifts: disqualifiers.filter((r) => r.type === "ShortShift" && !r.occurrence).length,
        };
        const presentDays = recs.filter((r) => r.type === "Present" || r.type === "Makeup").length;
        const ptoDays = recs.filter((r) => r.type === "PTO").length;
        const perfect = disqualifiers.length === 0;
        return { emp: e, perfect, counts, disqualifiers: disqualifiers.length, presentDays, ptoDays };
      })
      .filter((r) =>
        statusFilter === "all"
          ? true
          : statusFilter === "perfect"
            ? r.perfect
            : !r.perfect,
      )
      .sort((a, b) => {
        if (a.perfect !== b.perfect) return a.perfect ? -1 : 1;
        return a.disqualifiers - b.disqualifiers || a.emp.name.localeCompare(b.emp.name);
      });
  }, [employees, attendance, manager, start, end, statusFilter]);

  const totals = useMemo(() => {
    const visible = employees.filter((e) => manager === "all" || e.manager === manager);
    const perfectCount = visible.filter((e) =>
      !attendance.some(
        (r) =>
          r.employee_id === e.employee_id &&
          r.date >= start &&
          r.date <= end &&
          (r.occurrence || r.type === "Absent" || r.type === "ShortShift"),
      ),
    ).length;
    return {
      perfect: perfectCount,
      eligible: visible.length,
      pct: visible.length === 0 ? 0 : Math.round((perfectCount / visible.length) * 100),
    };
  }, [employees, attendance, manager, start, end]);

  const setPreset = (days: number) => {
    setEnd(today);
    setStart(daysBefore(today, days));
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Perfect attendance
        </h1>
        <p className="text-sm text-muted-foreground">
          Employees with zero absences, tardies (≥15 min), early leaves (≥15 min), and short
          shifts across the selected window. Approved PTO and Makeup time do not break perfect attendance.
        </p>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">From</span>
            <Input
              type="date"
              value={start}
              max={end}
              onChange={(e) => e.target.value && setStart(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">To</span>
            <Input
              type="date"
              value={end}
              min={start}
              onChange={(e) => e.target.value && setEnd(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border p-1">
            {([
              { label: "30d", d: 30 },
              { label: "90d", d: 90 },
              { label: "6 mo", d: 182 },
              { label: "12 mo", d: 365 },
            ]).map((p) => (
              <button
                key={p.label}
                onClick={() => setPreset(p.d)}
                className="rounded px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {p.label}
              </button>
            ))}
          </div>
          <Select value={manager} onValueChange={setManager}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Manager" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All managers</SelectItem>
              {managers.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="perfect">Perfect only</SelectItem>
              <SelectItem value="broken">Broken streak</SelectItem>
              <SelectItem value="all">All employees</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Perfect</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-foreground">{totals.perfect}</span>
              <span className="text-sm text-muted-foreground">/ {totals.eligible}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Rate</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{totals.pct}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Window</div>
            <div className="mt-1 text-sm font-medium text-foreground">{start} → {end}</div>
            <div className="text-xs text-muted-foreground">
              {Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1} days
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Employees ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-4 py-2 font-medium">Manager</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-right">Absences</th>
                  <th className="px-4 py-2 font-medium text-right">Tardies</th>
                  <th className="px-4 py-2 font-medium text-right">Left Early</th>
                  <th className="px-4 py-2 font-medium text-right">Short Shifts</th>
                  <th className="px-4 py-2 font-medium text-right">Present</th>
                  <th className="px-4 py-2 font-medium text-right">PTO</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      No employees match the current filters.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.emp.employee_id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2 text-foreground">{r.emp.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.emp.manager}</td>
                    <td className="px-4 py-2">
                      {r.perfect ? (
                        <Badge variant="secondary" className="border-0 bg-[color:var(--chart-2)]/15 font-medium text-[color:var(--chart-2)]">
                          <Award className="mr-1 h-3 w-3" /> Perfect
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="border-0 bg-muted font-medium text-muted-foreground">
                          {r.disqualifiers} {r.disqualifiers === 1 ? "issue" : "issues"}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.counts.absences}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.counts.tardies}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.counts.leaveEarly}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.counts.shortShifts}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground">{r.presentDays}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.ptoDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        Disqualifiers: any absence, tardy (≥15 min), early leave (≥15 min), or short shift inside the window.
        Approved PTO and Makeup time are excluded from disqualifiers.
      </p>
    </AppShell>
  );
}
