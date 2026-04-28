const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'verified.json');

function load() {
  if (!fs.existsSync(FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return [];
  }
}

function isVerified(email) {
  return load().includes(email);
}

function addVerified(email) {
  const list = load();
  if (!list.includes(email)) {
    list.push(email);
    fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
  }
}

module.exports = { isVerified, addVerified };
