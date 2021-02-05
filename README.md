![Coverage](https://raw.githubusercontent.com/emibcn/binary-object/badges/main/test-coverage.svg)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v2.0%20adopted-ff69b4.svg)](code_of_conduct.md)

# Binary Object
Manage binary data with strictly typed JavaScript Object-oriented programming.

## Summary
 - [Install](#install)
 - [Usage](#usage)
   - [First: polyfill if needed](#first-polyfill-if-needed)
   - [Second: decorators or not](#second-decorators-or-not)
   - [Examples](#examples)
 - [Memory owner](#memory-owner)
 - [Use cases](#use-cases)
   - [WebAssembly](#webassembly)
   - [Disable Garbage Collector (GC)](#disable-garbage-collector-gc)
   - [Workers API](#workers-api)
   - [Saving/restoring states](#savingrestoring-states)
   - [Accessing binary data files](#accessing-binary-data-files)
   - [Accessing binary APIs](#accessing-binary-apis)
   - [Develop backend DB APIs](#develop-backend-db-apis)
 - [See also](#see-also)

## Install
With `npm`:
```shell
npm install binary-object
```

With `yarn`:
```shell
yarn add binary-object
```

## Usage

### First: polyfill if needed
This library uses `TextEncoder` and `TextDecoder` to transform text to and from binary data. These are JavaScript native functions, but Node lacks them. You need to polyfill them first:
```javascript
if(!('TextEncoder' in global)) {
  import('util').then(nodeUtil => {;
    global.TextEncoder = nodeUtil.TextEncoder;
    global.TextDecoder = nodeUtil.TextDecoder;
  });
}
```

For this to work on Node >= 14, you need to install `util` first:
```shell
npm install --save util
```

### Second: decorators or not
This library encourages the use of class member decorators, available in Typescript, but at a [stage 2 proposal](https://github.com/tc39/proposals#stage-2). To add it into your `Babel` configuration, you will need something like:

```json
    "plugins": [
      "@babel/plugin-transform-runtime",
      [ "@babel/plugin-proposal-decorators", { "legacy": true } ],
      [ "@babel/plugin-proposal-class-properties", { "loose": true } ]
    ]
```

If you don't want to use decorators, you will need to use it like (not tested):
```javascript
class MyBinaryClass extends BinaryObject { /* Functions/logic/statics */ }
Object.defineProperty(MyBinaryClass.prototype, "someMember", binary(Types.Float32));
```

### Examples
```javascript
import {Binary, binary, Types} from 'binary-object';

// Declare object shape
class BinaryTest extends Binary {
  @binary(Types.Uint32)
  id = 0;
  @binary(Types.Float64)
  testFloat = 0;

  // Array of 10 low precision floating point numbers
  @binary(Types.Array(Types.Float32, 10))
  testFloatArray;

  showId = () => console.log(`My id is ${this.id}`);
}

// Allocate memory
const binTest = new ArrayBuffer( BinaryTest.binarySize );

// Instantiate memory parser
const proxyObject = new BinaryTest(binTest);

// Use it
proxyObject.id = 12345;
proxyObject.testFloat = 7.8;

expect(proxyObject.id).toBe(12345);
expect(proxyObject.testFloat).toBe(7.8);
```

Accessing and modifying arrays and array elements also work:
```javascript
const testArray = proxyObject.testFloatArray;

// Iteratibility
expect([...testArray]).toEqual(new Array(10).fill(0));

// Elements access and modification
expect(testArray[0]).toBe(0);
testArray[0] = 1;
expect(testArray[0]).toBe(1);
expect(testArray[1]).toBe(0);
testArray[1] = 2;
expect(testArray[0]).toBe(1);
expect(testArray[1]).toBe(2);

// Modify full array
const newArr = [1,0,0,0,0,0,0,0,0,1];
proxyObject.testFloatArray = newArr;
expect([...testArray]).toEqual(newArr);
```

Object composition is also allowed:
```javascript
class BinaryArrayOfNestedTest extends Binary {
  // Array of 3 BinaryTest objects
  @binary( Types.Array( Types.Struct(BinaryTest), 3))
  testNested;

  get id() { return this.testNested[0].id }
  set id(value) {
    this.testNested[0].id = value;
    return true
  }

  @binary(Types.Uint32)
  someNumber = 0;

  showId = this.testNested[0].showId;
}

const binTest2 = new ArrayBuffer( BinaryArrayOfNestedTest.binarySize );
const proxyNested = new BinaryArrayOfNestedTest( binTest2 );
```

Object composition from different memory sources is also allowed:
```javascript
class Position extends Binary {
  @binary(Types.Uint32)
  x;
  @binary(Types.Uint32)
  y;

  static testCollision(pos1, pos2) {
    ...
  }

  collision = (pos2) => this.constructor.testCollision(this, pos2);
}

class Player extends Binary {
  @binary( Types.Struct(Position) )
  position;
  @binary(Types.Float64)
  life;

  // Non managed binary data (like pointers)
  bullets = [];
}

class Bullet extends Binary {
  @binary( Types.Struct(Position) )
  position;
  @binary(Types.Float64)
  direction;
}

class Game {
  constructor() {
    // malloc for players
    this.binPlayers = new ArrayBuffer( Player.binarySize * 2 );
    this.player1 = new Player( this.binPlayers );
    this.player2 = new Player( this.binPlayers, Player.binarySize );

    // malloc for bullets
    this.maxBullets = 100;
    this.binBullets = new ArrayBuffer( Bullet.binarySize * this.maxBullets );

    // Optimize bullets by using a unique DataView for all of them
    this.dvBullets = new DataView(this.binBullets);

    // Half of the bullets for each player
    for(let i = 0; i < maxBullets; i++) {
      const player = i < (maxBullets/2) ? this.player1 : this.player2;
      const {bullets} = player;
      bullets.push(new Bullet(this.dvBullets, Bullet.binarySize * i) );
    }
  }

  // You can move Bullets using a parallel worker or a WASM code block

  // Sometimes, check if a bullet touched a victim
  testTouched(attacker, victim) {
    const {position: {collision}} = victim;
    const touched = attacker.bullets.some( ({position}) => collision(position) );
  }
}

```

Transform your binary data into a JSON string:
```javascript
console.log( JSON.stringify(proxyNested) );
```

Assign data from JS objects:
```javascript
proxyNested.testNested = {testFloatArray: [0,0,0,0,0,0,0,0,0,1]};
expect( [...proxyNested.testNested.testFloatArray] ).toEqual([0,0,0,0,0,0,0,0,0,1]);
```

Allocate and parse a big memory chunk as array of objects:
```javascript
const iterations = 5e5;
const binTest3 = new ArrayBuffer( BinaryTest.binarySize * iterations );
const dv3 = new DataView(binTest3);
const bObjList = new Array(iterations);
for(let i = 0; i < iterations; i++) {
  bObjList.push(new BinaryTest(dv3, BinaryTest.binarySize * i));
}
bObjList.forEach( (obj, index) => obj.id = `i${index}`);
const ids = bObjList.map( ({id}) => id);
```

## Memory owner
This library does not aims to own the memory, allowing to use it in different ways. The memory can be allocated from a parallel worker, from the WebAssembly code or from another library or API which can
be consumed using `ArrayBuffer` or `SharedBuffer`. It's recommended to wrap this library with the one managing the memory.

**Note:** Opting in into managing your own memory (as in C) requires you to understand what you are doing at a low level. Things like dynamic array sizes or text manipulation can be a pain if you don't
understand the basics (not to say about endianness or memory padding). There are several standards and known ways to manage the memroy. This library aims to make it much easier to parse it (read and write),
but you'll still need to know how it works. Specifically, this libs does not aims to own the memory pieces: you'll need to create/allocate/move/copy/reallocate/free them around instantiating the JS binary objects.

## Use cases
The environments where direct memory management would be desirable are minimal in JS. Still, there are some edge cases where it could be benefficial or mandatory to do so.

### WebAssembly
WebAssembly allows coding in some low level language (like C, C++ or Rust) and compiling to some binary code which can be executed by a JS interpreter (with WebAssembly API, of course).

The code compiled into WebAssembly can use dedicated libraries to communicate with the JS code. It allows accessing the DOM (thus, the `window` object), but also sharing pieces of memory
using `WebAssembly.Memory`. Using that, you could write complex but very fast code to do heavy calculations in your compiled code, and trigger some kind of JS re-render using the currently
calculated values at some time or frame-rate.

### Disable Garbage Collector (GC)
As app states is mostly managed by the `ArrayBuffer` (except some JS internal caches), you can minimize GC works, which will run your game (app) much smoothly without unexpected background GC tasks.

### Workers API
Similar to the WebAssembly use case, some one could create a `SharedBuffer` and use it from different Workers, allowing your app to use more than one CPU. For example in a game: you could have
the main worker which updates the `DOM` (or a `canvas` or a OpenGL) using the data from the buffer, while having several workers calculating 3D collisions.

### Saving/restoring states
As all the data is in a single memory piece, you can easily save it to somewhere and load it later to restore the state. This could be benefficial for games, as well as AIs, 3D renderers, scientific
calculations, password crackers, etc.

### Accessing binary data files
Dynamic binary reading, processing and writing (to server or directly to user), like images, audio, video, medical data (DICOM), etc.

### Accessing binary APIs
You could take full advantage of browsers USB and/or Bluetooth APIs, but also you could easily communicate against binary API servers or IoT. Though, as those are usually read-only or
stream based, you would preffer using `DataStreams.js` instead.

### Develop backend DB APIs
Some libraries allows maintaining shared pieces of memory between the backend app and the database. This lib could help developing Node database middlewares.

## See also
There are several JS projects aiming to handle binary data:
- [buffer-backed-object](https://github.com/GoogleChromeLabs/buffer-backed-object): creates objects that are backed by an ArrayBuffer
- [@bnaya/objectbuffer](https://www.npmjs.com/package/@bnaya/objectbuffer) ([source code](https://github.com/Bnaya/objectbuffer/)): JavaScript Object like api, backed by an arraybuffer
- [DataStream.js](https://github.com/kig/DataStream.js): library for reading data from ArrayBuffers
