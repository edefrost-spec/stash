// Stash Configuration
// Replace these with your Supabase project details

const CONFIG = {
  // Your Supabase project URL (from Project Settings > API)
  SUPABASE_URL: 'https://eacfqyvrsvgrstjbeyeh.supabase.co',

  // Your Supabase anon/public key (from Project Settings > API)
  SUPABASE_ANON_KEY: 'sb_secret_fOT5TwrxRWptVF3mGEHKtg_I43_-1Ak',

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
