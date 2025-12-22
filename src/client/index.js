import { 
  createExtensions,
  EditorView, ViewPlugin,
  languages, oneDark, oneLight,
  ChangeSet, Compartment, EditorState, toggleMinimap,
  collab, getSyncedVersion, receiveUpdates, sendableUpdates
} from "./codemirror";

import { create, Queue, Sse } from "./utils";
import { topNav, sideNav, folder } from "./elements";

import { createXterm } from "./xterm";

const mainContainer = create("div", {class: "main-container"}, mainContainer => {
  const resizer = create("a-resizerx", {}, resizer => {
          var startWidth = +localStorage["--middle-width"];

          if (isNaN(startWidth)) startWidth = 0;

          mainContainer.style.setProperty("--middle-width", startWidth + "%");

          resizer.addEventListener("resizestart", () => {
            startWidth = editorContainer.offsetWidth + 4 - mainContainer.offsetWidth / 2;
          });
          resizer.addEventListener("resize", event => {
            var newWidth = (startWidth + event.detail) * 100 / mainContainer.offsetWidth;

            if (document.body.classList.contains("preview-off")) return;

            localStorage["--middle-width"] = newWidth;
            mainContainer.style.setProperty("--middle-width", newWidth + "%");

            endCheck();
          });
        }), 
        editorPanel = create("div", {class: "editor-panel"}, editorPanel => {
          const backwardBtn = create("div", {class: "backward-btn"}),
                upwardBtn = create("div", {class: "upward-btn"}),
                forwardBtn = create("div", {class: "forward-btn"}),
                themeBtn = create("div", {class: "theme-btn"}),
                dropBtn = create("div", {class: "drop-btn"}),
                previewBtn = create("div", {class: "preview-btn"});

          backwardBtn.addEventListener("click", topNav.backward);
          forwardBtn.addEventListener("click", topNav.forward);
          upwardBtn.addEventListener("click", topNav.upward);

          themeBtn.addEventListener("click", () => {
            var isDark = document.body.classList.toggle("dark"),
                activePage = topNav.querySelector(".active");

            mainContainer.recordSetting({theme: isDark});

            if (!activePage) return;
            activePage.viewer.retheme?.(isDark);
          });
          dropBtn.addEventListener("click", () => {
            var activePage = topNav.querySelector(".active"), index;

            if (!activePage) return;

            activePage.unlink();
            activePage.closeBtn.click();
            topNav.getPage.map.delete(activePage.file);
            activePage.iframe?.externalWindow?.close();
            index = topNav.pageCache.indexOf(activePage);
            if (index !== -1) topNav.pageCache.splice(index, 1);
            activePage.dispatchEvent(new CustomEvent("deleted"));
          });
          previewBtn.addEventListener("click", () => {
            var isOff = document.body.classList.toggle("preview-off");

            mainContainer.recordSetting({preview: isOff});

            if (!isOff) {
              let activePage = topNav.querySelector(".active");

              if (setting.address) mainContainer.lock();
              endCheck();
              if (activePage) openFrame(activePage);
            } else {
              mainContainer.lockBtn.classList.remove("locked");
              iframeWrapper.innerHTML = "";
            }
          });

          mainContainer.previewBtn = previewBtn;
          mainContainer.themeBtn = themeBtn;
          mainContainer.dropBtn = dropBtn;

          editorPanel.append(previewBtn, dropBtn, themeBtn,
                             backwardBtn, upwardBtn, forwardBtn);
        }),
        editorContainer = create("div", {class: "editor-container"}),
        editorWrapper = create("div", {class: "editor-wrapper"}),
        iframePanel = create("div", {class: "iframe-panel"}, iframePanel => {
          const refreshBtn = create("div", {class: "refresh-btn"}),
                addressBar = create("input", {class: "address-bar", disabled: ""}),
                lockBtn = create("div", {class: "lock-btn"}),
                copyBtn = create("div", {class: "copy-btn"}),
                targetBtn = create("div", {class: "target-btn"});

          Object.defineProperty(mainContainer, "address", {set(value) {
            addressBar.value = value;
          }, get() {
            return addressBar.value;
          }});

          function pagepathchange(event) {
            var iframe = event.detail.iframe,
                page = event.detail;

            if (event.detail.viewer.view.src) event.detail.viewer.view.src = origin + page.path;
            else if (iframe?.classList.contains("active")) {
              mainContainer.address = origin + page.path;
              if (lockBtn.classList.contains("locked"))
                mainContainer.recordSetting({address: mainContainer.address});
            }
          }
          topNav.addEventListener("pagerenamed", pagepathchange);
          topNav.addEventListener("pagemoved", pagepathchange);

          refreshBtn.addEventListener("click", refreshFrame);
          lockBtn.addEventListener("click", () => {
            var address = addressBar.value,
                activePage = topNav.querySelector(".active");

            if (!address) {
              mainContainer.recordSetting({address: ""});
              return;
            }
            if (document.body.classList.contains("preview-off")) return;
            if (lockBtn.classList.contains("locked")) {
              let page = lockedFrame.page;

              lockBtn.classList.remove("locked");
              mainContainer.recordSetting({address: ""});
              lockedFrame = undefined;
              if (page !== activePage) openFrame(activePage);
            } else {
              lockBtn.classList.add("locked");
              mainContainer.recordSetting({address});

              if (activePage) {
                let iframe = activePage.iframe;

                if (!iframe) {
                  iframe = create("iframe", {src: address});
                  iframe.onload = loadSlot;
                  iframe.loaded = false;
                  activePage.iframe = iframe;
                  iframe.page = activePage;
                } 
                openFrame(activePage);
                lockedFrame = iframe;
              } else {
                folder.findByPath(address.replace(window.location.origin, "")).then(result => {
                  if (result) topNav.getPage(result).then(page => {
                    lockedFrame = create("iframe", {src: address});
                    page.iframe = lockedFrame;
                    lockedFrame.page = page;
                    lockedFrame.onload = loadSlot;
                    lockedFrame.loaded = false;
                    lockedFrame.classList.add("active");
                    mainContainer.startFresh();
                    iframeWrapper.append(lockedFrame);
                  }); else {
                    mainContainer.lockBtn.classList.remove("locked");           
                    mainContainer.recordSetting({address: ""});
                  }
                });
              }
            } 
          });
          mainContainer.startFresh = () => {
            refreshBtn.classList.add("refreshing");
          };
          mainContainer.endFresh = () => {
            refreshBtn.classList.remove("refreshing");
          };
          mainContainer.lock = () => {
            if (!lockBtn.classList.contains("locked")) lockBtn.click();
          };
          mainContainer.unlock = () => {
            if (lockBtn.classList.contains("locked")) lockBtn.click();
          };
          copyBtn.addEventListener("click", () => {
            var address = addressBar.value;

            if (!address) return;
            navigator.clipboard?.writeText(addressBar.value);
            copyBtn.classList.add("copied");
            setTimeout(() => copyBtn.classList.remove("copied"), 1000);
          });
          targetBtn.addEventListener("click", () => {
            var activeFrame = iframeWrapper.querySelector(".active");

            if (activeFrame) {
              let externalWindow = activeFrame.externalWindow;

              if (externalWindow) {
                if (activeFrame.externalWindow.closed) activeFrame.externalWindow = window.open(mainContainer.address);
                else externalWindow.focus();
              } else {
                activeFrame.src = "about:blank";
                activeFrame.externalWindow = window.open(mainContainer.address);
              }
            } else {
              let activePage = topNav.querySelector(".active"), url;

              if (url = activePage?.file?.path) window.open(url);
            }
          });

          mainContainer.refreshBtn = refreshBtn;
          mainContainer.targetBtn = targetBtn;
          mainContainer.lockBtn = lockBtn;

          iframePanel.append(refreshBtn, lockBtn, addressBar, copyBtn, targetBtn);
        }),
        iframeWrapper = create("div", {class: "iframe-wrapper"}),
        frameContainer = create("div", {class: "iframe-container"});

  class Plugin {
    constructor(view) {
      this.view = view;
      this.page = Plugin.page;
      this.page.plugin = this;
      this.inode = Plugin.page.inode;
      this.generation = 0;
      this.lastButTwoDone = undefined;
      this.sending = false;
      Sse.sse.addEventListener(`${this.inode}-edited`, Plugin.editedSlot);
      Sse.sse.addEventListener(`${this.inode}-saved`, Plugin.savedSlot);
    }
    update(update) {
      if (update.docChanged) {
        var dones = this.view.state.values[0].done,
        inputType = update.transactions[0].annotations?.[1]?.value,
        lastButTwoDone = dones[dones.length-2]

        if (dones[0] && !dones[0].changes) dones.shift();
        if (update.transactions[0].annotations?.[2]?.value.version) return;
        if (inputType === "undo") this.generation++;
        else {
          if (inputType === "redo") {
            this.generation--;
          } else if (this.generation < 1) {
            if (this.lastButTwoDone !== lastButTwoDone)
              this.generation--;
          } else this.generation = NaN
        }
        this.lastButTwoDone = lastButTwoDone?.changes ? lastButTwoDone : undefined;
        if (this.generation === 0) {
          if (this.page.classList.contains("unsaved")) this.page.classList.remove("unsaved");
        } else if (!this.page.classList.contains("unsaved")) this.page.classList.add("unsaved");

        this.push();
      }
    }
    push() {
      if (!this.sending) {
        this.sending = true;
        this.send();
      }
    }
    static editedSlot(message) {
      var data = message.data,
      _this = Plugin.getThis(message.type);

      let updates = JSON.parse(data).map(u => ({
        changes: ChangeSet.fromJSON(u.changes),
        clientID: u.clientID
      }));

      _this?.view.dispatch(receiveUpdates(_this.view.state, updates));
    }
    static savedSlot(message) {
      var _this = Plugin.getThis(message.type),
      page = _this.page;

      _this.generation = 0;
      if (page.classList.contains("unsaved")) page.classList.remove("unsaved");
    }
    static getThis(eventType) {
      var inode = eventType.slice(0, eventType.indexOf("-"));

      for (let page of [...topNav.children, ...topNav.pageCache]) 
        if (page.inode === inode) return page.plugin;

      return null;
    }
    async send() {
      let updates = sendableUpdates(this.view.state);
      let version = getSyncedVersion(this.view.state);
      
      if (!updates.length) return this.sending = false;
      try {
        let error = await Sse.send("send.es", {
          action: "write-file",
          inode: this.inode,
          version,
          updates: updates.map(u => ({
            clientID: u.clientID,
            changes: u.changes.toJSON()
          }))
        });
        if (error) throw error;
        else this.send();
      } catch (error) {
        detachView(this.page);
        if (!attachView(this.page)) attachEditorView(this.page);
      }
    }
    destroy() {
      Sse.sse.removeEventListener(`${this.inode}-edited`, Plugin.editedSlot);
      Sse.sse.removeEventListener(`${this.inode}-saved`, Plugin.savedSlot);
    }
  }

  function peerExtension(startVersion, page) {
    Plugin.page = page;
    return [collab({ startVersion }), ViewPlugin.fromClass(Plugin)];
  }
  function refreshFrame() {
    var activeFrame = iframeWrapper.querySelector(".active");

    if (!activeFrame) return;
    if (activeFrame.externalWindow) {
      if (activeFrame.externalWindow.closed) {
        delete activeFrame.externalWindow;
        activeFrame.src = mainContainer.address;
      } else {
        let externalWindow = activeFrame.externalWindow, location = externalWindow.location,
          address = location.origin + location.pathname;

        if (address !== mainContainer.address)
          location.replace(mainContainer.address + location.href.replace(address, ""));
        else
          externalWindow.location.reload();
        activeFrame.src = "about:blank"
      }
    } else activeFrame.src = mainContainer.address;
    mainContainer.startFresh();
  }
  function endCheck() {
    if (editorContainer.offsetWidth) {
      if (!frameContainer.offsetWidth) {
        if (!iframeWrapper.style.boxShadow) iframeWrapper.style.boxShadow = "none";
      } else {
        if (iframeWrapper.style.boxShadow) iframeWrapper.style.boxShadow = "";
        if (editorWrapper.style.boxShadow) editorWrapper.style.boxShadow = "";
      }
    } else if (frameContainer.offsetWidth)
      if (!editorWrapper.style.boxShadow) editorWrapper.style.boxShadow = "none";
  }
  function openFrame(page) {
    var iframe;

    if (lockedFrame) {
      if (!iframeWrapper.contains(lockedFrame)) {
        mainContainer.startFresh();
        lockedFrame.loaded = false;
        iframeWrapper.append(lockedFrame);
        iframeWrapper.querySelector(".active")?.classList.remove("active");
        lockedFrame.classList.add("active");
      }
      return;
    }

    if (page.viewer.matches(".view")) {
      mainContainer.address = "";
      iframeWrapper.querySelector(".active")?.classList.remove("active");
      mainContainer.endFresh();
      return;
    }

    iframe = page.iframe;
    if (!iframe) {
      iframe = create("iframe", {src: page.path});
      page.iframe = iframe;
      iframe.page = page;
      mainContainer.startFresh();
      iframe.onload = loadSlot;
    } else {
      if (!iframe.loaded) mainContainer.startFresh();
      else mainContainer.endFresh();
    }
    if (!iframeWrapper.contains(iframe)) {
      mainContainer.startFresh();
      iframe.loaded = false;
      if (document.body.classList.contains("preview-off")) return;
      iframeWrapper.append(iframe);
    }
    iframeWrapper.querySelector(".active")?.classList.remove("active");
    iframe.classList.add("active");
    iframe.contentWindow.scrollTo(iframe.scrollX, iframe.scrollY);
    mainContainer.address = window.location.origin + iframe.page.path;
  }

  function attachView(page) {
    const type = page.type, viewer = page.viewer;
    var view;

    if (type === "video") view = create("video", {src: page.path, controls: ""});
    else if (type === "audio") view = create("audio", {src: page.path, controls: ""});
    else if (type === "image") view = create("img", {src: page.path});
    else if (type === "pdf") view = create("iframe", {src: page.path});
    else if (
      type === "zip" ||
      type === "exe" ||
      type === "binary"
    ) {
      view = create("a", {href: page.path, download: ""});
      view.innerText = "Download File";
    }

    if (view) {
      if (page.viewer.view) detachView(page);
      viewer.view = view;
      viewer.classList.add("view");
      viewer.append(view);
      return true;
    } else {
      return false;
    }
  }

  async function attachEditorView(page) {
    const viewer = page.viewer;
    var view = viewer.view;

    if (view) detachView(page);
    try {
      const result = await Sse.fetch("send.es", { action: "read-file", inode: page.inode });
      const { version, doc } = result,
          extensions = createExtensions(peerExtension(version, page)),
          language = languages[page.type],
          languageConf = new Compartment,
          themeConf = new Compartment;

      if (language) extensions.push(languageConf.of(language()))
      else extensions.push(languageConf.of([]));

      if (document.body.classList.contains("dark")) {
        extensions.push(themeConf.of(oneDark));
        viewer.isDark = true;
      } else {
        extensions.push(themeConf.of(oneLight));
        viewer.isDark = false;
      }

      const state = EditorState.create({ doc, extensions });
      view  = new EditorView({ state, parent: viewer });

      viewer.retheme = isDark => {
        if (isDark) {
          viewer.isDark = true;
          view.dispatch({effects: themeConf.reconfigure(oneDark)});
          view.focus();
        } else {
          viewer.isDark = false;
          view.dispatch({effects: themeConf.reconfigure(oneLight)});
          view.focus();
        }
      };
      viewer.remode = mode => {
        let language = languages[mode];

        if (language) language = language();
        else  language = [];

        view.dispatch({
          effects: languageConf.reconfigure(language)
        });
      };
      viewer.toggleMinimap = on => {
        if (viewer.isMinimapOn === on) return;
        toggleMinimap(view, on);
        viewer.isMinimapOn = on;
      };
      if (mainContainer.setting.minimap) viewer.toggleMinimap(true);
      
      viewer.view = view;
      viewer.state = state;
      viewer.classList.add("editor");
      if (page.classList.contains("active")) openFrame(page);
      return;
    } catch (error) {
      console.log(error);
      viewer.classList.add("error");
      view = create("a");
      view.innerText = "Error! Try Again!";
      view.onclick = () => {
        page.file.connect();
        detachView(page);
        if (!attachView(page)) attachEditorView(page);
      };
      viewer.view = view;
      viewer.append(view);
      return;
    }
  }

  function detachView(page) {
    const viewer = page.viewer;
    const view = viewer.view;

    if (viewer.matches(".editor")) {
      const iframe = page.iframe;

      if (iframe) {
        delete page.iframe;
        iframe.remove();
        if (lockedFrame) {
          if (lockedFrame === iframe) {
            mainContainer.lockBtn.classList.remove("locked");
            mainContainer.address = "";            
            mainContainer.recordSetting({address: ""});
            lockedFrame = undefined;
            mainContainer.endFresh();
          }
        } else if (iframe.classList.contains("active")) {
          mainContainer.address = "";
          mainContainer.recordSetting({address: ""});
          mainContainer.endFresh();
        }
      }

      viewer.view.destroy();
      viewer.classList.remove("editor");
      delete viewer.view;
      delete viewer.state;
      delete viewer.retheme;
      delete viewer.remode;
      delete viewer.isDark;
      delete viewer.toggleMinimap;
      delete viewer.isMinimapOn;
      delete page.plugin;
      delete page.iframe;
      return;
    }
    if (viewer.matches(".view")) {
      viewer.classList.remove("view");
    } else if (viewer.matches(".error")) {
      viewer.classList.remove("error");
    }

    view.remove();
  }

  const getViewer = Queue.cacheCall((page, resolve) => {
    var viewer = create("div");

    page.viewer = viewer;

    if (!attachView(page)) attachEditorView(page);
    resolve(viewer);
    
    page.addEventListener("retyped", retypeSlot);
    page.addEventListener("deleted", deleteSlot);
  });

  function retypeSlot() {
    const viewer = this.viewer;

    if (!viewer) return;

    if (!attachView(this)) {
      if (viewer.matches(".editor")) {
        viewer.remode(this.type);
      } else {
        attachEditorView(this);
      }
    }
  }

  function deleteSlot() {
    var iframe = this.iframe;

    if (this.plugin) this.viewer.view.destroy();
    this.viewer.remove();

    getViewer.map.delete(this);

    if (iframe) {
      if (lockedFrame === iframe) {
        mainContainer.unlock();
      } else {
        iframe.remove();
      }
    }
    if (!iframeWrapper.firstElementChild && lockedFrame) {
      lockedFrame = undefined;
      mainContainer.address = "";
      mainContainer.endFresh();
    }
  }

  function loadSlot() {
    var scrollX = this.scrollX || 0,
        scrollY = this.scrollY || 0,
        contentWindow = this.contentWindow;

    this.loaded = true;

    if (this.externalWindow) {
      let closeButton = document.createElement("div");

      closeButton.style.cssText = "float:right; width: 20px; cursor: pointer;";
      closeButton.innerText = "⇱";
      closeButton.onclick = () => {
        this.externalWindow.close();
        delete this.externalWindow;
        this.src = mainContainer.address;
      };
      contentWindow.document.body.append(closeButton);
    }

    contentWindow.addEventListener("keydown", keydownSlot);
    contentWindow.addEventListener("scroll", scrollSlot);
    contentWindow.scrollTo(scrollX, scrollY);
    mainContainer.endFresh();
  }

  function keydownSlot(event) {
    var key = event.key?.toLowerCase();
    
    if (event.ctrlKey || event.metaKey)
      if (key === "s" || key === "r" || key === "e" || key === "d") event.preventDefault();
  }

  function scrollSlot() {
    var iframe = this.frameElement;
    
    if (iframe.scrollHeight === 0) return;
    iframe.scrollX = this.scrollX;
    iframe.scrollY = this.scrollY;
  }

  topNav.addEventListener("pageopened", event => {
    var page = event.detail, type = page.type;

    getViewer(page).then(viewer => {
      if (!editorWrapper.contains(viewer)) editorWrapper.append(viewer);

      if (
        type === "video" || 
        type === "audio" ||
        type === "image" ||
        type === "pdf" ||
        type === "zip" ||
        type === "exe" ||
        type === "binary"
      ) {
        editorWrapper.querySelector(".active")?.classList.remove("active");
        viewer.classList.add("active");
      } else if (viewer.classList.contains("error")) {
        editorWrapper.querySelector(".active")?.classList.remove("active");
        viewer.classList.add("active");
      } else {
        if (document.body.classList.contains("dark")) {
          if (!viewer.isDark) viewer.retheme?.(true);
        } else {
          if (viewer.isDark) viewer.retheme?.(false);
        }
        if (mainContainer.setting.minimap) viewer.toggleMinimap?.(true);
        else viewer.toggleMinimap?.(false);

        var preViewer = editorWrapper.querySelector(".active");

        if (preViewer && preViewer !== viewer) {
          let view = preViewer.view;

          if (view?.scrollDOM) {
            view._savedScrollTop = view.scrollDOM.scrollTop;
            view._savedScrollLeft = view.scrollDOM.scrollLeft;
          }
          preViewer.classList.remove("active");
        }

        viewer.classList.add("active");
        
        let view = viewer.view;

        if (view?.scrollDOM) {
          if (!sideNav.contains(document.activeElement)) setTimeout(() => view.focus());
          view.scrollDOM.scrollTop = view._savedScrollTop;
          view.scrollDOM.scrollLeft = view._savedScrollLeft;
        }
      }
      if (document.body.classList.contains("preview-off")) return;

      openFrame(page);
    });
  });
  topNav.addEventListener("pagesaved", event => {
    var page = event.detail, iframe;

    if (!page.plugin) return;
    if (page.type === "cpp" || page.type === "c") {
      let fileToCompile = page.path.slice(1);

      for (let fItem of page.file.parentNode.parentNode.body.children) {
        if (fItem.name.toLowerCase() === "main." + page.type) {
          fileToCompile = fItem.name;
          break;
        }
      }
      if (page.type === "cpp") termContainer.xterm?.exec(`g++ ${fileToCompile}`);
      else if (page.type === "c") termContainer.xterm?.exec(`gcc ${fileToCompile}`);
    } else if (page.type === "h") {
      let subFolder = page.file.parentNode.parentNode;

      outer: while (folder.contains(subFolder)) {
        for (let fItem of subFolder.body.children) {
          let filename = fItem.name.toLowerCase()
          if (filename === "main.cpp") {
            termContainer.xterm?.exec(`g++ ${fItem.path.replace(/[^/]*$/, fItem.name).slice(1)}`);
            break outer;
          } else if (filename === "main.c") {
            termContainer.xterm?.exec(`gcc ${fItem.path.replace(/[^/]*$/, fItem.name).slice(1)}`);
            break outer;
          }
        }
        subFolder = subFolder.parentNode.parentNode;
      }
    }
    if (document.body.classList.contains("preview-off")) return;
    if (lockedFrame) {
      refreshFrame();
    } else {
      iframe = page.iframe;
      if (iframe.externalWindow) {
        if (iframe.externalWindow.closed) {
          delete iframe.externalWindow;
          iframe.src = mainContainer.address;
        } else {
          let externalWindow = iframe.externalWindow, location = externalWindow.location,
              address = location.origin + location.pathname;

          if (address !== mainContainer.address)
            location.replace(mainContainer.address + location.href.replace(address, ""));
          else
            externalWindow.location.reload();
          iframe.src = "about:blank";
        }
      } else iframe.src = mainContainer.address;
      iframe.loaded = false;
      mainContainer.startFresh();
    }
  });
  topNav.addEventListener("pageclosed", event => {
    var page = event.detail,
        viewer = page.viewer,
        iframe = page.iframe;

    if (viewer) {
      let view = viewer.view;

      if (view?.scrollDOM) {
        view._savedScrollTop = view.scrollDOM.scrollTop;
        view._savedScrollLeft = view.scrollDOM.scrollLeft;
      }
      viewer.remove();
    }
    if (iframe && iframe !== lockedFrame) iframe.remove();
    if (!topNav.firstElementChild) {
      if (lockedFrame) {
        lockedFrame.remove();
        lockedFrame = undefined;
      }
      mainContainer.lockBtn.classList.remove("locked");
      mainContainer.address = "";
      mainContainer.endFresh();
      mainContainer.recordSetting({address: ""});
    }
  });
  topNav.addEventListener("pagedeleted", event => {
    if (!topNav.firstElementChild) {
      if (lockedFrame) {
        lockedFrame.remove();
        lockedFrame = undefined;
      }
      mainContainer.lockBtn.classList.remove("locked");
      mainContainer.address = "";
      mainContainer.endFresh();
      mainContainer.recordSetting({address: ""});
    }
  });

  let setting, lockedFrame;

  mainContainer.recordSetting = ({theme, preview, address, minimap} = {}) => {
    setting.theme = theme ?? setting.theme;
    setting.preview = preview ?? setting.preview;
    setting.address = address ?? setting.address;
    setting.minimap = minimap ?? setting.minimap;

    localStorage["--ap-setting"] = JSON.stringify(setting);
  };
  try {
    let address;

    setting = JSON.parse(localStorage["--ap-setting"]);
    address = setting.address;

    if (setting.theme) document.body.classList.add("dark");
    if (setting.preview) document.body.classList.add("preview-off");
    if (address) {
      mainContainer.address = address;
      mainContainer.lock();
    }
  } catch (error) {
    setting = {
      theme: true,
      preview: true,
      address: "",
      minimap: false
    }
    document.body.classList.add("dark");
    document.body.classList.add("preview-off");
  }
  mainContainer.setting = setting;

  editorContainer.append(editorPanel, editorWrapper);
  frameContainer.append(iframePanel, iframeWrapper);
  mainContainer.append(editorContainer, resizer, frameContainer);
  document.body.append(mainContainer);
  endCheck();

  window.addEventListener("unload", event => {
    for (let page of topNav.getPage.map.values())
      page.iframe?.externalWindow?.close();
  });
});
const termContainer = create("div", {class: "term-container"}, termContainer => {
  var xterm;
  var resizer = create("a-resizery", {}, resizer => {
    var startHeight = +localStorage["--bottom-height"];

    if (startHeight < 0) {
      startHeight = -startHeight;
      document.body.classList.add("terminal-off");
    } else if (isNaN(startHeight) || startHeight < 8) {
      startHeight = 0;
      document.body.classList.add("terminal-off");
    } else {
      xterm = createXterm();
      termContainer.xterm = xterm;
      termContainer.append(xterm);
    }

    document.body.style.setProperty("--bottom-height", startHeight + "px");

    resizer.addEventListener("resizestart", () => {
      if (document.body.classList.contains("terminal-off")) startHeight = 0
      else startHeight = Number.parseFloat(document.body.style.getPropertyValue("--bottom-height"));
    });
    resizer.addEventListener("resize", event => {
      var newHeight = startHeight - event.detail;

      if (newHeight < 8) {
        if (newHeight < 0) newHeight = 0;
        else newHeight = 8;
      } else if (newHeight > 600) newHeight = 600;

      if (!newHeight) {
        if (!document.body.classList.contains("terminal-off"))
          document.body.classList.add("terminal-off");
      } else if (document.body.classList.contains("terminal-off"))
        document.body.classList.remove("terminal-off");

      document.body.style.setProperty("--bottom-height", newHeight + "px");
      localStorage["--bottom-height"] = newHeight;
      xterm?.fit();
    });
    sideNav.addEventListener("resize", () => {
      xterm?.fit();
    });
    sideNav.addEventListener("transitionend", event => {
      if (event.propertyName === "left") xterm?.fit();
    });
    resizer.addEventListener("resizeend", () => {
      if (document.body.classList.contains("terminal-off")) {
        if (termContainer.contains(xterm)) {
          xterm.dispose();
          xterm = null;
          termContainer.xterm = null;
        }
      } else if (!termContainer.contains(xterm)) {
        xterm = createXterm();
        termContainer.xterm = xterm;
        termContainer.append(xterm);
      }
    });
  });

  termContainer.toggle = () => {
    if (document.body.classList.contains("terminal-off")) {
      var newHeight = -localStorage["--bottom-height"];
      
      if (newHeight === 0 || isNaN(newHeight)) {
        newHeight = 125;
        document.body.style.setProperty("--bottom-height", newHeight + "px");
      }
      xterm = createXterm();
      termContainer.xterm = xterm;
      termContainer.append(xterm);
      document.body.classList.remove("terminal-off");
      localStorage["--bottom-height"] = newHeight;
      termContainer.xterm.terminal.focus();
    } else {
      xterm.dispose();
      xterm = null;
      termContainer.xterm = null;
      document.body.classList.add("terminal-off");
      localStorage["--bottom-height"] = -localStorage["--bottom-height"];
    }
  };

  termContainer.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && (event.key === "`" || event.code === "Backquote")) {
      termContainer.toggle();
    }
  });

  Sse.reconnects.add(() => {
    if (xterm) {
      xterm.dispose();
      xterm = createXterm();
      termContainer.xterm = xterm;
      termContainer.append(xterm);
    }
  });

  termContainer.run = activePage => {
    var type = activePage?.type;
  
    if (type === "c" || type === "cpp" || type === "h") {
      termContainer.xterm?.exec("./" + C_FILE);
    } else if (type === "python") {
      termContainer.xterm?.exec(`${PYTHON} ${activePage.path.slice(1)}`);
    } else if (type === "java") {
      let subFolder = activePage.file.parentNode.parentNode;

      while (folder.contains(subFolder)) {
        for (let fItem of subFolder.body.children) {
          if (fItem.name.toLowerCase() === "main.java") {
            termContainer.xterm?.exec(`java ${fItem.path.replace(/[^/]*$/, fItem.name).slice(1)}`);
            return;
          }
        }
        subFolder = subFolder.parentNode.parentNode;
      }
      termContainer.xterm?.exec(`java ${activePage.path.slice(1)}`);
    } else if (type === "typescript") {
      termContainer.xterm?.exec(`tsc ${activePage.path.slice(1)} --target es2015`);
    }
  }

  termContainer.xterm = xterm;

  termContainer.prepend(resizer);

  document.body.append(termContainer);
});

window.addEventListener("keydown", event => {
  var key = event.key?.toLowerCase(), activePage = topNav.querySelector(".active"),
  type = activePage?.type;

  if (termContainer.xterm?.contains(event.target)) return;

  if (event.ctrlKey || event.metaKey) {
    if (key === "s") {
      event.preventDefault();
      if (activePage) activePage.save();
    } else if (key === "o") {
      event.preventDefault();
      mainContainer.targetBtn.click();
    } else if (key === "tab") {
      event.preventDefault();
      if (event.shiftKey) topNav.backward();
      else topNav.forward();
    } else if (key === "arrowup") {
      topNav.forward();
    } else if (key === "arrowdown") {
      topNav.backward();
    } else if (event.shiftKey && (key === "t" || key === "h")) {
      event.preventDefault();
      topNav.upward();
    } else if (key === "w" || key === "h") {
      event.preventDefault();
      topNav.downward();
    } else if (key === "r") {
      event.preventDefault();
      mainContainer.refreshBtn.click();
      termContainer.run(activePage);
    } else if (key === "enter") {
      if (event.shiftKey) return;
      if (activePage) activePage.save();
      if (
        type === "h" ||
        type === "c" || 
        type === "cpp" ||
        type === "python" ||
        type === "java" ||
        type === "typescript"
      ) topNav.addEventListener("pagesaved", () => termContainer.run(activePage), {once: true});
    } else if (key === "q") {
      event.preventDefault();
      if (
        type === "h" ||
        type === "c" || 
        type === "cpp" ||
        type === "python" ||
        type === "java"
      ) termContainer.xterm?.quit();
    } else if (key === "e") {
      event.preventDefault();
      if (type === "html") return console.clear();
      if (type === "javascript") {
        let arr = activePage.name.split(".");

        if (arr[arr.length - 1].toLowerCase() === "js") return console.clear();
      }
      if (
        type === "h" ||
        type === "c" || 
        type === "cpp" ||
        type === "python" ||
        type === "java" ||
        type === "typescript"
      ) termContainer.xterm?.clear();
    } else if (key === "m") {
      event.preventDefault();
      mainContainer.recordSetting({minimap: !mainContainer.setting.minimap});
      activePage?.viewer.toggleMinimap?.(mainContainer.setting.minimap);
    } else if (key === "b") {
      event.preventDefault();
      sideNav.querySelector(".nav-toggle").click();
    } else if (!isNaN(key)) {
      topNav.openPage(topNav.children[key - 1]);
    } else if (key === "p") {
      event.preventDefault();
      mainContainer.previewBtn.click();
    } else if (key === "`" || event.code === "Backquote") {
      event.preventDefault();
      if (termContainer.xterm && !termContainer.xterm.contains(document.activeElement)) {
        termContainer.xterm.terminal.focus();
      } else termContainer.toggle();
    } else if (key === "j") {
      event.preventDefault();
      mainContainer.themeBtn.click();
    } else if (key === "k") {
      event.preventDefault();
      mainContainer.dropBtn.click();
    } else if (key === "l") {
      event.preventDefault();
      mainContainer.lockBtn.click();
    } else if (key === "n") {
      event.preventDefault();
      if (event.shiftKey) sideNav.createFolder();
      else sideNav.createFile();
    }
  }
}, true);
window.addEventListener("keydown", event => {
  var key = event.key?.toLowerCase();

  if (event.ctrlKey || event.metaKey)
    if (key === "d") {
      event.preventDefault();
      if (!mainContainer.contains(document.activeElement))
        sideNav.deleteFiles();
    }
});
window.addEventListener("resize", event => {
  termContainer.xterm?.fit();
});