import Layout from "@/components/layout/Layout";
import SwapInterfaceV3 from "@/components/dex/SwapInterfaceV3";

interface DexPageProps {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DexPage({ searchParams }: DexPageProps) {
    const params = await searchParams;
    const tokenParam = Array.isArray(params?.token)
        ? params?.token[0]
        : (params?.token as string | undefined | null) ?? null;

    return (
        <Layout>
            <div className="max-w-md mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Swap Tokens
                    </h1>
                    <p className="text-gray-600">
                        Trade tokens instantly across chains with universal transactions
                    </p>
                    {tokenParam && (
                        <p className="text-sm text-emerald-600 mt-2">
                            Trading graduated token {tokenParam.substring(0, 6)}...{tokenParam.substring(tokenParam.length - 4)}
                        </p>
                    )}
                </div>

                {/* SwapInterface is a client component, pass tokenParam down */}
                <SwapInterfaceV3 preSelectedToken={tokenParam} />
            </div>
        </Layout>
    );
}
