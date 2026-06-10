import { useQuery } from "@tanstack/react-query";
import { loadAttendance, loadEmployees } from "@/lib/attendance";

export function useWorkforceData() {
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: loadEmployees,
    staleTime: 60_000,
  });
  const attendance = useQuery({
    queryKey: ["attendance"],
    queryFn: loadAttendance,
    staleTime: 60_000,
  });
  return {
    employees: employees.data ?? [],
    attendance: attendance.data ?? [],
    isLoading: employees.isLoading || attendance.isLoading,
    error: employees.error ?? attendance.error,
  };
}
