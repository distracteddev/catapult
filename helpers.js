exports.buildRoutes = function buildRoutes(payload, pkg) {
  var routes = {},
      domain = pkg.domain,
      localHost = '127.0.0.1:',
      basePort = +payload.basePort,
      subdomain = pkg.subdomain || pkg.name;

  if (domain) {
    domain = domain.toLowerCase();
    // production
    routes['www.' + domain] = localHost + (basePort + 0);
    routes[domain]          = localHost + (basePort + 0);
    // staging
    routes['staging.' + domain] = localHost + (basePort + 1);
    // development
    routes['dev.' + domain] = localHost + (basePort + 2);
  }

  if (subdomain) {
    subdomain = subdomain.toLowerCase();
    var HOST_NAME = 'distracteddev.com';
    // production
    routes[subdomain + '.' + HOST_NAME] = localHost + (basePort + 0);
    // staging
    routes[subdomain + '-staging.' + HOST_NAME] = localHost + (basePort + 1);
    // development
    routes[subdomain + '-dev.' + HOST_NAME] = localHost + (basePort + 2);
  }

  return routes;
};
