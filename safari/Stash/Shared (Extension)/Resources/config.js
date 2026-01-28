// Stash Configuration
// Replace these with your Supabase project details

const CONFIG = {
  // Your Supabase project URL (from Project Settings > API)
  SUPABASE_URL: 'https://eacfqyvrsvgrstjbeyeh.supabase.co',

  // Your Supabase anon/public key (from Project Settings > API)
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhY2ZxeXZyc3ZncnN0amJleWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1NzYyNDMsImV4cCI6MjA4NDE1MjI0M30.cltDGHh-OCZ2gxO3edcVIvCY3hXdTf4PAAZWESGE4CQ',

  // Your web app URL (after deploying to Vercel/Netlify)
  WEB_APP_URL: 'https://stash-steel.vercel.app',

  // Your user ID from Supabase (Authentication > Users)
  // For multi-user mode, this can be removed and auth will be required
  USER_ID: '93dfdbc7-8d8f-4b97-8014-7e4e85e7b2e7',
};

// Don't edit below this line
if (typeof module !== 'undefined') {
  module.exports = CONFIG;
}
