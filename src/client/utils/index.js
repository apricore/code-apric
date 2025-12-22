export function create(tagName, attributes, callback) {
  let elem = document.createElement(tagName);
  for (let attribute in attributes)
    elem.setAttribute(attribute, attributes[attribute]);
  callback?.(elem);
  return elem;
}

export class Queue {
  constructor(callback = () => {}) {
    this.finally = callback;
    callback(this);
  }
  #queue = new Queue.#_queue;
  get result() {return this.#queue.result}
  get error() {return this.#queue.error}
  set result(value) {this.#queue.resolve(value)}
  set error(value) {this.#queue.reject(value)}
  async then(resolve = () => {}, reject = () => {}) {
    try {return resolve(await this.#queue)
        } catch (error) {return reject(error)
                        } finally {this.finally(this)}
  }
  static #_queue = class queue {
    then(resolve, reject) {
      let result = this.results.shift(),
          error = this.errors.shift();
      if (error === queue.empty) {
        this.result = result;
        this.error = null;
        resolve(result);
      } else if (result === queue.empty) {
        this.error = error;
        this.result = null;
        reject(error);
      } else {
        this.resolves.push(resolve);  
        this.rejects.push(reject);
      }
    }
    resolve(result) {
      let resolve = this.resolves.shift();
      this.rejects.shift();
      if (resolve) {
        this.result = result;
        this.error = null;
        resolve(result);
      } else {
        this.results.push(result);
        this.errors.push(queue.empty);
      }
    }
    reject(error) {
      let reject = this.rejects.shift();
      this.resolves.shift();
      if (reject) {
        this.error = error;
        this.result = null;
        reject(error);
      } else {
        this.errors.push(error);
        this.results.push(queue.empty);
      }
    }
    result = null;
    error = null;
    results = [];
    errors = [];
    resolves = [];
    rejects = [];
    static empty = Symbol();
  }
  static syncCall(request) {
    let queue = new this.#_queue;
    queue.resolve(null);
    return async function () {
      await queue;
      return new Promise((resolve, reject) => {
        request(...arguments, resolve, reject);
      }).finally(() => queue.resolve(null));
    }
  }
  static cacheCall(request) {
    let map = new Map,
        wrapper = key => {
          let result = map.get(key);
          if (result) return Promise.resolve(result);
          else return new Promise((resolve, reject) => {
            request(key, resolve, reject);
          }).then(result => {
            map.set(key, result);
            return result;
          });
        };
    wrapper.map = map;
    return wrapper;
  }
  static wait = this.syncCall((time, resolve) => setTimeout(() => resolve(), time));
}

export class Sse {
  constructor(src, messages = {}) {
    if (Sse.onconnects) Sse.onconnects.add(() => Sse.register(src, messages));
    else Sse.register(src, messages);

    return Sse.#sse;
  }
  static get sse() {
    return this.#sse;
  }
  static #sse = (() => {
    var sse = new EventSource("sse.es");

    sse.addEventListener("connected", message => {
      this.#code = message.data;
      if (this.onconnects) {
        for (let onconnect of this.onconnects) onconnect();
        delete this.onconnects;
      } else for (let reconnect of this.reconnects) reconnect();
    });

    return sse;
  })();
  static #xhttp = new XMLHttpRequest;
  static register(src, messages) {
    const xhttp = new XMLHttpRequest;

    xhttp.open("POST", src);
    xhttp.setRequestHeader("content-type", "application/json");
    xhttp.setRequestHeader("sse-code", Sse.#code);
    xhttp.onload = () => {
      if (xhttp.response) console.log(xhttp.response);
    };
    xhttp.send(JSON.stringify(messages));
  }
  static send = Queue.syncCall((src, messages, resolve, reject) => {
    var xhttp = this.#xhttp;

    xhttp.open("POST", src);
    xhttp.setRequestHeader("content-type", "application/json");
    xhttp.onload = () => {
      if (xhttp.status === 200) resolve(xhttp.response)
      else reject(xhttp.status + " " + xhttp.statusText);   
    };
    xhttp.onerror = error => {
      reject(error);
    };
    xhttp.ontimeout = () => {
      reject("timeout");
    };
    xhttp.send(JSON.stringify(messages));
  });
  static fetch(src, messages) {
    return fetch(src, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(messages), 
    })
    .then(response => response.text())
    .then(text => {
      try {
        return JSON.parse(text);
      } catch (error) {
        throw text;
      }
    });
  }
  static #code;
  static onconnects = new Set;
  static reconnects = new Set;
}