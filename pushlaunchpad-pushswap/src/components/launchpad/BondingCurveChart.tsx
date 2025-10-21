"use client";

import { TrendingUp } from "lucide-react";

// Simple bonding curve visualization
export default function BondingCurveChart() {
    return (
        <div className="relative w-full h-48 bg-gradient-to-br from-emerald-50 to-blue-50 rounded-lg p-4">
            {/* Simple SVG curve representation */}
            <svg
                className="w-full h-full"
                viewBox="0 0 400 150"
                preserveAspectRatio="none"
            >
                {/* Grid lines */}
                <line
                    x1="0"
                    y1="140"
                    x2="400"
                    y2="140"
                    stroke="#D1D5DB"
                    strokeWidth="1"
                />
                <line
                    x1="0"
                    y1="100"
                    x2="400"
                    y2="100"
                    stroke="#E5E7EB"
                    strokeWidth="1"
                    strokeDasharray="5,5"
                />
                <line
                    x1="0"
                    y1="60"
                    x2="400"
                    y2="60"
                    stroke="#E5E7EB"
                    strokeWidth="1"
                    strokeDasharray="5,5"
                />

                {/* Bonding curve (quadratic-ish shape) */}
                <path
                    d="M 0 140 Q 100 120, 200 80 T 400 20"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="3"
                    strokeLinecap="round"
                />

                {/* Fill area under curve */}
                <path
                    d="M 0 140 Q 100 120, 200 80 T 400 20 L 400 140 Z"
                    fill="url(#gradient)"
                    opacity="0.2"
                />

                {/* Gradient definition */}
                <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="1" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                    </linearGradient>
                </defs>
            </svg>

            {/* Axes labels */}
            <div className="absolute bottom-2 left-2 text-xs text-gray-600 font-medium">
                Supply →
            </div>
            <div className="absolute top-2 left-2 text-xs text-gray-600 font-medium transform -rotate-90 origin-left">
                Price →
            </div>

            {/* Info badge */}
            <div className="absolute top-2 right-2 bg-white px-3 py-1 rounded-full text-xs font-medium text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Quadratic Curve
            </div>
        </div>
    );
}
