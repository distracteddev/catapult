# Seam
###### Seam is the invisible stitching between your Node.js applications and the real world.  

### What is Seam?

A Personal Deployment Tool for Node.js developers that want to run their applications on a VPS rather than a hosted solution like Nodejitsu or Heroku but still crave the simplicity that comes with having the basic deployment details handled for you. So what problems does Seam.io solve?

 - Deploy Multiple Applications, each with multiple environments (prod, staging, dev, etc)
 - Handles your applications logs in a sane and user friendly way.
    - `seam logs` from within your app's directory runs a `ssh tail -f` against the seam server to give you instant access to your logs while integrated 3rd party logging platforms like Loggly, Ratchet.io, etc are also an option for those more demanding situations).
 - Runs Your Application's Tests via `npm test` and hosts the output as a static file
 - Provides a simple singe-page dashboard for all deployed applications with uptime, restart count, etc.
 - Alerts for important events (errors, app restart/exit, etc)

### Seam's Core Functionality

Seam uses git post-recieve webhooks to deploy your applications while integrating seamlessly with your current git workflow. For example, if you push to a project's master branch, Seam will create/sync your repo, install dependencies via npm, and launch your script at a specified port. It then updates the proxy table and uses Nodejitsu's battle-hardened node-http-proxy to route traffic to your newly deployed app. It determines which domains/subdomains to forward to the newly deployed app based on the the domains/subdomains properties of the repo's package.json. If no option is specified, it simply uses the dasherized name of the git repo as the subdomain. Once the deploy has completed/failed you will get a email/osx-notification with some status info for your app such as the output of `npm test` or any issues with dependency installation/launching the application.

This workflow is best described by a couple of examples:
 
 - I push the master branch of my Soapbox repo to my seam server living at distracteddev.com, Soapbox now is now living at `soapbox.distracteddev.com`
 - I push the staging branch of my Soapbox repo... This version of Soapbox is now living at `soapbox-staging.distracteddev.com`
 - I push the development branch of my Soapbox repo... This version of Soapbox is now living at `soapbox-dev.distracteddev.com`

 - I push the master branch of my Soapbox repo which has the following lines in it's package.json.

```javascript
domains: [
  'zeus.ly'
]
```

master will accept requests from `zeus.ly`
staging will accept requests from `staging.zeus.ly`
dev will accept requests from `dev.zeus.ly`

Note: If these conventions are not to your liking, you can define overrides via a domainMap:

```javascript
// branch->domain pairs
domainMap: {
  master: 'zeus.ly',
  staging: 'hopefully-this-works.zeus.ly'
  dev: 'shit-is-broken-here.zeus.ly'

}
```


### Installation & Repo Set-up

##### Setting up the Seam Server
Seam is a node app itself, a simple `npm install seam` is all you would need.

##### Setting up a git repo with Seam
Simply go to the admin panel of your reposity, and add the URL `[your-hostname-here].com/hook/` as a web-hook end-point.

##### Optional Seam Plugins

- Integration with Cloud-Based Logging Platforms (Loggly, Logmetrics, Ratchet.io, etc) 
- Email Notifications/Alerts
- OSX Notifications  (Credit goes to the `node-osx-notifier` module)
- Have any ideas or suggestions for more? I would love to hear them :)



 
 
