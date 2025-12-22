const action = req.body?.action;
let output;

if (action === "read-dir") output = root.readDir(req.body.path);
else if (action === "of-inode") output = root.getInodeSafe(req.body.path);
else if (action === "rename-dir") output = root.rename(req.body.name, req.body.path);
else if (action === "rename-file") output = root.rename(req.body.name, req.body.path);
else if (action === "create-dir") output = root.makeDir(req.body.path);
else if (action === "create-file") output = root.createFile(req.body.path);
else if (action === "compress-file") output = root.compressFiles(req.body.paths, req.body.path);
else if (action === "extract-file") output = root.extractFile(req.body.path);
else if (action === "move-file") output = root.moveFiles(req.body.paths, req.body.path).join("\n");
else if (action === "copy-file") output = root.copyFiles(req.body.paths, req.body.path);
else if (action === "delete-file") output = root.deleteFiles(req.body.paths).join("\n");
else if (action === "of-path") output = root.ofPath(req.body.paths)
else if (action === "read-file") output = root.readFile(req.body.inode);
else if (action === "write-file") output = root.writeFile(req.body.inode, req.body.version, req.body.updates);
else if (action === "save-file") output = root.saveFile(req.body.inode);
else if (action === "clean-file") output = root.cleanFile(req.body.inode);
else output = "!nvalid action: " + action;

return output ?? "";