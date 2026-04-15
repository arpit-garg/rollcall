const statusClasses = {
  pending: "bg-amber-100 text-amber-800",
  verified: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800",
  overridden: "bg-sky-100 text-sky-800"
};

export default function RecordTable({ records, showReason = false }) {
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
              {showReason ? <th className="px-5 py-4 font-semibold">Reason</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((record) => (
              <tr key={record.id} className="align-top">
                <td className="px-5 py-4 font-medium text-ink">{record.name}</td>
                <td className="px-5 py-4 text-steel">{record.room}</td>
                <td className="px-5 py-4">
                  <span
                    className={[
                      "inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize",
                      statusClasses[record.status]
                    ].join(" ")}
                  >
                    {record.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-steel">{record.submittedAt}</td>
                {showReason ? <td className="px-5 py-4 text-steel">{record.reason}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
