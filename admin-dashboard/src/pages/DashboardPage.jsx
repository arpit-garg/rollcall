import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import RecordTable from "../components/RecordTable.jsx";
import SummaryCard from "../components/SummaryCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  createDefaultWindowFormValues,
  formatDateTime,
  formatWindowLabel
} from "../utils/format.js";
import { useSocket } from "../hooks/useSocket.js";

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { authorizedRequest } = useAuth();
  const [selectedWindowId, setSelectedWindowId] = useState("");
  const [windowForm, setWindowForm] = useState(createDefaultWindowFormValues);
  const [overrideRecord, setOverrideRecord] = useState(null);
  const [overrideReason, setOverrideReason] = useState("");

  const { socket, isConnected } = useSocket();

  const healthQuery = useQuery({
    queryKey: ["queue-health"],
    queryFn: async () => {
      const response = await fetch(
        (import.meta.env.VITE_ATTENDANCE_API_BASE_URL || "http://localhost:3002").replace(/\/api\/v1$/, "") + "/health"
      );
      if (!response.ok) throw new Error("Health check failed");
      return response.json();
    },
    refetchInterval: 10000
  });

  useEffect(() => {
    if (!socket) return;

    function handleResolved() {
      queryClient.invalidateQueries({ queryKey: ["window-records"] });
      queryClient.invalidateQueries({ queryKey: ["queue-health"] });
    }

    socket.on("attendance:resolved", handleResolved);
    return () => socket.off("attendance:resolved", handleResolved);
  }, [socket, queryClient]);

  const windowsQuery = useQuery({
    queryKey: ["windows"],
    queryFn: async () => {
      const response = await authorizedRequest("/windows");
      return response.data || [];
    },
    refetchInterval: 5000
  });

  const overridesQuery = useQuery({
    queryKey: ["overrides"],
    queryFn: async () => {
      const response = await authorizedRequest("/attendance/overrides");
      return response.data || [];
    },
    refetchInterval: 10000
  });

  const recordsQuery = useQuery({
    queryKey: ["window-records", selectedWindowId],
    enabled: Boolean(selectedWindowId),
    queryFn: async () => {
      const response = await authorizedRequest(`/windows/${selectedWindowId}/records`);
      return response.data || [];
    },
    refetchInterval: selectedWindowId ? 3000 : false
  });

  useEffect(() => {
    if (!windowsQuery.data?.length) {
      setSelectedWindowId("");
      return;
    }

    const hasSelectedWindow = windowsQuery.data.some((window) => window.id === selectedWindowId);

    if (!selectedWindowId || !hasSelectedWindow) {
      setSelectedWindowId(windowsQuery.data[0].id);
    }
  }, [selectedWindowId, windowsQuery.data]);

  const openWindowMutation = useMutation({
    mutationFn: async () =>
      authorizedRequest("/windows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          opens_at: new Date(windowForm.opensAt).toISOString(),
          closes_at: new Date(windowForm.closesAt).toISOString()
        })
      }),
    onSuccess: async () => {
      setWindowForm(createDefaultWindowFormValues());
      await queryClient.invalidateQueries({
        queryKey: ["windows"]
      });
    }
  });

  const closeWindowMutation = useMutation({
    mutationFn: async (windowId) =>
      authorizedRequest(`/windows/${windowId}/close`, {
        method: "PATCH"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["windows"]
      });
      await queryClient.invalidateQueries({
        queryKey: ["window-records"]
      });
    }
  });

  const overrideMutation = useMutation({
    mutationFn: async (recordId) =>
      authorizedRequest(`/attendance/${recordId}/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reason: overrideReason
        })
      }),
    onSuccess: async () => {
      setOverrideRecord(null);
      setOverrideReason("");
      await queryClient.invalidateQueries({
        queryKey: ["window-records"]
      });
      await queryClient.invalidateQueries({
        queryKey: ["overrides"]
      });
    }
  });

  const windows = windowsQuery.data || [];
  const records = recordsQuery.data || [];
  const overrides = overridesQuery.data || [];
  const selectedWindow = windows.find((window) => window.id === selectedWindowId) || null;
  const verifiedCount = records.filter((record) => record.status === "verified").length;
  const pendingCount = records.filter((record) => record.status === "pending").length;
  const failedCount = records.filter((record) => record.status === "failed").length;
  const selectedWindowOverrideCount = records.filter((record) => record.status === "overridden").length;
  const isBusy =
    windowsQuery.isLoading ||
    recordsQuery.isLoading ||
    openWindowMutation.isPending ||
    closeWindowMutation.isPending;
  const pageError =
    windowsQuery.error?.message ||
    recordsQuery.error?.message ||
    overridesQuery.error?.message ||
    openWindowMutation.error?.message ||
    closeWindowMutation.error?.message ||
    overrideMutation.error?.message ||
    "";

  function handleWindowFieldChange(field, value) {
    setWindowForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function handleStartOverride(record) {
    setOverrideRecord(record);
    setOverrideReason("");
  }

  function handleCancelOverride() {
    setOverrideRecord(null);
    setOverrideReason("");
  }

  async function handleSubmitOverride(recordId) {
    if (!overrideReason.trim()) {
      return;
    }

    await overrideMutation.mutateAsync(recordId);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hostel Attendance Dashboard</h1>
        <div className="flex items-center gap-2 text-sm text-steel">
          <span className={`inline-block h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-400"}`} />
          {isConnected ? "Live updates active" : "Reconnecting..."}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Selected Window"
          value={selectedWindow ? (selectedWindow.isOpen ? "Open" : "Closed") : "None"}
          helper={selectedWindow ? formatWindowLabel(selectedWindow) : "Create a window to begin."}
          accent="#ef8354"
        />
        <SummaryCard label="Verified" value={String(verifiedCount)} accent="#1f7a5c" />
        <SummaryCard label="Pending" value={String(pendingCount)} accent="#f6ad55" />
        <SummaryCard
          label="Overrides"
          value={String(selectedWindowOverrideCount)}
          helper={`${overrides.length} total logged`}
          accent="#118ab2"
        />
      </section>

      {pageError ? (
        <section className="rounded-[1.5rem] bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {pageError}
        </section>
      ) : null}

      <section className="grid gap-8 xl:grid-cols-[1.8fr_1fr]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Live Attendance Feed</h2>
              <p className="text-sm text-steel">
                Records refresh automatically every few seconds for the selected window.
              </p>
            </div>
            <div className="text-sm text-steel">
              {selectedWindow ? `Window date: ${formatDateTime(selectedWindow.date)}` : "No window selected"}
            </div>
          </div>

          <RecordTable
            records={records}
            activeOverrideRecordId={overrideRecord?.id || null}
            overrideReason={overrideReason}
            onOverrideReasonChange={setOverrideReason}
            onStartOverride={handleStartOverride}
            onCancelOverride={handleCancelOverride}
            onSubmitOverride={handleSubmitOverride}
            isSubmittingOverride={overrideMutation.isPending}
          />
        </div>

        <aside className="space-y-6">
          <section className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm uppercase tracking-[0.2em] text-steel">Open Window</p>
            <h3 className="mt-2 text-lg font-semibold text-ink">Schedule a new attendance slot</h3>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-ink">Opens At</span>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                  type="datetime-local"
                  value={windowForm.opensAt}
                  onChange={(event) => handleWindowFieldChange("opensAt", event.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-ink">Closes At</span>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                  type="datetime-local"
                  value={windowForm.closesAt}
                  onChange={(event) => handleWindowFieldChange("closesAt", event.target.value)}
                />
              </label>
              <button
                className="w-full rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                type="button"
                onClick={() => openWindowMutation.mutate()}
                disabled={openWindowMutation.isPending}
              >
                {openWindowMutation.isPending ? "Opening..." : "Open New Window"}
              </button>
            </div>
          </section>

          <section className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-steel">Windows</p>
                <h3 className="mt-2 text-lg font-semibold text-ink">Recent attendance windows</h3>
              </div>
              {selectedWindow ? (
                <button
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-ink transition hover:border-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                  type="button"
                  onClick={() => closeWindowMutation.mutate(selectedWindow.id)}
                  disabled={closeWindowMutation.isPending || !selectedWindow.isOpen}
                >
                  {selectedWindow.isOpen ? "Close Selected" : "Already Closed"}
                </button>
              ) : null}
            </div>

            <div className="mt-5 space-y-3">
              {windows.length === 0 ? (
                <div className="rounded-3xl bg-slate-50 px-4 py-5 text-sm text-steel">
                  No windows created yet.
                </div>
              ) : (
                windows.map((window) => (
                  <button
                    key={window.id}
                    className={[
                      "w-full rounded-3xl border px-4 py-4 text-left transition",
                      window.id === selectedWindowId
                        ? "border-ink bg-slate-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    ].join(" ")}
                    type="button"
                    onClick={() => setSelectedWindowId(window.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{formatDateTime(window.opensAt)}</p>
                        <p className="mt-1 text-sm text-steel">{formatWindowLabel(window)}</p>
                      </div>
                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                          window.isOpen ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                        ].join(" ")}
                      >
                        {window.isOpen ? "Open" : "Closed"}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm uppercase tracking-[0.2em] text-steel">Action Queue</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-3xl bg-rose-50 p-4">
                <p className="font-semibold text-rose-800">{failedCount} failed verifications need review</p>
                <p className="mt-1 text-sm text-rose-700">
                  Use overrides only after a physical verification by the warden.
                </p>
              </div>
              <div className="rounded-3xl bg-sky-50 p-4">
                <p className="font-semibold text-sky-800">{overrides.length} overrides logged</p>
                <p className="mt-1 text-sm text-sky-700">
                  The override log view stays in sync with this dashboard.
                </p>
              </div>
              <div className="rounded-3xl bg-amber-50 p-4">
                <p className="font-semibold text-amber-800">
                  {isBusy ? "Refreshing live state" : "Live polling active"}
                </p>
                <p className="mt-1 text-sm text-amber-700">
                  Windows poll every 5s and records poll every 3s while selected.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm uppercase tracking-[0.2em] text-steel">Queue Health</p>
            <h3 className="mt-2 text-lg font-semibold text-ink">Verification worker status</h3>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-3xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-steel">Worker</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  healthQuery.data?.queue?.workerActive
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                    healthQuery.data?.queue?.workerActive ? 'bg-emerald-500' : 'bg-rose-500'
                  }`} />
                  {healthQuery.data?.queue?.workerActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-3xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-steel">Pending</span>
                <span className="font-semibold text-ink">{healthQuery.data?.queue?.pendingJobs ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded-3xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-steel">Processed</span>
                <span className="font-semibold text-ink">{healthQuery.data?.queue?.processedJobs ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded-3xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-steel">Failed</span>
                <span className="font-semibold text-ink">{healthQuery.data?.queue?.failedJobs ?? '—'}</span>
              </div>
              {healthQuery.data?.queue?.lastProcessedAt ? (
                <p className="text-xs text-steel">
                  Last processed: {formatDateTime(healthQuery.data.queue.lastProcessedAt)}
                </p>
              ) : null}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
