export default {
  name: "Screen Recorder",
  description: "Record your screen on Pluto's lightweight screen recorder.",
  ver: 1, // Compatible with core v1
  type: "process",
  privileges: [
    {
      privilege: "processList",
      description: "Required for Helper AI integration",
    },
  ],
  exec: async function (Root) {
    let wrapper; // Lib.html | undefined
    let MyWindow;

    const Html = (await import("https://unpkg.com/@datkat21/html")).default;
    const Notify = await Root.Lib.loadLibrary("Notify");

    console.log("Loading VirtualFS...");
    const vfs = await Root.Lib.loadLibrary("VirtualFS");
    await vfs.importFS();

    console.log("Pluto Screen Recorder v1 by SkySorcerer");

    Root.Lib.setOnEnd((_) => MyWindow.close());

    const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;

    // Create a window
    MyWindow = new Win({
      title: "Screen Recorder",
      content: "",
      width: 854,
      height: 480,
      pid: Root.PID,
      onclose: () => {
        Root.Lib.onEnd();
      },
    });

    let currentStream;
    let mediaRecorder;
    let videoPreview;
    let mimeType = "video/mp4";
    let recordState = "stopped";

    async function helperIntegrate(pid) {
      const helperInfPath = "Registry/helperInfo";
      let integrationPayload = {
        name: "Screen Recorder",
        description:
          "An integration that lets Helper start and stop recording your screen.",
        pid: Root.PID,
        id: "rec",
        packageName: "tranch--recorder.app",
        functions: [
          {
            name: "recorderStartRecording",
            description: "Start recording the screen.",
          },
          {
            name: "recorderStopRecording",
            description: "Stop recording the screen.",
          },
        ],
      };
      let helperInfo = JSON.parse(await vfs.readFile(helperInfPath));
      if (!helperInfo.open) {
        Root.Modal.alert(
          "Integration failed",
          "Helper AI is closed. To add YouTube as an integration, please open Helper AI.",
          YTWindow.window.querySelector(".win-content")
        );
        return;
      }
      Root.Core.processList[pid].proc.send({
        type: "integration",
        content: integrationPayload,
      });
    }

    let integrationListener = setInterval(async () => {
      const helperInfPath = "Registry/helperInfo";
      const helperInfExists = await vfs.exists(helperInfPath);

      if (helperInfExists) {
        let helperInfo = JSON.parse(await vfs.readFile(helperInfPath));
        if (helperInfo.open) {
          console.log("Helper Process ID:" + helperInfo.pid);
          clearInterval(integrationListener);
          helperIntegrate(helperInfo.pid);
        }
      }
    }, 1000);

    async function recordScreen() {
      return await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          frameRate: 60,
        },
        audio: {
          autoGainControl: false,
          channelCount: 2,
          echoCancellation: false,
          latency: 0,
          noiseSuppression: false,
          sampleRate: 48000,
          sampleSize: 16,
          volume: 1.0,
        },
      });
    }

    function createRecorder(stream, mimeType) {
      // the stream data is stored in this array
      let recordedChunks = [];

      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = function (e) {
        if (e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };
      mediaRecorder.onstop = function () {
        saveFile(recordedChunks);
        recordedChunks = [];
      };
      mediaRecorder.start(200); // For every 200ms the stream data will be stored in a separate chunk.
      return mediaRecorder;
    }

    async function saveFile(recordedChunks) {
      const blob = new Blob(recordedChunks, {
        type: mimeType,
      });

      let fileName =
        "Recordings/" +
        new Date().toLocaleString().split("/").join("-") +
        ".mp4";

      const filePath = `${Root.Lib.randomString()}-${fileName}`;

      await window["localforag" + "e"].setItem(filePath, blob);

      await vfs.writeFile(`Root/${fileName}`, `vfsImport:${filePath}`);
      Notify.show("Screen Recorder", `Recording saved as ${fileName}`);
    }

    wrapper = Html.from(MyWindow.window.querySelector(".win-content"));
    wrapper.styleJs({
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    });

    videoPreview = new Html("video")
      .appendTo(wrapper)
      .styleJs({ width: "80%", height: "80%", borderRadius: "5px" });

    new Html("br").appendTo(wrapper);

    let buttons = new Html("div").appendTo(wrapper).styleJs({
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    });

    async function startRecording() {
      currentStream = await recordScreen();
      mediaRecorder = createRecorder(currentStream, mimeType);
      videoPreview.elm.srcObject = currentStream;
      videoPreview.elm.muted = true;
      videoPreview.elm.play();
      recordState = "recording";
    }

    async function stopRecording() {
      mediaRecorder.stop();
      currentStream.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      recordState = "stopped";
    }

    let startButton = new Html("button")
      .text("Start")
      .appendTo(buttons)
      .on("click", async () => {
        if (recordState == "recording") {
          return;
        }
        startRecording();
      });
    let stopButton = new Html("button")
      .text("Stop")
      .appendTo(buttons)
      .on("click", async () => {
        if (recordState == "stopped") {
          return;
        }
        stopRecording();
      });
    return Root.Lib.setupReturns(async (m) => {
      console.log("Example received message: ", m);
      if (m.type == "recorderStartRecording") {
        if (recordState == "recording") {
          Root.Core.processList[m.pid].proc.send({
            type: "function",
            content: "Recording already started",
          });
        }
        await startRecording();
        Root.Core.processList[m.pid].proc.send({
          type: "update",
          title: "Screen Recorder",
          content: "Recording started",
        });
        Root.Core.processList[m.pid].proc.send({
          type: "function",
          content: "Recording started",
        });
      }
      if (m.type == "recorderStopRecording") {
        if (recordState == "stopped") {
          Root.Core.processList[m.pid].proc.send({
            type: "function",
            content: "Recording already stopped",
          });
        }
        await stopRecording();
        Root.Core.processList[m.pid].proc.send({
          type: "update",
          title: "Screen Recorder",
          content: "Recording stopped",
        });
        Root.Core.processList[m.pid].proc.send({
          type: "function",
          content: "Recording stopped",
        });
      }
    });
  },
};
