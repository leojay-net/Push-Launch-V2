import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    const db = createClient(url, key);

    const { data, error } = await db
        .from('launches')
        .select('*')
        .order('blocknumber', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Supabase error:', error);
        process.exit(1);
    }

    if (!data || !data.length) {
        console.log('No rows found in launches');
        return;
    }

    console.log('Sample launches rows (top 5):');
    for (const row of data) {
        console.log(row);
    }

    // Print discovered keys of the first row
    console.log('Columns present:', Object.keys(data[0]));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
