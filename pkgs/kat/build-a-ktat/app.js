export default {
  name: "Build a Ktat",
  description: "A silly character creator app!",
  ver: 1.5,
  type: "process",
  exec: async function (Root) {
    let wrapper; // Lib.html | undefined
    let MyWindow;

    console.log("Hello from example package", Root.Lib);

    Root.Lib.setOnEnd((_) => MyWindow.close());

    const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;

    MyWindow = new Win({
      title: "Build a Ktat",
      content: '<iframe src="https://ktat.cherries.to"></iframe>',
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
