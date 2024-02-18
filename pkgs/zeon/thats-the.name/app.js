export default {
  name: "thats-the.name",
  description: "a simple static website hosting platform.",
  ver: 1.5,
  type: "process",
  exec: async function (Root) {
    let wrapper; // Lib.html | undefined
    let MyWindow;

    console.log("Hello from example package", Root.Lib);

    Root.Lib.setOnEnd((_) => MyWindow.close());

    const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;

    MyWindow = new Win({
      title: "thats-the.name",
      content: '<iframe src="https://thats-the.name/login.html"></iframe>',
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
