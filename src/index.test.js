"use strict";

import './TextEncoder-polyfill';
import {Binary, binary, withBinary, Types} from './index.js';

class BinaryTest extends Binary {
  @binary(Types.Uint32)
  id = 0;
  @binary(Types.Float64)
  testFloat = 0;
  @binary(Types.Array(Types.Float32, 10))
  testFloatArray;

  showId = () => console.log(`My id is ${this.id}`);
}

class BinaryWithoutArrayTest extends Binary {
  @binary(Types.Uint32)
  id = 0;
  @binary(Types.Float64)
  testFloat = 0;

  showId = () => console.log(`My id is ${this.id}`);
}

const binTest = new ArrayBuffer(BinaryTest.binarySize);
const proxyObject = new BinaryTest(binTest);

test("Change property nature (re-define prototype properties) throws error", () => {
  expect(() => {
    Object.defineProperty(BinaryTest.prototype, 'id', {
      get: () => 42,
    });
  }).toThrow(TypeError);
});

test("Get and set properties", () => {
  // Initially set to 0
  expect(proxyObject.id).toBe(0);
  expect(proxyObject.testFloat).toBe(0);

  // Set a value to each member
  proxyObject.id = 12345;
  proxyObject.testFloat = 7.8;

  expect(proxyObject.id).toBe(12345);
  expect(proxyObject.testFloat).toBe(7.8);
});

test("Get and set text properties", () => {
  class BinaryTextTest extends Binary {
    @binary(Types.Uint8)
    byte1;
    @binary(Types.Text(22))
    name;
    @binary(Types.Uint8)
    byte2;
  }

  const binTest2 = new ArrayBuffer(BinaryTextTest.binarySize);
  const testText = new BinaryTextTest(binTest2);

  expect(testText.byte1).toBe(0);
  expect(testText.byte2).toBe(0);
  expect(testText.name).toBe("");
  testText.name = "H";
  expect(testText.name).toBe("H"); // length: 1
  testText.name = "Hi!";
  expect(testText.name).toBe("Hi!"); // length: 3
  testText.name = "¡Hôlà Mündó! 😜";
  expect(testText.name).toBe("¡Hôlà Mündó! 😜"); // length: 22 (max)

  // Array overflow
  testText.name = "¡Hôlà Mündó!  😜";
  expect(testText.name).not.toBe("¡Hôlà Mündó!  😜"); // length: 23

  // Field boundaries have been respected
  expect(testText.byte1).toBe(0);
  expect(testText.byte2).toBe(0);
});

test("Get and set properties in arrays", () => {
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
  expect(testArray[2]).toBe(0);

  // Map methods
  const mapped = testArray.map( (v, i) => [v, i]);
  expect(mapped).toEqual([[1, 0],[2, 1],[0, 2],[0, 3],[0, 4],[0, 5],[0, 6],[0, 7],[0, 8], [0, 9]]);
  const reduced = testArray.map().reduce( (acc, v, i) => ({...acc, [`i${i}`]: v}), {});
  expect(reduced).toEqual({ i0: 1, i1: 2, i2: 0, i3: 0, i4: 0, i5: 0, i6: 0, i7: 0, i8: 0, i9: 0 });

  // Modify full array
  const newArr = [1,0,0,0,0,0,0,0,0,1];
  proxyObject.testFloatArray = newArr;
  expect([...testArray]).toEqual(newArr);
});

test("Get and set properties in nested structs", () => {
  class BinaryNestedTest extends Binary {
    @binary(Types.Struct(BinaryTest))
    testNested;
  
    get id() { return this.testNested.id }
    set id(value) {
      this.testNested.id = value;
      return true
    }

    @binary(Types.Uint32)
    someNumber = 0;

    showId = this.testNested.showId;
  }

  const binTest2 = new ArrayBuffer(BinaryNestedTest.binarySize);
  const proxyNested = new BinaryNestedTest(binTest2);

  // Modify nested prop using a setter
  proxyNested.id = 12345;
  expect(proxyNested.id).toBe(12345);
  expect(proxyNested.testNested.id).toBe(12345);

  // Modify nested last array element
  const length = proxyNested.testNested.testFloatArray.length;
  proxyNested.testNested.testFloatArray[length-1] = 5;
  proxyNested.someNumber = 1;
  expect(proxyNested.someNumber).toBe(1);
  expect([...proxyNested.testNested.testFloatArray]).toEqual([0,0,0,0,0,0,0,0,0,5]);

  // Modify full nested' array
  proxyNested.testNested = {testFloatArray: [0,0,0,0,0,0,0,0,0,1]};
  expect([...proxyNested.testNested.testFloatArray]).toEqual([0,0,0,0,0,0,0,0,0,1]);
});

test("Get and set properties in nested array of structs and nested JSON fully works", () => {
  class BinaryArrayOfNestedTest extends Binary {
    @binary(Types.Array(Types.Struct(BinaryTest), 3))
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

  const binTest2 = new ArrayBuffer(BinaryArrayOfNestedTest.binarySize);
  const proxyNested = new BinaryArrayOfNestedTest(binTest2);

  proxyNested.id = 12345;
  expect(proxyNested.id).toBe(12345);
  expect(proxyNested.testNested[0].id).toBe(12345);

  const offset = BinaryTest.binarySize-1+4;
  const notModifiedByte = proxyNested.getByteAt(offset);
  expect(notModifiedByte).toBe(0);
  proxyNested.testNested[1].id = 255;
  const modifiedByte = proxyNested.getByteAt(offset);
  expect(modifiedByte).toBe(255);

  const savedJSON = '{"testNested":[{"id":12345,"testFloat":0,"testFloatArray":[0,0,0,0,0,0,0,0,0,0]},{"id":255,"testFloat":0,"testFloatArray":[0,0,0,0,0,0,0,0,0,0]},{"id":0,"testFloat":0,"testFloatArray":[0,0,0,0,0,0,0,0,0,0]}],"someNumber":0}';
  expect(JSON.stringify(proxyNested)).toBe(savedJSON);
});

test("Get and set properties on object with independent binary data", () => {
  // Create a new object bound to the same array buffer
  const binTest2 = new ArrayBuffer(BinaryTest.binarySize);
  const proxyObject2 = new BinaryTest(binTest2);

  // Initially set to 0
  expect(proxyObject2.id).toBe(0);
  expect(proxyObject2.testFloat).toBe(0);

  // Set values in new object
  proxyObject2.id = 54321;
  proxyObject2.testFloat = 0.3;

  // Only new object must have changed
  expect(proxyObject2.id).toBe(54321);
  expect(proxyObject2.testFloat).toBe(0.3);

  expect(proxyObject.id).toBe(12345);
  expect(proxyObject.testFloat).toBe(7.8);
});

test("Get and set properties on object with shared binary data", () => {
  // Create a new object bound to the same array buffer
  const proxyObject2 = new BinaryTest(binTest);

  // Set values in new object
  proxyObject2.id = 54321;
  proxyObject2.testFloat = 0.3;

  // Both object must have changed their member values
  expect(proxyObject2.id).toBe(54321);
  expect(proxyObject2.testFloat).toBe(0.3);

  expect(proxyObject.id).toBe(54321);
  expect(proxyObject.testFloat).toBe(0.3);
});

test("Instantiate an object with a binary data using an initial offset > 0", () => {
  // Create a new object bound to the same array buffer
  const initialSize = 12; // 3 * Int32
  const binTest2 = new ArrayBuffer(BinaryTest.binarySize + initialSize);
  const proxyObject2 = new BinaryTest(binTest2, initialSize);

  // Create a DV to manage the initial 12 bytes with 3 Int32 values
  const initialsDV = new DataView(binTest2, 0, initialSize);
  initialsDV.setInt32(0, 1);
  initialsDV.setInt32(4, 2);
  initialsDV.setInt32(8, 3);

  // Initially set to 0
  expect(proxyObject2.id).toBe(0);
  expect(proxyObject2.testFloat).toBe(0);

  // Set values in new object
  proxyObject2.id = 54321;
  proxyObject2.testFloat = 0.3;

  // Only new object must have changed
  expect(proxyObject2.id).toBe(54321);
  expect(proxyObject2.testFloat).toBe(0.3);

  const expectedValues = [1,2,3];
  const values = expectedValues.map( (_, index) => initialsDV.getInt32(index*4) );
  expect(values).toEqual( expectedValues );
});

test("Profile a natural object against a binary object", () => {

  let gc = () => {
    global.gc();
    global.gc();
    global.gc();
    global.gc();
    global.gc();
    global.gc();
  }

  // Use Node Garbage Collector to profile memory usage more precisely
  try {
    gc();
  } catch (e) {
    console.error("`node --expose-gc index.js`");
    //process.exit(1);
    gc = () => {};
  }

  // Natural object to test against
  class NaturalObject {
    id = 0;
    testFloat = .0;
    testFloatArray = [.0,.0,.0,.0,.0,.0,.0,.0];
  }

  // Lots of iterations to get relevant time lapses
  const iterations = 3e5;

  // Save memory and time profiling info
  const memory = [];

  // Get initial usage before starting the profile
  memory.push({
    usage: process.memoryUsage(),
    name: 'Start',
  });

  // Helper to launch each profile test
  const testProfile = (name, fn) => {
    const dateStart = new Date();
    const ret = fn();
    const dateEnd = new Date();
    const time = dateEnd - dateStart;
    memory.push({
      usage: process.memoryUsage(),
      name,
      time,
    });
    return ret;
  }

  const testObjList = (name, objList) => {
    testProfile(`${name} modification`, () => {
      objList.forEach( (obj, id) => { obj.id = id });
    });
 
    const matched = testProfile(`${name} access`, () => {
      return objList.every( (obj, id) => id === obj.id );
    });
    expect(matched).toBe(true);
 
    testProfile(`${name} access 2nd phase`, () => {
      objList.every( (obj, id) => id === obj.id );
    });
 
    testProfile(`${name} modification 2nd phase`, () => {
      objList.forEach( (obj, id) => { obj.id = id } );
    });
  }

  //
  // Natural Object
  //
  gc();
  const nObjList = []; // new Array(iterations) is much slower
  testProfile('Natural Object instantation', () => {
    for(let i = 0; i < iterations; i++) {
      nObjList.push(new NaturalObject());
    }
  });

  testObjList('Natural Object', nObjList);

  //
  // Binary Object
  //
  gc();
  const bObjList = [];
  testProfile('Binary Object instantation', () => {
    const binTest2 = new ArrayBuffer(BinaryTest.binarySize * iterations);
    const dv = new DataView(binTest2);
    for(let i = 0; i < iterations; i++) {
      bObjList.push(new BinaryTest(dv, BinaryTest.binarySize * i));
    }
  });

  testObjList('Binary Object', bObjList);

  //
  // Binary Object
  //
  gc();
  const bwoaObjList = [];
  testProfile('Binary Object without array instantation', () => {
    const binTest2 = new ArrayBuffer(BinaryWithoutArrayTest.binarySize * iterations);
    const dv = new DataView(binTest2);
    for(let i = 0; i < iterations; i++) {
      bwoaObjList.push(new BinaryWithoutArrayTest(dv, BinaryWithoutArrayTest.binarySize * i));
    }
  });

  testObjList('Binary Object without array', bwoaObjList);

  //
  // Binary Object with class decorator
  //
  gc();
  const bdObjList = [];
  testProfile('Binary Object with class decorator instantation', () => {

    @withBinary
    class BinaryObjectWithDecorator {
      @binary(Types.Uint32)
      id = 0;
      @binary(Types.Float64)
      testFloat = 0;
      @binary(Types.Array(Types.Float32, 10))
      testFloatArray;
  
      showId = () => console.log(`My id is ${this.id}`);
    };

    const binTest2 = new ArrayBuffer(BinaryObjectWithDecorator.binarySize * iterations);
    const dv = new DataView(binTest2);
    for(let i = 0; i < iterations; i++) {
      bdObjList.push(BinaryObjectWithDecorator(dv, BinaryObjectWithDecorator.binarySize * i));
    }
  });

  testObjList('Binary Object with class decorator', bdObjList);

  // Show collected metrics in a table
  const numberWithCommas = (x) => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const memoryDiffTable = memory
    .map( ({usage, ...rest}, indexMemory) => ({
      ...rest,
      ...Object.entries(usage)
        .map(([key, value]) => ({
          key,
          originalValue: value,
          value: indexMemory === 0
            ? 0
            : value - memory[indexMemory - 1].usage[key]
        }))
        .reduce(
          (acc, {key, value}) => ({
            ...acc,
            [key]: numberWithCommas(value),
          }),
          {}
        ),
    }))
  .reduce( (acc, {name, ...rest}) => ({
    ...acc,
    [name]: rest,
  }), {});
  console.table(memoryDiffTable);
});

