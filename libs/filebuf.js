class IntSize {
    static U64 = 8
    static U32 = 4
    static U24 = 3
    static U16 = 2
    static U8 = 1
}
class FloatPrecision {
    static HALF = [5, 10]
    static SINGLE = [8, 23]
    static DOUBLE = [11, 52]
}
class Endian {
    static BIG = ">"
    static LITTLE = "<"
}
class SignedIntBinaryType {
    static SIGN_MAGNITUDE = 0
    static ONES_COMPLEMENT = 1
    static TWOS_COMPLEMENT = 2
}

class FileBuf {
    data = null
    constructor (data) { this.data = data }

    buf (offset, size, options = {}) {
        let outBuf = this.data.slice(offset, offset + size)
        let outCls = new FileBuf(outBuf)
        return outCls
    }
    arr (offset, size, options = {endian: Endian.BIG}) {
        let inBuf = this.buf(offset, size)
        let outArr = new Uint8Array(inBuf.data)
        if (options.endian == Endian.BIG) null
        else if (options.endian == Endian.LITTLE) outArr.reverse()
        return outArr
    }
    
    str (offset, size, options = {endian: Endian.BIG, encoding: "utf-8"}) {
        let inCls = this.buf(offset, size)
        let inBuf = inCls.data
        let outStr = new TextDecoder(options.encoding).decode(inBuf)
        if (options.endian == Endian.BIG) null
        else if (options.endian == Endian.LITTLE) outStr = outStr.split("").reverse().join("")
        return outStr
    }

    int (offset, size, options = {endian: Endian.BIG}) {
        let inCls = this.buf(offset, size)
        let inArr = inCls.arr(0, size, options)
        let outStr = ""
        for (let inInt of inArr) outStr += inInt.toString(16).padStart(2, "0")
        let outInt = parseInt(outStr, 16)
        return outInt
    }
    byte (offset, size, options = {}) {
        let inCls = this.buf(offset, 1)
        let outByte = inCls.int(0, 1)
        return outByte
    }
    
    static float_int (inVal, options = {precision: FloatPrecision.SINGLE}) {
        let inHex = inVal.toString(16)
            let inBin = ""
            for (let i = 0; i < inHex.length; i += 2) inBin += parseInt(inHex.substring(i, i + 2), 16).toString(2).padStart(8, "0")

        let binSign = inBin.substring(0, 1)
            let outFloat_sign = (-1) ** parseInt(binSign, 2)
        let binExponent = inBin.substring(1, options.precision[0] + 1)
            let exponent = 0
            let indexExp = 0
            for (let i = binExponent.length - 1; i >= 0; i--) {
                let char = binExponent[indexExp]
                if (char == "1") exponent += 2 ** i
                indexExp++
            }
            let bias = (2 ** (binExponent.length - 1)) - 1
            let outFloat_exponent = 2 ** (exponent - bias)
        let binFraction = inBin.substring(options.precision[0] + 1, options.precision[1] + options.precision[0] + 1)
            let fraction = 0
            let indexFrac = 0
            for (let i = -1; i >= -binFraction.length; i--) {
                let char = binFraction[indexFrac]
                if (char == "1") fraction += 2 ** i
                indexFrac++
            }
            let outFloat_fraction = (2 ** 0) + fraction
        
        let outFloat = outFloat_sign * outFloat_exponent * outFloat_fraction
            let outFloatRounded = +outFloat.toFixed(3)
        return outFloatRounded
    }
    static signedInt_int (inVal, options = {size: IntSize.U8, type: SignedIntBinaryType.TWOS_COMPLEMENT}) {
        let inBin = inVal.toString(2).padStart(options.size * 8, "0").split("")
            let signBit = inBin.splice(0, 1)
                let isPositive = signBit == 0
            inBin = inBin.join("")
        if (options.type == SignedIntBinaryType.SIGN_MAGNITUDE) {
        } else if (options.type == SignedIntBinaryType.ONES_COMPLEMENT) {
            if (!isPositive) inBin = inBin.split("").map(val => val == "0" ? "1" : "0").join("")
        } else if (options.type == SignedIntBinaryType.TWOS_COMPLEMENT) {
            if (!isPositive) {
                inBin = (parseInt(inBin, 2) - 1).toString(2)
                inBin = inBin.split("").map(val => val == "0" ? "1" : "0").join("")
            }
        }
        let outInt = parseInt(inBin, 2)
        if (!isPositive) outInt *= -1
        return outInt
    }
    static nibble_byte (inVal, options = {offset: 0}) {
        let outNibble = (inVal >> (4 * (1 - options.offset))) & 0b00001111
        return outNibble
    }
    static bit_byte (inVal, options = {offset: 0}) {
        let outBit = (inVal >> (7 - options.offset)) & 0b00000001
        return outBit
    }
    
    static expectVal (inVal, checkVals, msg) {
        if (typeof checkVals != "object") checkVals = [checkVals]

        let found = false
        for (let check of checkVals) {
            if (inVal == check) {
                found = true
                break
            }
        }
        if (!found) {
            alert(`ERROR: ${msg}`)
            throw new Error(msg)
        }
    }
}
class FileBufWriter {
    data = null
    constructor (data) { this.data = data }
    
    buf (offset, inData, options = {}) {
        let thisArr = new Uint8Array(this.data)
        let inArr = new Uint8Array(inData)
        thisArr.set(inArr, offset)
        return inArr.length
    }
    arr (offset, inData, options = {}) {
        let inArr = new Uint8Array(inData)
        this.buf(offset, inArr)
        return inArr.length
    }

    str (offset, inData, options = {endian: Endian.BIG, encoding: "utf-8"}) {
        let outArr = new TextEncoder(options.encoding).encode(inData)
        if (options.endian == Endian.BIG) null
        else if (options.endian == Endian.LITTLE) outArr = outArr.reverse()
        this.buf(offset, outArr.buffer)
        return outArr.length
    }
    
    int (offset, inData, options = {endian: Endian.BIG, size: IntSize.U8}) {
        let inHex = inData.toString(16)
        let inLength = Math.ceil(inHex.length / 2)
        inHex = inHex.padStart(inLength * 2, "0")
        let outArr = new Uint8Array(options.size)
        for (let i = 0; i < inHex.length; i += 2) {
            let byte = inHex.substring(i, i + 2)
            outArr[(i / 2) + (outArr.length - inLength)] = parseInt(byte, 16)
        }
        if (options.endian == Endian.BIG) null
        else if (options.endian == Endian.LITTLE) outArr = outArr.reverse()
        this.buf(offset, outArr.buffer)
        return inLength
    }
    byte (offset, inData, options = {}) {
        let outBuf = new Uint8Array([inData]).buffer
        this.buf(offset, outBuf)
        return 1
    }
}
