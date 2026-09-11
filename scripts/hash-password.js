const bcrypt = require('bcryptjs');
const readline = require('node:readline');

function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('Run this command in an interactive terminal.');
  }

  return new Promise((resolve, reject) => {
    let value = '';
    process.stdout.write(prompt);
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('keypress', onKeypress);
      process.stdout.write('\n');
    }

    function onKeypress(character, key) {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Cancelled.'));
      } else if (key.name === 'return') {
        cleanup();
        resolve(value);
      } else if (key.name === 'backspace') {
        if (value.length) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (!key.ctrl && !key.meta && character) {
        value += character;
        process.stdout.write('*');
      }
    }

    process.stdin.on('keypress', onKeypress);
  });
}

async function run() {
  const password = await readHidden('Admin password: ');
  if (password.length < 12) throw new Error('Password must contain at least 12 characters.');
  const confirmation = await readHidden('Confirm password: ');
  if (password !== confirmation) throw new Error('Passwords do not match.');
  console.log(await bcrypt.hash(password, 12));
}

run().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});