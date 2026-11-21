// generate_hash.js
// Pakai: node generate_hash.js "<password>"
const bcrypt = require('bcrypt');
const password = process.argv[2];

if (!password) {
  console.error('Pakai: node generate_hash.js "<password>"');
  process.exit(1);
}

bcrypt.hash(password, 10, (err, hash) => {
  if (err) throw err;
  console.log('Hash:', hash);
});
