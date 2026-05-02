import { Fragment } from "react";
import { formatDateTime, formatScore } from "../utils/format.js";

const statusClasses = {
  pending: "bg-amber-100 text-amber-800",
  verified: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800",
  overridden: "bg-sky-100 text-sky-800"
};

export default function RecordTable({
  records,
  activeOverrideRecordId,
  overrideReason,
  onOverrideReasonChange,
  onStartOverride,
  onCancelOverride,
  onSubmitOverride,
  isSubmittingOverride
}) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-steel">
            <tr>
              <th className="px-5 py-4 font-semibold">Student</th>
              <th className="px-5 py-4 font-semibold">Room</th>
              <th className="px-5 py-4 font-semibold">Status</th>
              <th className="px-5 py-4 font-semibold">Submitted</th>
              <th className="px-5 py-4 font-semibold">Scores</th>
              <th className="px-5 py-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-steel" colSpan={6}>
                  No attendance records found for this window yet.
                </td>
              </tr>
            ) : (
              records.map((record) => {
                const showOverrideEditor = activeOverrideRecordId === record.id;
                const canOverride = record.status !== "overridden";

                return (
                  <Fragment key={record.id}>
                    <tr className="align-top">
                      <td className="px-5 py-4 font-medium text-ink">
                        <div>{record.studentName}</div>
                        <div className="mt-1 text-xs text-steel">{record.studentId}</div>
                      </td>
                      <td className="px-5 py-4 text-steel">{record.roomNumber || "--"}</td>
                      <td className="px-5 py-4">
                        <span
                          className={[
                            "inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize",
                            statusClasses[record.status] || "bg-slate-100 text-slate-700"
                          ].join(" ")}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-steel">{formatDateTime(record.submittedAt)}</td>
                      <td className="px-5 py-4 text-steel">
                        <div>Face: {formatScore(record.faceScore)}</div>
                        <div className="mt-1">Live: {formatScore(record.livenessScore)}</div>
                      </td>
                      <td className="px-5 py-4">
                        {canOverride ? (
                          <button
                            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-ink transition hover:border-ink hover:bg-slate-50"
                            type="button"
                            onClick={() => onStartOverride(record)}
                          >
                            Override
                          </button>
                        ) : (
                          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                            Completed
                          </span>
                        )}
                      </td>
                    </tr>
                    {showOverrideEditor ? (
                      <tr>
                        <td className="bg-slate-50 px-5 py-4" colSpan={6}>
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                            <label className="flex-1">
                              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-steel">
                                Override Reason
                              </span>
                              <textarea
                                className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                                value={overrideReason}
                                onChange={(event) => onOverrideReasonChange(event.target.value)}
                                placeholder="Record why the biometric flow was bypassed."
                              />
                            </label>
                            <div className="flex gap-3">
                              <button
                                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-steel transition hover:border-slate-300 hover:bg-white"
                                type="button"
                                onClick={onCancelOverride}
                              >
                                Cancel
                              </button>
                              <button
                                className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                                type="button"
                                onClick={() => onSubmitOverride(record.id)}
                                disabled={isSubmittingOverride}
                              >
                                {isSubmittingOverride ? "Saving..." : "Confirm Override"}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
