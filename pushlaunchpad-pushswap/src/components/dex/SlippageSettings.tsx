"use client";

import { useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { TX_SETTINGS } from "@/lib/contracts";

interface SlippageSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    slippage: number;
    onSlippageChange: (slippage: number) => void;
}

const PRESET_SLIPPAGES = [0.1, 0.5, 1.0];

export default function SlippageSettings({
    isOpen,
    onClose,
    slippage,
    onSlippageChange,
}: SlippageSettingsProps) {
    const [customSlippage, setCustomSlippage] = useState(slippage.toString());
    const [deadline, setDeadline] = useState(TX_SETTINGS.DEFAULT_DEADLINE);

    const handlePresetClick = (value: number) => {
        onSlippageChange(value);
        setCustomSlippage(value.toString());
    };

    const handleCustomSlippageChange = (value: string) => {
        setCustomSlippage(value);
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue > 0 && numValue <= TX_SETTINGS.MAX_SLIPPAGE) {
            onSlippageChange(numValue);
        }
    };

    const handleSave = () => {
        const numValue = parseFloat(customSlippage);
        if (!isNaN(numValue) && numValue > 0 && numValue <= TX_SETTINGS.MAX_SLIPPAGE) {
            onSlippageChange(numValue);
            onClose();
        }
    };

    const isHighSlippage = slippage > 5;
    const isVeryHighSlippage = slippage > 10;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Transaction Settings"
            description="Customize your swap settings"
            size="sm"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSave}>
                        Save Settings
                    </Button>
                </>
            }
        >
            <div className="space-y-6">
                {/* Slippage Tolerance */}
                <div>
                    <label className="text-sm font-medium text-gray-900 mb-3 block">
                        Slippage Tolerance
                    </label>

                    {/* Preset Buttons */}
                    <div className="flex gap-2 mb-3">
                        {PRESET_SLIPPAGES.map((value) => (
                            <Button
                                key={value}
                                variant={slippage === value ? "primary" : "outline"}
                                size="sm"
                                onClick={() => handlePresetClick(value)}
                            >
                                {value}%
                            </Button>
                        ))}
                    </div>

                    {/* Custom Input */}
                    <div className="relative">
                        <input
                            type="number"
                            value={customSlippage}
                            onChange={(e) => handleCustomSlippageChange(e.target.value)}
                            placeholder="0.50"
                            step="0.01"
                            min="0"
                            max={TX_SETTINGS.MAX_SLIPPAGE}
                            className="w-full px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                            %
                        </span>
                    </div>

                    {/* Warnings */}
                    {isVeryHighSlippage && (
                        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                            ⚠️ Very high slippage! Your transaction may be front-run.
                        </div>
                    )}
                    {isHighSlippage && !isVeryHighSlippage && (
                        <div className="mt-2 text-sm text-yellow-600 bg-yellow-50 p-2 rounded-lg">
                            ⚠️ High slippage! Transaction may be front-run.
                        </div>
                    )}
                    <p className="mt-2 text-sm text-gray-500">
                        Your transaction will revert if the price changes unfavorably by more than
                        this percentage.
                    </p>
                </div>

                {/* Transaction Deadline */}
                <div>
                    <label className="text-sm font-medium text-gray-900 mb-2 block">
                        Transaction Deadline
                    </label>

                    <div className="relative">
                        <input
                            type="number"
                            value={deadline}
                            onChange={(e) => setDeadline(parseInt(e.target.value) || TX_SETTINGS.DEFAULT_DEADLINE)}
                            min="1"
                            max="60"
                            className="w-full px-4 py-2 pr-16 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                            minutes
                        </span>
                    </div>

                    <p className="mt-2 text-sm text-gray-500">
                        Your transaction will revert if it is pending for more than this time.
                    </p>
                </div>
            </div>
        </Modal>
    );
}
