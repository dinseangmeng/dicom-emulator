const { v4: uuidv4 } = require('uuid');

function generateUID() {
  const uuid = uuidv4().replace(/-/g, '');
  const bigInt = BigInt('0x' + uuid);
  return '2.25.' + bigInt.toString();
}

function nowDate() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function nowTime() {
  return new Date().toTimeString().slice(0, 8).replace(/:/g, '');
}

module.exports = { generateUID, nowDate, nowTime };
