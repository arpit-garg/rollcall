import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import OverrideTable from "../components/OverrideTable.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function matchesDateRange(record, fromDate, toDate) {
  const value = new Date(record.overrideAt);

  if (fromDate) {
    const from = new Date(fromDate);
    if (value < from) {
      return false;
    }
  }

  if (toDate) {
    const to = new Date(`${toDate}T23:59:59`);
    if (value > to) {
      return false;
    }
  }

  return true;
}

export default function OverrideLogPage() {
  const { authorizedRequest } = useAuth();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const overridesQuery = useQuery({
    queryKey: ["overrides"],
    queryFn: async () => {
      const response = await authorizedRequest("/attendance/overrides");
      return response.data || [];
    },
    refetchInterval: 10000
  });

  const records = (overridesQuery.data || []).filter((record) =>
    matchesDateRange(record, fromDate, toDate)
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Override Log</h2>
          <p className="text-sm text-steel">
            Read-only audit view for manual attendance actions, refreshed from the live backend.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-steel">
              From Date
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-steel">
              To Date
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>
        </div>
      </div>

      {overridesQuery.error ? (
        <div className="rounded-[1.5rem] bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {overridesQuery.error.message}
        </div>
      ) : null}

      <div className="rounded-[1.5rem] bg-white px-5 py-4 text-sm text-steel shadow-sm ring-1 ring-slate-200">
        {overridesQuery.isLoading
          ? "Loading override history..."
          : `${records.length} override records match the current date range.`}
      </div>

      <OverrideTable records={records} />
    </section>
  );
}
