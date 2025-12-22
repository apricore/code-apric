const app = require("express")();
const path = require("path");
const express = require('express');
const { handleEs, handleStatic, handleError } = require("./middleware");

app.use(require("./routes"));
app.use(express.json({limit: Infinity}));
app.use(express.urlencoded({extended: true, limit: Infinity}));
app.use(handleEs);
app.use(express.static(path.join(__dirname, '../../public')));
app.use(handleStatic);
app.use(handleError);

module.exports = app;