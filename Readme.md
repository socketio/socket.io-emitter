
# socket.io-emitter

[![Build Status](https://github.com/socketio/socket.io-emitter/workflows/CI/badge.svg)](https://github.com/socketio/socket.io-emitter/actions)
[![NPM version](https://badge.fury.io/js/socket.io-emitter.svg)](http://badge.fury.io/js/socket.io-emitter)

`socket.io-emitter` allows you to communicate with Socket.IO servers
easily from another Node.js process (server side).

![Emitter diagram](./assets/emitter.png)

The emitter is also available in other programming languages:

- Java: https://github.com/sunsus/socket.io-java-emitter
- Python: https://pypi.org/project/socket.io-emitter/
- PHP: https://github.com/rase-/socket.io-php-emitter
- Golang: https://github.com/yosuke-furukawa/socket.io-go-emitter
- Perl: https://metacpan.org/pod/SocketIO::Emitter
- Rust: https://github.com/epli2/socketio-rust-emitter

It must be used in conjunction with [socket.io-redis](https://github.com/socketio/socket.io-redis/).

The current version is compatible with both:

- `socket.io-redis@5` (`socket.io@2`)
- `socket.io-redis@6` (`socket.io@3`)

## Table of content

- [How to use](#how-to-use)
- [Examples](#examples)
- [Error handling](#error-handling)
- [API](#api)
  - [Emitter(client[, opts])](#emitterclient-opts)
  - [Emitter(clientUri[, opts])](#emitterclienturi-opts)
  - [Emitter(opts)](#emitteropts)
  - [Emitter#to(room:String):Emitter](#emittertoroomstringemitter)
  - [Emitter#in(room:String):Emitter](#emitterinroomstringemitter)
  - [Emitter#of(namespace:String):Emitter](#emitterofnamespacestringemitter)
- [License](#license)

## How to use

```js
const io = require('socket.io-emitter')({ host: '127.0.0.1', port: 6379 });
setInterval(() => {
  io.emit('time', new Date);
}, 5000);
```
```js
// Different constructor options.

//1. Initialize with host:port string
const io = require('socket.io-emitter')("localhost:6379")
// 2. Initlize with host, port object.
const io = require('socket.io-emitter')({ host: '127.0.0.1', port: 6379 });
// 3. Can use other node_redis compatible client eg; ioredis.

const Redis = require("ioredis");
const redis = new Redis();
const io = require('socket.io-emitter')(redis);

// Make the emitter works with redis clustered environment.
const Cluster = new Redis.Cluster([
    {
        host: "localhost",
        port: 6379
    },
    {
        host: "localhost",
        port: 6378
    },
]);
const io = require('socket.io-emitter')(Cluster);

```

## Examples

```js
const io = require('socket.io-emitter')({ host: '127.0.0.1', port: 6379 });

// sending to all clients
io.emit('broadcast', /* ... */);

// sending to all clients in 'game' room
io.to('game').emit('new-game', /* ... */);

// sending to individual socketid (private message)
io.to(socketId).emit('private', /* ... */);

const nsp = io.of('/admin');

// sending to all clients in 'admin' namespace
nsp.emit('namespace', /* ... */);

// sending to all clients in 'admin' namespace and in 'notifications' room
nsp.to('notifications').emit('namespace', /* ... */);
```

**Note:** acknowledgements are not supported

## Error handling

Access the `redis` to subscribe to its `error` event:

```js
const emitter = require('socket.io-emitter')("localhost:6379");

emitter.redis.on('error', (err) => {
  console.log(err);
});
```

## API

### Emitter(client[, opts])

`client` is a [node_redis](https://github.com/mranney/node_redis)
compatible client that has been initialized with the `return_buffers`
option set to `true`. This argument is optional.

The following options are allowed:

- `key`: the name of the key to pub/sub events on as prefix (`socket.io`)
- `host`: host to connect to redis on (`localhost`)
- `port`: port to connect to redis on (`6379`)
- `socket`: unix domain socket to connect to redis on (`"/tmp/redis.sock"`)

### Emitter(clientUri[, opts])

Same as above, but `clientUri` is a string of the format `host:port`
to connect to redis to.

### Emitter(opts)

If you don't want to supply a redis client object, and want
`socket.io-emitter` to intiialize one for you, make sure to supply the
`host` and `port` options.

### Emitter#to(room:String):Emitter
### Emitter#in(room:String):Emitter

Specifies a specific `room` that you want to emit to.


### Emitter#of(namespace:String):Emitter

Specifies a specific namespace that you want to emit to.

### Emitter#customRequest(payload:Object)

Sends custom request to request channel for socket.io-redis server

## License

MIT
