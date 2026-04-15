import RecordTable from "../components/RecordTable.jsx";

const overrideRecords = [
  {
    id: "o-1",
    name: "Kabir Singh",
    room: "A-211",
    status: "overridden",
    submittedAt: "21:20",
    reason: "Student verified in person after failed liveness."
  },
  {
    id: "o-2",
    name: "Sneha Rao",
    room: "A-118",
    status: "overridden",
    submittedAt: "21:23",
    reason: "Phone battery died; warden cross-checked room presence."
  }
];

export default function OverrideLogPage() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Override Log</h2>
        <p className="text-sm text-steel">
          Read-only audit view for manual attendance actions. Wire this page to
          `GET /attendance/overrides` in the next slice.
        </p>
      </div>
      <RecordTable records={overrideRecords} showReason />
    </section>
  );
}
