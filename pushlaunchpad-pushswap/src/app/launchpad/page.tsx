import Layout from "@/components/layout/Layout";
import LaunchForm from "@/components/launchpad/LaunchForm";
import RecentLaunches from "@/components/launchpad/RecentLaunches";

export default function LaunchpadPage() {
    return (
        <Layout>
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Token Launchpad & Marketplace
                    </h1>
                    <p className="text-gray-600">
                        Launch tokens with bonding curves, or browse and trade tokens before they graduate to the DEX
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Launch Form */}
                    <div>
                        <LaunchForm />
                    </div>

                    {/* Recent Launches */}
                    <div>
                        <RecentLaunches />
                    </div>
                </div>
            </div>
        </Layout>
    );
}
