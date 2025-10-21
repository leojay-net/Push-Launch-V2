import { type ClassValue, clsx } from "clsx";
import { ethers } from "ethers";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatAddress(address: string, chars = 4): string {
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatNumber(
    value: number | string,
    decimals = 2
): string {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "0";

    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;

    return num.toFixed(decimals);
}

export function formatCurrency(value: number | string): string {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "$0.00";

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    }).format(num);
}

export function formatPercent(value: number): string {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

// --- Numeric helpers for token amounts ---

/**
 * Normalize a user input decimal string to a given number of token decimals.
 * - Allows only digits and a single dot
 * - Truncates fractional part to `decimals` digits (no rounding)
 * - Returns null if input is empty or invalid
 */
export function normalizeAmountToDecimals(value: string, decimals: number): string | null {
    if (typeof value !== "string") value = String(value ?? "");
    const trimmed = value.trim();
    if (trimmed === "") return null;
    // Permit patterns like "0", "0.", ".5", "123.456"
    if (!/^\d*\.?\d*$/.test(trimmed)) return null;

    // Handle ".5" -> "0.5"
    const normalized = trimmed.startsWith(".") ? `0${trimmed}` : trimmed;
    const [intRaw = "0", fracRaw = ""] = normalized.split(".");

    // Strip leading zeros but keep single zero if all zeros
    const intPart = intRaw.replace(/^0+(?=\d)/, "") || "0";
    if (decimals <= 0) return intPart;

    const fracPart = fracRaw.slice(0, Math.max(0, decimals));
    if (fracPart.length === 0) return intPart; // No decimal part after clamp
    return `${intPart}.${fracPart}`;
}

/**
 * Safely parse a decimal string into bigint units for a token with `decimals`.
 * Returns null if input is invalid for parsing; otherwise bigint (may be 0n).
 */
export function safeParseUnits(value: string, decimals: number): bigint | null {
    const normalized = normalizeAmountToDecimals(value, decimals);
    if (normalized == null) return null;
    try {
        return ethers.parseUnits(normalized, decimals);
    } catch {
        return null;
    }
}
