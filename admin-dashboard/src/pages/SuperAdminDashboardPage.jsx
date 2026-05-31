import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import SummaryCard from "../components/SummaryCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { formatDateTime } from "../utils/format.js";

function createEmptyHostelForm() {
  return {
    name: "",
    centerLat: "",
    centerLng: "",
    radiusMetres: "150"
  };
}

function createEmptyWardenForm() {
  return {
    name: "",
    email: "",
    password: "",
    hostelId: ""
  };
}

export default function SuperAdminDashboardPage() {
  const queryClient = useQueryClient();
  const { authorizedAuthRequest } = useAuth();
  const [hostelForm, setHostelForm] = useState(createEmptyHostelForm);
  const [wardenForm, setWardenForm] = useState(createEmptyWardenForm);

  const hostelsQuery = useQuery({
    queryKey: ["admin-hostels"],
    queryFn: async () => {
      const response = await authorizedAuthRequest("/auth/admin/hostels");
      return response.data || [];
    }
  });

  const wardensQuery = useQuery({
    queryKey: ["admin-wardens"],
    queryFn: async () => {
      const response = await authorizedAuthRequest("/auth/admin/wardens");
      return response.data || [];
    }
  });

  const createHostelMutation = useMutation({
    mutationFn: async () => {
      const response = await authorizedAuthRequest("/auth/admin/hostels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: hostelForm.name.trim(),
          centerLat: Number(hostelForm.centerLat),
          centerLng: Number(hostelForm.centerLng),
          radiusMetres: Number(hostelForm.radiusMetres)
        })
      });

      return response.data;
    },
    onSuccess: async (createdHostel) => {
      setHostelForm(createEmptyHostelForm());
      setWardenForm((currentForm) => ({
        ...currentForm,
        hostelId: createdHostel.id
      }));

      await queryClient.invalidateQueries({
        queryKey: ["admin-hostels"]
      });
    }
  });

  const createWardenMutation = useMutation({
    mutationFn: async () => {
      const response = await authorizedAuthRequest("/auth/admin/wardens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: wardenForm.name.trim(),
          email: wardenForm.email.trim(),
          password: wardenForm.password,
          hostelId: wardenForm.hostelId
        })
      });

      return response.data;
    },
    onSuccess: async () => {
      setWardenForm((currentForm) => ({
        ...createEmptyWardenForm(),
        hostelId: currentForm.hostelId
      }));

      await queryClient.invalidateQueries({
        queryKey: ["admin-wardens"]
      });
    }
  });

  const hostels = hostelsQuery.data || [];
  const wardens = wardensQuery.data || [];
  const managedHostelIds = new Set(wardens.map((warden) => warden.hostelId).filter(Boolean));
  const hostelsWithoutWarden = hostels.filter((hostel) => !managedHostelIds.has(hostel.id)).length;
  const pageError =
    hostelsQuery.error?.message ||
    wardensQuery.error?.message ||
    createHostelMutation.error?.message ||
    createWardenMutation.error?.message ||
    "";

  useEffect(() => {
    if (!hostels.length) {
      return;
    }

    const hasSelectedHostel = hostels.some((hostel) => hostel.id === wardenForm.hostelId);

    if (!wardenForm.hostelId || !hasSelectedHostel) {
      setWardenForm((currentForm) => ({
        ...currentForm,
        hostelId: hostels[0].id
      }));
    }
  }, [hostels, wardenForm.hostelId]);

  function handleHostelFieldChange(field, value) {
    setHostelForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function handleWardenFieldChange(field, value) {
    setWardenForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Hostels" value={String(hostels.length)} accent="#114b5f" />
        <SummaryCard label="Wardens" value={String(wardens.length)} accent="#1f7a5c" />
        <SummaryCard label="Hostels Without Warden" value={String(hostelsWithoutWarden)} accent="#ef8354" />
        <SummaryCard
          label="Managed Campuses"
          value={String(managedHostelIds.size)}
          helper="Unique hostel assignments"
          accent="#0f766e"
        />
      </section>

      {pageError ? (
        <section className="rounded-[1.5rem] bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {pageError}
        </section>
      ) : null}

      <section className="grid gap-8 xl:grid-cols-2">
        <article className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm uppercase tracking-[0.2em] text-steel">Create Hostel</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">Register a new hostel block</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-ink">Hostel Name</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                type="text"
                value={hostelForm.name}
                onChange={(event) => handleHostelFieldChange("name", event.target.value)}
                placeholder="Girls Hostel Block A"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-ink">Center Latitude</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                type="number"
                step="0.000001"
                value={hostelForm.centerLat}
                onChange={(event) => handleHostelFieldChange("centerLat", event.target.value)}
                placeholder="28.619102"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-ink">Center Longitude</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                type="number"
                step="0.000001"
                value={hostelForm.centerLng}
                onChange={(event) => handleHostelFieldChange("centerLng", event.target.value)}
                placeholder="77.214812"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-ink">Radius (metres)</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                type="number"
                min="1"
                step="1"
                value={hostelForm.radiusMetres}
                onChange={(event) => handleHostelFieldChange("radiusMetres", event.target.value)}
              />
            </label>
          </div>

          <button
            className="mt-6 w-full rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
            type="button"
            onClick={() => createHostelMutation.mutate()}
            disabled={createHostelMutation.isPending}
          >
            {createHostelMutation.isPending ? "Creating hostel..." : "Create Hostel"}
          </button>
        </article>

        <article className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm uppercase tracking-[0.2em] text-steel">Create Warden</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">Assign a warden to a hostel</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-ink">Full Name</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                type="text"
                value={wardenForm.name}
                onChange={(event) => handleWardenFieldChange("name", event.target.value)}
                placeholder="Ananya Singh"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-ink">Email</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                type="email"
                value={wardenForm.email}
                onChange={(event) => handleWardenFieldChange("email", event.target.value)}
                placeholder="warden.blocka@college.edu"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-ink">Temporary Password</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                type="password"
                value={wardenForm.password}
                onChange={(event) => handleWardenFieldChange("password", event.target.value)}
                placeholder="Warden@123"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-ink">Assigned Hostel</span>
              <select
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                value={wardenForm.hostelId}
                onChange={(event) => handleWardenFieldChange("hostelId", event.target.value)}
                disabled={!hostels.length}
              >
                {hostels.length === 0 ? (
                  <option value="">Create a hostel first</option>
                ) : (
                  hostels.map((hostel) => (
                    <option key={hostel.id} value={hostel.id}>
                      {hostel.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          <button
            className="mt-6 w-full rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
            type="button"
            onClick={() => createWardenMutation.mutate()}
            disabled={createWardenMutation.isPending || !hostels.length}
          >
            {createWardenMutation.isPending ? "Creating warden..." : "Create Warden"}
          </button>
        </article>
      </section>

      <section className="grid gap-8 xl:grid-cols-[1fr_1.2fr]">
        <article className="overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-5">
            <p className="text-sm uppercase tracking-[0.2em] text-steel">Hostels</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Registered hostel blocks</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-steel">
                <tr>
                  <th className="px-5 py-4 font-semibold">Name</th>
                  <th className="px-5 py-4 font-semibold">Coordinates</th>
                  <th className="px-5 py-4 font-semibold">Radius</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hostels.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-steel" colSpan={3}>
                      {hostelsQuery.isLoading ? "Loading hostels..." : "No hostels registered yet."}
                    </td>
                  </tr>
                ) : (
                  hostels.map((hostel) => (
                    <tr key={hostel.id}>
                      <td className="px-5 py-4 font-medium text-ink">
                        <div>{hostel.name}</div>
                        <div className="mt-1 text-xs text-steel">{formatDateTime(hostel.createdAt)}</div>
                      </td>
                      <td className="px-5 py-4 text-steel">
                        {hostel.centerLat}, {hostel.centerLng}
                      </td>
                      <td className="px-5 py-4 text-steel">{hostel.radiusMetres}m</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-5">
            <p className="text-sm uppercase tracking-[0.2em] text-steel">Wardens</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Provisioned hostel wardens</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-steel">
                <tr>
                  <th className="px-5 py-4 font-semibold">Name</th>
                  <th className="px-5 py-4 font-semibold">Email</th>
                  <th className="px-5 py-4 font-semibold">Hostel</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wardens.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-steel" colSpan={4}>
                      {wardensQuery.isLoading ? "Loading wardens..." : "No wardens provisioned yet."}
                    </td>
                  </tr>
                ) : (
                  wardens.map((warden) => (
                    <tr key={warden.id}>
                      <td className="px-5 py-4 font-medium text-ink">{warden.name}</td>
                      <td className="px-5 py-4 text-steel">{warden.email}</td>
                      <td className="px-5 py-4 text-steel">{warden.hostelName || "Unassigned"}</td>
                      <td className="px-5 py-4">
                        <span
                          className={[
                            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                            warden.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                          ].join(" ")}
                        >
                          {warden.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
