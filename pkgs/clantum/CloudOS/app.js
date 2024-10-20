export default {
  name: "CloudOS",
  description: "CloudOS Subsystem",
  ver: 1.5,
  type: "process",
  exec: async function (Root) {
    let wrapper; // Lib.html | undefined
    let MyWindow;

    console.log("Hello from example package", Root.Lib);

    Root.Lib.setOnEnd((_) => MyWindow.close());

    const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;

    MyWindow = new Win({
      title: "CloudOS",
      content: '<iframe src="https://cloudos.thats-the.name"></iframe>',
      pid: Root.PID,
      width: 800,
      height: 600,
      onclose: () => {
        Root.Lib.onEnd();
      },
    });

    wrapper = MyWindow.window.querySelector(".win-content");
    wrapper.style.padding = "0px";

    return Root.Lib.setupReturns((m) => {
      /* This app has no message functionality... */
    });
  },
};
