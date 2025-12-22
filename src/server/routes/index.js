const express = require('express');
const router = express.Router();
const controller = require("../controllers");

router.post("/upload", controller.upload);
router.get("/download", controller.download);

module.exports = router;