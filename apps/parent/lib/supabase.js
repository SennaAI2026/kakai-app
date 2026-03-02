import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nhgcollyiqyexunvwywt.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_8l3-KCR9EP0bUl4nxc6YKA_2ZOjPor1'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)