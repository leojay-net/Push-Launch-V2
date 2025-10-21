"use client";

import { ReactNode } from "react";
import Header from "./Header";

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
                {children}
            </main>
            <footer className="border-t border-gray-200 bg-white mt-16">
                <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm text-gray-600">
                            © 2025 Push Launchpad. Built on Push Chain.
                        </p>
                        <div className="flex gap-6 text-sm text-gray-600">
                            <a href="#" className="hover:text-emerald-600 transition-colors">
                                Terms
                            </a>
                            <a href="#" className="hover:text-emerald-600 transition-colors">
                                Privacy
                            </a>
                            <a href="#" className="hover:text-emerald-600 transition-colors">
                                Support
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
