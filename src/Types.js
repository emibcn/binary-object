import BinaryArray from './BinaryArray';

const Types = {
  Float32: {
    extractor: Float32Array,
    bytes: 4,
    get: (dv, offset) => dv.getFloat32(offset),
    set: (dv, offset, value) => dv.setFloat32(offset, value),
  },
  Float64: {
    extractor: Float64Array,
    bytes: 8,
    get: (dv, offset) => dv.getFloat64(offset),
    set: (dv, offset, value) => dv.setFloat64(offset, value),
  },
  Int8: {
    extractor: Int8Array,
    bytes: 1,
    get: (dv, offset) => dv.getInt8(offset),
    set: (dv, offset, value) => dv.setInt8(offset, value),
  },
  Int16: {
    extractor: Int16Array,
    bytes: 2,
    get: (dv, offset) => dv.getInt16(offset),
    set: (dv, offset, value) => dv.setInt16(offset, value),
  },
  Int32: {
    extractor: Int32Array,
    bytes: 4,
    get: (dv, offset) => dv.getInt32(offset),
    set: (dv, offset, value) => dv.setInt32(offset, value),
  },
  BigInt64: {
    extractor: BigInt64Array,
    bytes: 8,
    get: (dv, offset) => dv.getBigInt64(offset),
    set: (dv, offset, value) => dv.setBigInt64(offset, value),
  },
  Uint8: {
    extractor: Uint8Array,
    bytes: 1,
    get: (dv, offset) => dv.getUint8(offset),
    set: (dv, offset, value) => dv.setUint8(offset, value),
  },
  Uint8Clamped: {
    extractor: Uint8ClampedArray,
    bytes: 1,
  },
  Uint16: {
    extractor: Uint16Array,
    bytes: 2,
    get: (dv, offset) => dv.getUint16(offset),
    set: (dv, offset, value) => dv.setUint16(offset, value),
  },
  Uint32: {
    extractor: Uint32Array,
    bytes: 4,
    get: (dv, offset) => dv.getUint32(offset),
    set: (dv, offset, value) => dv.setUint32(offset, value),
  },
  BigUint64: {
    extractor: BigUint64Array,
    bytes: 8,
    get: (dv, offset) => dv.getBigUint64(offset),
    set: (dv, offset, value) => dv.setBigUint64(offset, value),
  },
  // TODO: Add a padding option (or ArrayPadded) to allow using primitive TypedArray
  //       Needs to add a static prop `minimalPadding` (which defaults to 1).
  //        - Each type/class declares the minimum padding size
  //        - On Arrays, equals to eleemtns size or structs minimal padding size
  //        - On Structs:
  //          - Ensures each padded array will start at a minimal padding divisor (so it can use TypedArrays)
  //          - If struct has mapped arrays, the bigger from its elements sizes
  //          - If not, default 1
  Array: (type, length) => {
    return {
      bytes: length * type.bytes,
      get(dv, offset) {
        return BinaryArray(dv, type, offset, length);
      },
      set(dv, offset, values) {
        values.forEach( (value, index) => type.set(dv, offset + (type.bytes * index), value) );
        return true;
      },
    };
  },
  Struct: (Cls) => {
    return {
      bytes: Cls.binarySize,
      get(dv, offset) {
        return new Cls(dv, offset);
      },
      set(dv, offset, values) {
        // TODO: Test if values is a Binary Object and we can just copy binary data, or nothing,
        //       because binary data, class and offset are the same.
        const obj = new Cls(dv, offset);
        for( const prop of Object.keys(values) ) {
          if( Cls.binaryProps.includes(prop) ) {
            obj[prop] = values[prop];
          }
        }
        return true;
      },
    }
  },
  Text: (length, {encoding='utf8', zeroTerminated=true}={}) => {
    const decoder = new TextDecoder(encoding);
    const encoder = new TextEncoder(); // Only UTF8 available
    return {
      bytes: length,
      get(dv, offset) {
        const arr = new Types.Uint8.extractor(dv.buffer, offset, length);

        if( zeroTerminated ) {
          const firstZero = arr.indexOf(0x00);
          if (firstZero === 0) {
            return '';
          }
          else if(firstZero > 0) {
            const arrSmaller = new Types.Uint8.extractor(dv.buffer, offset, firstZero);
            return decoder.decode(arrSmaller);
          }
        }

        return decoder.decode(arr);
      },
      set(dv, offset, value) {
        const arr = new Types.Uint8.extractor(dv.buffer, offset, length);
        const {read, written} = encoder.encodeInto(value, arr);

        if (zeroTerminated && written < arr.length) {
          arr[written] = 0; // append null if room
        }

        return true;
      },
    };
  },
}

export default Types;
