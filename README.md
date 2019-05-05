writable-stream-and-promise
===========================

[![Build Status](https://travis-ci.com/raymond-lam/writable-stream-and-promise.svg?branch=master)](https://travis-ci.com/raymond-lam/writable-stream-and-promise) 
[![Coverage Status](https://coveralls.io/repos/github/raymond-lam/writable-stream-and-promise/badge.svg?branch=master)](https://coveralls.io/github/raymond-lam/writable-stream-and-promise?branch=master)
[![Greenkeeper badge](https://badges.greenkeeper.io/raymond-lam/writable-stream-and-promise.svg)](https://greenkeeper.io/)

Pipe a [stream](https://nodejs.org/api/stream.htm) into a Promise.

## Usage

### Example

```javascript
const {createReadStream} = require('fs');
const {writableStreamAndPromise} = require('writable-stream-and-promise');
const {createGunzip} = require('zlib');

const processZipFile = async path => {
  const [writable, promise] = writableStreamAndPromise();
  createReadStream(path).pipe(createGunzip()).pipe(writable);
  const contents = await promise;

  // ... process contents ...

  return processedContents;
};
```

### API

#### writableStreamAndPromise([options])

Returns a 2-tuple (Array): a [Writable](https://nodejs.org/api/stream.html#stream_writable_streams) [Buffer](https://nodejs.org/api/buffer.html) stream and a Promise. When the stream ends, the Promise resolves to a Buffer containing all the chunks written to the stream. The Promise rejects if the stream emits an error or when the stream is destroyed. Strings written to the stream will be decoded according to the given encoding or `defaultEncoding`. The stream does not destroy itself automatically after ending. The stream will emit a `'close'` event when it is destroyed.

- `options`
  - `defaultEncoding` The default encoding that is used when no encoding is specified when writing a String. The default is `'utf8'`.
  - `highWaterMark` Writes are completed immediately and synchronously, so this parameter is only really relevant if the stream is [cork](https://nodejs.org/api/stream.html#stream_writable_cork)ed. `highWaterMark` indicates the number of bytes that the stream should buffer while corked. The default is 16384 (16 kb). 
- Returns: A 2-tuple (Array of length 2), the first element a [Writable](https://nodejs.org/api/stream.html#stream_writable_streams) stream, and the second element a Promise.

#### writableObjectStreamAndPromise([options])

Returns a 2-tuple (Array): a [Writable](https://nodejs.org/api/stream.html#stream_writable_streams) [object stream](https://nodejs.org/api/stream.html#stream_object_mode) and a Promise. When the stream ends, the Promise resolves to an Array containing all the chunks written to the stream. The Promise rejects if the stream emits an error or when the stream is destroyed. The stream does not destroy itself automatically after ending. The stream will emit a `'close'` event when it is destroyed.

- options
  - `highWaterMark` Writes are completed immediately and synchronously, so this parameters is only really relevant if the stream is [cork](https://nodejs.org/api/stream.html#stream_writable_cork)ed. `highWaterMark` indicates the number of objects that the stream should buffer while corked. The default is 16.
- Returns: A 2-tuple (Array of length 2), the first element a [Writable](https://nodejs.org/api/stream.html#stream_writable_streams) stream, and the second element a Promise.

## Author

Raymond Lam (ray@lam-ray.com)

## License

MIT
