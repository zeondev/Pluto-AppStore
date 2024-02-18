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
    let wrapper; // Lib.html | undefined
    let PCWindow;

    const Html = (await import("https://unpkg.com/@datkat21/html")).default;
    const Sidebar = await Root.Lib.loadComponent("Sidebar");
    const CtxMenu = await Root.Lib.loadLibrary("CtxMenu");
    const Notify = await Root.Lib.loadLibrary("Notify");

    console.log("Loading VirtualFS...");
    const vfs = await Root.Lib.loadLibrary("VirtualFS");
    await vfs.importFS();

    console.log("Hello from example package", Root.Lib);

    Root.Lib.setOnEnd((_) => {
      windows.forEach((window) => {
        window.close();
      });
      peer.destroy();
    });

    const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;

    // Create a window
    PCWindow = new Win({
      title: "Pluto Contacts",
      content: "Loading...",
      pid: Root.PID,
      width: 854,
      height: 480,
      onclose: () => {
        Root.Lib.onEnd();
      },
    });

    let windows = [];
    windows.push(PCWindow);

    wrapper = Html.from(PCWindow.window.querySelector(".win-content"));

    async function loadScript(url) {
      // script probably already exists
      if (Html.qs('script[src="' + url + '"]')) {
        return false;
      }

      // make new script
      new Html("script").html(await (await fetch(url)).text()).appendTo("body");
      return true;
    }

    await loadScript("https://cdn.jsdelivr.net/npm/fuse.js/dist/fuse.js");
    await loadScript("https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js");
    await loadScript(
      "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"
    );

    const icons = {
      contacts:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-user"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><circle cx="12" cy="8" r="2"/><path d="M15 13a3 3 0 1 0-6 0"/></svg>',
      tags: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tags"><path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42L9 5Z"/><path d="M6 9.01V9"/><path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19"/></svg>',
      video:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-video"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>',
      audio:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone-call"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/><path d="M14.05 2a9 9 0 0 1 8 7.94"/><path d="M14.05 6A5 5 0 0 1 18 10"/></svg>',
      add: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
    };

    async function helperIntegrate(pid) {
      const helperInfPath = "Registry/helperInfo";
      let integrationPayload = {
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
                query: {
                  type: "string",
                  description: "Search query prompted",
                },
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
      Root.Core.processList[pid].proc.send({
        type: "integration",
        content: integrationPayload,
      });
    }

    let integrationListener = setInterval(async () => {
      const helperInfPath = "Registry/helperInfo";
      const helperInfExists = await vfs.exists(helperInfPath);

      if (helperInfExists) {
        let helperInfo = JSON.parse(await vfs.readFile(helperInfPath));
        if (helperInfo.open) {
          console.log("Helper Process ID:" + helperInfo.pid);
          clearInterval(integrationListener);
          helperIntegrate(helperInfo.pid);
        }
      }
    }, 1000);

    let users = [];
    let callState = "standby";

    // Reset Contacts data
    // await vfs.writeFile("Registry/contactsList", JSON.stringify(users));

    async function getContacts() {
      let contactsListPath = "Registry/contactsList";
      let contactsListExists = await vfs.exists(contactsListPath);

      if (contactsListExists) {
        let contacts = JSON.parse(await vfs.readFile(contactsListPath));
        return contacts;
      } else {
        return [];
      }
    }

    async function addContact(obj) {
      let contactsListPath = "Registry/contactsList";
      let contactsRaw = await getContacts();
      let contacts = [...contactsRaw];

      let error = false;

      contacts.forEach((contact) => {
        if (_.isEqual(obj, contact)) {
          Notify.show("Pluto Contacts", `${obj.u} is already in your contacts`);
          error = true;
        }
      });

      if (error) {
        return;
      }

      contacts.push(obj);

      await vfs.writeFile(contactsListPath, JSON.stringify(contacts));
      contactsList();
    }

    async function indexUsers() {
      let result = await fetch("https://zeon.dev/api/public/searchUsers", {
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ user: "" }),
        method: "POST",
      });
      users = await result.json();
      return users;
    }

    await indexUsers();
    const fuse = new Fuse(users, {
      keys: ["u", "id"],
    });

    let service = Root.Core.services.find((x) => x.name === "Account");
    let userData = {};
    let peer;
    let curConn;

    if (service && service.ref) {
      userData = service.ref.getUserData();
    }

    if (userData.onlineAccount) {
      peer = new Peer(userData.username + "-" + userData.id);
      peer.on("open", (id) => {
        console.log(peer);
        Notify.show(
          "Pluto Contacts",
          "Receiving calls as " + userData.username
        );
      });
      peer.on("connection", (conn) => {
        curConn = conn;
      });
      peer.on("call", (call) => {
        if (callState != "standby") {
          curConn.send("decline");
          return;
        }
        callState = "receiving a call";
        let callInt = setInterval(() => {
          curConn.send("recvRequest");
        });
        Notify.show(
          "Pluto Contacts",
          call.peer.split("-")[0] + " is calling...",
          null,
          [
            {
              text: "Accept",
              type: "primary",
              callback: () => {
                navigator.getUserMedia =
                  navigator.getUserMedia ||
                  navigator.webkitGetUserMedia ||
                  navigator.mozGetUserMedia ||
                  navigator.msGetUserMedia;

                navigator.getUserMedia(
                  { video: false, audio: true },

                  function success(localAudioStream) {
                    let CSWindow = new Win({
                      title:
                        "Pluto Contacts - Audio call with " +
                        call.peer.split("-")[0],
                      content: "",
                      pid: Root.PID,
                      width: 480,
                      height: 540,
                    });
                    let CSWindowWrapper = Html.from(
                      CSWindow.window.querySelector(".win-content")
                    );
                    CSWindowWrapper.styleJs({
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      onclose: () => {
                        localAudioStream
                          .getTracks()
                          .forEach((track) => track.stop());
                        callState = "standby";
                        call.close();
                      },
                    });
                    new Html("h1")
                      .text(call.peer.split("-")[0])
                      .appendTo(CSWindowWrapper);
                    let callStatus = new Html("p")
                      .text("Connecting...")
                      .appendTo(CSWindowWrapper);
                    windows.push(CSWindow);
                    callState = "connecting";
                    clearInterval(callInt);
                    call.answer(localAudioStream);
                    call.on("close", () => {
                      localAudioStream
                        .getTracks()
                        .forEach((track) => track.stop());
                      callState = "standby";
                      CSWindow.close();
                    });
                    call.on("stream", (stream) => {
                      callState = "in call";
                      let audioStream = new Html("audio").styleJs({
                        display: "none",
                      });
                      audioStream.elm.srcObject = stream;
                      audioStream.appendTo(CSWindowWrapper);
                      audioStream.elm.play();
                      new Html("br").appendTo(CSWindowWrapper);
                      new Html("button")
                        .text("End call")
                        .appendTo(CSWindowWrapper)
                        .on("click", () => {
                          call.close();
                        });
                      let startTime = new Date();
                      let intElapsed = setInterval(function () {
                        let endTime = new Date();
                        let timeDiff = endTime - startTime;
                        var days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                        var hours = Math.floor(
                          (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
                        );
                        var minutes = Math.floor(
                          (timeDiff % (1000 * 60 * 60)) / (1000 * 60)
                        );
                        var seconds = Math.floor(
                          (timeDiff % (1000 * 60)) / 1000
                        );
                        callStatus.text(
                          hours.toLocaleString("en-US", {
                            minimumIntegerDigits: 2,
                            useGrouping: false,
                          }) +
                            ":" +
                            minutes.toLocaleString("en-US", {
                              minimumIntegerDigits: 2,
                              useGrouping: false,
                            }) +
                            ":" +
                            seconds.toLocaleString("en-US", {
                              minimumIntegerDigits: 2,
                              useGrouping: false,
                            }) +
                            " elapsed"
                        );
                      }, 1000);
                    });
                  },
                  // Failure callback
                  function error(err) {
                    Notify.show(
                      "Pluto Contacts",
                      "An error occurred trying to initate an audio call: " +
                        err.message
                    );
                    callState = "standby";
                    clearInterval(callInt);
                    curConn.send("decline");
                  }
                );
              },
            },
            {
              text: "Decline",
              type: "negative",
              callback: () => {
                callState = "standby";
                clearInterval(callInt);
                curConn.send("decline");
              },
            },
          ],
          false,
          "https://cdn.discordapp.com/attachments/950289355321266186/1201085652444393502/Ringtone.wav"
        );
      });
    } else {
      Notify.show(
        "Pluto Contacts",
        "To receive calls, please sign in with a Zeon account in Settings."
      );
    }

    wrapper.clear();

    async function queryUsers(name) {
      let foundUsers = [];
      fuse.search(name).forEach((found) => {
        foundUsers.push(found.item);
      });
      return foundUsers;
    }

    async function queryContacts(name) {
      let contactsFuse = new Fuse(await getContacts(), {
        keys: ["u", "id"],
      });
      let foundContacts = [];
      contactsFuse.search(name).forEach((found) => {
        foundContacts.push(found.item);
      });
      return foundContacts;
    }

    let container = new Html("div").styleJs({
      display: "flex",
      flexDirection: "column",
      overflow: "scroll",
      width: "100%",
      height: "100%",
    });

    let currentPage = "contacts";

    let sidebarWrapper = new Root.Lib.html("div")
      .styleJs({ display: "flex" })
      .appendTo(wrapper.elm);

    function makeSidebar() {
      sidebarWrapper.clear();
      Sidebar.new(sidebarWrapper.elm, [
        {
          onclick: contactsList,
          html: icons.contacts,
          title: "Contacts",
        },
        {
          onclick: tagsList,
          html: icons.tags,
          title: "Tags",
        },
      ]);
    }

    function Home() {
      container.appendTo(wrapper);
      wrapper.elm.classList.add("row", "h-100", "with-sidebar");
      // makeSidebar();
      contactsList();
    }

    function tagsList() {
      container.clear();
      currentPage = "tags";
      let pageInfo = new Html("div")
        .appendTo(container)
        .styleJs({ padding: "15px" });
      let pageTitle = new Html("h1").appendTo(pageInfo).text("Tags");
      let pageDesc = new Html("p")
        .appendTo(pageInfo)
        .text("Sort your contacts with tags.");
    }

    async function contactsList() {
      container.clear();
      currentPage = "contacts";
      let pageInfo = new Html("div")
        .appendTo(container)
        .styleJs({ padding: "15px" });
      let pageTitle = new Html("h1").appendTo(pageInfo).text("Contacts");
      let pageDesc = new Html("p")
        .appendTo(pageInfo)
        .text("This is where your contacts are stored.");
      let contacts = await getContacts();
      let contactsDiv = new Html("div").appendTo(container).styleJs({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      });
      new Html("button")
        .html(icons.add)
        .appendTo(container)
        .styleJs({
          position: "absolute",
          bottom: "2rem",
          right: "2rem",
          paddingTop: "13px",
          paddingBottom: "13px",
        })
        .on("click", () => {
          addContactWindow();
        });
      contacts.forEach((contact) => {
        console.log(contact);
        let contactDiv = new Html("div").appendTo(contactsDiv).styleJs({
          display: "flex",
          gap: "10px",
          width: "95%",
          justifyContent: "center",
        });
        let fullAvPath = "https://zeon.dev" + contact.a;
        let avatar = new Html("img")
          .attr({ src: fullAvPath })
          .appendTo(contactDiv)
          .styleJs({ width: "100px", height: "100px", borderRadius: "50px" });
        let contactInfo = new Html("div").appendTo(contactDiv).styleJs({
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
        });
        new Html("h1").text(contact.u).appendTo(contactInfo);
        let actions = new Html("div")
          .styleJs({ display: "flex" })
          .appendTo(contactInfo);
        new Html("button")
          .html(icons.audio)
          .append(new Html("span").text("Audio call"))
          .appendTo(actions)
          .on("click", () => {
            audioCall(contact.u, contact.id);
          })
          .styleJs({
            padding: "8px",
            paddingLeft: "10px",
            paddingRight: "10px",
          })
          .elm.classList.add("flex-list", "row", "gap");
        new Html("button")
          .html(icons.video)
          .append(new Html("span").text("Video call"))
          .appendTo(actions)
          .styleJs({
            padding: "8px",
            paddingLeft: "10px",
            paddingRight: "10px",
          })
          .elm.classList.add("flex-list", "row", "gap");
        new Html("br").appendTo(contactsDiv);
      });
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

      let ACWindowWrapper = Html.from(
        ACWindow.window.querySelector(".win-content")
      );
      let pageInfo = new Html("div")
        .appendTo(ACWindowWrapper)
        .styleJs({ padding: "15px" });
      let pageTitle = new Html("h1").appendTo(pageInfo).text("Add a contact");
      let pageDesc = new Html("p")
        .appendTo(pageInfo)
        .text("Add a Zeon profile as a contact in your contacts list.");
      let container = new Html("div").appendTo(ACWindowWrapper).styleJs({
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      });
      let searchInput = new Html("input")
        .attr({ placeholder: "Start typing to search" })
        .appendTo(container)
        .styleJs({ width: "90%" })
        .on("keyup", async () => {
          let contacts = await queryUsers(searchInput.getValue());
          console.log(contacts);
          contactsDiv.clear();
          contacts.forEach((contact) => {
            console.log(contact);
            let contactDiv = new Html("div").appendTo(contactsDiv).styleJs({
              display: "flex",
              gap: "10px",
              width: "95%",
              justifyContent: "center",
            });
            let fullAvPath = "https://zeon.dev" + contact.a;
            let avatar = new Html("img")
              .attr({ src: fullAvPath })
              .appendTo(contactDiv)
              .styleJs({
                width: "100px",
                height: "100px",
                borderRadius: "50px",
              });
            let contactInfo = new Html("div").appendTo(contactDiv).styleJs({
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              width: "100%",
            });
            new Html("h1").text(contact.u).appendTo(contactInfo);
            if ("bio" in contact) {
              new Html("p").text(contact.bio).appendTo(contactInfo);
            } else {
              new Html("p").text("No bio added").appendTo(contactInfo);
            }
            new Html("br").appendTo(contactInfo);
            let actions = new Html("div")
              .styleJs({ display: "flex" })
              .appendTo(contactInfo);
            new Html("button")
              .html(icons.add)
              .append(new Html("span").text("Add contact"))
              .on("click", () => {
                addContact(contact);
              })
              .appendTo(actions)
              .styleJs({
                width: "100%",
              })
              .elm.classList.add("flex-list", "row", "gap");
            new Html("br").appendTo(contactsDiv);
          });
        });
      new Html("br").appendTo(container);
      new Html("br").appendTo(container);
      let contactsDiv = new Html("div").appendTo(container).styleJs({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "90%",
      });
    }

    function audioCall(name, id, pid = -1) {
      if (callState != "standby") {
        return;
      }
      navigator.getUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;

      navigator.getUserMedia(
        { video: false, audio: true },

        function success(localAudioStream) {
          let peerID = name + "-" + id;
          let conn = peer.connect(peerID);
          let CSWindow = new Win({
            title: "Pluto Contacts - Audio call with " + name,
            content: "",
            pid: Root.PID,
            width: 480,
            height: 540,
            onclose: () => {
              callState = "standby";
              conn.close();
            },
          });
          let CSWindowWrapper = Html.from(
            CSWindow.window.querySelector(".win-content")
          );
          CSWindowWrapper.styleJs({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          });
          new Html("h1").text(name).appendTo(CSWindowWrapper);
          let callStatus = new Html("p")
            .text("Dialing...")
            .appendTo(CSWindowWrapper);
          callState = "dialing";
          windows.push(CSWindow);
          let timeoutSeconds = 2;
          let callInt = setInterval(() => {
            timeoutSeconds = timeoutSeconds - 1;
            console.log(timeoutSeconds);
            if (timeoutSeconds < 1) {
              callState = "standby";
              clearInterval(callInt);
              Notify.show("Pluto Contacts", name + " is currently unreachable");
              callStatus.text("Person unreachable");
              if (pid > -1) {
                Root.Core.processList[pid].proc.send({
                  type: "function",
                  content: "Person cannot be reached",
                });
              }
              setTimeout(() => {
                CSWindow.close();
              }, 1000);
              localAudioStream.getTracks().forEach((track) => track.stop());
              call.close();
            }
          }, 1000);
          conn.on("open", () => {
            let call = peer.call(peerID, localAudioStream);
            call.on("close", () => {
              if (callState == "dialing") {
                clearInterval(callInt);
              }
              localAudioStream.getTracks().forEach((track) => track.stop());
              callState = "standby";
              CSWindow.close();
            });
            call.on("stream", (stream) => {
              callState = "in call";
              clearInterval(callInt);
              if (pid > -1) {
                Root.Core.processList[pid].proc.send({
                  type: "function",
                  content: "Person accepted the call",
                });
              }
              new Html("br").appendTo(CSWindowWrapper);
              new Html("button")
                .text("End call")
                .appendTo(CSWindowWrapper)
                .on("click", () => {
                  call.close();
                });
              let audioStream = new Html("audio").styleJs({ display: "none" });
              audioStream.elm.srcObject = stream;
              audioStream.appendTo(CSWindowWrapper);
              audioStream.elm.play();
              let startTime = new Date();
              let intElapsed = setInterval(function () {
                let endTime = new Date();
                let timeDiff = endTime - startTime;
                var days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                var hours = Math.floor(
                  (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
                );
                var minutes = Math.floor(
                  (timeDiff % (1000 * 60 * 60)) / (1000 * 60)
                );
                var seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
                callStatus.text(
                  hours.toLocaleString("en-US", {
                    minimumIntegerDigits: 2,
                    useGrouping: false,
                  }) +
                    ":" +
                    minutes.toLocaleString("en-US", {
                      minimumIntegerDigits: 2,
                      useGrouping: false,
                    }) +
                    ":" +
                    seconds.toLocaleString("en-US", {
                      minimumIntegerDigits: 2,
                      useGrouping: false,
                    }) +
                    " elapsed"
                );
              }, 1000);
            });
            conn.on("data", (data) => {
              console.log(data);
              if (data == "decline") {
                callState = "standby";
                clearInterval(callInt);
                Notify.show("Pluto Contacts", name + " declined your call");
                callStatus.text("Call declined");
                if (pid > -1) {
                  Root.Core.processList[pid].proc.send({
                    type: "function",
                    content: "Person declined the call",
                  });
                }
                setTimeout(() => {
                  CSWindow.close();
                }, 1000);
                localAudioStream.getTracks().forEach((track) => track.stop());
                call.close();
              }
              if (data == "recvRequest") {
                timeoutSeconds = 5;
              }
            });
          });
        },
        // Failure callback
        function error(err) {
          Notify.show(
            "Pluto Contacts",
            "An error occurred trying to initate an audio call: " + err.message
          );
        }
      );
    }

    Home();

    return Root.Lib.setupReturns(async (m) => {
      console.log("Pluto Contacts received message: ", m);
      if (m.type == "plutoContactsSearch") {
        Root.Core.processList[m.pid].proc.send({
          type: "update",
          title: "Pluto Contacts",
          content:
            "Searching for " + m.arguments.query + " in your contacts...",
        });
        let foundContacts = await queryContacts(m.arguments.query);
        console.log(foundContacts);
        Root.Core.processList[m.pid].proc.send({
          type: "function",
          content: { results: foundContacts },
        });
      }
      if (m.type == "plutoContactsCall") {
        if (!("name" in m.arguments)) {
          Root.Core.processList[m.pid].proc.send({
            type: "function",
            content: "A contact name is required to run this function.",
          });
          return;
        }
        if (!("id" in m.arguments)) {
          Root.Core.processList[m.pid].proc.send({
            type: "function",
            content: "A contact ID is required to run this function.",
          });
          return;
        }
        if (!userData.onlineAccount) {
          Root.Core.processList[m.pid].proc.send({
            type: "function",
            content: "Cannot make call - user is not logged in.",
          });
          return;
        }
        if (callState != "standby") {
          Root.Core.processList[m.pid].proc.send({
            type: "function",
            content: "Cannot make call - user is already on a call.",
          });
        }
        let waitingForPeer = setInterval(() => {
          if (peer) {
            clearInterval(waitingForPeer);
            Root.Core.processList[m.pid].proc.send({
              type: "update",
              title: "Pluto Contacts",
              content:
                "Starting an audio call with " +
                m.arguments.name.replace(/\s/g, "") +
                "...",
            });
            audioCall(
              m.arguments.name.replace(/\s/g, ""),
              m.arguments.id,
              m.pid
            );
          }
        }, 1000);
      }
    });
  },
};
