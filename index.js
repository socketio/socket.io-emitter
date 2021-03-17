
/**
 * Module dependencies.
 */

var uid2 = require('uid2');
var client = require('redis').createClient;
var parser = require('socket.io-parser');
var msgpack = require('notepack.io');
var debug = require('debug')('socket.io-emitter');

/**
 * Module exports.
 */

module.exports = init;

/**
 * Flags.
 *
 * @api public
 */

var flags = [
  'json',
  'volatile',
  'broadcast'
];

/**
 * uid for emitter
 *
 * @api private
 */

var uid = 'emitter';

/**
 * Socket.IO redis based emitter.
 *
 * @param {Object} redis client (optional)
 * @param {Object} options
 * @api public
 */

function init(redis, opts){
  opts = opts || {};

  if ('string' == typeof redis) {
    redis = client(redis);
  }

  if (redis && !redis.hset) {
    opts = redis;
    redis = null;
  }

  if (!redis) {
    if (!opts.socket && !opts.host) throw new Error('Missing redis `host`');
    if (!opts.socket && !opts.port) throw new Error('Missing redis `port`');
    redis = opts.socket
      ? client(opts.socket)
      : client(opts.port, opts.host);
  }

  var prefix = opts.key || 'socket.io';

  return new Emitter(redis, prefix, '/');
}

function Emitter(redis, prefix, nsp){
  this.redis = redis;
  this.prefix = prefix;
  this.nsp = nsp;
  this.channel = this.prefix + '#' + nsp + '#';
  this.requestChannel = this.prefix + '-request#' + nsp + '#';

  this._rooms = [];
  this._flags = {};
  this._except = [];
}

/**
 * Apply flags from `Socket`.
 */

flags.forEach(function(flag){
  Emitter.prototype.__defineGetter__(flag, function(){
    debug('flag %s on', flag);
    this._flags[flag] = true;
    return this;
  });
});

/**
 * Limit emission to a certain `room`.
 *
 * @param {String} room
 */

Emitter.prototype.in =
Emitter.prototype.to = function(room){
  if (!~this._rooms.indexOf(room)) {
    debug('room %s', room);
    this._rooms.push(room);
  }
  return this;
};

Emitter.prototype.except = function(room) {
  if (!~this._except.indexOf(room)) {
    debug('except %s', room);
    this._except.push(room);
  }
  return this;
};

/**
 * Return a new emitter for the given namespace.
 *
 * @param {String} namespace
 */

Emitter.prototype.of = function(nsp){
  return new Emitter(this.redis, this.prefix, (nsp[0] !== "/" ? "/" : "") + nsp);
};

/**
 * Send the packet.
 *
 * @api public
 */

Emitter.prototype.emit = function(){
  // packet
  var args = Array.prototype.slice.call(arguments);
  var packet = { type: parser.EVENT, data: args, nsp: this.nsp };

  var opts = {
    rooms: this._rooms,
    flags: this._flags,
    except: this._except
  };

  var msg = msgpack.encode([uid, packet, opts]);
  var channel = this.channel;
  if (opts.rooms && opts.rooms.length === 1) {
    channel += opts.rooms[0] + '#';
  }
  debug('publishing message to channel %s', channel);
  this.redis.publish(channel, msg);

  // reset state
  this._rooms = [];
  this._flags = {};
  this._except = [];

  return this;
};

/**
 * Request types, for messages between nodes
 */

var requestTypes = {
    clients: 0,
    clientRooms: 1,
    allRooms: 2,
    remoteJoin: 3,
    remoteLeave: 4,
    customRequest: 5,
    remoteDisconnect: 6
};

/**
 * Sends a new custom request to other nodes
 *
 * @param {Object} payload
 * @api public
 */
Emitter.prototype.customRequest = function(payload){
    var requestid = uid2(6);
    var request = JSON.stringify({
        requestid : requestid,
        type: requestTypes.customRequest,
        data: payload
    });

    this.redis.publish(this.requestChannel, request);
};
