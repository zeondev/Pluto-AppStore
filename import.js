import JSON5 from "https://unpkg.com/json5@2/dist/index.min.mjs";

let packageList = [];
let host = "./";

export default {
  async init(hst) {
    host = hst;
    packageList = await fetch(host + "listing.json?t=" + Date.now()).then((j) =>
      j.json()
    );
  },
  list: (_) => packageList,
  async fetch(pkg) {
    const metaData = await fetch(host + `pkgs/${pkg}/meta.json5`).then((j) =>
      j.text()
    );
    const meta = JSON5.parse(metaData);

    return meta;
  },
};
