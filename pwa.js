if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(error => {
    console.warn('Offline setup failed:', error);
  });
}
