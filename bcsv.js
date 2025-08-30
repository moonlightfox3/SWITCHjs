let resultBCSV = null
let resultNameBCSV = null
let inFileTypesBCSV = ["bcsv", "banmt", "bcam", "pa", "tbl"]
let outFileTypeBCSV = "csv"
async function decompressFileFromBCSV () {
    let file = await importFile(inFileTypesBCSV)
    let fileBuf = new FileBuf(file.buf)
    resultBCSV = decompressFromBCSV(fileBuf)
    resultNameBCSV = file.name
}
async function downloadResultBCSV () {
    await exportFile(resultBCSV, resultNameBCSV, outFileTypeBCSV)
}
let bcsv_stringTable = null
let bcsv_valuesStart = null
let bcsv_rowCount = null
let bcsv_rowSize = null
function decompressFromBCSV (fileBuf) {
    bcsv_stringTable = null
    bcsv_valuesStart = null
    bcsv_rowCount = null
    bcsv_rowSize = null

    let numMode = Endian.LITTLE
    let header = fileBuf.buf(0x00, 0x10)
        let header_rowCount = header.int(0x00, IntSize.U32, numMode)
            bcsv_rowCount = header_rowCount
        let header_colCount = header.int(0x04, IntSize.U32, numMode)
        let header_rowDataOffset = header.int(0x08, IntSize.U32, numMode)
            bcsv_valuesStart = header_rowDataOffset
        let header_rowSize = header.int(0x0C, IntSize.U32, numMode)
            bcsv_rowSize = header_rowSize
    let stringTableOffset = header_rowDataOffset + (header_rowCount * header_rowSize)
    let stringTableBuf = fileBuf.buf(stringTableOffset, fileBuf.data.byteLength - stringTableOffset)
        bcsv_stringTable = stringTableBuf
    let colsBuf = fileBuf.buf(0x10, header_colCount * 0x0C)
        let cols = []
        for (let i = 0; i < header_colCount; i++) {
            let col = bcsv_getCol(fileBuf, colsBuf, numMode, i * 0x0C)
            let name = bcsv_hashTable[col.nameHash] || `unknown_${col.nameHash}`
            let type = bcsv_dataTypes[col.dataType]
            let defaultValue = bcsv_defaultValues[col.dataType]
            let formatStr = `${name}:${type}:${defaultValue}`
            cols[i] = [formatStr, ...col.values]
        }
    let outText = ""
        for (let i = 0; i < header_rowCount + 1; i++) {
            let entries = []
            for (let col of cols) entries.push(col[i])
            outText += `"${entries.join('","')}"\n`
        }
        let outBuf = new TextEncoder().encode(outText).buffer
    return outBuf
}
function bcsv_getCol (fileBufGlobal, fileBuf, numMode, offset) {
    let col = fileBuf.buf(offset, 0x0C)
        let nameHash = col.int(0x00, IntSize.U32, numMode)
        let bitmask = col.int(0x04, IntSize.U32, numMode)
        let dataOffset = col.int(0x08, IntSize.U16, numMode)
        let shift = col.int(0x0A, IntSize.U8, numMode)
        let dataType = col.int(0x0B, IntSize.U8, numMode)
    let colObj = {nameHash, bitmask, dataOffset, shift, dataType}
    let values = new Array(bcsv_rowCount)
        for (let i = 0; i < bcsv_rowCount; i++) {
            let value = bcsv_getValue(fileBufGlobal, numMode, colObj)
            values[i] = value
            colObj.dataOffset += bcsv_rowSize
        }
    return {nameHash, values, dataType}
}
function bcsv_getValue (fileBuf, numMode, col) {
    let offset = col.dataOffset + bcsv_valuesStart
    if (col.dataType == 0x00) {
        let val = fileBuf.int(offset, IntSize.U32, numMode)
        val &= col.bitmask
        val >>= col.shift
        return val
    }/* else if (col.dataType == 0x01) {
    }*/ else if (col.dataType == 0x02) {
        let num = fileBuf.int(offset, IntSize.U32, numMode)
        num &= col.bitmask
        num >>= col.shift
        let float = FileBuf.float_int(num)
        return float
    } else if (col.dataType == 0x03) {
        let val = fileBuf.int(offset, IntSize.U32, numMode)
        val &= col.bitmask
        val >>= col.shift
        return val
    } else if (col.dataType == 0x04) {
        let val = fileBuf.int(offset, IntSize.U16, numMode)
        val &= col.bitmask
        val >>= col.shift
        return val
    } else if (col.dataType == 0x05) {
        let val = fileBuf.int(offset, IntSize.U8, numMode)
        val &= col.bitmask
        val >>= col.shift
        return val
    } else if (col.dataType == 0x06) {
        let strOffset = fileBuf.int(offset, IntSize.U32, numMode)
        strOffset &= col.bitmask
        strOffset >>= col.shift
        let str = bcsv_stringTable.str(strOffset, bcsv_stringTable.data.byteLength - strOffset)
        str = str.split("\x00")[0]
        return str
    }
    FileBuf.expectVal(0, 1, `Unknown data type: 0x${col.dataType.toString(16)}`)
}
function bcsv_calcNameHash (name) {
    let hash = new Uint32Array(1) // array used to limit value to u32
    for (let charStr of name) {
        hash[0] *= 0x1F
        hash[0] += charStr.charCodeAt(0)
    }
    return hash[0]
}
let bcsv_dataTypes = ["Int", "EmbedStr", "Float", "UInt", "Short", "Char", "Str"]
let bcsv_defaultValues = ["0", "0", "0.0", "0", "0", "0", "0"]
let bcsv_hashTable = {} // Not implemented right now
