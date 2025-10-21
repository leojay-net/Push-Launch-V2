"use client";

import { Info } from "lucide-react";
import Button from "../ui/Button";

interface FeeTier {
    value: number;
    label: string;
    description: string;
    recommended?: string;
}

const FEE_TIERS: FeeTier[] = [
    {
        value: 500,
        label: "0.05%",
        description: "Best for stable pairs",
        recommended: "Highest TVL"
    },
    {
        value: 3000,
        label: "0.3%",
        description: "Most pairs",
    },
    {
        value: 10000,
        label: "1%",
        description: "Exotic pairs",
    },
];

interface FeeTierSelectorProps {
    selectedTier: number;
    onSelectTier: (tier: number) => void;
    poolStats?: { [key: number]: { liquidity?: string; apr?: string } };
}

export default function FeeTierSelector({
    selectedTier,
    onSelectTier,
    poolStats
}: FeeTierSelectorProps) {
    return (
        <div>
            <label className="text-sm font-medium text-gray-700 mb-3 block">
                Fee tier
            </label>
            <p className="text-xs text-gray-600 mb-3">
                The % you will earn in fees. Choose an amount that suits your risk tolerance and strategy.
            </p>

            <div className="grid grid-cols-1 gap-2">
                {FEE_TIERS.map((tier) => {
                    const stats = poolStats?.[tier.value];
                    const isSelected = selectedTier === tier.value;

                    return (
                        <button
                            key={tier.value}
                            onClick={() => onSelectTier(tier.value)}
                            className={`
                                relative p-4 rounded-lg border-2 transition-all text-left
                                ${isSelected
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                }
                            `}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-lg">{tier.label}</span>
                                        {tier.recommended && (
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                                {tier.recommended}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600">{tier.description}</p>
                                </div>
                                {isSelected && (
                                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            {stats && (
                                <div className="flex gap-4 text-xs text-gray-600 mt-2">
                                    {stats.liquidity && (
                                        <span>TVL: {stats.liquidity}</span>
                                    )}
                                    {stats.apr && (
                                        <span>APR: {stats.apr}</span>
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-800">
                    More details on <a href="/docs" className="underline">fee tiers</a>
                </p>
            </div>
        </div>
    );
}
