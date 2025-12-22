import { create } from "../utils";

customElements.define("a-slidery", class extends HTMLElement {
  connectedCallback() {
    if (this.rendered) return;
    var slider = this.slider,
        thumb = this.thumb,
        shiftY, slideStart = event => {
          event.preventDefault();
          shiftY = event.clientY - thumb.getBoundingClientRect().top;
          thumb.setPointerCapture(event.pointerId);
          thumb.onpointermove = slide;
          this.dispatchEvent(new CustomEvent("slideStart"));
        }, slide = event => {
          let newTop = event.clientY - shiftY - slider.getBoundingClientRect().top,
              bottomEdge = slider.offsetHeight - thumb.offsetHeight;
          if (newTop < 0) newTop = 0;
          else if (newTop > bottomEdge) newTop = bottomEdge;
          thumb.style.top = Math.round(newTop) + "px";
          this.scrolling = true;
          this.dispatchEvent(new CustomEvent("slide", {
            detail: {
              slidedPortion: newTop / bottomEdge
            }
          }));
        };
    slider.className = "slider-trackY";
    slider.addEventListener("pointerdown", event => {
      if (event.target !== slider) return;
      let heigth = thumb.offsetHeight, bottomEdge = slider.offsetHeight - heigth,
          newTop = event.clientY - slider.getBoundingClientRect().top - heigth / 2;
      if (newTop < 0) newTop = 0;
      else if (newTop > bottomEdge) newTop = bottomEdge;
      thumb.style.top = Math.round(newTop) + "px";
      slideStart(event);
      this.dispatchEvent(new CustomEvent("slide", {
        detail: {
          slidedPortion: newTop / bottomEdge
        }
      }));
    });
    thumb.className = "slider-thumbY";
    thumb.onlostpointercapture = event => {
      thumb.onpointermove = null;
      this.scrolling = false;
      this.dispatchEvent(new CustomEvent("slideEnd"));
    };
    thumb.addEventListener("pointerdown", slideStart);
    thumb.ondragstart = () => false;
    slider.append(thumb);
    this.append(slider);
    this.addEventListener("update", event => {
      var portion = event.detail.slidedPortion, length = event.detail.length,
          maxHeight = slider.offsetHeight;
      if (portion > 1) portion = 1;
      else if (portion < 0) portion = 0;
      if (length < maxHeight) {
        if (length > 24) thumb.style.height = Math.round(length) + "px";
        else if (length === 0) {
          thumb.style.height = 0 + "px";
          this.style.visibility = "hidden";
        } else thumb.style.height = Math.round(Math.min(maxHeight / 2, 24)) + "px";
      } else {
        thumb.style.height = 0 + "px";
        this.style.visibility = "hidden";
      }
      var newTop = portion * (maxHeight - thumb.offsetHeight);
      thumb.style.top = Math.round(newTop) + "px";
    });
    this.scrolling = false;
    this.rendered = true;
    this.linkElement = elem => {
      var updateScroll = () => {
        this.style.visibility = "";
        this.dispatchEvent(new CustomEvent("update", {
          detail: {
            slidedPortion: elem.scrollTop / (elem.scrollHeight - elem.clientHeight),
            length: elem.clientHeight / elem.scrollHeight * slider.offsetHeight
          }
        }));
      };
      elem.updateScroll = updateScroll;
      elem.addEventListener("scroll", elem.updateScroll);
      this.addEventListener("slide", event => {
        elem.scrollTop = event.detail.slidedPortion * (elem.scrollHeight - elem.clientHeight);
      });
      window.addEventListener("resize", elem.updateScroll);
      elem.updateScroll();
      if (!this.linkedElem) this.linkedElem = elem;
    };
    this.addEventListener("touchmove", event => {
      event.preventDefault();
    }, { passive: false });
    if (this.linkedElem) this.linkElement(this.linkedElem);
  }
  slider = document.createElement("div");
  thumb = document.createElement("div");
  linkedElem;
  rendered = false;
});
customElements.define("a-sliderx", class extends HTMLElement {
  connectedCallback() {
    if (this.rendered) return;
    var slider = this.slider,
        thumb = this.thumb,
        shiftX, slideStart = event => {
          event.preventDefault();
          shiftX = event.clientX - thumb.getBoundingClientRect().left;
          thumb.setPointerCapture(event.pointerId);
          thumb.onpointermove = slide;
          this.dispatchEvent(new CustomEvent("slideStart"));
        }, slide = event => {
          let newLeft = event.clientX - shiftX - slider.getBoundingClientRect().left,
              rightEdge = slider.offsetWidth - thumb.offsetWidth;
          if (newLeft < 0) newLeft = 0;
          else if (newLeft > rightEdge) newLeft = rightEdge;
          thumb.style.left = Math.round(newLeft) + "px";
          this.scrolling = true;
          this.dispatchEvent(new CustomEvent("slide", {
            detail: {
              slidedPortion: newLeft / rightEdge
            }
          }));
        };
    slider.className = "slider-trackX";
    slider.addEventListener("pointerdown", event => {
      if (event.target !== slider) return;
      let heigth = thumb.offsetWidth, rightEdge = slider.offsetWidth - heigth,
          newLeft = event.clientX - slider.getBoundingClientRect().left - heigth / 2;
      if (newLeft < 0) newLeft = 0;
      else if (newLeft > rightEdge) newLeft = rightEdge;
      thumb.style.left = Math.round(newLeft) + "px";
      slideStart(event);
      this.dispatchEvent(new CustomEvent("slide", {
        detail: {
          slidedPortion: newLeft / rightEdge
        }
      }));
    });
    thumb.className = "slider-thumbX";
    thumb.onlostpointercapture = event => {
      thumb.onpointermove = null;
      this.scrolling = false;
      this.dispatchEvent(new CustomEvent("slideEnd"));
    };
    thumb.addEventListener("pointerdown", slideStart);
    thumb.ondragstart = () => false;
    slider.append(thumb);
    this.append(slider);
    this.addEventListener("update", event => {
      var portion = event.detail.slidedPortion, length = event.detail.length,
          maxWidth = slider.offsetWidth;
      if (portion > 1) portion = 1;
      else if (portion < 0) portion = 0;
      if (length < maxWidth) {
        if (length > 24) thumb.style.width = Math.round(length) + "px";
        else if (length === 0) {
          thumb.style.width = 0 + "px";
          this.style.visibility = "hidden";
        } else thumb.style.width = Math.round(Math.min(maxWidth / 2, 24)) + "px";
      } else {
        thumb.style.width = 0 + "px";
        this.style.visibility = "hidden";
      }
      var newLeft = portion * (maxWidth - thumb.offsetWidth);
      thumb.style.left = Math.round(newLeft) + "px";
    });
    this.scrolling = false;
    this.rendered = true;
    this.linkElement = elem => {
      var updateScroll = () => {
        this.style.visibility = "";
        this.dispatchEvent(new CustomEvent("update", {
          detail: {
            slidedPortion: elem.scrollLeft / (elem.scrollWidth - elem.clientWidth),
            length: elem.clientWidth / elem.scrollWidth * slider.offsetWidth
          }
        }));
      };
      elem.updateScroll = updateScroll;
      elem.addEventListener("scroll", elem.updateScroll);
      this.addEventListener("slide", event => {
        elem.scrollLeft = event.detail.slidedPortion * (elem.scrollWidth - elem.clientWidth);
      });
      window.addEventListener("resize", elem.updateScroll);
      elem.updateScroll();
      if (!this.linkedElem) this.linkedElem = elem;
    };
    this.addEventListener("touchmove", event => {
      event.preventDefault();
    }, { passive: false });
    if (this.linkedElem) this.linkElement(this.linkedElem);
  }
  slider = document.createElement("div");
  thumb = document.createElement("div");
  rendered = false;
});
if (/Chrome/.test(navigator.userAgent)) {
  customElements.define("a-resizerx", class extends HTMLElement {
    connectedCallback() {
      if (this.rendered) return;
      var initX, pointermove = event => {
        this.dispatchEvent(new CustomEvent("resize", {
          detail: event.clientX - initX
        }));
      };
      this.addEventListener("pointerdown", event => {
        event.preventDefault();
        this.classList.add("resize");
        this.setPointerCapture(event.pointerId);
        this.addEventListener("pointermove", pointermove);
        this.dispatchEvent(new CustomEvent("resizestart"));
      });
      this.addEventListener("gotpointercapture", event => {
        initX = event.clientX;
      });
      this.addEventListener("lostpointercapture", () => {
        this.classList.remove("resize");
        this.removeEventListener("pointermove", pointermove);
        this.dispatchEvent(new CustomEvent("resizeend"));
      });
      this.addEventListener("touchmove", event => {
        event.preventDefault();
      }, { passive: false });
      this.rendered = true;
    }
    rendered = false;
  });
  customElements.define("a-resizery", class extends HTMLElement {
    connectedCallback() {
      if (this.rendered) return;
      var initY, pointermove = event => {
        this.dispatchEvent(new CustomEvent("resize", {
          detail: event.clientY - initY
        }));
      };
      this.addEventListener("pointerdown", event => {
        event.preventDefault();
        this.classList.add("resize");
        this.setPointerCapture(event.pointerId);
        this.addEventListener("pointermove", pointermove);
        this.dispatchEvent(new CustomEvent("resizestart"));
      });
      this.addEventListener("gotpointercapture", event => {
        initY = event.clientY;
      });
      this.addEventListener("lostpointercapture", () => {
        this.classList.remove("resize");
        this.removeEventListener("pointermove", pointermove);
        this.dispatchEvent(new CustomEvent("resizeend"));
      });
      this.addEventListener("touchmove", event => {
        event.preventDefault();
      }, { passive: false });
      this.rendered = true;
    }
    rendered = false;
  });
} else {
  create("div", {class: "overlay"}, overlay => {
    customElements.define("a-resizerx", class extends HTMLElement {
      connectedCallback() {
        if (this.rendered) return;
        var initX, mousemove = event => {
          this.dispatchEvent(new CustomEvent("resize", {
            detail: event.clientX - initX
          }));
        }, mouseup = event => {
          this.classList.remove("resize");
          overlay.classList.remove("h-resize");
          document.removeEventListener("mousemove", mousemove);
          document.removeEventListener("mouseup", mouseup);
          this.dispatchEvent(new CustomEvent("resizeend"));
        };
        this.addEventListener("mousedown", event => {
          event.preventDefault();
          initX = event.clientX;
          this.classList.add("resize");
          overlay.classList.add("h-resize");
          document.addEventListener("mousemove", mousemove);
          document.addEventListener("mouseup", mouseup);
          this.dispatchEvent(new CustomEvent("resizestart"));
        });
        this.rendered = true;
      }
      rendered = false;
    });
    customElements.define("a-resizery", class extends HTMLElement {
      connectedCallback() {
        if (this.rendered) return;
        var initY, mousemove = event => {
          this.dispatchEvent(new CustomEvent("resize", {
            detail: event.clientY - initY
          }));
        }, mouseup = event => {
          this.classList.remove("resize");
          overlay.classList.remove("v-resize");
          document.removeEventListener("mousemove", mousemove);
          document.removeEventListener("mouseup", mouseup);
          this.dispatchEvent(new CustomEvent("resizeend"));
        };
        this.addEventListener("mousedown", event => {
          event.preventDefault();
          initY = event.clientY;
          this.classList.add("resize");
          overlay.classList.add("v-resize");
          document.addEventListener("mousemove", mousemove);
          document.addEventListener("mouseup", mouseup);
          this.dispatchEvent(new CustomEvent("resizestart"));
        });
        this.rendered = true;
      }
      rendered = false;
    });
    document.body.append(overlay);
  });
}