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
    pointer = 0
    constructor (data) { this.data = data }

    buf (offset, size) {
        let outBuf = this.data.slice(offset, offset + size)
        let outCls = new FileBuf(outBuf)
        this.pointer += size
        return outCls
    }
    arr (offset, size, endian = Endian.BIG) {
        let inBuf = this.buf(offset, size)
        let outArr = new Uint8Array(inBuf.data)
        if (endian == Endian.BIG) null
        else if (endian == Endian.LITTLE) outArr.reverse()
        return outArr
    }
    
    str (offset, size, endian = Endian.BIG, encoding = "utf-8") {
        let inCls = this.buf(offset, size)
        let inBuf = inCls.data
        let outStr = new TextDecoder(encoding).decode(inBuf)
        if (endian == Endian.BIG) null
        else if (endian == Endian.LITTLE) outStr = outStr.split("").reverse().join("")
        return outStr
    }

    int (offset, size, endian = Endian.BIG) {
        let inCls = this.buf(offset, size)
        let inArr = inCls.arr(0, size, endian)
        let outStr = ""
        for (let inInt of inArr) outStr += inInt.toString(16).padStart(2, "0")
        let outInt = parseInt(outStr, 16)
        return outInt
    }
    byte (offset) {
        let inCls = this.buf(offset, 1)
        let outByte = inCls.int(0, IntSize.U8)
        return outByte
    }
    
    static float_int (inVal, precision = FloatPrecision.SINGLE) {
        let inHex = inVal.toString(16)
            let inBin = ""
            for (let i = 0; i < inHex.length; i += 2) inBin += parseInt(inHex.substring(i, i + 2), 16).toString(2).padStart(8, "0")

        let binSign = inBin.substring(0, 1)
            let outFloat_sign = (-1) ** parseInt(binSign, 2)
        let binExponent = inBin.substring(1, precision[0] + 1)
            let exponent = 0
            let indexExp = 0
            for (let i = binExponent.length - 1; i >= 0; i--) {
                let char = binExponent[indexExp]
                if (char == "1") exponent += 2 ** i
                indexExp++
            }
            let bias = (2 ** (binExponent.length - 1)) - 1
            let outFloat_exponent = 2 ** (exponent - bias)
        let binFraction = inBin.substring(precision[0] + 1, precision[1] + precision[0] + 1)
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
    static signedInt_int (inVal, size = IntSize.U8, type = SignedIntBinaryType.TWOS_COMPLEMENT) {
        let inBin = inVal.toString(2).padStart(size * 8, "0").split("")
            let signBit = inBin.splice(0, 1)
                let isPositive = signBit == 0
            inBin = inBin.join("")
        if (type == SignedIntBinaryType.SIGN_MAGNITUDE) {
        } else if (type == SignedIntBinaryType.ONES_COMPLEMENT) {
            if (!isPositive) inBin = inBin.split("").map(val => val == "0" ? "1" : "0").join("")
        } else if (type == SignedIntBinaryType.TWOS_COMPLEMENT) {
            if (!isPositive) {
                inBin = (parseInt(inBin, 2) - 1).toString(2).padStart((size * 8) - 1, "0")
                inBin = inBin.split("").map(val => val == "0" ? "1" : "0").join("")
            }
        }
        let outInt = parseInt(inBin, 2)
        if (!isPositive) outInt *= -1
        return outInt
    }
    static nibble_byte (inVal, offset = 0) {
        let outNibble = (inVal >> (4 * (1 - offset))) & 0b00001111
        return outNibble
    }
    static bit_byte (inVal, offset = 0) {
        let outBit = (inVal >> (7 - offset)) & 0b00000001
        return outBit
    }
    
    static expectVal (inVal, checkVals, msg) {
        if (!(checkVals instanceof Array)) checkVals = [checkVals]

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
    pointer = 0
    constructor (data) { this.data = data }
    
    buf (offset, inData) {
        let thisArr = new Uint8Array(this.data)
        let inArr = new Uint8Array(inData)
        thisArr.set(inArr, offset)
        this.pointer += inArr.length
        return inArr.length
    }
    arr (offset, inData) {
        let inArr = new Uint8Array(inData)
        this.buf(offset, inArr)
        return inArr.length
    }

    str (offset, inData, endian = Endian.BIG, encoding = "utf-8") {
        let outArr = new TextEncoder(encoding).encode(inData)
        if (endian == Endian.BIG) null
        else if (endian == Endian.LITTLE) outArr = outArr.reverse()
        this.buf(offset, outArr.buffer)
        return outArr.length
    }
    
    int (offset, inData, endian = Endian.BIG, size = IntSize.U8) {
        let inHex = inData.toString(16)
        let inLength = Math.ceil(inHex.length / 2)
        inHex = inHex.padStart(inLength * 2, "0")
        let outArr = new Uint8Array(size)
        for (let i = 0; i < inHex.length; i += 2) {
            let byte = inHex.substring(i, i + 2)
            outArr[(i / 2) + (outArr.length - inLength)] = parseInt(byte, 16)
        }
        if (endian == Endian.BIG) null
        else if (endian == Endian.LITTLE) outArr = outArr.reverse()
        this.buf(offset, outArr.buffer)
        return inLength
    }
    byte (offset, inData) {
        let outBuf = new Uint8Array([inData]).buffer
        this.buf(offset, outBuf)
        return 1
    }
}
