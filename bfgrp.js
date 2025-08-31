let resultBFGRP = null
let resultNameBFGRP = null
let inFileTypesBFGRP = ["bfgrp"]
let outFileTypeBFGRP = "zip"
async function decompressFileFromBFGRP () {
    let file = await importFile(inFileTypesBFGRP)
    let fileBuf = new FileBuf(file.buf)
    resultBFGRP = decompressFromBFGRP(fileBuf)
    resultNameBFGRP = file.name
}
async function downloadResultBFGRP () {
    await exportZip(resultBFGRP, resultNameBFGRP)
}
let bfgrp_files = null
let bfgrp_dependencies = null
const bfgrp_fileTypes = [
    undefined,
    "Sound",
    "Sound group",
    "Bank",
    "Player",
    "Wave archive",
    "Group",
]
const bfgrp_fileTypeIds = [
    undefined,
    ["SE", "WSD", "STRM"],
    ["WSDSET", "SEQSET"],
    ["BANK"],
    ["PLAYER"],
    ["WAR"],
    ["GROUP"],
]
function decompressFromBFGRP (fileBuf) {
    bfgrp_files = null
    bfgrp_dependencies = null
    
    let numMode = null
    let header = fileBuf.buf(0x00, 0x14)
        let header_name = header.str(0x00, 0x04)
            FileBuf.expectVal(header_name, "FGRP", "BFGRP header does not start with 'FGRP'")
        let header_byteOrder = header.int(0x04, IntSize.U16, Endian.BIG)
            header_byteOrder = header_byteOrder.toString(16)
            if (header_byteOrder == "feff") numMode = Endian.BIG
            else if (header_byteOrder == "fffe") numMode = Endian.LITTLE
        let header_sizeAndBlockReferences = header.int(0x06, IntSize.U16, numMode)
        let header_version = header.int(0x08, IntSize.U32, numMode)
            FileBuf.expectVal(header_version, [0x010000], "BFGRP header states an unknown/unsupported version")
        let header_fileSize = header.int(0x0C, IntSize.U32, numMode)
            FileBuf.expectVal(header_fileSize, fileBuf.data.byteLength, "BFGRP header states invalid file size")
        let header_numBlocks = header.int(0x10, IntSize.U16, numMode)
        let header_padding = header.int(0x12, IntSize.U16, numMode)
    let blockReferencesBuf = fileBuf.buf(0x14, Math.ceil((header_sizeAndBlockReferences - 0x14) / 32) * 32)
        let blockReferences = new Array(header_numBlocks)
        for (let i = 0; i < header_numBlocks; i++) {
            let id = blockReferencesBuf.int(i * 0x0C, IntSize.U16, numMode)
            let padding = blockReferencesBuf.int((i * 0x0C) + 0x02, IntSize.U16, numMode)
            let offset = blockReferencesBuf.int((i * 0x0C) + 0x04, IntSize.U32, numMode)
            let size = blockReferencesBuf.int((i * 0x0C) + 0x08, IntSize.U32, numMode)
            blockReferences[i] = {id, offset, size}
        }
        for (let i = 0; i < blockReferences.length; i++) bfgrp_parseBlock(fileBuf, numMode, blockReferences[i].id, blockReferences[i].offset, blockReferences[i].size)
    
    let rawFiles = {}
        for (let i = 0; i < bfgrp_files.length; i++) {
            let fileInfo = bfgrp_files[i]
            rawFiles[`raw${fileInfo.fileIndex}.bin`] = fileInfo.content
        }
    return {
        "rawfiles": {
            ...rawFiles,
        },
        "dependencies.json": bfgrp_getJsonBuf(bfgrp_dependencies),
    }
}
function bfgrp_parseBlock (fileBuf, numMode, id, offset, size) {
    let buf = fileBuf.buf(offset, size)
        let idStr = buf.str(0x00, 0x04)
        let size2 = buf.int(0x04, IntSize.U32, numMode)
        FileBuf.expectVal(size, size2, "Block size data doesn't match")
        if (id == 0x7800 && idStr == "INFO") {
            let locationInfoTable = bfgrp_parseReferenceTable(buf, numMode, 0x08, 0x7900, "Location info")
                let locationInfos = new Array(locationInfoTable.length)
                for (let i = 0; i < locationInfoTable.length; i++) {
                    let locationInfoBufStart = 0x08 + locationInfoTable[i].offsetRel
                    let locationInfoBuf = buf.buf(locationInfoBufStart, buf.data.byteLength - locationInfoBufStart)
                        let fileIndex = locationInfoBuf.int(0x00, IntSize.U32, numMode)
                        let fileBlockReference = bfgrp_parseReference(locationInfoBuf, numMode, 0x04, 0x1F00, "File data")
                            let fileBlockOffset = fileBlockReference.offsetRel
                        let fileSize = locationInfoBuf.int(0x0C, IntSize.U32, numMode)
                    locationInfos[i] = {
                        fileIndex,
                        content: {
                            fileBlockOffset,
                            fileSize,
                        },
                    }
                }
                    bfgrp_files = locationInfos
        } else if (id == 0x7801 && idStr == "FILE") {
            for (let i = 0; i < bfgrp_files.length; i++) {
                let fileInfo = bfgrp_files[i]
                let content = buf.buf(fileInfo.content.fileBlockOffset + 0x08, fileInfo.content.fileSize)
                bfgrp_files[i].content = content.data
            }
        } else if (id == 0x7802 && idStr == "INFX") {
            let dependencyInfoTable = bfgrp_parseReferenceTable(buf, numMode, 0x08, 0x7901, "Dependency info")
                let dependencyInfos = new Array(dependencyInfoTable.length)
                for (let i = 0; i < dependencyInfoTable.length; i++) {
                    let dependencyInfoBufStart = 0x08 + dependencyInfoTable[i].offsetRel
                    let dependencyInfoBuf = buf.buf(dependencyInfoBufStart, buf.data.byteLength - dependencyInfoBufStart)
                        let itemId = bfgrp_parseItemId(dependencyInfoBuf, numMode, 0x00)
                            let fileType = bfgrp_fileTypes[itemId.fileType], fileIndex = itemId.fileIndex
                        let flagsRaw = dependencyInfoBuf.int(0x04, IntSize.U32, numMode)
                            if (flagsRaw == 0xFFFFFFFF) flagsRaw = null
                    dependencyInfos[i] = {
                        fileType,
                        fileIndex,
                        flagsRaw,
                    }
                }
                    bfgrp_dependencies = dependencyInfos
        } else FileBuf.expectVal(0, 1, `Unknown or unmatching block id "0x${id.toString(16).padStart(4, "0").toUpperCase()}" and block id string "${idStr}"`)
}
function bfgrp_parseReference (fileBuf, numMode, offset, expectedId = null, expectedIdMsg = null) {
    let id = fileBuf.int(offset, IntSize.U16, numMode)
    let padding = fileBuf.int(offset + 0x02, IntSize.U16, numMode)
    let offsetRel = fileBuf.int(offset + 0x04, IntSize.U32, numMode)

    let isPresent = id != 0x0000 || offsetRel != 0xFFFFFFFF
        if (!isPresent) id = null, offsetRel = null
    if (isPresent && expectedId != null) FileBuf.expectVal(id, expectedId, `Invalid reference: ${expectedIdMsg == null ? `<generic>` : expectedIdMsg}`)
    return {id, offsetRel, isPresent}
}
function bfgrp_parseItemId (fileBuf, numMode, offset, expectedFileType = null, expectedFileTypeMsg = null) {
    let arr = fileBuf.arr(offset, 0x04, numMode)
    let fileType = arr[0], fileIndex = (arr[1] << 16) + (arr[2] << 8) + arr[3]

    let isPresent = fileType != 0xFF || fileIndex != 0xFFFFFF
        if (!isPresent) fileType = null, fileIndex = null
    if (isPresent && expectedFileType != null) FileBuf.expectVal(bfgrp_fileTypes[fileType], expectedFileType, `Invalid item id: ${expectedFileTypeMsg == null ? `<generic>` : expectedFileTypeMsg}`)
    return {fileType, fileIndex, isPresent}
}
function bfgrp_parseReferenceTable (fileBuf, numMode, offset, expectedId = null, expectedIdMsg = null) {
    let numReferences = fileBuf.int(offset, IntSize.U32, numMode)
        let references = new Array(numReferences)
        for (let i = 0; i < numReferences; i++) references[i] = bfgrp_parseReference(fileBuf, numMode, offset + 0x04 + (i * 0x08), expectedId, expectedIdMsg)
    return references
}
function bfgrp_getJsonBuf (obj) {
    return new TextEncoder().encode(JSON.stringify(obj, null, 4) + "\n").buffer
}
