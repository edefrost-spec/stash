// Environment-aware config loader.
// Loads dev config on localhost unless overridden by localStorage key `stash-env`,
// then loads app.js after config is ready.
(function () {
  const envOverride = localStorage.getItem('stash-env');
  const host = window.location.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  const useDev = envOverride ? envOverride === 'dev' : isLocalhost;
  const file = useDev ? 'config.dev.js' : 'config.prod.js';

  const loadScript = (src, onload) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = onload;
    script.onerror = () => {
      console.error(`Failed to load ${src}`);
    };
    document.head.appendChild(script);
  };

  loadScript(file, () => {
    loadScript('app.js');
  });
})();
