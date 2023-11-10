"use strict";

import "./TextEncoder-polyfill";
import { Binary, binary, withBinary, Types } from "./index.js";

class BinaryTest extends Binary {
  @binary(Types.Uint32)
  id = 0;
  @binary(Types.Float64)
  testFloat = 0;
  @binary(Types.Array(Types.Float32, 10))
  testFloatArray;

  showId = () => console.log(`My id is ${this.id}`);
}

const binTest = new ArrayBuffer(BinaryTest.binarySize);
const proxyObject = new BinaryTest(binTest);

test("Change property nature (re-define prototype properties) throws error", () => {
  expect(() => {
    Object.defineProperty(BinaryTest.prototype, "id", {
      get: () => 42,
    });
  }).toThrow(TypeError);
});

test("Binary size is exact (no padding)", () => {
  // No padding done (nor needed...)
  const expectedSize =
    Types.Uint32.bytes + Types.Float64.bytes + Types.Float32.bytes * 10;
  expect(BinaryTest.binarySize).toBe(expectedSize);
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

  // Test adding custom prop to array object
  testArray.someThing = "something else";
  expect(testArray.someThing).toBe("something else");

  // Map methods
  const mapped = testArray.map((v, i) => [v, i]);
  expect(mapped).toEqual([
    [1, 0],
    [2, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [0, 5],
    [0, 6],
    [0, 7],
    [0, 8],
    [0, 9],
  ]);
  const reduced = testArray
    .map()
    .reduce((acc, v, i) => ({ ...acc, [`i${i}`]: v }), {});
  expect(reduced).toEqual({
    i0: 1,
    i1: 2,
    i2: 0,
    i3: 0,
    i4: 0,
    i5: 0,
    i6: 0,
    i7: 0,
    i8: 0,
    i9: 0,
  });

  // Modify full array
  const newArr = [1, 0, 0, 0, 0, 0, 0, 0, 0, 1];
  proxyObject.testFloatArray = newArr;
  expect([...testArray]).toEqual(newArr);
});

test("Test non padded array", () => {
  const type = Types.Uint32;
  const length = 5;
  class BinaryNoPadTest extends Binary {
    @binary(Types.Uint8)
    someMemberAtTheBegining;

    // Not padded (smaller, slower)
    @binary(Types.Array(type, length))
    testArray;

    @binary(Types.Uint8)
    someMemberAtTheEnd;
  }

  const expectedSize =
    1 + // First byte
    length * type.bytes + // Not padded array
    1; // Last byte
  expect(BinaryNoPadTest.binarySize).toBe(expectedSize);
});

test("Test padded array", () => {
  const type = Types.Uint32;
  const type1Byte = Types.Int8;
  const length = 5;
  class BinaryPadTest extends Binary {
    @binary(Types.Uint8)
    someMemberAtTheBegining;

    // `true` forces array padding
    @binary(Types.Array(type, length, true))
    testArray;

    // 1 byte arrays are optimized, even when no `true` is given
    @binary(Types.Array(type1Byte, length))
    testArray1Byte;

    @binary(Types.Uint8)
    someMemberAtTheEnd;
  }

  const binTest2 = new ArrayBuffer(BinaryPadTest.binarySize);
  const testObj = new BinaryPadTest(binTest2);

  // The first byte of someMemberAtTheBegining forces to consume
  // a full testArray element before it (for padding)
  const expectedSize =
    (length + 1) * type.bytes + // First byte + First padded array
    length * type1Byte.bytes + // Second array
    1; // Last byte
  expect(BinaryPadTest.binarySize).toBe(expectedSize);

  // 1 byte array is automatically optimized (without `padding=true`)
  expect(testObj.testArray1Byte).toBeInstanceOf(type1Byte.extractor);

  // Test bound TypedArray values
  const expectedArr = new Array(length).fill(0);
  const arr = testObj.testArray;
  expect(arr).toBeInstanceOf(type.extractor);
  expect([...arr]).toEqual(expectedArr);

  // Fill first value with binary 1's
  const max = eval("0x" + "ff".repeat(type.bytes));
  arr[0] = max;
  expectedArr[0] = max;
  expect([...arr]).toEqual(expectedArr);

  // Original data has also been modified
  expect([...testObj.testArray]).toEqual(expectedArr);

  // Check that the bytes on the buffer have been filled
  for (let i = 0; i < type.bytes; i++) {
    expect(testObj.getByteAt(i + type.bytes)).toBe(255);
  }

  // Test typecasting
  arr[0] = 1;
  expectedArr[0] = 1;
  expect([...arr]).toEqual(expectedArr);

  // Test full array assignment
  testObj.testArray = [1, 1, 1];
  expect([...arr]).toEqual([1, 1, 1, 0, 0]);

  // Test array overflow on full assignment throws RangeError
  expect(() => {
    testObj.testArray = new Array(length + 1).fill(0);
  }).toThrow(RangeError);

  // Test array overflow by index does nothing
  expect(testObj.testArray[length]).toBe(undefined);
  testObj.testArray[length] = 1;
  expect(testObj.testArray[length]).toBe(undefined);
});

test("Class inheritance works", () => {
  class BinaryChildTest extends BinaryTest {
    @binary(Types.Uint8)
    someMemberAtTheEnd;
  }

  const binTest2 = new ArrayBuffer(BinaryChildTest.binarySize);
  const testChild = new BinaryChildTest(binTest2);

  // Test inherited member
  expect(testChild.id).toBe(0);
  testChild.id = 12345;
  expect(testChild.id).toBe(12345);

  // Test changing last inherited member does not overflows
  const initialArr = new Array(10).fill(0);
  expect([...testChild.testFloatArray]).toEqual(initialArr);
  const newArr = new Array(10).fill(255);
  testChild.testFloatArray = newArr;
  expect([...testChild.testFloatArray]).toEqual(newArr);

  // Child members are at the end: test last byte change
  expect(testChild.getByteAt(BinaryChildTest.binarySize - 1)).toBe(0);
  testChild.someMemberAtTheEnd = 255;
  expect(testChild.getByteAt(BinaryChildTest.binarySize - 1)).toBe(255);
});

test("Get and set properties in nested structs", () => {
  class BinaryNestedTest extends Binary {
    @binary(Types.Struct(BinaryTest))
    testNested;

    get id() {
      return this.testNested.id;
    }
    set id(value) {
      this.testNested.id = value;
      return true;
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
  proxyNested.testNested.testFloatArray[length - 1] = 5;
  proxyNested.someNumber = 1;
  expect(proxyNested.someNumber).toBe(1);
  expect([...proxyNested.testNested.testFloatArray]).toEqual([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 5,
  ]);

  // Modify full nested' array
  proxyNested.testNested = { testFloatArray: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1] };
  expect([...proxyNested.testNested.testFloatArray]).toEqual([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
  ]);
});

test("Get and set properties in nested array of structs and nested JSON fully works", () => {
  class BinaryArrayOfNestedTest extends Binary {
    @binary(Types.Array(Types.Struct(BinaryTest), 3))
    testNested;

    get id() {
      return this.testNested[0].id;
    }
    set id(value) {
      this.testNested[0].id = value;
      return true;
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

  const offset = BinaryTest.binarySize - 1 + 4;
  const notModifiedByte = proxyNested.getByteAt(offset);
  expect(notModifiedByte).toBe(0);
  proxyNested.testNested[1].id = 255;
  const modifiedByte = proxyNested.getByteAt(offset);
  expect(modifiedByte).toBe(255);

  const savedJSON =
    '{"testNested":[{"id":12345,"testFloat":0,"testFloatArray":[0,0,0,0,0,0,0,0,0,0]},{"id":255,"testFloat":0,"testFloatArray":[0,0,0,0,0,0,0,0,0,0]},{"id":0,"testFloat":0,"testFloatArray":[0,0,0,0,0,0,0,0,0,0]}],"someNumber":0}';
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

  const expectedValues = [1, 2, 3];
  const values = expectedValues.map((_, index) =>
    initialsDV.getInt32(index * 4),
  );
  expect(values).toEqual(expectedValues);
});

test("Profile a natural object against a binary object", async () => {
  const sleep = (millis) =>
    new Promise((resolve) => setTimeout(resolve, millis));

  let gc = () => {
    global.gc();
    global.gc();
    global.gc();
    global.gc();
    global.gc();
    global.gc();
  };

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
    testFloat = 0.0;
    testFloatArray = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
  }

  // Lots of iterations to get relevant time lapses
  const iterations = 3e5;

  // Save memory and time profiling info
  const memory = [];

  // Get initial usage before starting the profile
  memory.push({
    usage: process.memoryUsage(),
    name: "Start",
  });

  // Helper to launch each profile test
  const testProfile = async (name, fn) => {
    const dateStart = new Date();
    const ret = await fn();
    const dateEnd = new Date();
    const time = dateEnd - dateStart;
    memory.push({
      usage: process.memoryUsage(),
      name,
      time,
    });
    return ret;
  };

  const testObjList = async (name, objList) => {
    await testProfile(`${name} modification`, () => {
      objList.forEach((obj, id) => {
        obj.id = id;
      });
    });

    const matched = await testProfile(`${name} access`, () => {
      return objList.every((obj, id) => id === obj.id);
    });
    expect(matched).toBe(true);

    await testProfile(`${name} access 2nd phase`, () => {
      objList.every((obj, id) => id === obj.id);
    });

    await testProfile(`${name} modification 2nd phase`, () => {
      objList.forEach((obj, id) => {
        obj.id = id;
      });
    });

    if ("testFloatArray" in objList[0]) {
      await testProfile(`${name} access array element`, () => {
        objList.every(({ testFloatArray }) => testFloatArray[0] === 0);
      });

      await testProfile(`${name} modification array element`, () => {
        objList.forEach(({ testFloatArray }, id) => (testFloatArray[0] = id));
      });

      await testProfile(`${name} access array element 2nd phase`, () => {
        objList.every(({ testFloatArray }, id) => testFloatArray[0] === id);
      });

      await testProfile(`${name} modification array element 2nd phase`, () => {
        objList.forEach(
          ({ testFloatArray }, id) => (testFloatArray[0] = id * 2),
        );
      });
    }

    await testProfile(`${name} garbage collected`, async () => {
      gc();
      await sleep(1000);
      gc();
    });
  };

  gc();

  //
  // Natural Object
  //
  const nObjList = []; // new Array(iterations) is much slower
  await testProfile("Natural Object instantation", () => {
    for (let i = 0; i < iterations; i++) {
      nObjList.push(new NaturalObject());
    }
  });

  await testObjList("Natural Object", nObjList);

  //
  // Binary Object
  //
  let bObjList;
  await testProfile("Binary Object instantation", () => {
    const binTest2 = new ArrayBuffer(BinaryTest.binarySize * iterations);
    bObjList = BinaryTest.arrayFactory(binTest2, iterations);
  });

  await testObjList("Binary Object", bObjList);

  //
  // Binary Object with pre-created DataView
  //
  let binTest3, dv3, bDvObjList;
  await testProfile(
    "Binary Object with pre-created DataView alloc memory",
    () => {
      binTest3 = new ArrayBuffer(BinaryTest.binarySize * iterations);
      dv3 = new DataView(binTest3);
    },
  );
  await testProfile(
    "Binary Object with pre-created DataView instantation",
    () => {
      bDvObjList = BinaryTest.arrayFactory(dv3, iterations);
    },
  );

  await testObjList("Binary Object with pre-created DataView", bDvObjList);

  //
  // Binary Object with padded array
  //
  let bwpaObjList;
  await testProfile("Binary Object with padded array instantiation", () => {
    class BinaryTestPadded extends Binary {
      @binary(Types.Uint32)
      id = 0;
      @binary(Types.Float64)
      testFloat = 0;
      @binary(Types.Array(Types.Float32, 10, true))
      testFloatArray;

      showId = () => console.log(`My id is ${this.id}`);
    }

    const binTest2 = new ArrayBuffer(BinaryTestPadded.binarySize * iterations);
    bwpaObjList = BinaryTestPadded.arrayFactory(binTest2, iterations);
  });

  await testObjList("Binary Object with padded array", bwpaObjList);

  //
  // Binary Object without array
  //
  let bwoaObjList;
  await testProfile("Binary Object without array instantation", () => {
    class BinaryWithoutArrayTest extends Binary {
      @binary(Types.Uint32)
      id = 0;
      @binary(Types.Float64)
      testFloat = 0;

      showId = () => console.log(`My id is ${this.id}`);
    }

    const binTest2 = new ArrayBuffer(
      BinaryWithoutArrayTest.binarySize * iterations,
    );
    bwoaObjList = BinaryWithoutArrayTest.arrayFactory(binTest2, iterations);
  });

  await testObjList("Binary Object without array", bwoaObjList);

  //
  // Binary Object with class decorator
  //
  let bdObjList;
  await testProfile("Binary Object with class decorator instantation", () => {
    @withBinary
    class BinaryObjectWithDecorator {
      @binary(Types.Uint32)
      id = 0;
      @binary(Types.Float64)
      testFloat = 0;
      @binary(Types.Array(Types.Float32, 10))
      testFloatArray;

      showId = () => console.log(`My id is ${this.id}`);
    }

    const binTest2 = new ArrayBuffer(
      BinaryObjectWithDecorator.binarySize * iterations,
    );
    bdObjList = BinaryObjectWithDecorator.arrayFactory(binTest2, iterations);
  });

  await testObjList("Binary Object with class decorator", bdObjList);

  //
  // Binary Object with class decorator and padded array
  //
  let bdpObjList;
  await testProfile(
    "Binary Object with class decorator instantation and padded array",
    () => {
      @withBinary
      class BinaryObjectWithDecorator {
        @binary(Types.Uint32)
        id = 0;
        @binary(Types.Float64)
        testFloat = 0;
        @binary(Types.Array(Types.Float32, 10, true))
        testFloatArray;

        showId = () => console.log(`My id is ${this.id}`);
      }

      const binTest2 = new ArrayBuffer(
        BinaryObjectWithDecorator.binarySize * iterations,
      );
      bdpObjList = BinaryObjectWithDecorator.arrayFactory(binTest2, iterations);
    },
  );

  await testObjList(
    "Binary Object with class decorator and padded array",
    bdpObjList,
  );

  // Show collected metrics in a table
  const numberWithCommas = (x) =>
    x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const memoryDiffTable = memory
    .map(({ usage, ...rest }, indexMemory) => ({
      ...rest,
      ...Object.entries(usage)
        .map(([key, value]) => ({
          key,
          originalValue: value,
          value:
            indexMemory === 0 ? 0 : value - memory[indexMemory - 1].usage[key],
        }))
        .reduce(
          (acc, { key, value }) => ({
            ...acc,
            [key]: numberWithCommas(value),
          }),
          {},
        ),
    }))
    .reduce(
      (acc, { name, ...rest }) => ({
        ...acc,
        [name]: rest,
      }),
      {},
    );
  console.table(memoryDiffTable);
}, 6e4);
