"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
    Menu,
    X,
    ArrowLeftRight,
    Rocket,
    Github,
    FileText,
    Wallet,
    Droplets,
    Store,
    Droplet
} from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "../ui/Button";
import WalletButton from "./WalletButton";

const navigation = [
    { name: "Swap", href: "/dex", icon: ArrowLeftRight },
    { name: "Liquidity", href: "/liquidity", icon: Droplets },
    { name: "Launch", href: "/launch", icon: Rocket },
    { name: "Marketplace", href: "/marketplace", icon: Store },
    { name: "Faucet", href: "/faucet", icon: Droplet },
];

const externalLinks = [
    { name: "Docs", href: "/docs", icon: FileText },
    { name: "GitHub", href: "https://github.com/pushprotocol", icon: Github },
];

export default function Header() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md">
            <nav
                className="mx-auto flex max-w-7xl items-center justify-between p-4 lg:px-8"
                aria-label="Global"
            >
                {/* Logo */}
                <div className="flex lg:flex-1">
                    <Link href="/" className="-m-1.5 p-1.5">
                        <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent">
                            Push Launchpad
                        </span>
                    </Link>
                </div>

                {/* Mobile menu button */}
                <div className="flex lg:hidden">
                    <button
                        type="button"
                        className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        <span className="sr-only">Toggle menu</span>
                        {mobileMenuOpen ? (
                            <X className="h-6 w-6" aria-hidden="true" />
                        ) : (
                            <Menu className="h-6 w-6" aria-hidden="true" />
                        )}
                    </button>
                </div>

                {/* Desktop navigation */}
                <div className="hidden lg:flex lg:gap-x-8">
                    {navigation.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "relative inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-lg",
                                    isActive
                                        ? "text-emerald-600 bg-emerald-50"
                                        : "text-gray-700 hover:text-emerald-600 hover:bg-gray-50"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {item.name}
                                {isActive && (
                                    <motion.div
                                        layoutId="activeNav"
                                        className="absolute inset-0 bg-emerald-50 rounded-lg -z-10"
                                        transition={{ type: "spring", duration: 0.5 }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* Right side - Wallet button and external links */}
                <div className="hidden lg:flex lg:flex-1 lg:justify-end lg:gap-x-4 items-center">
                    {externalLinks.map((link) => {
                        const Icon = link.icon;
                        return (
                            <a
                                key={link.name}
                                href={link.href}
                                className="text-gray-600 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Icon className="h-5 w-5" />
                                <span className="sr-only">{link.name}</span>
                            </a>
                        );
                    })}
                    <div className="ml-4">
                        <WalletButton />
                    </div>
                </div>
            </nav>

            {/* Mobile menu */}
            {mobileMenuOpen && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="lg:hidden border-t border-gray-200"
                >
                    <div className="space-y-1 px-4 pb-4 pt-4">
                        {navigation.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors",
                                        isActive
                                            ? "bg-emerald-50 text-emerald-600"
                                            : "text-gray-700 hover:bg-gray-50 hover:text-emerald-600"
                                    )}
                                >
                                    <Icon className="h-5 w-5" />
                                    {item.name}
                                </Link>
                            );
                        })}
                        <div className="pt-4 border-t border-gray-200 mt-4">
                            <WalletButton />
                        </div>
                        <div className="flex gap-4 pt-4">
                            {externalLinks.map((link) => {
                                const Icon = link.icon;
                                return (
                                    <a
                                        key={link.name}
                                        href={link.href}
                                        className="text-gray-600 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Icon className="h-5 w-5" />
                                        <span className="sr-only">{link.name}</span>
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                </motion.div>
            )}
        </header>
    );
}
