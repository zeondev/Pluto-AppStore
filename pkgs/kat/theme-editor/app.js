class CSSParser {
  constructor() {
    this.parse = function (cssText) {
      const stylesheet = { rules: [] };
      const rules = cssText.match(/[^}]+}/g) || [];

      for (const ruleText of rules) {
        const rule = this.parseRule(ruleText.trim());
        stylesheet.rules.push(rule);
      }

      return stylesheet;
    };

    this.parseRule = function (ruleText) {
      const parts = ruleText.split("{");
      const selectorText = parts[0].trim();
      const declarationsText = parts[1] && parts[1].trim(); // Check if parts[1] exists
      const declarations = declarationsText
        ? this.parseDeclarations(declarationsText)
        : [];

      return {
        selectorText,
        declarations,
      };
    };

    this.parseDeclarations = function (declarationsText) {
      const declarations = [];
      const parts = declarationsText.split(";");

      for (const declarationText of parts) {
        if (declarationText.trim().length === 0) {
          continue;
        }

        const parts = declarationText.split(":");
        const property = parts[0].trim();
        const value = parts[1] && parts[1].trim(); // Check if parts[1] exists

        declarations.push({
          property,
          value,
        });
      }

      return declarations;
    };
  }
}
async function parseCssVariables(theme) {
  try {
    const response = await fetch("style.css");
    const cssText = await response.text();

    const parser = new CSSParser();
    const stylesheet = parser.parse(cssText);

    const rootRule = stylesheet.rules.find(
      (rule) => rule.selectorText === `:root[data-theme="${theme}"]`
    );

    console.log("Searching for", theme, "in", stylesheet.rules);

    const cssVariables = {};

    if (rootRule) {
      for (const declaration of rootRule.declarations) {
        if (declaration.property.startsWith("--")) {
          cssVariables[declaration.property.substring(2)] = declaration.value;
        }
      }
    }

    console.log(cssVariables);

    return cssVariables;
  } catch (error) {
    console.error("Error:", error);
  }
}
const CACHE_DIR = "Root/Pluto/cache/lib";
// To cache libraries on first app load
async function cacheLibrary(vfs, url, filename) {
  let result = await vfs.exists(CACHE_DIR + "/" + filename);
  let content;

  if (result === false) {
    await vfs.createFolder(CACHE_DIR);

    content = await fetch(url).then((t) => t.text());

    await vfs.writeFile(CACHE_DIR + "/" + filename, content);
  } else {
    content = await vfs.readFile(CACHE_DIR + "/" + filename);
  }

  let lib = await import(
    URL.createObjectURL(new Blob([content], { type: "application/javascript" }))
  );

  if (lib.default) lib = lib.default;

  console.log(filename, lib);

  return lib;
}

export default {
  name: "Theme Editor",
  description: "Theme app",
  ver: 1.4, // Compatible with core v1.4
  type: "process",
  exec: async function (Root) {
    const vfs = await Root.Lib.loadLibrary("VirtualFS");

    await vfs.importFS();

    console.log("Vfs", vfs);

    // To ensure some compatibility with 1.3 just in case
    const Html = await cacheLibrary(
      vfs,
      "https://unpkg.com/@datkat21/html",
      "html.js"
    );

    const Iro = await cacheLibrary(
      vfs,
      "https://unpkg.com/@jaames/iro@5.5.2/dist/iro.es.js",
      "iro.es.js"
    );

    let wrapper, editWrapper; // Lib.html | undefined
    let MyWindow, pickerWindow, editWindow;

    Root.Lib.setOnEnd((_) => {
      MyWindow.close();
      pickerWindow && pickerWindow.close();
      editWindow && editWindow.close();
    });

    const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;
    const FileDialog = await Root.Lib.loadLibrary("FileDialog");
    const Sidebar = await Root.Lib.loadComponent("Sidebar");

    function colorPicker(color = "#ff0000") {
      return new Promise((resolve, reject) => {
        pickerWindow = new Win({
          title: "Pick a color",
          width: 540,
          height: 300,
          resizable: false,
          onclose: () => {
            resolve(false);
            return true;
          },
        });

        let wrapper2 = Html.from(
          pickerWindow.window.querySelector(".win-content")
        );

        wrapper2.classOn("with-sidebar");

        let pickerElement = new Html("div").class("color-picker");
        let textInput = new Html("input").attr({
          type: "text",
          placeholder: "Hex color",
          value: color,
        });

        let buttonRow = new Html("div").class("row", "gap").appendMany(
          new Html("button")
            .class("primary")
            .text(Root.Lib.getString("ok"))
            .on("click", (e) => {
              pickerWindow.close();
              resolve({
                value: colorPicker.color.hslString,
                rgb: colorPicker.color.rgbString.substring(4).replace(")", ""),
              });
            }),
          new Html("button")
            .class("neutral")
            .text(Root.Lib.getString("cancel"))
            .on("click", (e) => {
              pickerWindow.close();
              resolve(false);
            })
        );

        let vertWrapper = new Html("div")
          .class("col", "gap", "container")
          .appendMany(pickerElement, buttonRow);
        let vertWrapper2 = new Html("div")
          .class("col", "gap", "container")
          .appendMany(textInput);

        let horizontalWrapper = new Html("div")
          .class("row", "gap", "container")
          .appendMany(vertWrapper, vertWrapper2);

        wrapper2.appendMany(horizontalWrapper);

        let colorPicker = Iro.ColorPicker(pickerElement.elm, {
          // Set the size of the color picker
          width: 144,
          // Set the initial color to pure red
          color,
        });

        colorPicker.on("color:change", (color) => {
          textInput.val(color.hexString);
        });
        textInput.on("input", (event) => {
          colorPicker.color.hexString = textInput.getValue();
        });
      });
    }
    async function promptValue(value = "", title = "Value to enter", parent) {
      return await Root.Modal.input(
        "Enter value",
        title,
        value,
        parent,
        false,
        value
      );
    }

    let colorsList = [
      "primary",
      "negative",
      "negative-light",
      "negative-dark",
      "positive",
      "positive-light",
      "positive-dark",
      "warning",
      "warning-light",
      "warning-light-translucent",
      "warning-dark",
      "root",
      "root-rgb",
      "header",
      "unfocused",
      "text",
      "text-rgb",
      "text-alt",
      "text-light",
      "label",
      "label-light",
      "neutral",
      "neutral-focus",
      "outline",
    ];
    let hideList = ["root-rgb", "text-rgb"];

    function editColorsModal() {
      editWindow = new Win({
        title: "Edit colors",
        width: 540,
        height: 360,
        onclose: () => {
          return true;
        },
      });

      editWrapper = Html.from(editWindow.window.querySelector(".win-content"));

      editWrapper.classOn("with-sidebar", "row-wrap", "gap");

      function makeButtons() {
        editWrapper.clear();
        let keys = Object.keys(currentDocument.data.values);

        for (let i = 0; i < keys.length; i++) {
          if (hideList.includes(keys[i])) continue;
          let value = currentDocument.data.values[keys[i]];

          let isColor = colorsList.includes(keys[i]);

          if (isColor === true) {
            new Html("button")
              .class("row", "fc", "gap", "small")
              .appendMany(
                new Html("div").styleJs({
                  width: "24px",
                  height: "24px",
                  borderRadius: "4px",
                  border: "1px solid var(--outline)",
                  backgroundColor: value,
                }),
                new Html("div").text(keys[i])
              )
              .appendTo(editWrapper)
              .on("click", async (e) => {
                await customizeColor(keys[i]);
                makeButtons();
              });
          } else {
            new Html("button")
              .class("row", "fc", "gap")
              .appendMany(new Html("div").text(keys[i]))
              .appendTo(editWrapper)
              .on("click", async (e) => {
                await customizeValue(keys[i], editWrapper.elm);
                makeButtons();
              });
          }
        }
      }

      makeButtons();
    }
    function editMetaModal() {
      editWindow = new Win({
        title: "Edit metadata",
        width: 540,
        height: 115,
        onclose: () => {
          return true;
        },
      });

      editWrapper = Html.from(editWindow.window.querySelector(".win-content"));

      editWrapper.classOn("with-sidebar", "row-wrap", "gap");

      function makeButtons() {
        let data = {
          version: currentDocument.data.version,
          name: currentDocument.data.name,
          description: currentDocument.data.description,
          cssThemeDataset: currentDocument.data.cssThemeDataset,
          wallpaper: currentDocument.data.wallpaper,
        };

        editWrapper.clear();
        let keys = Object.keys(data);

        for (let i = 0; i < keys.length; i++) {
          if (hideList.includes(keys[i])) continue;
          let value = data[keys[i]];

          new Html("button")
            .appendMany(new Html("div").text(keys[i]))
            .appendTo(editWrapper)
            .on("click", async (e) => {
              let result = await promptValue(value, keys[i], editWrapper.elm);
              if (result !== false) {
                currentDocument.dirty = true;
                updateTitle();
                if (keys[i] === "name") {
                  themeName.text(result);
                  currentDocument.data[keys[i]] = result;
                } else if (keys[i] === "version") {
                  currentDocument.data["version"] = parseFloat(result);
                } else currentDocument.data[keys[i]] = result;
              }
              makeButtons();
            });
        }
      }

      makeButtons();
    }

    // Create a window
    MyWindow = new Win({
      title: "Theme Editor",
      onclose: async () => {
        if (currentDocument.dirty === true) {
          let result = await Root.Modal.prompt(
            "Warning",
            "You have unsaved changes, are you sure you want to exit?",
            MyWindow.window
          );
          if (result !== true) {
            return false;
          }
        }
        Root.Lib.onEnd();
      },
      width: 540,
      height: 360,
    });

    wrapper = Html.from(MyWindow.window.querySelector(".win-content"));
    wrapper.classOn("row", "o-h", "h-100", "with-sidebar");

    function setColor(colorName, value, colorRgb = undefined) {
      wrapper.style({
        [`--${colorName}`]: value,
      });
      if (colorName === "text") {
        wrapper.style({ color: "var(--text)" });
      } else if (colorName === "primary") {
        wrapper.style({ "accent-color": "var(--primary)" });
      }
      currentDocument.data.values[colorName] = value;
      if (
        (colorName === "root" || colorName === "text") &&
        colorRgb !== undefined
      ) {
        currentDocument.data.values[colorName + "-rgb"] = colorRgb;
        wrapper.style({
          [`--${colorName}-rgb`]: colorRgb,
        });
      }
    }

    const defaultTheme = {
      version: 1,
      name: "My Theme",
      description: "A custom theme.",
      values: {
        primary: "hsl(222, 80%, 40%)",
        negative: "hsl(0, 80%, 40%)",
        "negative-light": "hsl(0, 80%, 73%)",
        "negative-dark": "hsl(0, 79%, 25%)",
        positive: "hsl(133, 80%, 40%)",
        "positive-light": "hsl(134, 81%, 72%)",
        "positive-dark": "hsl(133, 79%, 25%)",
        warning: "hsla(60, 90%, 40%, 0.8)",
        "warning-light": "rgba(247, 247, 120, 1)",
        "warning-light-translucent": "rgba(247, 247, 120, 0.4)",
        "warning-dark": "hsla(60, 96%, 25%, 0.2)",
        root: "hsl(222, 25%, 8%)",
        "root-rgb": "15, 18, 25",
        header: "hsl(219, 28%, 12%)",
        unfocused: "hsl(218, 31%, 5%)",
        text: "hsl(0, 0%, 100%)",
        "text-rgb": "255, 255, 255",
        "text-alt": "hsl(222, 33%, 80%)",
        "text-light": "hsl(0, 0%, 100%)",
        label: "hsl(222, 16%, 38%)",
        "label-light": "hsl(222, 15%, 50%)",
        neutral: "hsl(222, 26%, 18%)",
        "neutral-focus": "hsl(222, 27%, 20%)",
        outline: "hsl(222, 23%, 22%)",
        "easing-function": "cubic-bezier(0.65, 0, 0.35, 1)",
        "short-animation-duration": "0.15s",
        "animation-duration": "0.45s",
        "long-animation-duration": "1s",
      },
      cssThemeDataset: null,
      wallpaper: "https://pluto.zeon.dev/assets/wallpapers/space.png",
    };

    let currentDocument = {
      path: "",
      dirty: false,
      data: defaultTheme,
    };

    const updateTitle = (_) => {
      MyWindow.window.querySelector(".win-titlebar .title").innerText = `${
        currentDocument.dirty === true ? "\u2022" : ""
      } Theme Editor - ${
        currentDocument.path === ""
          ? "Untitled"
          : currentDocument.path.split("/").pop()
      }`.trim();
      themeName.text(currentDocument.data.name);
    };

    async function newDocument(path, content) {
      currentDocument.path = path;
      currentDocument.dirty = false;
      if (content === "") {
        currentDocument.data = defaultTheme;
      } else {
        try {
          currentDocument.data = JSON.parse(content);
        } catch (e) {
          Root.Modal.alert("Alert", "Could not read the file!");
        }
      }
      updateTitle();
      let obj;
      if (currentDocument.data.values) {
        obj = currentDocument.data.values;
      } else if (
        currentDocument.data.cssThemeDataset !== undefined &&
        currentDocument.data.cssThemeDataset !== null
      ) {
        // Parse the CSS theme
        obj = await parseCssVariables(currentDocument.data.cssThemeDataset);
        currentDocument.data.values = obj;
      }

      let keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        setColor(keys[i], obj[keys[i]]);
      }
    }

    async function openFile() {
      let file = await FileDialog.pickFile(
        (await vfs.getParentFolder(currentDocument.path)) ||
          "Root/Pluto/config/themes"
      );
      if (file === false) return;
      let content = await vfs.readFile(file);
      newDocument(file, content);
      MyWindow.focus();
    }
    async function saveFile() {
      // make sure the path is not unreasonable
      if (currentDocument.path === "") {
        return saveAs();
      }
      await vfs.writeFile(
        currentDocument.path,
        JSON.stringify(currentDocument.data)
      );
      currentDocument.dirty = false;
      updateTitle();
    }
    async function saveAs() {
      let result = await FileDialog.saveFile(
        (await vfs.getParentFolder(currentDocument.path)) ||
          "Root/Pluto/config/themes"
      );
      if (result === false) return false;

      await vfs.writeFile(result, JSON.stringify(currentDocument.data));

      currentDocument.dirty = false;
      currentDocument.path = result;
      updateTitle();
    }

    async function dirtyCheck() {
      if (currentDocument.dirty === true) {
        let result = await Root.Modal.prompt(
          "Warning",
          "You have unsaved changes, are you sure you want to proceed?",
          MyWindow.window
        );
        if (result !== true) {
          return false;
        }
      }
      return true;
    }

    async function customizeColor(type) {
      let color = await colorPicker(currentDocument.data.values[type], type);

      console.log("Got", color);

      if (color !== false) setColor(type, color.value, color.rgb);
      else {
        currentDocument.dirty = true;
        updateTitle();
      }
    }
    async function customizeValue(type, parent) {
      let color = await promptValue(
        currentDocument.data.values[type],
        type,
        parent
      );

      if (color !== false) setColor(type, color);
      else {
        currentDocument.dirty = true;
        updateTitle();
      }
    }

    Sidebar.new(wrapper.elm, [
      {
        onclick: async (_) => {
          const result = await dirtyCheck();
          if (result === false) return;
          newDocument("", "");
        },
        title: "New",
        html: Root.Lib.icons.newFile,
      },
      {
        onclick: async (_) => {
          const result = await dirtyCheck();
          if (result === false) return;
          openFile();
        },
        title: "Open...",
        html: Root.Lib.icons.openFolder,
      },
      {
        onclick: async (_) => {
          await saveFile();
        },
        title: "Save",
        html: Root.Lib.icons.save,
      },
      {
        onclick: async (_) => {
          await saveAs();
        },
        title: "Save as...",
        html: Root.Lib.icons.saveAll,
      },
      {
        style: {
          "margin-top": "auto",
        },
        onclick: async (_) => {
          let result = await Root.Modal.prompt(
            "Help",
            "Would you like to learn how to use this program?"
          );

          if (result === true) {
            await Root.Modal.alert(
              "How to use",
              "On the left, the sidebar acts as a way to manage the current open document. You can use the 'open' button to use an existing theme as a base, or open one of your own custom themes."
            );
            await Root.Modal.alert(
              "How to use",
              "In the middle, the window preview appears, showing how your theme will look."
            );
            await Root.Modal.alert(
              "How to use",
              "On the right section, you can find two buttons to open windows related to modifying color data and metadata of your theme."
            );
          }
        },
        html: Root.Lib.icons.help,
      },
    ]);

    new Html("div").appendTo(wrapper).appendMany(
      new Html("div")
        .styleJs({ position: "relative", width: "296px" })
        .appendMany(
          new Html("div")
            .class("win-window-decorative")
            .styleJs({
              top: "15px",
              left: "15px",
              width: "240px",
              height: "180px",
            })
            .appendMany(
              new Html("div")
                .class("win-titlebar")
                .appendMany(
                  new Html("div")
                    .class("buttons")
                    .appendMany(
                      new Html("button").class("win-btn", "win-minimize")
                    ),
                  new Html("div")
                    .class("outer-title")
                    .appendMany(new Html("div").class("title").text("Preview")),
                  new Html("div")
                    .class("buttons")
                    .appendMany(
                      new Html("button").class("win-btn", "win-close")
                    )
                )
            ),
          new Html("div")
            .class("win-window-decorative", "focus")
            .styleJs({
              top: "40px",
              left: "40px",
              width: "240px",
            })
            .appendMany(
              new Html("div")
                .class("win-titlebar")
                .appendMany(
                  new Html("div")
                    .class("buttons")
                    .appendMany(
                      new Html("button").class("win-btn", "win-minimize")
                    ),
                  new Html("div")
                    .class("outer-title")
                    .appendMany(new Html("div").class("title").text("Preview")),
                  new Html("div")
                    .class("buttons")
                    .appendMany(
                      new Html("button").class("win-btn", "win-close")
                    )
                ),
              new Html("div")
                .class("win-content", "col", "gap")
                .appendMany(
                  new Html("div")
                    .class("row-wrap", "gap")
                    .appendMany(
                      new Html("button")
                        .class("mc", "mhc", "m-0")
                        .text("Button"),
                      new Html("button")
                        .class("primary", "mc", "m-0")
                        .text("Primary"),
                      new Html("button")
                        .class("danger", "mc", "m-0")
                        .text("Danger"),
                      new Html("button")
                        .class("success", "mc", "m-0")
                        .text("Success")
                    ),
                  new Html("div")
                    .class("col", "gap")
                    .appendMany(
                      new Html("input")
                        .class("mc")
                        .attr({ placeholder: "Input text" })
                    ),
                  new Html("div")
                    .class("col", "gap")
                    .html(
                      `<span class="row ac js gap"><span>Select</span><select class="if mc"><option value="0">Select box</option><option value="1" selected="true">Select me</option></select></span><span><input type="checkbox" id="tcb" checked="true"><label for="tcb">Checkbox</label></span>`
                    )
                )
            )
        )
    );

    let themeName = new Html("span").text("Theme Name");

    new Html("div")
      .class("col", "fg", "container", "gap")
      .appendTo(wrapper)
      .appendMany(
        themeName,
        new Html("button")
          .class("small", "mc")
          .text("Edit Colors")
          .on("click", editColorsModal),
        new Html("button")
          .class("small", "mc")
          .text("Edit Metadata")
          .on("click", editMetaModal)
      );

    newDocument("", "");

    return Root.Lib.setupReturns((m) => {
      console.log("Example received message: " + m);
    });
  },
};
