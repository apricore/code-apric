const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const onFinished = require("on-finished");
const service = require('../services');
const { isDotfile, createFolder, inspect } = require('../utils');
const { ROOT } = require("../config");
const { root, storage } = require('../models');

module.exports = {
  upload: (req, res) => {try {
    let location = req.headers["file-path"];
    if (!location) res.end();
    location = path.join(ROOT, decodeURIComponent(location));
    if (fs.existsSync(location)) res.end(`There alrady exists a file named ${path.basename(location)}.`);
    else try {
      if (!fs.existsSync(path.dirname(location))) createFolder(path.dirname(location));
      let fileStream = fs.createWriteStream(location, { flags: 'w' });
      fileStream.on("close", () => res.end("1"));
      fileStream.on("error", error => res.end(error));
      req.pipe(fileStream);
    } catch (error) {
      console.log(error);
      res.end(String(error));
    }
  } catch (error) {
    console.log(error);
  }
  },

  download: (req, res) => {
    const fpath = req.query.path;
    if (fpath) {
      let realpath = path.join(ROOT, decodeURIComponent(fpath));
      if (fs.existsSync(realpath)) {
        if (fs.statSync(realpath).isDirectory()) {
          let zip = new AdmZip(), basename = path.basename(realpath);
          
          zip.addLocalFolder(realpath, basename);
          zip.writeZip(path.resolve(realpath) + ".zip");

          onFinished(res, (err, res) => fs.unlinkSync(path.resolve(realpath) + ".zip"));
          res.download(path.resolve(realpath) + ".zip");
        } else {
          if (isDotfile(realpath)) {
            res.sendFile(realpath, {
              dotfiles: "allow",
              headers: {
                "Content-Disposition": `attachment; filename=\"${path.basename(realpath)}\"`
              }
            });
          } else {
            res.download(realpath);
          }
        }
      } else {
        res.end("File does not exist!");
      }
    } else {
      res.end();
    }
  },

  handleEs: async (req, res, content, origin, location) => {
    res.finishSet = new Set;
    onFinished(res, (err, res) => {
      for (let listener of res.finishSet) listener(err, res);
    });
    const output = await service.eval({req, res, content, origin, ROOT,
      __filename: location,
      __dirname: path.dirname(location),
      path, fs, inspect, root, storage
    });
    if (output !== undefined) res.send(output);
  }
};
