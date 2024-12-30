const U32 = 4
const U16 = 2
const U8 = 1

function getBuf (data, pos, size) {
    let buf = data.slice(pos, pos + size)
    return buf
}
function getStr (data, pos, size, mode = "BE") {
    let buf = getBuf(data, pos, size)
    let str = new TextDecoder().decode(buf)
    if (mode == "BE") null
    else if (mode == "LE") str = str.split("").reverse().join("")
    return str
}
function getNum (data, pos, size, mode) {
    let buf = getBuf(data, pos, size)
    let arr = new Uint8Array(buf)
    if (mode == "BE") null
    else if (mode == "LE") arr.reverse()
    let res = ""
    for (let num of arr) res += num.toString(16).padStart(2, "0")
    let num = parseInt(res, 16)
    return num
}
function numGetFloatSingle (value) {
    let hex = value.toString(16)
    let b1 = hex.substring(0, 2)
    let b2 = hex.substring(2, 4)
    let b3 = hex.substring(4, 6)
    let b4 = hex.substring(6, 8)
    let bin = [b1, b2, b3, b4].map(val => parseInt(val, 16).toString(2).padStart(8, "0")).join("")

    let binSign = bin.substring(0, 1)
        let resultSign = (-1) ** parseInt(binSign, 2)
    let binExponent = bin.substring(1, 9)
        let exponent = 0
        let indexExp = 0
        for (let i = binExponent.length - 1; i >= 0; i--) {
            let char = binExponent[indexExp]
            if (char == "1") exponent += 2 ** i
            indexExp++
        }
        let bias = (2 ** (binExponent.length - 1)) - 1
        let resultExponent = 2 ** (exponent - bias)
    let binFraction = bin.substring(9, 32)
        let fraction = 0
        let indexFrac = 0
        for (let i = -1; i >= -binFraction.length; i--) {
            let char = binFraction[indexFrac]
            if (char == "1") fraction += 2 ** i
            indexFrac++
        }
        let resultFraction = (2 ** 0) + fraction
    
    let result = resultSign * resultExponent * resultFraction
    return result
}
function getByte (data, pos) {
    let byte = getNum(data, pos, 1, "BE")
    return byte
}
function byteGetNibble (byte, pos) {
    let nibble = (byte >> (4 * (1 - pos))) & 0b00001111
    return nibble
}
function byteGetBit (byte, pos) {
    let bit = (byte >> (7 - pos)) & 0b00000001
    return bit
}

function expectVal (val, check, info, err) {
    if (val != check) {
        alert(`ERROR: ${info}\n(${err})`)
        throw new Error(err)
    }
}
function expectVals (val, checks, info, err) {
    let found = false
    for (let check of checks) {
        if (val == check) {
            found = true
            break
        }
    }
    if (!found) {
        alert(`ERROR: ${info}\n(${err})`)
        throw new Error(err)
    }
}
