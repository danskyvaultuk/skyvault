import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number): string {
  if (score >= 8) return "Good";
  if (score >= 5) return "Fair";
  return "Poor";
}

export function scoreColor(score: number): string {
  if (score >= 8) return "text-green-600";
  if (score >= 5) return "text-yellow-600";
  return "text-red-600";
}

export function extractPostcodePrefix(postcode: string): string {
  return postcode.trim().split(" ")[0].toUpperCase();
}

export function formatCurrency(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}
