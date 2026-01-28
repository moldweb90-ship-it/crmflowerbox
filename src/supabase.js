import { createClient } from '@supabase/supabase-js'

// Эти данные нужно получить из настроек проекта Supabase (Project Settings -> API)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials missing! Check .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
