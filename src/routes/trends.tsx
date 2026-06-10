import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkforceData } from "@/hooks/use-workforce-data";
import { TYPE_LABEL, type AttendanceType } from "@/lib/attendance";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

export const Route = createFileRoute("/trends")({
  head: () => ({
    meta: [
      { title: "Trends — Workforce" },
      {
        name: "description",
        content:
          "Absences, PTO, short shifts, and makeup time over time, with per-employee leaderboards.",
      },
    ],
  }),
  component: TrendsPage,
});

const TYPES: AttendanceType[] = ["Present", "Absent", "PTO", "ShortShift", "Makeup"];
const CHART_COLOR: Record<AttendanceType, string> = {
  Present: "var(--chart-2)",
  Absent: "var(--destructive)",
  PTO: "var(--chart-4)",
  ShortShift: "var(--chart-5)",
  Makeup: "var(--chart-1)",
};

function TrendsPage() {
  const { attendance, employees } = useWorkforceData();

  const byDate = useMemo(() => {
    const m = new Map<string, Record<string, string | number>>();
    attendance.forEach((r) => {
      const row = m.get(r.date) ?? ({ date: r.date } as Record<string, string | number>);
      row[r.type] = ((row[r.type] as number) ?? 0) + 1;
      m.set(r.date, row);
    });
    return Array.from(m.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
  }, [attendance]);

  const absencesByEmployee = useMemo(() => {
    const m = new Map<string, number>();
    attendance.forEach((r) => {
      if (r.type === "Absent") {
        m.set(r.employee_id, (m.get(r.employee_id) ?? 0) + 1);
      }
    });
    const nameOf = new Map(employees.map((e) => [e.employee_id, e.name]));
    return Array.from(m.entries())
      .map(([id, count]) => ({ id, name: nameOf.get(id) ?? id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [attendance, employees]);

  const ptoHours = useMemo(() => {
    const m = new Map<string, number>();
    attendance.forEach((r) => {
      if (r.type === "PTO") {
        m.set(r.employee_id, (m.get(r.employee_id) ?? 0) + r.hours);
      }
    });
    const nameOf = new Map(employees.map((e) => [e.employee_id, e.name]));
    return Array.from(m.entries())
      .map(([id, hours]) => ({ name: nameOf.get(id) ?? id, hours }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);
  }, [attendance, employees]);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Attendance trends
        </h1>
        <p className="text-sm text-muted-foreground">
          Patterns across all employees and dates in your attendance log.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Daily mix by type</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDate}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
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
              {TYPES.map((t) => (
                <Bar
                  key={t}
                  dataKey={t}
                  name={TYPE_LABEL[t]}
                  stackId="a"
                  fill={CHART_COLOR[t]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top absences (employees)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={absencesByEmployee} layout="vertical">
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" name="Absences" fill="var(--destructive)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">PTO hours used</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ptoHours}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="hours" stroke="var(--chart-4)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
