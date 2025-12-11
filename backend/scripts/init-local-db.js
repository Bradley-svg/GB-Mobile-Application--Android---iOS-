require('ts-node/register/transpile-only');

const { seedDemo } = require('./seed-demo');

const reset = process.argv.includes('--reset');

seedDemo({ reset })
  .then(() => {
    console.log('Demo database seeded via seed-demo.ts');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
