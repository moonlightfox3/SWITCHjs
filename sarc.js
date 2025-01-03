let resultSARC = null
let resultNameSARC = null
let inFileTypesSARC = ["sarc"]
let outFileTypeSARC = "zip"
async function decompressFileFromSARC () {
    let file = await importFile(inFileTypesSARC)
    resultSARC = decompressFromSARC(file.buf)
    resultNameSARC = file.name
}
async function downloadResultSARC () {
    await exportZip(resultSARC, resultNameSARC)
}
function decompressFromSARC (data) {
    let numMode = null
    let sarc = getBuf(data, 0, 20)
        let sarc_name = getStr(sarc, 0, 4)
            expectVal(sarc_name, "SARC", "Invalid file", "SARC header does not start with 'SARC'")
        let sarc_byteOrder = getNum(sarc, 6, 2, "BE")
            sarc_byteOrder = sarc_byteOrder.toString(16)
            if (sarc_byteOrder == "feff") numMode = "BE"
            else if (sarc_byteOrder == "fffe") numMode = "LE"
        let sarc_headerLength = getNum(sarc, 4, 2, numMode)
            expectVal(sarc_headerLength, 20, "Invalid file", "SARC header states incorrect size")
        let sarc_version = getNum(sarc, 16, 2, numMode)
            expectVal(sarc_version, 256, "Invalid file", "SARC header states incorrect version")
        let sarc_fileSize = getNum(sarc, 8, 4, numMode)
        let sarc_dataOffset = getNum(sarc, 12, 4, numMode)
        let sarc_unused = getNum(sarc, 18, 2, numMode)
    let sfat = getBuf(data, 20, 12)
        let sfat_name = getStr(sfat, 0, 4)
            expectVal(sfat_name, "SFAT", "Invalid file", "SFAT header does not start with 'SFAT'")
        let sfat_headerLength = getNum(sfat, 4, 2, numMode)
            expectVal(sfat_headerLength, 12, "Invalid file", "SFAT header states incorrect size")
        let sfat_hashKey = getNum(sfat, 8, 4, numMode)
            expectVal(sfat_hashKey, 101, "Invalid file", "SFAT header states incorrect hash key")
        let sfat_nodeCount = getNum(sfat, 6, 2, numMode)
    let sfatNodes = getBuf(data, 32, sfat_nodeCount * 16)
        let sfatNodesList = new Array(sfat_nodeCount)
        for (let i = 0; i < sfat_nodeCount; i++) {
            let node = getBuf(sfatNodes, i * 16, 16)
            sfatNodesList[i] = {
                fileNameHash: getNum(node, 0, 4, numMode),
                fileAttributes: getNum(node, 4, 4, numMode),
                fileDataStart: getNum(node, 8, 4, numMode),
                fileDataEnd: getNum(node, 12, 4, numMode),
            }
        }
        let sfatNodesEnd = 32 + (sfat_nodeCount * 16)
    let sfnt = getBuf(data, sfatNodesEnd, sfatNodesEnd + 8)
        let sfnt_name = getStr(sfnt, 0, 4)
            expectVal(sfnt_name, "SFNT", "Invalid file", "SFNT header does not start with 'SFNT'")
        let sfnt_headerLength = getNum(sfnt, 4, 2, numMode)
            expectVal(sfnt_headerLength, 8, "Invalid file", "SFNT header states incorrect size")
        let sfnt_unused = getNum(sfnt, 6, 2, numMode)
    let fileNames = getBuf(data, sfatNodesEnd + 8, sarc_dataOffset - (sfatNodesEnd + 8))
        let fileNamesList = new Array(sfat_nodeCount)
        let fileNamesStr = getStr(fileNames, 0, fileNames.byteLength)
        fileNamesList = fileNamesStr.split("\x00")
        fileNamesList = fileNamesList.map(val => val.replaceAll("\x00", ""))
        fileNamesList = fileNamesList.filter(val => val != "")
    let fileDatas = getBuf(data, sarc_dataOffset, data.byteLength - sarc_dataOffset)
        let fileDatasList = new Array(sfat_nodeCount)
        for (let i = 0; i < sfat_nodeCount; i++) {
            let node = sfatNodesList[i]
            let dataStart = node.fileDataStart
            let dataEnd = node.fileDataEnd
            let fileData = getBuf(fileDatas, dataStart, dataEnd - dataStart)
            fileDatasList[i] = fileData
        }
    let outObj = {}
        for (let i = 0; i < sfat_nodeCount; i++) {
            let name = fileNamesList[i]
            let data = fileDatasList[i]
            outObj[name] = data
        }
    return outObj
}
