// Environment-aware config loader.
// Loads dev or prod config on localhost unless overridden by localStorage key `stash-env`.
// Exposes window.configReady (Promise) so ES module entry point can await it.
(function () {
  const envOverride = localStorage.getItem('stash-env');
  const host = window.location.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  const useDev = envOverride ? envOverride === 'dev' : isLocalhost;
  const file = useDev ? 'config.dev.js' : 'config.prod.js';

  window.configReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = file;
    script.onload = resolve;
    script.onerror = () => {
      console.error(`Failed to load ${file}`);
      reject(new Error(`Failed to load ${file}`));
    };
    document.head.appendChild(script);
  });
})();
