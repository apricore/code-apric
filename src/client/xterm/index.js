
import { Terminal } from "@xterm/xterm";
import { AttachAddon } from "@xterm/addon-attach";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";

let isFocused = false;

export function createXterm() {
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
  if (event.code === "KeyV") return false;
  if (event.code === "KeyF") return false;
  if (event.code === "KeyG") return false;
  });
  terminal.fit = () => fitAddon.fit();
  webSocket.onopen = () => {
    fitAddon.fit();
    webSocket.send(JSON.stringify({action: "refresh", cols: terminal._core.cols, rows: terminal._core.rows}));
    if (isFocused) terminal.focus();
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
    isFocused = xterm.contains(document.activeElement);
    terminal.dispose();
    webSocket.close();
    xterm.remove();
  };
  terminal.open(inner);
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
        if (event.shiftKey) searchAddon.findPrevious(searchBarInput.value, opts);
        else searchAddon.findNext(searchBarInput.value, opts);
        return;
      }
      if (key === "escape") {
        searchCloseBtn.click();
        return;
      }
      if (!event.ctrlKey) return;
      if (key === "g") {
        event.preventDefault();
        if (event.shiftKey) searchAddon.findPrevious(searchBarInput.value, opts);
        else searchAddon.findNext(searchBarInput.value, opts);
      } else if (key === "f") {
        event.preventDefault();
        searchBarInput.select();
      }
    };

    searchBarInput.oninput = () => {
      searchAddon.findNext(searchBarInput.value, opts);
    };

    toggleCaseBtn.onclick = () => {
      opts.caseSensitive = !opts.caseSensitive;
      toggleCaseBtn.classList.toggle('active');
      searchAddon.findNext(searchBarInput.value, opts);
    };

    toggleRegexBtn.onclick = () => {
      opts.regex = !opts.regex;
      toggleRegexBtn.classList.toggle('active');
      searchAddon.findNext(searchBarInput.value, opts);
    };

    toggleWholeWBtn.onclick = () => {
      opts.wholeWord = !opts.wholeWord;
      toggleWholeWBtn.classList.toggle('active');
      searchAddon.findNext(searchBarInput.value, opts);
    };

    searchNextBtn.onclick = () => {
      searchAddon.findNext(searchBarInput.value, opts);
    };

    searchPrevBtn.onclick = () => {
      searchAddon.findPrevious(searchBarInput.value, opts);
    };

    searchCloseBtn.onclick = () => {
      searchBar.style.display = 'none';
      terminal.focus();
    };

    terminal.textarea.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();
      if (event.ctrlKey && (key === 'f' || key === 'g')) {
        searchBar.style.display = 'flex';
        const selection = terminal.getSelection();
        if (!selection.includes("\n")) searchBarInput.value = selection;
        searchBarInput.select();
        event.preventDefault();
      }
    });

    return searchBar;
  })());
  // <div id="search-bar">
  //   <input id="search-input" placeholder="Search…" autocomplete="off" spellcheck="false" />
  //   <div id="option-box">
  //     <button id="toggle-case">Aa</button>
  //     <button id="toggle-whole">W</button>
  //     <button id="toggle-regex">.*</button>
  //   </div>
  //   <div id="action-box">
  //     <button id="search-prev">↑</button>
  //     <button id="search-next">↓</button>
  //     <button id="search-close">x</button>
  //   </div>
  // </div>
  
  return xterm;
}
