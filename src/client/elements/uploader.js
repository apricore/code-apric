import { create, Queue } from "../utils";
import { dialog } from "./dialog";

export const uploader = create("div", {class: "uploader"}, uploader => {
  var title = create("div", {
        class: "uploader-title"
      }),
      barTrack = create("div", {
        class: "uploader-bar-track"
      }),
      bar = create("div", {
        class: "uploader-bar"
      }), 
      leftBottom = create("div", {
        class: "uploader-left-bottom"
      }), 
      speedSpan = create("span"),
      currentSize = create("span"),
      totalSize = create("span"),
      rightBottom = create("div", {
        class: "uploader-right-bottom"
      }),
      countSpan = create("span"),
      numberSpan = create("span");

  title.innerText = "";
  speedSpan.innerText = "0 B";
  currentSize.innerText = "0 B";
  totalSize.innerText = "0 B";
  countSpan.innerText = "0";
  numberSpan.innerText = "0";

  bar.style.width = "0%";

  barTrack.append(bar);

  leftBottom.append(speedSpan, "/s - ", currentSize, " of ", totalSize);

  rightBottom.append(countSpan, " / ", numberSpan);

  uploader.append(title, barTrack, leftBottom, rightBottom);

  var fileUploader = create("input", {type: "file", multiple: ""}),
      dirUploader = create("input", {
        type: "file",
        multiple: "",
        directory: "",
        webkitdirectory: "",
        mozdirectory: ""
      }),
      xhttp = new XMLHttpRequest,
      filesToUpload = [],
      count = 0,
      number = 0,
      prevLoad = 0,
      started = false,
      dirpath = "/",
      upload = Queue.syncCall((path, file, resolve, reject) => {
        xhttp.open("POST", "/upload");
        xhttp.setRequestHeader("file-path", encodeURIComponent(path));
        xhttp.onload = () => {
          if (xhttp.status === 200) resolve(xhttp.response)
          else reject(xhttp.status + " " + xhttp.statusText);              
          currentSize.innerText = "0 B";
          bar.style.width = "0%";
          prevLoad = 0;
        };
        xhttp.onerror = error => {
          reject(error);
        };
        xhttp.ontimeout = () => {
          reject("timeout");
        };
        xhttp.upload.addEventListener("progress", event => {
          totalSize.innerText = sizeOf(event.total);
        }, {once: true});
        xhttp.upload.onprogress = event => {
          bar.style.width = (event.loaded / event.total * 100) + "%";
          currentSize.innerText = sizeOf(event.loaded);
          speedSpan.innerText = sizeOf(event.loaded - prevLoad);
          prevLoad = event.loaded;
        };
        xhttp.upload.onload = () => {
          bar.style.width = 100 + "%";
          currentSize.innerText = totalSize.innerText;
        };
        title.innerText = path;
        count++;
        countSpan.innerText = count;
        xhttp.send(file);
      });

  function sizeOf(value) {
    var i, units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    for (i = 0; value > 1024; i++, value /= 1024);

    return value.toFixed(1) + " " + units[i];
  }

  async function startUpload() {
    var entry;

    while (entry = filesToUpload.shift()) {
      try {
        let response = await upload(...entry);

        if (response !== "1") throw response;
      } catch (error) {
        dialog.alert(`<span style='color: red'>Error uploading files:</span>`, error);
      }
    }

    title.innerText = "";
    speedSpan.innerText = "0 B";
    totalSize.innerText = "0 B";
    countSpan.innerText = "0";
    numberSpan.innerText = "0";

    count = 0;
    number = 0;
    started = false;
    dirpath = "/";
    uploader.remove();
  }

  fileUploader.addEventListener("change", () => {
    for (let file of fileUploader.files) {
      filesToUpload.push([dirpath + file.name, file]);
      number++;
    }

    numberSpan.innerText = number;

    if (!started) {
      startUpload();
      started = true;
      document.body.append(uploader);
    }

    fileUploader.value = "";
  });
  dirUploader.addEventListener("change", () => {
    for (let file of dirUploader.files) {
      filesToUpload.push([dirpath + file.webkitRelativePath, file]);
      number++;
    }

    numberSpan.innerText = number;

    if (!started) {
      startUpload();
      started = true;
      document.body.append(uploader);
    }

    dirUploader.value = "";
  });

  uploader.uploadFile = path => {
    dirpath = path;
    fileUploader.click();
  };
  uploader.uploadDir = path => {
    dirpath = path;
    dirUploader.click();
  };
  uploader.upload = (files, path) => {
    for (let file of files) {
      filesToUpload.push([path + file.name, file]);
      number++;
    }
    numberSpan.innerText = number;
    if (!started) {
      startUpload();
      started = true;
      document.body.append(uploader);
    }
  };
});