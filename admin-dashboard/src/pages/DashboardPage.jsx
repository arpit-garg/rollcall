import SummaryCard from "../components/SummaryCard.jsx";
import RecordTable from "../components/RecordTable.jsx";

const records = [
  {
    id: "1",
    name: "Aarav Student",
    room: "A-102",
    status: "verified",
    submittedAt: "21:08"
  },
  {
    id: "2",
    name: "Riya Sharma",
    room: "A-204",
    status: "pending",
    submittedAt: "21:11"
  },
  {
    id: "3",
    name: "Kabir Singh",
    room: "A-211",
    status: "failed",
    submittedAt: "21:14"
  }
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Active Window" value="9:00 PM - 10:00 PM" accent="#ef8354" />
        <SummaryCard label="Verified" value="124" accent="#1f7a5c" />
        <SummaryCard label="Pending" value="08" accent="#f6ad55" />
        <SummaryCard label="Overrides" value="03" accent="#118ab2" />
      </section>

      <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Live Attendance Feed</h2>
              <p className="text-sm text-steel">
                Replace this mock data with Socket.IO-driven updates in the next slice.
              </p>
            </div>
            <button className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
              Open New Window
            </button>
          </div>
          <RecordTable records={records} />
        </div>

        <aside className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm uppercase tracking-[0.2em] text-steel">Action Queue</p>
          <div className="mt-4 space-y-4">
            <div className="rounded-3xl bg-rose-50 p-4">
              <p className="font-semibold text-rose-800">1 failed verification needs review</p>
              <p className="mt-1 text-sm text-rose-700">
                Kabir Singh submitted from within the geofence but failed liveness.
              </p>
            </div>
            <div className="rounded-3xl bg-sky-50 p-4">
              <p className="font-semibold text-sky-800">2 overrides logged today</p>
              <p className="mt-1 text-sm text-sky-700">
                Audit trail is ready for export once reporting endpoints are wired.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
