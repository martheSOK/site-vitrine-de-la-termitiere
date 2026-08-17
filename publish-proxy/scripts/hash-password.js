/* Genere le hash bcrypt d'un mot de passe, a coller dans USERS_JSON.
   Usage : node scripts/hash-password.js "motDePasseChoisi" */
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage : node scripts/hash-password.js "motDePasseChoisi"');
  process.exit(1);
}

console.log(bcrypt.hashSync(password, 10));
