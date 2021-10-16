// Mock Node missing TextEncoder and TextDecoder APIs from its `util` lib
if (!('TextEncoder' in global)) {
  import('util').then((nodeUtil) => {
    global.TextEncoder = nodeUtil.TextEncoder
    global.TextDecoder = nodeUtil.TextDecoder
  })
}
