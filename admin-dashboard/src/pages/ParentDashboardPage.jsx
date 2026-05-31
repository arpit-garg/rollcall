import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import SummaryCard from "../components/SummaryCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { formatDate, formatDateTime, formatScore } from "../utils/format.js";

const leaveStatusClasses = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800"
};

const attendanceStatusClasses = {
  pending: "bg-amber-100 text-amber-800",
  verified: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800",
  overridden: "bg-sky-100 text-sky-800"
};

function createEmptyAttendanceSummary() {
  return {
    verifiedCount: 0,
    failedCount: 0,
    pendingCount: 0,
    overriddenCount: 0
  };
}

function formatLeaveWindow(requestedFrom, requestedTo) {
  return `${formatDate(requestedFrom)} to ${formatDate(requestedTo)}`;
}

export default function ParentDashboardPage() {
  const queryClient = useQueryClient();
  const { authorizedRequest } = useAuth();
  const [decisionNotes, setDecisionNotes] = useState({});

  const attendanceQuery = useQuery({
    queryKey: ["parent-child-attendance"],
    queryFn: async () => {
      const response = await authorizedRequest("/attendance/children");
      return response.data || null;
    },
    refetchInterval: 10000
  });

  const leaveRequestsQuery = useQuery({
    queryKey: ["parent-leave-requests"],
    queryFn: async () => {
      const response = await authorizedRequest("/leaves");
      return response.data || [];
    },
    refetchInterval: 10000
  });

  const decisionMutation = useMutation({
    mutationFn: async ({ leaveId, decision, note }) => {
      const response = await authorizedRequest(`/leaves/${leaveId}/decision`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          decision,
          note
        })
      });

      return response.data;
    },
    onSuccess: async (_result, variables) => {
      setDecisionNotes((currentNotes) => ({
        ...currentNotes,
        [variables.leaveId]: ""
      }));

      await queryClient.invalidateQueries({
        queryKey: ["parent-leave-requests"]
      });
    }
  });

  const attendanceData = attendanceQuery.data;
  const student = attendanceData?.student || null;
  const attendanceSummary = attendanceData?.summary || createEmptyAttendanceSummary();
  const attendanceHistory = attendanceData?.history || [];
  const leaveRequests = leaveRequestsQuery.data || [];
  const pendingLeaveCount = leaveRequests.filter((request) => request.status === "pending").length;
  const approvedLeaveCount = leaveRequests.filter((request) => request.status === "approved").length;
  const rejectedLeaveCount = leaveRequests.filter((request) => request.status === "rejected").length;
  const pageError =
    attendanceQuery.error?.message ||
    leaveRequestsQuery.error?.message ||
    decisionMutation.error?.message ||
    "";

  function handleDecisionNoteChange(leaveId, value) {
    setDecisionNotes((currentNotes) => ({
      ...currentNotes,
      [leaveId]: value
    }));
  }

  async function handleDecision(leaveId, decision) {
    await decisionMutation.mutateAsync({
      leaveId,
      decision,
      note: decisionNotes[leaveId] || ""
    });
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Linked Student"
          value={student?.name || "Awaiting data"}
          helper={student?.roomNumber ? `Room ${student.roomNumber}` : "Linked child profile"}
          accent="#114b5f"
        />
        <SummaryCard label="Verified" value={String(attendanceSummary.verifiedCount)} accent="#1f7a5c" />
        <SummaryCard label="Pending Leaves" value={String(pendingLeaveCount)} accent="#ef8354" />
        <SummaryCard
          label="Rejected Leaves"
          value={String(rejectedLeaveCount)}
          helper={`${approvedLeaveCount} approved`}
          accent="#b91c1c"
        />
      </section>

      {pageError ? (
        <section className="rounded-[1.5rem] bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {pageError}
        </section>
      ) : null}

      <section className="grid gap-8 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-steel">Child Attendance</p>
                <h2 className="mt-2 text-xl font-semibold text-ink">
                  {student ? `${student.name}'s attendance trail` : "Loading linked child"}
                </h2>
              </div>
              {student?.roomNumber ? (
                <div className="rounded-full bg-slate-50 px-4 py-2 text-sm text-steel">
                  Room {student.roomNumber}
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Verified</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{attendanceSummary.verifiedCount}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Failed</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{attendanceSummary.failedCount}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Pending</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{attendanceSummary.pendingCount}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Overridden</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{attendanceSummary.overriddenCount}</p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-steel">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Submitted</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Face Score</th>
                    <th className="px-4 py-3 font-semibold">Liveness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceHistory.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-steel" colSpan={4}>
                        {attendanceQuery.isLoading
                          ? "Loading attendance history..."
                          : "No attendance entries are available for the linked child yet."}
                      </td>
                    </tr>
                  ) : (
                    attendanceHistory.map((record) => (
                      <tr key={record.id}>
                        <td className="px-4 py-4 text-steel">{formatDateTime(record.submittedAt)}</td>
                        <td className="px-4 py-4">
                          <span
                            className={[
                              "inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize",
                              attendanceStatusClasses[record.status] || "bg-slate-100 text-slate-700"
                            ].join(" ")}
                          >
                            {record.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-steel">{formatScore(record.faceScore)}</td>
                        <td className="px-4 py-4 text-steel">{formatScore(record.livenessScore)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm uppercase tracking-[0.2em] text-steel">Leave Approval</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Review student leave requests</h2>
            <p className="mt-2 text-sm text-steel">
              Pending requests can be approved or rejected directly from this queue.
            </p>

            <div className="mt-5 space-y-4">
              {leaveRequests.length === 0 ? (
                <div className="rounded-3xl bg-slate-50 px-4 py-5 text-sm text-steel">
                  {leaveRequestsQuery.isLoading
                    ? "Loading leave requests..."
                    : "No leave requests are linked to this parent account yet."}
                </div>
              ) : (
                leaveRequests.map((request) => {
                  const isPending = request.status === "pending";
                  const isSubmittingCurrentDecision =
                    decisionMutation.isPending && decisionMutation.variables?.leaveId === request.id;

                  return (
                    <article key={request.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-ink">{formatLeaveWindow(request.requestedFrom, request.requestedTo)}</p>
                          <p className="mt-1 text-sm text-steel">
                            Destination: {request.destination}
                          </p>
                        </div>
                        <span
                          className={[
                            "inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize",
                            leaveStatusClasses[request.status] || "bg-slate-100 text-slate-700"
                          ].join(" ")}
                        >
                          {request.status}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-steel">{request.reason}</p>

                      {request.parentNote ? (
                        <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-steel ring-1 ring-slate-200">
                          Parent note: {request.parentNote}
                        </div>
                      ) : null}

                      {isPending ? (
                        <div className="mt-4 space-y-3">
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-steel">
                              Decision Note
                            </span>
                            <textarea
                              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                              value={decisionNotes[request.id] || ""}
                              onChange={(event) => handleDecisionNoteChange(request.id, event.target.value)}
                              placeholder="Optional note for the student"
                            />
                          </label>

                          <div className="flex gap-3">
                            <button
                              className="flex-1 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                              type="button"
                              onClick={() => handleDecision(request.id, "approved")}
                              disabled={isSubmittingCurrentDecision}
                            >
                              {isSubmittingCurrentDecision ? "Saving..." : "Approve Leave"}
                            </button>
                            <button
                              className="flex-1 rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                              type="button"
                              onClick={() => handleDecision(request.id, "rejected")}
                              disabled={isSubmittingCurrentDecision}
                            >
                              {isSubmittingCurrentDecision ? "Saving..." : "Reject Leave"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-steel">
                          Decision recorded {request.decidedAt ? formatDateTime(request.decidedAt) : ""}
                        </p>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
