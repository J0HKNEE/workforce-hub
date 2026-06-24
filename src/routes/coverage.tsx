import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkforceData } from "@/hooks/use-workforce-data";
import {
  latestDate,
  loadCoverageTargets,
  eachDateInRange,
  type AttendanceType,
} from "@/lib/attendance";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/coverage")({
  head: () => ({
    meta: [
      { title: "Shift Coverage — Workforce" },
      {
        name: "description",
        content:
          "Expected vs. actual headcount by team and location across a selected date range.",
      },
    ],
  }),
  component: CoveragePage,
});

const WORKING: AttendanceType[] = ["Present", "Makeup", "ShortShift"];

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function CoveragePage() {
  const { employees, attendance } = useWorkforceData();
  const targetsQ = useQuery({
    queryKey: ["coverage-targets"],
    queryFn: loadCoverageTargets,
    staleTime: 60_000,
  });
  const targets = targetsQ.data ?? [];

  const today = latestDate(attendance);
  const [from, setFrom] = useState(() => addDays(today, -29));
  const [to, setTo] = useState(today);

  const preset = (days: number) => {
    setTo(today);
    setFrom(addDays(today, -(days - 1)));
  };

  const empById = useMemo(
    () => new Map(employees.map((e) => [e.employee_id, e])),
    [employees],
  );

  const rows = useMemo(() => {
    const dates = eachDateInRange(from, to);
    const dayCount = dates.length || 1;
    const dateSet = new Set(dates);

    // group key: team||location
    type Row = {
      team: string;
      location: string;
      expectedPerDay: number;
      expectedTotal: number;
      actualTotal: number;
    };
    const groups = new Map<string, Row>();

    // seed from targets so zero-actual rows still show
    targets.forEach((t) => {
      const k = `${t.team}||${t.location}`;
      groups.set(k, {
        team: t.team,
        location: t.location,
        expectedPerDay: t.expected_per_day,
        expectedTotal: t.expected_per_day * dayCount,
        actualTotal: 0,
      });
    });

    // count actual working person-days
    attendance.forEach((r) => {
      if (!dateSet.has(r.date)) return;
      if (!WORKING.includes(r.type)) return;
      const emp = empById.get(r.employee_id);
      if (!emp) return;
      const k = `${emp.team}||${emp.location}`;
      let g = groups.get(k);
      if (!g) {
        g = {
          team: emp.team,
          location: emp.location,
          expectedPerDay: 0,
          expectedTotal: 0,
          actualTotal: 0,
        };
        groups.set(k, g);
      }
      g.actualTotal += 1;
    });

    return Array.from(groups.values())
      .map((g) => {
        const actualPerDay = g.actualTotal / dayCount;
        const gap = actualPerDay - g.expectedPerDay;
        const pct =
          g.expectedPerDay === 0
            ? actualPerDay > 0
              ? 100
              : 0
            : Math.round((actualPerDay / g.expectedPerDay) * 100);
        return {
          ...g,
          dayCount,
          actualPerDay,
          gap,
          pct,
        };
      })
      .sort(
        (a, b) =>
          a.team.localeCompare(b.team) || a.location.localeCompare(b.location),
      );
  }, [attendance, empById, targets, from, to]);

  const totals = useMemo(() => {
    const expected = rows.reduce((s, r) => s + r.expectedPerDay, 0);
    const actual =
      rows.reduce((s, r) => s + r.actualPerDay, 0);
    const pct = expected === 0 ? 0 : Math.round((actual / expected) * 100);
    const gapRows = rows.filter((r) => r.actualPerDay < r.expectedPerDay).length;
    return { expected, actual, pct, gapRows };
  }, [rows]);

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Shift coverage
          </h1>
          <p className="text-sm text-muted-foreground">
            Expected vs. actual headcount by team and location across the
            selected range.
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <div>
            <Label htmlFor="to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => preset(7)}>
              7d
            </Button>
            <Button variant="outline" size="sm" onClick={() => preset(30)}>
              30d
            </Button>
            <Button variant="outline" size="sm" onClick={() => preset(90)}>
              90d
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Expected / day
            </div>
            <div className="text-3xl font-semibold text-foreground">
              {totals.expected}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Actual / day (avg)
            </div>
            <div className="text-3xl font-semibold text-foreground">
              {totals.actual.toFixed(1)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Coverage
            </div>
            <div className="text-3xl font-semibold text-foreground">
              {totals.pct}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Under-covered groups
            </div>
            <div className="text-3xl font-semibold text-destructive">
              {totals.gapRows}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">
            Expected vs. actual (avg / day)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows.map((r) => ({
                group: `${r.team} · ${r.location}`,
                Expected: r.expectedPerDay,
                Actual: Number(r.actualPerDay.toFixed(2)),
              }))}
            >
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="group"
                stroke="var(--muted-foreground)"
                fontSize={11}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={70}
              />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="Expected"
                fill="var(--chart-3)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="Actual"
                fill="var(--chart-2)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Team</th>
                <th className="px-4 py-2 font-medium">Location</th>
                <th className="px-4 py-2 text-right font-medium">
                  Expected/day
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  Actual/day
                </th>
                <th className="px-4 py-2 text-right font-medium">Gap</th>
                <th className="px-4 py-2 text-right font-medium">Coverage</th>
                <th className="px-4 py-2 text-right font-medium">
                  Days in range
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.team}-${r.location}`}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    {r.team}
                  </td>
                  <td className="px-4 py-2.5">{r.location}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.expectedPerDay}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                    {r.actualPerDay.toFixed(2)}
                  </td>
                  <td
                    className={
                      "px-4 py-2.5 text-right tabular-nums " +
                      (r.gap < 0
                        ? "text-destructive"
                        : "text-foreground/70")
                    }
                  >
                    {r.gap > 0 ? "+" : ""}
                    {r.gap.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-foreground">
                    {r.pct}%
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {r.dayCount}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No coverage targets defined. Add rows to{" "}
                    <code>public/data/coverage_targets.csv</code>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
