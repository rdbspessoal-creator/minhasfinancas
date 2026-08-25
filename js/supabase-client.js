// Cliente Supabase. A chave abaixo é a "publishable key" (anon): pública por
// design, protegida no servidor por Row Level Security — não por sigilo.
// A biblioteca (vendor/supabase/supabase.js) é carregada como <script> clássico
// em index.html e expõe `window.supabase.createClient` (mesmo padrão do Chart.js).

const SUPABASE_URL = 'https://aalbonwunjgaggmtpvrd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LyLxikSEsLmoUm6NSksRYA_iO2sE6sZ';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
