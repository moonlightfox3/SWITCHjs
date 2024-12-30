let resultRARC = null
let resultNameRARC = null
let inFileTypesRARC = ["rarc"]
let outFileTypeRARC = "zip"
async function decompressFileFromRARC () {
    let file = await importFile(inFileTypesRARC)
    resultRARC = decompressFromRARC(file.buf)
    resultNameRARC = file.name
}
async function downloadResult () {
    await exportZip(resultRARC, resultNameRARC)
}
let rarc_stringTable = null
let rarc_nodeTable = null
let rarc_directoryTable = null
let rarc_fileDataStart = null
let rarc_fileStructure = null
function decompressFromRARC (data) {
    rarc_stringTable = null
    rarc_nodeTable = null
    rarc_directoryTable = null
    rarc_fileDataStart = null
    rarc_fileStructure = null

    let numMode = null
    let header = getBuf(data, 0x00, 0x20)
        let header_name = getStr(header, 0x00, 4)
            expectVals(header_name, ["RARC", "CRAR"], "Invalid file", "RARC header does not start with 'RARC' or 'CRAR'")
            if (header_name == "RARC") numMode = "BE"
            else if (header_name == "CRAR") numMode = "LE"
        let header_fileLength = getNum(header, 0x04, 4, numMode)
        let header_headerLength = getNum(header, 0x08, 4, numMode)
            expectVal(header_headerLength, 0x20, "Invalid file", "RARC header states incorrect size")
        let header_fileDataOffset = getNum(header, 0x0C, 4, numMode)
        let header_fileDataLength = getNum(header, 0x10, 4, numMode)
        let header_fileDataLength2Unknown = getNum(header, 0x14, 4, numMode)
        let header_unused = getNum(header, 0x18, 8, numMode)
    let fileData = getBuf(data, header_fileDataOffset + 0x20, header_fileDataLength)
    let info = getBuf(data, 0x20, 0x20)
        let info_nodeCount = getNum(info, 0x00, 4, numMode)
        let info_firstNodeOffset = getNum(info, 0x04, 4, numMode)
        let info_directoryCount = getNum(info, 0x08, 4, numMode)
        let info_firstDirectoryOffset = getNum(info, 0x0C, 4, numMode)
        let info_stringTableLength = getNum(info, 0x10, 4, numMode)
        let info_stringTableOffset = getNum(info, 0x14, 4, numMode)
        let info_fileDirectoryCount = getNum(info, 0x18, 2, numMode)
        let info_unused = getNum(info, 0x1A, 6, numMode)
    rarc_stringTable = getBuf(data, info_stringTableOffset + 0x20, info_stringTableLength)
        rarc_fileDataStart = info_stringTableOffset + info_stringTableLength + 0x20
    let nodeTableBuf = getBuf(data, info_firstNodeOffset + 0x20, info_nodeCount * 0x10)
        rarc_nodeTable = new Array(info_nodeCount)
        for (let i = 0; i < info_nodeCount; i++) {
            let nodeBuf = getBuf(nodeTableBuf, i * 0x10, 0x10)
            rarc_nodeTable[i] = nodeBuf
        }
    let directoryTableBuf = getBuf(data, info_firstDirectoryOffset + 0x20, info_directoryCount * 0x14)
        rarc_directoryTable = new Array(info_directoryCount)
        for (let i = 0; i < info_directoryCount; i++) {
            let directoryBuf = getBuf(directoryTableBuf, i * 0x14, 0x14)
            rarc_directoryTable[i] = directoryBuf
        }
    rarc_fileStructure = {}
        rarc_getNode(data, numMode, 0, rarc_fileStructure)
    return rarc_fileStructure
}
function rarc_getNode (data, numMode, index, structure) {
    let node = rarc_nodeTable[index]//getBuf(data, offset, 0x10)
        let id = getStr(node, 0x00, 4, numMode)
        let stringOffset = getNum(node, 0x04, 4, numMode)
            let string = getStr(rarc_stringTable, stringOffset, rarc_stringTable.byteLength - stringOffset)
            string = string.split("\x00")[0]
        let stringHash = getNum(node, 0x08, 2, numMode)
        let directoryCount = getNum(node, 0x0A, 2, numMode)
        let firstDirectoryIndex = getNum(node, 0x0C, 4, numMode)
            let directories = new Array(directoryCount)
            for (let i = 0; i < directoryCount; i++) {
                let directoryBuf = rarc_directoryTable[firstDirectoryIndex + i]
                let directory = rarc_getDirectory(directoryBuf, numMode, 0)
                directories[i] = directory
            }
    structure[string] = {}
        let structure2 = structure[string]
        for (let directory of directories) {
            if (directory.isFolder) {
                if (directory.offsetOrIndex != 0xFFFFFFFF && (directory.string != "." && directory.string != "..")) rarc_getNode(data, numMode, directory.offsetOrIndex, structure2)
            } else {
                let fileDataBuf = getBuf(data, directory.offsetOrIndex + rarc_fileDataStart, directory.fileDataLength)
                structure2[directory.string] = fileDataBuf
            }
        }
}
function rarc_getDirectory (data, numMode, offset) {
    let directory = getBuf(data, offset, 0x14)
        let index = getNum(directory, 0x00, 2, numMode)
            let isFolder = index == 0xFFFF
        let stringHash = getNum(directory, 0x02, 2, numMode)
        let stringOffset = getNum(directory, 0x04, 2, numMode)
            let string = getStr(rarc_stringTable, stringOffset, rarc_stringTable.byteLength - stringOffset)
            string = string.split("\x00")[0]
        let typeUnknown = getNum(directory, 0x06, 2, numMode)
            let isFolder2Unknown = null
            if (typeUnknown == 0x200) isFolder2Unknown = true
            else if (typeUnknown == 0x1100) isFolder2Unknown = false
        let offsetOrIndex = getNum(directory, 0x08, 4, numMode)
        let fileDataLength = getNum(directory, 0x0C, 4, numMode)
        let unused = getNum(directory, 0x10, 4, numMode)
    return {index, isFolder, string, offsetOrIndex, fileDataLength}
}
