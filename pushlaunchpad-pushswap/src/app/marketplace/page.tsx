"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Search, RefreshCw, User, Coins, SlidersHorizontal, TrendingUp, TrendingDown, Clock } from "lucide-react";
import Loader from "@/components/ui/Loader";
import {
    usePushChainClient,
    usePushWalletContext,
} from "@pushchain/ui-kit";
import Layout from "@/components/layout/Layout";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import TokenCard from "@/components/marketplace/TokenCard";
import { formatAddress } from "@/lib/utils";
import { useLaunchHistory } from "@/hooks/useLaunchHistory";

type TabType = "all" | "mine";
type SortType = "recent" | "raised" | "progress";
type FilterType = "all" | "active" | "graduated";

export default function MarketplacePage() {
    const { connectionStatus } = usePushWalletContext();
    const { pushChainClient } = usePushChainClient();
    const account = pushChainClient?.universal.account;
    const normalizedAccount = account?.toLowerCase();
    const isWalletConnected =
        connectionStatus === "connected" && !!normalizedAccount;

    const { launches, loading, error, refresh } = useLaunchHistory();

    const [activeTab, setActiveTab] = useState<TabType>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<SortType>("recent");
    const [filterStatus, setFilterStatus] = useState<FilterType>("all");
    const [showFilters, setShowFilters] = useState(false);

    // Filter user launches
    const userLaunches = useMemo(
        () =>
            normalizedAccount
                ? launches.filter(
                    (launch) => launch.dev.toLowerCase() === normalizedAccount
                )
                : [],
        [launches, normalizedAccount]
    );

    // Switch to "all" tab if user disconnects wallet
    useEffect(() => {
        if (activeTab === "mine" && !isWalletConnected) {
            setActiveTab("all");
        }
    }, [activeTab, isWalletConnected]);

    // Get base list based on active tab
    const baseList = activeTab === "mine" ? userLaunches : launches;

    // Apply filters and search
    const filteredLaunches = useMemo(() => {
        let filtered = [...baseList];

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (launch) =>
                    launch.name.toLowerCase().includes(query) ||
                    launch.symbol.toLowerCase().includes(query) ||
                    launch.token.toLowerCase().includes(query) ||
                    launch.dev.toLowerCase().includes(query)
            );
        }

        // Apply status filter
        if (filterStatus !== "all") {
            filtered = filtered.filter((launch) => {
                if (filterStatus === "active") return launch.status === "active";
                if (filterStatus === "graduated") return launch.status === "completed";
                return true;
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case "recent":
                    return b.timestamp - a.timestamp;
                case "raised":
                    return Number(b.raised - a.raised);
                case "progress":
                    return b.progress - a.progress;
                default:
                    return 0;
            }
        });

        return filtered;
    }, [baseList, searchQuery, filterStatus, sortBy]);

    const showEmptyState = !loading && filteredLaunches.length === 0;
    const hasSearchOrFilter = searchQuery.trim() || filterStatus !== "all";

    const emptyMessage = useMemo(() => {
        if (hasSearchOrFilter) {
            return "No tokens match your search or filters. Try adjusting your criteria.";
        }
        if (activeTab === "mine") {
            return "You haven't launched any tokens yet. Launch your first token to see it here.";
        }
        return "No tokens launched yet on Push Launchpad.";
    }, [activeTab, hasSearchOrFilter]);

    const clearFilters = useCallback(() => {
        setSearchQuery("");
        setFilterStatus("all");
    }, []);

    return (
        <Layout>
            <div className="container mx-auto max-w-7xl px-4 py-8">
                {/* Debug info (toggle with env or temporary) */}
                <div className="mb-4 text-xs text-gray-500">
                    <div>Launches: {launches.length}</div>
                    {error && <div className="text-red-500">Error: {error}</div>}
                </div>
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Token Marketplace
                    </h1>
                    <p className="text-gray-600">
                        Browse and trade tokens during their bonding phase before they graduate to the DEX
                    </p>
                </div>

                {/* Top Controls */}
                <Card variant="elevated" className="mb-6">
                    <CardContent>
                        <div className="space-y-4">
                            {/* Tabs and Refresh */}
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                {/* Tabs */}
                                <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 p-1 text-sm font-medium">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("all")}
                                        className={`rounded-full px-6 py-2 transition ${activeTab === "all"
                                            ? "bg-white text-emerald-600 shadow"
                                            : "text-gray-600 hover:text-emerald-600"
                                            }`}
                                    >
                                        All Tokens
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => isWalletConnected && setActiveTab("mine")}
                                        disabled={!isWalletConnected}
                                        className={`rounded-full px-6 py-2 transition ${activeTab === "mine"
                                            ? "bg-white text-emerald-600 shadow"
                                            : "text-gray-600 hover:text-emerald-600"
                                            } disabled:cursor-not-allowed disabled:opacity-60`}
                                    >
                                        My Tokens
                                    </button>
                                </div>

                                {/* Stats and Refresh */}
                                <div className="flex items-center gap-4">
                                    {isWalletConnected && account && (
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <User className="h-4 w-4" />
                                            <span>{formatAddress(account)}</span>
                                            {userLaunches.length > 0 && (
                                                <Badge variant="info" size="sm">
                                                    {userLaunches.length}
                                                </Badge>
                                            )}
                                        </div>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={refresh}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <Loader size={16} />
                                        ) : (
                                            <RefreshCw className="h-4 w-4" />
                                        )}
                                        <span className="ml-2">Refresh</span>
                                    </Button>
                                </div>
                            </div>

                            {/* Search and Filter Row */}
                            <div className="flex flex-col gap-3 sm:flex-row">
                                {/* Search */}
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        type="text"
                                        placeholder="Search by name, symbol, or address..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>

                                {/* Filter Toggle */}
                                <Button
                                    variant={showFilters ? "primary" : "outline"}
                                    size="md"
                                    onClick={() => setShowFilters(!showFilters)}
                                >
                                    <SlidersHorizontal className="h-4 w-4" />
                                    <span className="ml-2">Filters</span>
                                </Button>
                            </div>

                            {/* Filter Panel */}
                            {showFilters && (
                                <div className="border-t border-gray-200 pt-4 mt-2">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {/* Sort By */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Sort By
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => setSortBy("recent")}
                                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${sortBy === "recent"
                                                        ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                        } border`}
                                                >
                                                    <Clock className="h-4 w-4" />
                                                    Recent
                                                </button>
                                                <button
                                                    onClick={() => setSortBy("raised")}
                                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${sortBy === "raised"
                                                        ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                        } border`}
                                                >
                                                    <TrendingUp className="h-4 w-4" />
                                                    Highest Raised
                                                </button>
                                                <button
                                                    onClick={() => setSortBy("progress")}
                                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${sortBy === "progress"
                                                        ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                        } border`}
                                                >
                                                    <TrendingDown className="h-4 w-4" />
                                                    Progress
                                                </button>
                                            </div>
                                        </div>

                                        {/* Filter By Status */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Status
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => setFilterStatus("all")}
                                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${filterStatus === "all"
                                                        ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                        } border`}
                                                >
                                                    All
                                                </button>
                                                <button
                                                    onClick={() => setFilterStatus("active")}
                                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${filterStatus === "active"
                                                        ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                        } border`}
                                                >
                                                    Active
                                                </button>
                                                <button
                                                    onClick={() => setFilterStatus("graduated")}
                                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${filterStatus === "graduated"
                                                        ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                        } border`}
                                                >
                                                    Graduated
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Clear Filters */}
                                    {hasSearchOrFilter && (
                                        <div className="mt-4 pt-4 border-t border-gray-200">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={clearFilters}
                                            >
                                                Clear all filters
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Failed to load tokens. {error}
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
                        <Loader size={32} />
                        <span>Loading tokens...</span>
                    </div>
                )}

                {/* Empty State */}
                {showEmptyState && (
                    <div className="text-center py-20">
                        <Coins className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            No Tokens Found
                        </h3>
                        <p className="text-gray-600 mb-6">{emptyMessage}</p>
                        {hasSearchOrFilter && (
                            <Button variant="outline" onClick={clearFilters}>
                                Clear Filters
                            </Button>
                        )}
                    </div>
                )}

                {/* Token Grid */}
                {!loading && filteredLaunches.length > 0 && (
                    <div>
                        <div className="mb-4 text-sm text-gray-600">
                            Showing {filteredLaunches.length}{" "}
                            {filteredLaunches.length === 1 ? "token" : "tokens"}
                            {hasSearchOrFilter && " (filtered)"}
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredLaunches.map((launch) => (
                                <TokenCard
                                    key={launch.token}
                                    token={launch.token}
                                    name={launch.name}
                                    symbol={launch.symbol}
                                    dev={launch.dev}
                                    timestamp={launch.timestamp}
                                    raisedFormatted={launch.raisedFormatted}
                                    progress={launch.progress}
                                    status={launch.status}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
