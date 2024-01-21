export default {
  name: "YouTube",
  description: "A YouTube client for Pluto.",
  ver: 1,
  type: "process",
  exec: async function (Root) {
    const Html = (await import("https://unpkg.com/@datkat21/html")).default;

    console.log("Loading VirtualFS...");
    const vfs = await Root.Lib.loadLibrary("VirtualFS");
    await vfs.importFS();

    console.log("VirtualFS loaded, checking user status");
    let userDataPath = "Registry/YTWatchData.json";

    let userData = {
      watchHistory: [],
      channelFrequency: {},
      videoFrequency: {},
    };

    if (await vfs.exists(userDataPath)) {
      console.log("Previous user");
      userData = JSON.parse(await vfs.readFile(userDataPath));
    } else {
      console.log("New user");
      await vfs.writeFile(userDataPath, JSON.stringify(userData, null, 2));
    }

    console.log("Pluto YouTube Client v1 by SkySorcerer");

    Root.Lib.setOnEnd((_) => YTWindow.close());
    const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;

    const YTWindow = new Win({
      title: "YouTube",
      content: "Loading....",
      width: 840,
      height: 480,
      pid: Root.PID,
      onclose: () => {
        Root.Lib.onEnd();
      },
    });
    let wrapper = Html.from(YTWindow.window.querySelector(".win-content"));

    async function addVideoToHistory(vidInfo) {
      if (!vidInfo) {
        return;
      }
      userData.watchHistory.push(vidInfo);

      if (vidInfo.channelTitle in userData.channelFrequency) {
        userData.channelFrequency[vidInfo.channelTitle] =
          userData.channelFrequency[vidInfo.channelTitle] + 1;
      } else {
        userData.channelFrequency[vidInfo.channelTitle] = 1;
      }

      if (vidInfo.id in userData.videoFrequency) {
        userData.videoFrequency[vidInfo.id] =
          userData.videoFrequency[vidInfo.id] + 1;
      } else {
        userData.videoFrequency[vidInfo.id] = 1;
      }

      console.log(userData);
      await vfs.writeFile(userDataPath, JSON.stringify(userData, null, 2));
    }

    function getFavoriteChannel() {
      let favoriteChannel = "";
      let maxFrequency = 0;

      for (let channel in userData.channelFrequency) {
        if (userData.channelFrequency[channel] > maxFrequency) {
          maxFrequency = userData.channelFrequency[channel];
          favoriteChannel = channel;
        }
      }

      return favoriteChannel;
    }

    console.log(getFavoriteChannel());

    function convert(input) {
      let parts = input.split(":"),
        minutes = +parts[0],
        seconds = +parts[1];
      return (minutes * 60 + seconds).toFixed(3);
    }

    let queuePoint = 0;

    function sendRequestWithQueryParams(obj, url) {
      let queryParams = Object.keys(obj)
        .map(
          (key) => encodeURIComponent(key) + "=" + encodeURIComponent(obj[key]),
        )
        .join("&");
      let fullUrl = url + "?" + queryParams;
      console.log(fullUrl);
      return fetch(fullUrl).then((response) => response.json());
    }

    let currentVideo = {};

    async function NewUserHome() {
      wrapper.clear();
      YTWindow.setTitle("YouTube - Welcome");
      let center = new Html("div").appendTo(wrapper).styleJs({
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
      });
      new Html("h1").text("YouTube on Pluto (alpha)").appendTo(center);
      new Html("p").text("Insert search term or video ID:").appendTo(center);
      let inputDiv = new Html("div")
        .appendTo(center)
        .styleJs({ display: "flex", gap: "8px" })
        .on("keydown", (e) => {
          if (e.key == "Enter") {
            SearchResults(searchInput.getValue());
          }
        });
      let searchInput = new Html("input").appendTo(inputDiv);
      new Html("button")
        .text("Search")
        .appendTo(inputDiv)
        .on("click", () => {
          SearchResults(searchInput.getValue());
        });
    }

    async function PrevUserHome() {
      wrapper.clear();
      YTWindow.setTitle("YouTube - Welcome back");
      let header = new Html("div")
        .appendTo(wrapper)
        .styleJs({ display: "flex", width: "100%", justifyContent: "center" });
      let resultInfo = new Html("h1")
        .text("YouTube (alpha)")
        .appendTo(header)
        .styleJs({ width: "90%" });
      let inputDiv = new Html("div")
        .appendTo(header)
        .styleJs({ display: "flex", gap: "8px" })
        .on("keydown", (e) => {
          if (e.key == "Enter") {
            SearchResults(searchInput.getValue());
          }
        });
      let searchInput = new Html("input").appendTo(inputDiv);
      new Html("button")
        .text("Search")
        .appendTo(inputDiv)
        .on("click", () => {
          SearchResults(searchInput.getValue());
        });
      new Html("br").appendTo(wrapper);
      new Html("br").appendTo(wrapper);
      let favoriteChannel = getFavoriteChannel();

      new Html("h1")
        .text("More content from " + favoriteChannel)
        .appendTo(wrapper);
      let loadMsg = new Html("p")
        .text("Loading content from " + favoriteChannel + "...")
        .appendTo(wrapper);

      let channel = await sendRequestWithQueryParams(
        { name: favoriteChannel },
        "https://olive.nxw.pw:8080/getChannel",
      );

      loadMsg.cleanup();
      new Html("br").appendTo(wrapper);
      let vidList = new Html("div").appendTo(wrapper).styleJs({
        display: "flex",
        overflowX: "scroll",
        overflowY: "hidden",
        gap: "12px",
        height: "60%",
      });

      channel.items.forEach((video) => {
        console.log(video);
        let listItem = new Html("div")
          .appendTo(vidList)
          .styleJs({
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            width: "260px",
            height: "190px",
          })
          .on("click", () => {
            let updatedInfo = {
              id: video.videoId,
              type: "video",
              title: video.title,
              channelTitle: video.author,
              length: {
                accessibility: {
                  accessibilityData: {
                    label: video.durationText,
                  },
                },
                simpleText: video.durationText,
              },
              isLive: false,
            };
            currentVideo["infSubset"] = updatedInfo;
            Player(updatedInfo);
          });
        new Html("img")
          .appendTo(listItem)
          .attr({ src: video.videoThumbnails[0].url })
          .styleJs({ width: "260px", height: "190px", borderRadius: "5px" });
        new Html("h3").appendTo(listItem).text(video.title);
      });
    }

    function Home() {
      if (userData.watchHistory.length == 0) {
        NewUserHome();
      } else {
        PrevUserHome();
      }
    }

    async function SearchResults(searchTerm) {
      wrapper.clear();
      YTWindow.setTitle("YouTube - Searching for " + searchTerm);
      let resultHeader = new Html("div")
        .appendTo(wrapper)
        .styleJs({ display: "flex", width: "100%", justifyContent: "center" });
      let resultInfo = new Html("h1")
        .text("Searching for " + searchTerm + "...")
        .appendTo(resultHeader)
        .styleJs({ width: "90%" });
      let backButton = new Html("button")
        .text("Back")
        .appendTo(resultHeader)
        .on("click", () => {
          Home();
        });
      let results = await sendRequestWithQueryParams(
        { term: searchTerm },
        "https://olive.nxw.pw:8080/search",
      );
      resultInfo.text(
        results.items.length + " results found for " + searchTerm,
      );
      new Html("br").appendTo(wrapper);
      let resultsContainer = new Html("div")
        .appendTo(wrapper)
        .styleJs({ display: "flex", justifyContent: "center", width: "100%" });
      let resultsList = new Html("div").appendTo(resultsContainer).styleJs({
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        width: "95%",
      });
      results.items.forEach((result) => {
        console.log(result);
        if (result.type == "video") {
          let resultItem = new Html("div")
            .appendTo(resultsList)
            .styleJs({ display: "flex", gap: "10px", alignItems: "left" })
            .on("click", () => {
              currentVideo = {};
              currentVideo["infSubset"] = result;
              Player(result, searchTerm);
            });
          let resultImg = new Html("img")
            .attr({ src: result.thumbnail.thumbnails[0].url })
            .appendTo(resultItem)
            .styleJs({ width: "160px", height: "90px", borderRadius: "5px" });
          let resultMetadata = new Html("div")
            .appendTo(resultItem)
            .styleJs({ display: "flex", flexDirection: "column" });
          let resultTitle = new Html("h3")
            .text(result.title)
            .appendTo(resultMetadata);
          let resultChannel = new Html("p")
            .text(result.channelTitle)
            .appendTo(resultMetadata);
        }
        if (result.type == "channel") {
          let resultItem = new Html("div")
            .appendTo(resultsList)
            .styleJs({ display: "flex", gap: "10px", alignItems: "left" });
          let resultImg = new Html("img")
            .attr({ src: result.thumbnail.thumbnails[0].url })
            .appendTo(resultItem)
            .styleJs({ width: "160px", height: "160px", borderRadius: "5px" });
          let resultMetadata = new Html("div")
            .appendTo(resultItem)
            .styleJs({ display: "flex", flexDirection: "column" });
          let resultTitle = new Html("h3")
            .text(result.title)
            .appendTo(resultMetadata);
          let resultChannel = new Html("p")
            .text("Channel")
            .appendTo(resultMetadata);
        }
      });
    }

    async function Player(vidInfo, prevSearch = null) {
      if (!vidInfo) {
        Home();
        return;
      }
      await addVideoToHistory(vidInfo);
      sendRequestWithQueryParams(
        { id: vidInfo.id },
        "https://olive.nxw.pw:8080/info",
      ).then((result) => {
        console.log(result);
        currentVideo = result;
        currentVideo["infSubset"] = vidInfo;
      });
      wrapper.clear();
      YTWindow.setTitle("YouTube - Player");
      let playerContainer = new Html("div")
        .attr({ id: "playerContainer-" + Root.PID })
        .appendTo(wrapper)
        .styleJs({ display: "flex", width: "100%", height: "100%" });
      let player = new Html("iframe")
        .attr({
          src: "https://www.youtube.com/embed/" + vidInfo.id + "?autoplay=1",
          allowfullscreen: "",
          id: "vidPlayer",
        })
        .appendTo(playerContainer)
        .styleJs({ width: "70%" });

      // Property doesn't work due to CORS - Requires YouTube IFrame API
      // player.on("load", () => {
      //   let currentTime = player.elm.contentWindow.getElementsByTagName('video')[0].currentTime;
      // })

      seeInfo(prevSearch);
    }

    function seeInfo(prevSearch) {
      let playerContainer = Html.qs("#playerContainer-" + Root.PID);
      let vidInfo = currentVideo.infSubset;
      let videoInfo = new Html("div")
        .attr({ id: "vidInfo-" + Root.PID })
        .appendTo(playerContainer)
        .styleJs({
          width: "30%",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          alignItems: "center",
        });
      let firstSection = new Html("div")
        .appendTo(videoInfo)
        .styleJs({ display: "flex", flexDirection: "column", width: "90%" });
      new Html("h3").appendTo(firstSection).text(vidInfo.title);
      new Html("p")
        .appendTo(firstSection)
        .text(
          vidInfo.channelTitle +
            " - " +
            vidInfo.length.accessibility.accessibilityData.label,
        );
      let secondSection = new Html("div").appendTo(videoInfo).styleJs({
        display: "flex",
        flexDirection: "column",
        width: "80%",
        alignItems: "center",
        justifyContent: "center",
      });
      new Html("button")
        .text("Read description")
        .appendTo(secondSection)
        .styleJs({ width: "100%" })
        .on("click", () => {
          if ("description" in currentVideo) {
            Root.Modal.alert(
              "Description",
              currentVideo.description,
              YTWindow.window.querySelector(".win-content"),
            );
          } else {
            Root.Modal.alert(
              "Description",
              "Video description is still loading...",
              YTWindow.window.querySelector(".win-content"),
            );
          }
        });
      new Html("button")
        .text("Share video")
        .appendTo(secondSection)
        .styleJs({ width: "100%" })
        .on("click", async () => {
          await Root.Modal.modal(
            "Share",
            "Share " +
              vidInfo.title +
              " by " +
              vidInfo.channelTitle +
              " with a link:" +
              "\n\n" +
              "https://youtu.be/" +
              vidInfo.id,
            YTWindow.window.querySelector(".win-content"),
            false,
            {
              text: "Copy link",
              type: "primary",
              callback() {
                navigator.clipboard.writeText("https://youtu.be/" + vidInfo.id);
              },
            },
            {
              text: "OK",
              callback: () => {},
            },
          );
        });
      new Html("button")
        .text("Suggested videos")
        .appendTo(secondSection)
        .styleJs({ width: "100%" })
        .on("click", () => {
          seeQueue(prevSearch);
        });
      new Html("button")
        .text("Go back")
        .appendTo(secondSection)
        .styleJs({ width: "100%" })
        .on("click", () => {
          if (prevSearch) {
            SearchResults(prevSearch);
          } else {
            Home();
          }
        });
    }

    function seeQueue(prevSearch) {
      let videoInfo = Html.qs("#vidInfo-" + Root.PID);
      videoInfo.cleanup();

      let playerContainer = Html.qs("#playerContainer-" + Root.PID);

      let videoQueueList = new Html("div")
        .attr({ id: "vidQueue-" + Root.PID })
        .appendTo(playerContainer)
        .styleJs({
          width: "30%",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          alignItems: "center",
        });

      let firstSection = new Html("div")
        .appendTo(videoQueueList)
        .styleJs({ display: "flex", flexDirection: "column", width: "90%" });

      let secondSection = new Html("div").appendTo(videoQueueList).styleJs({
        display: "flex",
        flexDirection: "column",
        width: "80%",
        height: "80%",
        overflow: "scroll",
      });

      if ("suggestion" in currentVideo) {
        let vidQueue = currentVideo.suggestion;
        console.log(vidQueue);
        new Html("h3")
          .appendTo(firstSection)
          .text("Videos similar to " + currentVideo.title);
        new Html("button")
          .text("Go back")
          .appendTo(firstSection)
          .styleJs({ width: "100%" })
          .on("click", () => {
            videoQueueList.cleanup();
            seeInfo(prevSearch);
          });
        vidQueue.forEach((result) => {
          let queueItem = new Html("div")
            .appendTo(secondSection)
            .styleJs({ display: "flex", flexDirection: "column" })
            .on("click", () => {
              currentVideo = {};
              currentVideo["infSubset"] = result;
              Player(result, prevSearch);
            });
          new Html("h3").appendTo(queueItem).text(result.title);
          new Html("p").appendTo(queueItem).text(result.channelTitle);
        });
      } else {
        new Html("h3")
          .appendTo(firstSection)
          .text("Suggestions are still loading");
        new Html("button")
          .text("Okay")
          .appendTo(firstSection)
          .styleJs({ width: "100%" })
          .on("click", () => {
            videoQueueList.cleanup();
            seeInfo(prevSearch);
          });
      }
    }

    Home();

    return Root.Lib.setupReturns((m) => {
      console.log("Client received message: " + m);
    });
  },
};
