let resultRARC = null
let resultNameRARC = null
let inFileTypesRARC = ["rarc"]
let outFileTypeRARC = "zip"
async function decompressFileFromRARC () {
    let file = await importFile(inFileTypesRARC)
    let fileBuf = new FileBuf(file.buf)
    resultRARC = decompressFromRARC(fileBuf)
    resultNameRARC = file.name
}
async function downloadResultRARC () {
    await exportZip(resultRARC, resultNameRARC)
}
let rarc_stringTable = null
let rarc_nodeTable = null
let rarc_directoryTable = null
let rarc_fileDataStart = null
let rarc_fileStructure = null
function decompressFromRARC (fileBuf) {
    rarc_stringTable = null
    rarc_nodeTable = null
    rarc_directoryTable = null
    rarc_fileDataStart = null
    rarc_fileStructure = null

    let numMode = null
    let header = fileBuf.buf(0x00, 0x20)
        let header_name = header.str(0x00, 0x04)
            FileBuf.expectVal(header_name, ["RARC", "CRAR"], "RARC header does not start with 'RARC' or 'CRAR'")
            if (header_name == "RARC") numMode = Endian.BIG
            else if (header_name == "CRAR") numMode = Endian.LITTLE
        let header_fileLength = header.int(0x04, IntSize.U32, numMode)
        let header_headerLength = header.int(0x08, IntSize.U32, numMode)
            FileBuf.expectVal(header_headerLength, 0x20, "RARC header states incorrect size")
        let header_fileDataOffset = header.int(0x0C, IntSize.U32, numMode)
        let header_fileDataLength = header.int(0x10, IntSize.U32, numMode)
        let header_fileDataLength2Unknown = header.int(0x14, IntSize.U32, numMode)
        let header_unused = header.int(0x18, IntSize.U64, numMode)
    let fileData = fileBuf.buf(header_fileDataOffset + 0x20, header_fileDataLength)
    let info = fileBuf.buf(0x20, 0x20)
        let info_nodeCount = info.int(0x00, IntSize.U32, numMode)
        let info_firstNodeOffset = info.int(0x04, IntSize.U32, numMode)
        let info_directoryCount = info.int(0x08, IntSize.U32, numMode)
        let info_firstDirectoryOffset = info.int(0x0C, IntSize.U32, numMode)
        let info_stringTableLength = info.int(0x10, IntSize.U32, numMode)
        let info_stringTableOffset = info.int(0x14, IntSize.U32, numMode)
        let info_fileDirectoryCount = info.int(0x18, IntSize.U16, numMode)
        let info_unused = info.int(0x1A, 0x06, numMode)
    rarc_stringTable = fileBuf.buf(info_stringTableOffset + 0x20, info_stringTableLength)
        rarc_fileDataStart = info_stringTableOffset + info_stringTableLength + 0x20
    let nodeTableBuf = fileBuf.buf(info_firstNodeOffset + 0x20, info_nodeCount * 0x10)
        rarc_nodeTable = new Array(info_nodeCount)
        for (let i = 0; i < info_nodeCount; i++) {
            let nodeBuf = nodeTableBuf.buf(i * 0x10, 0x10)
            rarc_nodeTable[i] = nodeBuf
        }
    let directoryTableBuf = fileBuf.buf(info_firstDirectoryOffset + 0x20, info_directoryCount * 0x14)
        rarc_directoryTable = new Array(info_directoryCount)
        for (let i = 0; i < info_directoryCount; i++) {
            let directoryBuf = directoryTableBuf.buf(i * 0x14, 0x14)
            rarc_directoryTable[i] = directoryBuf
        }
    rarc_fileStructure = {}
        rarc_getNode(fileBuf, numMode, 0x00, rarc_fileStructure)
    return rarc_fileStructure
}
function rarc_getNode (fileBuf, numMode, index, structure) {
    let node = rarc_nodeTable[index]
        let id = node.str(0x00, 0x04, numMode)
        let stringOffset = node.int(0x04, IntSize.U32, numMode)
            let string = rarc_stringTable.str(stringOffset, rarc_stringTable.data.byteLength - stringOffset)
            string = string.split("\x00")[0]
        let stringHash = node.int(0x08, IntSize.U16, numMode)
        let directoryCount = node.int(0x0A, IntSize.U16, numMode)
        let firstDirectoryIndex = node.int(0x0C, IntSize.U32, numMode)
            let directories = new Array(directoryCount)
            for (let i = 0; i < directoryCount; i++) {
                let directoryBuf = rarc_directoryTable[firstDirectoryIndex + i]
                let directory = rarc_getDirectory(directoryBuf, numMode, 0x00)
                directories[i] = directory
            }
    structure[string] = {}
        let structure2 = structure[string]
        for (let directory of directories) {
            if (directory.isFolder) {
                if (directory.offsetOrIndex != 0xFFFFFFFF && (directory.string != "." && directory.string != ".."))
                    rarc_getNode(fileBuf, numMode, directory.offsetOrIndex, structure2)
            } else {
                let fileDataBuf = fileBuf.buf(directory.offsetOrIndex + rarc_fileDataStart, directory.fileDataLength)
                structure2[directory.string] = fileDataBuf.data
            }
        }
}
function rarc_getDirectory (fileBuf, numMode, offset) {
    let directory = fileBuf.buf(offset, 0x14)
        let index = directory.int(0x00, IntSize.U16, numMode)
            let isFolder = index == 0xFFFF
        let stringHash = directory.int(0x02, IntSize.U16, numMode)
        let stringOffset = directory.int(0x04, IntSize.U16, numMode)
            let string = rarc_stringTable.str(stringOffset, rarc_stringTable.data.byteLength - stringOffset)
            string = string.split("\x00")[0]
        let typeUnknown = directory.int(0x06, IntSize.U16, numMode)
            let isFolder2Unknown = null
            if (typeUnknown == 0x200) isFolder2Unknown = true
            else if (typeUnknown == 0x1100) isFolder2Unknown = false
        let offsetOrIndex = directory.int(0x08, IntSize.U32, numMode)
        let fileDataLength = directory.int(0x0C, IntSize.U32, numMode)
        let unused = directory.int(0x10, IntSize.U32, numMode)
    return {index, isFolder, string, offsetOrIndex, fileDataLength}
}
