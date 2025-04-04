// From https://typicode.github.io/husky/how-to.html

// Skip Husky install in production and CI
if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
  process.exit(0);
}
try {
  const { default: install } = await import('husky');
  install();
} catch {
  process.exit(0);
}
