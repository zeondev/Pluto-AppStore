export default {
  name: "Aphelion",
  description: "A desktop replacement for tablets running Pluto",
  ver: 1.6, // Compatible with core v1
  type: "process",
  optInToEvents: true,
  privileges: [
    {
      privilege: "full",
      description: "Allow Aphelion to manage your desktop.",
    },
  ],
  exec: async function (Root) {
    const Html = Root.Lib.html;
    let timeInterval;
    let logoutTimer;
    let wrapper = new Html("div").class("desktop").appendTo("body");

    const eventRegistry = [];

    function addTrackedEventListener(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      eventRegistry.push({ target, type, handler, options });
    }

    function clearAllEventListeners() {
      for (let { target, type, handler, options } of eventRegistry) {
        target.removeEventListener(type, handler, options);
      }
      eventRegistry.length = 0;
      console.log("cleared all event listeners");
    }

    Root.Lib.setOnEnd((_) => {
      console.log("Quitting Aphelion...");
      clearInterval(timeInterval);
      clearAllEventListeners();

      wrapper.cleanup();
    });

    const vfs = await Root.Lib.loadLibrary("VirtualFS");
    let FileMappings = await Root.Lib.loadLibrary("FileMappings");
    vfs.importFS();

    const appearanceConfig = JSON.parse(
      await vfs.readFile("Root/Pluto/config/appearanceConfig.json")
    );

    let determinedImage = appearanceConfig.wallpaper;

    if (appearanceConfig.useThemeWallpaper === true) {
      const theme = appearanceConfig.theme;

      const themeData = JSON.parse(
        await vfs.readFile("Root/Pluto/config/themes/" + theme)
      );

      determinedImage = themeData.wallpaper;
    }

    // kill ui:Desktop
    const dsk = Root.Core.processList
      .filter((n) => n !== null)
      .find((c) => c.name === "ui:Desktop");
    // kill Aphelion if it is still running
    const sdsk = Root.Core.processList
      .filter((n) => n !== null)
      .filter((x) => x.proc !== null)
      .find((c) => c.proc.name === "Aphelion");

    if (dsk !== undefined) {
      dsk.proc.end();
    }

    if (sdsk !== undefined) {
      sdsk.proc.end();
    }

    // Make Aphelion your normal desktop instance

    await vfs.writeFile(
      "Root/Pluto/startup",
      "Registry/AppStore/zeon--aphelion.app"
    );

    const background = new Html("div")
      .class("bg")
      .styleJs({
        position: "fixed",
        top: "0",
        left: "0",
        right: "0",
        bottom: "0",
        zIndex: "-1",
        backgroundImage: "url(" + determinedImage + ")",
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center center",
        inset: "0px",
        transition: "opacity 2s linear",
        opacity: 1,
      })
      .appendTo(wrapper);

    let currentOpenApps = Root.Core.processList
      .filter((n) => n !== null)
      .filter((a) => {
        if (
          a.name.startsWith("system:") ||
          a.name.startsWith("ui:") ||
          a.name.startsWith("services:") ||
          (a.proc !== null &&
            a.proc.name !== undefined &&
            a.proc.name === "Aphelion")
        )
          return;
        if (!a.proc) return;
        return a;
      });

    let items = new Html("div").class("items");

    const openTasks = new Map();

    // const currentOpenApps = Root.Core.processList
    //   .filter((n) => n !== null)
    //   .filter((a) => {
    //     if (
    //       a.name.startsWith("system:") ||
    //       a.name.startsWith("ui:") ||
    //       a.name.startsWith("services:") ||
    //       (a.proc !== null &&
    //         a.proc.name !== undefined &&
    //         a.proc.name === "Aphelion")
    //     )
    //       return;
    //     if (!a.proc) return;
    //     return a;
    //   });

    function focusApp(pid) {
      const p = Root.Core.windowsList.find((p) => p.options.pid === pid);

      console.log(p);

      if (p !== undefined) {
        p.focus();
      }
    }

    function newContainer(pid, name) {
      console.log(
        "HERE!!!",
        openTasks,
        pid,
        name,
        openTasks.has(pid),
        currentOpenApps
      );
      if (openTasks.has(pid)) return;

      const container = new Html("div")
        .class("dock-item")
        .text(name)
        .on("click", () => {
          focusApp(pid);
        })
        .appendTo(items);

      openTasks.set(pid, {
        container,
      });
    }

    // Launcher container
    let smc = new Html("div")
      .class("smc", "hide")
      .style({
        display: "grid",
        "grid-template-columns": "repeat(6, 1fr)", // 7 apps across
        "grid-auto-rows": "145px", // fixed app slot height
        "justify-items": "center",
        "align-items": "start",
        gap: "10px",
        width: "100%",
        height: "100%",
        margin: 0,
        padding: "40px 20px", // fixed top/bottom spacing
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        "z-index": "9999998",
        "backdrop-filter": "blur(10px)",
        background: "rgba(0,0,0,0.3)",
        "box-sizing": "border-box",
        "overflow-y": "auto", // allow scrolling if too many apps
      })
      .appendTo(wrapper);

    // Move desktopApps, installedApps, asApps, and apps outside as let
    let desktopApps, installedApps, asApps, apps;

    // Function to collect apps
    async function collectApps() {
      smc.clear();
      desktopApps = (await vfs.list("Root/Desktop"))
        .filter((f) => f.item.endsWith(".shrt"))
        .map((f) => {
          return { type: "desktop", item: f.item };
        });

      installedApps = (await vfs.list("Root/Pluto/apps"))
        .filter((f) => f.item.endsWith(".app") || f.item.endsWith(".pml"))
        .map((f) => {
          return { type: "installed", item: f.item };
        });

      asApps = [];
      const asExists = await vfs.whatIs(
        "Registry/AppStore/_AppStoreIndex.json"
      );
      if (asExists !== null) {
        asApps = (await vfs.list("Registry/AppStore"))
          .filter((f) => f.item.endsWith(".app") || f.item.endsWith(".pml"))
          .filter((f) => f.item !== "zeon--aphelion.app")
          .map((f) => {
            return { type: "appStore", item: f.item };
          });
      }

      apps = [...desktopApps, ...asApps, ...installedApps];

      for (let app of apps) {
        let icon = "box",
          name = app.item,
          description = null,
          mapping = null;

        if (app.type === "desktop") {
          const data = await FileMappings.retrieveAllMIMEdata(
            "Root/Desktop/" + app.item
          );
          mapping = data;
          icon = data.icon;
          name = data.localizedName ?? data.name;
          description = data.fullName;
        } else if (app.type === "appStore") {
          const data = await FileMappings.retrieveAllMIMEdata(
            "Registry/AppStore/" + app.item
          );
          mapping = data;
          if (data.invalid === true) {
            continue; // skip invalid app
          }
          icon = data.icon;
          name = data.name;
          description = data.fullName;
        }

        // App button
        new Html("button")
          .class("app-button")
          .style({
            display: "flex",
            "flex-direction": "column",
            "align-items": "center",
            "justify-content": "center",
            width: "120px",
            height: "100%",
            border: "none",
            background: "transparent",
            color: "#fff",
            "font-size": "13px",
            cursor: "pointer",
          })
          .appendMany(
            new Html("div")
              .class("app-icon")
              .style({
                width: "64px",
                height: "64px",
                "border-radius": "16px",
                background: "rgba(255, 255, 255, 0.1)",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                "margin-bottom": "6px",
                overflow: "hidden",
              })
              .append(
                new Html("span")
                  .html(icon in Root.Lib.icons ? Root.Lib.icons[icon] : icon)
                  .style({
                    width: "32px",
                    height: "32px",
                    "object-fit": "contain",
                  })
              ),
            new Html("span").html(name).style({
              "text-align": "center",
              "white-space": "nowrap",
              overflow: "hidden",
              "text-overflow": "ellipsis",
              width: "100%",
            })
          )
          .on("click", async () => {
            toggleSmc();
            if (app.type === "desktop") {
              try {
                let shrt = JSON.parse(
                  await vfs.readFile("Root/Desktop/" + app.item)
                );
                if (shrt.fullName) {
                  await Root.Core.startPkg(shrt.fullName, true, true);
                }
              } catch (e) {
                console.log("Couldn't load the application");
              }
            } else if (app.type === "appStore") {
              await mapping.onClick();
            } else {
              try {
                const appData = await vfs.readFile(
                  "Root/Pluto/apps/" + app.item
                );
                await Root.Core.startPkg(
                  "data:text/javascript," + encodeURIComponent(appData),
                  false,
                  false
                );
              } catch (e) {
                console.log("Couldn't load the application");
              }
            }
          })
          .appendTo(smc);
      }
    }

    await collectApps();

    let hidden = true;
    function toggleSmc() {
      smc.class("hide");
      if (hidden == true) {
        hidden = false;
      } else {
        hidden = true;
      }
    }

    let sm = new Html("button")
      .on("click", async () => {
        if (hidden == true) {
          await collectApps();
        }
        toggleSmc();
      })
      .html(
        `<svg width="24" height="24" viewBox="0 0 18 17" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M9 15.3713C12.7949 15.3713 15.8713 12.2949 15.8713 8.5C15.8713 4.70511 12.7949 1.62874 9 1.62874C5.20511 1.62874 2.12874 4.70511 2.12874 8.5C2.12874 12.2949 5.20511 15.3713 9 15.3713ZM9 17C13.6944 17 17.5 13.1944 17.5 8.5C17.5 3.80558 13.6944 0 9 0C4.30558 0 0.5 3.80558 0.5 8.5C0.5 13.1944 4.30558 17 9 17Z" fill="currentColor"/></svg>`
      )
      .class("toolbar-button");
    let pastMinute = 0;
    let timeWrapper = new Html("div").class("toolbar-button");
    let time = new Html("span").text().appendTo(timeWrapper);

    function updateTime() {
      let x = new Date();
      let hours = x.getHours().toString().padStart(2, "0");
      let minutes = x.getMinutes().toString().padStart(2, "0");
      if (pastMinute === minutes) return;
      pastMinute = minutes;
      let timeString = `${hours}:${minutes}`;

      time.text(timeString);
    }
    updateTime();
    timeInterval = setInterval(updateTime, 1000);
    let dock = new Html("div")
      .class("dock")
      .style({
        height: "50px",
        bottom: "12px",
        left: "12px",
        width: "calc(100% - 24px)",
      })
      .appendMany(sm, items, timeWrapper)
      .appendTo(wrapper);

    let styling = new Html("style")
      .html(
        `
      .win-window {
        top:0 !important;
        left:0 !important;
        
        width:100%  !important;
        height:calc(100% - 75px) !important;
      }
      
      .win-window.max {
        top:0 !important;
        left:0 !important;
        
        width:100%  !important;
        height:calc(100% - 75px) !important;
      }
      
      .win-window .win-titlebar .buttons .win-btn.win-minimize {
        display:none;
      }
      
      .desktop > .smc > .app-button > .app-icon > span > img {
        width:100% !important;
        height: 100% !important;
        border-radius: 50% !important;
      }
      
            .desktop > .smc > .app-button > .app-icon > span > svg {
        width:100% !important;
        height: 100% !important;
        border-radius: 0% !important;
      }
      
      .win-window .win-titlebar {
        height: 40px;
      }
      
      .win-window .win-titlebar .outer-title .title {
        display:flex;
        justify-content: center;
        align-items: center;
      }
      
      .desktop .smc {
        display: grid;
        opacity: 1;
        visibility: visible;
        transition: opacity 0.3s ease-in-out, visibility 0.3s ease-in-out;
      }
      
      .desktop .smc.hide {
        display: none;
        opacity: 0;
        visibility: hidden;
        pointer-events: none; /* so clicks don't register while hidden */
      }

      `
      )
      .appendTo(wrapper);
    async function updateBG(data) {
      if (!data) {
        appearanceConfig = JSON.parse(
          await vfs.readFile("Root/Pluto/config/appearanceConfig.json")
        );

        let determinedImage = appearanceConfig.wallpaper;

        if (appearanceConfig.useThemeWallpaper === true) {
          const theme = appearanceConfig.theme;

          const themeData = JSON.parse(
            await vfs.readFile("Root/Pluto/config/themes/" + theme)
          );

          determinedImage = themeData.wallpaper;
          background.styleJs({
            backgroundImage: "url(" + determinedImage + ")",
          });
        }
      } else {
        background.styleJs({
          backgroundImage: "url(" + data + ")",
        });
      }
    }

    const ss = [][(![] + [])[+!+[]] + (!![] + [])[+[]]][
      ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] +
        (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] +
        ([][[]] + [])[+!+[]] +
        (![] + [])[!+[] + !+[] + !+[]] +
        (!![] + [])[+[]] +
        (!![] + [])[+!+[]] +
        ([][[]] + [])[+[]] +
        ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] +
        (!![] + [])[+[]] +
        (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] +
        (!![] + [])[+!+[]]
    ](
      (!![] + [])[+!+[]] +
        (!![] + [])[!+[] + !+[] + !+[]] +
        (!![] + [])[+[]] +
        ([][[]] + [])[+[]] +
        (!![] + [])[+!+[]] +
        ([][[]] + [])[+!+[]] +
        (+[![]] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+!+[]]] +
        (!![] + [])[!+[] + !+[] + !+[]] +
        (+(!+[] + !+[] + !+[] + [+!+[]]))[
          (!![] + [])[+[]] +
            (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] +
            ([] + [])[
              ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[
                !+[] + !+[] + !+[]
              ] +
                (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[
                  +!+[] + [+[]]
                ] +
                ([][[]] + [])[+!+[]] +
                (![] + [])[!+[] + !+[] + !+[]] +
                (!![] + [])[+[]] +
                (!![] + [])[+!+[]] +
                ([][[]] + [])[+[]] +
                ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[
                  !+[] + !+[] + !+[]
                ] +
                (!![] + [])[+[]] +
                (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[
                  +!+[] + [+[]]
                ] +
                (!![] + [])[+!+[]]
            ][
              ([][[]] + [])[+!+[]] +
                (![] + [])[+!+[]] +
                ((+[])[
                  ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[
                    !+[] + !+[] + !+[]
                  ] +
                    (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[
                      +!+[] + [+[]]
                    ] +
                    ([][[]] + [])[+!+[]] +
                    (![] + [])[!+[] + !+[] + !+[]] +
                    (!![] + [])[+[]] +
                    (!![] + [])[+!+[]] +
                    ([][[]] + [])[+[]] +
                    ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[
                      !+[] + !+[] + !+[]
                    ] +
                    (!![] + [])[+[]] +
                    (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[
                      +!+[] + [+[]]
                    ] +
                    (!![] + [])[+!+[]]
                ] + [])[+!+[] + [+!+[]]] +
                (!![] + [])[!+[] + !+[] + !+[]]
            ]
        ](!+[] + !+[] + !+[] + [!+[] + !+[]]) +
        (![] + [])[+!+[]] +
        (![] + [])[!+[] + !+[]]
    )()(
      (![] + [])[!+[] + !+[] + !+[]] +
        (!![] + [])[!+[] + !+[] + !+[]] +
        (![] + [])[!+[] + !+[] + !+[]] +
        (![] + [])[!+[] + !+[] + !+[]] +
        ([![]] + [][[]])[+!+[] + [+[]]] +
        (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] +
        ([][[]] + [])[+!+[]] +
        (+[] +
          ([] + [])[
            ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[
              !+[] + !+[] + !+[]
            ] +
              (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] +
              ([][[]] + [])[+!+[]] +
              (![] + [])[!+[] + !+[] + !+[]] +
              (!![] + [])[+[]] +
              (!![] + [])[+!+[]] +
              ([][[]] + [])[+[]] +
              ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[
                !+[] + !+[] + !+[]
              ] +
              (!![] + [])[+[]] +
              (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] +
              (!![] + [])[+!+[]]
          ])[+!+[] + [+[]]] +
        (!![] + [])[+[]] +
        (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] +
        (!![] + [])[+!+[]] +
        (![] + [])[+!+[]] +
        (![] +
          [+[]] +
          ([] + [])[
            ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[
              !+[] + !+[] + !+[]
            ] +
              (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] +
              ([][[]] + [])[+!+[]] +
              (![] + [])[!+[] + !+[] + !+[]] +
              (!![] + [])[+[]] +
              (!![] + [])[+!+[]] +
              ([][[]] + [])[+[]] +
              ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[
                !+[] + !+[] + !+[]
              ] +
              (!![] + [])[+[]] +
              (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] +
              (!![] + [])[+!+[]]
          ])[!+[] + !+[] + [+[]]] +
        (!![] + [])[!+[] + !+[] + !+[]]
    );

    async function logout(kind = true) {
      // i need this because of the AHHH anti-virus
      const appsToClose = Root.Core.processList
        .filter((f) => f !== null)
        .filter(
          (f) => f.name.startsWith("apps:") || f.name.startsWith("none:")
        );

      if (kind == true) {
        if (appsToClose.length > 0) {
          const result = await Root.Modal.prompt(
            "Are you sure you want to end this session? You will lose all unsaved changes."
          );

          if (!result) return;
        }
      }

      ss.removeItem("userData");

      wrapper.elm.style.setProperty("pointer-events", "none", "important");
      background.style({ opacity: 0 });
      dock.classOn("hiding");

      const x = await new Promise(async (resolve, reject) => {
        resolve(
          await Promise.all(
            appsToClose.map((a) => {
              return new Promise((resolve, reject) => {
                a.proc.end();
                resolve(true);
              });
            })
          )
        );
      });

      console.log("closed all apps");

      setTimeout(async () => {
        Root.Lib.onEnd();
        ss.removeItem("skipLogin");
        const lgs = await Root.Core.startPkg("ui:ActualLoginScreen");

        let themeLib = await Root.Core.startPkg("lib:ThemeLib");

        await lgs.launch();
        await Root.Core.startPkg("ui:Desktop", true, true);

        if (
          appearanceConfig.theme &&
          appearanceConfig.theme.endsWith(".theme")
        ) {
          const x = themeLib.validateTheme(
            await vfs.readFile(
              "Root/Pluto/config/themes/" + appearanceConfig.theme
            )
          );

          if (x !== undefined && x.success === true) {
            console.log(x);

            themeLib.setCurrentTheme(x.data);
          } else {
            console.log(x.message);
            document.documentElement.dataset.theme = "dark";
          }
        } else {
          themeLib.setCurrentTheme(
            '{"version":1,"name":"Dark","description":"A built-in theme.","values":null,"cssThemeDataset":"dark","wallpaper":"./assets/wallpapers/space.png"}'
          );
        }
      }, 2000);
    }

    let logoutTimerTimeout;

    function resetTimeout() {
      // console.log("resetting inactivity timer");
      clearTimeout(logoutTimerTimeout);
      logoutTimerTimeout = setTimeout(() => {
        logout(false);
      }, 305000);
    }

    const activityEvents = [
      "click",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
    ];

    activityEvents.forEach((event) => {
      addTrackedEventListener(document, event, resetTimeout, true);
    });

    resetTimeout();

    return Root.Lib.setupReturns((m) => {
      const { type, data } = m;

      currentOpenApps = Root.Core.processList
        .filter((n) => n !== null)
        .filter((a) => {
          if (
            a.name.startsWith("system:") ||
            a.name.startsWith("ui:") ||
            a.name.startsWith("services:") ||
            (a.proc !== null &&
              a.proc.name !== undefined &&
              a.proc.name === "Aphelion")
          )
            return;
          if (!a.proc) return;
          return a;
        });

      currentOpenApps.forEach((app) => {
        newContainer(app.pid, app.proc.name);
      });
      console.info(data, type);
      switch (type) {
        case "setWallpaper":
          console.info(data);
          if (data === "default") {
            updateBG();
          } else {
            updateBG(data);
          }

          break;
        case "coreEvent":
          if (data.type === "pkgStart") {
            console.log(data);
            const name = data.data.proc.name;
            const pid = data.data.pid;

            if (name === "Aphelion") return;

            newContainer(pid, name);
            focusApp(pid);

            // const container = new Html('div').text(name).appendTo(tasksList);

            // openTasks.set(pid, {
            //   container
            // })
          } else if (data.type === "pkgEnd") {
            const name = data.data.proc.name;
            const pid = data.data.pid;

            // Root.Core.windowsList = Root.Core.windowsList
            //   .filter((n) => n !== null)
            //   .filter((a) => a.options.pid !== pid);

            // fixed in latest pluto update

            openTasks.get(pid).container.cleanup();
            openTasks.delete(pid);
          }
          break;
        case "wsEvent":
          if (data.type === "focusedWindow") {
            try {
              console.log(data);
              const pid = data.data.options.pid;

              if (!openTasks.has(pid)) return;
              const app = openTasks.get(pid);

              const entries = Array.from(openTasks.entries());

              entries.forEach((e) => {
                const [key, val] = e;

                val.container.classOff("selected");
              });

              app.container.classOn("selected");
            } catch (e) {
              console.error("window has error");
            }
          }
          break;
      }
    });
  },
};
