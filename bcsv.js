let resultBCSV = null
let resultNameBCSV = null
let inFileTypesBCSV = ["bcsv", "banmt", "bcam", "pa", "tbl"]
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
let bcsv_rowCount = null
let bcsv_rowSize = null
function decompressFromBCSV (data) {
    bcsv_stringTable = null
    bcsv_valuesStart = null
    bcsv_rowCount = null
    bcsv_rowSize = null

    let numMode = "LE"
    let header = getBuf(data, 0x00, 0x10)
        let header_rowCount = getNum(header, 0x00, U32, numMode)
            bcsv_rowCount = header_rowCount
        let header_colCount = getNum(header, 0x04, U32, numMode)
        let header_rowDataOffset = getNum(header, 0x08, U32, numMode)
            bcsv_valuesStart = header_rowDataOffset
        let header_rowSize = getNum(header, 0x0C, U32, numMode)
            bcsv_rowSize = header_rowSize
    let stringTableOffset = header_rowDataOffset + (header_rowCount * header_rowSize)
    let stringTableBuf = getBuf(data, stringTableOffset, data.byteLength - stringTableOffset)
        bcsv_stringTable = stringTableBuf
    let colsBuf = getBuf(data, 0x10, header_colCount * 0x0C)
        let cols = []
        for (let i = 0; i < header_colCount; i++) {
            let col = bcsv_getCol(data, colsBuf, numMode, i * 0x0C)
            cols[i] = col.values
        }
    let lines = []
        for (let i = 0; i < header_rowCount; i++) {
            let entries = []
            for (let col of cols) entries.push(col[i])
            lines.push(`"${entries.join('","')}"`)
        }
        let outText = lines.join("\n")
        let outBuf = new TextEncoder().encode(outText).buffer
    return outBuf
}
function bcsv_getCol (dataGlobal, data, numMode, offset) {
    let col = getBuf(data, offset, 0x0C)
        let nameHash = getNum(col, 0x00, U32, numMode)
        let bitmask = getNum(col, 0x04, U32, numMode)
        let dataOffset = getNum(col, 0x08, U16, numMode)
        let shift = getNum(col, 0x0A, U8, numMode)
        let dataType = getNum(col, 0x0B, U8, numMode)
    let colObj = {nameHash, bitmask, dataOffset, shift, dataType}
    let values = new Array(bcsv_rowCount)
        for (let i = 0; i < bcsv_rowCount; i++) {
            let value = bcsv_getValue(dataGlobal, numMode, colObj)
            values[i] = value
            colObj.dataOffset += bcsv_rowSize
        }
    return {nameHash, values}
}
function bcsv_getValue (data, numMode, col) {
    let offset = col.dataOffset + bcsv_valuesStart
    if (col.dataType == 0x00) {
        let val = getNum(data, offset, U32, numMode)
        val &= col.bitmask
        val >>= col.shift
        return val
    }/* else if (col.dataType == 0x01) { // DEPRECATED: Embedded string
    }*/ else if (col.dataType == 0x02) {
        let num = getNum(data, offset, U32, numMode)
        num &= col.bitmask
        num >>= col.shift
        let float = numGetFloatSingle(num)
        return float
    } else if (col.dataType == 0x03) {
        let val = getNum(data, offset, U32, numMode)
        val &= col.bitmask
        val >>= col.shift
        return val
    } else if (col.dataType == 0x04) {
        let val = getNum(data, offset, U16, numMode)
        val &= col.bitmask
        val >>= col.shift
        return val
    } else if (col.dataType == 0x05) {
        let val = getNum(data, offset, U8, numMode)
        val &= col.bitmask
        val >>= col.shift
        return val
    } else if (col.dataType == 0x06) {
        let strOffset = getNum(data, offset, U32, numMode)
        strOffset &= col.bitmask
        strOffset >>= col.shift
        let str = getStr(bcsv_stringTable, strOffset, bcsv_stringTable.byteLength - strOffset)
        str = str.split("\x00")[0]
        return str
    }/* else if (col.dataType == 0x07) { // UNKNOWN: Maybe null type?
    }*/
    expectVal(0, 1, "Error reading file", `Unknown data type: 0x${col.dataType.toString(16)}`)
}
