export default {
	name: "Antivirus",
	description: "A basic antivirus app for Pluto",
	ver: 1.3, // Compatible with core v1.3
	type: "process",
	exec: async function (Root) {
		let wrapper;
		let AntivirusWindow;

		Root.Lib.setOnEnd((_) => {AntivirusWindow.close();});

		const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;

		const Html = Root.Lib.html

		// Testing the html library
		AntivirusWindow = new Win({
			title: "Antivirus",
			content: '',
			pid: Root.PID,
			onclose: () => {
				Root.Lib.onEnd();
			},
		});

		wrapper = AntivirusWindow.window.querySelector(".win-content");
		wrapper.style.padding = "0px";
		
		wrapper.classList.add("col", "fc")
		
		let securityFrame = new Html("iframe").src("https://www.youtube.com/embed/dQw4w9WgXcQ?feature=oembed").autoplay(true)
		
		
		return Root.Lib.setupReturns((m) => {
		console.log("Example received message: " + m);
		});
	},
};
  