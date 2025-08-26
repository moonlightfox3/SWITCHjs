let resultBFWAR = null
let resultNameBFWAR = null
let inFileTypesBFWAR = ["bfwar"]
let outFileTypeBFWAR = "zip"
async function decompressFileFromBFWAR () {
    let file = await importFile(inFileTypesBFWAR)
    let fileBuf = new FileBuf(file.buf)
    resultBFWAR = decompressFromBFWAR(fileBuf)
    resultNameBFWAR = file.name
}
async function downloadResultBFWAR () {
    await exportZip(resultBFWAR, resultNameBFWAR)
}
let bfwar_files = null
function decompressFromBFWAR (fileBuf) {
    let numMode = null
    let header = fileBuf.buf(0x00, 0x14)
        let header_name = header.str(0x00, 0x04)
            FileBuf.expectVal(header_name, "FWAR", "BFWAR header does not start with 'FWAR'")
        let header_byteOrder = header.int(0x04, IntSize.U16, Endian.BIG)
            header_byteOrder = header_byteOrder.toString(16)
            if (header_byteOrder == "feff") numMode = Endian.BIG
            else if (header_byteOrder == "fffe") numMode = Endian.LITTLE
        let header_sizeAndBlockReferences = header.int(0x06, IntSize.U16, numMode)
        let header_version = header.int(0x08, IntSize.U32, numMode)
            FileBuf.expectVal(header_version, [0x010000], "BFWAR header states an unknown/unsupported version")
        let header_fileSize = header.int(0x0C, IntSize.U32, numMode)
            FileBuf.expectVal(header_fileSize, fileBuf.data.byteLength, "BFWAR header states invalid file size")
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
        for (let i = 0; i < blockReferences.length; i++) bfwar_parseBlock(fileBuf, numMode, blockReferences[i].id, blockReferences[i].offset, blockReferences[i].size)
    
    let rawFiles = {}
        for (let i = 0; i < bfwar_files.length; i++) {
            let fileInfo = bfwar_files[i]
            rawFiles[`raw${i}.bfwav`] = fileInfo.content
        }
    return {
        ...rawFiles,
    }
}
function bfwar_parseBlock (fileBuf, numMode, id, offset, size) {
    let buf = fileBuf.buf(offset, size)
        let idStr = buf.str(0x00, 0x04)
        let size2 = buf.int(0x04, IntSize.U32, numMode)
        FileBuf.expectVal(size, size2, "Block size data doesn't match")
        if (id == 0x6800 && idStr == "INFO") {
            let numFiles = buf.int(0x08, IntSize.U32, numMode)
                let files = new Array(numFiles)
                for (let i = 0; i < numFiles; i++) {
                    let fileBlockReference = bfwar_parseReference(buf, numMode, (i * 0x0C) + 0x0C, 0x1F00, "File data")
                        let fileBlockOffset = fileBlockReference.offsetRel
                    let fileSize = buf.int((i * 0x0C) + 0x14, IntSize.U32, numMode)
                    files[i] = {
                        content: {
                            fileBlockOffset,
                            fileSize,
                        },
                    }
                }
                    bfwar_files = files
        } else if (id == 0x6801 && idStr == "FILE") {
            for (let i = 0; i < bfwar_files.length; i++) {
                let fileInfo = bfwar_files[i]
                let content = buf.buf(fileInfo.content.fileBlockOffset + 0x08, fileInfo.content.fileSize)
                bfwar_files[i].content = content.data
            }
        } else FileBuf.expectVal(0, 1, `Unknown or unmatching block id "0x${id.toString(16).padStart(4, "0").toUpperCase()}" and block id string "${idStr}"`)
}
function bfwar_parseReference (fileBuf, numMode, offset, expectedId = null, expectedIdMsg = null) {
    let id = fileBuf.int(offset, IntSize.U16, numMode)
    let padding = fileBuf.int(offset + 0x02, IntSize.U16, numMode)
    let offsetRel = fileBuf.int(offset + 0x04, IntSize.U32, numMode)

    let isPresent = id != 0x0000 || offsetRel != 0xFFFFFFFF
        if (!isPresent) id = null, offsetRel = null
    if (isPresent && expectedId != null) FileBuf.expectVal(id, expectedId, `Invalid reference: ${expectedIdMsg == null ? `<generic>` : expectedIdMsg}`)
    return {id, offsetRel, isPresent}
}
