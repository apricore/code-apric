import { create } from "../utils";

customElements.define("a-dialog", class extends HTMLElement {
  connectedCallback() {
    if (this.rendered) return;
    var {title, message, input, buttons, ok, cancel} = this;
    var finalize = event => {
      if (event && this.contains(event.target)) return;
      window.removeEventListener("click", finalize, {capture: true});
      this.#resolve();
      if (!event) buttons.firstElementChild?.click();
      this.className = "off";
      input.onblur = null;
      ok.onblur = null;
      setTimeout(activeElement.focus.bind(activeElement));
    };
    var activeElement;
    var initialize = (ttl, msg) => {
      activeElement = document.activeElement;
      title.innerHTML = ttl;
      message.innerHTML = msg;
      input.value = msg;
      buttons.innerHTML = "";
      this.innerHTML = "";
      this.className = "off";
      requestAnimationFrame(() => this.className = "on");
    };
    this.alert = function (ttl = "", msg = "") {
      initialize(ttl, msg);
      buttons.append(ok);
      this.append(title, message, buttons);
      input.onblur = null;
      ok.onblur = ok.focus;
      ok.focus();
      return new Promise(resolve => {
        cancel.onclick = ok.onclick = () => resolve();
        this.#resolve = resolve.bind(null);
      }).finally(finalize);
    };
    this.confirm = function (ttl = "", msg = "") {
      initialize(ttl, msg, cancel, ok);
      buttons.append(cancel, ok);
      this.append(title, message, buttons);
      input.onblur = null;
      ok.onblur = ok.focus;
      ok.focus();
      return new Promise(resolve => {
        ok.onclick = () => resolve(true);
        cancel.onclick = () => resolve(false);
        this.#resolve = resolve.bind(null, false);
      }).finally(finalize);
    };
    this.prompt = function (ttl = "", msg = "") {
      initialize(ttl, msg, cancel, ok);
      buttons.append(cancel, ok);
      this.append(title, input, buttons);
      ok.onblur = null;
      input.onblur = input.focus;
      input.select();
      return new Promise(resolve => {
        ok.onclick = () => resolve(input.value);
        cancel.onclick = () => resolve(null);
        this.#resolve = resolve.bind(null, null);
      }).finally(finalize);
    };
    this.addEventListener("transitionend", event => {
      if (this.className === "off")
        this.className = "";
      else if (event.propertyName === "top" && this.className === "on")
        window.addEventListener("click", finalize, {capture: true});
    });
    input.onkeydown = event => {
      if (event.key === "Enter") ok.click();
      else if (event.key === "Escape") cancel.click();
    };
    ok.onkeydown = event => {
      if (event.key === "Enter") ok.click();
      else if (event.key === "Escape") cancel.click();
      return false;
    };
    this.rendered = true;
  }
  title = create("p", {class: "heading"});
  message = create("p", {class: "content"});
  input = create("input", {}, elem => elem.onkeypress = event => {
    if (event.key === "Enter") this.ok.click()
  });
  buttons = create("div");
  ok = create("button", {class: "ok"}, elem => elem.innerText = "Ok");
  cancel = create("button", {class: "cancel"}, elem => elem.innerText = "Cancel");
  rendered = false;
  #resolve;
});

export const dialog = create("a-dialog", {}, dialog => document.body.append(dialog));