"use client";

import Link from "next/link";
import {
    TrendingUp,
    Clock,
    BadgeCheck,
    User,
    ExternalLink,
} from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import { formatAddress } from "@/lib/utils";

const QUOTE_SYMBOL = "WPC";

interface TokenCardProps {
    token: string;
    name: string;
    symbol: string;
    dev: string;
    timestamp: number;
    raisedFormatted: string;
    progress: number;
    status: "active" | "completed";
}

const formatRaised = (value: string): string => {
    const numeric = Number.parseFloat(value);

    if (!Number.isFinite(numeric) || numeric <= 0) {
        return "0";
    }

    if (numeric >= 1) {
        return numeric.toLocaleString(undefined, {
            maximumFractionDigits: 2,
        });
    }

    return numeric.toPrecision(3);
};

const formatProgress = (value: number): string => {
    if (!Number.isFinite(value)) return "0%";
    return `${value.toFixed(1)}%`;
};

const formatTimeAgo = (timestamp: number): string => {
    if (!timestamp) return "-";

    const now = Date.now();
    const diffSeconds = Math.max(0, Math.floor(now / 1000 - timestamp));

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;

    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
};

export default function TokenCard({
    token,
    name,
    symbol,
    dev,
    timestamp,
    raisedFormatted,
    progress,
    status,
}: TokenCardProps) {
    const progressValue = Math.min(Math.max(progress, 0), 100);
    const statusVariant = status === "completed" ? "success" : "info";
    const statusLabel = status === "completed" ? "Graduated" : "Active";

    return (
        <Link href={`/token/${token}`} className="block">
            <Card variant="outline" padding="sm" hover interactive>
                <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900 truncate">
                                    {name || "Unnamed Token"}
                                </h3>
                                {!!symbol && (
                                    <Badge variant="primary" size="sm">
                                        {symbol}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">{formatAddress(token)}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <User className="h-3 w-3" />
                                <span>Creator: {formatAddress(dev)}</span>
                            </div>
                        </div>

                        <Badge variant={statusVariant} size="sm" dot>
                            {statusLabel}
                        </Badge>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span className="text-gray-600">Raised:</span>
                            <span className="font-medium text-gray-900 truncate">
                                {formatRaised(raisedFormatted)} {QUOTE_SYMBOL}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <BadgeCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <span className="text-gray-600">Progress:</span>
                            <span className="font-medium text-gray-900">
                                {formatProgress(progressValue)}
                            </span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">Bonding Progress</span>
                            <span className="font-medium text-gray-900">
                                {formatProgress(progressValue)}
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${progressValue}%` }}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col gap-2 border-t border-gray-200 pt-2 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(timestamp)}
                        </span>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.open(
                                        `https://donut.push.network/address/${token}`,
                                        "_blank"
                                    );
                                }}
                                className="flex items-center gap-1 font-medium text-emerald-600 transition hover:text-emerald-700"
                            >
                                Explorer
                                <ExternalLink className="w-3 h-3" />
                            </button>
                            {status === "completed" && (
                                <Link
                                    href={`/dex?token=${token}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1 font-medium text-emerald-600 transition hover:text-emerald-700"
                                >
                                    Trade DEX
                                    <ExternalLink className="w-3 h-3" />
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </Card>
        </Link>
    );
}
