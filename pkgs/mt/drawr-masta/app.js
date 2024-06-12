export default {
  name: "Drawr Masta",
  description: "Draw whatever you want and send it off (Terrible Game)",
  ver: 1.3, // Compatible with core v1.3
  type: "process",
  exec: async function (Root) {
    let wrapper;
    let DMWindow;

    console.log("quick gaem test");

    Root.Lib.setOnEnd((_) => DMWindow.close());

    const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;

    // Testing the html library
    DMWindow = new Win({
      title: "Drawr Masta",
      content: '<iframe src="https://mt.thats-the.name/games/drawr-masta/index.html">',
      pid: Root.PID,
      width: 640,
      height: 480,
      onclose: () => {
        Root.Lib.onEnd();
      },
    });

    wrapper = DMWindow.window.querySelector(".win-content");
    wrapper.style.padding = "0px";

    return Root.Lib.setupReturns((m) => {
      console.log("Example received message: " + m);
    });
  },
};
