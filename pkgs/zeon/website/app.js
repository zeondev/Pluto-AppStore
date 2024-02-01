export default {
  name: "Zeon Example",
  description: "Example application by Zeon that opens an iframe.",
  ver: 1.3, // Compatible with core v1.3
  type: "process",
  exec: async function (Root) {
    let wrapper;
    let ZeonWindow;

    console.log("Hello from the Zeon app!");

    Root.Lib.setOnEnd((_) => ZeonWindow.close());

    const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;

    // Testing the html library
    ZeonWindow = new Win({
      title: "Zeon",
      content: '<iframe src="https://zeon.dev/">',
      pid: Root.PID,
      width: 640,
      height: 480,
      onclose: () => {
        Root.Lib.onEnd();
      },
    });

    wrapper = ZeonWindow.window.querySelector(".win-content");
    wrapper.style.padding = "0px";

    return Root.Lib.setupReturns((m) => {
      console.log("Example received message: " + m);
    });
  },
};
