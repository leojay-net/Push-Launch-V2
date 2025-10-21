import Layout from "@/components/layout/Layout";
import LiquidityInterfaceV3Improved from "@/components/liquidity/LiquidityInterfaceV3Improved";

export default function LiquidityPage() {
    return (
        <Layout>
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Liquidity
                    </h1>
                    <p className="text-gray-600">
                        Add concentrated liquidity to earn fees. Select a fee tier and set your price range.
                    </p>
                </div>

                <LiquidityInterfaceV3Improved />
            </div>
        </Layout>
    );
}
