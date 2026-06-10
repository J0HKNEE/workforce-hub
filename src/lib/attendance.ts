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

export interface AttendanceRecord {
  date: string; // YYYY-MM-DD
  employee_id: string;
  type: AttendanceType;
  hours: number;
  notes: string;
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
    notes: r.notes || "",
  }));
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
