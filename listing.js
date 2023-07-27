// To be ran in Node.js
const fs = require("fs");
const path = require("path");

let dirs = fs.readdirSync("pkgs");
let pkgList = [];

for (let dir of dirs) {
  const pkgs = fs.readdirSync(path.join("pkgs", dir));
  for (const pkg of pkgs) {
    pkgList.push(`${dir}/${pkg}`);
  }
}

fs.writeFileSync("listing.json", JSON.stringify(pkgList));
