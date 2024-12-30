/* WIP - DEV NOT FINISHED, WILL NOT WORK */

let result = null
let resultName = null
async function decompressFileFromBFRES () {
    let file = await importFile(["bfres"])
    result = decompressFromBFRES(file.buf)
    resultName = file.name
}
async function downloadResult () {
    await exportZip(result, resultName)
}
const dataTypes = [
    "FMDL",
    "FTEX",
    "FSKA",
    "FSHU",
    "FSHU",
    "FSHU",
    "FTXP",
    "FVIS",
    "FVIS",
    "FSHA",
    "FSCN",
    "Embedded",
]
function decompressFromBFRES (data) {
    let numMode = null
    let fres = getBuf(data, 0x00, 0x10)
        let fres_name = getStr(fres, 0x00, 4)
            expectVal(fres_name, "FRES", "Invalid file", "FRES header does not start with 'FRES'")
        let fres_byteOrder = getNum(fres, 0x0C, 2, "BE")
            fres_byteOrder = fres_byteOrder.toString(16)
            if (fres_byteOrder == "feff") numMode = "BE"
            else if (fres_byteOrder == "fffe") numMode = "LE"
        let fres_headerLength = getNum(fres, 0x0E, 2, numMode)
            expectVal(fres_headerLength, 12, "Invalid file", "FRES header states incorrect size")
        let fres_versionAll = getNum(fres, 0x08, 4, numMode)
            fres_versionAll = fres_versionAll.toString(16).padStart(8, "0")
            let fres_versionB1 = fres_versionAll.substring(0, 2)
            let fres_versionB2 = fres_versionAll.substring(2, 4)
            let fres_versionB3 = fres_versionAll.substring(4, 6)
            let fres_versionB4 = fres_versionAll.substring(6, 8)
            let fres_version = [fres_versionB1, fres_versionB2, fres_versionB3, fres_versionB4].map(val => parseInt(val, 16)).join(".")
        let fres_unused = getNum(fres, 0x04, 4, numMode)
    let meta = getBuf(data, 0x10, 0x60)
        let meta_fileLength = getNum(meta, 0x00, 4, numMode)
        let meta_fileAlignment = getNum(meta, 0x04, 4, numMode)
        let meta_fileNameOffset = getNum(meta, 0x08, 4, numMode)
        let meta_stringTableLength = getNum(meta, 0x0C, 4, numMode)
        let meta_stringTableOffset = getNum(meta, 0x10, 4, numMode)
        let meta_fileOffsetsBuf = getBuf(meta, 0x14, 48)
            let meta_fileOffsets = new Array(12)
            for (let i = 0; i < 12; i++) {
                let offset = getNum(meta_fileOffsetsBuf, i * 4, 4, numMode)
                meta_fileOffsets[i] = offset
            }
        let meta_fileCountsBuf = getBuf(meta, 0x44, 24)
            let meta_fileCounts = new Array(12)
            for (let i = 0; i < 12; i++) {
                let count = getNum(meta_fileCountsBuf, i * 2, 2, numMode)
                meta_fileCounts[i] = count
            }
        let meta_userPointer = getNum(meta, 0x5C, 4, numMode)
    console.log(meta_fileOffsets, meta_fileCounts)
    return
}
