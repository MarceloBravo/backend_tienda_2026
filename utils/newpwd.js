const bcrypt = require('bcrypt');

const password = process.argv.slice(2);

console.log(password);

const saltRounds = 10;

// Generar el hash
bcrypt.hash(password[0], saltRounds, (err, hash) => {
  if (err) {
    console.error("Error al generar hash:", err);
    return;
  }
  console.log("Hash generado:", hash);

});