import { create, Queue, Sse } from "../utils";
import { uploader } from "./uploader";
import { dialog } from "./dialog";
import "./widgets";

class Folder extends HTMLElement {
  connectedCallback() {
    if (this.classList.contains("collect")) {
      this.classList.remove("copy");
      this.classList.remove("cut");
      this.classList.remove("collect");
    }

    if (this.rendered) return;

    this.addEventListener("focusin", Folder.focusinSlot);
    this.addEventListener("focusout", Folder.focusoutSlot);

    this.classList.add("loading");
    this.append(this.head);
    this.rendered = true;
    this.dispatchEvent(new CustomEvent("render"));
  }
  rendered = false;
  loaded = false;
  initiated = false;
  setted = false;
  opened = false;
  head = create("div", {class: "dir-head", tabindex: "-1"}, dirHead => {
    dirHead.addEventListener("keydown", Folder.keydownSlot);
    dirHead.addEventListener("blur", Folder.blurSlot);
  });
  body = create("div", {class: "dir-body"}, dirBody => {
    dirBody.addEventListener("transitionend", Folder.transitionEndSlot);
  });
  setup() {
    Sse.fetch("send.es", {
      action: "read-dir",
      path: this.path
    }).then(response => {
      for (let {name, inode, type} of response.body) {
        if (type === "directory") {
          let folder = sideNav.querySelector(`a-folder[inode="${inode}"]`);

          if (folder) {
            this.body.append(folder);
            if (folder.name !== name) {
              folder.name = name;
              folder.head.innerText = name;
            }
            folder.querySelectorAll(`a-file[inode]`).forEach(file => file.dispatchEvent(new CustomEvent("moved")));
          } else create("a-folder", {name, inode}, folder => {
            folder.head.innerText = name;
            folder.addEventListener("render", () => {
              folder.connect();
            }, {once: true});

            this.body.append(folder);
          });
        } else {
          let file = sideNav.querySelector(`a-file[inode="${inode}"]`);

          if (file) {
            this.body.append(file);
            file.dispatchEvent(new CustomEvent("moved"));
            if (file.name !== name) {
              file.name = name;
              file.head.innerText = name;
              file.dispatchEvent(new CustomEvent("renamed"));
              if (file.type !== type) {
                file.type = type;
                file.dispatchEvent(new CustomEvent("retyped"));
              }
            }
          } else create("a-file", {name, type, inode}, file => {
            file.head.innerText = name;
            file.addEventListener("render", () => {
              file.connect();
            }, {once: true});

            this.body.append(file);
          });
        }
      }
      Sse.sse.addEventListener(`${this.inode}-owned`, Folder.ownedSlot);
      this.rearrange();
      this.setted = true;
      this.dispatchEvent(new CustomEvent("setup"));
    }).catch(error => {
      dialog.alert(`<span style='color: red'>Error reading folder (path = ${this.path}):</span>`, error);
    });
  }
  connect() {
    new Sse("folder.es", {path: this.path, inode: this.inode});
    if (this.loaded) return;
    Sse.sse.addEventListener(`${this.inode}-loaded`, Folder.loadedSlot, {once: true});
    Sse.sse.addEventListener(`${this.inode}-deleted`, Folder.deletedSlot, {once: true});
    Sse.sse.addEventListener(`${this.inode}-renamed`, Folder.renamedSlot);
    Sse.sse.addEventListener(`${this.inode}-refresh`, Folder.refreshSlot);
    Sse.sse.addEventListener(`${this.inode}-belonged`, Folder.belongedSlot);
  }
  delete() {
    for (let child of this.body.children) child.delete();
    Sse.sse.removeEventListener(`${this.inode}-owned`, Folder.ownedSlot);
    Sse.sse.removeEventListener(`${this.inode}-renamed`, Folder.renamedSlot);
    Sse.sse.removeEventListener(`${this.inode}-refresh`, Folder.refreshSlot);
    Sse.sse.removeEventListener(`${this.inode}-belonged`, Folder.belongedSlot);
    this.remove();
    Folder.root.body.updateScroll();
  }
  async refresh() {
    if (!this.setted) return;
    else this.classList.add("loading");

    try {
      let response = await Sse.fetch("send.es", {
        action: "read-dir",
        path: this.path
      });

      if (this === Folder.root) {
        if (this.inode !== response.inode) {
          window.location.reload();
          return;
        }
      }

      if (this.name !== response.name) {
        this.name = response.name;
        this.head.innerText = response.name;
        this.querySelectorAll(`a-file[inode]`).forEach(file => file.dispatchEvent(new CustomEvent("moved")));
      }

      let fileToRemove = {};
      for (let fItem of this.body.children) fileToRemove[fItem.inode] = fItem;
      for (let {name, inode, type} of response.body) {
        if (type === "directory") {
          let folder = sideNav.querySelector(`a-folder[inode="${inode}"]`);

          if (folder) {
            if (!fileToRemove[folder.inode]) {
              this.body.append(folder);
              folder.querySelectorAll(`a-file[inode]`).forEach(file => file.dispatchEvent(new CustomEvent("moved")));
            } else {
              delete fileToRemove[folder.inode];
            }
            if (folder.name !== name) {
              folder.name = name;
              folder.head.innerText = name;
              folder.querySelectorAll(`a-file[inode]`).forEach(file => file.dispatchEvent(new CustomEvent("moved")));
            }
          } else create("a-folder", {name, inode}, folder => {
            folder.head.innerText = name;
            folder.addEventListener("render", () => {
              folder.connect();
            }, {once: true});

            this.body.prepend(folder);
          });
        } else {
          let file = sideNav.querySelector(`a-file[inode="${inode}"]`);

          if (file) {
            if (!fileToRemove[file.inode]) {
              this.body.append(file);
              file.dispatchEvent(new CustomEvent("moved"));
            } else {
              delete fileToRemove[file.inode];
            }
            if (file.name !== name) {
              file.name = name;
              file.head.innerText = name;
              file.dispatchEvent(new CustomEvent("renamed"));
              if (file.type !== type) {
                file.type = type;
                file.dispatchEvent(new CustomEvent("retyped"));
              }
            }
          } else create("a-file", {name, type, inode}, file => {
            file.head.innerText = name;
            file.addEventListener("render", () => {
              file.connect();
            }, {once: true});

            this.body.append(file);
          });
        }
      }
      this.rearrange();
      Folder.root.body.updateScroll();

      let paths = Object.keys(fileToRemove);

      if (paths.length) {
        let response = await Sse.fetch("send.es", {
          action: "of-path",
          paths: paths.map(inode => ({inode}))
        });
        let dirs = new Set, paths = [];

        for (let fileInfo of response) {
          if (!fileInfo.path) {
            fileToRemove[fileInfo.inode].delete();
          } else {
            let path = fileInfo.path;

            if (path.endsWith("/")) path = path.slice(0, -1);
            dirs.add(path.slice(0, path.lastIndexOf("/") + 1));
            paths.push(path);
          }
        }
        for (let dir of dirs) await Folder.root.findByPath(dir).then(result => result?.refresh());
        for (let path of paths) await Folder.root.findByPath(path).then(result => {
          if (result?.classList.contains("select")) result.select();
          Folder.root.body.updateScroll();
        });
      }
    } catch (error) {
      dialog.alert(`<span style='color: red'>Error reading folder (path = ${this.path}):</span>`, error);
    } finally {
      this.classList.remove("loading");
    }
  }
  static async refreshAll(folder=Folder.root) {
    await folder.refresh();
    for (let subFolder of folder.body.children)
      if (subFolder.tagName === "A-FOLDER")
        if (subFolder.setted) this.refreshAll(subFolder);
  }
  static loadedSlot(message) {
    var data = JSON.parse(message.data),
        _this = Folder.getThis(message.type);

    _this.head.innerText = data.name;
    _this.name = data.name;

    _this.head.addEventListener("pointerdown", Folder.pointerDownSlot);
    _this.head.addEventListener("click", Folder.clickSlot);
    if (/Chrome/.test(navigator.userAgent)) _this.classList.remove("loading")
    else requestAnimationFrame(() => _this.classList.remove("loading"));
    _this.loaded = true;
    _this.dispatchEvent(new CustomEvent("load"));
  }
  static renamedSlot(message) {
    var data = message.data,
        _this = Folder.getThis(message.type);

    _this.name = data;
    _this.head.innerText = data;
    _this.parentNode.parentNode.rearrange();
    _this.querySelectorAll(`a-file[inode]`).forEach(file => file.dispatchEvent(new CustomEvent("moved")));
  }
  static ownedSlot(message) {
    var data = JSON.parse(message.data), {location, name, inode, type} = data,
        _this = Folder.getThis(message.type);
        
    if (type === "directory") {
      let folder = _this.subDirOf(name);

      if (folder && !folder.inode) {
        folder.inode = inode;
        folder.head.focus();
        folder.scrollToView();
        _this.rearrange();
        folder.connect();
      } else {
        folder = sideNav.querySelector(`a-folder[inode="${inode}"]`);

        if (!folder) create("a-folder", {name, inode}, folder => {
          folder.head.innerText = name;
          folder.addEventListener("render", () => {
            folder.connect();
          }, {once: true});

          _this.body.prepend(folder);
          _this.rearrange();
          Folder.root.body.updateScroll();
        });
      }
    } else {
      let file = _this.fileOf(name);

      if (file && !file.inode) {
        file.inode = inode;
        file.type = type;
        file.connect();
        _this.rearrange();
        file.select();
      } else {
        file = sideNav.querySelector(`a-file[inode="${inode}"]`);

        if (!file) create("a-file", {name, type, inode}, file => {
          file.head.innerText = name;
          file.addEventListener("render", () => {
            file.connect();
          }, {once: true});

          _this.body.append(file);
          _this.rearrange();
          Folder.root.body.updateScroll();
        });
      }
    }
  }
  static belongedSlot(message) {
    var data = JSON.parse(message.data), {location, name, inode, type} = data,
        folder = sideNav.querySelector(`a-folder[inode="${inode}"]`),
        _this = Folder.getThis(message.type);

    if (folder?.setted) {
      folder.body.prepend(_this);
      folder.rearrange();
      if (_this.classList.contains("select")) _this.select();
      Folder.root.body.updateScroll();
    } else {
      Folder.root.findByPath(location + _this.name + "/").then(result => {
        if (result?.classList.contains("select")) result.select();
        Folder.root.body.updateScroll();
      });
    }
    folder.querySelectorAll(`a-file[inode]`).forEach(file => file.dispatchEvent(new CustomEvent("moved")));
  }
  static deletedSlot(message) {
    Folder.getThis(message.type).delete();
  }
  static refreshSlot(message) {
    Folder.getThis(message.type).refresh();
  }
  static getThis(eventType) {
    return sideNav.querySelector(`a-folder[inode="${eventType.slice(0, eventType.indexOf("-"))}"]`);
  }
  async findByPath(path) {
    var fnames = path.split("/"),
        basename = fnames.pop(),
        target = this,
        queue = new Queue;

    for (let i = 1; i < fnames.length; i++) {
      let fname = fnames[i], folder = target;

      if (!folder.rendered) {
        folder.addEventListener("render", () => {
          queue.result = null;
        }, {once: true});
        await queue;
      }
      if (!folder.loaded) {
        folder.addEventListener("load", () => {
          queue.result = null;
        }, {once: true});
        await queue;
      }
      if (!folder.initiated) {
        folder.append(folder.body);
        folder.setup();
        folder.initiated = true;
        folder.addEventListener("setup", () => {
          queue.result = null;
        }, {once: true});
        await queue;
      } else if (!folder.setted) {
        folder.addEventListener("setup", () => {
          queue.result = null;
        }, {once: true});
        await queue;
      }

      target = folder.subDirOf(fname);
      if (!target) break;
    }

    if (target && basename) {
      let folder = target;
      if (!folder.rendered) {
        folder.addEventListener("render", () => {
          queue.result = null;
        }, {once: true});
        await queue;
      }
      if (!target.loaded) {
        folder.addEventListener("load", () => {
          queue.result = null;
        }, {once: true});
        await queue;
      }
      if (!folder.initiated) {
        folder.append(folder.body);
        folder.setup();
        folder.initiated = true;
        folder.addEventListener("setup", () => {
          queue.result = null;
        }, {once: true});
        await queue;
      } else if (!folder.setted) {
        folder.addEventListener("setup", () => {
          queue.result = null;
        }, {once: true});
        await queue;
      }
      target = folder.fileOf(basename);
    }

    queue.result = target;

    return queue;
  }
  open() {
    if (this.opened) return;
    setTimeout(() => {
      this.classList.add("open");
    });
    if (this.body.scrollHeight)
      this.body.style.height = this.body.scrollHeight + "px";
    this.opened = true;
  }
  close() {
    if (!this.opened) return;
    setTimeout(() => {
      if (this.body.scrollHeight)
        this.body.style.height = "0";
      this.classList.remove("open");
    });
    if (this.body.scrollHeight)
      this.body.style.height = this.body.scrollHeight + "px";
    this.opened = false;
  }
  select() {
    var selected = sideNav.querySelector(".select"), parent = this;

    if (this === Folder.root) return;

    sideNav.querySelector(".cwd")?.classList.remove("cwd");
    if (this.opened) this.classList.add("cwd");
    else this.parentNode.parentNode.classList.add("cwd");

    selected?.classList.remove("select");
    this.classList.add("select");

    for (let collected of sideNav.querySelectorAll(".collect:not(.copy, .cut)"))
      collected.classList.remove("collect");
    while (sideNav.contains(parent = parent.parentNode.parentNode)) {
      let folder = parent;
      if (folder.opened) continue;
      folder.open();
    }
    this.scrollToView();
  }
  scrollToView() {
    setTimeout(() => {
      var {top, bottom} = this.head.getBoundingClientRect();

      Folder.root.body.style.scrollBehavior = "smooth";
      if (top < Folder.root.offsetTop + Folder.root.body.offsetTop) this.head.scrollIntoView();
      else if (bottom > innerHeight - 24) this.head.scrollIntoView(false);
      Folder.root.body.style.scrollBehavior = "";
    });
  }
  collect() {
    var collected;

    if (this === Folder.root) return;
    collected = this.closest(".collect")
    sideNav.querySelector(".select")?.classList.remove("select");
    sideNav.querySelector(".cwd")?.classList.remove("cwd");
    if (!collected || this.matches(".collect:not(.copy, .cut)")) {
      if (this.classList.toggle("collect")) {
        for (let collected of this.querySelectorAll(".collect")) {
          collected.classList.remove("collect");
          collected.classList.remove("copy");
          collected.classList.remove("cut");
        }
      }
    }
    this.parentNode.parentNode.classList.add("cwd");
  }
  rearrange() {
    var children = this.body.children, folders = [...children].filter(function (folder) {
      return folder.tagName === "A-FOLDER";
    }).sort(function (a, b) {
      var name1 = +a.name, name2 = +b.name;

      if (name1 && name2) return (name1 < name2) ? -1 : 1;
      return (a.name < b.name) ? -1 : 1;
    }), files = [...children].slice(folders.length).sort(function (a, b) {
      var name1 = +a.name, name2 = +b.name;

      if (name1 && name2) return (name1 < name2) ? -1 : 1;
      return (a.name < b.name) ? -1 : 1;
    })

    for (let i = 0; i < folders.length; i++) {
      if (children[i] !== folders[i]) children[i].before(folders[i]);
    }
    for (let i = folders.length; i < children.length; i++) {
      if (children[i] !== files[i - folders.length]) children[i].before(files[i - folders.length]);
    }
  }
  subDirOf(name) {
    for (let child of this.body.children) {
      if (child.tagName === "A-FILE") return undefined;
      if (child.name === name) return child;
    }
  }
  fileOf(name) {
    for (let child of this.body.children) {
      if (child.tagName === "A-FOLDER") continue;
      if (child.name === name) return child;
    }
  }
  get name() {
    return this.getAttribute("name");
  }
  set name(value) {
    this.setAttribute("name", value);
  }
  get inode() {
    return this.getAttribute("inode");
  }
  set inode(value) {
    this.setAttribute("inode", value);
  }
  get path() {
    var folder = this,
        path = "/";

    while (Folder.root.body.contains(folder)) {
      path = "/" + folder.name + path;
      folder = folder.parentNode.parentNode;
    }
    return path;
  }
  static keydownSlot(event) {
    var key = event.key;

    if ("\\/:*?\"<>|".indexOf(key) !== -1) event.preventDefault();
    else if (key === "Enter") {
      event.preventDefault();
      this.blur();
    }
  }
  static focusinSlot(event) {
    event.stopPropagation();
    this.classList.add("focus");
  }
  static pointerDownSlot(event) {
    sideNav.contextMenu.dismiss();
  }
  static clickSlot(event) {
    var folder = this.parentNode;

    if (folder.matches(".rename, .create")) return;
    if (event.ctrlKey) {
      folder.collect();
      return;
    }
    if (!folder.initiated) {
      folder.append(folder.body);
      folder.setup();
      folder.initiated = true;
      folder.addEventListener("setup", () => {
        folder.open();
        folder.select();
      }, {once: true});
      return;
    } else if (!folder.setted) return;
    if (folder.opened) {
      folder.close();
    } else {
      folder.open();
    }
    folder.select();
  }
  static blurSlot(event) {
    var folder = this.parentNode;

    if (folder.classList.contains("rename")) {
      var newName = this.innerText.trim();

      folder.classList.remove("rename");
      this.removeAttribute("contenteditable");
      this.scrollLeft = 0;
      if (!newName || folder.name === newName) {
        this.innerText = folder.name;
        return;
      }
      this.innerText = newName;
      folder.classList.add("loading");
      Sse.send("send.es", {
        action: "rename-dir",
        name: newName,
        path: folder.path
      }).then(error => {
        if (error) throw error;
        else folder.name = newName;
      }).catch(error => {
        dialog.alert(`<span style='color: red'>Error renaming folder (path = ${folder.path}):</span>`, error);
        this.innerText = folder.name;
      }).finally(() => {
        folder.classList.remove("loading");
      });
    } else if (folder.classList.contains("create")) {
      var name = this.innerText.trim(), parent = folder.parentNode.parentNode;

      folder.classList.remove("create");
      this.removeAttribute("contenteditable");
      this.scrollLeft = 0;
      if (!name) {
        folder.remove();
        Folder.root.body.updateScroll();
        return;
      }
      folder.name = name;
      parent.classList.add("loading");
      Sse.send("send.es", {
        action: "create-dir",
        path: folder.path
      }).then(error => {
        if (error) throw error;
      }).catch(error => {
        dialog.alert(`<span style='color: red'>Error creating folder (path = ${folder.path}):</span>`, error);
        folder.remove();
        Folder.root.body.updateScroll();
      }).finally(() => {
        parent.classList.remove("loading");
      });
    }
  }
  static focusoutSlot(event) {
    event.stopPropagation();
    this.classList.remove("focus");
    sideNav.contextMenu.dismiss();
  }
  static transitionEndSlot(event) {
    event.stopPropagation();
    if (event.propertyName === "height")
      this.style.height = "";
  }
  static root;
}
class File extends HTMLElement {
  connectedCallback() {
    if (this.classList.contains("collect")) {
      this.classList.remove("copy");
      this.classList.remove("cut");
      this.classList.remove("collect");
    }

    if (this.rendered) return;

    this.classList.add("loading");
    this.append(this.head);
    this.rendered = true;
    this.dispatchEvent(new CustomEvent("render"));
  }
  rendered = false;
  loaded = false;
  head = create("div", {class: "file-head", tabindex: "-1"}, fileHead => {
    fileHead.addEventListener("click", File.clickSlot);
    fileHead.addEventListener("keydown", File.keydownSlot);
    fileHead.addEventListener("blur", File.blurSlot);
  });
  connect() {
    new Sse("file.es", {path: this.path, inode: this.inode});
    if (this.loaded) return;
    Sse.sse.addEventListener(`${this.inode}-loaded`, File.loadedSlot, {once: true});
    Sse.sse.addEventListener(`${this.inode}-deleted`, File.deletedSlot, {once: true});
    Sse.sse.addEventListener(`${this.inode}-renamed`, File.renamedSlot);
    Sse.sse.addEventListener(`${this.inode}-retyped`, File.retypedSlot);
    Sse.sse.addEventListener(`${this.inode}-belonged`, File.belongedSlot);
  }
  delete() {
    Sse.sse.removeEventListener(`${this.inode}-renamed`, File.renamedSlot);
    Sse.sse.removeEventListener(`${this.inode}-retyped`, File.retypedSlot);
    Sse.sse.removeEventListener(`${this.inode}-belonged`, File.belongedSlot);
    this.remove();
    this.dispatchEvent(new CustomEvent("deleted"));
    Folder.root.body.updateScroll();
  }
  static loadedSlot(message) {
    var _this = File.getThis(message.type);

    if (/Chrome/.test(navigator.userAgent)) _this.classList.remove("loading")
    else requestAnimationFrame(() => _this.classList.remove("loading"));
    _this.loaded = true;
    _this.dispatchEvent(new CustomEvent("load"));
  }
  static renamedSlot(message) {
    var data = message.data,
        _this = File.getThis(message.type);

    _this.name = data;
    _this.head.innerText = data;
    _this.parentNode.parentNode.rearrange();
    _this.dispatchEvent(new CustomEvent("renamed"));
  }
  static retypedSlot(message) {
    var data = message.data,
        _this = File.getThis(message.type);

    _this.type = data;
    _this.dispatchEvent(new CustomEvent("retyped"))
  }
  static belongedSlot(message) {
    var data = JSON.parse(message.data), {location, name, inode, type} = data,
        folder = sideNav.querySelector(`a-folder[inode="${inode}"]`),
        _this = File.getThis(message.type);

    if (folder?.setted) {
      folder.body.append(_this);
      folder.rearrange();
      if (_this.classList.contains("select")) _this.select(true);
      _this.dispatchEvent(new CustomEvent("moved"));
      Folder.root.body.updateScroll();
    } else {
      Folder.root.findByPath(location + _this.name).then(result => {
        if (result?.classList.contains("select")) result.select(true);
        _this.dispatchEvent(new CustomEvent("moved"));
        Folder.root.body.updateScroll();
      });
    }
  }
  static deletedSlot(message) {
    File.getThis(message.type).delete();
  }
  static getThis(eventType) {
    return sideNav.querySelector(`a-file[inode="${eventType.slice(0, eventType.indexOf("-"))}"]`);
  }
  select(passive) {
    var selected = sideNav.querySelector(".select"), parent = this;

    sideNav.querySelector(".cwd")?.classList.remove("cwd");
    this.parentNode.parentNode.classList.add("cwd");

    selected?.classList.remove("select");
    this.classList.add("select");
    if (!passive) sideNav.dispatchEvent(new CustomEvent("fileselect", {
      detail: this
    }));

    for (let collected of sideNav.querySelectorAll(".collect:not(.copy, .cut)"))
      collected.classList.remove("collect");
    while (sideNav.contains(parent = parent.parentNode.parentNode)) {
      if (parent.opened) continue;
      parent.open();
    }
    this.scrollToView();
  }
  scrollToView() {
    setTimeout(() => {
      var {top, bottom} = this.head.getBoundingClientRect();

      Folder.root.body.style.scrollBehavior = "smooth";
      if (top < Folder.root.offsetTop + Folder.root.body.offsetTop) this.head.scrollIntoView();
      else if (bottom > innerHeight - 24) this.head.scrollIntoView(false);
      Folder.root.body.style.scrollBehavior = "";
    });
  }
  collect() {
    var collected = this.closest(".collect")

    sideNav.querySelector(".select")?.classList.remove("select");
    sideNav.querySelector(".cwd")?.classList.remove("cwd");
    if (!collected || this.matches(".collect:not(.copy, .cut)"))
      this.classList.toggle("collect");
    this.parentNode.parentNode.classList.add("cwd");
  }
  get name() {
    return this.getAttribute("name");
  }
  set name(value) {
    this.setAttribute("name", value);
  }
  get type() {
    return this.getAttribute("type");
  }
  set type(value) {
    this.setAttribute("type", value);
  }
  get inode() {
    return this.getAttribute("inode");
  }
  set inode(value) {
    this.setAttribute("inode", value);
  }
  get path() {
    var folder = this,
        path = "";

    while (Folder.root.body.contains(folder)) {
      path = "/" + folder.name + path;
      folder = folder.parentNode.parentNode;
    }
    return path;
  }
  static keydownSlot(event) {
    var key = event.key;

    if ("\\/:*?\"<>|".indexOf(key) !== -1) event.preventDefault();
    else if (key === "Enter") {
      event.preventDefault();
      this.blur();
    }
  }
  static clickSlot(event) {
    var file = this.parentNode;

    if (file.matches(".rename, .create")) return;
    if (event.ctrlKey) {
      file.collect();
      return;
    }
    file.select();
  }
  static blurSlot(event) {
    var file = this.parentNode;

    if (file.classList.contains("rename")) {
      var newName = this.innerText.trim();

      file.classList.remove("rename");
      this.removeAttribute("contenteditable");
      this.scrollLeft = 0;
      if (!newName || file.name === newName) {
        this.innerText = file.name;
        return;
      }
      this.innerText = newName;
      file.classList.add("loading");
      Sse.send("send.es", {
        action: "rename-file",
        name: newName,
        path: file.path
      }).then(error => {
        if (error) throw error;
        else file.name = newName;
      }).catch(error => {
        dialog.alert(`<span style='color: red'>Error renaming file (path = ${file.path}):</span>`, error);
        this.innerText = file.name;
      }).finally(() => {
        file.classList.remove("loading");
      });
    } else if (file.classList.contains("create")) {
      var name = this.innerText.trim(), parent = file.parentNode.parentNode;

      if (!name) {
        file.remove();
        Folder.root.body.updateScroll();
        return;
      }
      file.name = name;
      file.classList.remove("create");
      this.removeAttribute("contenteditable");
      this.scrollLeft = 0;
      parent.classList.add("loading");
      Sse.send("send.es", {
        action: "create-file",
        path: file.path
      }).then(error => {
        if (error) throw error;
      }).catch(error => {
        dialog.alert(`<span style='color: red'>Error creating file (path = ${file.path}):</span>`, error);
        file.remove();
        Folder.root.body.updateScroll();
      }).finally(() => {
        parent.classList.remove("loading");
      });
    }
  }
}
class Page extends HTMLElement {
  connectedCallback() {
    if (this.rendered) return;

    this.draggable = true;

    this.addEventListener("pointerdown", Page.pointerDownSlot);
    this.append(this.nameSpan, this.dirSpan, this.closeBtn);

    this.rendered = true;
  }
  rendered = false;
  nameSpan = create("span", {class: "page-name"});
  dirSpan = create("span", {class: "dir-path"});
  closeBtn = create("span", {class: "close-btn"}, closeBtn => {
    closeBtn.addEventListener("click", Page.closeSlot);
  });
  set name(value) {
    this.nameSpan.innerText = value;
  }
  get name() {
    return this.nameSpan.innerText;
  }
  set dirpath(value) {
    this.dirSpan.innerText = value;
  }
  get dirpath() {
    return this.dirSpan.innerText;
  }
  set inode(value) {
    this.setAttribute("inode", value);
  }
  get inode() {
    return this.getAttribute("inode");
  }
  set type(value) {
    this.setAttribute("type", value);
  }
  get type() {
    return this.getAttribute("type");
  }
  get path() {
    return this.file.path;
  }
  open() {
    let index = topNav.pageCache.indexOf(this);

    this.classList.add("active");
    this.scrollToView();
    topNav.dispatchEvent(new CustomEvent("pageopened", {detail: this}));
    if (index !== -1) topNav.pageCache.splice(index, 1);
    topNav.recordPages();
  }
  close() {
    this.remove();
    if (this.dirpath) {
      this.dirpath = "";
      topNav.deflict(this.name);
    }
    topNav.dispatchEvent(new CustomEvent("pageclosed", {detail: this}));
    if (!topNav.pageCache.includes(this)) topNav.pageCache.push(this);
    if (!this.classList.contains("active") || !topNav.children.length)
      setTimeout(() => topNav.recordPages());
  }
  pin() {
    this.classList.remove("unpined");
    topNav.recordPages();
  }
  save() {
    if (this.classList.contains("unpined")) this.pin();
    if (
      this.type === "video" ||
      this.type === "audio" ||
      this.type === "image" ||
      this.type === "pdf" ||
      this.type === "zip" ||
      this.type === "exe" ||
      this.type === "binary"
    ) {
    } else Sse.send("send.es", {
      action: "save-file",
      inode: this.inode
    }).then(result => {
      if (result) throw result;
      topNav.dispatchEvent(new CustomEvent("pagesaved", {detail: this}));
    }).catch(error => {
      if (error instanceof ProgressEvent) error = "Connection is lost!";
      dialog.alert(`<span style='color: red'>Error saving file (path = ${this.path}):</span>`, error);
    });
  }
  scrollToView() {
    if (this.offsetLeft - 24 < topNav.scrollLeft) {
      topNav.style.scrollBehavior = "smooth";
      topNav.scrollLeft = this.offsetLeft - 24;
      topNav.style.scrollBehavior = "";
    } else if (this.offsetLeft + this.offsetWidth + 24 > topNav.scrollLeft + topNav.offsetWidth) {
      topNav.style.scrollBehavior = "smooth";
      topNav.scrollLeft = this.offsetLeft + this.offsetWidth + 24 - topNav.offsetWidth;
      topNav.style.scrollBehavior = "";
    }
  }
  static pointerDownSlot(event) {
    var activePage = topNav.querySelector(".active");

    if (event.target === this.closeBtn) {
      event.preventDefault();
      return;
    }
    if (activePage !== this) this.file.select();
    else {
      if (this.viewer.view) setTimeout(() => {
        this.viewer.view.focus();
      });
    }
  }
  static closeSlot() {
    var pages = topNav.children, page = this.parentNode;

    page.close();
    for (let p of pages) {
      if (p.index > page.index) p.index--;
      if (p.index === pages.length - 1) p.file.select();
    }
  }
}
customElements.define("a-folder", Folder);
customElements.define("a-file", File);
customElements.define("a-page", Page);

export const sideNav = create("nav", {class: "side-nav"}, sideNav => {
  function deleteFiles(target) {
    var paths = [], parent = target.parentNode.parentNode;

    if (target === Folder.root) return;
    if (target.closest(".collect:not(.save, .cut)")) {
      for (let collected of sideNav.querySelectorAll(".collect:not(.save, .cut)"))
        paths.push(collected.path);  
    } else paths.push(target.path);

    dialog.confirm(`Are you sure to delete the the following ${paths.length}?`, paths.join("<br>")).then(yes => {
      if (!yes) return;
      parent.classList.add("loading");
      Sse.send("send.es", {
        action: "delete-file",
        paths
      }).then(error => {
        if (error) throw error;
      }).catch(error => {
        dialog.alert(`<span style='color: red'>Error deleting files:</span>`, error.replace("\n", "<br>"));
      }).finally(() => {
        parent.classList.remove("loading");
      });
    });
  }

  sideNav.deleteFiles = function () {
    var target = this.querySelector(".select");

    if (!target) target = this.querySelector(".collect")
    if (target && target.matches("a-file, a-folder")) deleteFiles(target);
  };

  function isPastable(target) {
    let action;

    if (sideNav.querySelector(".copy")) action = "copy-file";
    else if (sideNav.querySelector(".cut")) action = "move-file";
    else {
      pasteMenu.classList.add("disable");
      return false;
    }
    for (let fItem of sideNav.querySelectorAll(".copy, .cut")) {
      if (target === fItem.parentNode.parentNode && action === "move-file") {
        pasteMenu.classList.add("disable");
        return false;
      }
      if (fItem.contains(target)) {
        pasteMenu.classList.add("disable");
        return false;
      }
    }
    pasteMenu.classList.remove("disable");
    return true;
  }

  sideNav.isPastable = function () {
    var target = contextMenu.targetElement;

    if (target?.matches("a-folder")) isPastable(target);
  };

  function pasteFiles(target) {
    let paths = [], action;

    if (sideNav.querySelector(".copy")) action = "copy-file";
    else if (sideNav.querySelector(".cut")) action = "move-file";
    if (!action || !target) return;
    for (let fItem of sideNav.querySelectorAll(".copy, .cut")) {
      if (target === fItem.parentNode.parentNode && action === "move-file") return;
      if (fItem.contains(target)) return;

      paths.push(fItem.path);
    }
    target.classList.add("loading");

    let focusedFile = sideNav.querySelector(".dir-head:focus:not(.collect), .file-head:focus:not(.collect)");

    Sse.send("send.es", {
      action, 
      paths,
      path: target.path
    }).then(error => {
      if (error) throw error;
    }).catch(error => {
      dialog.alert(`<span style='color: red'>Error pasting files:</span>`, error.replace("\n", "<br>"));
    }).finally(() => {
      target.classList.remove("loading");
      for (let fItem of sideNav.querySelectorAll(".copy"))
        fItem.classList.remove("copy", "collect");
      if (focusedFile) {
        focusedFile.parentNode.classList.add("select");
        setTimeout(focusedFile.focus.bind(focusedFile));
      }
      pasteMenu.classList.add("disable")
    });
  }

  sideNav.pasteFiles = function () {
    var target = sideNav.querySelector("a-folder.cwd")
    pasteFiles(target);
  };

  function createFile(target) {
    create("a-file", {class: "create"}, file => {
      var firstFile;

      if (!target.opened) target.head.click();

      if (!target.setted) {
        target.addEventListener("setup", () => {
          for (let fItem of target.body.children) {
            if (fItem.tagName === "A-FILE") {
              firstFile = fItem;
              break;
            }
          }

          if (firstFile) firstFile.before(file);
          else target.body.append(file);
          Folder.root.body.updateScroll();

          if (!target.opened) target.head.click();

          file.head.contentEditable = (navigator.userAgent.indexOf("Firefox") === -1) ? "plaintext-only" : true;
          file.head.spellcheck = false;
          file.head.focus();
        }, {once: true});
      } else {
        for (let fItem of target.body.children) {
          if (fItem.tagName === "A-FILE") {
            firstFile = fItem;
            break;
          }
        }

        if (firstFile) firstFile.before(file);
        else target.body.append(file);
        Folder.root.body.updateScroll();
        file.head.contentEditable = (navigator.userAgent.indexOf("Firefox") === -1) ? "plaintext-only" : true;
        file.head.spellcheck = false;
        file.head.focus();
      }
    });
  }

  sideNav.createFile = function () {
    var target = sideNav.querySelector("a-folder.cwd") || Folder.root;
    target.select();
    createFile(target);
  };

  function createFolder(target) {
    create("a-folder", {class: "create"}, folder => {
      if (!target.opened) target.head.click();

      if (!target.setted) {
        target.addEventListener("setup", () => {
          target.body.prepend(folder);
          Folder.root.body.updateScroll();

          folder.head.contentEditable = (navigator.userAgent.indexOf("Firefox") === -1) ? "plaintext-only" : true;
          folder.head.spellcheck = false;
          folder.head.focus();
        }, {once: true});
      } else {
        target.body.prepend(folder);
        Folder.root.body.updateScroll();

        folder.head.contentEditable = (navigator.userAgent.indexOf("Firefox") === -1) ? "plaintext-only" : true;
        folder.head.spellcheck = false;
        folder.head.focus();
      }
    });
  }

  sideNav.createFolder = function () {
    var target = sideNav.querySelector("a-folder.cwd") || Folder.root;
    target.select();
    createFolder(target);
  };

  const contextMenu = create("div", {class: "context-menu"}, menu => {
    menu.dismiss = () => {
      if (!contextMenu.firstElementChild) return;
      contextMenu.innerHTML = "";
      contextMenu.remove();
    };
  }), refreshMenu = create("div", {class: "refresh-menu"}, item => {
    item.innerText = "Refresh";
    item.addEventListener("click", event => {
      var target = contextMenu.targetElement;

      target.refresh();
      contextMenu.dismiss();
    });
  }), renameMenu = create("div", {class: "rename-menu"}, item => {
    item.innerText = "Rename";
    item.addEventListener("click", event => {
      var target = contextMenu.targetElement,
          selection = document.getSelection(),
          index = target.name.lastIndexOf(".");

      if (index === -1) index = target.name.length;

      selection.empty();
      selection.setBaseAndExtent(target.head.childNodes[0], 0, target.head.childNodes[0], index);
      contextMenu.dismiss();
      target.classList.add("rename");
      target.head.contentEditable = (navigator.userAgent.indexOf("Firefox") === -1) ? "plaintext-only" : true;
      target.head.spellcheck = false;
      target.head.focus();
    });
  }), fileMenu = create("div", {class: "file-menu"}, item => {
    item.innerText = "New File";
    item.addEventListener("click", event => {
      createFile(contextMenu.targetElement);
    });
  }), folderMenu = create("div", {class: "folder-menu"}, item => {
    item.innerText = "New Folder";
    item.addEventListener("click", event => {
      createFolder(contextMenu.targetElement);
    });
  }), compressMenu = create("div", {class: "compress-menu"}, item => {
    item.innerText = "Compress";
    item.addEventListener("click", event => {
      var target = contextMenu.targetElement, paths = [];

      if (target.closest(".collect:not(.save, .cut)")) {
        for (let collected of sideNav.querySelectorAll(".collect:not(.save, .cut)"))
          paths.push(collected.path);  
      } else paths.push(target.path);

      target.parentNode.parentNode.classList.add("loading");
      Sse.send("send.es", {
        action: "compress-file",
        paths, path: target.path
      }).then(error => {
        if (error) throw error;
      }).catch(error => {
        dialog.alert(`<span style='color: red'>Error compressing files:</span>`, error);
      }).finally(() => {
        target.parentNode.parentNode.classList.remove("loading");
      });
      contextMenu.dismiss();
    });
  }), extractMenu = create("div", {class: "extract-menu"}, item => {
    item.innerText = "Extract";
    item.addEventListener("click", event => {
      var target = contextMenu.targetElement;

      target.parentNode.parentNode.classList.add("loading");
      Sse.send("send.es", {
        action: "extract-file",
        path: target.path
      }).then(error => {
        if (error) throw error;
      }).catch(error => {
        dialog.alert(`<span style='color: red'>Error extracting file (path = ${target.path}):</span>`, error);
      }).finally(() => {
        target.parentNode.parentNode.classList.remove("loading");
      });
      contextMenu.dismiss();
    });
  }), copyMenu = create("div", {class: "copy-menu"}, item => {
    item.innerText = "Copy";
    item.addEventListener("click", event => {
      var target = contextMenu.targetElement;

      if (!target.closest(".collect")) target.collect();
      for (let collected of sideNav.querySelectorAll(".collect")) {
        collected.classList.remove("cut");
        collected.classList.add("copy");
      }

      contextMenu.dismiss();
    });
  }), cutMenu = create("div", {class: "cut-menu"}, item => {
    item.innerText = "Cut";
    item.addEventListener("click", event => {
      var target = contextMenu.targetElement;

      if (!target.closest(".collect")) target.collect();
      for (let collected of sideNav.querySelectorAll(".collect")) {
        collected.classList.remove("copy");
        collected.classList.add("cut");
      }

      contextMenu.dismiss();
    });
  }), pasteMenu = create("div", {class: "paste-menu"}, item => {
    item.innerText = "Paste";
    item.addEventListener("click", event => {
      pasteFiles(contextMenu.targetElement);
      contextMenu.dismiss();
    });
  }), copyPathMenu = create("div", {class: "copy-path-menu"}, item => {
    item.innerText = "Copy Path";
    item.addEventListener("click", () => {
      var target = contextMenu.targetElement;

      navigator.clipboard?.writeText(location.origin + target.path);
      contextMenu.dismiss();
    });
  }), downloadMenu = create("div", {class: "download-menu"}, item => {
    item.innerText = "Download";
    item.addEventListener("click", event => {
      var target = contextMenu.targetElement,
          downloader = create("a", {
            href: "/download?path=" + encodeURIComponent(target.path),
            download: ""
          });

      downloader.click();
      contextMenu.dismiss();
    });
  }), uploadFile = create("div", {class: "upload-file"}, item => {
    item.innerText = "Upload File";
    item.addEventListener("click", event => {
      var target = contextMenu.targetElement;

      uploader.uploadFile(target.path);
      contextMenu.dismiss();
    });
  }), uploadFolder = create("div", {class: "upload-folder"}, item => {
    item.innerText = "Upload Folder";
    item.addEventListener("click", event => {
      var target = contextMenu.targetElement;

      uploader.uploadDir(target.path);
      contextMenu.dismiss();
    });
  }), deleteMenu = create("div", {class: "delete-menu"}, item => {
    item.innerText = "Delete";
    item.addEventListener("click", event => {
      var target = contextMenu.targetElement;

      deleteFiles(target);
      contextMenu.dismiss();
    });
  });

  contextMenu.addEventListener("pointerdown", event => {
    event.preventDefault();
  });

  function constructContextMenu() {
    var target = document.activeElement, parent = target.parentNode;

    if (parent === Folder.root) {
      contextMenu.append(fileMenu, folderMenu, refreshMenu, pasteMenu, uploadFile, uploadFolder);
      sideNav.append(contextMenu);
    } else if (parent.tagName === "A-FOLDER") {
      if (!parent.loaded || parent.matches(".rename, .create")) return;

      contextMenu.append(fileMenu, folderMenu, refreshMenu, renameMenu, compressMenu, 
                         cutMenu, copyMenu, pasteMenu, copyPathMenu, uploadFile, uploadFolder, downloadMenu, deleteMenu);
    } else if (parent.tagName === "A-FILE") {
      if (parent.matches(".rename, .create")) return;

      if (parent.matches("[type=zip]")) 
        contextMenu.append(renameMenu, extractMenu, cutMenu, copyMenu, copyPathMenu, downloadMenu, deleteMenu);
      else
        contextMenu.append(renameMenu, compressMenu, cutMenu, copyMenu, copyPathMenu, downloadMenu, deleteMenu);
    }

    if (contextMenu.firstElementChild) {
      contextMenu.targetElement = parent;
      sideNav.append(contextMenu);
      if (contextMenu.contains(pasteMenu)) sideNav.isPastable();
      return true
    }
    return false;
  }

  sideNav.addEventListener("contextmenu", event => {
    event.preventDefault();

    if (contextMenu.contains(event.target) || !constructContextMenu()) return;
    
    if (innerHeight - event.clientY - contextMenu.offsetHeight < 0)
      contextMenu.style.top = event.clientY - contextMenu.offsetHeight + "px";
    else
      contextMenu.style.top = event.clientY + "px";
    if (innerWidth - event.clientX - contextMenu.offsetWidth < 0)
      contextMenu.style.left = event.clientX - contextMenu.offsetWidth + "px";
    else
      contextMenu.style.left = event.clientX + "px";
  });

  if (document.ontouchstart === null) sideNav.addEventListener("touchstart", function (event) {
    var touches = event.touches;

    if (touches.length === 2) {
      let clientX, clientY;

      if (!constructContextMenu()) return;

      ({x: clientX, y: clientY} = document.activeElement.getBoundingClientRect());

      clientX += sideNav.offsetWidth - 12;
      clientY += 12;

      if (innerHeight - clientY - contextMenu.offsetHeight < 0)
        contextMenu.style.top = clientY - contextMenu.offsetHeight + "px";
      else
        contextMenu.style.top = clientY + "px";
      if (innerWidth - event.clientX - contextMenu.offsetWidth < 0)
        contextMenu.style.left = clientX - contextMenu.offsetWidth + "px";
      else
        contextMenu.style.left = clientX + "px";
    } else if (event.touches.length === 3) {
      for (let fItem of sideNav.querySelectorAll(".collect")) 
        fItem.classList.remove("collect", "copy", "cut");
      contextMenu.dismiss();
    }
  });

  sideNav.contextMenu = contextMenu;

  sideNav.addEventListener("keydown", event => {
    var key = event.key?.toLowerCase();

    if (event.target.contentEditable !== "inherit") return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (key === "a") {
        let cwd = sideNav.querySelector("a-folder.cwd");

        if (cwd) 
          for (let fItem of cwd.body.children) 
            if (!fItem.classList.contains("collect")) fItem.collect();
      } else if (key === "c") {
        sideNav.querySelector(".select:not(.collect)")?.collect();
        for (let collected of sideNav.querySelectorAll(".collect")) {
          collected.classList.remove("cut");
          collected.classList.add("copy");
        }
        sideNav.isPastable();
      } else if (key === "x") {
        sideNav.querySelector(".select:not(.collect)")?.collect();
        for (let collected of sideNav.querySelectorAll(".collect")) {
          collected.classList.remove("copy");
          collected.classList.add("cut");
        }
        sideNav.isPastable();
      } else if (key === "z") {
        for (let collected of sideNav.querySelectorAll(".collect")) {
          if (collected.classList.contains("copy")) collected.classList.remove("copy");
          else if (collected.classList.contains("cut")) collected.classList.remove("cut");
          else collected.classList.remove("collect");
        }
        sideNav.querySelector(".dir-head:focus:not(.collect), .file-head:focus:not(.collect)")?.parentNode.classList.add("select");
        pasteMenu.classList.add("disable");
      } else if (key === "v")
        sideNav.pasteFiles();
    }
  });

  const dragWidget = create("div", {class: "drag-widget", draggable: true}, widget => {
    var text = create("div");

    widget.setText = value => text.innerText = value;
    widget.addEventListener("dragstart", event => {
      var target = document.activeElement, parent = target.parentNode;

      if (parent === Folder.root) {
        event.preventDefault();
        return;
      }
      if (parent.tagName === "A-FOLDER") { 
        if (!parent.loaded || parent.matches(".rename, .create")) {
          event.preventDefault();
          return;
        }
      } else if (parent.tagName === "A-FILE") {
        if (parent.matches(".rename, .create")) {
          event.preventDefault();
          return;
        }
      } else {
        event.preventDefault();
      }

      setTimeout(() => text.style.visibility = "");
      if (parent.closest(".collect:not(.copy, .cut)")) {
        let data = "", count = 0;

        for (let collected of sideNav.querySelectorAll(".collect:not(.copy, .cut)")) {
          data += location.origin + collected.path + "\n";
          count++;
        }
        event.dataTransfer.setData("text", data.trim());
        if (count > 1) widget.setText(count);
        else widget.setText(parent.closest(".collect").name);
      } else {
        event.dataTransfer.setData("text", location.origin + parent.path);
        widget.setText(parent.name);
      }
      text.style.visibility = "visible";
      sideNav.append(widget);
      widget.targetElement = parent;
    });
    widget.addEventListener("dragend", event => {
      sideNav.querySelector("a-folder.drag")?.classList.remove("drag");
      widget.targetElement = undefined;
    });
    widget.append(text);
  });

  if (/Chrome/.test(navigator.userAgent) && document.ontouchstart === undefined) sideNav.addEventListener("pointerdown", event => {
    event.target.setPointerCapture(event.pointerId);
    event.target.addEventListener("lostpointercapture", () => {
      dragWidget.setText("");
      dragWidget.remove();
    }, {once: true});
    dragWidget.style.top = event.clientY - 4 + "px";
    dragWidget.style.left = event.clientX - 4 + "px";
    sideNav.append(dragWidget);
  });

  sideNav.dragStartSlot = function (event) {
    var target = event.target, parent = target.closest("a-folder"),
        dragged = dragWidget.targetElement, draggeds;

    if (!parent) return;
    if (dragged && sideNav.contains(dragged)) {
      if (dragged.closest(".collect:not(.copy, .cut)"))
        draggeds = sideNav.querySelectorAll(".collect:not(.copy, .cut)");
      else
        draggeds = [dragged];
      for (let dragged of draggeds) {
        if (dragged.parentNode.parentNode === parent) return;
        if (dragged.contains(parent)) return;
      }
    }

    if (!parent.classList.contains("drag")) {
      sideNav.querySelector("a-folder.drag")?.classList.remove("drag");
      parent.classList.add("drag");
      clearTimeout(dragWidget.dragTimeout);
      if (!parent.opened) {
        dragWidget.dragTimeout = setTimeout(() => {
          if (!parent.opened && parent.classList.contains("drag")) {
            if (!parent.initiated) {
              parent.append(parent.body);
              parent.setup();
              parent.initiated = true;
              parent.addEventListener("setup", () => {
                parent.open();
              }, {once: true});
            } else {
              parent.open();
            }
          }
        }, 1000);
      }
    }
    event.preventDefault();
  };

  sideNav.addEventListener("dragenter", sideNav.dragStartSlot);
  sideNav.addEventListener("dragover", sideNav.dragStartSlot);
  sideNav.addEventListener("dragleave", event => {
    var draggedOver = sideNav.querySelector("a-folder.drag"),
        relatedTarget = event.relatedTarget;

    if ((!relatedTarget || !relatedTarget.closest("a-folder.drag")) && draggedOver) {
      draggedOver.classList.remove("drag");
      clearTimeout(dragWidget.dragTimeout);
    }
  });
  sideNav.addEventListener("drop", event => {
    var target = event.target, parent = target.closest("a-folder"),
        paths = event.dataTransfer.getData("text").split("\n").map(path => path.replace(location.origin, "")),
        files = event.dataTransfer.files;

    if (!parent) return;
    if (parent.classList.contains("drag")) {
      if (files.length) {
        event.preventDefault();
        let filesToUpload = [];

        for (let file of files)
          if (file.size % 1024) 
            filesToUpload.push(file);

        if (filesToUpload.length) uploader.upload(filesToUpload, parent.path);
      } else if (paths[0].trim()) {
        Folder.root.findByPath(paths[0]).then(result => {
          if (!result || result === Folder.root) return;
          parent.classList.add("loading");
          Sse.send("send.es", {
            action: "move-file",
            paths,
            path: parent.path
          }).then(error => {
            if (error) throw error;
          }).catch(error => {
            dialog.alert(`<span style='color: red'>Error moving files:</span>`, error.replace("\n", "<br>"));
          }).finally(() => {
            parent.classList.remove("loading");
          });
        })
      }
    }
    sideNav.querySelector("a-folder.drag")?.classList.remove("drag");
  });

  create("div", {class: "nav-toggle"}, navToggle => {
    navToggle.innerHTML = "<div><div></div></div><div></div><div><div></div></div>";
    navToggle.addEventListener("click", () => {
      if (document.body.classList.toggle("nav-hidden"))
        localStorage["--side-width"] = "-" + Number.parseFloat(document.body.style.getPropertyValue("--side-width"));
      else
        localStorage["--side-width"] = Number.parseFloat(document.body.style.getPropertyValue("--side-width"));
    });
    sideNav.append(navToggle);
  });

  create("div", {class: "page-title"}, pageTitle => {
    pageTitle.innerText = document.title;
    sideNav.append(pageTitle);
  });

  create("a-resizerx", {}, resizer => {
    var startWidth = +localStorage["--side-width"];

    if (startWidth < 0) {
      document.body.style.transition = "none";
      sideNav.style.transition = "none";
      document.body.classList.add("nav-hidden");
      document.body.style.setProperty("--side-width", -startWidth + "px");
      startWidth = 0;
    } else if (startWidth === 0) {
      document.body.style.transition = "none";
      sideNav.style.transition = "none";
      document.body.classList.add("nav-hidden");
      document.body.style.setProperty("--side-width", 225 + "px");
    } else {
      if (isNaN(startWidth)) startWidth = 225;
      document.body.style.transition = "none";
      sideNav.style.transition = "none";
      document.body.style.setProperty("--side-width", startWidth + "px");
    }
    setTimeout(() => {
      document.body.style.transition = "";
      sideNav.style.transition = "";
    });

    resizer.addEventListener("resizestart", () => {
      if (document.body.classList.contains("nav-hidden"))
        startWidth = 0;
      else 
        startWidth = Number.parseFloat(document.body.style.getPropertyValue("--side-width"));

      document.body.style.transition = "none";
      sideNav.style.transition = "none";
      topNav.parentNode.style.transition = "none";
      topNav.nextElementSibling.style.transition = "none";
    });
    resizer.addEventListener("resize", event => {
      var newWidth = startWidth + event.detail;

      if (newWidth < 100) {
        if (!document.body.classList.contains("nav-hidden"))
          document.body.classList.add("nav-hidden");
        newWidth = 225;
        localStorage["--side-width"] = 0;
      } else {
        if (document.body.classList.contains("nav-hidden"))
          document.body.classList.remove("nav-hidden");
        if (newWidth < 225) newWidth = 225;
        else if (newWidth > 800) newWidth = 800;
        localStorage["--side-width"] = newWidth;
      }

      topNav.updateScroll();
      sideNav.dispatchEvent(new CustomEvent("resize"));
      document.body.style.setProperty("--side-width", newWidth + "px");
    });
    resizer.addEventListener("resizeend", () => {
      document.body.style.transition = "";
      sideNav.style.transition = "";
      topNav.parentNode.style.transition = "";
      topNav.nextElementSibling.style.transition = "";
    });

    sideNav.append(resizer);
  });

  Sse.reconnects.add(async () => {
    await Folder.refreshAll();
    for (let fItem of sideNav.querySelectorAll("a-folder, a-file")) fItem.connect();
  });

  document.body.append(sideNav);
});
export const folder = create("a-folder", {inode: await Sse.send("send.es", {action: "of-inode", path: "/"})}, folder => {
  Folder.root = folder;
  folder.addEventListener("render", () => {
    create("a-slidery", {}, scrollBar => {
      var ended = false, body = folder.body;

      scrollBar.linkedElem = body;
      sideNav.append(scrollBar);

      body.tabIndex = -1;
      body.addEventListener("transitionstart", function updateScroll(event) {
        ended = false;
        requestAnimationFrame(() => {
          body.updateScroll();
          if (!ended) updateScroll();
        });
      }, true);
      body.addEventListener("transitionend", () => ended = true, true);
      body.addEventListener("focusin", () => {
        sideNav.querySelector(".cwd")?.classList.remove("cwd");
        folder.classList.add("cwd");
      });
    });
    folder.connect();
  }, {once: true});
  sideNav.append(folder);
});
export const topNav = create("nav", {class: "top-nav"}, topNav => {
  var getPage = Queue.cacheCall((file, resolve) => {
    resolve(create("a-page", {}, page => {
      const listeners = {
        "renamed": () => {
          var oldName = page.name;

          page.name = file.name;
          deflict(oldName);
          deflict(page.name);
          topNav.dispatchEvent(new CustomEvent("pagerenamed", {detail: page}));
        },
        "retyped": () => {
          page.type = file.type;
          page.dispatchEvent(new CustomEvent("retyped"));
        },
        "moved": () => {
          deflict(page.name);
          topNav.dispatchEvent(new CustomEvent("pagemoved", {detail: page}));
        },
        "deleted": () => {
          var pages = topNav.children, index = topNav.pageCache.indexOf(page),
              pageToOpen;

          page.remove();
          if (page.dirpath) {
            page.dirpath = "";
            deflict(page.name);
          }
          for (let p of pages) {
            if (p.index > page.index) p.index--;
            if (p.index === pages.length - 1) pageToOpen = p;
          }
          setTimeout(() => {
            if (topNav.contains(pageToOpen)) pageToOpen.file.select();
          });
          getPage.map.delete(file);
          page.iframe?.externalWindow?.close();
          if (index !== -1) topNav.pageCache.splice(index, 1);
          page.dispatchEvent(new CustomEvent("deleted"));
          topNav.dispatchEvent(new CustomEvent("pagedeleted", {detail: page}));
        }
      }
      page.file = file;
      page.inode = file.inode;
      page.name = file.name;
      page.type = file.type;

      for (let listener in listeners)
        file.addEventListener(listener, listeners[listener]);
      page.unlink = () => {
        for (let listener in listeners)
          file.removeEventListener(listener, listeners[listener]);
      };
    }));
  });

  topNav.getPage = getPage;

  function deflict(name) {
    var pages = topNav.children, conflicts = [], dirpaths = [], dirpaths2 = [];

    for (let page of pages)
      if (page.name === name)
        conflicts.push(page);

    if (!conflicts.length) return;
    if (conflicts.length > 1)
      for (let page of conflicts) {
        page.dirpath = calcDirpath(page);
        if (dirpaths.includes(page.dirpath)) {
          if (!dirpaths2.includes(page.dirpath)) dirpaths2.push(page.dirpath);
        } else {
          dirpaths.push(page.dirpath);
        }
      }
    else conflicts[0].dirpath = "";
    for (let dirpath of dirpaths2) {
      deflictDirpath(dirpath);
    }
  }

  function deflictDirpath(dirpath) {
    var pages = topNav.children, from = 0,
    conflicts = [], dirpaths = [], dirpaths2 = [];

    for (let page of pages)
      if (page.dirpath === dirpath)
        conflicts.push(page);
    if (conflicts.length < 2) return;
    
    while (true) {
      let toBreak = false, dirpath = calcDirpath(conflicts[0], from);

      dirpaths.length = 0;
      dirpaths2.length = 0;
      for (let page of conflicts) {
        page.dirpath = calcDirpath(page, from);
        if (page.dirpath !== dirpath) toBreak = true;
        if (dirpaths.includes(page.dirpath)) {
          if (!dirpaths2.includes(page.dirpath)) dirpaths2.push(page.dirpath);
        } else {
          dirpaths.push(page.dirpath);
        }
      }
      if (toBreak) break;
      from++;
    }
    if (dirpaths2.length) for (let to = from + 2; dirpaths2.length; to++) {
      dirpaths.length = 0;
      dirpaths2.length = 0;
      for (let page of conflicts) {
        page.dirpath = calcDirpath(page, from, to);
        if (dirpaths.includes(page.dirpath)) {
          if (!dirpaths2.includes(page.dirpath)) dirpaths2.push(page.dirpath);
        } else {
          dirpaths.push(page.dirpath);
        }
      }
    }
  }

  function calcDirpath(page, from = 0, to = from + 1) {
    var parentNode = page.file.parentNode.parentNode;

    if (parentNode === Folder.root) return "/";
    
    var i = 0, start = "/…/", names = [], end = from ? "/…" : "";

    while (true) {
      if (i >= from) names.unshift(parentNode.name);
      i++;
      parentNode = parentNode.parentNode.parentNode;
      if (i === to && parentNode === Folder.root) {
        start = "/";
        break;
      } 
      if (i === to || parentNode === Folder.root) break;
    }

    return start + names.join("/") + end;
  }

  topNav.deflict = deflict;

  async function openPage(file) {
    var unpined = topNav.querySelector(".unpined"),
        activePage = topNav.querySelector(".active"),
        page = await getPage(file), pages = topNav.children;

    if (!topNav.contains(page)) {
      if (activePage) {
        if (unpined) {
          if (unpined === activePage) {
            unpined.replaceWith(page);
            unpined.close();
          } else {
            unpined.close();
            for (let p of pages) if (p.index > unpined.index) p.index--;
            activePage.after(page);
          }
        } else {
          activePage.after(page);
        }
      } else {
        topNav.append(page);
      }
      page.index = pages.length - 1;
      activePage?.classList.remove("active");
      page.classList.add("unpined");
      deflict(page.name);
      page.open();
    } else {
      if (activePage !== page) {
        if (activePage) {
          for (let p of pages) if (p.index > page.index) p.index--;
          page.index = pages.length - 1;
          activePage.classList.remove("active");
          page.open();
        } else {
          page.open();
        }
      }
    }
  }

  topNav.openPage = page => {
    if (!page) return;
    openPage(page.file);
  };

  topNav.forward = () => {
    var pages = topNav.children,
        activePage = topNav.querySelector(".active"),
        targetPage;

    if (pages.length < 2) return;

    for (let p of pages) {
      if (p.index === 0) targetPage = p;
      else p.index--;
    }

    targetPage.index = pages.length - 1;
    activePage.classList.remove("active");
    targetPage.file.select();
  };
  topNav.backward = () => {
    var pages = topNav.children,
        activePage = topNav.querySelector(".active"),
        targetPage;

    if (pages.length < 2) return;

    for (let p of pages) {
      if (p.index === pages.length - 2) targetPage = p;
      p.index++;
    }

    activePage.index = 0;
    activePage.classList.remove("active");
    targetPage.file.select();
  };
  topNav.downward = () => {
    topNav.querySelector(".active")?.closeBtn.click();
  };
  topNav.upward = () => {
    var pageCache = topNav.pageCache, length = pageCache.length,
        page;

    if (!length) return;
    page = pageCache[length - 1];
    page.file.select();
    setTimeout(() => page.pin());
  };

  topNav.pageCache = [];

  topNav.recordPages = () => {
    var pages = topNav.children, arr = [];

    for (let p of pages) {
      if (p.classList.contains("unpined")) arr.push({index: p.index, inode: p.inode, unpined: true});
      else arr.push({index: p.index, inode: p.inode});
    }

    localStorage["--a-pages"] = JSON.stringify(arr);
    topNav.updateScroll();
  }

  (async () => {
    try {
      let paths = JSON.parse(localStorage["--a-pages"]),
          result = JSON.parse(await Sse.send("send.es", {
            action: "of-path",
            paths
          }));

      for (let pageInfo of result)
        if (!pageInfo.path)
          for (let p of result) 
            if (p.index > pageInfo.index) p.index--;

      for (let pageInfo of result) {
        if (!pageInfo.path) continue;

        let file = await Folder.root.findByPath(pageInfo.path),
            page = await getPage(file);

        if (pageInfo.unpined) page.classList.add("unpined");

        page.index = pageInfo.index;
        topNav.append(page);
        deflict(page.name);
      }

      for (let page of topNav.children)
        if (page.index === topNav.children.length - 1) {
          page.file.select();
          break;
        }

      topNav.updateScroll();
    } catch (error) {
    }
  })();

  topNav.addEventListener("dragstart", event => {
    var page = event.target;

    event.dataTransfer.setData("text", location.origin + page.file.path);
    page.classList.add("dragstart");
    topNav.dragged = page;
    setTimeout(() => page.classList.remove("dragstart"));
  });
  topNav.addEventListener("dragenter", event => {
    var dragged = topNav.dragged, 
        target = event.target,
        page = target.closest("a-page");

    event.preventDefault();
    if (!dragged || !page || dragged === page) return;
    if (!page.classList.contains("drag")) {
      topNav.querySelector("a-page.drag")?.classList.remove("drag");
      page.classList.add("drag");
    }
  });
  topNav.addEventListener("dragover", event => {
    event.preventDefault();
  });
  topNav.addEventListener("dragleave", event => {
    var dragged = topNav.dragged,
        relatedTarget = event.relatedTarget;

    if (!dragged) return;
    if ((!relatedTarget || !relatedTarget.closest("a-page.drag")))
      topNav.querySelector("a-page.drag")?.classList.remove("drag");
  });
  topNav.addEventListener("drop", event => {
    var dragged = topNav.dragged,
        page = topNav.querySelector("a-page.drag");

    if (!dragged || !page) return;

    for (let child of topNav.children) {
      if (child === dragged) {
        page.after(dragged);
        topNav.recordPages();
        break;
      } else if (child === page) {
        page.before(dragged);
        topNav.recordPages();
        break;
      }
    }
  });
  topNav.addEventListener("dragend", () => {
    topNav.dragged = undefined;
    topNav.querySelector("a-page.drag")?.classList.remove("drag");
  });
  topNav.addEventListener("wheel", function (event) {
    var delta = event.deltaY || event.deltaX;

    if (this.offsetWidth === this.scrollWidth) return;

    if (Math.abs(delta) >= 100) delta *= 0.2;

    this.scrollLeft += delta;
  }, {passive: true});

  sideNav.addEventListener("fileselect", event => {
    openPage(event.detail);
  });

  const navContainer = create("div", {class: "nav-container"});

  navContainer.append(topNav, create("a-sliderx", {}, scrollBar => {
    var ended = false;

    scrollBar.linkedElem = topNav;

    navContainer.addEventListener("transitionstart", function updateScroll(event) {
      ended = false;
      requestAnimationFrame(() => {
        topNav.updateScroll();
        if (!ended) updateScroll();
      });
    }, true);
    navContainer.addEventListener("transitionend", () => ended = true, true);
  }));

  document.body.append(navContainer);
});