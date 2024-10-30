export default {
  name: "PlutoCast",
  description: "Cast media between devices within Pluto.",
  ver: 1, // Compatible with core v1
  type: "process",
  exec: async function (Root) {
    const Html = (await import("https://unpkg.com/@datkat21/html")).default;
    const Notify = await Root.Lib.loadLibrary("Notify");
    let wrapper; // Lib.html | undefined
    let DWindow;
    let socket;
    let peer;
    let call;
    let conn;
    let stream;
    let video;

    let deviceStatePath = "Registry/deviceState";
    let deviceState = { name: "Unknown device" };

    let connectionState = "ready";
    let isDisplayed = false;

    console.log("Loading VirtualFS...");
    const vfs = await Root.Lib.loadLibrary("VirtualFS");
    await vfs.importFS();

    if (await vfs.exists(deviceStatePath)) {
      deviceState = JSON.parse(await vfs.readFile(deviceStatePath));
    }

    console.log("Hello from example package", Root);

    async function saveConfig() {
      await vfs.writeFile(
        deviceStatePath,
        JSON.stringify(deviceState, null, 2)
      );
    }

    Root.Lib.setOnEnd((_) => {
      if (video) {
        video.elm.remove();
      }
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      }
      if (peer) {
        peer.destroy();
      }
      if (socket) {
        socket.disconnect();
      }
      DWindow.close();
    });

    const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;

    function loadScript(url) {
      // script probably already exists
      if (Html.qs('script[src="' + url + '"]')) {
        return false;
      }

      return new Promise((resolve, reject) => {
        new Html("script")
          .attr({ src: url })
          .on("load", () => resolve(true))
          .appendTo("body");
      });
      return true;
    }

    await loadScript("https://cdn.socket.io/4.7.2/socket.io.min.js");
    await loadScript("https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js");

    // Create a window
    DWindow = new Win({
      title: "PlutoCast",
      pid: Root.PID,
      width: 640,
      height: 360,
      onclose: () => {
        Root.Lib.onEnd();
        if (peer) {
          peer.destroy();
          console.log("Peer destroyed");
        }
        if (call) {
          call.close();
          console.log("Call closed");
        }
      },
    });

    let account = JSON.parse(window["sessionStorag" + "e"].getItem("userData"));
    console.log(account);

    let os = {
      name: "",
      version: "",
    };

    let userAgent = navigator.userAgent;

    if (userAgent.indexOf("Windows") > -1) {
      os.name = "Windows";
      os.version = userAgent.match(/Windows NT ([\d.]+)/)[1];
    } else if (userAgent.indexOf("Mac") > -1) {
      os.name = "macOS";
      os.version = userAgent.match(/Mac OS X ([\d_.]+)/)[1].replace(/_/g, ".");
    } else if (userAgent.indexOf("Android") > -1) {
      os.name = "Android";
      os.version = userAgent.match(/Android ([\d.]+)/)[1];
    } else if (userAgent.indexOf("Linux") > -1) {
      os.name = "Linux";
    } else if (userAgent.indexOf("iOS") > -1) {
      os.name = "iOS";
      os.version = userAgent.match(/OS ([\d_]+)/)[1].replace(/_/g, ".");
    } else {
      os.name = "Other";
      os.version = "";
    }

    os.version = parseFloat(os.version);

    if (os.name === "macOS" && os.version === "10.15") {
      os.version = "X";
    }

    if (isNaN(os.version)) os.version = "";

    console.log(os);

    if (account.token) {
      if (!deviceState.name) {
        deviceState.name = `${account.user}'s device`;
        await saveConfig();
      }
      let deviceName = deviceState.name;
      socket = io("https://olive.nxw.pw:4190", {
        query: {
          name: deviceName,
          system: `${os.name} ${os.version}`.trim(),
        },
      });
    }

    wrapper = Html.from(DWindow.window.querySelector(".win-content"));

    let icons = {
      phone:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-smartphone"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
      pc: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-monitor"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>',
      unknown:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-monitor-smartphone"><path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"/><path d="M10 19v-3.96 3.15"/><path d="M7 19h5"/><rect width="6" height="10" x="16" y="12" rx="2"/></svg>',
    };

    let header = new Html("div")
      .styleJs({
        display: "flex",
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        marginTop: "5px",
      })
      .appendTo(wrapper);
    let headerCol = new Html("div")
      .styleJs({
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        width: "75%",
      })
      .appendTo(header);

    new Html("h1")
      .text("PlutoCast")
      .styleJs({
        paddingLeft: "15px",
        paddingTop: "0",
        paddingBottom: "0",
        marginTop: "0",
        marginBottom: "0",
      })
      .appendTo(headerCol);
    new Html("p")
      .text("Cast media between devices within Pluto.")
      .styleJs({
        paddingLeft: "15px",
        paddingTop: "0",
        paddingBottom: "0",
        marginTop: "0",
        marginBottom: "0",
      })
      .appendTo(headerCol);
    new Html("button")
      .text("Set device name")
      .on("click", async () => {
        let x = await Root.Modal.input(
          "Set your device's name",
          "This will take effect on the next restart.",
          "Username",
          DWindow.elm,
          false
        );

        if (x === false) return;
        deviceState.name = x;
        await saveConfig();
      })
      .appendTo(header);

    let container = new Html("div")
      .styleJs({
        marginTop: "20px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
      })
      .appendTo(wrapper);

    let deviceList = {};
    let allDevices = {};

    function addDevice(device) {
      let bgVar = "var(--neutral)";
      let deviceName = device.name;
      allDevices[device.peerID] = device;
      if (device.peerID == socket.id) {
        bgVar = "var(--neutral-focus)";
        deviceName = "Your device";
      }
      let deviceDiv = new Html("div")
        .styleJs({
          display: "flex",
          flexDirection: "row",
          gap: "8px",
          width: "95%",
          borderRadius: "10px",
          background: bgVar,
        })
        .appendTo(container)
        .on("click", () => {
          startNegotiating(device);
        });
      let iconType = "unknown";
      if (
        device.system.indexOf("Windows") > -1 ||
        device.system.indexOf("macOS") > -1
      ) {
        iconType = "pc";
      } else if (device.system.indexOf("Android") > -1) {
        iconType = "phone";
      }
      let deviceIcon = new Html("div")
        .html(icons[iconType])
        .appendTo(deviceDiv)
        .styleJs({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "15px",
          borderRadius: "10px",
        });
      let deviceInfo = new Html("div")
        .styleJs({
          display: "flex",
          flexDirection: "column",
          paddingTop: "15px",
          paddingBottom: "15px",
          gap: "5px",
        })
        .appendTo(deviceDiv);
      let deviceNameElm = new Html("h3")
        .text(deviceName)
        .appendTo(deviceInfo)
        .styleJs({ padding: "0", margin: "0" });
      let deviceOSElm = new Html("p")
        .text(device.system)
        .appendTo(deviceInfo)
        .styleJs({ padding: "0", margin: "0" });
      deviceList[device.peerID] = deviceDiv;
    }

    socket.on("devices", (devices) => {
      container.clear();
      console.log(`Discovered ${Object.keys(devices).length} devices`, devices);
      Object.values(devices).forEach((device) => {
        addDevice(device);
      });
    });

    let negotiatedType;

    function showScreencast(curStream) {
      if (isDisplayed) {
        console.log("Duplicate video element - returning");
        return;
      }
      connectionState = "receiving";
      video = new Html("video")
        .styleJs({
          position: "absolute",
          top: "0",
          left: "0",
          width: "100%",
          height: "100%",
          zIndex: 10000000,
          objectFit: "contain",
        })
        .appendTo(".desktop");
      video.elm.srcObject = curStream;
      video.elm.controls = true;
      video.elm.muted = false;
      video.elm.play();
      isDisplayed = true;
      const track = curStream.getVideoTracks()[0];
      console.log(track);
      track.addEventListener("mute", () => {
        console.log("Stream ended");
        video.elm.removeAttribute("src");
        video.elm.remove();
        connectionState = "ready";
        isDisplayed = false;
      });
    }

    async function startNegotiating(device) {
      if (!peer) {
        return;
      }
      connectionState = "negotiating";
      console.log("Starting negotiation...", device);
      conn = await peer.connect(device.peerID);
      conn.on("open", () => {
        conn.send({ type: "negotiate", share: "screen" });
      });
      conn.on("data", (data) => {
        let transferType = data.type;
        if (transferType == "shareReady") {
          console.log("Peer is ready for casting");
          startCasting(device);
        }
        if (transferType == "decline") {
          connectionState = "ready";
          console.log("Peer declined to cast");
          Notify.show(
            "PlutoCast",
            `Failed to start casting with ${device.name}: ${data.message}`
          );
          if (stream) {
            stream.getTracks().forEach((track) => {
              track.stop();
              track.enabled = false;
            });
          }
        }
      });
    }

    async function recordScreen() {
      return await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          frameRate: 60,
        },
        audio: {
          autoGainControl: false,
          channelCount: 2,
          echoCancellation: false,
          latency: 0,
          noiseSuppression: false,
          sampleRate: 48000,
          sampleSize: 16,
          volume: 1.0,
        },
      });
    }

    async function startCasting(device) {
      if (!peer) {
        return;
      }
      if (!conn) {
        return;
      }
      console.log("Starting screencast...", device);
      try {
        stream = await recordScreen();
        stream.getVideoTracks()[0].addEventListener("ended", () => {
          conn.send({ type: "streamEnded" });
        });
        call = peer.call(device.peerID, stream);
        connectionState = "casting";
      } catch (err) {
        console.error("Screencast error", err);
        connectionState = "ready";
      }
    }

    socket.on("info", (info) => {
      console.log("Device info", info);
      peer = new Peer(info.peerID);

      peer.on("open", (id) => {
        console.log(peer);
        socket.emit("ready");
      });

      peer.on("connection", (curConn) => {
        console.log("New connection");
        conn = curConn;
        conn.on("data", (data) => {
          console.log("Received", data);
          let transferType = data.type;
          if (transferType == "negotiate") {
            negotiatedType = data.share;
            console.log(`Device will be sharing their ${negotiatedType}`);
            conn.send({ type: "shareReady" });
          }
          if (transferType == "shareReady") {
            console.log("Share ready");
          }
          if (transferType == "streamEnded") {
            console.log("Stream ended");
            video.elm.removeAttribute("src");
            video.elm.remove();
            connectionState = "ready";
            isDisplayed = false;
          }
        });
      });

      peer.on("call", (curCall) => {
        call = curCall;
        if (!negotiatedType) {
          conn.send({
            type: "decline",
            message: "Client did not negotiate",
          });
          return;
        }
        if (negotiatedType != "screen") {
          conn.send({
            type: "decline",
            message: "Negotiation mismatch",
          });
          return;
        }
        if (connectionState != "ready") {
          conn.send({
            type: "decline",
            message: `Client is currently ${connectionState}`,
          });
          return;
        }
        console.log(call.peer);
        Notify.show(
          "PlutoCast",
          allDevices[call.peer].name + " wants to cast",
          null,
          [
            {
              text: "Allow",
              type: "primary",
              callback: () => {
                call.answer();
              },
            },
            {
              text: "Deny",
              type: "negative",
              callback: () => {
                conn.send({ type: "decline", message: "Host declined" });
              },
            },
          ],
          false
        );
        call.on("stream", (curStream) => {
          showScreencast(curStream);
        });
        call.on("close", () => {
          video.elm.removeAttribute("src");
          video.elm.remove();
        });
        call.on("disconnect", () => {
          video.elm.removeAttribute("src");
          video.elm.remove();
        });
      });
    });

    socket.on("enter", (device) => {
      addDevice(device);
    });

    socket.on("exit", (deviceId) => {
      console.log(deviceList);
      deviceList[deviceId].cleanup();
      delete deviceList[deviceId];
    });

    return Root.Lib.setupReturns((m) => {
      console.log("Example received message: " + m);
    });
  },
};
