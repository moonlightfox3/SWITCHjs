/* WIP - DEV NOT FINISHED, WILL NOT WORK */

let resultBCSV = null
let resultNameBCSV = null
let inFileTypesBCSV = ["bcsv"]
let outFileTypeBCSV = "csv"
async function decompressFileFromBCSV () {
    let file = await importFile(inFileTypesBCSV)
    resultBCSV = decompressFromBCSV(file.buf)
    resultNameBCSV = file.name
}
async function downloadResult () {
    await exportFile(resultBCSV, resultNameBCSV, outFileTypeBCSV)
}
let bcsv_stringTable = null
let bcsv_valuesStart = null
let bcsv_entryCount = null
function decompressFromBCSV (data) {
    bcsv_stringTable = null
    bcsv_valuesStart = null
    bcsv_entryCount = null

    let numMode = "LE"
    let header = getBuf(data, 0x00, 0x10)
        let header_entryCount = getNum(header, 0x00, U32, numMode)
            bcsv_entryCount = header_entryCount
        let header_fieldCount = getNum(header, 0x04, U32, numMode)
        let header_entryDataOffset = getNum(header, 0x08, U32, numMode)
            bcsv_valuesStart = header_entryDataOffset
        let header_entrySize = getNum(header, 0x0C, U32, numMode)
    let stringTableOffset = header_entryDataOffset + (header_entryCount * header_entrySize)
    let stringTableBuf = getBuf(data, stringTableOffset, data.byteLength - stringTableOffset)
        bcsv_stringTable = stringTableBuf
    let fieldsBuf = getBuf(data, 0x10, header_fieldCount * 0x0C)
        let fields = []
        for (let i = 0; i < header_fieldCount; i++) {
            let field = bcsv_getField(data, fieldsBuf, numMode, i * 0x0C)
            fields[i] = field.values
        }
    console.log(fields)
    let lines = []
        for (let i = 0; i < header_entryCount; i++) {
            let entries = []
            for (let field of fields) entries.push(field[i])
            lines.push(`"${entries.join('","')}"`)
        }
        let outText = lines.join("\n")
        let outBuf = new TextEncoder().encode(outText).buffer
        console.log(outBuf)
    return outBuf
}
function bcsv_getField (dataGlobal, data, numMode, offset) {
    let field = getBuf(data, offset, 0x0C)
        let nameHash = getNum(field, 0x00, U32, numMode)
        let bitmask = getNum(field, 0x04, U32, numMode)
        let dataOffset = getNum(field, 0x08, U16, numMode)
        let shift = getNum(field, 0x0A, U8, numMode)
        let dataType = getNum(field, 0x0B, U8, numMode)
    let obj = {nameHash, bitmask, dataOffset, shift, dataType}
    let values = new Array(bcsv_entryCount)
        for (let i = 0; i < bcsv_entryCount; i++) {
            let value = bcsv_getValue(dataGlobal, numMode, obj)
            values[i] = value
            obj.dataOffset += 0x04
        }
    return {nameHash, values}
}
function bcsv_getValue (data, numMode, field) {
    let offset = field.dataOffset + bcsv_valuesStart
    if (field.dataType == 0x00) {
        let val = getNum(data, offset, U32, numMode)
        val &= field.bitmask
        val >>= field.shift
        return val
    }/* else if (field.dataType == 0x01) { // DEPRECATED: Embedded string
    }*/ else if (field.dataType == 0x02) {
        let num = getNum(data, offset, U32, numMode)
        num &= field.bitmask
        num >>= field.shift
        let float = numGetFloatSingle(num)
        return float
    } else if (field.dataType == 0x03) {
        let val = getNum(data, offset, U32, numMode)
        val &= field.bitmask
        val >>= field.shift
        return val
    } else if (field.dataType == 0x04) {
        let val = getNum(data, offset, U16, numMode)
        val &= field.bitmask
        val >>= field.shift
        return val
    } else if (field.dataType == 0x05) {
        let val = getNum(data, offset, U8, numMode)
        val &= field.bitmask
        val >>= field.shift
        return val
    } else if (field.dataType == 0x06) {
        let strOffset = getNum(data, offset, U32, numMode)
        strOffset &= field.bitmask
        strOffset >>= field.shift
        let str = getStr(bcsv_stringTable, strOffset, bcsv_stringTable.byteLength - strOffset)
        str = str.split("\x00")[0]
        return str
    }/* else if (field.dataType == 0x07) { // UNKNOWN: Maybe null type?
    }*/
}
