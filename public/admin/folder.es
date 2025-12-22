var code = req.headers["sse-code"];
var dirpath = req.body?.path;
var inode = req.body?.inode;
var sse = storage[code];

if (sse) {
  if (sse[inode]) return;

  let folder = root[inode], handler = function (type, data) {
    if (type === "refresh") {
      sse.write(`event: ${inode}-refresh\n` + "data: " + "\n\n");
    } else if (type === "renamed") {
      sse.write(`event: ${inode}-renamed\n` + "data: " + data + "\n\n");
    } else if (type === "owned") {
      sse.write(`event: ${inode}-owned\n` + "data: " + JSON.stringify(data) + "\n\n");
    } else if (type === "belonged") {
      sse.write(`event: ${inode}-belonged\n` + "data: " + JSON.stringify(data) + "\n\n");
    } else if (type === "deleted") {
      sse.write(`event: ${inode}-deleted\n` + "data: " + "\n\n");
      sse.finishSet.delete(finish);
      finish();
    }
  }, finish = (err, res) => {
    delete sse[inode];
    folder[root.$off](handler);
  };

  if (!folder) return "";

  sse.write(`event: ${inode}-loaded\n` + "data: " + JSON.stringify({name: path.basename(root.path + folder[root.$path])}) + "\n\n");

  folder[root.$on](handler);

  sse.finishSet.add(finish);

  sse[inode] = true;
}
return "";