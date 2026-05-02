function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatDateTime(value) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatScore(value) {
  if (value === null || value === undefined) {
    return "--";
  }

  return Number(value).toFixed(2);
}

export function toLocalDateTimeInputValue(value) {
  const date = value ? new Date(value) : new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function createDefaultWindowFormValues() {
  const opensAt = new Date();
  const closesAt = new Date(opensAt.getTime() + 60 * 60 * 1000);

  return {
    opensAt: toLocalDateTimeInputValue(opensAt),
    closesAt: toLocalDateTimeInputValue(closesAt)
  };
}

export function formatWindowLabel(window) {
  if (!window) {
    return "No active window";
  }

  return `${formatDateTime(window.opensAt)} to ${formatDateTime(window.closesAt)}`;
}
