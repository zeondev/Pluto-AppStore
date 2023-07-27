import JSON5 from "https://unpkg.com/json5@2/dist/index.min.mjs";

let packageList = [];

export default {
  async init() {
    packageList = await fetch("./listing.json").then((j) => j.json());
  },
  list: (_) => packageList,
  async fetch(pkg) {
    const metaData = await fetch(`./pkgs/${pkg}/meta.json5`).then((j) =>
      j.text()
    );
    const meta = JSON5.parse(metaData);

    return meta;
  },
};
