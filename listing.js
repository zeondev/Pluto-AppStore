// To be ran in Node.js
const fs = require("fs");
const path = require("path");
const JSON5 = require("json5");

let dirs = fs.readdirSync("pkgs");
let pkgList = [];
let pkgListOld = [];

for (let dir of dirs) {
  const pkgs = fs.readdirSync(path.join("pkgs", dir));
  for (const pkg of pkgs) {
    const package = Object.assign(
      JSON5.parse(
        fs.readFileSync(`./pkgs/${dir}/${pkg}/meta.json5`, {
          encoding: "utf8",
        })
      ),
      { id: `${dir}/${pkg}` }
    );
    pkgList.push(package);
    pkgListOld.push(`${dir}/${pkg}`);
  }
}

fs.writeFileSync("listing.json", JSON.stringify(pkgListOld));
fs.writeFileSync("listing_new.json", JSON.stringify(pkgList));
