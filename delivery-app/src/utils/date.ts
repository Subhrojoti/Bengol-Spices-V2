import { format, formatDistanceToNow } from "date-fns";

export function formatDate(date: string | Date): string {
  return format(new Date(date), "d MMM yyyy");
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "d MMM yyyy, h:mm a");
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}
