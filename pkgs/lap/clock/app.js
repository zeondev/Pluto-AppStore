export default {
  name: "Clock",
  description: "A basic clock app for Pluto",
  ver: 1.3, // Compatible with core v1.3
  type: "process",
  exec: async function (Root) {
    let wrapper;
    let ClockWindow;
    let clockInterval


    Root.Lib.setOnEnd((_) => {ClockWindow.close(); clearInterval(clockInterval)});

    const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;

    const Html = Root.Lib.html

    // Testing the html library
    ClockWindow = new Win({
      title: "Clock",
      content: '',
      pid: Root.PID,
      onclose: () => {
        Root.Lib.onEnd();
      },
    });

    wrapper = ClockWindow.window.querySelector(".win-content");
    wrapper.style.padding = "0px";
    
    wrapper.classList.add("col", "fc")
    
    let pastMinute
    
    function fetchTime() {
      let x = new Date();
      let hours = x.getHours().toString().padStart(2, "0");
      let minutes = x.getMinutes().toString().padStart(2, "0");
      let timeString = `${hours}:${minutes}`;
      return timeString
    }
    
    let clockSpan = new Html("span").style({"font-size": "96px"}).text(fetchTime()).appendTo(wrapper)
    
    clockInterval = setInterval(() => {clockSpan.text(fetchTime())}, 1000)
    
    
    return Root.Lib.setupReturns((m) => {
      console.log("Example received message: " + m);
    });
  },
};
