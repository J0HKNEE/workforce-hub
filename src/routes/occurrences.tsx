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
import {
  OCCURRENCE_REASON_LABEL,
  correctiveLevelFor,
  type CorrectiveLevel,
  type OccurrenceReason,
} from "@/lib/attendance";

export const Route = createFileRoute("/occurrences")({
  head: () => ({
    meta: [
      { title: "Occurrences — Workforce" },
      {
        name: "description",
        content:
          "Rolling 3-month occurrence counts and corrective-action tracking per employee.",
      },
    ],
  }),
  component: OccurrencesPage,
});

const LEVEL_BADGE: Record<CorrectiveLevel, string> = {
  None: "bg-muted text-muted-foreground",
  Verbal: "bg-[color:var(--chart-4)]/20 text-[color:var(--chart-4)]",
  Written: "bg-[color:var(--chart-5)]/20 text-[color:var(--chart-5)]",
  Final: "bg-destructive/15 text-destructive",
  Termination: "bg-destructive text-destructive-foreground",
};

const LEVEL_DESC: Record<CorrectiveLevel, string> = {
  None: "No active corrective action",
  Verbal: "3 occurrences / 3 mo — Verbal corrective action",
  Written: "4 occurrences / 3 mo — Written corrective action",
  Final: "5 occurrences / 3 mo — Final corrective action",
  Termination: "6+ occurrences / 3 mo OR 3 finals / 12 mo — Termination eligible",
};

function daysBefore(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function OccurrencesPage() {
  const { employees, attendance } = useWorkforceData();
  const [asOf, setAsOf] = useState<string>("2026-06-10");
  const [manager, setManager] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const managers = useMemo(
    () => Array.from(new Set(employees.map((e) => e.manager))).sort(),
    [employees],
  );

  const window3m = daysBefore(asOf, 90);
  const window12m = daysBefore(asOf, 365);

  const rows = useMemo(() => {
    const visible = employees.filter((e) => manager === "all" || e.manager === manager);
    return visible
      .map((e) => {
        const empRecs = attendance.filter(
          (r) => r.employee_id === e.employee_id && r.occurrence && r.date <= asOf,
        );
        const in3m = empRecs.filter((r) => r.date >= window3m);
        const filtered3m =
          reasonFilter === "all"
            ? in3m
            : in3m.filter((r) => r.occurrence_reason === reasonFilter);
        const in12m = empRecs.filter((r) => r.date >= window12m);
        // Approximate "finals issued" as occurrences happening after employee hit 5 in any prior 3-mo window.
        // Simpler heuristic: count records whose notes contain "Final" OR where 12-month occurrence load triggered Final tier.
        const finals12m = in12m.filter((r) => /final/i.test(r.notes)).length;
        const count = filtered3m.length;
        const level = correctiveLevelFor(count, finals12m);
        const byReason: Record<string, number> = { Absence: 0, Tardy: 0, LeaveEarly: 0 };
        in3m.forEach((r) => {
          if (r.occurrence_reason) byReason[r.occurrence_reason] = (byReason[r.occurrence_reason] ?? 0) + 1;
        });
        const lastDate = empRecs.map((r) => r.date).sort().at(-1) ?? "";
        return { emp: e, count, finals12m, level, byReason, in3m, lastDate };
      })
      .filter((r) => (levelFilter === "all" ? true : r.level === levelFilter))
      .sort((a, b) => {
        const order: CorrectiveLevel[] = ["Termination", "Final", "Written", "Verbal", "None"];
        const d = order.indexOf(a.level) - order.indexOf(b.level);
        return d !== 0 ? d : b.count - a.count;
      });
  }, [employees, attendance, manager, asOf, window3m, window12m, reasonFilter, levelFilter]);

  const totals = useMemo(() => {
    const t: Record<CorrectiveLevel, number> = {
      None: 0, Verbal: 0, Written: 0, Final: 0, Termination: 0,
    };
    rows.forEach((r) => (t[r.level] += 1));
    return t;
  }, [rows]);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Occurrences & corrective actions
        </h1>
        <p className="text-sm text-muted-foreground">
          Rolling 3-month occurrence counts per employee. Tardies (≥15 min), early leaves
          (≥15 min), and absences each count as one occurrence.
        </p>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">As of</span>
            <Input
              type="date"
              value={asOf}
              onChange={(e) => e.target.value && setAsOf(e.target.value)}
              className="w-40"
            />
          </div>
          <Select value={manager} onValueChange={setManager}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Manager" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All managers</SelectItem>
              {managers.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Reason" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reasons</SelectItem>
              {(Object.keys(OCCURRENCE_REASON_LABEL) as Exclude<OccurrenceReason, "">[]).map((r) => (
                <SelectItem key={r} value={r}>{OCCURRENCE_REASON_LABEL[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Corrective level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {(["Termination", "Final", "Written", "Verbal", "None"] as CorrectiveLevel[]).map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["None", "Verbal", "Written", "Final", "Termination"] as CorrectiveLevel[]).map((l) => (
          <Card key={l}>
            <CardContent className="p-4">
              <Badge variant="secondary" className={"border-0 font-medium " + LEVEL_BADGE[l]}>
                {l}
              </Badge>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                {totals[l]}
              </div>
              <div className="text-[11px] leading-tight text-muted-foreground">
                {LEVEL_DESC[l]}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Employees ({rows.length}) — 3-mo window {window3m} → {asOf}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-4 py-2 font-medium">Manager</th>
                  <th className="px-4 py-2 font-medium text-right">3-mo count</th>
                  <th className="px-4 py-2 font-medium text-right">Absence</th>
                  <th className="px-4 py-2 font-medium text-right">Tardy</th>
                  <th className="px-4 py-2 font-medium text-right">Left Early</th>
                  <th className="px-4 py-2 font-medium text-right">Finals (12 mo)</th>
                  <th className="px-4 py-2 font-medium">Level</th>
                  <th className="px-4 py-2 font-medium">Last occurrence</th>
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
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-foreground">{r.count}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.byReason.Absence}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.byReason.Tardy}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.byReason.LeaveEarly}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.finals12m}</td>
                    <td className="px-4 py-2">
                      <Badge variant="secondary" className={"border-0 font-medium " + LEVEL_BADGE[r.level]}>
                        {r.level}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{r.lastDate || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        Thresholds: 3 occurrences / 3 mo → Verbal · 4 → Written · 5 → Final · 6 → Termination eligible.
        Additionally, 3 attendance Finals in any 12-month period → Termination eligible.
        Finals in the 12-mo column are counted from notes containing "Final".
      </p>
    </AppShell>
  );
}
