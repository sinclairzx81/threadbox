"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// src/thread/registry.ts
var MultipleMainConstructorError = class extends Error {
  constructor() {
    super("Multiple Main constructors found. Only one Main entry point is allowed.");
  }
};
var ThreadRegistry = class {
  static nextKey() {
    return this.ordinal++;
  }
  static registerMainConstructor(constructor) {
    if (this.constructors.has(0))
      throw new MultipleMainConstructorError();
    this.constructors.set(0, constructor);
    this.reverse.set(constructor, 0);
  }
  static registerWorkerConstructor(constructor) {
    const key = this.nextKey();
    this.constructors.set(key, constructor);
    this.reverse.set(constructor, key);
  }
  static getThreadKeyFromConstructor(constructor) {
    const key = this.reverse.get(constructor);
    return key === void 0 ? null : key;
  }
  static getThreadKeyFromInstance(instance) {
    if (instance === null || instance === void 0)
      return null;
    return this.getThreadKeyFromConstructor(instance.constructor);
  }
  static getConstructorFromThreadKey(key) {
    return this.constructors.has(key) ? this.constructors.get(key) : null;
  }
  static getMainConstructor() {
    return this.constructors.has(0) ? this.constructors.get(0) : null;
  }
};
__publicField(ThreadRegistry, "constructors", /* @__PURE__ */ new Map());
__publicField(ThreadRegistry, "reverse", /* @__PURE__ */ new WeakMap());
__publicField(ThreadRegistry, "ordinal", 1);

// src/thread/local.ts
var import_worker_threads2 = require("worker_threads");

// src/marshal/reflect.ts
var import_worker_threads = require("worker_threads");
var Reflect2 = class {
  static isObject(value) {
    return typeof value === "object" && !Array.isArray(value);
  }
  static isArray(value) {
    return typeof value === "object" && Array.isArray(value);
  }
  static isMapType(value) {
    const constructor = value.constructor;
    return constructor === Map;
  }
  static isTypedArray(value) {
    if (value === null || value === void 0)
      return false;
    const constructor = value.constructor;
    return constructor === Int8Array || constructor === Int16Array || constructor === Int32Array || constructor === Uint8Array || constructor === Uint16Array || constructor === Uint32Array || constructor === Float32Array || constructor === Float64Array || constructor === Uint8ClampedArray || constructor === SharedArrayBuffer;
  }
  static isMessagePort(value) {
    if (value === null || value === void 0)
      return false;
    const constructor = value.constructor;
    return constructor === import_worker_threads.MessagePort;
  }
};

// src/marshal/registry.ts
var DuplicateConstructorRegistration = class extends Error {
  constructor(constructor) {
    const name = constructor.name;
    super(`MarshalRegistry: constructors can only be registered once. See constructor ${name}`);
  }
};
var MarshalRegistry = class {
  static nextKey() {
    return this.ordinal++;
  }
  static registerConstructor(constructor) {
    if (this.reverse.has(constructor)) {
      throw new DuplicateConstructorRegistration(constructor);
    }
    const key = this.nextKey();
    this.constructors.set(key, constructor);
    this.reverse.set(constructor, key);
    return key;
  }
  static getConstructorFromMarshalKey(key) {
    return this.constructors.get(key) || null;
  }
  static getMarshalKeyFromConstructor(constructor) {
    const key = this.reverse.get(constructor);
    return key === void 0 ? null : key;
  }
  static getMarshalKeyFromInstance(instance) {
    if (instance === null || instance === void 0) {
      return null;
    }
    const key = this.reverse.get(instance.constructor);
    return key === void 0 ? null : key;
  }
  static isConstructorMarshalled(constructor) {
    const key = this.reverse.get(constructor);
    return key !== void 0;
  }
  static isInstanceMarshalled(instance) {
    if (instance === void 0 || instance === null) {
      return false;
    }
    if (this.reverse.has(instance.constructor)) {
      return true;
    }
    if (Reflect2.isTypedArray(instance)) {
      return false;
    } else if (Reflect2.isObject(instance)) {
      for (const _value of Object.values(instance)) {
        if (this.isInstanceMarshalled(_value)) {
          return true;
        }
      }
    } else if (Reflect2.isArray(instance)) {
      for (const _value of instance) {
        if (this.isInstanceMarshalled(_value)) {
          return true;
        }
      }
    }
    return false;
  }
};
__publicField(MarshalRegistry, "constructors", /* @__PURE__ */ new Map());
__publicField(MarshalRegistry, "reverse", /* @__PURE__ */ new WeakMap());
__publicField(MarshalRegistry, "ordinal", 0);

// src/marshal/encoder.ts
var INTRINSIC_MESSAGE_PORT = -1e3;
var INTRINSIC_MAP = -1001;
var MarshalEncoder = class {
  static register(constructor) {
    return MarshalRegistry.registerConstructor(constructor);
  }
  static isConstructorMarshalled(constructor) {
    return MarshalRegistry.isConstructorMarshalled(constructor);
  }
  static isInstanceMarshalled(instance) {
    if (instance === null || instance === void 0) {
      return false;
    }
    if (!instance.constructor) {
      return false;
    }
    return MarshalRegistry.isConstructorMarshalled(instance.constructor);
  }
  static encode(instance) {
    if (instance === null || instance === void 0) {
      return [null, null];
    }
    if (Reflect2.isMessagePort(instance)) {
      return [INTRINSIC_MESSAGE_PORT, instance];
    } else if (Reflect2.isMapType(instance)) {
      const encoded_map = /* @__PURE__ */ new Map();
      for (const [key, value] of instance) {
        encoded_map.set(key, this.encode(value));
      }
      const entries = [...encoded_map.entries()];
      return [INTRINSIC_MAP, entries];
    } else if (Reflect2.isTypedArray(instance)) {
      return [null, instance];
    } else if (Reflect2.isObject(instance)) {
      const entries = Object.entries(instance);
      const object = entries.reduce((object2, [key, value]) => {
        return { ...object2, [key]: this.encode(value) };
      }, {});
      const marshalKey = MarshalRegistry.getMarshalKeyFromInstance(instance);
      return [marshalKey, object];
    } else if (Reflect2.isArray(instance)) {
      return [null, instance.map((value) => this.encode(value))];
    } else {
      return [null, instance];
    }
  }
  static decode(encoded) {
    const [marshalKey, instance] = encoded;
    if (marshalKey === INTRINSIC_MESSAGE_PORT) {
      return instance;
    }
    if (marshalKey === INTRINSIC_MAP) {
      const encoded_map = new Map(instance);
      const map = /* @__PURE__ */ new Map();
      for (const [key, value] of encoded_map) {
        map.set(key, this.decode(value));
      }
      return map;
    } else if (Reflect2.isTypedArray(instance)) {
      return instance;
    } else if (Reflect2.isObject(instance)) {
      const entries = Object.entries(instance);
      const object = entries.reduce((object2, [key, value]) => {
        return { ...object2, [key]: this.decode(value) };
      }, {});
      const constructor = marshalKey !== null ? MarshalRegistry.getConstructorFromMarshalKey(marshalKey) : null;
      return constructor !== null ? Object.assign(Object.create(constructor.prototype), object) : object;
    } else if (Reflect2.isArray(instance)) {
      return instance.map((value) => this.decode(value));
    } else {
      return instance;
    }
  }
};

// src/marshal/transfer.ts
var MarshalTransferList = class {
  static search(instance) {
    if (instance === null || instance === void 0) {
      return [];
    }
    if (Reflect2.isMessagePort(instance)) {
      return [instance];
    }
    if (Reflect2.isObject(instance)) {
      const transferList = [];
      for (const key of Object.keys(instance)) {
        transferList.push(...this.search(instance[key]));
      }
      return transferList;
    }
    if (Reflect2.isArray(instance)) {
      const transferList = [];
      for (const value of instance) {
        transferList.push(...this.search(value));
      }
      return transferList;
    }
    return [];
  }
};

// src/thread/protocol.ts
var ThreadProtocolEncodeError = class extends Error {
  constructor(data) {
    const json = JSON.stringify(data);
    super(`Unable to encode protocol message: ${json}`);
  }
};
var ThreadProtocolDecodeError = class extends Error {
  constructor(data) {
    const json = JSON.stringify(data);
    super(`Unable to decode protocol message: ${json}`);
  }
};
var ThreadProtocol = class {
  static encodeConstruct(command) {
    return {
      ...command,
      args: command.args.map((arg) => {
        if (MarshalEncoder.isInstanceMarshalled(arg)) {
          return {
            kind: "marshalled",
            data: MarshalEncoder.encode(arg)
          };
        } else {
          return {
            kind: "default",
            data: arg
          };
        }
      })
    };
  }
  static encodeExecute(command) {
    return {
      ...command,
      args: command.args.map((arg) => {
        if (MarshalEncoder.isInstanceMarshalled(arg)) {
          return {
            kind: "marshalled",
            data: MarshalEncoder.encode(arg)
          };
        } else {
          return {
            kind: "default",
            data: arg
          };
        }
      })
    };
  }
  static encodeResult(command) {
    return {
      ...command,
      result: MarshalEncoder.isInstanceMarshalled(command.result) ? {
        kind: "marshalled",
        data: MarshalEncoder.encode(command.result)
      } : {
        kind: "default",
        data: command.result
      }
    };
  }
  static encodeError(command) {
    return { ...command };
  }
  static encodeDispose(command) {
    return { ...command };
  }
  static encodeDisposed(command) {
    return { ...command };
  }
  static encodeTerminate(command) {
    return { ...command };
  }
  static encode(command) {
    switch (command.kind) {
      case "construct":
        return [this.encodeConstruct(command), MarshalTransferList.search(command.args)];
      case "execute":
        return [this.encodeExecute(command), MarshalTransferList.search(command.args)];
      case "result":
        return [this.encodeResult(command), MarshalTransferList.search(command.result)];
      case "error":
        return [this.encodeError(command), MarshalTransferList.search(command.error)];
      case "dispose":
        return [this.encodeDispose(command), []];
      case "disposed":
        return [this.encodeDisposed(command), []];
      case "terminate":
        return [this.encodeTerminate(command), []];
      default:
        throw new ThreadProtocolEncodeError(command);
    }
  }
  static decodeConstruct(message) {
    return {
      ...message,
      args: message.args.map((param) => {
        if (param.kind === "marshalled") {
          return MarshalEncoder.decode(param.data);
        } else {
          return param.data;
        }
      })
    };
  }
  static decodeExecute(message) {
    return {
      ...message,
      args: message.args.map((param) => {
        if (param.kind === "marshalled") {
          return MarshalEncoder.decode(param.data);
        } else {
          return param.data;
        }
      })
    };
  }
  static decodeResult(message) {
    return {
      ...message,
      result: message.result.kind === "marshalled" ? MarshalEncoder.decode(message.result.data) : message.result.data
    };
  }
  static decodeError(message) {
    return { ...message };
  }
  static decodeDispose(message) {
    return { ...message };
  }
  static decodeDisposed(message) {
    return { ...message };
  }
  static decodeTerminate(message) {
    return { ...message };
  }
  static decode(message) {
    switch (message.kind) {
      case "construct":
        return this.decodeConstruct(message);
      case "execute":
        return this.decodeExecute(message);
      case "result":
        return this.decodeResult(message);
      case "error":
        return this.decodeError(message);
      case "dispose":
        return this.decodeDispose(message);
      case "disposed":
        return this.decodeDisposed(message);
      case "terminate":
        return this.decodeTerminate(message);
      default:
        throw new ThreadProtocolDecodeError(message);
    }
  }
};

// src/thread/local.ts
var HostInvalidCommandError = class extends Error {
  constructor(command) {
    const json = JSON.stringify(command);
    super(`Received an invalid command from the host thread ${json}`);
  }
};
var ThreadLocal = class {
  static async execute(port, instance, command) {
    const func = await instance[command.functionKey];
    if (typeof func !== "function") {
      const ordinal = command.ordinal;
      const error = `The function '${command.functionKey}' does not exist`;
      const [message, transferList] = ThreadProtocol.encode({ kind: "error", ordinal, error });
      port.postMessage(message, transferList);
      return;
    }
    try {
      const ordinal = command.ordinal;
      const result = await func.apply(instance, command.args);
      const [message, transferList] = ThreadProtocol.encode({ kind: "result", ordinal, result });
      port.postMessage(message, transferList);
    } catch (error) {
      const ordinal = command.ordinal;
      const [message, transferList] = ThreadProtocol.encode({ kind: "error", ordinal, error });
      port.postMessage(message, transferList);
    }
  }
  static async dispose(port, instance, command) {
    const func = await instance["dispose"];
    if (func) {
      await func.apply(instance, []);
    }
    const ordinal = command.ordinal;
    const [message, transferList] = ThreadProtocol.encode({ kind: "disposed", ordinal });
    port.postMessage(message, transferList);
  }
  static terminate(_port, _instance, _command) {
    setImmediate(() => process.exit(0));
  }
  static listen(instance, port) {
    port.on("message", async (message) => {
      const command = ThreadProtocol.decode(message);
      switch (command.kind) {
        case "execute":
          return this.execute(port, instance, command);
        case "dispose":
          return this.dispose(port, instance, command);
        case "terminate":
          return this.terminate(port, instance, command);
        default:
          throw new HostInvalidCommandError(command);
      }
    });
  }
  static start() {
    setImmediate(async () => {
      if (import_worker_threads2.isMainThread) {
        const constructor = ThreadRegistry.getMainConstructor();
        if (constructor) {
          const instance = new constructor();
          await instance.main(process.argv);
        }
      } else if (import_worker_threads2.workerData && import_worker_threads2.parentPort && import_worker_threads2.workerData.construct) {
        const construct = ThreadProtocol.decode(import_worker_threads2.workerData.construct);
        const constructor = ThreadRegistry.getConstructorFromThreadKey(construct.threadKey);
        if (constructor) {
          const instance = new constructor(...construct.args);
          this.listen(instance, import_worker_threads2.parentPort);
        }
      } else {
      }
    });
  }
};

// src/thread/handle.ts
var import_worker_threads3 = require("worker_threads");
var import_path = require("path");
var ConstructorNotThreadableError = class extends Error {
  constructor(constructor) {
    super(`The class '${constructor.name}' has not been registered as a thread.`);
  }
};
var ThreadInvalidCommandError = class extends Error {
  constructor(command) {
    const data = JSON.stringify(command);
    super(`Received an invalid command from the worker thread ${data}`);
  }
};
var ThreadEntry = class {
  static resolve() {
    return (0, import_path.extname)(process.argv[1]) !== ".js" ? process.argv[1] + ".js" : process.argv[1];
  }
};
var ThreadHandle = class {
  awaiters = /* @__PURE__ */ new Map();
  worker;
  ordinal = 0;
  constructor(resourceLimits, constructor, args) {
    const threadKey = ThreadRegistry.getThreadKeyFromConstructor(constructor);
    if (threadKey === null) {
      throw new ConstructorNotThreadableError(constructor);
    }
    const [construct, transferList] = ThreadProtocol.encode({ kind: "construct", ordinal: 0, threadKey, args });
    const workerData2 = { construct };
    const workerOptions = { workerData: workerData2, resourceLimits, transferList };
    this.worker = new import_worker_threads3.Worker(ThreadEntry.resolve(), workerOptions);
    this.worker.on("message", (message) => this.onMessage(message));
  }
  execute(functionKey, args) {
    return new Promise((resolve, reject) => {
      const ordinal = this.setAwaiter([resolve, reject]);
      const [message, transferList] = ThreadProtocol.encode({ kind: "execute", ordinal, functionKey, args });
      this.worker.postMessage(message, transferList);
    });
  }
  dispose() {
    return new Promise((resolve, reject) => {
      const ordinal = this.setAwaiter([resolve, reject]);
      const [message, transferList] = ThreadProtocol.encode({ kind: "dispose", ordinal });
      this.worker.postMessage(message, transferList);
    });
  }
  onResult(command) {
    const [resolve, _] = this.getAwaiter(command.ordinal);
    resolve(command.result);
  }
  onError(command) {
    const [_, reject] = this.getAwaiter(command.ordinal);
    reject(command.error);
  }
  onDisposed(command) {
    const [resolve, _] = this.getAwaiter(command.ordinal);
    const [message, transferList] = ThreadProtocol.encode({ kind: "terminate" });
    this.worker.postMessage(message, transferList);
    resolve(null);
  }
  onMessage(message) {
    const command = ThreadProtocol.decode(message);
    switch (command.kind) {
      case "result":
        return this.onResult(command);
      case "error":
        return this.onError(command);
      case "disposed":
        return this.onDisposed(command);
      default:
        throw new ThreadInvalidCommandError(command);
    }
  }
  setAwaiter(awaiter) {
    const ordinal = ++this.ordinal;
    this.awaiters.set(ordinal, awaiter);
    return ordinal;
  }
  getAwaiter(ordinal) {
    if (!this.awaiters.has(ordinal)) {
      throw Error("cannot get awaiter");
    }
    const awaiter = this.awaiters.get(ordinal);
    this.awaiters.delete(ordinal);
    return awaiter;
  }
  static create(resourceLimits, constructor, ...args) {
    return new Proxy(new ThreadHandle(resourceLimits, constructor, args), {
      get: (target, functionKey) => (...params) => {
        return functionKey !== "dispose" ? target.execute(functionKey, params) : target.dispose();
      }
    });
  }
};

// src/channel/channel.ts
var import_worker_threads4 = require("worker_threads");

// src/channel/protocol.ts
function encode(value) {
  const kind = MarshalEncoder.isInstanceMarshalled(value) ? "marshalled" : "default";
  const data = kind === "marshalled" ? MarshalEncoder.encode(value) : value;
  const transferList = MarshalTransferList.search(value);
  return [{ kind, data }, transferList];
}
function decode(encoded) {
  switch (encoded.kind) {
    case "marshalled":
      return MarshalEncoder.decode(encoded.data);
    case "default":
      return encoded.data;
  }
}

// src/channel/defer.ts
function defer() {
  let resolver;
  let rejector;
  const promise = new Promise((resolve, reject) => {
    resolver = resolve;
    rejector = reject;
  });
  return [promise, resolver, rejector];
}

// src/channel/queue.ts
var Queue = class {
  promises = [];
  resolvers = [];
  dequeue() {
    if (this.promises.length > 0) {
      const promise = this.promises.shift();
      return promise;
    } else {
      const [promise, resolver] = defer();
      this.resolvers.push(resolver);
      return promise;
    }
  }
  enqueue(value) {
    if (this.resolvers.length > 0) {
      const resolver = this.resolvers.shift();
      resolver(value);
    } else {
      const [promise, awaiter] = defer();
      awaiter(value);
      this.promises.push(promise);
    }
  }
};
MarshalRegistry.registerConstructor(Queue);

// src/channel/channel.ts
var SenderProtocolViolationError = class extends Error {
  constructor() {
    super("Receiver received an unexpected protocol message from the Sender.");
  }
};
var ReceiverProtocolViolationError = class extends Error {
  constructor() {
    super("Sender received an unexpected protocol message from the Receiver.");
  }
};
var ReceiverAcknowledgementError = class extends Error {
  constructor() {
    super("Sender recieved an unexpected ordinal acknowledgement from the Receiver");
  }
};
var EOF = Symbol("EOF");
var Sender = class {
  constructor(port) {
    this.port = port;
  }
  awaiters = /* @__PURE__ */ new Map();
  ordinal = 0;
  subscribed = false;
  send(value) {
    this.subscribeToPort();
    return new Promise((resolve) => {
      const kind = "value";
      const ordinal = this.setAwaiter(resolve);
      const [message, transferList] = encode({ kind, ordinal, value });
      this.port.postMessage(message, transferList);
    });
  }
  end() {
    this.subscribeToPort();
    return new Promise((resolve) => {
      const kind = "shutdown";
      const ordinal = this.setAwaiter(resolve);
      const [message, transferList] = encode({ kind, ordinal });
      this.port.postMessage(message, transferList);
    });
  }
  setAwaiter(resolve) {
    const ordinal = ++this.ordinal;
    this.awaiters.set(ordinal, resolve);
    return ordinal;
  }
  getAwaiter(ordinal) {
    if (!this.awaiters.has(ordinal)) {
      throw new ReceiverAcknowledgementError();
    }
    const awaiter = this.awaiters.get(ordinal);
    this.awaiters.delete(ordinal);
    return awaiter;
  }
  subscribeToPort() {
    if (!this.subscribed) {
      this.port.on("message", (ack) => this.onMessage(decode(ack)));
      this.subscribed = true;
    }
  }
  onMessage(message) {
    const awaiter = this.getAwaiter(message.ordinal);
    switch (message.kind) {
      case "value": {
        awaiter(void 0);
        break;
      }
      case "shutdown": {
        awaiter(void 0);
        this.port.close();
        break;
      }
      default: {
        throw new ReceiverProtocolViolationError();
      }
    }
  }
};
MarshalRegistry.registerConstructor(Sender);
var Receiver = class {
  constructor(port) {
    this.port = port;
    this.queue = new Queue();
  }
  queue;
  subscribed = false;
  async receive() {
    this.subscribeToPort();
    const send = await this.queue.dequeue();
    switch (send.kind) {
      case "value": {
        const kind = "value";
        const ordinal = send.ordinal;
        const [message, transferList] = encode({ kind, ordinal });
        this.port.postMessage(message, transferList);
        return send.value;
      }
      case "shutdown": {
        const kind = "shutdown";
        const ordinal = send.ordinal;
        const [message, transferList] = encode({ kind, ordinal });
        this.port.postMessage(message, transferList);
        return EOF;
      }
      default: {
        throw new SenderProtocolViolationError();
      }
    }
  }
  subscribeToPort() {
    if (!this.subscribed) {
      this.port.on("message", (send) => {
        this.queue.enqueue(decode(send));
      });
      this.subscribed = true;
    }
  }
  async *[Symbol.asyncIterator]() {
    while (true) {
      const next = await this.receive();
      if (next === EOF) {
        break;
      }
      yield next;
    }
  }
};
MarshalRegistry.registerConstructor(Receiver);
function channel() {
  const channel2 = new import_worker_threads4.MessageChannel();
  const sender = new Sender(channel2.port1);
  const receiver = new Receiver(channel2.port2);
  return [sender, receiver];
}

// src/mutex/mutex.ts
var MutexLock = class {
  constructor(__lock) {
    this.__lock = __lock;
  }
  dispose() {
    this.__lock[0] = 0;
    Atomics.notify(this.__lock, 0, 1);
  }
};
var Mutex = class {
  __lock = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
  lock() {
    Atomics.wait(this.__lock, 0, 1);
    this.__lock[0] = 1;
    return new MutexLock(this.__lock);
  }
};
MarshalRegistry.registerConstructor(Mutex);

// src/index.ts
var Thread;
((Thread2) => {
  function Constructor(constructor) {
    ThreadRegistry.registerWorkerConstructor(constructor);
    return constructor;
  }
  Thread2.Constructor = Constructor;
  function Channel() {
    return channel();
  }
  Thread2.Channel = Channel;
  function Marshal(constructor) {
    MarshalEncoder.register(constructor);
    return constructor;
  }
  Thread2.Marshal = Marshal;
  function Main(func) {
    ThreadRegistry.registerMainConstructor(class {
      async main() {
        await func();
      }
    });
  }
  Thread2.Main = Main;
  function Spawn(...args) {
    const overloads = ThreadRegistry.getThreadKeyFromConstructor(args[0]) !== null ? [{}, ...args] : [...args];
    const resourceLimits = overloads.shift();
    const constructor = overloads.shift();
    return ThreadHandle.create(resourceLimits, constructor, ...overloads);
  }
  Thread2.Spawn = Spawn;
})(Thread || (Thread = {}));
ThreadLocal.start();

// example/index.ts
var import_assert = require("assert");
var WorkerC = Thread.Constructor(class {
  run(x) {
    return x;
  }
});
var WorkerB = Thread.Constructor(class {
  async run(sender, iterations, values) {
    const c_0 = Thread.Spawn(WorkerC);
    const c_1 = Thread.Spawn(WorkerC);
    const c_2 = Thread.Spawn(WorkerC);
    const c_3 = Thread.Spawn(WorkerC);
    for (let i = 0; i < iterations; i++) {
      const [a, b, c, d] = await Promise.all([
        c_0.run(values[0]),
        c_1.run(values[1]),
        c_2.run(values[2]),
        c_3.run(values[3])
      ]);
      await sender.send([a, b, c, d]);
    }
    await sender.end();
    await c_0.dispose();
    await c_1.dispose();
    await c_2.dispose();
    await c_3.dispose();
  }
});
var WorkerA = Thread.Constructor(class {
  async run(receiver) {
    let acc = 0;
    for await (const [a, b, c, d] of receiver) {
      acc += a + b + c + d;
      console.log("A", a, b, c, d, acc);
    }
    return acc;
  }
});
Thread.Main(async () => {
  const [sender, receiver] = Thread.Channel();
  const a = Thread.Spawn(WorkerA);
  const b = Thread.Spawn(WorkerB);
  const [_, result] = await Promise.all([
    b.run(sender, 10, [1, 2, 3, 4]),
    a.run(receiver)
  ]);
  await a.dispose();
  await b.dispose();
  console.log("M", result);
  (0, import_assert.equal)(result, 100);
});
