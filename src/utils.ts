export namespace Utils {
  export type SourceArray = number[] | Uint16Array;

  export function stringify(value: SourceArray, index: number, next: number): string {
    let array = value.slice(index, next);

    let i: number;
    let char2: number, char3: number;

    let out = "";
    let len = array.length;
    i = 0;
    while (i < len) {
      let c = array[i++];
      switch (c >> 4) {
      case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
        // 0xxxxxxx
        out += String.fromCharCode(c);
        break;
      case 12: case 13:
        // 110x xxxx   10xx xxxx
        char2 = array[i++];
        out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
        break;
      case 14:
        // 1110 xxxx  10xx xxxx  10xx xxxx
        char2 = array[i++];
        char3 = array[i++];
        out += String.fromCharCode(((c & 0x0F) << 12) |
          ((char2 & 0x3F) << 6) |
          ((char3 & 0x3F) << 0));
        break;
      }
    }

    return out;
  }

  export function is(value: number, compare: string) {
    for (let i = 0; i < compare.length; i++) {
      if (value === compare.charCodeAt(i)) return true;
    }

    return false;
  }

  export function equals(value: SourceArray, index: number, compare: string) {
    let i = 0;
    while (value[index + i] === compare.charCodeAt(i) && i < compare.length) {
      i++;
    }
    return i === compare.length ? i : 0;
  }

  export function required(value: SourceArray, index: number, comparer: Function, min?: number, max?: number) {
    let i = 0;

    max = max || (value.length - index);
    while (i < max && comparer(value[index + i])) {
      i++;
    }

    return i >= (min || 0) && i <= max ? index + i : 0;
  }
}

export default Utils;
