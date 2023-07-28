export default {
  name: "Zeon Example",
  description: "Example application by Zeon that opens an iframe.",
  ver: 1.1, // Compatible with core v1
  type: "process",
  exec: async function (Root) {
    let wrapper;
    let ZeonWindow;

    console.log("Hello from the Zeon app!");

    function onEnd() {
      console.log("Example process ended, attempting clean up...");
      const result = Root.Lib.cleanup(Root.PID, Root.Token);
      if (result === true) {
        ZeonWindow.close();
        console.log("Cleanup Success! Token:", Root.Token);
      } else {
        console.log("Cleanup Failure. Token:", Root.Token);
      }
    }

    const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;

    // Testing the html library
    ZeonWindow = new Win({
      title: "Zeon",
      content: '<iframe src="https://zeon.dev/">',
      pid: Root.PID,
      onclose: () => {
        onEnd();
      },
    });

    wrapper = ZeonWindow.window.querySelector(".win-content");
    wrapper.style.padding = "0px";

    return Root.Lib.setupReturns(onEnd, (m) => {
      console.log("Example received message: " + m);
    });
  },
};
