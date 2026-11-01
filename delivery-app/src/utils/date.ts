import { format, formatDistanceToNow, isValid } from "date-fns";

export function formatDate(date?: string | Date | null): string {
  return date && isValid(new Date(date)) ? format(new Date(date), "d MMM yyyy") : "Date not recorded";
}

export function formatDateTime(date?: string | Date | null): string {
  return date && isValid(new Date(date)) ? format(new Date(date), "d MMM yyyy, h:mm a") : "Date not recorded";
}

export function formatRelative(date?: string | Date | null): string {
  return date && isValid(new Date(date)) ? formatDistanceToNow(new Date(date), { addSuffix: true }) : "Date not recorded";
}
