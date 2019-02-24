/* global describe it */
/* eslint-disable no-magic-numbers */

'use strict';

const {expect} = require('chai');
const {
  writableStreamAndPromise,
  writableObjectStreamAndPromise,
} = require('./index');
const {constants: {MAX_LENGTH}} = require('buffer');

describe('writableStreamAndPromise', () => {
  it(
    'returns a writable stream and promise where the stream is immediately '
      + 'flushed when written to and the promise resolves to the concatenation '
      + 'of the Buffers written to the stream when the stream ends',
    async () => {
      const [writable, promise] = writableStreamAndPromise();

      // eslint-disable-next-line no-unused-expressions
      expect(writable.write(Buffer.from([1, 2, 3]))).to.be.true;

      // eslint-disable-next-line no-unused-expressions
      expect(writable.write(Buffer.from([6, 5, 4]))).to.be.true;
      writable.end();

      const buffer = await promise;

      // eslint-disable-next-line no-unused-expressions
      expect(Buffer.isBuffer(buffer)).to.be.true;
      expect(Array.from(buffer.values())).to.deep.equal([1, 2, 3, 6, 5, 4]);
    }
  );

  it(
    'returns a writable stream and promise where the promise resolves to the '
      + 'strings written to the stream encoded in utf-8',
    async () => {
      const [writable, promise] = writableStreamAndPromise();
      writable.write('abc');
      writable.write('x y z');
      writable.end();

      const buffer = await promise;

      // eslint-disable-next-line no-unused-expressions
      expect(Buffer.isBuffer(buffer)).to.be.true;
      expect(buffer.toString()).to.equal('abcx y z');
    }
  );

  it(
    'returns a writable stream and promise where the promise resolves to the '
      + 'strings written to the stream encoded in specified defaultEncoding',
    async () => {
      const [writable, promise] = writableStreamAndPromise({
        defaultEncoding: 'ucs-2',
      });
      writable.write('abc');
      writable.write('x y z');
      writable.end();

      const buffer = await promise;

      // eslint-disable-next-line no-unused-expressions
      expect(Buffer.isBuffer(buffer)).to.be.true;
      expect(buffer.toString('ucs-2')).to.equal('abcx y z');
    }
  );

  it(
    'returns a writable stream and promise where the promise resolves to the '
      + 'strings written to the stream encoded in the specified encoding in '
      + 'each write',
    async () => {
      const [writable, promise] = writableStreamAndPromise({
        defaultEncoding: 'ucs-2',
      });
      writable.write('abc', 'utf-8');
      writable.write('x y z');
      writable.write('bbb', 'hex');
      writable.end();

      const buffer = await promise;

      // eslint-disable-next-line no-unused-expressions
      expect(Buffer.isBuffer(buffer)).to.be.true;

      expect(Array.from(buffer.values())).to.deep.equal([
        ...Array.from(Buffer.from('abc', 'utf-8')),
        ...Array.from(Buffer.from('x y z', 'ucs-2')),
        ...Array.from(Buffer.from('bbb', 'hex')),
      ]);
    }
  );

  it(
    'returns a writable stream which buffers when corked until the '
      + 'specified high water mark is reached',
    () => new Promise(
      resolve => {
        const [writable, promise] = writableStreamAndPromise({
          highWaterMark: 36,
        });

        promise.then(buffer => {
          expect(
            Array.from(buffer.values())
          ).to.deep.equal([
            1, 2, 3,
            1, 2, 3,
            1, 2, 3,
            1, 2, 3,
            1, 2, 3,
            1, 2, 3,
            1, 2, 3,
            1, 2, 3,
            1, 2, 3,
            1, 2, 3,
            1, 2, 3,
            1, 2, 3,
            4, 5, 6,
            7, 8, 9,
          ]);
          resolve();
        });

        writable.cork();

        let totalBytes = 0;
        do {
          totalBytes += 3;
        } while (writable.write(Buffer.from([1, 2, 3])));

        expect(totalBytes).to.equal(36);

        writable.once('drain', () => {
          // eslint-disable-next-line no-unused-expressions
          expect(writable.write(Buffer.from([4, 5, 6]))).to.be.true;
          writable.end(Buffer.from([7, 8, 9]));
        });

        writable.uncork();
      }
    )
  );

  it(
    'returns a writable stream and promise where the stream frees its '
      + 'collected values, emits a "close" event and causes the promise to '
      + 'reject when the stream is destroyed',
    async () => {
      const [writable, promise] = writableStreamAndPromise();

      const closePromise = new Promise(
        resolve => writable.once('close', resolve)
      );

      writable.write('abc');
      writable.destroy();
      await closePromise;

      // A bit of a hack: call _collect to resolve the promise to the collected
      // bytes, which would throw an error if called after destruction, since
      // the pointer to the collected bytes is set to null.
      expect(() => writable._collect(() => {})).to.throw(
        "Cannot read property 'next' of null"
      );

      let error;
      try {
        await promise;
      }
      catch (e) {
        error = e;
      }

      expect(error).to.be.an.instanceof(Error);
      expect(error.message).to.equal('Stream was destroyed.');
    }
  );

  it(
    'returns a writable stream and promise where the promise rejects with the '
      + 'error that is given to the .destroy() method of the stream',
    async () => {
      const [writable, promise] = writableStreamAndPromise();

      writable.write('abc');

      const destroyError = new Error('test message');
      writable.destroy(destroyError);

      let promiseError;
      try {
        await promise;
      }
      catch (e) {
        promiseError = e;
      }

      expect(promiseError).to.equal(destroyError);
    }
  );

  it(
    'returns a writable stream and promise where the promise rejects if all '
      + 'data written cannot be held in a single Buffer',
    async () => {
      const [writable, promise] = writableStreamAndPromise();

      writable.write(Buffer.alloc(MAX_LENGTH));
      writable.write(Buffer.alloc(1));
      writable.end();

      let error;
      try {
        await promise;
      }
      catch (e) {
        error = e;
      }

      expect(error).to.be.an.instanceof(Error);
      expect(error.message).to.equal(
        `Total length of buffered data (${MAX_LENGTH + 1} bytes) exceeds `
          + `maximum allowed length of Buffer (${MAX_LENGTH} bytes).`
      );
    }
  );
});

describe('writableObjectStreamAndPromise', () => {
  it(
    'returns a writable stream and promise where stream is immediately flushed '
      + 'when written to and the promise resolves to an Array of the objects '
      + 'written to the stream when the stream ends',
    async () => {
      const [writable, promise] = writableObjectStreamAndPromise();

      // eslint-disable-next-line no-unused-expressions
      expect(writable.write('abc')).to.be.true;

      // eslint-disable-next-line no-unused-expressions
      expect(writable.write(512)).to.be.true;

      // eslint-disable-next-line no-unused-expressions
      expect(writable.write({foo: 'bar'})).to.be.true;

      // eslint-disable-next-line no-unused-expressions
      expect(writable.write([1, 'a', {biz: 'baz'}])).to.be.true;

      writable.end();

      const arr = await promise;

      expect(arr).to.be.an.instanceof(Array);
      expect(arr).to.deep.equal([
        'abc',
        512,
        {foo: 'bar'},
        [1, 'a', {biz: 'baz'}],
      ]);
    }
  );

  it(
    'returns a writable stream which buffers when corked until the '
      + 'specified high water mark is reached',
    () => new Promise(
      resolve => {
        const [writable, promise] = writableObjectStreamAndPromise({
          highWaterMark: 5,
        });

        promise.then(buffer => {
          expect(buffer).to.deep.equal([
            'xyz',
            'xyz',
            'xyz',
            'xyz',
            'xyz',
            {abc: 'def'},
            0,
          ]);
          resolve();
        });

        writable.cork();

        let totalObjects = 0;
        do {
          ++totalObjects;
        } while (writable.write('xyz'));

        expect(totalObjects).to.equal(5);

        writable.once('drain', () => {
          // eslint-disable-next-line no-unused-expressions
          expect(writable.write({abc: 'def'})).to.be.true;
          writable.end(0);
        });

        writable.uncork();
      }
    )
  );

  it(
    'returns a writable stream and promise where the stream frees its '
      + 'collected values, emits a "close" event and causes the promise to '
      + 'reject when the stream is destroyed',
    async () => {
      const [writable, promise] = writableObjectStreamAndPromise();

      const closePromise = new Promise(
        resolve => writable.once('close', resolve)
      );

      writable.write('abc');
      writable.destroy();

      await closePromise;

      // A bit of a hack: call _collect to resolve the promise to the collected
      // bytes, which would throw an error if called after destruction, since
      // the pointer to the collected bytes is set to null.
      expect(() => writable._collect(() => {})).to.throw(
        "Cannot read property 'next' of null"
      );

      let error;
      try {
        await promise;
      }
      catch (e) {
        error = e;
      }

      expect(error).to.be.an.instanceof(Error);
      expect(error.message).to.equal('Stream was destroyed.');
    }
  );

  it(
    'returns a writable stream and promise where the promise rejects with the '
      + 'error that is given to the .destroy() method of the stream',
    async () => {
      const [writable, promise] = writableObjectStreamAndPromise();

      writable.write('abc');

      const destroyError = new Error('test message');
      writable.destroy(destroyError);

      let promiseError;
      try {
        await promise;
      }
      catch (e) {
        promiseError = e;
      }

      expect(promiseError).to.equal(destroyError);
    }
  );
});
