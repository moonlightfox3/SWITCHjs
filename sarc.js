let resultSARC = null
let resultNameSARC = null
let inFileTypesSARC = ["sarc", "pack", "aras", "baatarc", "lyarc"]
let outFileTypeSARC = "zip"
async function decompressFileFromSARC () {
    let file = await importFile(inFileTypesSARC)
    let fileBuf = new FileBuf(file.buf)
    resultSARC = decompressFromSARC(fileBuf)
    resultNameSARC = file.name
}
async function downloadResultSARC () {
    await exportZip(resultSARC, resultNameSARC)
}
function decompressFromSARC (fileBuf) {
    let numMode = null
    let sarc = fileBuf.buf(0x00, 0x14)
        let sarc_name = sarc.str(0x00, 0x04)
            FileBuf.expectVal(sarc_name, "SARC", "SARC header does not start with 'SARC'")
        let sarc_byteOrder = sarc.int(0x06, IntSize.U16, Endian.BIG)
            sarc_byteOrder = sarc_byteOrder.toString(16)
            if (sarc_byteOrder == "feff") numMode = Endian.BIG
            else if (sarc_byteOrder == "fffe") numMode = Endian.LITTLE
        let sarc_headerLength = sarc.int(0x04, IntSize.U16, numMode)
            FileBuf.expectVal(sarc_headerLength, 0x14, "SARC header states incorrect size")
        let sarc_version = sarc.int(0x10, IntSize.U16, numMode)
            FileBuf.expectVal(sarc_version, 0x100, "SARC header states incorrect version")
        let sarc_fileSize = sarc.int(0x08, IntSize.U32, numMode)
            FileBuf.expectVal(sarc_fileSize, fileBuf.data.byteLength, "SARC header states invalid file size")
        let sarc_dataOffset = sarc.int(0x0C, IntSize.U32, numMode)
        let sarc_unused = sarc.int(0x12, IntSize.U16, numMode)
    let sfat = fileBuf.buf(0x14, 0x0C)
        let sfat_name = sfat.str(0x00, 0x04)
            FileBuf.expectVal(sfat_name, "SFAT", "SFAT header does not start with 'SFAT'")
        let sfat_headerLength = sfat.int(0x04, IntSize.U16, numMode)
            FileBuf.expectVal(sfat_headerLength, 0x0C, "SFAT header states incorrect size")
        let sfat_hashKey = sfat.int(0x08, IntSize.U32, numMode) // Typically 0x65 (For official files)
        let sfat_nodeCount = sfat.int(0x06, IntSize.U16, numMode)
    let sfatNodes = fileBuf.buf(0x20, sfat_nodeCount * 0x10)
        let sfatNodesList = new Array(sfat_nodeCount)
        for (let i = 0; i < sfat_nodeCount; i++) {
            let node = sfatNodes.buf(i * 0x10, 0x10)
            sfatNodesList[i] = {
                fileNameHash: node.int(0x00, IntSize.U32, numMode),
                fileDataStart: node.int(0x08, IntSize.U32, numMode),
                fileDataEnd: node.int(0x0C, IntSize.U32, numMode),
            }
            if (numMode == Endian.LITTLE) {
                sfatNodesList[i].fileNameTableOffset = node.int(0x04, IntSize.U24, numMode) * 0x04
                sfatNodesList[i].fileNameHashIndex = node.byte(0x07) // Starts at 1
            } else if (numMode == Endian.BIG) {
                sfatNodesList[i].fileNameHashIndex = node.byte(0x04) // Starts at 1
                sfatNodesList[i].fileNameTableOffset = node.int(0x05, IntSize.U24, numMode) * 0x04
            }
            sfatNodesList[i].hasFileName = sfatNodesList[i].fileNameTableOffset != 0x00 || sfatNodesList[i].fileNameHashIndex != 0x00
        }
        let sfatNodesEnd = 0x20 + (sfat_nodeCount * 0x10)
    let sfnt = fileBuf.buf(sfatNodesEnd, sfatNodesEnd + 0x08)
        let sfnt_name = sfnt.str(0x00, 0x04)
            FileBuf.expectVal(sfnt_name, "SFNT", "SFNT header does not start with 'SFNT'")
        let sfnt_headerLength = sfnt.int(0x04, IntSize.U16, numMode)
            FileBuf.expectVal(sfnt_headerLength, 0x08, "SFNT header states incorrect size")
        let sfnt_unused = sfnt.int(0x06, IntSize.U16, numMode)
    let fileNames = fileBuf.buf(sfatNodesEnd + 0x08, sarc_dataOffset - (sfatNodesEnd + 0x08)) // Might end with padding
        let fileNamesArr = new Uint8Array(fileNames.data)
    let fileDatas = fileBuf.buf(sarc_dataOffset, fileBuf.data.byteLength - sarc_dataOffset)
    let outObj = {}
        for (let i = 0; i < sfat_nodeCount; i++) {
            let dataOffset = sfatNodesList[i].fileDataStart
            let data = fileDatas.buf(dataOffset, sfatNodesList[i].fileDataEnd - dataOffset).data
            let nameHash = sfatNodesList[i].fileNameHash
            let name = [`NONAME_${nameHash.toString(16).toUpperCase().padStart(8, "0")}_${sfatNodesList[i].fileNameHashIndex}.bin`]

            if (sfatNodesList[i].hasFileName) {
                let nameOffset = sfatNodesList[i].fileNameTableOffset
                name = fileNames.buf(nameOffset, fileNamesArr.indexOf(0x00, nameOffset) - nameOffset)

                let hash = sarc_hashFileName(name, sfat_hashKey)
                if (hash != nameHash) FileBuf.expectVal(0, 1, "Invalid file name hash")

                name = name.str(0x00, name.data.byteLength)
                name = name.split("/")
            }

            let currentPath = outObj
            for (let namePart of name.slice(0, -1)) {
                if (currentPath[namePart] == undefined) currentPath[namePart] = {}
                currentPath = currentPath[namePart]
            }
            currentPath[name.at(-1)] = data
        }
    return outObj
}
function sarc_hashFileName (fileBuf, key) {
    fileBuf = new Uint8Array(fileBuf.data)
    key = BigInt(key)

    let hash = 0n
    for (let byte of fileBuf) hash = (hash * key) + BigInt(FileBuf.sign_extend(byte, IntSize.U8, IntSize.U32))
    return Number(hash & 0xFFFFFFFFn)
}
