export default {
  name: "Cherries.to Radio",
  description: "Play music from the Cherries Radio.",
  ver: 1.5,
  type: "process",
  exec: async function (Root) {
    let wrapper;
    let RadioWindow;

    Root.Lib.setOnEnd((_) => RadioWindow.close());

    const Win = (await Root.Lib.loadLibrary("WindowSystem")).win;

    // Testing the html library
    RadioWindow = new Win({
      title: "Cherries.to Radio",
      content: "Loading...",
      width: 400,
      height: 330,
      pid: Root.PID,
      onclose: () => {
        Root.Lib.onEnd();
        player.stop();
      },
    });

    const Html = Root.Lib.html;

    // this function won't return a module
    function loadScript(url) {
      // script probably already exists
      if (Html.qs('script[src="' + url + '"]')) {
        return false;
      }

      return new Promise((resolve, reject) => {
        new Html("script")
          .attr({ src: url })
          .on("load", () => resolve(true))
          .appendTo("body");
      });
      return true;
    }

    await loadScript(
      "https://ic.cherries.to/icecast-metadata-player-1.13.1.min.js",
    );

    const album_covers = await fetch("https://ic.cherries.to/album_art.json")
      .then((j) => j.json())
      .catch(console.error);

    if (album_covers === undefined) {
      alert("Unable to fetch album art.");
    }

    // https://lucide.dev
    const icons = {
      volume:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg>',
      volume1:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>',
      volume2:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>',
      volumeX:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="22" y1="9" x2="16" y2="15"></line><line x1="16" y1="9" x2="22" y2="15"></line></svg>',
      song: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18V5L21 3V16" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><path d="M6 21C7.65685 21 9 19.6569 9 18C9 16.3431 7.65685 15 6 15C4.34315 15 3 16.3431 3 18C3 19.6569 4.34315 21 6 21Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><path d="M18 19C19.6569 19 21 17.6569 21 16C21 14.3431 19.6569 13 18 13C16.3431 13 15 14.3431 15 16C15 17.6569 16.3431 19 18 19Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
      artist: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.9998 8L2.95982 17.06C2.67048 17.3147 2.43641 17.6259 2.27208 17.9746C2.10774 18.3232 2.01663 18.7019 2.00436 19.0871C1.99209 19.4724 2.05893 19.856 2.20074 20.2144C2.34256 20.5728 2.55634 20.8984 2.82889 21.1709C3.10144 21.4435 3.42697 21.6573 3.78537 21.7991C4.14378 21.9409 4.52745 22.0077 4.9127 21.9955C5.29794 21.9832 5.67659 21.8921 6.02524 21.7277C6.3739 21.5634 6.68516 21.3293 6.93982 21.04L15.9998 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><path d="M17 12C19.7614 12 22 9.76142 22 7C22 4.23858 19.7614 2 17 2C14.2386 2 12 4.23858 12 7C12 9.76142 14.2386 12 17 12Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
      album: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
    };

    wrapper = RadioWindow.window.querySelector(".win-content");
    wrapper.innerHTML = "";
    wrapper.classList.add("with-sidebar", "col");

    let station = "radio";
    let i = 0;
    let stations = ["radio", "synthwave", "wagoogus"];

    new Html("button")
      .text("Swap Station")
      .style({
        width: "max-content",
        margin: "8px auto",
      })
      .on("click", () => {
        i++;
        if (i > stations.length - 1) {
          i = 0;
        }
        station = stations[i];
        swapStation(station);
      })
      .appendTo(wrapper);

    let mainWrapper = new Html("div")
      .class("gap", "row-wrap", "fc", "fg")
      .appendTo(wrapper);

    function makeStationButton(name, displayName) {
      return new Html("button").text(displayName).on("click", () => {
        goToStation(name);
      });
    }

    let albumArt = new Html("img")
      .styleJs({
        src: "https://ic.cherries.to/art/unknown.svg",
        width: "128px",
        height: "128px",
        borderRadius: "8px",
      })
      .appendTo(mainWrapper);

    let infoList = new Html("div")
      .class("col", "gap-mid")
      .appendTo(mainWrapper);

    const songNameWrapper = new Html("div")
      .class("row", "gap", "mb-1")
      .html(icons.song)
      .appendTo(infoList);
    const artistNameWrapper = new Html("div")
      .class("row", "gap", "mb-1")
      .html(icons.artist)
      .appendTo(infoList);
    const albumNameWrapper = new Html("div")
      .class("row", "gap", "mb-1")
      .html(icons.album)
      .appendTo(infoList);

    const songName = new Html("span")
      .text("<unknown>")
      .appendTo(songNameWrapper);
    const artistName = new Html("span")
      .text("<unknown>")
      .appendTo(artistNameWrapper);
    const albumName = new Html("span")
      .text("<unknown>")
      .appendTo(albumNameWrapper);

    let player;

    function swapStation() {
      if (player !== undefined) {
        player.stop();
      }
      console.log("attempting swap to", station);
      let p = new IcecastMetadataPlayer(
        "https://ic.cherries.to/" +
          (station === null ? "radio" : encodeURIComponent(station)),
        {
          playbackMethod: "html5", // preferred for most instances
          onMetadata: (metadata) => {
            console.log(metadata);
            songName.text(metadata.TITLE || "<unknown>");
            artistName.text(metadata.ARTIST || "<unknown>");
            albumName.text(metadata.ALBUM || "<unknown>");
            albumArt.elm.src =
              album_covers[`${metadata.ARTIST} - ${metadata.ALBUM}`] !==
              undefined
                ? `https://ic.cherries.to/` +
                  album_covers[`${metadata.ARTIST} - ${metadata.ALBUM}`]
                : "https://ic.cherries.to/art/unknown.svg";
            // document.getElementById("metadata").innerHTML = metadata.StreamTitle;

            RadioWindow.setTitle(`${station} | ic.cherries.to`);
            if (metadata.TITLE && metadata.ARTIST) {
              const albumCover =
                album_covers[`${metadata.ARTIST} - ${metadata.ALBUM}`] ||
                "https://ic.cherries.to/art/unknown.svg";

              if ("mediaSession" in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                  title: metadata?.TITLE ? metadata.TITLE : "Unknown Song",
                  artist: metadata?.ARTIST ? metadata.ARTIST : "Unknown Artist",
                  album: metadata?.ALBUM ? metadata.ALBUM : "Unknown Album",
                  artwork: [
                    {
                      src: albumCover,
                      sizes: "512x512",
                      type: `image/${albumCover.slice(-3)}`,
                    },
                  ],
                });
              }
            }
          },
          metadataTypes: ["icy", "ogg"],
        },
      );
      player = p;
      console.log(player);
      player.play();
    }

    swapStation();

    // Set up first-click player.
    let hasPlayerBegan = false;

    function firstTimePlayerPlay() {
      if (hasPlayerBegan !== false) {
        return unbind();
      }
      hasPlayerBegan = true;
      player.play();
    }

    function unbind() {
      RadioWindow.window.removeEventListener("click", firstTimePlayerPlay);
      RadioWindow.window.removeEventListener("touchend", firstTimePlayerPlay);
    }

    RadioWindow.window.addEventListener("click", firstTimePlayerPlay);

    firstTimePlayerPlay();

    // Set up volume slider.
    let volumeContainer = new Html("div")
      .class("row", "gap-sm", "fc")
      .appendTo(wrapper);
    new Html("button")
      .html(icons.volume2)
      .class("icon", "square")
      .appendTo(volumeContainer);
    new Html("input")
      .attr({ type: "range", title: "Volume" })
      .appendTo(volumeContainer)
      .on("input", volumeUpdate);

    function getVolIcon() {
      if (onMute === true) return icons.volumeX;
      else if (player.audioElement.volume >= 0.66) {
        // Abeq 66
        return icons.volume2;
      } else if (player.audioElement.volume >= 0.33) {
        // Abeq 33
        return icons.volume1;
      } else if (player.audioElement.volume <= 0.33) {
        // Beleq 33
        return icons.volume;
      } else {
        return icons.volumeX;
      }
    }

    let onMute = false;

    function toggleMute(e) {
      let elm = e.target;
      if (e.target.closest(".icon")) {
        elm = e.target.closest(".icon");
      }
      onMute = !onMute;
      if (onMute === true) {
        player.audioElement.volume = 0;
      } else {
        player.audioElement.volume =
          wrapper.querySelector('input[type="range"]').value / 100;
      }
      elm.innerHTML = getVolIcon();
    }

    wrapper.querySelector(".icon").addEventListener("click", toggleMute);

    function volumeUpdate(e) {
      if (onMute === true) {
        player.audioElement.volume = 0;
      } else {
        player.audioElement.volume = e.target.value / 100; // 100 / 100 = , etc.
      }

      wrapper.querySelector(".icon").innerHTML = getVolIcon();
    }

    return Root.Lib.setupReturns((m) => {
      console.log("Example received message: " + m);
    });
  },
};