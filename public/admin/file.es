var code = req.headers["sse-code"];
var dirpath = req.body?.path;
var inode = req.body?.inode;
var sse = storage[code];

if (sse) {
  if (sse[inode]) return;

  let file = root[inode], handler = function (type, data) {
    if (type === "edited") {
      sse.write(`event: ${inode}-edited\n` + "data: " + JSON.stringify(data) + "\n\n");
    } else if (type === "saved") {
      sse.write(`event: ${inode}-saved\n` + "data: " + "\n\n");
    } else if (type === "renamed") {
      sse.write(`event: ${inode}-renamed\n` + "data: " + data + "\n\n");
    } else if (type === "retyped") {
      sse.write(`event: ${inode}-retyped\n` + "data: " + data + "\n\n");
    } else if (type === "belonged") {
      sse.write(`event: ${inode}-belonged\n` + "data: " + JSON.stringify(data) + "\n\n");
    } else if (type === "deleted") {
      sse.write(`event: ${inode}-deleted\n` + "data: " + "\n\n");
      sse.finishSet.delete(finish);
      finish();
    }
  }, finish = (err, res) => {
    delete sse[inode];
    file[root.$off](handler);
  };

  sse.write(`event: ${inode}-loaded\n` + "data: " + "\n\n");

  file[root.$on](handler);

  sse.finishSet.add(finish);

  sse[inode] = true;
}
return "";