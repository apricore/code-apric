
import { Terminal } from "@xterm/xterm";
import { AttachAddon } from "@xterm/addon-attach";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";

export function createXterm() {
  const webSocket = new WebSocket(location.origin.replace("http", "ws") + location.pathname.slice(0, location.pathname.lastIndexOf("/") + 1) + "pty.es");
  const terminal = new Terminal();
  const fitAddon = new FitAddon();

  terminal.options = {
    lineHeight: 1.1,
    fontSize: 14,
    fontFamily: "consolas, monospace"
  };
  terminal.loadAddon(new AttachAddon(webSocket));
  terminal.loadAddon(new WebLinksAddon());
  terminal.loadAddon(fitAddon);
  terminal.onResize(size => webSocket.send(JSON.stringify(size)));
  terminal.attachCustomKeyEventHandler(ev => {
    if (!ev.ctrlKey) return true;
    if (ev.code === "KeyC" && terminal.hasSelection()) {
      setTimeout(() => terminal.clearSelection());
      return false;
    }
    if (ev.code === "KeyV") return false;
  });
  terminal.fit = () => fitAddon.fit();
  webSocket.onopen = () => {
    fitAddon.fit();
    webSocket.send(JSON.stringify({cols: terminal._core.cols, rows: terminal._core.rows}));
  };

  const xterm = document.createElement("div");
  const inner = document.createElement("div");

  xterm.className = "term-wrapper";
  inner.className = "term-inner";

  xterm.terminal = terminal;
  xterm.fit = () => fitAddon.fit();
  xterm.exec = data => {
    webSocket.send(data + "\r");
    if (terminal.hasSelection()) terminal.clearSelection();
  };
  xterm.clear = () => {
    xterm.exec(String.fromCodePoint(23) + "clear");
    terminal.clear();
  };
  xterm.quit = () => {
    webSocket.send(String.fromCodePoint(3));
    if (terminal.hasSelection()) terminal.clearSelection();
  };
  xterm.dispose = () => {
    terminal.dispose();
    webSocket.close();
    xterm.remove();
  };
  terminal.open(inner);
  xterm.append(inner);
  
  return xterm;
}
