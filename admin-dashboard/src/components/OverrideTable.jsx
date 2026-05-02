import { formatDateTime } from "../utils/format.js";

export default function OverrideTable({ records }) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-steel">
            <tr>
              <th className="px-5 py-4 font-semibold">Student</th>
              <th className="px-5 py-4 font-semibold">Room</th>
              <th className="px-5 py-4 font-semibold">Warden</th>
              <th className="px-5 py-4 font-semibold">Override Time</th>
              <th className="px-5 py-4 font-semibold">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-steel" colSpan={5}>
                  No overrides match the current filters.
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id} className="align-top">
                  <td className="px-5 py-4 font-medium text-ink">{record.studentName}</td>
                  <td className="px-5 py-4 text-steel">{record.roomNumber || "--"}</td>
                  <td className="px-5 py-4 text-steel">{record.wardenName || record.wardenId}</td>
                  <td className="px-5 py-4 text-steel">{formatDateTime(record.overrideAt)}</td>
                  <td className="px-5 py-4 text-steel">{record.reason}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
