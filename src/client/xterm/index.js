
import { Terminal } from "@xterm/xterm";
import { AttachAddon } from "@xterm/addon-attach";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";

let isFocused = false;

function createTerminal() {
  const webSocket = new WebSocket(location.origin.replace("http", "ws") + location.pathname.slice(0, location.pathname.lastIndexOf("/") + 1) + "pty.es");
  const terminal = new Terminal();
  const fitAddon = new FitAddon();
  const searchAddon = new SearchAddon();

  terminal.options = {
    lineHeight: 1.1,
    fontSize: 14,
    fontFamily: "consolas, monospace"
  };
  terminal.loadAddon(new AttachAddon(webSocket));
  terminal.loadAddon(new WebLinksAddon());
  terminal.loadAddon(searchAddon);
  terminal.loadAddon(fitAddon);
  terminal.onResize(size => webSocket.send(JSON.stringify(size)));
  terminal.attachCustomKeyEventHandler(ev => {
    if (!ev.ctrlKey) return true;
    if (ev.code === "KeyC" && terminal.hasSelection()) {
      setTimeout(() => terminal.clearSelection());
      return false;
    }
    if (ev.code === "KeyV") return false;
    if (ev.code === "KeyF") return false;
    if (ev.code === "KeyG") return false;
  });
  terminal.fit = () => fitAddon.fit();
  webSocket.onopen = () => {
    fitAddon.fit();
    webSocket.send(JSON.stringify({action: "refresh", cols: terminal._core.cols, rows: terminal._core.rows}));
    if (isFocused) terminal.focus();
  };

  terminal.webSocket = webSocket;
  terminal.fitAddon = fitAddon;
  terminal.searchAddon = searchAddon;

  return terminal;
}

function connectTerminal(xterm) {
  const terminal = createTerminal();
  
  terminal.open(xterm.inner);
  terminal.webSocket.onclose = () => {
    requestAnimationFrame(() => {
      isFocused = xterm.contains(document.activeElement);
      xterm.terminal.dispose();
      connectTerminal(xterm);
    });
  };
  xterm.terminal = terminal;
}

export function createXterm() {
  const xterm = document.createElement("div");
  const inner = document.createElement("div");

  xterm.inner = inner;

  xterm.className = "term-wrapper";
  inner.className = "term-inner";

  connectTerminal(xterm);
  xterm.fit = () => xterm.terminal.fitAddon.fit();
  xterm.exec = data => {
    xterm.terminal.webSocket.send(data + "\r");
    if (xterm.terminal.hasSelection()) xterm.terminal.clearSelection();
  };
  xterm.clear = () => {
    xterm.exec(String.fromCodePoint(23) + "clear");
    xterm.terminal.clear();
  };
  xterm.quit = () => {
    xterm.terminal.webSocket.send(String.fromCodePoint(3));
    if (xterm.terminal.hasSelection()) xterm.terminal.clearSelection();
  };
  xterm.dispose = () => {
    isFocused = xterm.contains(document.activeElement);
    xterm.terminal.dispose();
    xterm.terminal.webSocket.close();
    xterm.remove();
  };
  xterm.append(inner);
  xterm.append((() => {
    var searchBar = document.createElement("div");
    searchBar.className = "xterm-search-bar";

    var searchBarInput = document.createElement("input");
    searchBarInput.placeholder = "Search…";
    searchBarInput.autocomplete = "off";
    searchBarInput.id = "xterm-search-input";
    searchBarInput.spellcheck = false;
    searchBar.append(searchBarInput);

    var searchOptionBox = document.createElement("div");
    searchOptionBox.className = "xterm-search-options";
    var toggleCaseBtn = document.createElement("button");
    toggleCaseBtn.textContent = "Aa";
    var toggleWholeWBtn = document.createElement("button");
    toggleWholeWBtn.textContent = "W";
    var toggleRegexBtn = document.createElement("button");
    toggleRegexBtn.textContent = ".*";
    searchOptionBox.append(toggleCaseBtn, toggleWholeWBtn, toggleRegexBtn);
    searchBar.append(searchOptionBox);

    var searchActionBox = document.createElement("div");
    searchActionBox.className = "xterm-search-actions";
    var searchPrevBtn = document.createElement("button");
    searchPrevBtn.textContent = "↑";
    var searchNextBtn = document.createElement("button");
    searchNextBtn.textContent = "↓";
    var searchCloseBtn = document.createElement("button");
    searchCloseBtn.textContent = "x";
    searchActionBox.append(searchPrevBtn, searchNextBtn, searchCloseBtn);
    searchBar.append(searchActionBox);

    let opts = {
      caseSensitive: false,
      regex: false,
      wholeWord: false
    };

    searchBar.onclick = event => searchBarInput.focus();

    searchBarInput.onblur = event => {
      if (!searchBar.contains(event.relatedTarget)) searchBar.style.display = 'none';
    };

    searchBarInput.onkeydown = event => {
      const key = event.key.toLowerCase();
      if (key === 'enter') {
        if (event.shiftKey) xterm.terminal.searchAddon.findPrevious(searchBarInput.value, opts);
        else xterm.terminal.searchAddon.findNext(searchBarInput.value, opts);
        return;
      }
      if (key === "escape") {
        searchCloseBtn.click();
        return;
      }
      if (!event.ctrlKey) return;
      if (key === "g") {
        event.preventDefault();
        if (event.shiftKey) xterm.terminal.searchAddon.findPrevious(searchBarInput.value, opts);
        else xterm.terminal.searchAddon.findNext(searchBarInput.value, opts);
      } else if (key === "f") {
        event.preventDefault();
        searchBarInput.select();
      }
    };

    searchBarInput.oninput = () => {
      xterm.terminal.searchAddon.findNext(searchBarInput.value, opts);
    };

    toggleCaseBtn.onclick = () => {
      opts.caseSensitive = !opts.caseSensitive;
      toggleCaseBtn.classList.toggle('active');
      xterm.terminal.searchAddon.findNext(searchBarInput.value, opts);
    };

    toggleRegexBtn.onclick = () => {
      opts.regex = !opts.regex;
      toggleRegexBtn.classList.toggle('active');
      xterm.terminal.searchAddon.findNext(searchBarInput.value, opts);
    };

    toggleWholeWBtn.onclick = () => {
      opts.wholeWord = !opts.wholeWord;
      toggleWholeWBtn.classList.toggle('active');
      xterm.terminal.searchAddon.findNext(searchBarInput.value, opts);
    };

    searchNextBtn.onclick = () => {
      xterm.terminal.searchAddon.findNext(searchBarInput.value, opts);
    };

    searchPrevBtn.onclick = () => {
      xterm.terminal.searchAddon.findPrevious(searchBarInput.value, opts);
    };

    searchCloseBtn.onclick = () => {
      searchBar.style.display = 'none';
      xterm.terminal.focus();
    };

    xterm.terminal.textarea.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();
      if (event.ctrlKey && (key === 'f' || key === 'g')) {
        searchBar.style.display = 'flex';
        const selection = xterm.terminal.getSelection();
        if (!selection.includes("\n")) searchBarInput.value = selection;
        searchBarInput.select();
        event.preventDefault();
      }
    });

    return searchBar;
  })());

  return xterm;
}
