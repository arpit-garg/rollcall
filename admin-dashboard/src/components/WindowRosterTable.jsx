import { formatDate, formatDateTime } from "../utils/format.js";

const rosterStatusConfig = {
  marked: {
    label: "Marked",
    className: "bg-emerald-100 text-emerald-800"
  },
  on_leave: {
    label: "On leave",
    className: "bg-sky-100 text-sky-800"
  },
  absent: {
    label: "Not marked",
    className: "bg-rose-100 text-rose-800"
  }
};

const attendanceStatusClasses = {
  pending: "bg-amber-100 text-amber-800",
  verified: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800",
  overridden: "bg-sky-100 text-sky-800"
};

function formatLeaveRange(leaveRequest) {
  if (!leaveRequest) {
    return null;
  }

  if (leaveRequest.requestedFrom === leaveRequest.requestedTo) {
    return formatDate(leaveRequest.requestedFrom);
  }

  return `${formatDate(leaveRequest.requestedFrom)} to ${formatDate(leaveRequest.requestedTo)}`;
}

export default function WindowRosterTable({ roster, isLoading }) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-steel">
            <tr>
              <th className="px-5 py-4 font-semibold">Student</th>
              <th className="px-5 py-4 font-semibold">Room</th>
              <th className="px-5 py-4 font-semibold">Window Status</th>
              <th className="px-5 py-4 font-semibold">Attendance</th>
              <th className="px-5 py-4 font-semibold">Leave</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td className="px-5 py-8 text-steel" colSpan={5}>
                  Loading selected-window roster...
                </td>
              </tr>
            ) : roster.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-steel" colSpan={5}>
                  No active students found for this selected window.
                </td>
              </tr>
            ) : (
              roster.map((row) => {
                const status = rosterStatusConfig[row.windowStatus] || rosterStatusConfig.absent;
                const leaveRange = formatLeaveRange(row.leaveRequest);

                return (
                  <tr key={row.studentId} className="align-top">
                    <td className="px-5 py-4 font-medium text-ink">
                      <div>{row.studentName}</div>
                      <div className="mt-1 text-xs text-steel">{row.studentId}</div>
                    </td>
                    <td className="px-5 py-4 text-steel">{row.roomNumber || "--"}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-steel">
                      {row.attendanceRecord ? (
                        <div className="space-y-1">
                          <span
                            className={[
                              "inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize",
                              attendanceStatusClasses[row.attendanceRecord.status] || "bg-slate-100 text-slate-700"
                            ].join(" ")}
                          >
                            {row.attendanceRecord.status}
                          </span>
                          <div>{formatDateTime(row.attendanceRecord.submittedAt)}</div>
                          {row.leaveRequest ? (
                            <div className="text-xs font-medium text-sky-700">
                              Approved leave cancelled by attendance.
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span>--</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-steel">
                      {row.leaveRequest ? (
                        <div className="space-y-1">
                          <div className="font-medium text-ink">{leaveRange}</div>
                          <div>{row.leaveRequest.destination}</div>
                          <div className="text-xs">{row.leaveRequest.reason}</div>
                        </div>
                      ) : (
                        <span>--</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
