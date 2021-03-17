var expect = require('expect.js');
var redis = require('redis');
var io = require('socket.io');
var ioc = require('socket.io-client');
var redisAdapter = require('socket.io-redis');
var http = require('http').Server;
var ioe = require('../');

function client(srv, nsp, opts){
  if ('object' == typeof nsp) {
    opts = nsp;
    nsp = null;
  }
  var addr = srv.address();
  if (!addr) addr = srv.listen().address();
  var url = 'http://localhost:' + addr.port + (nsp || '');
  return ioc(url, opts);
}

describe('emitter', function() {
  var srv;

  it('should be able to emit any kind of data', function(done){
    srv = http();
    var sio = io(srv, {adapter: redisAdapter()});
    srv.listen();

    var cli = client(srv, { forceNew: true });
    var emitter = ioe({ host: 'localhost', port: '6379' });

    var buffer = Buffer.from('asdfasdf', 'utf8');
    var arraybuffer = Uint8Array.of(1, 2, 3, 4).buffer;

    cli.on('connect', function () {
      emitter.emit('payload', 1, '2', [3], buffer, arraybuffer);
    });

    cli.on('payload', function(a, b, c, d, e) {
      expect(a).to.eql(1);
      expect(b).to.eql('2');
      expect(c).to.eql([3]);
      expect(d).to.eql(buffer);
      expect(e).to.eql(Buffer.from(arraybuffer)); // buffer on the nodejs client-side
      done();
    });
  });

  it('should be able to send customRequest', function (done) {
      srv = http();
      var sio = io(srv, {adapter: redisAdapter()});
      srv.listen();

      var cli = client(srv, { forceNew: true });
      var emitter = ioe({ host: 'localhost', port: '6379' });

      var payload = {
          a: 'b'
      };

      cli.on('connect', function () {
          emitter.customRequest(payload);
      });

      sio.of('/').adapter.customHook = (data) => {
          expect(data).to.eql(payload);
          done();
      };
  });

  describe('in namespaces', function(){
    beforeEach(function() {
      var pub = redis.createClient();
      var sub = redis.createClient(null, null, {return_buffers: true});
      srv = http();
      var sio = io(srv, {adapter: redisAdapter({pubClient: pub, subClient: sub})});

      srv.listen(function() {
        ['/', '/nsp'].forEach(function(nsp) {
          sio.of(nsp).on('connection', function(socket) {
            socket.on('broadcast event', function(payload) {
              socket.emit('broadcast event', payload);
            });
          });
        });
      });
    });

    it('should be able to emit messages to client', function(done) {
      var emitter = ioe({ host: 'localhost', port: '6379' });
      var cli = client(srv, { forceNew: true });
      cli.on('connect', function() {
        emitter.emit('broadcast event', 'broadacast payload');
      });

      cli.on('broadcast event', function(payload) {
        cli.close();
        done();
      });
    });

    it('should be able to emit message to namespace', function(done) {
      var cli = client(srv, '/nsp', { forceNew: true });
      cli.on('broadcast event', function(payload) {
        cli.close();
        done();
      });

      cli.on('connect', function() {
        var emitter = ioe({ host: 'localhost', port: '6379' });
        emitter.of('/nsp').broadcast.emit('broadcast event', 'broadcast payload');
      });
    });

    it('should not emit message to all namespaces', function(done) {
      var a = client(srv, '/nsp', { forceNew: true });
      var b;

      a.on('connect', function() {
        b = client(srv, { forceNew: true });
        b.on('broadcast event', function(payload) {
          expect().fail();
        });

        b.on('connect', function() {
          var emitter = ioe({ host: 'localhost', port: '6379' });
          emitter.of('/nsp').broadcast.emit('broadcast event', 'broadcast payload');
        });
      });

      a.on('broadcast event', function(payload) {
        setTimeout(() => {
          a.disconnect();
          b.disconnect();
          done();
        }, 1000);
      });
    });

    it('should prepend a missing / to the namespace name', (done) => {
      const emitter = ioe({ host: 'localhost', port: '6379' });
      const nsp = emitter.of('nsp'); // missing "/"
      const cli = client(srv, '/nsp', { forceNew: true });
      cli.on('connect', () => {
        nsp.emit('broadcast event', 'broadacast payload');
      });

      cli.on('broadcast event', () => {
        cli.disconnect();
        done();
      });
    });
  });

  describe('in rooms', function(){
    it('should be able to emit to a room', function(done){
      var pub = redis.createClient();
      var sub = redis.createClient(null, null, {return_buffers: true});
      srv = http();
      var sio = io(srv, {adapter: redisAdapter({pubClient: pub, subClient: sub})});

      var secondConnecting = false;
      srv.listen(function() {
        sio.on('connection', function(socket) {
          if (secondConnecting) {
            socket.join('exclusive room');
          } else {
            secondConnecting = true;
          }

          socket.on('broadcast event', function(payload) {
            socket.emit('broadcast event', payload);
          });
        });
      });

      var a = client(srv, { forceNew: true });
      a.on('broadcast event', function(payload) {
        expect().fail();
      });

      var b;
      a.on('connect', function() {
        b = client(srv, { forceNew: true });

        b.on('broadcast event', function(payload) {
          expect(payload).to.be('broadcast payload');
          setTimeout(done, 1000);
        });

        b.on('connect', function() {
          var emitter = ioe({ host: 'localhost', port: '6379' });
          emitter.to('exclusive room').broadcast.emit('broadcast event', 'broadcast payload');
        });
      });
    });

    it('should be able to emit to a socket by id', function(done){
      var pub = redis.createClient();
      var sub = redis.createClient(null, null, {return_buffers: true});
      srv = http();
      var sio = io(srv, {adapter: redisAdapter({pubClient: pub, subClient: sub})});

      var secondConnecting = false;
      var secondId;
      srv.listen(function() {
        sio.on('connection', function(socket) {
          if (secondConnecting) {
            secondId = socket.id;
          } else {
            secondConnecting = true;
          }

          socket.on('broadcast event', function(payload) {
            socket.emit('broadcast event', payload);
          });
        });
      });

      var a = client(srv, { forceNew: true });
      a.on('broadcast event', function(payload) {
        expect().fail();
      });

      var b;
      a.on('connect', function() {
        b = client(srv, { forceNew: true });

        b.on('broadcast event', function(payload) {
          expect(payload).to.be('broadcast payload');
          setTimeout(done, 1000);
        });

        b.on('connect', function() {
          var emitter = ioe({ host: 'localhost', port: '6379' });
          emitter.to(secondId).broadcast.emit('broadcast event', 'broadcast payload');
        });
      });
    });

    it('should be able to exclude a socket by id', function(done) {
      var pub = redis.createClient();
      var sub = redis.createClient(null, null, {return_buffers: true});
      srv = http();
      var sio = io(srv, {adapter: redisAdapter({pubClient: pub, subClient: sub})});

      var firstId = false;
      srv.listen(function() {
        sio.on('connection', function(socket) {
          if (firstId === false) {
            firstId = socket.id;
          }
        });
      });

      var a = client(srv, { forceNew: true });
      var b;
      a.on('connect', function() {
        b = client(srv, { forceNew: true });
        b.on('connect', function() {

          var calls = 0;
          a.on('except event', function() {
            calls++;
            expect().fail();
          });
          b.on('except event', function() {
            calls++;
            setTimeout(function() {
              expect(calls).to.be(1);
              done();
            }, 1);
          });

          var emitter = ioe({ host: 'localhost', port: '6379' });
          emitter.except(firstId).emit('except event');

        });
      });
    });
  });
});
