import { useQuery } from "@tanstack/react-query";
import SummaryCard from "../components/SummaryCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { formatDateTime } from "../utils/format.js";

const statusClasses = {
  pending: "bg-amber-100 text-amber-800",
  verified: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800",
  overridden: "bg-sky-100 text-sky-800"
};

export default function StudentSummaryPage() {
  const { authorizedRequest } = useAuth();

  const summariesQuery = useQuery({
    queryKey: ["student-summaries"],
    queryFn: async () => {
      const response = await authorizedRequest("/attendance/students/summary");
      return response.data || [];
    },
    refetchInterval: 10000
  });

  const summaries = summariesQuery.data || [];
  const studentsWithVerified = summaries.filter((student) => student.verifiedCount > 0).length;
  const studentsNeedingReview = summaries.filter((student) => student.failedCount > 0 || student.pendingCount > 0).length;
  const studentsWithoutSubmissions = summaries.filter((student) => !student.lastSubmittedAt).length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">Student-wise Attendance</h2>
          <p className="text-sm text-steel">
            Every resident in the current warden scope with their cumulative attendance record.
          </p>
        </div>
        <div className="rounded-full bg-white px-4 py-2 text-sm text-steel shadow-sm ring-1 ring-slate-200">
          {summariesQuery.isLoading ? "Refreshing roster..." : `${summaries.length} active students in this hostel`}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Students" value={String(summaries.length)} accent="#114b5f" />
        <SummaryCard label="Verified At Least Once" value={String(studentsWithVerified)} accent="#1f7a5c" />
        <SummaryCard label="Needs Review" value={String(studentsNeedingReview)} accent="#ef8354" />
        <SummaryCard label="No Submissions Yet" value={String(studentsWithoutSubmissions)} accent="#6b7280" />
      </div>

      {summariesQuery.error ? (
        <div className="rounded-[1.5rem] bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {summariesQuery.error.message}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-steel">
              <tr>
                <th className="px-5 py-4 font-semibold">Student</th>
                <th className="px-5 py-4 font-semibold">Room</th>
                <th className="px-5 py-4 font-semibold">Verified</th>
                <th className="px-5 py-4 font-semibold">Failed</th>
                <th className="px-5 py-4 font-semibold">Pending</th>
                <th className="px-5 py-4 font-semibold">Overrides</th>
                <th className="px-5 py-4 font-semibold">Last Status</th>
                <th className="px-5 py-4 font-semibold">Last Submission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summaries.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-steel" colSpan={8}>
                    {summariesQuery.isLoading
                      ? "Loading student summaries..."
                      : "No active hostel students found for this warden."}
                  </td>
                </tr>
              ) : (
                summaries.map((student) => (
                  <tr key={student.studentId}>
                    <td className="px-5 py-4 font-medium text-ink">
                      <div>{student.studentName}</div>
                      <div className="mt-1 text-xs text-steel">{student.studentId}</div>
                    </td>
                    <td className="px-5 py-4 text-steel">{student.roomNumber || "--"}</td>
                    <td className="px-5 py-4 text-steel">{student.verifiedCount}</td>
                    <td className="px-5 py-4 text-steel">{student.failedCount}</td>
                    <td className="px-5 py-4 text-steel">{student.pendingCount}</td>
                    <td className="px-5 py-4 text-steel">{student.overriddenCount}</td>
                    <td className="px-5 py-4">
                      {student.lastStatus ? (
                        <span
                          className={[
                            "inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize",
                            statusClasses[student.lastStatus] || "bg-slate-100 text-slate-700"
                          ].join(" ")}
                        >
                          {student.lastStatus}
                        </span>
                      ) : (
                        <span className="text-steel">No submissions</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-steel">{formatDateTime(student.lastSubmittedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
