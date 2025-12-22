const fs = require("fs");
const path = require("path");
const util = require("util");

module.exports = {
  isBinary(buf) {
    var str = buf.hexSlice(0, Math.min(buf.length, 100));
    for (let i = 0, chars; i < str.length / 2; i++) {
      chars = str.slice(i * 2, i * 2 + 2)
      if (chars[0] < 2) {
        if (chars[0] == 0) {
          if ("a9d".indexOf(chars[1]) === -1) {
            return true;
          }
        } else {
          return true;
        }
      }
    }
    return false;
  },
  isDotfile(filePath) {
    const base = path.basename(filePath);
    return base.startsWith(".") && base !== "." && base !== "..";
  },
  createFolder(dirPath) {
    let dirname = path.dirname(dirPath);
    if (!fs.existsSync(dirname)) module.exports.createFolder(dirname);
    fs.mkdirSync(dirPath);
  },
  inspect(obj) {
    return util.inspect(obj, {
      showHidden: false,
      depth: 2,
      colors: false,
      compact: true
    });
  }
};