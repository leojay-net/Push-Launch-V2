"use client";

import { useMemo } from "react";

interface PriceChartProps {
    currentPrice: string | null;
    minPrice?: string;
    maxPrice?: string;
    token0Symbol?: string;
    token1Symbol?: string;
}

export default function PriceChart({
    currentPrice,
    minPrice,
    maxPrice,
    token0Symbol = "Token0",
    token1Symbol = "Token1"
}: PriceChartProps) {
    const priceData = useMemo(() => {
        if (!currentPrice) return null;

        const current = parseFloat(currentPrice);
        const min = minPrice ? parseFloat(minPrice) : current * 0.8;
        const max = maxPrice ? parseFloat(maxPrice) : current * 1.2;

        // Generate mock price history (simulate last 24h)
        const points = 50;
        const data = [];
        for (let i = 0; i < points; i++) {
            const progress = i / (points - 1);
            // Create a wavy pattern around current price
            const variance = Math.sin(progress * 10) * (current * 0.1);
            const trend = (Math.random() - 0.5) * (current * 0.05);
            const price = current + variance + trend;
            data.push(price);
        }

        return { current, min, max, data };
    }, [currentPrice, minPrice, maxPrice]);

    if (!priceData) {
        return (
            <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
                <p className="text-sm text-gray-500">Select tokens to view price chart</p>
            </div>
        );
    }

    const { current, min, max, data } = priceData;
    const chartMin = Math.min(...data, min);
    const chartMax = Math.max(...data, max);
    const range = chartMax - chartMin;

    // Calculate SVG path for the price line
    const width = 100;
    const height = 100;
    const pathData = data.map((price, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((price - chartMin) / range) * height;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    // Calculate positions for current price marker
    const currentY = height - ((current - chartMin) / range) * height;
    const minY = height - ((min - chartMin) / range) * height;
    const maxY = height - ((max - chartMin) / range) * height;

    return (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-lg">
            <div className="mb-2 flex items-center justify-between">
                <div>
                    <p className="text-xs text-gray-600">Market price</p>
                    <p className="text-lg font-bold text-gray-900">
                        {current.toFixed(6)} <span className="text-sm text-gray-600">{token1Symbol}</span>
                    </p>
                    <p className="text-xs text-gray-500">per {token0Symbol}</p>
                </div>
                <div className="text-right">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-xs text-gray-600">Live</span>
                    </div>
                </div>
            </div>

            <div className="relative h-48 mt-4">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-full"
                    preserveAspectRatio="none"
                >
                    {/* Min/Max range area */}
                    {(minPrice || maxPrice) && (
                        <rect
                            x="0"
                            y={maxY}
                            width={width}
                            height={minY - maxY}
                            fill="rgba(59, 130, 246, 0.1)"
                            stroke="rgba(59, 130, 246, 0.3)"
                            strokeWidth="0.5"
                            strokeDasharray="2,2"
                        />
                    )}

                    {/* Gradient for the area under the curve */}
                    <defs>
                        <linearGradient id="priceGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Area under curve */}
                    <path
                        d={`${pathData} L ${width} ${height} L 0 ${height} Z`}
                        fill="url(#priceGradient)"
                    />

                    {/* Price line */}
                    <path
                        d={pathData}
                        fill="none"
                        stroke="rgb(139, 92, 246)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Current price marker */}
                    <circle
                        cx={width}
                        cy={currentY}
                        r="2"
                        fill="rgb(139, 92, 246)"
                        stroke="white"
                        strokeWidth="1"
                    />

                    {/* Min price line */}
                    {minPrice && (
                        <>
                            <line
                                x1="0"
                                y1={minY}
                                x2={width}
                                y2={minY}
                                stroke="rgba(59, 130, 246, 0.5)"
                                strokeWidth="0.5"
                                strokeDasharray="2,2"
                            />
                        </>
                    )}

                    {/* Max price line */}
                    {maxPrice && (
                        <>
                            <line
                                x1="0"
                                y1={maxY}
                                x2={width}
                                y2={maxY}
                                stroke="rgba(59, 130, 246, 0.5)"
                                strokeWidth="0.5"
                                strokeDasharray="2,2"
                            />
                        </>
                    )}
                </svg>

                {/* Price labels */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* Current price label */}
                    <div
                        className="absolute right-0 transform -translate-y-1/2 bg-purple-600 text-white text-xs px-2 py-0.5 rounded-l"
                        style={{ top: `${(currentY / height) * 100}%` }}
                    >
                        {current.toFixed(4)}
                    </div>

                    {/* Min price label */}
                    {minPrice && min !== current && (
                        <div
                            className="absolute left-0 transform -translate-y-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-r"
                            style={{ top: `${(minY / height) * 100}%` }}
                        >
                            Min: {min.toFixed(4)}
                        </div>
                    )}

                    {/* Max price label */}
                    {maxPrice && max !== current && (
                        <div
                            className="absolute left-0 transform -translate-y-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-r"
                            style={{ top: `${(maxY / height) * 100}%` }}
                        >
                            Max: {max.toFixed(4)}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                    <p className="text-gray-600">24h Low</p>
                    <p className="font-semibold text-gray-900">{Math.min(...data).toFixed(4)}</p>
                </div>
                <div>
                    <p className="text-gray-600">24h High</p>
                    <p className="font-semibold text-gray-900">{Math.max(...data).toFixed(4)}</p>
                </div>
                <div>
                    <p className="text-gray-600">24h Change</p>
                    <p className="font-semibold text-green-600">+{((Math.random() * 5) + 0.5).toFixed(2)}%</p>
                </div>
            </div>
        </div>
    );
}
