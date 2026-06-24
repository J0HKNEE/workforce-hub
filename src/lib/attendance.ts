export type AttendanceType =
  | "Present"
  | "Absent"
  | "PTO"
  | "ShortShift"
  | "Makeup";

export interface Employee {
  employee_id: string;
  name: string;
  team: string;
  location: string;
  manager: string;
  status: string;
}

export type OccurrenceReason = "Absence" | "Tardy" | "LeaveEarly" | "";

export interface AttendanceRecord {
  date: string; // YYYY-MM-DD
  employee_id: string;
  type: AttendanceType;
  hours: number;
  occurrence: boolean;
  occurrence_reason: OccurrenceReason;
  notes: string;
}

export const OCCURRENCE_REASON_LABEL: Record<Exclude<OccurrenceReason, "">, string> = {
  Absence: "Absence",
  Tardy: "Tardy (≥15 min)",
  LeaveEarly: "Left Early (≥15 min)",
};

export type CorrectiveLevel = "None" | "Verbal" | "Written" | "Final" | "Termination";

export function correctiveLevelFor(count: number, finals12m: number): CorrectiveLevel {
  if (finals12m >= 3) return "Termination";
  if (count >= 6) return "Termination";
  if (count >= 5) return "Final";
  if (count >= 4) return "Written";
  if (count >= 3) return "Verbal";
  return "None";
}

// Minimal CSV parser (handles quoted fields with commas)
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inQ = false;
        } else {
          cur += c;
        }
      } else {
        if (c === ",") {
          out.push(cur);
          cur = "";
        } else if (c === '"') {
          inQ = true;
        } else {
          cur += c;
        }
      }
    }
    out.push(cur);
    return out;
  };
  const headers = splitLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

export async function loadEmployees(): Promise<Employee[]> {
  const res = await fetch("/data/employees.csv");
  const text = await res.text();
  return parseCSV(text).map((r) => ({
    employee_id: r.employee_id,
    name: r.name,
    team: r.team,
    location: r.location,
    manager: r.manager,
    status: r.status || "Active",
  }));
}

export async function loadAttendance(): Promise<AttendanceRecord[]> {
  const res = await fetch("/data/attendance.csv");
  const text = await res.text();
  return parseCSV(text).map((r) => ({
    date: r.date,
    employee_id: r.employee_id,
    type: (r.type as AttendanceType) || "Present",
    hours: Number(r.hours) || 0,
    occurrence: /^(true|1|yes|y)$/i.test(r.occurrence || ""),
    occurrence_reason: (r.occurrence_reason as OccurrenceReason) || "",
    notes: r.notes || "",
  }));
}

export interface CoverageTarget {
  team: string;
  location: string;
  expected_per_day: number;
}

export async function loadCoverageTargets(): Promise<CoverageTarget[]> {
  const res = await fetch("/data/coverage_targets.csv");
  if (!res.ok) return [];
  const text = await res.text();
  return parseCSV(text).map((r) => ({
    team: r.team,
    location: r.location,
    expected_per_day: Number(r.expected_per_day) || 0,
  }));
}

export function eachDateInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function latestDate(records: AttendanceRecord[]): string {
  if (records.length === 0) return new Date().toISOString().slice(0, 10);
  return records.map((r) => r.date).sort().at(-1)!;
}

export const TYPE_COLORS: Record<AttendanceType, string> = {
  Present: "var(--chart-2)",
  Absent: "var(--destructive)",
  PTO: "var(--chart-4)",
  ShortShift: "var(--chart-5)",
  Makeup: "var(--chart-1)",
};

export const TYPE_LABEL: Record<AttendanceType, string> = {
  Present: "Present",
  Absent: "Absent",
  PTO: "PTO",
  ShortShift: "Short Shift",
  Makeup: "Makeup Time",
};
