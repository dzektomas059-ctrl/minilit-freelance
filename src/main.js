import { createClient } from '@supabase/supabase-js';
import './styles.css';
import { initI18n } from './i18n.js';

const SUPABASE_URL = 'https://cloyutdjfyarifvhhkga.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsb3l1dGRqZnlhcmlmdmhoa2dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTE2NTgsImV4cCI6MjA5NTAyNzY1OH0.Q6MP8tGXqZ-_tIVdPpLcf1Z7OHpBUbmtV0baqiCMknQ';

window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_KEY = SUPABASE_KEY;
window.sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

// Initialize i18n, then bootstrap app
initI18n().then(() => import('./app.js'));
