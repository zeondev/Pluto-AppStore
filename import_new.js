import JSON5 from "https://unpkg.com/json5@2/dist/index.min.mjs";

let packageList = [];
let host = "./";

export default {
  async init(hst) {
    host = hst;
    packageList = await fetch(host + "listing_new.json?t=" + Date.now()).then((j) =>
      j.json()
    );
  },
  list: (_) => packageList,
  async fetch(pkg) {
    const meta = packageList.find((p) => p.id === pkg);
    return meta;
  },
};
