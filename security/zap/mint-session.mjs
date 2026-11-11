// Mints an Auth.js session cookie for a seeded user, the way the admin impersonation route does.
//   node mint-session.mjs --user <SEED users key> --cookie-name <name>
// Prints "<cookie name>=<token>" and nothing else. AUTH_SECRET must be the secret the app container runs with.
// The cookie name is an input: the token's salt is the name, so it must equal the name the cookie is sent under.
import { encode } from 'next-auth/jwt';
import { SEED } from './seed.mjs';

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i];
    const value = argv[i + 1];
    if ((name !== '--user' && name !== '--cookie-name') || !value) return null;
    options[name.slice(2)] = value;
  }
  return options;
}

function usage() {
  console.error('usage: mint-session.mjs --user <customerA|customerB|admin> --cookie-name <name>');
  process.exit(2);
}

const options = parseArgs(process.argv.slice(2));
if (!options || !options.user || !options['cookie-name']) usage();

const user = SEED.users[options.user];
if (!user) usage();
if (!process.env.AUTH_SECRET) {
  console.error('mint-session: AUTH_SECRET is not set');
  process.exit(2);
}

const cookieName = options['cookie-name'];
const token = await encode({
  token: {
    sub: user.id,
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    role: user.role,
  },
  secret: process.env.AUTH_SECRET,
  salt: cookieName,
});

process.stdout.write(`${cookieName}=${token}\n`);
