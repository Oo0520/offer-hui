module.exports = {
  apps: [{
    name: "offerhui",
    script: "node_modules/next/dist/bin/next",
    args: "dev",
    cwd: "E:\\AIMemory\\DaoBao\\offer-hui\\apps\\web",
    env: {
      NODE_ENV: "development",
      PORT: 3000
    }
  }]
};
