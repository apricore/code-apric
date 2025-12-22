const pathname = `/${path.basename(__dirname)}/`;

if (req._parsedUrl.pathname !== pathname) res.redirect(pathname);
return `<!DOCTYPE HTML>
<html>
<head>
<title>Code Apricore</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="index.css"/>
<link rel="stylesheet" href="xterm.css"/>
<script type="module" src="index.js"></script>
</head>
<body>
<script>
${process.platform === "win32" ? `C_FILE = "a.exe"; PYTHON = "python";` : `C_FILE = "a.out"; PYTHON = "python3";`}
try {
  let setting = JSON.parse(localStorage["--ap-setting"]);
  if (setting.theme) document.body.classList.add("dark");
} catch (error) {
  document.body.classList.add("dark");
}
</script>
</body>
</html>`;