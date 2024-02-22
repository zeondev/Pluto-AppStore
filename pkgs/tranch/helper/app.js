export default {
  name: "Helper",
  description: "The Helper assistant, on Pluto.",
  ver: 1, // Compatible with core v1
  type: "process",
  privileges: [
    {
      privilege: "processList",
      description:
        "Let Helper AI do actions on open applications when prompted",
    },
    {
      privilege: "startPkg",
      description: "Let Helper AI start applications when prompted",
    },
  ],
  exec: async function (Root) {
    let helperSvg =
      '<svg width="168" height="168" viewBox="0 0 168 168" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="168" height="168" fill="#111B10"/><path d="M33 59C33 56.4775 33.6306 54.1441 34.8919 52C36.1531 49.8559 37.8559 48.1532 40 46.8919C42.1441 45.6306 44.4775 45 47 45C49.5225 45 51.8558 45.6306 54 46.8919C56.1441 48.1532 57.8469 49.8559 59.1081 52C60.3694 54.1441 61 56.4775 61 59C61 61.5225 60.3694 63.8559 59.1081 66C57.8469 68.1441 56.1441 69.8468 54 71.1081C51.8558 72.3694 49.5225 73 47 73C44.4775 73 42.1441 72.3694 40 71.1081C37.8559 69.8468 36.1531 68.1441 34.8919 66C33.6306 63.8559 33 61.5225 33 59Z" fill="#5CB654"/><path d="M107.892 52C106.631 54.1441 106 56.4775 106 59C106 61.5225 106.631 63.8559 107.892 66C109.153 68.1441 110.856 69.8468 113 71.1081C115.144 72.3694 117.477 73 120 73C122.523 73 124.856 72.3694 127 71.1081C129.144 69.8468 130.847 68.1441 132.108 66C133.369 63.8559 134 61.5225 134 59C134 56.4775 133.369 54.1441 132.108 52C130.847 49.8559 129.144 48.1532 127 46.8919C124.856 45.6306 122.523 45 120 45C117.477 45 115.144 45.6306 113 46.8919C110.856 48.1532 109.153 49.8559 107.892 52Z" fill="#5CB654"/><path d="M112.145 125.093C118.888 119.267 122.26 110.491 122.26 98.7666L111.982 98.7666C111.982 114.591 102.246 122.504 82.7731 122.504C73.7579 122.504 66.9965 120.508 62.4889 116.516C57.9813 112.559 55.7275 106.643 55.7275 98.7666L45.4502 98.7666C45.4502 110.491 48.4612 119.267 54.4834 125.093C60.5056 130.92 69.5749 133.833 81.6913 133.833C95.2502 133.833 105.401 130.92 112.145 125.093Z" fill="#5CB654"/></svg>';

    const icons = {
      chat: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle-more"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/></svg>',
      integrations:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-blocks"><rect width="7" height="7" x="14" y="3" rx="1"/><path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3"/></svg>',
    };

    let wrapper; // Lib.html | undefined
    let HelperWindow;

    const Html = (await import("https://unpkg.com/@datkat21/html")).default;
    const Sidebar = await Root.Lib.loadComponent("Sidebar");
    const CtxMenu = await Root.Lib.loadLibrary("CtxMenu");
    const Notify = await Root.Lib.loadLibrary("Notify");
    const Card = await Root.Lib.loadComponent("Card");

    console.log("Loading VirtualFS...");
    const vfs = await Root.Lib.loadLibrary("VirtualFS");
    await vfs.importFS();

    console.log("Helper AI v1 by SkySorcerer");

    let affected = true;

    const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;
    const helperInfPath = "Registry/helperInfo";
    const helperInfExists = await vfs.exists(helperInfPath);

    const currentVersion = 2;

    let currentState = {
      version: currentVersion,
      open: false,
      pid: Root.PID,
      integrations: [],
      setupDone: false,
    };

    let currentPage = "setup";

    Root.Lib.setOnEnd(async (_) => {
      HelperWindow.close();
      if (affected) {
        await setOpenState(false);
      }
    });

    // Reset Helper data
    // await vfs.writeFile(helperInfPath, JSON.stringify(currentState, null, 2));

    if (helperInfExists) {
      currentState = JSON.parse(await vfs.readFile(helperInfPath));
      currentState.pid = Root.PID;
      if (currentState.open) {
        affected = false;
      }
      if (currentState.version != currentVersion) {
        console.log("Mismatched Helper versions detected");
        Notify.show(
          "Helper",
          "A new Helper API update has been released. Please update all your apps that take advantage of it and open them to be integrated again."
        );
        currentState = {
          version: currentVersion,
          open: false,
          pid: Root.PID,
          integrations: [],
          setupDone: false,
        };
      }
      await vfs.writeFile(helperInfPath, JSON.stringify(currentState, null, 2));
    } else {
      await vfs.writeFile(helperInfPath, JSON.stringify(currentState, null, 2));
    }

    async function setOpenState(bool) {
      currentState.open = bool;
      await vfs.writeFile(helperInfPath, JSON.stringify(currentState, null, 2));
    }

    async function isSetupDone(bool) {
      currentState.setupDone = bool;
      await vfs.writeFile(helperInfPath, JSON.stringify(currentState, null, 2));
      console.log(currentState);
    }

    let context = [
      {
        role: "system",
        content:
          "You're Helper, an AI assistant with the ability to run functions from apps and integrations provided by the user.",
      },
    ];

    let convLog = [];
    let curFunc = "";
    let functionIndex = {};

    function parseMarkdown(text) {
      let inCodeBlock = false; // flag to track if we're inside a code block
      let parsedText = "";

      text = text.replace(/&/g, "&amp;");
      text = text.replace(/</g, "&lt;");
      text = text.replace(/>/g, "&gt;");

      // Split the text into lines
      const lines = text.split("\n");

      // Loop through each line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if we're inside a code block
        if (inCodeBlock) {
          // If we're inside a code block, check if this line ends the block
          if (line.trim() === "```") {
            inCodeBlock = false;
            parsedText += "</code></pre>";
          } else {
            // If we're still inside the code block, add the line to the parsed text
            parsedText += line + "\n";
          }
        } else {
          // If we're not inside a code block, check if this line starts a code block
          if (line.trim().startsWith("```")) {
            inCodeBlock = true;
            const language = line.trim().slice(3);
            parsedText += `<pre><code class="language-${language}">`;
          } else {
            // If we're not inside a code block, parse the line as normal markdown
            parsedText += parseMarkdownLine(line) + "\n";
          }
        }
      }

      // If we're still inside a code block at the end of the text, close it
      if (inCodeBlock) {
        parsedText += "</code></pre>";
      }

      const codeTags =
        parsedText.match(
          /<code.+?class="language-(.*?)".*?>[\s\S]+?<\/code>/gim
        ) || [];
      for (let i = 0; i < codeTags.length; i++) {
        const elem = document.createElement("div");
        elem.innerHTML = codeTags[i];
        const code = elem.textContent;
        const lang = codeTags[i].match(/class="language-([^"]+)"/i);
        const language = lang ? lang[1] : "plaintext";
        try {
          const highlightedCode = hljs.highlight(code, { language }).value;
          parsedText = parsedText.replace(
            codeTags[i],
            `<code class="language-${language}">${highlightedCode}</code>`
          );
        } catch (e) {
          // ignore errors that come from highlighting, sometimes hljs can throw errors on unknown langs and such
        }
      }
      return parsedText;
    }

    function parseMarkdownLine(line) {
      // Headers
      line = line.replace(/^# (.+)/gm, "<h1>$1</h1>");
      line = line.replace(/^## (.+)/gm, "<h2>$1</h2>");
      line = line.replace(/^### (.+)/gm, "<h3>$1</h3>");
      line = line.replace(/^#### (.+)/gm, "<h4>$1</h4>");
      line = line.replace(/^##### (.+)/gm, "<h5>$1</h5>");
      line = line.replace(/^###### (.+)/gm, "<h6>$1</h6>");

      // Bold and italic
      line = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      line = line.replace(/\*(.+?)\*/g, "<em>$1</em>");

      // Links
      line = line.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

      // Images
      line = line.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1">');

      // Inline code
      line = line.replace(/`(.+?)`/g, "<code>$1</code>");

      // Paragraphs
      line = "<p>" + line + "</p>";

      return line;
    }

    function indexFunctions() {
      currentState.integrations.forEach((integration) => {
        integration.functions.forEach((iFunction) => {
          functionIndex[iFunction.name] = integration;
        });
      });
      console.log(functionIndex);
    }

    function compileFunctions() {
      let functions = [];
      currentState.integrations.forEach((integration) => {
        integration.functions.forEach((iFunction) => {
          functions.push(iFunction);
        });
      });
      return functions;
    }

    async function generateResponse(prompt) {
      context.push({ role: "user", content: prompt });
      convLog.push({ from: "user", message: prompt });
      let integrations = compileFunctions();
      console.log(integrations);
      let payload = {
        context: context,
        integrations: integrations,
      };
      const rawResponse = await fetch("https://olive.nxw.pw:8443/generate", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const content = await rawResponse.json();
      return content;
    }

    async function generateResponseFromFunc(data) {
      console.log(curFunc);
      context.push({
        role: "function",
        name: curFunc,
        content: JSON.stringify(data),
      });
      console.log(context);
      let integrations = compileFunctions();
      console.log(integrations);
      let payload = {
        context: context,
        integrations: integrations,
      };
      const rawResponse = await fetch("https://olive.nxw.pw:8443/generate", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const content = await rawResponse.json();
      return content;
    }

    async function execFunction(cmdName, args) {
      curFunc = cmdName;
      indexFunctions();
      let integration = functionIndex[cmdName];
      let processName = integration.name;
      let processFound = false;
      let procID = -1;
      let process;
      console.log(processName);
      console.log(Root.Core.processList);
      Root.Core.processList.forEach((process) => {
        if (process) {
          console.log(process);
          if (process.proc && process.proc.name == processName) {
            procID = process.pid;
            processFound = true;
          }
        }
      });
      if (processFound) {
        process = Root.Core.processList[procID];
      } else {
        const appPath = "Registry/AppStore/" + integration.packageName;
        const appExists = await vfs.exists(appPath);
        if (appExists) {
          const curApp = await Root.Core.startPkg(
            "data:text/javascript;base64," + btoa(await vfs.readFile(appPath)),
            false,
            true
          );
          if (curApp != false) {
            process = curApp;
          }
        } else {
          createStatus(
            "Error",
            `Application tied to integration "${processName}" not found`
          );
          let response = await generateResponseFromFunc(
            `HelperCore: Application "${integration.name} not found. It may have been uninstalled, or the app's developer has provided wrong information."`
          );
          console.log(response);
          context.push(response);
          if (response.content) {
            convLog.push({ from: "assistant", message: response.content });
            createMessage(response.content);
          }
          if ("function_call" in response) {
            execFunction(
              response.function_call.name,
              JSON.parse(response.function_call.arguments)
            );
          }
        }
      }
      if (process) {
        process.proc.send({ type: cmdName, arguments: args, pid: Root.PID });
      }
    }

    // generateResponse(
    //   "Search for the first ever video to be uploaded on YouTube",
    // ).then((result) => {
    //   if ("function_call" in result) {
    //     console.log(result);
    //     execFunction(
    //       result.function_call.name,
    //       JSON.parse(result.function_call.arguments),
    //     );
    //   }
    // });

    // Create a window
    HelperWindow = new Win({
      title: "Helper AI Assistant",
      content: "",
      pid: Root.PID,
      width: 640,
      height: 360,
      onclose: () => {
        HelperWindow.window.style.display = "none";
        Notify.show(
          "Helper is running on the background",
          "Use the System tray to restore the Helper window or quit the app completely."
        );
        return false;
      },
    });

    await setOpenState(true);
    wrapper = Html.from(HelperWindow.window.querySelector(".win-content"));
    let container = new Html("div").styleJs({
      display: "flex",
      flexDirection: "column",
      overflow: "scroll",
      width: "100%",
      height: "100%",
    });

    let updatingIntegrations = false;

    let sidebarWrapper = new Root.Lib.html("div")
      .styleJs({ display: "flex" })
      .appendTo(wrapper.elm);

    let notifyBox = new Root.Lib.html("div")
      .class("notify-box")
      .appendTo(wrapper.elm);

    let center = new Html("div").appendTo(wrapper).styleJs({
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%",
      textAlign: "center",
    });

    let chatDiv;

    if (currentState.integrations.length == 0) {
      let helperImg = new Html("svg")
        .html(helperSvg)
        .appendTo(center)
        .styleJs({ borderRadius: "5px", border: "2px solid rgb(57,87,56)" });
      new Html("br").appendTo(center);
      let helperName = new Html("h1").text("Hi, I'm Helper.").appendTo(center);
      let getStartedText = new Html("p")
        .text("I'm an AI-powered assistant with modular features.")
        .appendTo(center);
      let getStartedButton = new Html("button")
        .text("Get started")
        .appendTo(center)
        .on("click", () => {
          getStarted();
        });
      if (currentState.setupDone) {
        Home();
      }
    } else {
      isSetupDone(true);
      Home();
    }

    let newUser = false;

    function getStarted() {
      if (currentState.integrations.length > 0) {
        Home();
        return;
      }
      newUser = true;
      center.clear();
      new Html("h1")
        .text("You don't have an integration yet!")
        .appendTo(center);
      new Html("p")
        .text(
          "Open a supported app, such as the latest version of the YouTube app, to add it as an integration."
        )
        .appendTo(center);
      new Html("button")
        .text("Start with no integrations")
        .appendTo(center)
        .on("click", async () => {
          await isSetupDone(true);
          Home();
        });
    }

    function makeSidebar() {
      sidebarWrapper.clear();
      Sidebar.new(sidebarWrapper.elm, [
        {
          onclick: Chat,
          html: icons.chat,
          title: "Chat",
        },
        {
          onclick: IntegrationsList,
          html: icons.integrations,
          title: "Integrations",
        },
      ]);
    }

    function Home() {
      center.cleanup();
      container.appendTo(wrapper);
      wrapper.elm.classList.add("row", "h-100", "with-sidebar");
      makeSidebar();
      Chat();
    }

    function Chat() {
      updatingIntegrations = false;
      currentPage = "chat";
      container.clear();
      chatDiv = new Html("div").appendTo(container).styleJs({
        width: "100%",
        height: "90%",
        display: "flex",
        flexDirection: "column",
        overflow: "scroll",
      });
      let welcomeDiv = new Html("div").appendTo(chatDiv).styleJs({
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      });
      let helperImg = new Html("svg")
        .html(helperSvg)
        .appendTo(welcomeDiv)
        .styleJs({
          borderRadius: "5px",
          border: "2px solid rgb(57,87,56)",
        });
      new Html("br").appendTo(welcomeDiv);
      new Html("h1").text("How can I help you today?").appendTo(welcomeDiv);
      let inputDiv = new Html("div").appendTo(container).styleJs({
        display: "flex",
        width: "100%",
        height: "10%",
        alignItems: "center",
        justifyContent: "center",
      });
      let tInput = new Html("input")
        .appendTo(inputDiv)
        .attr({ placeholder: "Ask Helper anything..." })
        .styleJs({ width: "90%" })
        .on("keydown", (e) => {
          if (e.key == "Enter") {
            let curVal = tInput.getValue();
            tInput.elm.value = "";
            sendMessage(curVal);
          }
        });
      new Html("button")
        .appendTo(inputDiv)
        .text("Send")
        .on("click", () => {
          let curVal = tInput.getValue();
          tInput.elm.value = "";
          sendMessage(curVal);
        });
      restoreHistory();
    }

    function createMessage(message, you = false) {
      if (!chatDiv) {
        return;
      }
      if (currentPage != "chat") {
        return;
      }
      let mNameContent = "You";
      if (!you) {
        mNameContent = "Helper";
      }
      let messageContainer = new Html("div").appendTo(chatDiv).styleJs({
        display: "flex",
        flexDirection: "column",
        padding: "10px",
        gap: "0px",
      });
      let messageName = new Html("h3")
        .text(mNameContent)
        .appendTo(messageContainer)
        .styleJs({ padding: "0px", margin: "5px" });
      let messageContent = new Html("p")
        .html(parseMarkdown(message))
        .appendTo(messageContainer)
        .styleJs({ padding: "0px", margin: "5px" });
      chatDiv.elm.scrollTop = chatDiv.elm.scrollHeight;
    }

    function createStatus(title, content) {
      if (!chatDiv) {
        return;
      }
      console.log("Created");
      let statusContainer = new Html("div")
        .class("card")
        .appendTo(chatDiv)
        .styleJs({
          marginTop: "10px",
          marginBottom: "10px",
          marginLeft: "5px",
          padding: "15px",
          width: "90%",
        });
      let statusItem = new Html("div")
        .class("flex-group", "col")
        .appendTo(statusContainer);
      new Html("h1").text(title).appendTo(statusItem);
      new Html("p").text(content).appendTo(statusItem);
      chatDiv.elm.scrollTop = chatDiv.elm.scrollHeight;
    }

    async function restoreHistory() {
      convLog.forEach((message) => {
        if (message.from == "user") {
          createMessage(message.message, true);
        }
        if (message.from == "assistant") {
          createMessage(message.message, false);
        }
        if (message.from == "function") {
          createStatus(message.message.title, message.message.content);
        }
      });
    }

    async function sendMessage(message) {
      if (message.trim() == "") {
        return;
      }
      createMessage(message, true);
      let response = await generateResponse(message);
      console.log(response);
      context.push(response);
      if (response.content) {
        convLog.push({ from: "assistant", message: response.content });
        createMessage(response.content);
      }
      if ("function_call" in response) {
        execFunction(
          response.function_call.name,
          JSON.parse(response.function_call.arguments)
        );
      }
    }

    function IntegrationsList() {
      updatingIntegrations = true;
      currentPage = "integrations";
      container.clear();
      let pageInfo = new Html("div")
        .appendTo(container)
        .styleJs({ padding: "15px" });
      let pageTitle = new Html("h1").appendTo(pageInfo).text("Integrations");
      let pageDesc = new Html("p")
        .appendTo(pageInfo)
        .text(
          "These are Helper integrations added by apps, which let you do certain actions by simply asking Helper. Take note that removing the integration may not guarantee full removal."
        );
      let integrationListDiv = new Html("div").appendTo(container).styleJs({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      });
      new Html("h1")
        .text("Loading integrations...")
        .appendTo(integrationListDiv);
      let updateInterval = setInterval(() => {
        integrationListDiv.clear();
        currentState.integrations.forEach((integration) => {
          let card = new Html("div")
            .class("card")
            .appendTo(integrationListDiv)
            .styleJs({
              marginTop: "10px",
              marginBottom: "10px",
              width: "90%",
              padding: "15px",
            });
          let integrationItem = new Html("div")
            .class("flex-group", "col")
            .appendTo(card);
          new Html("h1")
            .text(integration.name + " (" + integration.id + ")")
            .appendTo(integrationItem);
          new Html("p").text(integration.description).appendTo(integrationItem);
          new Html("button")
            .text("Remove integration")
            .appendTo(integrationItem)
            .on("click", async () => {
              let curIndex = currentState.integrations.indexOf(integration);
              currentState.integrations.splice(curIndex, 1);
              await vfs.writeFile(
                helperInfPath,
                JSON.stringify(currentState, null, 2)
              );
              card.cleanup();
            });
        });
        if (currentState.integrations.length == 0) {
          new Html("h1")
            .text("You currently have no integrations.")
            .appendTo(integrationListDiv);
        }
      }, 1000);
    }

    return Root.Lib.setupReturns(
      async (m) => {
        console.log(m);
        if (m.type == "context-menu") {
          CtxMenu.new(m.x, m.y, [
            {
              item: "Open window",
              select: async () => {
                HelperWindow.window.style.display = "flex";
              },
            },
            {
              item: "Quit",
              select: async () => {
                Root.Lib.onEnd();
              },
            },
          ]);
        }
        if ("type" in m && "content" in m) {
          console.log("Helper: Received message");
          console.log("Message Type: " + m.type);
          console.log("Message Content:" + m.content);
          if (m.type == "function") {
            let response = await generateResponseFromFunc(m.content);
            console.log(response);
            context.push(response);
            if (response.content) {
              convLog.push({ from: "assistant", message: response.content });
              createMessage(response.content);
            }
            if ("function_call" in response) {
              execFunction(
                response.function_call.name,
                JSON.parse(response.function_call.arguments)
              );
            }
          }
          if (m.type == "update") {
            convLog.push({ from: "function", message: m });
            createStatus(m.title, m.content);
          }
          if (m.type == "integration") {
            let isError = false;
            if (!("id" in m.content)) {
              Root.Core.processList[m.content.pid].proc.send({
                type: "integration-error",
                content: "An integration ID is required.",
              });
              hasError = true;
            }
            if (!("name" in m.content)) {
              Root.Core.processList[m.content.pid].proc.send({
                type: "integration-error",
                content: "An integration name is required.",
              });
              hasError = true;
            }
            if (!("description" in m.content)) {
              Root.Core.processList[m.content.pid].proc.send({
                type: "integration-error",
                content: "An integration description is required.",
              });
              hasError = true;
            }
            if (!("packageName" in m.content)) {
              Root.Core.processList[m.content.pid].proc.send({
                type: "integration-error",
                content:
                  "Helper needs a package name to launch the source of this integration.",
              });
              hasError = true;
            }
            if (!("functions" in m.content)) {
              Root.Core.processList[m.content.pid].proc.send({
                type: "integration-error",
                content: "Functions are required for integrations.",
              });
              hasError = true;
            }
            currentState.integrations.forEach((integration) => {
              if ("id" in integration) {
                console.log(integration);
                if (integration.id == m.content.id) {
                  isError = true;
                  Root.Core.processList[m.content.pid].proc.send({
                    type: "integration-error",
                    content: "Integration already added",
                  });
                }
              }
            });
            if (!isError) {
              currentState.integrations.push(m.content);
              await vfs.writeFile(
                helperInfPath,
                JSON.stringify(currentState, null, 2)
              );
              Root.Core.processList[m.content.pid].proc.send({
                type: "integration-success",
                content: "",
              });
              await isSetupDone(true);
              Notify.show(
                "New integration added",
                m.content.name + " has been added as an integration."
              );
              console.log(compileFunctions());
              if (newUser) {
                newUser = false;
                Home();
              }
            }
          }
        }
      },
      {
        icon: '<svg width="168" height="168" viewBox="0 0 168 168" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="168" height="168" fill="#111B10"/><path d="M33 59C33 56.4775 33.6306 54.1441 34.8919 52C36.1531 49.8559 37.8559 48.1532 40 46.8919C42.1441 45.6306 44.4775 45 47 45C49.5225 45 51.8558 45.6306 54 46.8919C56.1441 48.1532 57.8469 49.8559 59.1081 52C60.3694 54.1441 61 56.4775 61 59C61 61.5225 60.3694 63.8559 59.1081 66C57.8469 68.1441 56.1441 69.8468 54 71.1081C51.8558 72.3694 49.5225 73 47 73C44.4775 73 42.1441 72.3694 40 71.1081C37.8559 69.8468 36.1531 68.1441 34.8919 66C33.6306 63.8559 33 61.5225 33 59Z" fill="#5CB654"/><path d="M107.892 52C106.631 54.1441 106 56.4775 106 59C106 61.5225 106.631 63.8559 107.892 66C109.153 68.1441 110.856 69.8468 113 71.1081C115.144 72.3694 117.477 73 120 73C122.523 73 124.856 72.3694 127 71.1081C129.144 69.8468 130.847 68.1441 132.108 66C133.369 63.8559 134 61.5225 134 59C134 56.4775 133.369 54.1441 132.108 52C130.847 49.8559 129.144 48.1532 127 46.8919C124.856 45.6306 122.523 45 120 45C117.477 45 115.144 45.6306 113 46.8919C110.856 48.1532 109.153 49.8559 107.892 52Z" fill="#5CB654"/><path d="M112.145 125.093C118.888 119.267 122.26 110.491 122.26 98.7666L111.982 98.7666C111.982 114.591 102.246 122.504 82.7731 122.504C73.7579 122.504 66.9965 120.508 62.4889 116.516C57.9813 112.559 55.7275 106.643 55.7275 98.7666L45.4502 98.7666C45.4502 110.491 48.4612 119.267 54.4834 125.093C60.5056 130.92 69.5749 133.833 81.6913 133.833C95.2502 133.833 105.401 130.92 112.145 125.093Z" fill="#5CB654"/></svg>',
      }
    );
  },
};
