const csrf = require('csurf');

// Export a shared instance of csurf middleware so that routes can reuse it
// and work with the same secret/token lifecycle.
module.exports = csrf();
