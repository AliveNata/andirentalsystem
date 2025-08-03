// generate_hash.js
const bcrypt = require('bcrypt');
const password = 'Admin!23'; // ← ganti dengan password yang kamu mau

bcrypt.hash(password, 10, (err, hash) => {
  if (err) throw err;
  console.log('Hash:', hash);
});