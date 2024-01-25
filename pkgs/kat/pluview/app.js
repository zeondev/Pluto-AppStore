export default {
  name: "Pluview",
  description: "Load custom apps from a local development server",
  ver: 1, // Compatible with core v1
  privileges: [
    {
      privilege: "startPkg",
      description: "Run applications developed locally",
    },
  ],
  type: "process",
  exec: async function (Root) {
    const Notify = await Root.Lib.loadLibrary("Notify");
    const CtxMenu = await Root.Lib.loadLibrary("CtxMenu");

    Root.Lib.setOnEnd(() => {
      clearInterval(checkInterval);
    });

    let apps = [],
      connectedState = false,
      hasConnected = false;

    async function fetchApps() {
      try {
        apps = await fetch("http://localhost:1930/apps").then((t) => t.json());
        if (hasConnected === false) {
          hasConnected = true;
          connectedState = true;
          Notify.show(
            "Pluview",
            "Connected to local dev server.\nOpen me in the tray menu to open your app!",
          );
        }
      } catch (e) {
        Root.Lib.onEnd();

        connectedState = false;

        if (hasConnected === false && connectedState === false) {
          Notify.show(
            "Pluview Error",
            "Could not reach local dev server. Is it running?",
          );
        }
        return;
      }
    }

    fetchApps();

    const checkInterval = setInterval(() => {
      fetchApps();
    }, 30000);

    return Root.Lib.setupReturns(
      (m) => {
        if (m.type && m.type === "context-menu") {
          const appsHtml = apps.map((app) => {
            return {
              item: app,
              select: async () => {
                const appData = await fetch(
                  `http://localhost:1930/dist/apps/${app}`,
                ).then((t) => t.text());
                Root.Core.startPkg(
                  URL.createObjectURL(
                    new Blob([appData], { type: "application/javascript" }),
                  ),
                  false,
                );
              },
            };
          });
          CtxMenu.new(m.x, m.y, [
            ...appsHtml,
            {
              item: "Quit Pluview",
              select: async () => {
                Root.Lib.onEnd();
              },
            },
          ]);
        }
      },
      {
        icon: `<svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.8969 41.2916H9.51756C8.25546 41.2916 7.04504 40.7903 6.1526 39.8978C5.26016 39.0054 4.75879 37.795 4.75879 36.5329V12.739C4.75879 11.4769 5.26016 10.2665 6.1526 9.37404C7.04504 8.48159 8.25546 7.98022 9.51756 7.98022H47.5877C48.8498 7.98022 50.0603 8.48159 50.9527 9.37404C51.8451 10.2665 52.3465 11.4769 52.3465 12.739V36.5329C52.3465 37.795 51.8451 39.0054 50.9527 39.8978C50.0603 40.7903 48.8498 41.2916 47.5877 41.2916H45.2084" stroke="white" stroke-width="5.16667" stroke-linecap="round" stroke-linejoin="round"/><path d="M28.5527 36.5327L40.4496 50.809H16.6558L28.5527 36.5327Z" stroke="white" stroke-width="5.16667" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      },
    );
  },
};
