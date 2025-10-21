"use client";

import { useEffect, useMemo, useState } from "react";
import {
    TrendingUp,
    ExternalLink,
    Loader2,
    RefreshCw,
    Clock,
    BadgeCheck,
    User,
    Coins,
} from "lucide-react";
import Link from "next/link";
import {
    usePushChainClient,
    usePushWalletContext,
} from "@pushchain/ui-kit";
import Card, { CardHeader, CardTitle, CardContent } from "../ui/Card";
import Badge from "../ui/Badge";
import { formatAddress } from "@/lib/utils";
import { useLaunchHistory } from "@/hooks/useLaunchHistory";

const QUOTE_SYMBOL = "WPC";

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
    if (diffSeconds < 3600)
        return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400)
        return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800)
        return `${Math.floor(diffSeconds / 86400)}d ago`;

    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
};

export default function RecentLaunches() {
    const { connectionStatus } = usePushWalletContext();
    const { pushChainClient } = usePushChainClient();
    const account = pushChainClient?.universal.account;
    const normalizedAccount = account?.toLowerCase();
    const isWalletConnected =
        connectionStatus === "connected" && !!normalizedAccount;

    const { launches, loading, error, refresh } = useLaunchHistory();
    const [activeTab, setActiveTab] = useState<"all" | "mine">("all");

    const userLaunches = useMemo(
        () =>
            normalizedAccount
                ? launches.filter(
                    (launch) => launch.dev.toLowerCase() === normalizedAccount
                )
                : [],
        [launches, normalizedAccount]
    );

    useEffect(() => {
        if (activeTab === "mine" && !isWalletConnected) {
            setActiveTab("all");
        }
    }, [activeTab, isWalletConnected]);

    const displayedLaunches =
        activeTab === "mine" ? userLaunches : launches;

    const showEmptyState = !loading && displayedLaunches.length === 0;
    const emptyMessage =
        activeTab === "mine"
            ? "You haven't launched any tokens yet. Launch your first token to see it here."
            : "No tokens launched yet on Push Launchpad.";

    return (
        <Card variant="elevated">
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <CardTitle>Recent Launches</CardTitle>
                    <button
                        type="button"
                        onClick={refresh}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:border-emerald-200 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                        <span>{loading ? "Refreshing" : "Refresh"}</span>
                    </button>
                </div>
            </CardHeader>

            <CardContent>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 p-0.5 text-sm font-medium text-gray-600">
                        <button
                            type="button"
                            onClick={() => setActiveTab("all")}
                            className={`rounded-full px-3 py-1.5 transition ${activeTab === "all"
                                ? "bg-white text-emerald-600 shadow"
                                : "hover:text-emerald-600"
                                }`}
                        >
                            All Launches
                        </button>
                        <button
                            type="button"
                            onClick={() => isWalletConnected && setActiveTab("mine")}
                            disabled={!isWalletConnected}
                            className={`rounded-full px-3 py-1.5 transition ${activeTab === "mine"
                                ? "bg-white text-emerald-600 shadow"
                                : "hover:text-emerald-600"
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                            My Launches
                        </button>
                    </div>

                    {isWalletConnected && account && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <User className="h-4 w-4" />
                            <span>{formatAddress(account)}</span>
                            {userLaunches.length > 0 && (
                                <Badge variant="info" size="sm">
                                    {userLaunches.length} {userLaunches.length === 1 ? "token" : "tokens"}
                                </Badge>
                            )}
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        Failed to load launch history. {error}
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center gap-3 py-8 text-gray-500">
                        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                        <span>Fetching the latest launches…</span>
                    </div>
                )}

                {showEmptyState && (
                    <div className="text-center py-8 text-gray-500">
                        <Coins className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p>{emptyMessage}</p>
                        {activeTab === "all" && (
                            <p className="text-sm mt-1">Be the first to launch!</p>
                        )}
                    </div>
                )}

                {!loading && displayedLaunches.length > 0 && (
                    <div className="space-y-4">
                        {displayedLaunches.map((launch) => {
                            const progressValue = Math.min(
                                Math.max(launch.progress, 0),
                                100
                            );
                            const statusVariant =
                                launch.status === "completed" ? "success" : "info";
                            const statusLabel =
                                launch.status === "completed" ? "Completed" : "Active";

                            return (
                                <Link
                                    key={launch.token}
                                    href={`/token/${launch.token}`}
                                    className="block"
                                >
                                    <Card
                                        variant="outline"
                                        padding="sm"
                                        hover
                                        interactive
                                    >
                                        <div className="space-y-3">
                                            {/* Header */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-semibold text-gray-900">
                                                            {launch.name || "Unnamed Token"}
                                                        </h3>
                                                        {!!launch.symbol && (
                                                            <Badge variant="primary" size="sm">
                                                                {launch.symbol}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500">
                                                        {formatAddress(launch.token)}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <User className="h-3 w-3" />
                                                        <span>Creator: {formatAddress(launch.dev)}</span>
                                                    </div>
                                                </div>

                                                <Badge variant={statusVariant} size="sm" dot>
                                                    {statusLabel}
                                                </Badge>
                                            </div>

                                            {/* Stats */}
                                            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                                <div className="flex items-center gap-2">
                                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                                    <span className="text-gray-600">Raised:</span>
                                                    <span className="font-medium text-gray-900">
                                                        {formatRaised(launch.raisedFormatted)} {QUOTE_SYMBOL}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <BadgeCheck className="w-4 h-4 text-blue-600" />
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
                                                    {formatTimeAgo(launch.timestamp)}
                                                </span>
                                                <a
                                                    href={`https://donut.push.network/address/${launch.token}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 font-medium text-emerald-600 transition hover:text-emerald-700"
                                                >
                                                    View token
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </div>
                                        </div>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>
                )}

                {displayedLaunches.length > 0 && !loading && (
                    <div className="mt-6 text-center text-xs text-gray-500">
                        {activeTab === "mine"
                            ? `Showing ${displayedLaunches.length} ${displayedLaunches.length === 1 ? "token you've launched" : "tokens you've launched"
                            }.`
                            : `Showing ${displayedLaunches.length} recent launches.`}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
