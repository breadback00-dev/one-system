export function formatRelativeIso(iso: string | Date) {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
