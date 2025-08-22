export default {
  name: "Pluto Contacts",
  description: "Store contacts and call them, right inside of Pluto.",
  ver: 1, // Compatible with core v1
  type: "process",
  privileges: [
    {
      privilege: "services",
      description: "Use the Zeon account service",
    },
    {
      privilege: "processList",
      description: "Required for Helper AI integration",
    },
  ],
  exec: async function (Root) {
    let wrapper;
    let PCWindow;
    let peer;
    let fuse;
    let users = [];
    let timeoutSeconds;
    let callNotification;
    let onDecline;
    let globalCall;

    let windows = [];
    let callState = "standby";
    let userData = {};
    let currentPage = "contacts";
    let shouldRetry = false;
    let currentCall;

    console.log("Pluto Contacts: Initializing...");

    const Html = (await import("https://unpkg.com/@datkat21/html")).default;
    const Notify = await Root.Lib.loadLibrary("Notify");
    const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;
    const vfs = await Root.Lib.loadLibrary("VirtualFS");
    await vfs.importFS();
    console.log("Pluto Contacts: Libraries loaded.");

    async function loadScript(url, integrity = null) {
      const existing = Html.qs(`script[src="${url}"]`);
      if (existing) {
        console.log(`Script already loaded: ${url}`);
        await new Promise((resolve) => setTimeout(resolve, 50));
        const libName = url.includes("fuse")
          ? "Fuse"
          : url.includes("peerjs")
          ? "Peer"
          : url.includes("lodash")
          ? "_"
          : null;
        if (libName && !window[libName]) {
          console.warn(
            `${libName} script tag exists but window.${libName} is missing. Retrying load.`
          );
          if (existing) existing.remove();
        } else if (libName && window[libName]) {
          return true;
        } else {
          return true;
        }
      }

      console.log(`Loading script: ${url}`);
      try {
        const script = new Html("script").attr({ src: url });
        if (integrity) {
          script.attr({ integrity: integrity, crossorigin: "anonymous" });
        }
        script.appendTo("body");
        let waitCounter = 0;
        const maxWait = 100;
        const checkInterval = 50;

        const checkGlobal = (libName) => {
          return !!window[libName];
        };

        const libName = url.includes("fuse")
          ? "Fuse"
          : url.includes("peerjs")
          ? "Peer"
          : url.includes("lodash")
          ? "_"
          : null;

        if (libName) {
          return new Promise((resolve, reject) => {
            const intervalId = setInterval(() => {
              if (checkGlobal(libName)) {
                clearInterval(intervalId);
                console.log(`Script loaded successfully: ${url}`);
                resolve(true);
              } else if (waitCounter++ > maxWait) {
                clearInterval(intervalId);
                console.error(`Timeout loading script: ${url}`);
                reject(new Error(`Timeout loading script: ${url}`));
              }
            }, checkInterval);
          });
        } else {
          await new Promise((resolve) => setTimeout(resolve, 200));
          console.log(`Script assumed loaded (no global check): ${url}`);
          return true;
        }
      } catch (error) {
        console.error(`Failed to load script ${url}:`, error);
        Notify.show(
          "Pluto Contacts",
          `Error: Failed to load dependency ${url}.`
        );
        return false;
      }
    }

    let Fuse, Peer, _;
    try {
      await loadScript("https://cdn.jsdelivr.net/npm/fuse.js/dist/fuse.js");
      await loadScript("https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js");
      await loadScript(
        "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"
      );
      console.log("Pluto Contacts: External scripts loaded.");

      Fuse = window.Fuse;
      Peer = window.Peer;
      _ = window._;
      if (!Fuse || !Peer || !_) {
        throw new Error(
          "External libraries (Fuse, PeerJS, Lodash) failed to initialize globally."
        );
      }
    } catch (scriptError) {
      console.error(
        "Pluto Contacts: CRITICAL - Failed to load essential scripts.",
        scriptError
      );
      Notify.show(
        "Pluto Contacts",
        "Error loading core components. App cannot start.",
        null,
        [],
        true
      );
      return;
    }

    const icons = {
      contacts:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-user"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><circle cx="12" cy="8" r="2"/><path d="M15 13a3 3 0 1 0-6 0"/></svg>',
      tags: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tags"><path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42L9 5Z"/><path d="M6 9.01V9"/><path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19"/></svg>',
      video:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-video"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>',
      videoOff:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-video-off"><path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8"/><path d="m2 2 20 20"/><path d="M14 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1.34l1 1"/><path d="M8 12.34V18l-6-4 2.22-1.48"/></svg>',
      audio:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone-call"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/><path d="M14.05 2a9 9 0 0 1 8 7.94"/><path d="M14.05 6A5 5 0 0 1 18 10"/></svg>',
      add: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
      remove:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash2-icon lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>',
      cancel:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone-off-icon lucide-phone-off"><path d="M10.1 13.9a14 14 0 0 0 3.732 2.668 1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2 18 18 0 0 1-12.728-5.272"/><path d="M22 2 2 22"/><path d="M4.76 13.582A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 .244.473"/></svg>',
      mic: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mic-icon lucide-mic"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg>',
      micOff:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mic-off-icon lucide-mic-off"><path d="M12 19v3"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M16.95 16.95A7 7 0 0 1 5 12v-2"/><path d="M18.89 13.23A7 7 0 0 0 19 12v-2"/><path d="m2 2 20 20"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/></svg>',
      chevronUp:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up-icon lucide-chevron-up"><path d="m18 15-6-6-6 6"/></svg>',
    };

    let onEndTriggered = false;
    Root.Lib.setOnEnd((_) => {
      {
        if (onEndTriggered) return;
        onEndTriggered = true;
        console.log("Pluto Contacts: Received end signal. Cleaning up...");
        shouldRetry = false;
        if (onDecline) {
          document.removeEventListener("call-decline", onDecline);
        }
        document.dispatchEvent(new CustomEvent("app-closing"));
        windows.forEach((win) => {
          try {
            if (win && !win.closed) {
              win.close();
            }
          } catch (e) {
            console.warn("Error closing window during cleanup:", e);
          }
        });
        windows = [];

        if (peer && !peer.destroyed) {
          console.log("Pluto Contacts: Destroying PeerJS connection...");
          try {
            peer.destroy();
            console.log("Pluto Contacts: PeerJS connection destroyed.");
          } catch (e) {
            console.warn(
              "Pluto Contacts: Error destroying PeerJS connection:",
              e
            );
          }
        }

        if (currentCall) {
          currentCall.close();
        }

        peer = null;
        currentCall = null;
        if (integrationListener) clearInterval(integrationListener);
        integrationListener = null;
        console.log("Pluto Contacts: Cleanup finished.");
        return;
      }
    });

    PCWindow = new Win({
      title: "Pluto Contacts",
      content:
        '<div class="loading-placeholder" style="padding: 20px; text-align: center;">Loading Contacts...</div>',
      pid: Root.PID,
      width: 854,
      height: 480,
      onclose: () => {
        console.log("Pluto Contacts: Main window closed by user.");
        Root.Lib.onEnd();
      },
    });
    windows.push(PCWindow);
    wrapper = Html.from(PCWindow.window.querySelector(".win-content"));
    wrapper.styleJs({
      flexDirection: "column",
      position: "relative",
    });

    let integrationListener;

    async function helperIntegrate(pid) {
      const integrationPayload = {
        name: "Pluto Contacts",
        description:
          "An integration that lets Helper search for your contacts, and call them.",
        pid: Root.PID,
        id: "plutoContacts",
        packageName: "tranch--contacts.app",
        functions: [
          {
            name: "plutoContactsSearch",
            description: "Search for contacts on Pluto Contacts",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query prompted" },
              },
            },
            required: ["query"],
          },
          {
            name: "plutoContactsCall",
            description: "Call contacts on Pluto Contacts",
            parameters: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description:
                    "Name of the user (REQUIRED: can be obtained using the plutoContactsSearch function)",
                },
                id: {
                  type: "string",
                  description:
                    "ID of the user (REQUIRED: can be obtained using the plutoContactsSearch function)",
                },
              },
            },
            required: ["name", "id"],
          },
        ],
      };
      if (Root.Core.processList[pid] && Root.Core.processList[pid].proc) {
        console.log(
          "Pluto Contacts: Sending integration payload to Helper AI (PID:",
          pid,
          ")"
        );
        try {
          Root.Core.processList[pid].proc.send({
            type: "integration",
            content: integrationPayload,
          });
        } catch (e) {
          console.warn(
            "Pluto Contacts: Failed to send integration payload:",
            e
          );
        }
      } else {
        console.warn(
          "Pluto Contacts: Could not find Helper AI process (PID:",
          pid,
          ") to send integration."
        );
      }
    }

    integrationListener = setInterval(async () => {
      const helperInfPath = "Registry/helperInfo";
      try {
        const helperInfExists = await vfs.exists(helperInfPath);
        if (helperInfExists) {
          let helperInfo = JSON.parse(await vfs.readFile(helperInfPath));
          if (helperInfo.open && helperInfo.pid) {
            console.log(
              "Pluto Contacts: Helper AI detected (PID:" +
                helperInfo.pid +
                "). Integrating..."
            );
            clearInterval(integrationListener);
            integrationListener = null;
            helperIntegrate(helperInfo.pid);
          }
        }
      } catch (err) {
        console.warn(
          "Pluto Contacts: Error checking for Helper AI integration:",
          err
        );
      }
    }, 2000);

    const CONTACTS_PATH = "Registry/contactsList";
    const SETTINGS_PATH = "Registry/contactsCallSettings";

    async function saveCallPreferences(prefs) {
      try {
        await vfs.writeFile(SETTINGS_PATH, JSON.stringify(prefs));
        console.log("Saved call preferences:", prefs);
      } catch (e) {
        console.error("Failed to save call preferences:", e);
      }
    }

    async function loadCallPreferences() {
      try {
        if (await vfs.exists(SETTINGS_PATH)) {
          const settingsJson = await vfs.readFile(SETTINGS_PATH);
          const prefs = JSON.parse(settingsJson);
          console.log("Loaded call preferences:", prefs);
          return prefs;
        }
      } catch (e) {
        console.error("Failed to load call preferences:", e);
      }
      return {}; // Return empty object if not found or error
    }

    async function getContacts() {
      try {
        if (await vfs.exists(CONTACTS_PATH)) {
          const contactsJson = await vfs.readFile(CONTACTS_PATH);
          const contacts = JSON.parse(contactsJson);
          return Array.isArray(contacts) ? contacts : [];
        }
      } catch (e) {
        console.error("Error reading or parsing contacts list:", e);
        Notify.show(
          "Pluto Contacts",
          "Error loading contacts. Resetting list."
        );
        try {
          await vfs.writeFile(CONTACTS_PATH, JSON.stringify([]));
        } catch (writeError) {
          console.error("Failed to reset contacts file:", writeError);
          Notify.show(
            "Pluto Contacts",
            "CRITICAL: Failed to reset contacts file.",
            null,
            [],
            true
          );
        }
      }
      return [];
    }

    async function addContact(contactObj) {
      console.log("Attempting to add contact:", contactObj);
      if (
        !contactObj ||
        typeof contactObj.u !== "string" ||
        !contactObj.u.trim() ||
        (typeof contactObj.id !== "string" &&
          typeof contactObj.id !== "number") ||
        contactObj.id === null ||
        contactObj.id === undefined
      ) {
        Notify.show("Pluto Contacts", `Invalid contact data provided.`);
        console.error("Invalid contact data:", contactObj);
        return false;
      }

      let contacts = await getContacts();
      const contactId = contactObj.id;

      if (contacts.some((c) => String(c.id) === String(contactId))) {
        Notify.show(
          "Pluto Contacts",
          `${contactObj.u} is already in your contacts.`
        );
        return false;
      }

      const newContact = {
        u: contactObj.u.trim(),
        id: contactId,
        a: contactObj.a || "/assets/default.png",
        bio: contactObj.bio || "",
      };

      contacts.push(newContact);

      try {
        await vfs.writeFile(CONTACTS_PATH, JSON.stringify(contacts, null, 2));
        Notify.show("Pluto Contacts", `${newContact.u} added to contacts.`);
        if (currentPage === "contacts" && typeof contactsList === "function") {
          await contactsList();
        }
        return true;
      } catch (e) {
        console.error("Error writing contacts list:", e);
        Notify.show("Pluto Contacts", "Error saving contact.");
        return false;
      }
    }

    async function removeContact(contactIdToRemove) {
      let contacts = await getContacts();
      const initialLength = contacts.length;
      contacts = contacts.filter(
        (contact) => String(contact.id) !== String(contactIdToRemove)
      );

      if (contacts.length === initialLength) {
        Notify.show("Pluto Contacts", "Contact not found to remove.");
        return false;
      }

      try {
        await vfs.writeFile(CONTACTS_PATH, JSON.stringify(contacts, null, 2));
        if (currentPage === "contacts" && typeof contactsList === "function") {
          await contactsList();
        }
        return true;
      } catch (e) {
        console.error("Error writing contacts list after removal:", e);
        Notify.show("Pluto Contacts", "Error saving contacts after removal.");
        return false;
      }
    }

    async function indexUsers() {
      console.log("Indexing Zeon users...");
      try {
        let result = await fetch("https://zeon.dev/api/public/searchUsers", {
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ user: "" }),
          method: "POST",
        });
        if (!result.ok) throw new Error(`HTTP error! status: ${result.status}`);
        users = await result.json();
        if (!Array.isArray(users)) {
          console.warn("Zeon user search did not return an array:", users);
          users = [];
        }
        fuse = new Fuse(users, {
          keys: ["u", "id"],
          threshold: 0.3,
          includeScore: true,
        });
        console.log(`Indexed ${users.length} users.`);
        return users;
      } catch (error) {
        console.error("Failed to index Zeon users:", error);
        Notify.show("Pluto Contacts", "Could not fetch user list from Zeon.");
        users = [];
        fuse = new Fuse([], { keys: ["u", "id"] });
        return [];
      }
    }

    async function createAndShowIncomingCallOverlay(
      callerInfo,
      callType,
      onAccept,
      onDecline,
      streamRef
    ) {
      document.querySelector(".facetime-call-overlay")?.remove();

      const overlay = new Html("div")
        .classOn("facetime-call-overlay")
        .appendTo("body");

      const previewContainer = new Html("div")
        .classOn("facetime-preview-container")
        .appendTo(overlay);
      const videoPreview = new Html("video")
        .classOn("facetime-preview-video")
        .attr({ autoplay: true, muted: true, playsinline: true })
        .appendTo(previewContainer);
      const placeholder = new Html("div")
        .classOn("facetime-preview-placeholder")
        .text(
          callType === "video" ? "Camera starting..." : "Incoming Audio Call"
        )
        .appendTo(previewContainer);

      const controlsContainer = new Html("div")
        .classOn("facetime-controls-container")
        .appendTo(overlay);

      const style = new Html("style")
        .text(
          `
        .facetime-call-overlay {
            position: fixed; bottom: 54px; right: 20px; width: 380px;
            background-color: var(--root);
            color: var(--on-surface, white); border-radius: 18px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4); z-index: 10001;
            overflow: hidden; transform: scale(0.9); opacity: 0;
            transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease;
            display: flex; flex-direction: column;
        }
        .facetime-preview-container {
            position: relative; height: 214px; /* 16:9 aspect ratio for 380px width */
            background-color: var(--unfocused);
            display: flex; align-items: center; justify-content: center;
        }
        .facetime-preview-video {
            width: 100%; height: 100%; object-fit: cover;
            transform: scaleX(-1); display: none;
        }
        .facetime-preview-placeholder { color: #888; }
        .facetime-controls-container {
            display: flex; align-items: center; justify-content: space-between;
            padding: 15px 20px; height: 90px; box-sizing: border-box;
        }
        .facetime-caller-info { display: flex; align-items: center; gap: 15px; }
        .facetime-caller-info img { width: 50px; height: 50px; border-radius: 50%; background-color: #555; }
        .facetime-caller-info h3 { margin: 0; font-size: 1.1em; font-weight: 500; }
        .facetime-caller-info p { margin: 2px 0 0 0; font-size: 0.9em; opacity: 0.8; }
        .facetime-actions { display: flex; gap: 8px; align-items: center; }
        .facetime-actions button {
            width: 44px; height: 44px; border-radius: 50%; border: none; cursor: pointer;
            display: flex; align-items: center; justify-content: center; padding: 0;
            transition: transform 0.1s ease; color: white;
        }
        .facetime-actions button:active { transform: scale(0.9); }
        .facetime-decline { background-color: #ff3b30; }
        .facetime-accept-group { position: relative; display: flex; background-color: #34c759; border-radius: 22px; }
        .facetime-accept { background: none; }
        .facetime-accept-options { background: none; width: 30px; border-left: 1px solid rgba(255,255,255,0.3); }
        .facetime-device-menu {
            display: none; position: absolute; bottom: 55px; right: 0;
            background-color: var(--root); backdrop-filter: blur(10px);
            border-radius: 8px; padding: 10px; width: 250px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .facetime-device-menu select { width: 100%; }
      `
        )
        .appendTo(overlay);

      const callerInfoDiv = new Html("div")
        .classOn("facetime-caller-info")
        .appendTo(controlsContainer);
      const avatarUrl =
        callerInfo.a && callerInfo.a.startsWith("http")
          ? callerInfo.a
          : "https://zeon.dev" + (callerInfo.a || "/assets/default.png");
      new Html("img").attr({ src: avatarUrl }).appendTo(callerInfoDiv);
      const infoText = new Html("div").appendTo(callerInfoDiv);
      new Html("h3").text(callerInfo.u).appendTo(infoText);
      new Html("p")
        .text(`Pluto ${callType.charAt(0).toUpperCase() + callType.slice(1)}`)
        .appendTo(infoText);

      const actions = new Html("div")
        .classOn("facetime-actions")
        .appendTo(controlsContainer);
      const declineButton = new Html("button")
        .classOn("facetime-decline")
        .html(icons.cancel)
        .appendTo(actions);

      const acceptGroup = new Html("div")
        .classOn("facetime-accept-group")
        .appendTo(actions);
      const acceptButton = new Html("button")
        .classOn("facetime-accept")
        .html(callType === "video" ? icons.video : icons.audio)
        .appendTo(acceptGroup);
      const optionsButton = new Html("button")
        .classOn("facetime-accept-options")
        .html(icons["chevronUp"])
        .appendTo(acceptGroup);

      const deviceMenu = new Html("div")
        .classOn("facetime-device-menu")
        .appendTo(acceptGroup);
      new Html("label").text("Microphone").appendTo(deviceMenu);
      const audioSelect = new Html("select").appendTo(deviceMenu);
      let videoSelect;
      if (callType === "video") {
        new Html("label").text("Camera").appendTo(deviceMenu);
        videoSelect = new Html("select").appendTo(deviceMenu);
      }

      const prefs = await loadCallPreferences();
      try {
        const getStream = async () => {
          if (callType === "video") {
            const videoConstraint = prefs.videoDeviceId
              ? { deviceId: { exact: prefs.videoDeviceId } }
              : true;
            streamRef.stream = await navigator.mediaDevices.getUserMedia({
              video: videoConstraint,
            });
            videoPreview.elm.srcObject = streamRef.stream;
            videoPreview.styleJs({ display: "block" });
            placeholder.styleJs({ display: "none" });
          }
        };
        await getStream();

        const devices = await navigator.mediaDevices.enumerateDevices();
        devices
          .filter((d) => d.kind === "audioinput")
          .forEach((d) =>
            new Html("option")
              .attr({ value: d.deviceId })
              .text(d.label || `Mic ${audioSelect.elm.options.length + 1}`)
              .appendTo(audioSelect)
          );
        if (videoSelect) {
          devices
            .filter((d) => d.kind === "videoinput")
            .forEach((d) =>
              new Html("option")
                .attr({ value: d.deviceId })
                .text(d.label || `Cam ${videoSelect.elm.options.length + 1}`)
                .appendTo(videoSelect)
            );
          if (prefs.videoDeviceId) videoSelect.elm.value = prefs.videoDeviceId;
        }
        if (prefs.audioDeviceId) audioSelect.elm.value = prefs.audioDeviceId;
      } catch (err) {
        console.warn(
          "Could not get camera for preview or enumerate devices:",
          err
        );
        placeholder.text("Camera not available.");
      }

      async function updatePreviewCamera() {
        if (callType !== "video" || !videoSelect) return;

        if (streamRef.stream) {
          streamRef.stream.getTracks().forEach((track) => track.stop());
        }

        const videoDeviceId = videoSelect.getValue();
        console.log("Switching camera preview to device:", videoDeviceId);

        placeholder.text("Switching camera...").styleJs({ display: "block" });
        videoPreview.styleJs({ display: "none" });
        videoPreview.elm.srcObject = null;

        try {
          const constraints = {
            video: videoDeviceId
              ? { deviceId: { exact: videoDeviceId } }
              : true,
          };
          streamRef.stream = await navigator.mediaDevices.getUserMedia(
            constraints
          );

          videoPreview.elm.srcObject = streamRef.stream;
          await videoPreview.elm.play();

          videoPreview.styleJs({ display: "block" });
          placeholder.styleJs({ display: "none" });
        } catch (err) {
          console.error("Failed to switch camera for preview:", err);
          placeholder.text("Failed to start camera.");
          videoPreview.elm.srcObject = null;
          if (streamRef.stream) {
            streamRef.stream.getTracks().forEach((track) => track.stop());
            streamRef.stream = null;
          }
        }
      }

      if (videoSelect) {
        videoSelect.on("change", updatePreviewCamera);
      }

      setTimeout(
        () => overlay.styleJs({ transform: "scale(1)", opacity: 1 }),
        10
      );
      const ringtone = new Html("audio")
        .attr({
          src: "https://prismatic-fairy-9a69bd.netlify.app/assets/Pluto-Contacts-Ringtone.wav",
          autoplay: true,
          loop: true,
        })
        .appendTo(overlay);

      const destroy = () => {
        ringtone.elm.pause();
        if (streamRef.stream) {
          streamRef.stream.getTracks().forEach((track) => track.stop());
          streamRef.stream = null;
        }
        overlay.cleanup();
      };

      optionsButton.on("click", (e) => {
        e.stopPropagation();
        deviceMenu.styleJs({
          display:
            window.getComputedStyle(deviceMenu.elm).display === "block"
              ? "none"
              : "block",
        });
      });
      document.body.addEventListener("click", (e) => {
        if (
          window.getComputedStyle(deviceMenu.elm).display === "block" &&
          !acceptGroup.elm.contains(e.target)
        ) {
          deviceMenu.styleJs({ display: "none" });
        }
      });

      declineButton.on("click", () => {
        destroy();
        onDecline();
      });

      acceptButton.on("click", async () => {
        const audioId = audioSelect.getValue();
        const videoId = videoSelect ? videoSelect.getValue() : null;
        await saveCallPreferences({
          audioDeviceId: audioId,
          videoDeviceId: videoId,
        });
        destroy();
        onAccept(audioId, videoId);
      });

      return { destroy };
    }

    function setupPeer() {
      if (typeof _ === "undefined" || !_) {
        console.error(
          "Lodash (_) is not defined. Cannot proceed with Peer setup."
        );
        Notify.show(
          "Pluto Contacts",
          "Error: Core library missing (Lodash). Cannot init calls.",
          null,
          [],
          true
        );
        return;
      }
      if (peer && !peer.destroyed) {
        console.log("PeerJS already initialized and not destroyed.");
        if (peer.disconnected) {
          console.log("PeerJS is disconnected, attempting reconnect...");
          try {
            peer.reconnect();
          } catch (e) {
            console.warn("PeerJS reconnect failed, will setup new peer:", e);
            if (peer && !peer.destroyed) peer.destroy();
            peer = null;
            setTimeout(setupPeer, 3000);
          }
        }
        return;
      } else if (peer && peer.destroyed) {
        console.log(
          "Previous PeerJS instance was destroyed, creating new one."
        );
        peer = null;
      }

      let service = Root.Core.services.find((x) => x.name === "Account");
      userData = service && service.ref ? service.ref.getUserData() : {};

      if (!userData.onlineAccount || !userData.username || !userData.id) {
        Notify.show(
          "Pluto Contacts",
          "Sign in via Settings to make/receive calls.",
          null,
          [],
          true
        );
        console.warn(
          "PeerJS setup skipped: User not logged in or missing data."
        );
        return;
      }

      const peerId = `${userData.username}-${String(userData.id)}`;
      console.log("Attempting to connect PeerJS with ID:", peerId);

      try {
        const PeerConstructor =
          typeof Peer !== "undefined" ? Peer : window.Peer;
        if (!PeerConstructor) throw new Error("PeerJS constructor not found.");

        peer = new PeerConstructor(peerId, {
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              {
                urls: "turn:freestun.net:3478",
                username: "free",
                credential: "free",
              },
            ],
          },
        });
      } catch (error) {
        console.error("!!! PeerJS constructor failed:", error);
        Notify.show(
          "Pluto Contacts",
          "Fatal Error: Could not initialize call service.",
          null,
          [],
          true
        );
        peer = null;
        return;
      }

      peer.on("open", (id) => {
        console.log("PeerJS: Connection open. My ID is:", id);
        Notify.show(
          "Pluto Contacts",
          `Ready to receive calls as ${userData.username}`
        );
      });

      peer.on("connection", (conn) => {
        console.log(
          "PeerJS: Incoming generic data connection from:",
          conn.peer
        );
        conn.on("data", (data) => {
          console.log(
            "PeerJS: Received generic data:",
            data,
            "from:",
            conn.peer
          );
          if (data === "cancel") {
            document.dispatchEvent(
              new CustomEvent("call-cancelled", {
                detail: { peer: conn.peer },
              })
            );
            return;
          }
          if (data == "decline") {
            document.dispatchEvent(new CustomEvent("call-decline"));
          }
          if (data == "busy") {
            document.dispatchEvent(new CustomEvent("call-decline"));
          }
          if (data == "recvRequest") {
            // timeoutSeconds = 30;
            console.log("Recipient is ringing");
          }
        });
        conn.on("close", () => {
          console.log("PeerJS: Generic data connection closed:", conn.peer);
          document.dispatchEvent(
            new CustomEvent("conn-disconnected", { detail: conn.peer })
          );
        });
        conn.on("error", (err) => {
          console.warn(
            "PeerJS: Generic data connection error:",
            conn.peer,
            err
          );
        });
      });

      peer.on("call", async (call) => {
        console.log("PeerJS: Incoming call from:", call.peer);

        if (callState !== "standby") {
          console.log(
            `PeerJS: Busy (${callState}), declining call from:`,
            call.peer
          );
          let busyConn = null;
          try {
            busyConn = peer.connect(call.peer);
            busyConn.on("open", () => {
              try {
                busyConn.send("busy");
              } catch (e) {
                console.warn("Failed sending busy signal", e);
              }
              setTimeout(() => busyConn.close(), 500);
            });
            busyConn.on("error", (err) => {
              console.warn("Failed to send busy signal (conn error):", err);
              if (busyConn) busyConn.close();
            });
          } catch (e) {
            console.warn("Error creating connection for busy signal:", e);
            if (busyConn) busyConn.close();
          }
          call.close();
          return;
        }

        callState = "receiving a call";
        const callerUsername = call.peer.split("-")[0];
        const callerInfo = users.find((u) => u.u === callerUsername) ||
          (await getContacts()).find((c) => c.u === callerUsername) || {
            u: callerUsername,
            a: "/assets/default.png",
          };

        const callType = call.metadata?.type === "video" ? "video" : "audio";

        let callDataConn = peer.connect(call.peer);
        let callSignalInterval;
        let CSWindow;
        let localStream = null;
        let localPreviewStream = null;
        let uiElements = {};
        let audioPlayerElement = null;
        let callOverlay;

        let cleanupCalled = false;
        let handleCancelEvent;

        const cleanupReceivedCall = (reason) => {
          if (cleanupCalled) return;
          cleanupCalled = true;
          console.log(
            `Cleaning up received call (${reason}). Current state: ${callState}`
          );

          document.removeEventListener("call-cancelled", handleCancelEvent);

          callState = "standby";
          clearInterval(callSignalInterval);

          const existingOverlay = document.querySelector(
            ".facetime-call-overlay"
          );
          if (existingOverlay) {
            console.log("Found and removing overlay from DOM.");
            const ringtone = existingOverlay.querySelector("audio");
            if (ringtone) ringtone.pause();
            existingOverlay.remove();
          }
          callOverlay = null;

          if (localPreviewStream) {
            localPreviewStream.getTracks().forEach((track) => track.stop());
            localPreviewStream = null;
          }
          if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
            localStream = null;
          }
          if (call) {
            call.close();
          }
          if (callDataConn && callDataConn.open) {
            try {
              callDataConn.close();
            } catch (e) {}
            callDataConn = null;
          }
          if (CSWindow && !CSWindow.closed) {
            CSWindow.close();
            CSWindow = null;
          }
          windows = windows.filter((w) => w !== CSWindow);

          if (audioPlayerElement) {
            audioPlayerElement.cleanup();
            audioPlayerElement = null;
          }

          console.log("Receiver: Call cleanup finished.");
        };

        handleCancelEvent = (event) => {
          if (
            event.detail.peer === call.peer &&
            callState === "receiving a call"
          ) {
            Notify.show("Pluto Contacts", "Caller cancelled the call.");
            cleanupReceivedCall("Caller Cancelled");
          }
        };

        document.addEventListener("call-cancelled", handleCancelEvent);

        callDataConn.on("open", () => {
          console.log(
            "Data connection for signaling established with caller:",
            call.peer
          );
          callSignalInterval = setInterval(() => {
            if (
              callState === "receiving a call" &&
              callDataConn &&
              callDataConn.open
            ) {
              try {
                callDataConn.send("recvRequest");
              } catch (e) {
                console.warn("Failed to send recvRequest", e);
                clearInterval(callSignalInterval);
              }
            } else {
              clearInterval(callSignalInterval);
            }
          }, 2000);
        });
        callDataConn.on("error", (err) => {
          console.error(
            "Signaling data connection error (incoming call):",
            err
          );
          Notify.show(
            "Pluto Contacts",
            "Connection error during incoming call."
          );
          if (callState === "receiving a call") {
            cleanupReceivedCall("Data Error");
          }
          clearInterval(callSignalInterval);
        });
        callDataConn.on("close", () => {
          console.log(
            "Signaling data connection closed (incoming call):",
            call.peer
          );
          document.dispatchEvent(
            new CustomEvent("conn-disconnected", { detail: call.peer })
          );
          clearInterval(callSignalInterval);
          if (callState === "receiving a call" && !cleanupCalled) {
            Notify.show(
              "Pluto Contacts",
              `You missed a call from ${callerUsername}.`
            );
            cleanupReceivedCall("Data Closed Before Answer");
          }
        });
        callDataConn.on("data", (data) => {
          console.log("Receiver: Received data via callDataConn:", data);
        });

        const onAcceptCallback = async (selectedAudioId, selectedVideoId) => {
          if (cleanupCalled || callState !== "receiving a call") return;

          clearInterval(callSignalInterval);
          console.log("User accepted call from", call.peer, "with devices:", {
            audio: selectedAudioId,
            video: selectedVideoId,
          });
          callState = "connecting";

          localStream = null;
          CSWindow = null;
          let isMuted = false;
          let isCameraOff = false;
          const mediaConstraints = {
            audio: selectedAudioId
              ? { deviceId: { exact: selectedAudioId } }
              : true,
            video:
              callType === "video"
                ? selectedVideoId
                  ? { deviceId: { exact: selectedVideoId } }
                  : true
                : false,
          };

          try {
            localStream = await navigator.mediaDevices.getUserMedia(
              mediaConstraints
            );

            CSWindow = new Win({
              title: `${
                callType === "video" ? "Video" : "Audio"
              } call with ${callerUsername}`,
              content: "",
              pid: Root.PID,
              width: callType === "video" ? 854 : 360,
              height: callType === "video" ? 480 : 550,
              onclose: () => {
                cleanupReceivedCall("Window Closed");
              },
            });
            windows.push(CSWindow);
            let CSWindowWrapper = Html.from(
              CSWindow.window.querySelector(".win-content")
            );

            uiElements = createCallWindowUI(
              CSWindowWrapper,
              callerInfo,
              callType
            );
            uiElements.callStatusElement.text("Connecting...");
            if (callType === "video" && uiElements.localVideoElement?.elm) {
              uiElements.localVideoElement.elm.srcObject = localStream;
            }

            console.log("Answering call...");
            call.answer(localStream);

            let elapsedInt = null;
            call.on("stream", (remoteStream) => {
              currentCall = call;
              if (cleanupCalled || callState === "standby") return;
              console.log("Received remote stream from:", call.peer);
              callState = "in call";
              if (uiElements.callStatusElement)
                uiElements.callStatusElement.text("Connected");
              globalCall = call;

              if (uiElements.buttonContainerElement) {
                uiElements.buttonContainerElement.clear();
                const muteButton = new Html("button")
                  .attr({
                    title: "Mute/Unmute",
                    class: "call-btn mute-btn",
                  })
                  .appendTo(uiElements.buttonContainerElement);
                muteButton.elm.innerHTML = icons.mic;
                muteButton.on("click", () => {
                  isMuted = !isMuted;
                  if (localStream) {
                    localStream.getAudioTracks().forEach((t) => {
                      t.enabled = !isMuted;
                    });
                  }
                  muteButton.elm.innerHTML = isMuted ? icons.micOff : icons.mic;
                });

                if (callType === "video") {
                  const videoButton = new Html("button")
                    .attr({
                      title: "Turn Camera On/Off",
                      class: "call-btn mute-btn",
                    })
                    .appendTo(uiElements.buttonContainerElement);
                  videoButton.elm.innerHTML = icons.video;
                  videoButton.on("click", () => {
                    isCameraOff = !isCameraOff;
                    if (localStream) {
                      localStream.getVideoTracks().forEach((t) => {
                        t.enabled = !isCameraOff;
                      });
                    }
                    videoButton.elm.innerHTML = isCameraOff
                      ? icons.videoOff
                      : icons.video;
                  });
                }

                const endCallButton = new Html("button")
                  .attr({ title: "End Call", class: "call-btn end-btn" })
                  .appendTo(uiElements.buttonContainerElement);
                endCallButton.elm.innerHTML = icons.cancel;
                endCallButton.on("click", () =>
                  cleanupReceivedCall("User Ended")
                );
              }
              if (callType === "video") {
                if (uiElements.remoteVideoElement?.elm) {
                  uiElements.remoteVideoElement.elm.srcObject = remoteStream;
                  uiElements.remoteVideoElement.elm.play();
                }
              } else {
                audioPlayerElement = new Html("audio")
                  .attr({ autoplay: true, controls: false })
                  .styleJs({ display: "none" });
                try {
                  audioPlayerElement.elm.srcObject = remoteStream;
                  audioPlayerElement.appendTo(CSWindowWrapper);
                  audioPlayerElement.elm
                    .play()
                    .catch((e) => console.warn("Audio play failed:", e));
                } catch (e) {
                  console.error("Error setting srcObject for remote audio:", e);
                  Notify.show("Pluto Contacts", "Error playing remote audio.");
                  cleanupReceivedCall("Audio Playback Error");
                  return;
                }
              }

              let startTime = Date.now();
              elapsedInt = setInterval(() => {
                if (callState !== "in call" || cleanupCalled) {
                  clearInterval(elapsedInt);
                  return;
                }
                let elapsed = Math.floor((Date.now() - startTime) / 1000);
                let mins = Math.floor(elapsed / 60)
                  .toString()
                  .padStart(2, "0");
                let secs = (elapsed % 60).toString().padStart(2, "0");
                if (uiElements.timerDisplayElement)
                  uiElements.timerDisplayElement.text(
                    `${mins}:${secs} elapsed`
                  );
              }, 1000);
            });

            call.on("close", () => {
              if (!cleanupCalled) {
                console.log("Call closed by remote peer:", call.peer);
                Notify.show(
                  "Pluto Contacts",
                  "Call ended by " + callerUsername
                );
                cleanupReceivedCall("Remote Closed");
              }
            });

            call.on("error", (err) => {
              if (!cleanupCalled) {
                console.error("Call error (receiver side):", err);
                Notify.show(
                  "Pluto Contacts",
                  `Call error: ${err.message || err.type || "Unknown"}`
                );
                cleanupReceivedCall("Media Error");
              }
            });
          } catch (err) {
            console.error("Failed to accept call:", err);
            Notify.show(
              "Pluto Contacts",
              `Error accepting call: ${err.message || "Unknown error"}`
            );
            if (callDataConn && callDataConn.open) {
              try {
                callDataConn.send("decline");
              } catch (e) {}
            }
            cleanupReceivedCall("Accept Failed");
          }
        };

        const onDeclineCallback = () => {
          if (cleanupCalled || callState !== "receiving a call") return;

          clearInterval(callSignalInterval);
          console.log("User declined call from:", call.peer);

          if (callDataConn && callDataConn.open) {
            try {
              callDataConn.send("decline");
            } catch (e) {}
          }
          cleanupReceivedCall("User Declined");
        };

        if (cleanupCalled) {
          console.log(
            "Cleanup was triggered before overlay creation finished. Aborting."
          );
          return;
        }

        callOverlay = await createAndShowIncomingCallOverlay(
          callerInfo,
          callType,
          onAcceptCallback,
          onDeclineCallback,
          { stream: localPreviewStream }
        );

        if (cleanupCalled) {
          console.log(
            "Call was cancelled during overlay creation. Destroying now."
          );
          if (callOverlay && callOverlay.destroy) {
            callOverlay.destroy();
          }
          return;
        }
      });

      peer.on("error", (err) => {
        console.error("PeerJS Error:", err);
        let errorMessage = `Call Service Error: ${err.type || "Unknown"}`;
        let retryDelay = 10000;

        if (err.type === "unavailable-id") {
          errorMessage =
            "Call Service Error: ID unavailable. It might be in use or network issues prevent registration. Please wait and retry.";
          if (peer && !peer.destroyed) peer.destroy();
          peer = null;
          shouldRetry = true;
          retryDelay = 30000;
        } else if (
          err.type === "network" ||
          err.type === "socket-error" ||
          err.type === "disconnected"
        ) {
          errorMessage = `Call Service Error: ${err.type}.`;
          shouldRetry = true;
          retryDelay = 5000;
          if (peer && !peer.destroyed && peer.disconnected) {
            try {
              peer.reconnect();
              shouldRetry = false;
            } catch (e) {
              console.warn("Reconnect failed in error handler", e);
            }
          }
          if (shouldRetry && peer && !peer.destroyed) peer.destroy();
          if (shouldRetry) peer = null;
        } else if (err.type === "peer-unavailable") {
          errorMessage = `Call Error: The other person could not be reached.`;
          shouldRetry = false;
        } else if (err.type === "server-error") {
          errorMessage = "Call Service Error: Signaling server error.";
          shouldRetry = true;
          retryDelay = 15000;
          if (peer && !peer.destroyed) peer.destroy();
          peer = null;
        } else if (err.type === "webrtc") {
          errorMessage = "Call Service Error: WebRTC connection issue.";
          shouldRetry = true;
          retryDelay = 10000;
          if (peer && !peer.destroyed && peer.disconnected) {
            try {
              peer.reconnect();
              shouldRetry = false;
            } catch (e) {
              console.warn("Reconnect failed in webrtc error handler", e);
            }
          }
        } else {
          shouldRetry = true;
          if (peer && !peer.destroyed && peer.disconnected) {
            try {
              peer.reconnect();
              shouldRetry = false;
            } catch (e) {
              console.warn("Reconnect failed in generic error handler", e);
            }
          }
          if (shouldRetry && peer && !peer.destroyed) peer.destroy();
          if (shouldRetry) peer = null;
        }

        Notify.show("Pluto Contacts", errorMessage);

        if (shouldRetry) {
          console.log(
            `Attempting PeerJS setup retry in ${retryDelay}ms due to error: ${err.type}`
          );
          setTimeout(setupPeer, retryDelay);
        }
      });

      peer.on("disconnected", () => {
        console.warn("PeerJS: Disconnected from signaling server.");
        if (peer && !peer.destroyed && !onEndTriggered) {
          Notify.show("Pluto Contacts", "Call service disconnected.");
        }
      });

      peer.on("close", () => {
        console.log("PeerJS: Connection permanently closed.");
        callState = "standby";
        if (peer && !peer.destroyed) {
          console.warn("PeerJS closed unexpectedly. Scheduling setup retry.");
          peer = null;
          setTimeout(setupPeer, 10000);
        } else {
          peer = null;
        }
      });
    }

    const container = new Html("div").styleJs({
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      overflowX: "hidden",
      width: "100%",
      flexGrow: 1,
    });

    function Home() {
      if (!wrapper) {
        console.error("Home() called but wrapper is not defined.");
        return;
      }
      wrapper.clear();
      container.clear();
      container.appendTo(wrapper);
      wrapper.attr({ class: "win-content with-sidebar" });

      addFabIfNecessary();
      contactsList();
    }

    function addFabIfNecessary() {
      if (!wrapper || wrapper.qs('button[title="Add new contact"]')) {
        return;
      }
      new Html("button")
        .html(icons.add)
        .appendTo(wrapper)
        .styleJs({
          position: "fixed",
          bottom: "1.5rem",
          right: "1.5rem",
          width: "50px",
          height: "50px",
          borderRadius: "50%",
          padding: "0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
          zIndex: 10,
          border: "none",
          cursor: "pointer",
        })
        .attr({ title: "Add new contact" })
        .on("click", addContactWindow);
    }

    async function contactsList() {
      if (!container) {
        console.error("contactsList() called but container is not defined.");
        return;
      }
      container.clear();
      currentPage = "contacts";

      let pageInfo = new Html("div").appendTo(container).styleJs({
        padding: "15px 15px 0 15px",
        flexShrink: 0,
      });
      new Html("h1").appendTo(pageInfo).text("Contacts");
      new Html("p")
        .appendTo(pageInfo)
        .text("Your saved contacts. Click to call or remove.");

      let contactsDiv = new Html("div").appendTo(container).styleJs({
        display: "flex",
        flexDirection: "column",
        padding: "15px",
        gap: "15px",
        flexGrow: 1,
        overflowY: "auto",
      });

      addFabIfNecessary();

      try {
        const contacts = await getContacts();

        if (contacts.length === 0) {
          new Html("div")
            .text("No contacts yet. Add some using the '+' button!")
            .styleJs({
              marginTop: "20px",
              fontStyle: "italic",
              color: "grey",
              textAlign: "center",
              width: "100%",
            })
            .appendTo(contactsDiv);
        } else {
          contacts.forEach((contact) => {
            const contactDiv = new Html("div").appendTo(contactsDiv).styleJs({
              display: "flex",
              gap: "15px",
              width: "100%",
              padding: "10px",
              border: "1px solid var(--outline)",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              alignItems: "center",
              backgroundColor: "var(--surface-container-high)",
              boxSizing: "border-box",
            });

            let fullAvPath =
              contact.a && contact.a.startsWith("http")
                ? contact.a
                : "https://zeon.dev" + (contact.a || "/assets/default.png");
            new Html("img")
              .attr({
                src: fullAvPath,
                alt: `${contact.u}'s avatar`,
                loading: "lazy",
              })
              .appendTo(contactDiv)
              .styleJs({
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
                border: "1px solid var(--outline-variant)",
              });

            const contactInfo = new Html("div").appendTo(contactDiv).styleJs({
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              overflow: "hidden",
              minWidth: 0,
            });
            new Html("h3")
              .text(contact.u)
              .styleJs({
                margin: "0 0 5px 0",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontSize: "1.1em",
                color: "var(--on-surface)",
              })
              .appendTo(contactInfo);

            const bioHtml = contact.bio
              ? new Html("p").text(contact.bio).styleJs({
                  color: "var(--on-surface-variant)",
                  fontStyle: "normal",
                })
              : new Html("p").text("No bio available").styleJs({
                  color: "var(--on-surface-variant)",
                  opacity: 0.7,
                  fontStyle: "italic",
                });
            bioHtml
              .styleJs({
                margin: "0 0 8px 0",
                fontSize: "0.9em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              })
              .appendTo(contactInfo);

            const actions = new Html("div")
              .styleJs({
                display: "flex",
                gap: "8px",
                alignItems: "center",
                flexShrink: 0,
                marginLeft: "auto",
              })
              .appendTo(contactDiv);

            const commonButtonAction = (type, contact) => {
              if (!peer || peer.destroyed || !peer.open) {
                Notify.show(
                  "Pluto Contacts",
                  "Not connected to call service. Please wait or restart."
                );
                if (!peer || peer.destroyed) {
                  setupPeer();
                } else if (peer.disconnected) {
                  try {
                    peer.reconnect();
                  } catch (e) {
                    console.warn("Reconnect failed on call click", e);
                    setupPeer();
                  }
                }
                return;
              }
              if (callState !== "standby") {
                Notify.show(
                  "Pluto Contacts",
                  `Cannot call while ${callState}.`
                );
                return;
              }
              initiateCall(contact, type);
            };

            new Html("button")
              .html(icons.video)
              .appendTo(actions)
              .attr({ title: `Video call ${contact.u}` })
              .on("click", () => commonButtonAction("video", contact))
              .styleJs({
                padding: "8px",
                minWidth: "auto",
                aspectRatio: "1 / 1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              })
              .elm.classList.add("flex-list", "row", "gap");

            new Html("button")
              .html(icons.audio)
              .appendTo(actions)
              .attr({ title: `Audio call ${contact.u}` })
              .on("click", () => commonButtonAction("audio", contact))
              .styleJs({
                padding: "8px",
                minWidth: "auto",
                aspectRatio: "1 / 1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              })
              .elm.classList.add("flex-list", "row", "gap");

            new Html("button")
              .html(icons.remove)
              .appendTo(actions)
              .on("click", async (event) => {
                event.stopPropagation();
                if (await removeContact(contact.id)) {
                  Notify.show(
                    "Pluto Contacts",
                    `${contact.u} has been removed.`
                  );
                }
              })
              .styleJs({
                padding: "8px",
                background: "var(--error)",
                color: "var(--on-error)",
                minWidth: "auto",
                aspectRatio: "1 / 1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
              })
              .attr({ title: "Remove contact" })
              .elm.classList.add("flex-list", "row", "gap");
          });
        }
      } catch (error) {
        console.error("Error rendering contacts list:", error);
        contactsDiv.clear();
        new Html("div")
          .text("Error loading contacts. Please try again.")
          .styleJs({
            marginTop: "20px",
            color: "red",
            textAlign: "center",
            width: "100%",
          })
          .appendTo(contactsDiv);
      }
    }

    function addContactWindow() {
      let ACWindow = new Win({
        title: "Add a contact",
        content: "",
        pid: Root.PID,
        width: 480,
        height: 540,
      });
      windows.push(ACWindow);
      ACWindow.onclose = () => {
        windows = windows.filter((w) => w !== ACWindow);
      };

      let ACWindowWrapper = Html.from(
        ACWindow.window.querySelector(".win-content")
      ).styleJs({
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
      });

      let pageInfo = new Html("div").appendTo(ACWindowWrapper).styleJs({
        padding: "15px",
        flexShrink: 0,
        borderBottom: "1px solid var(--outline-variant)",
      });
      new Html("h1")
        .appendTo(pageInfo)
        .text("Add a contact")
        .styleJs({ margin: "0 0 5px 0" });
      new Html("p")
        .appendTo(pageInfo)
        .text("Search Zeon users and add them to your list.")
        .styleJs({
          margin: 0,
          fontSize: "0.9em",
          color: "var(--on-surface-variant)",
        });

      let searchContainer = new Html("div").appendTo(ACWindowWrapper).styleJs({
        padding: "15px",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      });
      let searchInput = new Html("input")
        .attr({ placeholder: "Search by username or ID...", type: "search" })
        .appendTo(searchContainer)
        .styleJs({ width: "100%", padding: "10px", boxSizing: "border-box" });

      let resultsDiv = new Html("div").appendTo(ACWindowWrapper).styleJs({
        display: "flex",
        flexDirection: "column",
        width: "100%",
        overflowY: "auto",
        flexGrow: 1,
        padding: "0 15px 15px 15px",
        gap: "10px",
      });
      const loadingIndicator = new Html("div")
        .text("Type to search...")
        .styleJs({
          marginTop: "10px",
          fontStyle: "italic",
          color: "grey",
          textAlign: "center",
          width: "100%",
        });
      resultsDiv.append(loadingIndicator);

      const displayResults = (results) => {
        resultsDiv.clear();
        if (!results || results.length === 0) {
          resultsDiv.append(
            new Html("div").text("No users found.").styleJs({
              marginTop: "10px",
              fontStyle: "italic",
              color: "grey",
              textAlign: "center",
              width: "100%",
            })
          );
          return;
        }
        results.forEach((resultItem) => {
          const contact = resultItem.item;
          const contactDiv = new Html("div").appendTo(resultsDiv).styleJs({
            display: "flex",
            gap: "10px",
            width: "100%",
            padding: "10px",
            border: "1px solid var(--outline)",
            borderRadius: "5px",
            alignItems: "center",
            backgroundColor: "var(--surface-container-low)",
            boxSizing: "border-box",
          });
          let fullAvPath =
            contact.a && contact.a.startsWith("http")
              ? contact.a
              : "https://zeon.dev" + (contact.a || "/assets/default.png");
          new Html("img")
            .attr({
              src: fullAvPath,
              alt: `${contact.u}'s avatar`,
              loading: "lazy",
            })
            .appendTo(contactDiv)
            .styleJs({
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
              border: "1px solid var(--outline-variant)",
            });

          const contactInfo = new Html("div").appendTo(contactDiv).styleJs({
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            minWidth: 0,
            overflow: "hidden",
          });
          new Html("h4")
            .text(contact.u)
            .styleJs({
              margin: "0 0 3px 0",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontSize: "1em",
              color: "var(--on-surface)",
            })
            .appendTo(contactInfo);
          const bioText = contact.bio || "No bio";
          new Html("p")
            .text(bioText)
            .styleJs({
              margin: 0,
              fontSize: "0.85em",
              color: contact.bio ? "var(--on-surface-variant)" : "#999",
              fontStyle: contact.bio ? "normal" : "italic",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            })
            .appendTo(contactInfo);

          const actions = new Html("div")
            .styleJs({ flexShrink: 0, marginLeft: "auto" })
            .appendTo(contactDiv);
          let addButton = new Html("button")
            .html(icons.add)
            .attr({ title: "Add contact" })
            .appendTo(actions)
            .styleJs({ padding: "5px", minWidth: "auto" })
            .classOn("flex-list", "row", "gap");
          addButton.on("click", async (event) => {
            event.stopPropagation();
            addButton.attr({ disabled: true }).html("...");
            if (await addContact(contact)) {
              addButton.html(icons.add);
            } else {
              addButton.attr({ disabled: null }).html(icons.add);
            }
          });
        });
      };

      const debouncedSearch = _.debounce(async () => {
        const query = searchInput.getValue().trim();
        resultsDiv.clear();
        if (query.length < 1) {
          resultsDiv.append(loadingIndicator.text("Type to search..."));
          return;
        }

        if (!fuse) {
          resultsDiv.append(
            new Html("div")
              .text("User index not ready. Please wait...")
              .styleJs({
                marginTop: "10px",
                color: "orange",
                textAlign: "center",
                width: "100%",
              })
          );
          await indexUsers();
          if (!fuse || !users || users.length === 0) {
            resultsDiv.clear().append(
              new Html("div").text("Failed to load user index.").styleJs({
                marginTop: "10px",
                color: "red",
                textAlign: "center",
                width: "100%",
              })
            );
            return;
          }
        }

        resultsDiv.append(loadingIndicator.text("Searching..."));

        try {
          const currentUsers = users || [];
          if (fuse && typeof fuse.getIndex === "function" && fuse.getIndex()) {
            if (fuse.getIndex().size() !== currentUsers.length) {
              console.log("Re-initializing Fuse index as user list changed.");
              fuse.setCollection(currentUsers);
            }
          } else if (fuse) {
            console.log("Re-initializing Fuse index.");
            fuse.setCollection(currentUsers);
          } else {
            throw new Error("Fuse index not available for search.");
          }

          const searchResults = fuse.search(query);
          displayResults(searchResults);
        } catch (searchError) {
          console.error("Fuse search error:", searchError);
          resultsDiv.clear().append(
            new Html("div").text("Error during search.").styleJs({
              marginTop: "10px",
              color: "red",
              textAlign: "center",
              width: "100%",
            })
          );
        }
      }, 300);

      searchInput.on("input", debouncedSearch);
    }

    function createCallWindowUI(wrapper, contact, callType) {
      wrapper.clear().styleJs({ padding: "0", overflow: "hidden" });
      const fullAvPath =
        contact.a && contact.a.startsWith("http")
          ? contact.a
          : "https://zeon.dev" + (contact.a || "/assets/default.png");
      const returnElements = {};

      if (callType === "video") {
        wrapper.html(`
          <style>
            .video-call-wrapper {
              width: 100%;
              height: 100%;
              position: relative;
              background-color: #000;
              overflow: hidden;
            }
            .remote-video {
              width: 100%;
              height: 100%;
              object-fit: cover;
              position: absolute;
              top: 0; left: 0;
            }
            .local-video {
              position: absolute;
              bottom: 20px;
              right: 20px;
              width: 25%;
              max-width: 200px;
              border-radius: 8px;
              border: 2px solid var(--outline);
              box-shadow: 0 4px 10px rgba(0,0,0,0.5);
              z-index: 10;
              transform: scaleX(-1); /* Mirror view */
            }
            .call-overlay {
              position: absolute;
              top: 0; left: 0; right: 0; bottom: 0;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              padding: 20px;
              background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 30%, transparent 70%);
              z-index: 5;
            }
            .call-info-top {
              text-align: left;
              text-shadow: 0 1px 4px rgba(0,0,0,0.7);
            }
            .call-name { font-size: 1.5em; font-weight: 500; color: #fff; margin:0; }
            .call-status, .call-timer { font-size: 1em; color: #eee; margin: 2px 0; }
            .call-controls {
              display: flex;
              justify-content: center;
              gap: 20px;
              width: 100%;
              padding-bottom: 20px;
            }
            .call-btn {
              width: 60px; height: 60px; border-radius: 50%; border: none;
              display: flex; align-items: center; justify-content: center;
              cursor: pointer; transition: transform 0.1s ease-out;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            }
            .call-btn:active { transform: scale(0.95); }
            .call-btn svg { width: 28px; height: 28px; }
            .mute-btn { background-color: rgba(255,255,255,0.2); color: #fff; }
            .end-btn { background-color: var(--error); color: var(--on-error); }
          </style>
          <div class="video-call-wrapper">
              <video class="remote-video" autoplay playsinline></video>
              <video class="local-video" autoplay muted playsinline></video>
              <div class="call-overlay">
                  <div class="call-info-top">
                      <h1 class="call-name">${contact.u}</h1>
                      <p class="call-status"></p>
                      <p class="call-timer"></p>
                  </div>
                  <div class="call-controls"></div>
              </div>
          </div>
        `);
        returnElements.remoteVideoElement = wrapper.qs(".remote-video");
        returnElements.localVideoElement = wrapper.qs(".local-video");
      } else {
        // Audio Call UI
        wrapper.html(`
            <style>
                .call-ui-wrapper {
                    height: 100%; display: flex; flex-direction: column; justify-content: space-between;
                    align-items: center; padding: 40px 20px; box-sizing: border-box;
                    position: relative; overflow: hidden; background-color: var(--surface);
                }
                .call-ui-wrapper::before {
                    content: ''; position: absolute; top: -20px; left: -20px; right: -20px; bottom: -20px;
                    background: url('${fullAvPath}') center center / cover;
                    filter: blur(100px) brightness(0.5); z-index: 1;
                }
                .call-info, .call-controls { position: relative; z-index: 2; text-shadow: 0 1px 4px rgba(0,0,0,0.7); }
                .call-info { display: flex; flex-direction: column; align-items: center; text-align: center; margin-top: 20px; }
                .call-avatar {
                    width: 120px; height: 120px; border-radius: 50%; object-fit: cover;
                    margin-bottom: 20px; border: 3px solid rgba(255, 255, 255, 0.6);
                    background-color: var(--surface-container-high); box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                }
                .call-name { font-size: 2.2em; font-weight: 500; margin: 0 0 5px 0; color: #fff; }
                .call-status, .call-timer { font-size: 1.1em; margin: 2px 0; color: #eee; opacity: 0.9; }
                .call-controls { display: flex; justify-content: center; gap: 30px; width: 100%; padding-bottom: 20px; }
                .call-btn {
                    width: 64px; height: 64px; border-radius: 50%; border: none;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; transition: transform 0.1s ease-out;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                }
                .call-btn:active { transform: scale(0.95); }
                .call-btn svg { width: 32px; height: 32px; }
                .mute-btn { background-color: rgba(255,255,255,0.2); color: #fff; }
                .end-btn { background-color: var(--error); color: var(--on-error); }
            </style>
            <div class="call-ui-wrapper">
                <div class="call-info">
                    <img class="call-avatar" src="${fullAvPath}" alt="Avatar">
                    <h1 class="call-name">${contact.u}</h1>
                    <p class="call-status"></p>
                    <p class="call-timer"></p>
                </div>
                <div class="call-controls"></div>
            </div>
        `);
      }

      returnElements.callStatusElement = wrapper.qs(".call-status");
      returnElements.timerDisplayElement = wrapper.qs(".call-timer");
      returnElements.buttonContainerElement = wrapper.qs(".call-controls");
      return returnElements;
    }

    async function initiateCall(contact, callType, pid = -1) {
      const { u: name, id, a: avatar } = contact;
      console.log(`Initiating ${callType} call to ${name} (ID: ${id})`);

      if (name == userData.username) {
        Notify.show("Pluto Contacts", "You can't call yourself.");
        return;
      }

      if (!peer || peer.destroyed || (!peer.open && !peer.disconnected)) {
        Notify.show(
          "Pluto Contacts",
          "Call service not ready. Please wait or restart."
        );
        if (!peer || peer.destroyed) setupPeer();
        else if (peer.disconnected)
          try {
            peer.reconnect();
          } catch (e) {
            setupPeer();
          }
        if (pid > -1) {
          try {
            Root.Core.processList[pid]?.proc.send({
              type: "function",
              content: "Call failed: Call service not ready.",
            });
          } catch (e) {}
        }
        return;
      }
      if (peer.disconnected) {
        Notify.show(
          "Pluto Contacts",
          "Call service disconnected, trying to reconnect before calling..."
        );
        try {
          peer.reconnect();
        } catch (e) {
          setupPeer();
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (peer.disconnected) {
          Notify.show("Pluto Contacts", "Reconnect failed. Cannot place call.");
          if (pid > -1) {
            try {
              Root.Core.processList[pid]?.proc.send({
                type: "function",
                content: "Call failed: Reconnect failed.",
              });
            } catch (e) {}
          }
          return;
        }
      }

      if (callState !== "standby") {
        Notify.show("Pluto Contacts", `Cannot call while ${callState}.`);
        if (pid > -1) {
          try {
            Root.Core.processList[pid]?.proc.send({
              type: "function",
              content: `Call failed: Busy (${callState}).`,
            });
          } catch (e) {}
        }
        return;
      }

      callState = "dialing";

      let localStream = null;
      let CSWindow = null;
      let conn = null;
      let call = null;
      let cleanupCalled = false;
      let timeoutInt = null;
      let elapsedInt = null;
      let uiElements = {};
      let audioPlayerElement = null;
      let isMuted = false;
      let isCameraOff = false;

      const peerID = `${name}-${String(id)}`;

      const cleanupCall = (reason) => {
        if (cleanupCalled) return;
        cleanupCalled = true;
        console.log(
          `Cleaning up initiated call (${reason}). Current state: ${callState}`
        );

        const shouldSendCancel = callState === "dialing" && conn && conn.open;
        if (shouldSendCancel) {
          try {
            conn.send("cancel");
          } catch (e) {
            console.warn("Failed to send cancel signal:", e);
          }
        }

        callState = "standby";

        clearInterval(timeoutInt);
        clearInterval(elapsedInt);
        if (onDecline) document.removeEventListener("call-decline", onDecline);

        if (localStream) {
          localStream.getTracks().forEach((track) => track.stop());
          localStream = null;
        }
        if (call) {
          call.close();
          call = null;
        }

        const closeConnection = () => {
          if (conn) {
            try {
              conn.close();
            } catch (e) {}
            conn = null;
          }
        };

        if (shouldSendCancel) {
          setTimeout(closeConnection, 200);
        } else {
          closeConnection();
        }

        if (CSWindow && !CSWindow.closed) {
          CSWindow.close();
          CSWindow = null;
        }
        windows = windows.filter((w) => w !== CSWindow);

        if (audioPlayerElement) {
          audioPlayerElement.cleanup();
          audioPlayerElement = null;
        }
        if (globalCall === call) globalCall = null;

        if (pid > -1) {
          let feedbackMsg = `Call ended (${reason}).`;
          if (Root.Core.processList[pid]?.proc) {
            try {
              Root.Core.processList[pid].proc.send({
                type: "function",
                content: feedbackMsg,
              });
            } catch (e) {}
          }
        }
        console.log("Caller: Call cleanup finished.");
      };

      try {
        const prefs = await loadCallPreferences();
        const mediaConstraints = {
          audio: prefs.audioDeviceId
            ? { deviceId: { exact: prefs.audioDeviceId } }
            : true,
          video:
            callType === "video"
              ? prefs.videoDeviceId
                ? { deviceId: { exact: prefs.videoDeviceId } }
                : true
              : false,
        };
        localStream = await navigator.mediaDevices.getUserMedia(
          mediaConstraints
        );

        CSWindow = new Win({
          title: `Calling ${name}`,
          content: "",
          pid: Root.PID,
          width: callType === "video" ? 854 : 360,
          height: callType === "video" ? 480 : 550,
          onclose: () => {
            cleanupCall("Window Closed");
          },
        });
        windows.push(CSWindow);
        let CSWindowWrapper = Html.from(
          CSWindow.window.querySelector(".win-content")
        );

        uiElements = createCallWindowUI(CSWindowWrapper, contact, callType);
        uiElements.callStatusElement.text("Dialing...");
        if (callType === "video" && uiElements.localVideoElement?.elm) {
          uiElements.localVideoElement.elm.srcObject = localStream;
        }

        const cancelButton = new Html("button")
          .attr({ title: "Cancel Call", class: "call-btn end-btn" })
          .appendTo(uiElements.buttonContainerElement);
        cancelButton.elm.innerHTML = icons.cancel;
        cancelButton.on("click", () => {
          cleanupCall("User Canceled");
          if (onDecline)
            document.removeEventListener("call-decline", onDecline);
        });

        timeoutSeconds = 60;
        timeoutInt = setInterval(() => {
          if (callState !== "dialing" || cleanupCalled) {
            clearInterval(timeoutInt);
            return;
          }
          timeoutSeconds--;
          if (uiElements.callStatusElement)
            uiElements.callStatusElement.text(
              `Ringing... (${timeoutSeconds}s)`
            );
          if (timeoutSeconds <= 0) {
            Notify.show("Pluto Contacts", `${name} did not answer.`);
            cleanupCall("Timeout");
          }
        }, 1000);

        conn = peer.connect(peerID, { reliable: true });

        onDecline = () => {
          if (cleanupCalled) return;
          clearInterval(timeoutInt);
          Notify.show("Pluto Contacts", name + " declined your call");
          cleanupCall("Declined");
          document.removeEventListener("call-decline", onDecline);
        };
        document.addEventListener("call-decline", onDecline);

        conn.on("open", () => {
          if (callState !== "dialing" || cleanupCalled) {
            cleanupCall("Aborted Pre-Media");
            return;
          }

          if (uiElements.callStatusElement)
            uiElements.callStatusElement.text("Ringing...");

          call = peer.call(peerID, localStream, {
            metadata: { type: callType },
          });
          globalCall = call;

          if (!call) {
            Notify.show(
              "Pluto Contacts",
              `Failed to initiate call to ${name}.`
            );
            cleanupCall("Media Initiation Failed");
            return;
          }

          call.on("stream", (remoteStream) => {
            currentCall = call;
            if (callState === "standby" || cleanupCalled) return;
            if (onDecline)
              document.removeEventListener("call-decline", onDecline);

            callState = "in call";
            clearInterval(timeoutInt);
            if (uiElements.callStatusElement)
              uiElements.callStatusElement.text("Connected");

            if (uiElements.buttonContainerElement) {
              uiElements.buttonContainerElement.clear();

              const muteButton = new Html("button")
                .attr({ title: "Mute/Unmute", class: "call-btn mute-btn" })
                .appendTo(uiElements.buttonContainerElement);
              muteButton.elm.innerHTML = icons.mic;
              muteButton.on("click", () => {
                isMuted = !isMuted;
                if (localStream) {
                  localStream.getAudioTracks().forEach((t) => {
                    t.enabled = !isMuted;
                  });
                }
                muteButton.elm.innerHTML = isMuted ? icons.micOff : icons.mic;
              });

              if (callType === "video") {
                const videoButton = new Html("button")
                  .attr({
                    title: "Turn Camera On/Off",
                    class: "call-btn mute-btn",
                  })
                  .appendTo(uiElements.buttonContainerElement);
                videoButton.elm.innerHTML = icons.video;
                videoButton.on("click", () => {
                  isCameraOff = !isCameraOff;
                  if (localStream) {
                    localStream.getVideoTracks().forEach((t) => {
                      t.enabled = !isCameraOff;
                    });
                  }
                  videoButton.elm.innerHTML = isCameraOff
                    ? icons.videoOff
                    : icons.video;
                });
              }

              const endCallButton = new Html("button")
                .attr({ title: "End Call", class: "call-btn end-btn" })
                .appendTo(uiElements.buttonContainerElement);
              endCallButton.elm.innerHTML = icons.cancel;
              endCallButton.on("click", () => cleanupCall("User Ended"));
            }

            if (callType === "video") {
              if (uiElements.remoteVideoElement?.elm) {
                uiElements.remoteVideoElement.elm.srcObject = remoteStream;
                uiElements.remoteVideoElement.elm.play();
              }
            } else {
              audioPlayerElement = new Html("audio")
                .attr({ autoplay: true, controls: false })
                .styleJs({ display: "none" });
              try {
                audioPlayerElement.elm.srcObject = remoteStream;
                audioPlayerElement.appendTo(CSWindowWrapper);
                audioPlayerElement.elm
                  .play()
                  .catch((e) => console.warn("Audio play failed:", e));
              } catch (e) {
                Notify.show("Pluto Contacts", "Error playing remote audio.");
                cleanupCall("Audio Playback Error");
                return;
              }
            }

            let startTime = Date.now();
            elapsedInt = setInterval(() => {
              if (callState !== "in call" || cleanupCalled) {
                clearInterval(elapsedInt);
                return;
              }
              let elapsed = Math.floor((Date.now() - startTime) / 1000);
              let mins = Math.floor(elapsed / 60)
                .toString()
                .padStart(2, "0");
              let secs = (elapsed % 60).toString().padStart(2, "0");
              if (uiElements.timerDisplayElement)
                uiElements.timerDisplayElement.text(`${mins}:${secs} elapsed`);
            }, 1000);
          });

          call.on("close", () => {
            if (onDecline)
              document.removeEventListener("call-decline", onDecline);
            if (!cleanupCalled) {
              Notify.show("Pluto Contacts", `Call with ${name} ended.`);
              cleanupCall("Remote Closed");
            }
          });

          call.on("error", (err) => {
            if (!cleanupCalled) {
              Notify.show(
                "Pluto Contacts",
                `Media call error: ${err.message || err.type || "Unknown"}`
              );
              cleanupCall("Media Error");
            }
          });
        });

        conn.on("data", (data) => {
          if (callState === "standby" || cleanupCalled) return;
          if (data === "decline") cleanupCall("Declined");
          else if (data === "busy") {
            Notify.show("Pluto Contacts", `${name} is busy.`);
            cleanupCall("Busy");
          } else if (data === "recvRequest") {
            if (callState === "dialing" && uiElements.callStatusElement)
              uiElements.callStatusElement.text("Ringing...");
            timeoutSeconds = 30;
          }
        });

        conn.on("close", () => {
          if (!cleanupCalled) {
            if (callState === "dialing" || callState === "connecting") {
              Notify.show(
                "Pluto Contacts",
                `Connection lost while trying to reach ${name}.`
              );
              cleanupCall("Data Closed During Dial");
            }
          }
        });

        conn.on("error", (err) => {
          if (!cleanupCalled) {
            Notify.show(
              "Pluto Contacts",
              `Connection error with ${name}: ${err.type || "Unknown"}`
            );
            cleanupCall("Data Error");
          }
        });
      } catch (err) {
        console.error("Caller: Error initiating call:", err);
        let reason = "Initiation Failed";
        let message = `Failed to start call: ${err.message || "Unknown error"}`;
        let persist = false;
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          message =
            "Camera/Microphone access denied. Please allow permissions.";
          reason = "Permission Denied";
          persist = true;
        } else if (
          err.name === "NotFoundError" ||
          err.name === "DevicesNotFoundError"
        ) {
          message = "No camera/microphone found. Please connect a device.";
          reason = "No Device";
          persist = true;
        } else if (
          err.name === "NotReadableError" ||
          err.name === "TrackStartError"
        ) {
          message = "Your camera/microphone is busy or cannot be read.";
          reason = "Device Busy";
          persist = true;
        } else {
          reason = "getUserMedia Failed";
        }
        Notify.show("Pluto Contacts", message, null, [], persist);
        cleanupCall(reason);
      }
    }

    async function initializeApp() {
      try {
        await indexUsers();
        setupPeer();
        Home();
        setupMessageListener();
      } catch (initError) {
        console.error("Pluto Contacts: Initialization failed:", initError);
        if (wrapper) {
          wrapper
            .clear()
            .html(
              '<div style="padding: 20px; text-align: center; color: red;">Failed to initialize Pluto Contacts. Please check console and try reloading.</div>'
            );
        }
        Notify.show(
          "Pluto Contacts",
          "Initialization failed. App may not function correctly.",
          null,
          [],
          true
        );
        setupMessageListener();
      }
    }

    function setupMessageListener() {
      Root.Lib.setupReturns(async (m) => {
        console.log("Pluto Contacts received message: ", m);
        if (!m || !m.type || !m.pid || !Root.Core.processList[m.pid]?.proc) {
          console.warn("Ignoring invalid or incomplete message:", m);
          return;
        }

        const callingProc = Root.Core.processList[m.pid].proc;
        const sendReply = (content) => {
          if (Root.Core.processList[m.pid]?.proc) {
            try {
              Root.Core.processList[m.pid].proc.send({
                type: "function",
                content: content,
              });
            } catch (e) {
              console.error("Failed to send reply to PID", m.pid, ":", e);
            }
          } else {
            console.warn(
              "Calling process PID",
              m.pid,
              "disappeared before sending reply."
            );
          }
        };
        const sendUpdate = (content, title = "Pluto Contacts") => {
          if (Root.Core.processList[m.pid]?.proc) {
            try {
              Root.Core.processList[m.pid].proc.send({
                type: "update",
                title: title,
                content: content,
              });
            } catch (e) {
              console.error("Failed to send update to PID", m.pid, ":", e);
            }
          } else {
            console.warn(
              "Calling process PID",
              m.pid,
              "disappeared before sending update."
            );
          }
        };

        try {
          switch (m.type) {
            case "plutoContactsSearch":
              if (!m.arguments || typeof m.arguments.query !== "string") {
                sendReply({ error: "Search query (string) is required." });
                return;
              }
              sendUpdate(`Searching contacts for "${m.arguments.query}"...`);

              if (!fuse) {
                await indexUsers();
                if (!fuse) {
                  sendReply({
                    error: "Contact search index not ready or failed to load.",
                  });
                  return;
                }
              }

              let localContacts = await getContacts();
              let localFuse = new Fuse(localContacts, {
                keys: ["u"],
                threshold: 0.3,
                includeScore: true,
              });
              let localResults = localFuse
                .search(m.arguments.query)
                .map((r) => r.item);

              console.log("Local search results for Helper:", localResults);
              if (localResults.length > 0) {
                sendReply({ results: localResults });
              } else {
                sendReply({
                  results: [],
                  message: "No matching contacts found in your local list.",
                });
              }
              break;

            case "plutoContactsCall":
              const contactNameArg = m.arguments?.name;
              const contactIdArg = m.arguments?.id;

              if (
                typeof contactNameArg !== "string" ||
                contactNameArg.trim() === "" ||
                contactIdArg === null ||
                contactIdArg === undefined ||
                String(contactIdArg).trim() === ""
              ) {
                sendReply(
                  "Call failed: Valid contact name (string) and id (string/number) are required."
                );
                return;
              }
              if (!userData.onlineAccount) {
                sendReply("Call failed: User is not logged in.");
                return;
              }
              if (
                !peer ||
                peer.destroyed ||
                (!peer.open && !peer.disconnected)
              ) {
                sendReply(
                  "Call failed: Not connected to call service. Please wait or restart Contacts."
                );
                if (!peer || peer.destroyed) setupPeer();
                else if (peer.disconnected)
                  try {
                    peer.reconnect();
                  } catch (e) {
                    setupPeer();
                  }
                return;
              }
              if (peer.disconnected) {
                sendReply(
                  "Call failed: Call service is disconnected. Trying to reconnect..."
                );
                try {
                  peer.reconnect();
                } catch (e) {
                  setupPeer();
                }
                return;
              }
              if (callState !== "standby") {
                sendReply(`Call failed: Already busy (${callState}).`);
                return;
              }

              const contactNameToCall = contactNameArg.trim();
              const contactIdToCall = contactIdArg;

              const allContacts = await getContacts();
              let contactToCall = allContacts.find(
                (c) => String(c.id) === String(contactIdToCall)
              );

              if (!contactToCall) {
                contactToCall = users.find(
                  (u) => String(u.id) === String(contactIdToCall)
                );
              }

              if (!contactToCall) {
                sendReply(
                  `Call failed: Contact with name "${contactNameToCall}" and ID "${contactIdToCall}" not found.`
                );
                return;
              }

              sendUpdate(`Initiating audio call with ${contactNameToCall}...`);
              initiateCall(contactToCall, "audio", m.pid);
              break;

            default:
              console.log("Received unhandled message type:", m.type);
              sendReply({ error: `Unknown command type: ${m.type}` });
          }
        } catch (error) {
          console.error(`Error handling message type ${m.type}:`, error);
          sendReply({
            error: `Internal error processing command: ${
              error.message || "Unknown error"
            }`,
          });
        }
      });
    }

    initializeApp();
  },
};
