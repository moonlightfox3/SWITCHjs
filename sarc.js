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
        let sfat_hashKey = sfat.int(0x08, IntSize.U32, numMode)
            FileBuf.expectVal(sfat_hashKey, 0x65, "SFAT header states incorrect hash key")
        let sfat_nodeCount = sfat.int(0x06, IntSize.U16, numMode)
    let sfatNodes = fileBuf.buf(0x20, sfat_nodeCount * 0x10)
        let sfatNodesList = new Array(sfat_nodeCount)
        for (let i = 0; i < sfat_nodeCount; i++) {
            let node = sfatNodes.buf(i * 0x10, 0x10)
            sfatNodesList[i] = {
                fileNameHash: node.int(0x00, IntSize.U32, numMode),
                fileAttributes: node.int(0x04, IntSize.U32, numMode),
                fileDataStart: node.int(0x08, IntSize.U32, numMode),
                fileDataEnd: node.int(0x0C, IntSize.U32, numMode),
            }
        }
        let sfatNodesEnd = 0x20 + (sfat_nodeCount * 0x10)
    let sfnt = fileBuf.buf(sfatNodesEnd, sfatNodesEnd + 0x08)
        let sfnt_name = sfnt.str(0x00, 0x04)
            FileBuf.expectVal(sfnt_name, "SFNT", "SFNT header does not start with 'SFNT'")
        let sfnt_headerLength = sfnt.int(0x04, IntSize.U16, numMode)
            FileBuf.expectVal(sfnt_headerLength, 0x08, "SFNT header states incorrect size")
        let sfnt_unused = sfnt.int(0x06, IntSize.U16, numMode)
    let fileNames = fileBuf.buf(sfatNodesEnd + 0x08, sarc_dataOffset - (sfatNodesEnd + 0x08))
        let fileNamesList = new Array(sfat_nodeCount)
        let fileNamesStr = fileNames.str(0x00, fileNames.data.byteLength)
        fileNamesList = fileNamesStr.split("\x00")
        fileNamesList = fileNamesList.map(val => val.replaceAll("\x00", ""))
        fileNamesList = fileNamesList.filter(val => val != "")
    let fileDatas = fileBuf.buf(sarc_dataOffset, fileBuf.data.byteLength - sarc_dataOffset)
        let fileDatasList = new Array(sfat_nodeCount)
        for (let i = 0; i < sfat_nodeCount; i++) {
            let node = sfatNodesList[i]
            let dataStart = node.fileDataStart
            let dataEnd = node.fileDataEnd
            let fileData = fileDatas.buf(dataStart, dataEnd - dataStart)
            fileDatasList[i] = fileData
        }
    let outObj = {}
        for (let i = 0; i < sfat_nodeCount; i++) {
            let name = fileNamesList[i]
            let data = fileDatasList[i].data
            outObj[name] = data
        }
    return outObj
}
