const path = require("path");

module.exports = {
  ROOT: path.resolve(process.argv[2] || "").replaceAll("\\", "/"),
  PORT: process.argv[3] || 80
};