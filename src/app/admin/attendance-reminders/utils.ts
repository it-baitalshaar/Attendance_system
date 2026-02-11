export function formatTime(timeStr: string): string {
  if (!timeStr) return '--:--';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h ?? '0', 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${(m ?? '00').padStart(2, '0')} ${ampm}`;
}
