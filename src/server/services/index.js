const pty = { sockets: new Set() };

(function createTerminalProcess(code, signal) {
  const nodePty = require("node-pty");
  const treeKill = require("tree-kill");
  const { ROOT } = require("../config");

  pty.process = nodePty.spawn(process.platform === "win32" ? "powershell.exe" : "bash", [], {
    name: "xterm-color",
    cwd: ROOT,
    env: process.env
  });
  pty.process.on("exit", createTerminalProcess);
  pty.process.on("data", function (data) {
    pty.sockets.forEach(function (ws) {
      ws.send(data);
    });
  });
  pty.addMember = function (ws) {
    pty.sockets.add(ws);
    ws.on("message", function (message) {
      if (message[0] === 123 && message[1] === 34) try {
        let msgObj = JSON.parse(message);
        switch (msgObj.action) {
          case "refresh":
            pty.process.resize(++msgObj.cols, msgObj.rows);
            return;
          case "restart":
            treeKill(pty.process._pid, 'SIGKILL', err => {});
            return;
          default:
            pty.process.resize(msgObj.cols, msgObj.rows);
            return;
        }
      } catch (err) {
      }
      pty.process.write(message);
    });
    ws.on("close", function () {
      pty.sockets.delete(ws);
    });
  };
})();

module.exports = {
  eval: $ => eval(`(async () => {with ($) {${$.content}\n}})()`),
};
