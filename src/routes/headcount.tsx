import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkforceData } from "@/hooks/use-workforce-data";
import { latestDate, type AttendanceType } from "@/lib/attendance";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export const Route = createFileRoute("/headcount")({
  head: () => ({
    meta: [
      { title: "Headcount — Workforce" },
      {
        name: "description",
        content:
          "Active headcount, scheduled vs. actual coverage, and gaps by team and location.",
      },
    ],
  }),
  component: HeadcountPage,
});

const WORKING: AttendanceType[] = ["Present", "Makeup"];

function HeadcountPage() {
  const { employees, attendance } = useWorkforceData();
  const today = latestDate(attendance);
  const todays = attendance.filter((a) => a.date === today);
  const recByEmp = new Map(todays.map((r) => [r.employee_id, r]));

  const byTeam = useMemo(() => {
    const groups = new Map<
      string,
      { team: string; scheduled: number; working: number; out: number }
    >();
    employees
      .filter((e) => e.status === "Active")
      .forEach((e) => {
        const g =
          groups.get(e.team) ?? { team: e.team, scheduled: 0, working: 0, out: 0 };
        g.scheduled += 1;
        const rec = recByEmp.get(e.employee_id);
        if (rec && WORKING.includes(rec.type)) g.working += 1;
        else g.out += 1;
        groups.set(e.team, g);
      });
    return Array.from(groups.values());
  }, [employees, recByEmp]);

  const byLocation = useMemo(() => {
    const m = new Map<string, number>();
    employees
      .filter((e) => e.status === "Active")
      .forEach((e) => m.set(e.location, (m.get(e.location) ?? 0) + 1));
    return Array.from(m.entries()).map(([location, value]) => ({
      location,
      value,
    }));
  }, [employees]);

  const totalActive = employees.filter((e) => e.status === "Active").length;
  const totalWorking = byTeam.reduce((s, g) => s + g.working, 0);
  const overallCoverage =
    totalActive === 0 ? 0 : Math.round((totalWorking / totalActive) * 100);

  const PIE_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Headcount & coverage
        </h1>
        <p className="text-sm text-muted-foreground">
          Active roster and today&apos;s coverage by team and location ({today}).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Active headcount
            </div>
            <div className="text-3xl font-semibold text-foreground">
              {totalActive}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Working today
            </div>
            <div className="text-3xl font-semibold text-foreground">
              {totalWorking}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Coverage
            </div>
            <div className="text-3xl font-semibold text-foreground">
              {overallCoverage}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Scheduled vs. working by team
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byTeam}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="team" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="scheduled" name="Scheduled" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="working" name="Working" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="out" name="Out" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By location</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byLocation}
                  dataKey="value"
                  nameKey="location"
                  outerRadius={90}
                  label={(e) => `${e.location}: ${e.value}`}
                >
                  {byLocation.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Coverage gaps by team</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Team</th>
                <th className="px-4 py-2 text-right font-medium">Scheduled</th>
                <th className="px-4 py-2 text-right font-medium">Working</th>
                <th className="px-4 py-2 text-right font-medium">Out</th>
                <th className="px-4 py-2 text-right font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {byTeam.map((g) => {
                const pct =
                  g.scheduled === 0 ? 0 : Math.round((g.working / g.scheduled) * 100);
                return (
                  <tr key={g.team} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {g.team}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {g.scheduled}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {g.working}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-destructive">
                      {g.out}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-foreground">
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
