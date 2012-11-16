/**
 *  Plan to handle hooks:
 *
 *  1. Clone Project
 *  2. Install NPM deps
 *  3. Assign Port, Save hostname:port pair in proxy.json
 *  4. Start forever with assigned PORT.
 *  5. Restart Proxy
 *
**/

function handleHook(repo) {
  // Check if branch pushed is one of the ones we care about
  console.log(repo.ref);


}

function cloneProject(repo) {


}

function updateSettingsForRepo(repo, pkg) {
  // create a routes object based on routes/domain/subdomain option
  // within the projects package.json
  var routes = pkg.routes || buildRoutes(repo, pkg);

}

function buildRoutes(repo, pkg) {


}

module.exports = handleHook;
