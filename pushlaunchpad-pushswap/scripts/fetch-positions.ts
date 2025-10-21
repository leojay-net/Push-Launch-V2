import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const owner = (process.env.OWNER || '').toLowerCase();
    if (!url || !key) throw new Error('Missing Supabase env');
    const db = createClient(url, key);

    const query = db.from('positions').select('*');
    const q = owner ? query.eq('owner', owner).order('tokenid', { ascending: true }) : query.limit(5);
    const { data, error } = await q;
    if (error) {
        console.error('Supabase error:', error);
        process.exit(1);
    }
    if (!data || !data.length) {
        console.log('No rows found in positions');
        return;
    }
    console.log('Sample positions rows:');
    for (const row of data) console.log(row);
    console.log('Columns present:', Object.keys(data[0]));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
