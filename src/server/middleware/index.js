const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const { isBinary, inspect } = require('../utils');
const { ROOT } = require("../config");
const { handleEs } = require('../controllers');

const public = path.join(__dirname, "../../../public").replaceAll("\\", "/");

module.exports = {
  handleEs: (req, res, next) => {
    let origin = public;
    let location = origin + req._parsedUrl.pathname;
    if (!fs.existsSync(location)) {
      origin = ROOT;
      location = origin + req._parsedUrl.pathname;
    }
    if (fs.existsSync(location)) {
      let stat = fs.statSync(location);
      if (stat.isDirectory()) {
        location = path.join(location, "index.es");
      }
      if (path.extname(location).toLowerCase() === ".es" && fs.existsSync(location)) {
        let buf = fs.readFileSync(location);
        if (!isBinary(buf)) {
          return handleEs(req, res, buf.toString(), origin, location);
        }
      }
    }
    next();
  },

  handleStatic: (req, res, next) => {
    var pathname = decodeURIComponent(req.path);
    var extname =  path.extname(pathname).toLowerCase();
    var location = ROOT + pathname;
    var buf;
    if (fs.existsSync(location)) {
      let stat = fs.statSync(location);
      
      if (stat.isFile()) buf = fs.readFileSync(location);
      else {
        res.sendFile(location);
        return;
      }
    } else {
      next();
      return;
    }
    if (isBinary(buf)) res.sendFile(location);
    else switch (extname) {
      case ".html": case ".htm": case ".css": case ".js": case ".svg":
      case ".xml": case ".dtd": case ".xsd": case ".pdf":
        res.sendFile(location);
      break;
      case ".md":
        res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="/admin/markdown.css"/>
</head>
<body class="markdown-body">
${marked(buf.toString())}</body>
</html>`);
      break;
      default:
        res.type("text/plain");
        res.end(buf.toString());
    }
  },

  handleError: (err, req, res, next) => {
    res.status(500).type("text/plain").send(inspect(err));
  }
};