'use strict';

//  writable-stream-and-promise
//  https://github.com/raymond-lam/writable-stream-and-promise
//  (c) 2019 Raymond Lam
//
//  Author: Raymond Lam (ray@lam-ray.com)
//
//  writable-stream-and-promise may be freely distributed under the MIT license.

const EventEmitter = require('events');
const {Writable} = require('stream');
const {constants: {MAX_LENGTH}} = require('buffer');

// Lock in the defaults as constants in order not to be dependent on (possibly
// changing) Node.js defaults.
const DEFAULT_ENCODING = 'utf8';
const DEFAULT_HIGH_WATER_MARK_BYTES = 16384;
const DEFAULT_HIGH_WATER_MARK_OBJECTS = 16;

// Returns a 3-tuple (Array): a base class for writableStreamAndPromise and
// writableStreamAndPromise, a reference to a linked list which will hold the
// written chunks, and an EventEmitter, which will communicate when the stream
// is destroyed or when the stream is ended and the chunks are collected.
const getBaseClassAndProtectedMembers = () => {
  // For internal communication between the stream and the promise.
  const internalEvents = new EventEmitter();

  // Store the written data as a linked list. The caller should keep a reference
  // to the head.
  let tail = {};

  return [
    class extends Writable {
      // eslint-disable-next-line class-methods-use-this
      _write(chunk, encoding, callback) {
        // Storing the written values in a linked list is faster than pushing
        // them to a variable-length array.
        tail.value = chunk;
        tail.next = {};
        tail = tail.next;

        callback();
      }

      _destroy(err, callback) { // eslint-disable-line class-methods-use-this
        // Overrided _destroy must also let go of the head of the linked list
        // for this to be effective.
        tail = null;

        callback(err);
        internalEvents.emit(
          'destroy',
          err || new Error('Stream was destroyed.')
        );
      }

      _final(callback) {
        // _collect needs to let go of the head of the linked list to free the
        // memory.
        tail = null;
        let contents;

        try {
          contents = this._collect();
        }
        catch (e) {
          callback(e);
          return;
        }

        callback();
        internalEvents.emit('collect', contents);
      }
    },
    tail,
    internalEvents,
  ];
};

module.exports = {

  // Returns a 2-tuple (Array): a Writable Buffer stream and a Promise. When the
  // stream ends, the Promise resolves to a Buffer containing all the chunks
  // written to the stream. The Promise rejects if the stream emits an error or
  // when the stream is destroyed. Strings written to the stream will be decoded
  // according to the given encoding or defaultEncoding. The stream does not
  // destroy itself automatically after ending. The stream will emit a 'close'
  // event when it is destroyed.
  //
  // Named parameters:
  //   defaultEncoding (optional) - The default encoding that is used when no
  //                                encoding is specified when writing a String.
  //                                The default is 'utf8'.
  //   highWaterMark (optional) -   Writes are completed immediately and
  //                                synchronously, so this parameter is only
  //                                really relevant if the stream is corked.
  //                                highWaterMark indicates the number of bytes
  //                                that the stream should buffer while corked.
  //                                The default is 16384 (16 kb).
  writableStreamAndPromise({
    highWaterMark = DEFAULT_HIGH_WATER_MARK_BYTES,
    defaultEncoding = DEFAULT_ENCODING,
  } = {}) {
    let [BaseClass, head, internalEvents] = getBaseClassAndProtectedMembers();
    let totalLength = 0;

    const writable = new class extends BaseClass {
      _write(chunk, encoding, callback) {
        totalLength += chunk.length;
        super._write(chunk, encoding, callback);
      }

      _destroy(err, callback) {
        head = null;
        super._destroy(err, callback);
      }

      _collect() { // eslint-disable-line class-methods-use-this
        if (totalLength > MAX_LENGTH) {
          throw new Error(
            `Total length of buffered data (${totalLength} bytes) exceeds `
              + `maximum allowed length of Buffer (${MAX_LENGTH} bytes).`
          );
        }

        // Buffer.allocUnsafe is faster than Buffer.alloc, but it is important
        // to ensure that it is completely filled before returning, in order
        // not to expose uninitialized (and potentially sensitive) parts of
        // memory.
        const buffer = Buffer.allocUnsafe(totalLength);
        let offset = 0;
        for (; head.next; head = head.next) {

          // Traditional for loop is the fastest way to iterate on the values
          // of a Buffer.
          for (let i = 0; i < head.value.length; ++i) {
            buffer[offset] = head.value[i];
            ++offset;
          }
        }

        // Ensure that the chunks fill the allocated buffer exactly.
        /* istanbul ignore next */if (offset !== totalLength) {
          throw new Error(
            'length property of chunks do not sum to the length of the Buffer '
              + 'allocated for them.'
          );
        }

        return buffer;
      }
    }({highWaterMark, defaultEncoding});

    return [writable, new Promise(
      (resolve, reject) => {
        writable.once('error', reject);
        internalEvents
          .once('destroy', reject)
          .once('collect', resolve);
      }
    )];
  },

  // Returns a 2-tuple (Array): a Writable object stream and a Promise. When the
  // stream ends, the Promise resolves to an Array containing all the chunks
  // written to the stream. The Promise rejects if the stream emits an error or
  // when the stream is destroyed. The stream does not destroy itself
  // automatically after ending. The stream will emit a 'close' event when it is
  // destroyed.
  //
  // Named parameters:
  //   highWaterMark (optional) -   Writes are completed immediately and
  //                                synchronously, so this parameters is only
  //                                really relevant if the stream is corked.
  //                                highWaterMark indicates the number of
  //                                objects that the stream should buffer while
  //                                corked. The default is 16.
  writableObjectStreamAndPromise({
    highWaterMark = DEFAULT_HIGH_WATER_MARK_OBJECTS,
  } = {}) {
    let [BaseClass, head, internalEvents] = getBaseClassAndProtectedMembers();
    let totalLength = 0;

    const writable = new class extends BaseClass {
      _write(chunk, encoding, callback) {
        ++totalLength;
        super._write(chunk, encoding, callback);
      }

      _destroy(err, callback) {
        head = null;
        super._destroy(err, callback);
      }

      _collect() { // eslint-disable-line class-methods-use-this

        // Writing to a pre-allocated array is faster than pushing onto a
        // dynamically sized array.
        const arr = new Array(totalLength);

        let offset = 0;
        for (; head.next; head = head.next) {
          arr[offset] = head.value;
          ++offset;
        }

        return arr;
      }
    }({objectMode: true, highWaterMark});

    return [writable, new Promise(
      (resolve, reject) => {
        writable.once('error', reject);
        internalEvents
          .once('destroy', reject)
          .once('collect', resolve);
      }
    )];
  },
};
